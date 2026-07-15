using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Pty;
using JobPilot.Terminal.Realtime;
using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Updates;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace JobPilot.Terminal;

/// <summary>Configures and runs the terminal host.</summary>
public static class HostingExtensions
{
    /// <summary>Registers terminal host services.</summary>
    public static IServiceCollection AddTerminalHost(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddCors(options => options.AddPolicy(
            OriginPolicy.CorsPolicy,
            policy => policy
                .WithOrigins(OriginPolicy.Resolve(configuration))
                .AllowAnyHeader()
                .AllowAnyMethod()));
        services.AddSingleton<HostInstall>();
        services.AddSingleton<ProtocolRegistrar>();
        services.AddSingleton<GitHubReleaseClient>();
        services.AddSingleton<ReleaseInstaller>();
        services.AddSingleton<HostUpdateService>();
        services.AddSingleton<IPty, PtyProcess>();
        services.AddSingleton<SessionManager>();
        services.AddSingleton<TerminalHub>();
        services.AddSingleton(sp => new PilotStore(
            PilotStore.ResolvePath(sp.GetRequiredService<HostInstall>()),
            sp.GetRequiredService<ILogger<PilotStore>>()));
        services.AddSingleton<IPilotEnvironment, PilotEnvironment>();
        services.AddSingleton<PilotConductor>();
        services.AddHostedService(sp => sp.GetRequiredService<PilotConductor>());
        services.ConfigureHttpJsonOptions(c =>
            c.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));

        // Production otherwise returns an empty 400 for binding failures, while the web expects ProblemDetails.
        services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);

        // Must stay below HostHandoff.MaxWait or an update's relaunched child times out and fails to bind.
        services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(5));

        return services;
    }

    /// <summary>Configures middleware and session teardown.</summary>
    public static WebApplication UseTerminalPipeline(this WebApplication app)
    {
        app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
        {
            var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;

            var status = error is BadHttpRequestException bad
                ? bad.StatusCode
                : StatusCodes.Status500InternalServerError;

            context.Response.StatusCode = status;
            context.Response.ContentType = "application/problem+json";
            var problem = new ProblemDetails
            {
                Title = status == StatusCodes.Status500InternalServerError ? "Terminal host error" : "Invalid request",
                Detail = error?.Message,
                Status = status,
            };
            await context.Response.WriteAsJsonAsync(problem, AppJsonContext.Default.ProblemDetails);
        }));

        // CORS hides disallowed responses but does not stop simple requests such as POST /update.
        // The guard runs first, so it also rejects disallowed WebSocket handshakes.
        app.Use(next => OriginPolicy.CreateGuard(app.Configuration, next));
        app.UseCors(OriginPolicy.CorsPolicy);

        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });

        // Resolve the hub before the first /ws request so pre-connect output reaches its replay buffer.
        var hub = app.Services.GetRequiredService<TerminalHub>();

        app.Lifetime.ApplicationStopping.Register(() =>
        {
            app.Services.GetRequiredService<SessionManager>().Stop();
            // Open sockets otherwise hold Kestrel's graceful stop for the full shutdown timeout.
            hub.AbortAll();
        });

        return app;
    }

    /// <summary>Runs the app with a useful port-conflict error.</summary>
    public static void RunWithPortDiagnostics(this WebApplication app)
    {
        try
        {
            app.Run();
        }
        catch (IOException ex) when (ex.InnerException is AddressInUseException)
        {
            var url = app.Configuration["Kestrel:Endpoints:Http:Url"] ?? "http://localhost:4102";
            Console.Error.WriteLine(
                $"JobPilot terminal: {url} is already in use - another jobpilot instance is probably running.\n" +
                "Stop it and retry: 'Get-Process jobpilot | Stop-Process' (Windows) or 'pkill -x jobpilot' (macOS/Linux).");
            Environment.Exit(1);
        }
    }
}

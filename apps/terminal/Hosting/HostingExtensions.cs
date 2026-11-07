using System.Diagnostics.CodeAnalysis;
using JobPilot.Terminal.Install;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Telemetry;
using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Sessions.Relay;
using JobPilot.Terminal.Updates;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace JobPilot.Terminal.Hosting;

public static class HostingExtensions
{
    public static IServiceCollection AddTerminalHost(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddCors(options => options.AddPolicy(
            OriginPolicy.CorsPolicy,
            policy => policy.WithOrigins(OriginPolicy.Resolve(configuration)).AllowAnyHeader().AllowAnyMethod()));

        // One long-lived client for every outbound call. Callers bound their own requests; the pooled lifetime
        // lets a host that runs for weeks follow DNS changes.
        services.AddSingleton(_ => new HttpClient(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(15) })
        {
            Timeout = Timeout.InfiniteTimeSpan,
        });

        services.AddSingleton<HostInstall>();
        services.AddSingleton<HostStatus>();
        services.AddSingleton<UrlScheme>();

        services.AddHostedSingleton<ScratchCleaner>();
        services.AddSingleton<TerminalSession>();
        services.AddSingleton<TerminalRelay>();

        services.AddSingleton(sp => new PilotStore(
            PilotStore.ResolvePath(sp.GetRequiredService<HostInstall>()),
            sp.GetRequiredService<ILogger<PilotStore>>()));
        services.AddSingleton<PilotApi>();
        services.AddSingleton<UsageMeter>();
        services.AddHostedSingleton<StepRecorder>();
        services.AddSingleton<PilotSession>();
        services.AddSingleton<IPilotSession>(sp => sp.GetRequiredService<PilotSession>());
        services.AddHostedSingleton<PilotLoop>();
        services.AddSingleton(sp =>
        {
            var session = sp.GetRequiredService<PilotSession>();
            var loop = sp.GetRequiredService<PilotLoop>();
            return new PilotEventHandlers(loop.Wake, session.OnRunFinished, session.InterruptRunAsync, session.SteerRunAsync);
        });
        services.AddHostedService<PilotEventListener>();

        services.AddSingleton<ReleaseFeed>();
        services.AddSingleton<InstallSwap>();
        services.AddSingleton<HostUpdater>();

        services.ConfigureHttpJsonOptions(c => c.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));

        // Production otherwise answers a binding failure with an empty 400, and the web expects ProblemDetails.
        services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);

        // Must stay below HostHandoff.MaxWait, or an update's relaunched host times out and fails to bind.
        services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(5));

        return services;
    }

    /// <summary>A hosted service other services also inject, so both resolve the same instance.</summary>
    private static void AddHostedSingleton<[DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)] T>(
        this IServiceCollection services)
        where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService(sp => sp.GetRequiredService<T>());
    }

    public static WebApplication UseTerminalPipeline(this WebApplication app)
    {
        app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
        {
            var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
            var status = error switch
            {
                BadHttpRequestException bad => bad.StatusCode,
                ArgumentException => StatusCodes.Status400BadRequest,
                _ => StatusCodes.Status500InternalServerError,
            };

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

        app.Use(next => OriginPolicy.RejectOtherOrigins(app.Configuration, next));
        app.UseCors(OriginPolicy.CorsPolicy);
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });

        // Created before the first /ws request, so output from before a browser connects still reaches its replay.
        var relay = app.Services.GetRequiredService<TerminalRelay>();
        app.Lifetime.ApplicationStopping.Register(() =>
        {
            app.Services.GetRequiredService<TerminalSession>().Stop();
            // An open socket otherwise holds Kestrel's graceful stop for the whole shutdown timeout.
            relay.AbortAll();
        });

        return app;
    }

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
                $"JobPilot terminal: {url} is already in use - another jobpilot instance is probably running.\n"
                + "Stop it and retry: 'Get-Process jobpilot | Stop-Process' (Windows) or 'pkill -x jobpilot' (macOS/Linux).");
            Environment.Exit(1);
        }
    }
}

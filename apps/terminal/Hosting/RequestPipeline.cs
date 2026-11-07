using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Sessions.Relay;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace JobPilot.Terminal.Hosting;

public static class RequestPipeline
{
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

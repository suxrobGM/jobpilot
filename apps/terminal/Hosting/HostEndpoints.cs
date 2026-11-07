using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Hosting;

/// <summary>Acknowledges /shutdown; the process exits shortly after this response flushes.</summary>
public sealed record ShutdownResult(bool Ok);

public static class HostEndpoints
{
    public static void MapHostEndpoints(this WebApplication app)
    {
        app.MapGet("/healthz", (HostStatus status) => TypedResults.Ok(status.Get()));

        app.MapPost("/shutdown", (TerminalSession session, IHostApplicationLifetime lifetime) =>
        {
            // pilot.json survives, so the next start stays paired and resumes the pilot.
            session.Stop();
            lifetime.StopAfterResponse();
            return TypedResults.Ok(new ShutdownResult(Ok: true));
        });
    }
}

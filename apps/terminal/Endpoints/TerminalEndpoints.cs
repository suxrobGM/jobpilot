using JobPilot.Terminal.Models;
using JobPilot.Terminal.Plugins;
using JobPilot.Terminal.Realtime;
using JobPilot.Terminal.Sessions;
using Microsoft.AspNetCore.Http.HttpResults;

namespace JobPilot.Terminal.Endpoints;

/// <summary>
/// HTTP and WebSocket endpoints exposed by the terminal host.
/// </summary>
public static class TerminalEndpoints
{
    /// <summary>
    /// Maps /healthz, the /sessions lifecycle endpoints, and the /ws terminal socket.
    /// </summary>
    /// <param name="app">The web application to map endpoints on.</param>
    /// <returns>The same application for chaining.</returns>
    public static WebApplication MapTerminalEndpoints(this WebApplication app)
    {
        app.MapGet("/healthz", (SessionManager session) => TypedResults.Ok(CurrentStatus(session)));

        app.MapPost("/sessions/start", Results<Ok<SessionStatus>, ProblemHttpResult> (StartSessionRequest request, SessionManager session) =>
        {
            try
            {
                session.Start(request.Provider, request.WorkingDir, request.Cols, request.Rows, request.ApiToken, request.WebUrl, request.ApiUrl);
            }
            catch (Exception ex)
            {
                return TypedResults.Problem(
                    title: "Failed to start terminal session",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status500InternalServerError);
            }
            return TypedResults.Ok(CurrentStatus(session));
        });

        app.MapPost("/sessions/inject", async Task<Results<Ok, ProblemHttpResult>> (InjectRequest request, SessionManager session) =>
        {
            var injected = await session.Inject(request.Command, request.Provider);
            if (!injected)
            {
                return TypedResults.Problem(
                    title: "Inject rejected",
                    detail: "The session is not running or the active provider does not match the requested provider.",
                    statusCode: StatusCodes.Status409Conflict);
            }
            return TypedResults.Ok();
        });

        app.MapDelete("/sessions/current", (SessionManager session) =>
        {
            session.Stop();
            return TypedResults.Ok(CurrentStatus(session));
        });

        app.Map("/ws", async (HttpContext ctx, TerminalHub hub) =>
        {
            if (!ctx.WebSockets.IsWebSocketRequest)
            {
                ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            using var socket = await ctx.WebSockets.AcceptWebSocketAsync();
            await hub.HandleAsync(socket, ctx.RequestAborted);
        });

        return app;
    }

    /// <summary>
    /// Snapshot of host health + session state ("degraded" = the host runs but sessions
    /// can't start, e.g. the plugin tree is missing).
    /// </summary>
    private static SessionStatus CurrentStatus(SessionManager session) => new()
    {
        Status = session.PathsError is null ? "ok" : "degraded",
        Session = session.State == SessionState.Running ? "running" : "stopped",
        Provider = session.ActiveProvider,
        Providers = SessionManager.Providers,
        HostVersion = SessionManager.HostVersion,
        Detail = session.PathsError,
        CanRelaunch = ProtocolRegistrar.IsRegistered,
    };
}

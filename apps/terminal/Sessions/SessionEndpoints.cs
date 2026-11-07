using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions.Relay;
using Microsoft.AspNetCore.Http.HttpResults;

namespace JobPilot.Terminal.Sessions;

public sealed record StartSessionRequest(int Cols, int Rows, string? Provider, string? ApiToken, string? ApiUrl, string? WebUrl);

public static class Viewport
{
    public const int MinSize = 1;
    public const int MaxSize = 2000;

    public static bool IsValid(int cols, int rows) =>
        cols is >= MinSize and <= MaxSize && rows is >= MinSize and <= MaxSize;
}

public static class SessionEndpoints
{
    public static void MapSessionEndpoints(this WebApplication app)
    {
        app.MapPost("/sessions/start", Results<Ok<StatusResponse>, ProblemHttpResult> (
            StartSessionRequest request, TerminalSession session, HostStatus status) =>
        {
            if (!Viewport.IsValid(request.Cols, request.Rows))
            {
                return Problems.BadRequest($"cols and rows must each be between {Viewport.MinSize} and {Viewport.MaxSize}.");
            }

            session.Start(Provider.Find(request.Provider), request.Cols, request.Rows, request.ApiToken, request.ApiUrl, request.WebUrl);
            return TypedResults.Ok(status.Get());
        });

        app.MapDelete("/sessions/current", (TerminalSession session, HostStatus status) =>
        {
            session.Stop();
            return TypedResults.Ok(status.Get());
        });

        app.MapGet("/ws", async (HttpContext context, TerminalRelay relay) =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            await relay.ServeAsync(socket, context.RequestAborted);
        });
    }
}

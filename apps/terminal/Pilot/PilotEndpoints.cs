using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;
using Microsoft.AspNetCore.Http.HttpResults;

namespace JobPilot.Terminal.Pilot;

public sealed record PilotPairRequest(string? Provider, string? ApiToken, string? ApiUrl, string? WebUrl, string? UserId);

/// <summary>The pilot part of /healthz.</summary>
public sealed record PilotStatus
{
    /// <summary>Whether pilot settings are saved; the loop runs whenever they are.</summary>
    public required bool Paired { get; init; }

    /// <summary>The account the host is paired to.</summary>
    public string? UserId { get; init; }

    /// <summary>Whether the loop is driving a session right now.</summary>
    public required bool Conducting { get; init; }

    /// <summary>Set while the user's own typing holds new runs back.</summary>
    public DateTimeOffset? HeldUntil { get; init; }

    public DateTimeOffset? LastCycleAt { get; init; }

    /// <summary><c>ok</c>, <c>empty</c>, or <c>error</c>.</summary>
    public string? LastCycleStatus { get; init; }
}

public static class PilotEndpoints
{
    public static void MapPilotEndpoints(this WebApplication app)
    {
        app.MapPost("/pilot/pair", Results<Ok<StatusResponse>, ProblemHttpResult> (
            PilotPairRequest request, PilotStore store, HostStatus status) =>
        {
            var provider = Provider.Find(request.Provider);
            if (ApiConnection.Invalid(request.ApiToken, request.ApiUrl, request.WebUrl) is { } problem)
            {
                return Problems.BadRequest(problem);
            }

            store.Save(new PilotSettings
            {
                Provider = provider,
                Api = new ApiConnection(request.ApiUrl!, request.WebUrl!, request.ApiToken!),
                UserId = request.UserId,
            });
            return TypedResults.Ok(status.Get());
        });

        app.MapPost("/pilot/unpair", (PilotStore store, HostStatus status) =>
        {
            store.Clear();
            return TypedResults.Ok(status.Get());
        });

        // Ends the hold the user's typing put on new runs.
        app.MapPost("/pilot/handback", (TerminalSession terminal, HostStatus status) =>
        {
            terminal.ClearUserInput();
            return TypedResults.Ok(status.Get());
        });
    }
}

using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;
using Microsoft.AspNetCore.Http.HttpResults;

namespace JobPilot.Terminal.Pilot;

public sealed record PilotPairRequest(string? Provider, string? ApiToken, string? ApiUrl, string? WebUrl, string? UserId);

/// <summary>The pilot part of /healthz.</summary>
public sealed record PilotStatus
{
    /// <summary>Whether a pairing is saved; the loop runs whenever one is.</summary>
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
            PilotPairRequest request, PairingStore store, HostStatus status) =>
        {
            var provider = Provider.Parse(request.Provider);
            if (!ApiConnection.TryParse(request.ApiToken, request.ApiUrl, request.WebUrl, out var api, out var problem))
            {
                return Problems.BadRequest(problem);
            }

            store.Save(new PilotPairing
            {
                Provider = provider,
                Api = api,
                UserId = request.UserId,
            });
            return TypedResults.Ok(status.Get());
        });

        app.MapPost("/pilot/unpair", (PairingStore store, HostStatus status) =>
        {
            store.Clear();
            return TypedResults.Ok(status.Get());
        });

        // Ends the hold the user's typing put on new runs.
        app.MapPost("/pilot/handback", (TerminalSession terminal, HostStatus status) =>
        {
            terminal.ResetLastUserInput();
            return TypedResults.Ok(status.Get());
        });
    }
}

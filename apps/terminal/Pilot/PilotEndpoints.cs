using System.Text.Json;
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

    /// <summary>Restarts of a stuck session in a row; reset by a finished cycle.</summary>
    public required int ConsecutiveTimeouts { get; init; }
}

public static class PilotEndpoints
{
    public static void MapPilotEndpoints(this WebApplication app)
    {
        app.MapPost("/pilot/pair", Results<Ok<StatusResponse>, ProblemHttpResult> (
            PilotPairRequest request, PilotStore store, HostStatus status) =>
        {
            var provider = Provider.Find(request.Provider);
            if (string.IsNullOrWhiteSpace(request.ApiToken))
            {
                return Problems.BadRequest("apiToken must be a non-empty string.");
            }

            if (!IsHttpUrl(request.ApiUrl))
            {
                return Problems.BadRequest("apiUrl must be an absolute HTTP(S) URL.");
            }

            if (!IsHttpUrl(request.WebUrl))
            {
                return Problems.BadRequest("webUrl must be an absolute HTTP(S) URL.");
            }

            store.Save(new PilotSettings
            {
                Provider = provider,
                ApiToken = request.ApiToken,
                ApiUrl = request.ApiUrl!,
                WebUrl = request.WebUrl!,
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

        // The provider CLI's OpenTelemetry log exporter (OTLP/HTTP JSON) posts here; see UsageMeter and StepRecorder.
        app.MapPost("/v1/logs", async Task<IResult> (HttpRequest request, UsageMeter meter, StepRecorder steps) =>
        {
            try
            {
                using var export = await JsonDocument.ParseAsync(request.Body, cancellationToken: request.HttpContext.RequestAborted);
                meter.Read(export.RootElement);
                steps.Read(export.RootElement);
                return Results.Text("{}", "application/json");
            }
            catch (JsonException)
            {
                return TypedResults.BadRequest();
            }
        });
    }

    internal static bool IsHttpUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}

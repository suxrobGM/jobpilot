using System.Text.Json;

namespace JobPilot.Terminal.Pilot.Telemetry;

public static class OtlpEndpoints
{
    public static void MapOtlpEndpoints(this WebApplication app)
    {
        // The provider CLI's OpenTelemetry log exporter (OTLP/HTTP JSON) posts here.
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
}

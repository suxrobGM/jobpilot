using Microsoft.AspNetCore.Http.HttpResults;

namespace JobPilot.Terminal.Hosting;

internal static class Problems
{
    public static ProblemHttpResult BadRequest(string detail) =>
        TypedResults.Problem(title: "Invalid request", detail: detail, statusCode: StatusCodes.Status400BadRequest);
}

namespace JobPilot.Terminal.Sessions;

/// <summary>The JobPilot API and web a session's skills call, as the signed-in user.</summary>
public sealed record ApiConnection(string ApiUrl, string WebUrl, string ApiToken)
{
    /// <summary>Why these request values cannot make a connection, or null when they can.</summary>
    public static string? Invalid(string? apiToken, string? apiUrl, string? webUrl)
    {
        if (string.IsNullOrWhiteSpace(apiToken))
        {
            return "apiToken must be a non-empty string.";
        }

        if (!IsHttpUrl(apiUrl))
        {
            return "apiUrl must be an absolute HTTP(S) URL.";
        }

        return IsHttpUrl(webUrl) ? null : "webUrl must be an absolute HTTP(S) URL.";
    }

    private static bool IsHttpUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}

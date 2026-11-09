using System.Diagnostics.CodeAnalysis;

namespace JobPilot.Terminal.Sessions;

/// <summary>The JobPilot API and web a session's skills call, as the signed-in user.</summary>
public sealed record ApiConnection(string Url, string WebUrl, string Token)
{
    /// <summary>Builds a connection from request values, or says why they cannot make one.</summary>
    public static bool TryParse(
        string? token,
        string? url,
        string? webUrl,
        [NotNullWhen(true)] out ApiConnection? connection,
        [NotNullWhen(false)] out string? problem)
    {
        connection = null;
        if (string.IsNullOrWhiteSpace(token))
        {
            problem = "apiToken must be a non-empty string.";
            return false;
        }

        if (!IsHttpUrl(url))
        {
            problem = "apiUrl must be an absolute HTTP(S) URL.";
            return false;
        }

        if (!IsHttpUrl(webUrl))
        {
            problem = "webUrl must be an absolute HTTP(S) URL.";
            return false;
        }

        connection = new ApiConnection(url, webUrl, token);
        problem = null;
        return true;
    }

    private static bool IsHttpUrl([NotNullWhen(true)] string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}

using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json.Serialization;
using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Install.Updates;

public sealed record GitHubRelease(
    [property: JsonPropertyName("tag_name")] string? TagName,
    [property: JsonPropertyName("assets")] GitHubAsset[]? Assets);

public sealed record GitHubAsset(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("browser_download_url")] string? DownloadUrl);

/// <summary>The host's GitHub releases: which one is newer and which asset fits this machine.</summary>
public sealed class ReleaseFeed(HttpClient http)
{
    private const string ReleasesUrl = "https://api.github.com/repos/suxrobGM/jobpilot/releases?per_page=30";
    private const string TagPrefix = "v";

    public async Task<GitHubRelease[]> FetchAsync(CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, ReleasesUrl);
        request.Headers.UserAgent.Add(new ProductInfoHeaderValue("jobpilot-terminal", HostInstall.HostVersion));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        using var response = await http.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync(AppJsonContext.Default.GitHubReleaseArray, ct)
            ?? throw new InvalidOperationException("Could not read the GitHub releases list.");
    }

    /// <summary>The highest <c>vX.Y.Z</c> release newer than <paramref name="current"/>, if any.</summary>
    internal static (GitHubRelease Release, Version Version)? FindNewer(IEnumerable<GitHubRelease> releases, Version current)
    {
        (GitHubRelease Release, Version Version)? best = null;
        foreach (var release in releases)
        {
            if (release.TagName is not { } tag
                || !tag.StartsWith(TagPrefix, StringComparison.Ordinal)
                || !Version.TryParse(tag[TagPrefix.Length..], out var version))
            {
                continue;
            }

            if (version > current && (best is null || version > best.Value.Version))
            {
                best = (release, version);
            }
        }

        return best;
    }

    /// <summary>The archive this OS and architecture installs from.</summary>
    public static string AssetName() =>
        $"jobpilot-terminal-{RuntimeId()}{(OperatingSystem.IsWindows() ? ".zip" : ".tar.gz")}";

    private static string RuntimeId()
    {
        var os = "linux";
        if (OperatingSystem.IsWindows())
        {
            os = "win";
        }
        else if (OperatingSystem.IsMacOS())
        {
            os = "osx";
        }

        var arch = RuntimeInformation.OSArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            _ => throw new PlatformNotSupportedException($"Unsupported architecture: {RuntimeInformation.OSArchitecture}"),
        };
        return $"{os}-{arch}";
    }
}

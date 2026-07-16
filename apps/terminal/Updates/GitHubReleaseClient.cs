using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using JobPilot.Terminal.Common;
using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Updates;

/// <summary>Fields read from a GitHub release.</summary>
public sealed record GitHubRelease(
    [property: JsonPropertyName("tag_name")] string? TagName,
    [property: JsonPropertyName("assets")] GitHubAsset[]? Assets);

/// <summary>Fields read from a GitHub release asset.</summary>
public sealed record GitHubAsset(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("browser_download_url")] string? DownloadUrl);

/// <summary>Discovers and downloads host releases from GitHub.</summary>
public sealed class GitHubReleaseClient : IDisposable
{
    private const string ReleasesUrl = "https://api.github.com/repos/suxrobGM/jobpilot/releases?per_page=30";

    private const string TagPrefix = "v";

    private readonly HttpClient http;
    private readonly ILogger<GitHubReleaseClient> logger;

    public GitHubReleaseClient(ILogger<GitHubReleaseClient> logger)
    {
        this.logger = logger;

        http = HttpClients.CreateLongLivedClient();
        http.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("jobpilot-terminal", HostInstall.HostVersion));
        http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
    }

    /// <summary>Fetches available releases.</summary>
    public async Task<GitHubRelease[]?> FetchReleasesAsync(CancellationToken ct)
    {
        var json = await http.GetStringAsync(ReleasesUrl, ct);
        return JsonSerializer.Deserialize(json, AppJsonContext.Default.GitHubReleaseArray);
    }

    /// <summary>Finds the highest newer <c>vX.Y.Z</c> release.</summary>
    public static (GitHubRelease Release, Version Version)? SelectLatestAbove(GitHubRelease[] releases, Version current)
    {
        GitHubRelease? best = null;
        Version? bestVersion = null;
        foreach (var release in releases)
        {
            if (release.TagName is null || !release.TagName.StartsWith(TagPrefix, StringComparison.Ordinal))
            {
                continue;
            }
            if (!Version.TryParse(release.TagName[TagPrefix.Length..], out var version))
            {
                continue;
            }
            if (bestVersion is null || version > bestVersion)
            {
                bestVersion = version;
                best = release;
            }
        }

        return best is not null && bestVersion is not null && bestVersion > current ? (best, bestVersion) : null;
    }

    /// <summary>Finds the current platform's release asset.</summary>
    public string? ResolveAssetUrl((GitHubRelease Release, Version Version) latest)
    {
        var assetName = $"jobpilot-terminal-{CurrentRid()}{(OperatingSystem.IsWindows() ? ".zip" : ".tar.gz")}";
        var asset = latest.Release.Assets?.FirstOrDefault(a => string.Equals(a.Name, assetName, StringComparison.Ordinal));
        if (asset?.DownloadUrl is null)
        {
            logger.LogInformation("Host release {Tag} has no {Asset} asset; skipping.", latest.Release.TagName, assetName);
            return null;
        }
        return asset.DownloadUrl;
    }

    /// <summary>Downloads a release asset to a file.</summary>
    public async Task DownloadAsync(string url, string destinationFile, CancellationToken ct)
    {
        await using var download = await http.GetStreamAsync(url, ct);
        await using var file = File.Create(destinationFile);
        await download.CopyToAsync(file, ct);
    }

    public void Dispose() => http.Dispose();

    private static string CurrentRid()
    {
        var os = OperatingSystem.IsWindows() ? "win" : OperatingSystem.IsMacOS() ? "osx" : "linux";
        var arch = RuntimeInformation.OSArchitecture switch
        {
            Architecture.X64 => "x64",
            Architecture.Arm64 => "arm64",
            _ => throw new PlatformNotSupportedException($"Unsupported architecture: {RuntimeInformation.OSArchitecture}"),
        };
        return $"{os}-{arch}";
    }
}

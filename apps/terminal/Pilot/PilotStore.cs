using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Providers;

namespace JobPilot.Terminal.Pilot;

public sealed record PilotSettings
{
    public required Provider Provider { get; init; }
    public required string ApiToken { get; init; }
    public required string ApiUrl { get; init; }
    public required string WebUrl { get; init; }

    /// <summary>The account the host is paired to, so the web can tell a stale pairing from its own.</summary>
    public string? UserId { get; init; }
}

/// <summary>Shape of pilot.json. The token is DPAPI-wrapped on Windows and 0600 plaintext elsewhere.</summary>
internal sealed record PilotSettingsFile
{
    public required string Provider { get; init; }
    public required string ApiUrl { get; init; }
    public required string WebUrl { get; init; }
    public string? UserId { get; init; }
    public required string Token { get; init; }
    public required bool Protected { get; init; }
}

public sealed class PilotStore
{
    private readonly string filePath;
    private readonly ILogger<PilotStore> logger;
    private readonly Lock sync = new();
    private PilotSettings? current;

    public PilotStore(string filePath, ILogger<PilotStore> logger)
    {
        this.filePath = filePath;
        this.logger = logger;
        current = Load();
    }

    /// <summary>Raised after every write, outside the lock.</summary>
    public event Action? Changed;

    /// <summary>Null when nothing is saved or pilot.json is unreadable.</summary>
    public PilotSettings? Current
    {
        get
        {
            lock (sync)
            {
                return current;
            }
        }
    }

    /// <summary>The install root survives updates (only plugin/ is pruned).</summary>
    public static string ResolvePath(HostInstall install) =>
        Path.Combine(install.Paths?.WorkingDir ?? AppContext.BaseDirectory, "pilot.json");

    public void Save(PilotSettings settings)
    {
        lock (sync)
        {
            Persist(settings);
            current = settings;
        }

        Changed?.Invoke();
    }

    /// <summary>Unpairs: deletes pilot.json, so the loop parks until the next pairing.</summary>
    public void Clear()
    {
        lock (sync)
        {
            if (current is null)
            {
                return;
            }

            File.Delete(filePath);
            current = null;
        }

        Changed?.Invoke();
    }

    private void Persist(PilotSettings settings)
    {
        var (token, isProtected) = ProtectToken(settings.ApiToken);
        var file = new PilotSettingsFile
        {
            Provider = settings.Provider.Id,
            ApiUrl = settings.ApiUrl,
            WebUrl = settings.WebUrl,
            UserId = settings.UserId,
            Token = token,
            Protected = isProtected,
        };

        var directory = Path.GetDirectoryName(filePath)!;
        Directory.CreateDirectory(directory);

        // Write a temp file and move it over, so a crash never leaves a half-written pilot.json.
        var tempPath = Path.Combine(directory, $".{Path.GetFileName(filePath)}.{Guid.NewGuid():N}.tmp");
        try
        {
            var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, Share = FileShare.None };
            if (!OperatingSystem.IsWindows())
            {
                options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
            }

            using (var stream = new FileStream(tempPath, options))
            {
                JsonSerializer.Serialize(stream, file, AppJsonContext.Default.PilotSettingsFile);
                stream.Flush(flushToDisk: true);
            }

            File.Move(tempPath, filePath, overwrite: true);
        }
        catch
        {
            try
            {
                File.Delete(tempPath);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogDebug(ex, "Could not remove temporary pilot settings file {File}.", tempPath);
            }

            throw;
        }
    }

    private PilotSettings? Load()
    {
        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            var file = JsonSerializer.Deserialize(File.ReadAllText(filePath), AppJsonContext.Default.PilotSettingsFile);
            if (file is null)
            {
                return null;
            }

            if (UnprotectToken(file.Token, file.Protected) is not { } token)
            {
                logger.LogWarning("The pilot token could not be decrypted; treating the pilot as not set up.");
                return null;
            }

            return new PilotSettings
            {
                Provider = Provider.Find(file.Provider),
                ApiToken = token,
                ApiUrl = file.ApiUrl,
                WebUrl = file.WebUrl,
                UserId = file.UserId,
            };
        }
        catch (Exception ex) when (ex is JsonException or IOException or FormatException or ArgumentException)
        {
            logger.LogWarning(ex, "pilot.json is unreadable; treating the pilot as not set up.");
            return null;
        }
    }

    private static (string Token, bool Protected) ProtectToken(string token)
    {
        if (!OperatingSystem.IsWindows())
        {
            return (token, false);
        }

        var blob = ProtectedData.Protect(Encoding.UTF8.GetBytes(token), optionalEntropy: null, DataProtectionScope.CurrentUser);
        return (Convert.ToBase64String(blob), true);
    }

    private static string? UnprotectToken(string stored, bool isProtected)
    {
        if (!isProtected)
        {
            return stored;
        }

        // A blob written on Windows is unreadable off Windows or under another user.
        if (!OperatingSystem.IsWindows())
        {
            return null;
        }

        try
        {
            var bytes = ProtectedData.Unprotect(Convert.FromBase64String(stored), optionalEntropy: null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(bytes);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException)
        {
            return null;
        }
    }
}

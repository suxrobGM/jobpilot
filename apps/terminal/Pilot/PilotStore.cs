using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using JobPilot.Terminal.Hosting;

namespace JobPilot.Terminal.Pilot;

/// <summary>Persisted Pilot pairing: which provider drives, its credentials, and whether the loop is enabled.</summary>
public sealed record PilotPairing
{
    public required string Provider { get; init; }
    public required string ApiToken { get; init; }
    public required string ApiUrl { get; init; }
    public required string WebUrl { get; init; }
    public bool Enabled { get; init; }
}

/// <summary>On-disk shape; the token is DPAPI-wrapped on Windows and 0600 plaintext elsewhere.</summary>
internal sealed record PilotStateFile
{
    public required string Provider { get; init; }
    public required string ApiUrl { get; init; }
    public required string WebUrl { get; init; }
    public required bool Enabled { get; init; }
    public required string Token { get; init; }
    public required bool Protected { get; init; }
}

/// <summary>Persists the Pilot pairing, protecting the agent token at rest and caching it in memory.</summary>
public sealed class PilotStore
{
    private readonly string filePath;
    private readonly ILogger<PilotStore> logger;
    private readonly Lock gate = new();
    private PilotPairing? current;

    public PilotStore(string filePath, ILogger<PilotStore> logger)
    {
        this.filePath = filePath;
        this.logger = logger;
        current = LoadFromDisk();
    }

    /// <summary>Resolves the pairing file under the install root, which survives updates (only plugin/ is pruned).</summary>
    public static string ResolvePath(HostInstall install)
    {
        var root = install.Paths?.WorkingDir ?? AppContext.BaseDirectory;
        return Path.Combine(root, "pilot.json");
    }

    /// <summary>The current pairing, or null when unpaired or the stored file is unreadable.</summary>
    public PilotPairing? Current
    {
        get
        {
            lock (gate)
            {
                return current;
            }
        }
    }

    /// <summary>Stores a pairing and its enabled flag, replacing any prior pairing.</summary>
    public void Save(PilotPairing pairing)
    {
        lock (gate)
        {
            Persist(pairing);
            current = pairing;
        }
    }

    /// <summary>Flips the enabled flag while keeping the pairing; a no-op when unpaired.</summary>
    public void SetEnabled(bool enabled)
    {
        lock (gate)
        {
            if (current is null || current.Enabled == enabled)
            {
                return;
            }

            var updated = current with { Enabled = enabled };
            Persist(updated);
            current = updated;
        }
    }

    private void Persist(PilotPairing pairing)
    {
        var token = ProtectToken(pairing.ApiToken, out var isProtected);
        var file = new PilotStateFile
        {
            Provider = pairing.Provider,
            ApiUrl = pairing.ApiUrl,
            WebUrl = pairing.WebUrl,
            Enabled = pairing.Enabled,
            Token = token,
            Protected = isProtected,
        };

        var directory = Path.GetDirectoryName(filePath)
            ?? throw new InvalidOperationException("Pilot pairing path has no parent directory.");
        Directory.CreateDirectory(directory);

        var tempPath = Path.Combine(directory, $".{Path.GetFileName(filePath)}.{Guid.NewGuid():N}.tmp");
        try
        {
            var options = new FileStreamOptions
            {
                Mode = FileMode.CreateNew,
                Access = FileAccess.Write,
                Share = FileShare.None,
            };
            if (!OperatingSystem.IsWindows())
            {
                options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
            }

            var json = JsonSerializer.Serialize(file, AppJsonContext.Default.PilotStateFile);
            using (var stream = new FileStream(tempPath, options))
            {
                stream.Write(Encoding.UTF8.GetBytes(json));
                stream.Flush(flushToDisk: true);
            }

            File.Move(tempPath, filePath, overwrite: true);
        }
        catch
        {
            // A successful Move consumes the temp file, so only a failed write leaves one behind.
            try
            {
                File.Delete(tempPath);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogDebug(ex, "Could not remove temporary Pilot pairing file {File}.", tempPath);
            }

            throw;
        }
    }

    private PilotPairing? LoadFromDisk()
    {
        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            var file = JsonSerializer.Deserialize(File.ReadAllText(filePath), AppJsonContext.Default.PilotStateFile);
            if (file is null)
            {
                return null;
            }

            var token = UnprotectToken(file.Token, file.Protected);
            if (token is null)
            {
                logger.LogWarning("Pilot pairing token could not be decrypted; treating as unpaired.");
                return null;
            }

            return new PilotPairing
            {
                Provider = file.Provider,
                ApiToken = token,
                ApiUrl = file.ApiUrl,
                WebUrl = file.WebUrl,
                Enabled = file.Enabled,
            };
        }
        catch (Exception ex) when (ex is JsonException or IOException or FormatException)
        {
            logger.LogWarning(ex, "Pilot pairing file is unreadable; treating as unpaired.");
            return null;
        }
    }

    private static string ProtectToken(string token, out bool isProtected)
    {
        if (OperatingSystem.IsWindows())
        {
            var blob = ProtectedData.Protect(Encoding.UTF8.GetBytes(token), optionalEntropy: null, DataProtectionScope.CurrentUser);
            isProtected = true;
            return Convert.ToBase64String(blob);
        }

        isProtected = false;
        return token;
    }

    private static string? UnprotectToken(string stored, bool isProtected)
    {
        if (!isProtected)
        {
            return stored;
        }

        // A blob written on Windows is unreadable off Windows or under a different user.
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

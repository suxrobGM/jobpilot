using System.Text.Json;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Install;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Pilot;

public sealed class PairingStore
{
    private readonly string filePath;
    private readonly ILogger<PairingStore> logger;
    private readonly Lock sync = new();
    private PilotPairing? current;

    public PairingStore(HostInstall install, ILogger<PairingStore> logger)
    {
        // The install root survives updates (only plugin/ is pruned).
        filePath = Path.Combine(install.Paths?.WorkingDir ?? AppContext.BaseDirectory, "pilot.json");
        this.logger = logger;
        current = Load();
    }

    /// <summary>Raised after every write, outside the lock.</summary>
    public event Action? Changed;

    /// <summary>Null when nothing is saved or pilot.json is unreadable.</summary>
    public PilotPairing? Current
    {
        get
        {
            lock (sync)
            {
                return current;
            }
        }
    }

    public void Save(PilotPairing pairing)
    {
        lock (sync)
        {
            Persist(pairing);
            current = pairing;
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

    private void Persist(PilotPairing pairing)
    {
        var (token, isProtected) = TokenProtection.Protect(pairing.Api.Token);
        var file = new PairingFile
        {
            Provider = pairing.Provider.Id,
            ApiUrl = pairing.Api.Url,
            WebUrl = pairing.Api.WebUrl,
            UserId = pairing.UserId,
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
                JsonSerializer.Serialize(stream, file, AppJsonContext.Default.PairingFile);
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
                logger.LogDebug(ex, "Could not remove temporary pairing file {File}.", tempPath);
            }

            throw;
        }
    }

    private PilotPairing? Load()
    {
        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            var file = JsonSerializer.Deserialize(File.ReadAllText(filePath), AppJsonContext.Default.PairingFile);
            if (file is null)
            {
                return null;
            }

            if (TokenProtection.Unprotect(file.Token, file.Protected) is not { } token)
            {
                logger.LogWarning("The pilot token could not be decrypted; treating the pilot as not set up.");
                return null;
            }

            return new PilotPairing
            {
                Provider = Provider.Parse(file.Provider),
                Api = new ApiConnection(file.ApiUrl, file.WebUrl, token),
                UserId = file.UserId,
            };
        }
        catch (Exception ex) when (ex is JsonException or IOException or FormatException or ArgumentException)
        {
            logger.LogWarning(ex, "pilot.json is unreadable; treating the pilot as not set up.");
            return null;
        }
    }
}

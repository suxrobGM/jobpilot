using System.Text.Json;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Install;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Pilot;

public sealed class PilotStore
{
    private readonly string filePath;
    private readonly ILogger<PilotStore> logger;
    private readonly Lock sync = new();
    private PilotSettings? current;

    public PilotStore(HostInstall install, ILogger<PilotStore> logger)
    {
        // The install root survives updates (only plugin/ is pruned).
        filePath = Path.Combine(install.Paths?.WorkingDir ?? AppContext.BaseDirectory, "pilot.json");
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
        var (token, isProtected) = TokenProtection.Protect(settings.Api.Token);
        var file = new PilotSettingsFile
        {
            Provider = settings.Provider.Id,
            ApiUrl = settings.Api.Url,
            WebUrl = settings.Api.WebUrl,
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

            if (TokenProtection.Unprotect(file.Token, file.Protected) is not { } token)
            {
                logger.LogWarning("The pilot token could not be decrypted; treating the pilot as not set up.");
                return null;
            }

            return new PilotSettings
            {
                Provider = Provider.Find(file.Provider),
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

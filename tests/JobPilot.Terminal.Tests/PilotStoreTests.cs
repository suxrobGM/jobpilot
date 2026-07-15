using JobPilot.Terminal.Pilot;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class PilotStoreTests : IDisposable
{
    private readonly TempDir temp = new();
    private readonly string path;

    public PilotStoreTests()
    {
        path = Path.Combine(temp.Root, ".jobpilot", "pilot.json");
    }

    public void Dispose() => temp.Dispose();

    private PilotStore NewStore() => new(path, NullLogger<PilotStore>.Instance);

    private static PilotPairing Pairing(bool enabled = true) => new()
    {
        Provider = "codex",
        ApiToken = "secret-token",
        ApiUrl = "https://api.example",
        WebUrl = "https://web.example",
        Enabled = enabled,
    };

    [Fact]
    public void Current_IsNull_WhenNoFileExists()
    {
        Assert.Null(NewStore().Current);
    }

    [Fact]
    public void Save_RoundTripsThroughAFreshStore()
    {
        NewStore().Save(Pairing());

        var reloaded = NewStore().Current;

        Assert.NotNull(reloaded);
        Assert.Equal("codex", reloaded!.Provider);
        Assert.Equal("secret-token", reloaded.ApiToken);
        Assert.Equal("https://api.example", reloaded.ApiUrl);
        Assert.Equal("https://web.example", reloaded.WebUrl);
        Assert.True(reloaded.Enabled);
    }

    [Fact]
    public void SetEnabled_KeepsThePairing_AndPersists()
    {
        var store = NewStore();
        store.Save(Pairing());

        store.SetEnabled(false);

        Assert.False(store.Current!.Enabled);
        Assert.Equal("secret-token", store.Current.ApiToken);
        Assert.False(NewStore().Current!.Enabled); // survived a reload
    }

    [Fact]
    public void SetEnabled_IsANoOp_WhenUnpaired()
    {
        var store = NewStore();

        store.SetEnabled(false);

        Assert.Null(store.Current);
        Assert.False(File.Exists(path));
    }

    [Fact]
    public void Load_TreatsACorruptFileAsUnpaired()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, "{ this is not valid json ");

        Assert.Null(NewStore().Current);
    }

    [Fact]
    public void Save_DoesNotStoreTheRawTokenOnWindows()
    {
        if (!OperatingSystem.IsWindows())
        {
            return; // DPAPI protection only applies on Windows.
        }

        NewStore().Save(Pairing());

        Assert.DoesNotContain("secret-token", File.ReadAllText(path));
    }

    [Fact]
    public void Save_RestrictsFilePermissionsOffWindows()
    {
        if (OperatingSystem.IsWindows())
        {
            return; // Unix file mode is not meaningful on Windows.
        }

        NewStore().Save(Pairing());

        var mode = File.GetUnixFileMode(path);
        Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, mode);
    }
}

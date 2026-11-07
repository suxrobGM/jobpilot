using JobPilot.Terminal.Install;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests.Pilot;

public sealed class PilotStoreTests : IDisposable
{
    private readonly TempDir temp = new();
    private readonly string path;

    public PilotStoreTests()
    {
        path = Path.Combine(temp.Root, "pilot.json");
    }

    public void Dispose() => temp.Dispose();

    private PilotStore NewStore() => new(new HostInstall(temp.Paths), NullLogger<PilotStore>.Instance);

    private static PilotSettings SavedSettings(string userId = "user-1") => new()
    {
        Provider = Provider.Codex,
        Api = new ApiConnection("https://api.example", "https://web.example", "secret-token"),
        UserId = userId,
    };

    [Fact]
    public void Save_RoundTripsThroughAFreshStore()
    {
        NewStore().Save(SavedSettings());

        var reloaded = NewStore().Current;

        Assert.NotNull(reloaded);
        Assert.Same(Provider.Codex, reloaded!.Provider);
        Assert.Equal(new ApiConnection("https://api.example", "https://web.example", "secret-token"), reloaded.Api);
        Assert.Equal("user-1", reloaded.UserId);
    }

    [Fact]
    public void Clear_Unpairs_AndRaisesChangedOnlyWhenPaired()
    {
        var store = NewStore();
        var changes = 0;
        store.Changed += () => changes++;

        store.Clear(); // nothing saved yet
        store.Save(SavedSettings());
        store.Clear();

        Assert.Null(store.Current);
        Assert.False(File.Exists(path));
        Assert.Null(NewStore().Current);
        Assert.Equal(2, changes);
    }

    [Fact]
    public void Load_ReadsAFileFromBeforePairing_IgnoringItsRunningFlag()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(
            path,
            """{"provider":"claude","token":"t","protected":false,"apiUrl":"https://a","webUrl":"https://w","running":false}""");

        var loaded = NewStore().Current;

        Assert.NotNull(loaded);
        Assert.Null(loaded!.UserId);
    }

    [Theory]
    [InlineData("{ this is not valid json ")]
    [InlineData("""{"provider":"gemini","token":"t","protected":false,"apiUrl":"https://a","webUrl":"https://w","running":true}""")]
    public void Load_TreatsACorruptFileOrUnknownProviderAsNothingSaved(string json)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, json);

        Assert.Null(NewStore().Current);
    }

    [Fact]
    public void Save_DoesNotStoreTheRawTokenOnWindows()
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        NewStore().Save(SavedSettings());

        Assert.DoesNotContain("secret-token", File.ReadAllText(path));
    }

    [Fact]
    public void Save_RestrictsFilePermissionsOffWindows()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        NewStore().Save(SavedSettings());

        var mode = File.GetUnixFileMode(path);
        Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, mode);
    }

    [Fact]
    public void Save_ReplacesTheFile_WithoutLeavingTemporaryFiles()
    {
        var store = NewStore();
        store.Save(SavedSettings());

        store.Save(SavedSettings(userId: "user-2"));

        Assert.Equal("user-2", NewStore().Current!.UserId);
        Assert.Empty(Directory.EnumerateFiles(temp.Root, ".pilot.json.*.tmp"));
    }
}

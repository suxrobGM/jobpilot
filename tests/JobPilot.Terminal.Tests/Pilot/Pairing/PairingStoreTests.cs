using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Tests.Support;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests.Pilot.Pairing;

public sealed class PairingStoreTests : IDisposable
{
    private readonly TempDir temp = new();

    private string PilotJson => Path.Combine(temp.Root, "pilot.json");

    public void Dispose() => temp.Dispose();

    private PairingStore NewStore() => temp.PairingStore();

    private static PilotPairing SavedPairing(string userId = "user-1") => new()
    {
        Provider = Provider.Codex,
        Api = new ApiConnection("https://api.example", "https://web.example", "secret-token"),
        UserId = userId,
    };

    [Fact]
    public void Save_RoundTripsThroughAFreshStore()
    {
        NewStore().Save(SavedPairing());

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
        store.Save(SavedPairing());
        store.Clear();

        Assert.Null(store.Current);
        Assert.False(File.Exists(PilotJson));
        Assert.Null(NewStore().Current);
        Assert.Equal(2, changes);
    }

    [Fact]
    public void Load_ReadsAFileFromBeforePairing_IgnoringItsRunningFlag()
    {
        temp.File(
            "pilot.json",
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
        temp.File("pilot.json", json);

        Assert.Null(NewStore().Current);
    }

    [Fact]
    public void Save_DoesNotStoreTheRawTokenOnWindows()
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        NewStore().Save(SavedPairing());

        Assert.DoesNotContain("secret-token", File.ReadAllText(PilotJson));
    }

    [Fact]
    public void Save_RestrictsFilePermissionsOffWindows()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        NewStore().Save(SavedPairing());

        var mode = File.GetUnixFileMode(PilotJson);
        Assert.Equal(UnixFileMode.UserRead | UnixFileMode.UserWrite, mode);
    }

    [Fact]
    public void Save_ReplacesTheFile_WithoutLeavingTemporaryFiles()
    {
        var store = NewStore();
        store.Save(SavedPairing());

        store.Save(SavedPairing(userId: "user-2"));

        Assert.Equal("user-2", NewStore().Current!.UserId);
        Assert.Empty(Directory.EnumerateFiles(temp.Root, ".pilot.json.*.tmp"));
    }
}

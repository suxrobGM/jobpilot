using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Pty;
using JobPilot.Terminal.Realtime;
using JobPilot.Terminal.Sessions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class SessionManagerTests : IDisposable
{
    private static readonly byte[] Enter = "\r"u8.ToArray();

    private readonly TempDir temp = new();
    private readonly FakePty pty = new();
    private readonly SessionManager session;

    public SessionManagerTests()
    {
        var paths = new InstallPaths
        {
            WorkingDir = temp.Root,
            SharedSkillsDir = Path.Combine(temp.Root, "plugin", "skills"),
            ClaudePluginDir = Path.Combine(temp.Root, "plugin"),
        };
        session = new SessionManager(pty, new HostInstall(paths), NullLogger<SessionManager>.Instance);
    }

    public void Dispose()
    {
        session.Dispose();
        temp.Dispose();
    }

    private void Start(string? provider = null) => session.Start(new SessionStartOptions(provider, 80, 24));

    private bool WroteEnter() => pty.Writes.Any(w => w.AsSpan().SequenceEqual(Enter));

    [Fact]
    public void Start_RunsTheRequestedProvider()
    {
        Start(TerminalProviders.Codex);

        Assert.Equal(SessionState.Running, session.State);
        Assert.Equal(TerminalProviders.Codex, session.ActiveProvider);
        Assert.Equal("codex", pty.LastCommand);
    }

    [Fact]
    public void Start_IsANoOp_WhenTheSameProviderIsAlreadyRunning()
    {
        Start(TerminalProviders.Claude);
        Start(TerminalProviders.Claude);

        Assert.Equal(1, pty.StartCount);
    }

    [Fact]
    public void Start_InjectsTheAgentEnvironment()
    {
        session.Start(new SessionStartOptions(
            TerminalProviders.Claude,
            80,
            24,
            ApiToken: "tok",
            ApiUrl: "https://api",
            WebUrl: "https://web"));

        var env = pty.LastEnvironment!;
        Assert.Equal(Path.Combine(temp.Root, "plugin", "skills"), env["JOBPILOT_SKILLS_ROOT"]);
        Assert.Equal(temp.Root, env["JOBPILOT_WORKSPACE_ROOT"]);
        Assert.Equal("tok", env["JOBPILOT_API_TOKEN"]);
        Assert.Equal("https://web", env["JOBPILOT_WEB"]);
        Assert.Equal("https://api", env["JOBPILOT_API"]);
    }

    [Fact]
    public void Start_Throws_ForAnUnknownProvider()
    {
        Assert.Throws<ArgumentException>(() => Start("gemini"));
        Assert.Equal(SessionState.Stopped, session.State);
    }

    [Fact]
    public void Start_LeavesTheSessionStopped_WhenTheProcessCannotSpawn()
    {
        pty.StartFailure = new FileNotFoundException("claude not on PATH");

        Assert.Throws<PtyStartException>(() => Start());
        Assert.Equal(SessionState.Stopped, session.State);
    }

    [Fact]
    public void Start_Throws_WhenTheInstallIsIncomplete()
    {
        using var broken = new SessionManager(
            new FakePty(), new HostInstall(paths: null, pathsError: "no plugin tree"), NullLogger<SessionManager>.Instance);

        var ex = Assert.Throws<InvalidOperationException>(() => broken.Start(new SessionStartOptions(null, 80, 24)));
        Assert.Contains("no plugin tree", ex.Message);
    }

    [Fact]
    public void Exit_OfTheLiveGeneration_StopsTheSession()
    {
        Start();
        var live = pty.CurrentGeneration;

        pty.RaiseExit(live);

        Assert.Equal(SessionState.Stopped, session.State);
    }

    [Fact]
    public void Exit_OfASupersededGeneration_IsIgnored()
    {
        Start(TerminalProviders.Claude);
        var replaced = pty.CurrentGeneration;
        Start(TerminalProviders.Codex);

        pty.RaiseExit(replaced);

        Assert.Equal(SessionState.Running, session.State);
        Assert.Equal(TerminalProviders.Codex, session.ActiveProvider);
    }

    [Fact]
    public void Exit_OfTheReplacementStillReports_AfterASupersededExitWasIgnored()
    {
        // Ignoring one stale exit must not suppress the replacement's real exit.
        Start(TerminalProviders.Claude);
        var replaced = pty.CurrentGeneration;
        Start(TerminalProviders.Codex);
        var live = pty.CurrentGeneration;

        pty.RaiseExit(replaced);
        pty.RaiseExit(live);

        Assert.Equal(SessionState.Stopped, session.State);
    }

    [Fact]
    public void Exit_OfTwiceSupersededGenerations_ArrivingLate_LeavesTheLiveSessionRunning()
    {
        Start(TerminalProviders.Claude);
        var first = pty.CurrentGeneration;
        Start(TerminalProviders.Codex);
        var second = pty.CurrentGeneration;
        Start(TerminalProviders.Claude);

        pty.RaiseExit(first);
        pty.RaiseExit(second);

        Assert.Equal(SessionState.Running, session.State);
        Assert.Equal(TerminalProviders.Claude, session.ActiveProvider);
    }

    [Fact]
    public void Exit_ArrivingAfterARestart_DoesNotStopTheNewSession()
    {
        Start();
        var stopped = pty.CurrentGeneration;
        session.Stop();
        Start();

        pty.RaiseExit(stopped);

        Assert.Equal(SessionState.Running, session.State);
    }

    [Fact]
    public void Exit_AfterAnExplicitStop_IsReportedOnce()
    {
        Start();
        var live = pty.CurrentGeneration;
        var exits = new List<SessionExit>();
        session.Exited += exits.Add;

        session.Stop();
        pty.RaiseExit(live); // Kill() still surfaces the requested exit to Pilot waiters.
        pty.RaiseExit(live); // a duplicate must not resurrect anything

        Assert.Equal(SessionState.Stopped, session.State);
        Assert.Single(exits);
        Assert.True(exits[0].Requested);
        Assert.Null(TerminalHub.FormatExitMessage(exits[0]));
    }

    [Fact]
    public void NaturalExit_IsUnexpected_AndKeepsTheCrashBanner()
    {
        Start();
        SessionExit? seen = null;
        session.Exited += exit => seen = exit;

        pty.RaiseExit(pty.CurrentGeneration, exitCode: 7);

        Assert.NotNull(seen);
        Assert.False(seen.Value.Requested);
        Assert.Contains("exited with code 7", TerminalHub.FormatExitMessage(seen.Value));
    }

    [Fact]
    public void RequestedStop_DoesNotLeakToAReplacementGeneration()
    {
        Start();
        session.Stop();
        Start();
        SessionExit? seen = null;
        session.Exited += exit => seen = exit;

        pty.RaiseExit(pty.CurrentGeneration);

        Assert.NotNull(seen);
        Assert.False(seen.Value.Requested);
    }

    [Fact]
    public async Task Inject_WritesTheCommandThenASeparateEnter()
    {
        Start();

        var result = await session.Inject("/jobpilot:setup");

        Assert.Equal(InjectResult.Injected, result);
        Assert.Equal(2, pty.Writes.Count);
        Assert.Equal("/jobpilot:setup"u8.ToArray(), pty.Writes[0]);
        Assert.Equal(Enter, pty.Writes[1]);
    }

    [Fact]
    public async Task Inject_IsRejected_WhenNoSessionIsRunning()
    {
        Assert.Equal(InjectResult.NotRunning, await session.Inject("x"));
    }

    [Fact]
    public async Task Inject_IsRejected_WhenTheActiveProviderDiffers()
    {
        Start(TerminalProviders.Claude);

        Assert.Equal(InjectResult.ProviderMismatch, await session.Inject("x", TerminalProviders.Codex));
        Assert.Empty(pty.Writes);
    }

    [Fact]
    public async Task Inject_Throws_ForAnUnknownExpectedProvider()
    {
        Start();

        await Assert.ThrowsAsync<ArgumentException>(() => session.Inject("x", "gemini"));
    }

    [Fact]
    public async Task Inject_DoesNotSubmitIntoAReplacementSession()
    {
        // Enter is delayed, leaving a window in which the provider can change.
        Start(TerminalProviders.Claude);

        var inject = session.Inject("rm -rf /");
        await Task.Delay(15);
        Start(TerminalProviders.Codex);

        Assert.Equal(InjectResult.NotRunning, await inject);
        Assert.False(WroteEnter(), "Enter was submitted into the replacement session.");
    }

    [Fact]
    public async Task Inject_DoesNotSubmit_WhenTheSessionStopsDuringTheDelay()
    {
        Start();

        var inject = session.Inject("hello");
        await Task.Delay(15);
        session.Stop();

        Assert.Equal(InjectResult.NotRunning, await inject);
        Assert.False(WroteEnter());
    }

    [Fact]
    public async Task Inject_DoesNotSubmit_WhenCallerCancellationArrivesDuringTheDelay()
    {
        Start();
        using var cts = new CancellationTokenSource();

        var inject = session.Inject("hello", ct: cts.Token);
        await Task.Delay(15);
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => inject);
        Assert.False(WroteEnter());
    }
}

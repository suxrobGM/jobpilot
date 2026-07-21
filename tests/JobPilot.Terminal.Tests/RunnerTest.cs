using JobPilot.Terminal.Pilot;

namespace JobPilot.Terminal.Tests;

/// <summary>Shared arrange helpers for the PilotCycleRunner behavior tests, split across domain files.</summary>
internal static class RunnerTest
{
    public static readonly PilotPairing Claude = TestPairing.Create();

    // A poll interval >= the wait windows collapses each sentinel wait to a single slice, so the "await" action
    // count is one per rung and the sequence asserts stay legible.
    public static readonly TimeSpan Poll = TimeSpan.FromMinutes(20);

    public static PilotCycleRunner Runner(FakePilotRuntime env) => new(env, Poll);

    public static PilotCycle Cycle(int sleep, PilotCycleStatus status = PilotCycleStatus.Ok) =>
        new(Guid.NewGuid(), status, sleep);

    public static DateTimeOffset Fresh => DateTimeOffset.UtcNow;

    public static DateTimeOffset Stale => DateTimeOffset.UtcNow - PilotCycleRunner.LivenessWindow - TimeSpan.FromMinutes(5);

    public static PilotActivitySnapshot Live(DateTimeOffset at, PilotCompletedCycle? cycle = null) => new(at, cycle);

    public static PilotCompletedCycle Completed(int? sleep, string status = "ok") =>
        new(Guid.NewGuid().ToString(), DateTimeOffset.UtcNow, status, sleep);
}

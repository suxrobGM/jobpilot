using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Providers;

namespace JobPilot.Terminal.Pilot.Agent;

/// <summary>CheckIn asks the agent to post its result; Skip makes it post a failed one.</summary>
public enum Directive
{
    CheckIn,
    Skip,
}

/// <summary>The loop's seam to the agent's terminal, so tests can script a whole cycle.</summary>
public interface IPilotAgent
{
    /// <summary>Null when no session is running.</summary>
    Provider? RunningProvider { get; }

    /// <summary>When the user last typed into the terminal.</summary>
    DateTimeOffset? LastUserInputAt { get; }

    void Start(PilotPairing pairing);

    /// <summary>Clears the agent's context and hands it the run.</summary>
    Task SendCycleAsync(Provider provider, string runId, CancellationToken ct);

    /// <summary>Sent to the handed-over run, on its own provider.</summary>
    Task SendDirectiveAsync(Directive directive, CancellationToken ct);

    Task<WaitResult> WaitForSignalAsync(TimeSpan timeout, CancellationToken ct);

    void Stop();

    /// <summary>Aborts the agent's current turn but keeps the session.</summary>
    void AbortTurn();

    /// <summary>Lets go of the handed-over run and returns its measured token usage, or null when none was measured.</summary>
    Task<PilotUsage?> EndRunAsync(CancellationToken ct);

    // The event stream's hooks; each ignores any run but the one handed over.
    void OnRunFinished(string runId, string outcome);

    /// <summary>Stops the run in flight: aborts the turn, tells the agent why, and cancels the run.</summary>
    Task StopRunAsync(string runId, CancellationToken ct);

    /// <summary>Types the user's words into the run in flight, without stopping it.</summary>
    Task SteerRunAsync(string runId, string text, CancellationToken ct);
}

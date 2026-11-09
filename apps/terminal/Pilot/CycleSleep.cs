using JobPilot.Terminal.Pilot.Api;

namespace JobPilot.Terminal.Pilot;

/// <summary>How long the loop sleeps between cycles.</summary>
internal static class CycleSleep
{
    public const int MinSeconds = 15;
    public const int MaxSeconds = 21600;

    public static int Clamp(int seconds) => Math.Clamp(seconds, MinSeconds, MaxSeconds);

    /// <summary>The rest of the last inter-cycle break, so a host restart does not skip it.</summary>
    public static TimeSpan RemainingSleep(PilotActivity? activity, DateTimeOffset now)
    {
        if (activity?.LastCycle is not { } last)
        {
            return TimeSpan.Zero;
        }

        var planned = TimeSpan.FromSeconds(Clamp(last.SleepSeconds ?? MinSeconds));
        var remaining = planned - (now - last.CompletedAt);
        if (remaining <= TimeSpan.Zero)
        {
            return TimeSpan.Zero;
        }

        return remaining > planned ? planned : remaining;
    }
}

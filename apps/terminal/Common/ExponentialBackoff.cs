namespace JobPilot.Terminal.Common;

/// <summary>
/// Retry delay that doubles from the initial span up to the cap and holds there, until
/// <see cref="Reset"/> after a success. A struct so callers keep it as a plain field.
/// </summary>
/// <param name="initial">Delay returned by the first <see cref="Next"/> after a reset.</param>
/// <param name="max">Ceiling the doubling clamps to.</param>
internal struct ExponentialBackoff(TimeSpan initial, TimeSpan max)
{
    private int failures;

    public TimeSpan Next()
    {
        var seconds = Math.Min(initial.TotalSeconds * Math.Pow(2, failures), max.TotalSeconds);
        failures++;
        return TimeSpan.FromSeconds(seconds);
    }

    public void Reset() => failures = 0;
}

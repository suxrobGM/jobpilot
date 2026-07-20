namespace JobPilot.Terminal.Common;

internal static class Cancellation
{
    /// <summary>The caller's own shutdown, which best-effort calls must propagate rather than swallow.</summary>
    public static bool IsCallerCancellation(Exception ex, CancellationToken ct) =>
        ex is OperationCanceledException && ct.IsCancellationRequested;
}

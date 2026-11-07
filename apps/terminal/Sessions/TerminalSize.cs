namespace JobPilot.Terminal.Sessions;

/// <summary>Terminal sizes the host accepts from a browser.</summary>
public static class TerminalSize
{
    public const int MinSize = 1;
    public const int MaxSize = 2000;

    public static bool IsValid(int cols, int rows) =>
        cols is >= MinSize and <= MaxSize && rows is >= MinSize and <= MaxSize;
}

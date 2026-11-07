namespace JobPilot.Terminal.Sessions;

/// <summary>A browser control message on <c>/ws</c>: <c>input</c> (base64 bytes) or <c>resize</c>.</summary>
public sealed record BrowserMessage(string? Type, string? Data, int? Cols, int? Rows)
{
    /// <summary>
    /// xterm sends ESC[I / ESC[O on its own whenever the page loads or the terminal gains or loses
    /// focus; counting those as typing held the pilot on every navigation.
    /// </summary>
    internal static bool IsFocusReport(ReadOnlySpan<byte> bytes)
    {
        if (bytes.IsEmpty || bytes.Length % 3 != 0)
        {
            return false;
        }

        for (var i = 0; i < bytes.Length; i += 3)
        {
            if (bytes[i] != 0x1b || bytes[i + 1] != (byte)'[' || bytes[i + 2] is not ((byte)'I' or (byte)'O'))
            {
                return false;
            }
        }

        return true;
    }
}

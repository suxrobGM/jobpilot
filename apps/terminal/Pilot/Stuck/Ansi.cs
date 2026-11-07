using System.Text;

namespace JobPilot.Terminal.Pilot.Stuck;

internal static class Ansi
{
    /// <summary>Removes CSI, OSC, and two-char escapes. An escape cut off at the end is dropped whole.</summary>
    public static string Strip(ReadOnlySpan<char> input)
    {
        var output = new StringBuilder(input.Length);
        for (var i = 0; i < input.Length; i++)
        {
            if (input[i] == '\x1b')
            {
                i = SkipEscape(input, i);
                continue;
            }

            output.Append(input[i]);
        }

        return output.ToString();
    }

    /// <summary>Returns the last index consumed by the escape sequence starting at <paramref name="i"/>.</summary>
    private static int SkipEscape(ReadOnlySpan<char> s, int i)
    {
        if (i + 1 >= s.Length)
        {
            return s.Length;
        }

        var next = s[i + 1];
        if (next == '[')
        {
            var j = i + 2;
            while (j < s.Length && s[j] is < '@' or > '~')
            {
                j++;
            }
            return Math.Min(j, s.Length - 1);
        }

        if (next == ']')
        {
            var j = i + 2;
            while (j < s.Length && s[j] != '\a')
            {
                if (s[j] == '\x1b' && j + 1 < s.Length && s[j + 1] == '\\')
                {
                    return j + 1;
                }
                j++;
            }
            return Math.Min(j, s.Length - 1);
        }

        return i + 1;
    }
}

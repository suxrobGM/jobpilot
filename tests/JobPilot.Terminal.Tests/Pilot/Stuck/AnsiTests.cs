using JobPilot.Terminal.Pilot.Stuck;
using Xunit;

namespace JobPilot.Terminal.Tests.Pilot.Stuck;

public class AnsiTests
{
    [Theory]
    [InlineData("\x1b[1;31mred\x1b[0m", "red")]
    [InlineData("\x1b[>4;2mkeys\x1b[<u", "keys")]
    [InlineData("\x1b]0;title\x07text", "text")]
    [InlineData("\x1b]8;;https://x\x1b\\link", "link")]
    [InlineData("done\x1b[3", "done")]
    public void Strip_RemovesEscapeSequences(string input, string expected) =>
        Assert.Equal(expected, Ansi.Strip(input));
}

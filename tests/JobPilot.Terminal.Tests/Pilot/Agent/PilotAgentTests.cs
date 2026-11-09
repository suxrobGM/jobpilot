using JobPilot.Terminal.Pilot.Agent;
using Xunit;

namespace JobPilot.Terminal.Tests.Pilot.Agent;

public class PilotAgentTests
{
    [Theory]
    [InlineData("skip cover letters", "skip cover letters")]
    [InlineData("line one\nline two\r\n", "line one line two")]
    [InlineData("\u001b[2Jclear\u0003", "[2Jclear")]
    public void SanitizeSteer_KeepsOneLineOfPlainText(string text, string expected)
    {
        Assert.Equal(expected, PilotAgent.SanitizeSteer(text));
    }

    [Fact]
    public void SanitizeSteer_CapsTheLength()
    {
        Assert.Equal(1000, PilotAgent.SanitizeSteer(new string('a', 5000)).Length);
    }
}

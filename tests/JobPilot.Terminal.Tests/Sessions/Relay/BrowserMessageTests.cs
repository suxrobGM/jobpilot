using System.Text;
using JobPilot.Terminal.Sessions.Relay;
using Xunit;

namespace JobPilot.Terminal.Tests.Sessions.Relay;

/// <summary>xterm's own focus reports must not count as typing, or every page load holds the pilot.</summary>
public sealed class BrowserMessageTests
{
    [Theory]
    [InlineData("\u001b[O")]
    [InlineData("\u001b[I")]
    [InlineData("\u001b[O\u001b[O")]
    public void FocusReportsAreNotTyping(string input) =>
        Assert.True(BrowserMessage.IsFocusReport(Encoding.ASCII.GetBytes(input)));

    [Theory]
    [InlineData("a")]
    [InlineData("\r")]
    [InlineData("\u001b[A")]
    [InlineData("\u001b[Ox")]
    public void KeystrokesAreTyping(string input) =>
        Assert.False(BrowserMessage.IsFocusReport(Encoding.ASCII.GetBytes(input)));
}

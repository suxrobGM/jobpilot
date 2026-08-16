using JobPilot.Terminal.Hosting;
using Xunit;

namespace JobPilot.Terminal.Tests;

public sealed class HostCliTests
{
    [Theory]
    [InlineData("--version")]
    [InlineData("--VERSION")]
    public void TryRunCommand_PrintsTheHostVersion(string flag)
    {
        using var output = new StringWriter();
        var unregistered = false;

        var handled = HostCli.TryRunCommand([flag], output, () => unregistered = true);

        Assert.True(handled);
        Assert.False(unregistered);
        Assert.Equal($"jobpilot {HostInstall.HostVersion}{Environment.NewLine}", output.ToString());
    }

    [Fact]
    public void TryRunCommand_UnregistersTheProtocol()
    {
        using var output = new StringWriter();
        var unregistered = false;

        var handled = HostCli.TryRunCommand(["--unregister"], output, () => unregistered = true);

        Assert.True(handled);
        Assert.True(unregistered);
        Assert.Equal($"JobPilot: removed the jobpilot:// URL scheme.{Environment.NewLine}", output.ToString());
    }

    [Fact]
    public void TryRunCommand_IgnoresServerArguments()
    {
        using var output = new StringWriter();
        var unregistered = false;

        var handled = HostCli.TryRunCommand(
            ["--urls", "http://localhost:0"],
            output,
            () => unregistered = true);

        Assert.False(handled);
        Assert.False(unregistered);
        Assert.Equal(string.Empty, output.ToString());
    }
}

using JobPilot.Terminal.Common;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class ExecutablePathTests
{
    [Fact]
    public void Find_ResolvesAgainstTheSuppliedPath_NotTheProcessEnvironment()
    {
        using var temp = new TempDir();
        var tool = temp.File("mytool.cmd", "@echo off");

        // PATHEXT supplies the extension's casing, which Windows treats as the same file.
        Assert.Equal(tool, ExecutablePath.Find("mytool", temp.Root, ".COM;.EXE;.BAT;.CMD"), StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void Find_ReturnsNull_WhenNoDirectoryOnThePathHasTheCommand()
    {
        using var temp = new TempDir();

        Assert.Null(ExecutablePath.Find("mytool", temp.Root, ".COM;.EXE;.BAT;.CMD"));
    }

    [Fact]
    public void Find_PrefersARealExecutableOverAShim()
    {
        using var temp = new TempDir();
        temp.File("mytool.cmd", "@echo off");
        var exe = temp.File("mytool.exe", "MZ");

        // Only the .exe spawns without an interpreter, so it wins even when both are present.
        Assert.Equal(exe, ExecutablePath.Find("mytool", temp.Root, ".COM;.EXE;.BAT;.CMD"), StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void Find_FallsBackToWindowsDefaultExtensions_WhenPathExtIsMissing()
    {
        using var temp = new TempDir();
        var tool = temp.File("mytool.cmd", "@echo off");

        Assert.Equal(tool, ExecutablePath.Find("mytool", temp.Root, null), StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void Find_SearchesEveryPathEntry_AndIgnoresQuotesAndBlanks()
    {
        using var temp = new TempDir();
        var second = Path.Combine(temp.Root, "second");
        Directory.CreateDirectory(second);
        var tool = temp.File(Path.Combine("second", "mytool.exe"), "MZ");

        var path = $"\"{Path.Combine(temp.Root, "missing")}\";;{second}";

        Assert.Equal(tool, ExecutablePath.Find("mytool", path, ".COM;.EXE"), StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void Find_AcceptsARootedCommand_WithoutSearchingThePath()
    {
        using var temp = new TempDir();
        var tool = temp.File("mytool.exe", "MZ");

        Assert.Equal(tool, ExecutablePath.Find(tool, null, null));
        Assert.Null(ExecutablePath.Find(Path.Combine(temp.Root, "absent.exe"), null, null));
    }

    [Theory]
    [InlineData("C:\\tools\\npx.cmd", true)]
    [InlineData("C:\\tools\\npx.BAT", true)]
    [InlineData("C:\\tools\\node.exe", false)]
    public void NeedsShell_IsTrueOnlyForWindowsShims(string path, bool expected)
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        Assert.Equal(expected, ExecutablePath.NeedsShell(path));
    }
}

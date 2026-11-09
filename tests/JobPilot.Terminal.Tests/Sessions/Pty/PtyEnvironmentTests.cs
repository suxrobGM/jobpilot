using JobPilot.Terminal.Sessions.Pty;
using Xunit;

namespace JobPilot.Terminal.Tests.Sessions.Pty;

/// <summary>
/// A protocol-activated host can inherit a stripped PATH; the PTY child must still see System32,
/// PowerShell, and the registry PATH, or every in-session command 127s.
/// </summary>
public sealed class PtyEnvironmentTests
{
    [Fact]
    public void MergesInheritedThenRegistryPathsWithoutDuplicates()
    {
        var overrides = PtyEnvironment.BuildWindowsOverrides(
            inheritedPath: @"C:\Users\u\.local\bin;C:\Tools",
            machinePath: @"C:\Windows\System32;C:\Windows;C:\Program Files\Git\cmd",
            userPath: @"C:\Tools;C:\Users\u\AppData\Local\Programs",
            systemRoot: @"C:\Windows",
            comSpec: @"C:\Windows\System32\cmd.exe",
            pathExt: ".COM;.EXE");

        var path = overrides["PATH"].Split(';');
        Assert.Equal(@"C:\Users\u\.local\bin", path[0]);
        Assert.Equal(@"C:\Tools", path[1]);
        Assert.Contains(@"C:\Program Files\Git\cmd", path);
        Assert.Contains(@"C:\Users\u\AppData\Local\Programs", path);
        Assert.Single(path, p => string.Equals(p, @"C:\Tools", StringComparison.OrdinalIgnoreCase));
        Assert.Single(path, p => string.Equals(p, @"C:\Windows\System32", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void GuaranteesSystemDirectoriesWhenRegistryIsUnreadable()
    {
        var overrides = PtyEnvironment.BuildWindowsOverrides(
            inheritedPath: @"C:\Users\u\.local\bin",
            machinePath: null,
            userPath: null,
            systemRoot: @"C:\Windows",
            comSpec: null,
            pathExt: null);

        var path = overrides["PATH"].Split(';');
        Assert.Contains(@"C:\Windows\System32", path);
        Assert.Contains(@"C:\Windows\System32\WindowsPowerShell\v1.0", path);
        Assert.Equal(@"C:\Windows\System32\cmd.exe", overrides["ComSpec"]);
        Assert.Contains(".CMD", overrides["PATHEXT"]);
    }

    [Fact]
    public void DedupesTrailingSlashVariantsAndBlankEntries()
    {
        var overrides = PtyEnvironment.BuildWindowsOverrides(
            inheritedPath: @"C:\Windows\System32\;;  ",
            machinePath: @"C:\Windows\System32",
            userPath: null,
            systemRoot: @"C:\Windows",
            comSpec: @"cmd",
            pathExt: ".EXE");

        var path = overrides["PATH"].Split(';');
        Assert.Single(path, p => p.TrimEnd('\\').Equals(@"C:\Windows\System32", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(path, p => p.Trim().Length == 0);
    }

    [Fact]
    public void FallsBackToDefaultSystemRootWhenAbsent()
    {
        var overrides = PtyEnvironment.BuildWindowsOverrides(
            inheritedPath: null,
            machinePath: null,
            userPath: null,
            systemRoot: null,
            comSpec: null,
            pathExt: null);

        Assert.Equal(@"C:\Windows", overrides["SystemRoot"]);
        Assert.Contains(@"C:\Windows\System32", overrides["PATH"].Split(';'));
    }
}

namespace JobPilot.Terminal.Tests;

/// <summary>Disposable test directory.</summary>
internal sealed class TempDir : IDisposable
{
    public TempDir()
    {
        Root = Path.Combine(Path.GetTempPath(), "jobpilot-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Root);
    }

    public string Root { get; }

    public string File(string relativePath, string content = "{}")
    {
        var full = Path.Combine(Root, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        System.IO.File.WriteAllText(full, content);
        return full;
    }

    public void WriteValidPluginTree()
    {
        File(Path.Combine("plugin", "skills", "_shared", "setup.md"), "# setup");
        File(Path.Combine("plugin", "skills", "auto-apply", "SKILL.md"), "# auto-apply");
        File(Path.Combine("plugin", ".mcp.json"), """{"mcpServers":{}}""");
        File(Path.Combine("plugin", ".claude-plugin", "plugin.json"));
        File(Path.Combine("plugin", ".codex-plugin", "plugin.json"));
    }

    public void Dispose()
    {
        try
        {
            Directory.Delete(Root, recursive: true);
        }
        catch (IOException)
        {
            // Best-effort test cleanup.
        }
    }
}

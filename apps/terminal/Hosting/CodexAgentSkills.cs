using JobPilot.Terminal.Common;

namespace JobPilot.Terminal.Hosting;

/// <summary>
/// Rebuilds the workspace .agents/skills folder, which Codex discovers, from the bundled skills. The
/// workspace is the JobPilot install root, so the folder is wholly ours to replace.
/// </summary>
internal static class CodexAgentSkills
{
    private const string BootstrapSkill = "setup";

    public static void Refresh(string sourceDir, string workingDir)
    {
        var targetDir = Path.Combine(workingDir, ".agents", "skills");
        FileTree.DeleteIfExists(targetDir);
        Directory.CreateDirectory(targetDir);

        foreach (var entry in Directory.EnumerateFileSystemEntries(sourceDir))
        {
            var name = Path.GetFileName(entry);
            if (name == BootstrapSkill)
            {
                continue;
            }

            var target = Path.Combine(targetDir, name);
            if (Directory.Exists(entry))
            {
                FileTree.Copy(entry, target);
            }
            else
            {
                File.Copy(entry, target);
            }
        }
    }
}

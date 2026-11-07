using JobPilot.Terminal.Common;
using JobPilot.Terminal.Install;

namespace JobPilot.Terminal.Providers.Codex;

internal sealed class CodexProvider : Provider
{
    private const string SkillPrefix = "$";

    // The marketplace plugin owns the setup bootstrap, so the workspace copy leaves it out.
    private const string BootstrapSkill = "setup";

    public override string Id => "codex";

    public override string DisplayName => "Codex";

    public override string Executable => "codex";

    // The PTY already sets the cwd; repeating it through -C makes Windows paths cross a second argument parser.
    public override string[] BuildArgs(string pluginDir, ILogger logger) =>
        ["--no-alt-screen", "--approve-for-me", .. CodexConfig.Overrides(pluginDir, logger, ExecutablePath.Find).SelectMany(o => new[] { "-c", o })];

    /// <summary>Codex discovers skills from .agents/skills and agents from .codex/agents, both wholly ours to rebuild.</summary>
    public override void PrepareWorkspace(InstallPaths paths)
    {
        var target = Path.Combine(paths.WorkingDir, ".agents", "skills");
        FileTree.DeleteIfExists(target);
        FileTree.Copy(paths.SkillsDir, target);
        FileTree.DeleteIfExists(Path.Combine(target, BootstrapSkill));

        var agents = Path.Combine(paths.WorkingDir, ".codex", "agents");
        FileTree.DeleteIfExists(agents);
        Directory.CreateDirectory(agents);
        foreach (var source in Directory.EnumerateFiles(Path.Combine(paths.PluginDir, "agents"), "*.md"))
        {
            if (CodexAgentToml.From(File.ReadAllText(source)) is { } toml)
            {
                File.WriteAllText(Path.Combine(agents, Path.GetFileNameWithoutExtension(source) + ".toml"), toml);
            }
        }
    }

    public override string SkillCommand(string skill) => SkillPrefix + skill;

    // The first Enter only accepts the selected $skill autocomplete item.
    public override int SubmitKeyPresses(string command) =>
        command.StartsWith(SkillPrefix, StringComparison.Ordinal) ? 2 : 1;
}

namespace JobPilot.Terminal.Common;

internal static class FileTree
{
    /// <summary>Copies every file under <paramref name="sourceDir"/> onto <paramref name="targetDir"/>, overwriting.</summary>
    public static void Copy(string sourceDir, string targetDir)
    {
        foreach (var file in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
        {
            var target = Path.Combine(targetDir, Path.GetRelativePath(sourceDir, file));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, overwrite: true);
        }
    }

    public static void DeleteIfExists(string dir)
    {
        if (Directory.Exists(dir))
        {
            Directory.Delete(dir, recursive: true);
        }
    }
}

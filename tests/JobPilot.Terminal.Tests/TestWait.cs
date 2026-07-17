using Xunit;

namespace JobPilot.Terminal.Tests;

internal static class TestWait
{
    /// <summary>Polls for up to ~2s; fails the test if the condition never holds.</summary>
    public static async Task Until(Func<bool> condition)
    {
        for (var i = 0; i < 200 && !condition(); i++)
        {
            await Task.Delay(10);
        }
        Assert.True(condition(), "condition was not met within the timeout");
    }
}

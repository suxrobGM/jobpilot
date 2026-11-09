using JobPilot.Terminal.Common;
using Xunit;

namespace JobPilot.Terminal.Tests.Common;

public class ExponentialBackoffTests
{
    [Fact]
    public void Next_DoublesUpToTheCap_AndResetStartsOver()
    {
        var backoff = new ExponentialBackoff(TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(30));

        Assert.Equal([5, 10, 20, 30, 30], Enumerable.Range(0, 5).Select(_ => backoff.Next().TotalSeconds));

        backoff.Reset();
        Assert.Equal(TimeSpan.FromSeconds(5), backoff.Next());
    }
}

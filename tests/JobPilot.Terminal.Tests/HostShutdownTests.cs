using JobPilot.Terminal.Hosting;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace JobPilot.Terminal.Tests;

public class HostShutdownTests
{
    [Fact]
    public async Task BeginShutdown_StopsTheApplication_AfterTheResponseFlushDelay()
    {
        var lifetime = new FakeLifetime();

        HostShutdown.BeginShutdown(lifetime);

        // The stop is deferred behind a short flush delay; it must land shortly after, not synchronously.
        Assert.False(lifetime.Stopped);
        await TestWait.Until(() => lifetime.Stopped);
    }

    private sealed class FakeLifetime : IHostApplicationLifetime
    {
        private readonly CancellationTokenSource stopping = new();

        public bool Stopped { get; private set; }

        public CancellationToken ApplicationStarted => CancellationToken.None;

        public CancellationToken ApplicationStopping => stopping.Token;

        public CancellationToken ApplicationStopped => CancellationToken.None;

        public void StopApplication()
        {
            Stopped = true;
            stopping.Cancel();
        }
    }
}

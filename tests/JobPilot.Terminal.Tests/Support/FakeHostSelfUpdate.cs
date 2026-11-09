using JobPilot.Terminal.Install.Updates;

namespace JobPilot.Terminal.Tests.Support;

internal sealed class FakeHostSelfUpdate : IHostSelfUpdate
{
    public int Starts { get; private set; }

    public void Start() => Starts++;
}

using JobPilot.Terminal.Endpoints;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Plugins;
using Microsoft.Extensions.Logging.Abstractions;

// Pty.Net's macOS forkpty path requires CoreCLR's W^X remapping to be off; harmless under NativeAOT.
if (OperatingSystem.IsMacOS())
{
    Environment.SetEnvironmentVariable("DOTNET_EnableWriteXorExecute", "0");
}

// `jobpilot --unregister` clears the jobpilot:// scheme (for uninstall) and exits without starting the host.
if (args.Any(a => a.Equals("--unregister", StringComparison.OrdinalIgnoreCase)))
{
    ProtocolRegistrar.Unregister(NullLogger.Instance);
    Console.WriteLine("JobPilot: removed the jobpilot:// URL scheme.");
    return;
}

// If the browser launched us via the jobpilot:// scheme, drop the flashed console and strip the scheme arg.
var hostArgs = ProtocolRegistrar.ResolveHostArgs(args);

// Content root = exe dir, not launch CWD, so appsettings.json (pins :4102) loads regardless of where we start.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = hostArgs,
    ContentRootPath = AppContext.BaseDirectory,
});

builder.Services.AddTerminalHost();

var app = builder.Build();
var loggerFactory = app.Services.GetRequiredService<ILoggerFactory>();

// Register the jobpilot:// scheme so the dashboard can relaunch us from the browser when offline.
ProtocolRegistrar.EnsureRegistered(loggerFactory.CreateLogger("Protocol"));

// Auto-update host + plugin before binding. If the host self-updated it relaunched into the new build,
// so exit and let that process bind the port.
if (await StartupUpdater.RunAsync(loggerFactory.CreateLogger("Updater")))
{
    return;
}

app.UseTerminalPipeline();
app.MapTerminalEndpoints();
app.RunWithPortDiagnostics();

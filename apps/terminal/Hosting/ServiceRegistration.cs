using System.Diagnostics.CodeAnalysis;
using JobPilot.Terminal.Install.Updates;
using JobPilot.Terminal.Install;
using JobPilot.Terminal.Pilot.Agent;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Pilot.Telemetry;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Sessions.Relay;
using JobPilot.Terminal.Sessions;

namespace JobPilot.Terminal.Hosting;

public static class ServiceRegistration
{
    public static IServiceCollection AddTerminalHost(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddCors(options => options.AddPolicy(
            OriginPolicy.CorsPolicy,
            policy => policy.WithOrigins(OriginPolicy.Resolve(configuration)).AllowAnyHeader().AllowAnyMethod()));

        // One long-lived client for every outbound call. Callers bound their own requests; the pooled lifetime
        // lets a host that runs for weeks follow DNS changes.
        services.AddSingleton(_ => new HttpClient(new SocketsHttpHandler { PooledConnectionLifetime = TimeSpan.FromMinutes(15) })
        {
            Timeout = Timeout.InfiniteTimeSpan,
        });

        services.AddSingleton<HostInstall>();
        services.AddSingleton<HostStatus>();
        services.AddSingleton<UrlScheme>();

        services.AddHostedSingleton<ScratchCleaner>();
        services.AddSingleton<TerminalSession>();
        services.AddSingleton<TerminalRelay>();

        services.AddSingleton<PairingStore>();
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IPilotApi, PilotApi>();
        services.AddSingleton<UsageMeter>();
        services.AddHostedSingleton<StepRecorder>();
        services.AddSingleton<IPilotAgent, PilotAgent>();
        services.AddSingleton<WakeSignal>();
        services.AddHostedSingleton<PilotLoop>();
        services.AddHostedService<PilotEventListener>();

        services.AddSingleton<GitHubReleases>();
        services.AddSingleton<ReleaseInstaller>();
        services.AddSingleton<HostUpdater>();

        services.ConfigureHttpJsonOptions(c => c.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));

        // Production otherwise answers a binding failure with an empty 400, and the web expects ProblemDetails.
        services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);

        // Must stay below HostRelaunch.MaxWait, or an update's relaunched host times out and fails to bind.
        services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromSeconds(5));

        return services;
    }

    /// <summary>A hosted service other services also inject, so both resolve the same instance.</summary>
    private static void AddHostedSingleton<[DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)] T>(
        this IServiceCollection services)
        where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService(sp => sp.GetRequiredService<T>());
    }
}

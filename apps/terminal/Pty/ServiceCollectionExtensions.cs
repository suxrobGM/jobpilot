namespace JobPilot.Terminal.Pty;

/// <summary>
/// Registers terminal infrastructure services with the application dependency container.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds PTY services required by the terminal host.
    /// </summary>
    /// <param name="services">Service collection to configure.</param>
    /// <returns>The same service collection for chaining.</returns>
    public static IServiceCollection AddTerminal(this IServiceCollection services)
    {
        services.AddSingleton<PtyService>();
        return services;
    }
}

using System.Text.Json.Serialization;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Providers;
using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Updates;
using Microsoft.AspNetCore.Mvc;

namespace JobPilot.Terminal;

/// <summary>
/// Native AOT JSON metadata. JIT reflection can hide missing registrations, so every directly serialized
/// type must appear here; the camel-case policy also defines the WebSocket and ProblemDetails wire format.
/// </summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(StartSessionRequest))]
[JsonSerializable(typeof(CodexSettingsFile))]
[JsonSerializable(typeof(PluginMcpFile))]
[JsonSerializable(typeof(string))]
[JsonSerializable(typeof(PilotPairRequest))]
[JsonSerializable(typeof(BrowserMessage))]
[JsonSerializable(typeof(StatusResponse))]
[JsonSerializable(typeof(PilotSettingsFile))]
[JsonSerializable(typeof(JournalRequest))]
[JsonSerializable(typeof(PilotActivity))]
[JsonSerializable(typeof(PilotTaskList))]
[JsonSerializable(typeof(PilotUsage))]
[JsonSerializable(typeof(PostStepsRequest))]
[JsonSerializable(typeof(PilotRun))]
[JsonSerializable(typeof(StartRunRequest))]
[JsonSerializable(typeof(IdleCycleRequest))]
[JsonSerializable(typeof(PilotEvent))]
[JsonSerializable(typeof(UpdateResult))]
[JsonSerializable(typeof(ShutdownResult))]
[JsonSerializable(typeof(ProblemDetails))]
[JsonSerializable(typeof(GitHubRelease[]))]
internal sealed partial class AppJsonContext : JsonSerializerContext;

using System.Text.Json.Serialization;
using JobPilot.Terminal.Install.Updates;
using JobPilot.Terminal.Pilot;
using JobPilot.Terminal.Pilot.Api;
using JobPilot.Terminal.Pilot.Pairing;
using JobPilot.Terminal.Providers.Codex;
using JobPilot.Terminal.Sessions;
using JobPilot.Terminal.Sessions.Relay;
using Microsoft.AspNetCore.Mvc;

namespace JobPilot.Terminal.Hosting;

/// <summary>
/// Native AOT JSON metadata. JIT reflection can hide missing registrations, so every directly serialized
/// type must appear here; the camel-case policy also defines the WebSocket and ProblemDetails wire format.
/// </summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(StartSessionRequest))]
[JsonSerializable(typeof(CodexSettingsFile))]
[JsonSerializable(typeof(PluginMcpFile))]
[JsonSerializable(typeof(string))]
[JsonSerializable(typeof(PairingRequest))]
[JsonSerializable(typeof(BrowserMessage))]
[JsonSerializable(typeof(StatusResponse))]
[JsonSerializable(typeof(PairingFile))]
[JsonSerializable(typeof(PilotActivity))]
[JsonSerializable(typeof(PilotTaskList))]
[JsonSerializable(typeof(PilotUsage))]
[JsonSerializable(typeof(PostStepsRequest))]
[JsonSerializable(typeof(PilotRun))]
[JsonSerializable(typeof(StartRunRequest))]
[JsonSerializable(typeof(CycleRequest))]
[JsonSerializable(typeof(PilotEvent))]
[JsonSerializable(typeof(UpdateResult))]
[JsonSerializable(typeof(ShutdownResult))]
[JsonSerializable(typeof(ProblemDetails))]
[JsonSerializable(typeof(GitHubRelease[]))]
internal sealed partial class AppJsonContext : JsonSerializerContext;

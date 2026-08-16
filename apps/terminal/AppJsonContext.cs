using System.Text.Json.Serialization;
using JobPilot.Terminal.Contracts;
using JobPilot.Terminal.Hosting;
using JobPilot.Terminal.Pilot;
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
[JsonSerializable(typeof(InjectRequest))]
[JsonSerializable(typeof(PilotStartRequest))]
[JsonSerializable(typeof(TerminalClientMessage))]
[JsonSerializable(typeof(SessionStatus))]
[JsonSerializable(typeof(PilotStatus))]
[JsonSerializable(typeof(PilotStateFile))]
[JsonSerializable(typeof(PilotJournalRequest))]
[JsonSerializable(typeof(PilotActivityResponse))]
[JsonSerializable(typeof(PilotLastCycleResponse))]
[JsonSerializable(typeof(PilotSseEnvelope))]
[JsonSerializable(typeof(UpdateResult))]
[JsonSerializable(typeof(ShutdownResult))]
[JsonSerializable(typeof(TerminalProviderInfo[]))]
[JsonSerializable(typeof(ProblemDetails))]
[JsonSerializable(typeof(GitHubRelease[]))]
internal sealed partial class AppJsonContext : JsonSerializerContext;

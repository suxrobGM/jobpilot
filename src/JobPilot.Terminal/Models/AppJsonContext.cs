using System.Text.Json.Serialization;

namespace JobPilot.Terminal.Models;

/// <summary>
/// Source-generated JSON metadata used by the Native AOT terminal host.
/// </summary>
[JsonSerializable(typeof(StartSessionRequest))]
[JsonSerializable(typeof(InjectRequest))]
[JsonSerializable(typeof(SessionStatus))]
[JsonSerializable(typeof(TerminalProviderInfo))]
[JsonSerializable(typeof(TerminalProviderInfo[]))]
internal sealed partial class AppJsonContext : JsonSerializerContext;

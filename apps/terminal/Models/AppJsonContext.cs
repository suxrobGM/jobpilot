using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace JobPilot.Terminal.Models;

/// <summary>
/// Source-generated JSON metadata used by the Native AOT terminal host.
/// </summary>
[JsonSerializable(typeof(StartSessionRequest))]
[JsonSerializable(typeof(InjectRequest))]
[JsonSerializable(typeof(SessionStatus))]
[JsonSerializable(typeof(TerminalProviderInfo))]
[JsonSerializable(typeof(TerminalProviderInfo[]))]
// TypedResults.Problem returns this; the AOT serializer throws NotSupportedException without it.
[JsonSerializable(typeof(ProblemDetails))]
internal sealed partial class AppJsonContext : JsonSerializerContext;

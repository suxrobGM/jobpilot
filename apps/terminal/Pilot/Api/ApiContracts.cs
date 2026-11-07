namespace JobPilot.Terminal.Pilot.Api;

// The JobPilot API shapes the host sends and reads; they mirror @jobpilot/contracts.

/// <summary>GET /api/pilot/activity.</summary>
public sealed record PilotActivity(DateTimeOffset? LastActivityAt, CompletedCycle? LastCycle);

public sealed record CompletedCycle(DateTimeOffset CompletedAt, int? SleepSeconds);

/// <summary>The fields of POST /api/pilot/tasks/refresh the host reads.</summary>
public sealed record PilotTaskList(PilotTask[] Tasks, string Version, int SleepSeconds);

public sealed record PilotTask(string Id);

public sealed record PilotRun(string Id, DateTimeOffset? FinishedAt, string? Outcome);

internal sealed record StartRunRequest(string TaskId, string TaskListVersion);

internal sealed record CycleRequest(int SleepSeconds);

internal sealed record JournalRequest(JournalEntry[] Entries);

internal sealed record JournalEntry(string Kind, string Summary);

/// <summary>POST /api/pilot/runs/:id/usage: one run's token usage.</summary>
public sealed record PilotUsage(
    string Model, long InputTokens, long OutputTokens, long CacheReadTokens, long CacheWriteTokens);

/// <summary>POST /api/pilot/runs/:id/steps: one readable step.</summary>
public sealed record PilotStep(DateTimeOffset At, string Label);

internal sealed record PostStepsRequest(PilotStep[] Steps);

/// <summary>The event type is in the JSON, not the SSE event name.</summary>
internal sealed record PilotEvent(string? Type, string? RunId = null, string? Outcome = null, string? Text = null);

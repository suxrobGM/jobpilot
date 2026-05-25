using JobPilot.Terminal;
using JobPilot.Terminal.Models;
using JobPilot.Terminal.Pty;
using Microsoft.AspNetCore.Http.HttpResults;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors();
builder.Services.AddTerminal();
builder.Services.AddSingleton<SessionManager>();
builder.Services.AddSingleton<TerminalHub>();
builder.Services.ConfigureHttpJsonOptions(c =>
    c.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));

var app = builder.Build();

app.UseCors(c => c.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });

app.Lifetime.ApplicationStopping.Register(() =>
{
  var session = app.Services.GetRequiredService<SessionManager>();
  session.Stop();
});

app.MapGet("/healthz", (SessionManager session) =>
{
  var sessionState = session.State == SessionState.Running ? "running" : "stopped";
  return TypedResults.Ok(new SessionStatus("ok", sessionState, session.ActiveProvider, SessionManager.Providers));
});

app.MapPost("/sessions/start", Results<Ok<SessionStatus>, ProblemHttpResult> (StartSessionRequest request, SessionManager session) =>
{
  try
  {
    session.Start(request.Provider, request.WorkingDir, request.Cols, request.Rows);
  }
  catch (PtyStartException ex)
  {
    return TypedResults.Problem(
      title: "Failed to start terminal session",
      detail: ex.Message,
      statusCode: StatusCodes.Status500InternalServerError);
  }
  return TypedResults.Ok(new SessionStatus("ok", "running", session.ActiveProvider, SessionManager.Providers));
});

app.MapPost("/sessions/inject", Results<Ok, ProblemHttpResult> (InjectRequest request, SessionManager session) =>
{
  if (!session.Inject(request.Command, request.Provider))
  {
    return TypedResults.Problem(
      title: "Inject rejected",
      detail: "The session is not running or the active provider does not match the requested provider.",
      statusCode: StatusCodes.Status409Conflict);
  }
  return TypedResults.Ok();
});

app.MapDelete("/sessions/current", (SessionManager session) =>
{
  session.Stop();
  return TypedResults.Ok(new SessionStatus("ok", "stopped", session.ActiveProvider, SessionManager.Providers));
});

app.Map("/ws", async (HttpContext ctx, TerminalHub hub) =>
{
  if (!ctx.WebSockets.IsWebSocketRequest)
  {
    ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
    return;
  }

  using var socket = await ctx.WebSockets.AcceptWebSocketAsync();
  await hub.HandleAsync(socket, ctx.RequestAborted);
});

app.Run();

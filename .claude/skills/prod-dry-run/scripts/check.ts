// Run from apps/api so its .env loads; tsconfig.json beside it maps the imports.
import { taskFieldsSchema } from "@jobpilot/contracts/pilot";
import { db } from "@/common/database/prisma.client";
import type { PilotRun } from "@/generated/prisma/client";
import { RunListService } from "@/modules/pilot/runs/run-list.service";
import { TaskListService } from "@/modules/pilot/tasks/task-list.service";
import { PilotThreadService } from "@/modules/pilot/thread/thread.service";

const RUN_BATCH = 2000;
const THREAD_PAGES = 5;
const SHOWN_FAILURES = 15;

interface Report {
  runsParsed: number;
  usersChecked: number;
  tasksByType: Map<string, number>;
  failures: string[];
}

type StoredRun = Pick<PilotRun, "id" | "taskType" | "subjectType" | "subjectId" | "payload">;

interface Services {
  thread: PilotThreadService;
  runHistory: RunListService;
  taskLists: TaskListService;
}

async function main(): Promise<void> {
  const report: Report = {
    runsParsed: 0,
    usersChecked: 0,
    tasksByType: new Map(),
    failures: [],
  };
  try {
    await checkRunPayloads(report);
    await checkUsers(createServices(), report);
  } finally {
    await db.$disconnect();
  }
  printReport(report);
}

/** Real services, except the parts that reach outside the DB or message real users. */
function createServices(): Services {
  const doNothing = async () => {};
  return {
    thread: new PilotThreadService(db),
    runHistory: new RunListService(db),
    taskLists: new TaskListService(
      db,
      { expireStaleWork: doNothing, settleScoredJobs: doNothing } as never,
      { writeIfDue: doNothing } as never,
      { syncIfStale: doNothing } as never,
    ),
  };
}

/** The thread parses every stored run, so one stale payload breaks it for that user. */
async function checkRunPayloads(report: Report): Promise<void> {
  let lastId: string | null = null;
  while (true) {
    const runs: StoredRun[] = await db.pilotRun.findMany({
      select: { id: true, taskType: true, subjectType: true, subjectId: true, payload: true },
      where: lastId ? { id: { gt: lastId } } : {},
      orderBy: { id: "asc" },
      take: RUN_BATCH,
    });
    if (runs.length === 0) {
      return;
    }
    for (const run of runs) {
      const parsed = taskFieldsSchema.safeParse(run);
      if (!parsed.success) {
        const reason = parsed.error.issues[0]?.message;
        report.failures.push(`run ${run.id} (${run.taskType}): ${reason}`);
      }
    }
    report.runsParsed += runs.length;
    lastId = runs[runs.length - 1].id;
  }
}

async function checkUsers(services: Services, report: Report): Promise<void> {
  const users = await db.user.findMany({ select: { id: true } });
  for (const user of users) {
    await attempt(report, `thread ${user.id}`, () => loadThread(services, user.id));
    await attempt(report, `run history ${user.id}`, () =>
      services.runHistory.list(user.id, { page: 1, limit: 20 }),
    );
    await attempt(report, `task list ${user.id}`, () => buildTaskList(services, user.id, report));
    report.usersChecked += 1;
  }
}

async function loadThread(services: Services, userId: string): Promise<void> {
  let cursor: string | null = null;
  for (let page = 0; page < THREAD_PAGES; page++) {
    const { nextCursor } = await services.thread.getPage(userId, cursor ?? undefined, 30);
    if (!nextCursor) {
      return;
    }
    cursor = nextCursor;
  }
}

async function buildTaskList(services: Services, userId: string, report: Report): Promise<void> {
  const list = await services.taskLists.refresh(userId);
  for (const task of list.tasks) {
    report.tasksByType.set(task.taskType, (report.tasksByType.get(task.taskType) ?? 0) + 1);
  }
  await services.taskLists.getCurrent(userId);
}

/** Records a failure instead of stopping, so one broken user doesn't hide the rest. */
async function attempt(report: Report, label: string, work: () => Promise<unknown>) {
  try {
    await work();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.failures.push(`${label}: ${message}`);
  }
}

function printReport(report: Report): void {
  console.log(`Runs parsed: ${report.runsParsed}`);
  console.log(`Users checked: ${report.usersChecked}`);
  console.log("Tasks built:", Object.fromEntries(report.tasksByType));
  console.log(`Failures: ${report.failures.length}`);
  for (const failure of report.failures.slice(0, SHOWN_FAILURES)) {
    console.log(`  ${failure}`);
  }
}

await main();

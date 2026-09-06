import { db } from "@/common/database/prisma.client";
import { seedJobBoards } from "./job-boards";
import { seedJobListings } from "./job-listings";
import { seedSuperAdmin } from "./super-admin";

interface Seeder {
  fn: () => Promise<void>;
  description: string;
  /** Skipped by a bare `db:seed`; must be named with --only. For backfills that would replay. */
  optIn: boolean;
}

// Insertion order is run order.
const seeders = {
  "job-boards": {
    fn: seedJobBoards,
    description: "Seed the global job-board catalog",
    optIn: false,
  },
  "super-admin": {
    fn: seedSuperAdmin,
    description: "Reconcile SUPER_ADMIN_EMAIL against the DB",
    optIn: false,
  },
  "job-listings": {
    fn: seedJobListings,
    description: "Backfill the public job index from existing jobs",
    optIn: true,
  },
} as const satisfies Record<string, Seeder>;

type SeederName = keyof typeof seeders;

function printHelp(): void {
  console.log("\n🌱 Database seed\n");
  console.log("Usage: bun run db:seed [options]\n");
  console.log("Options:");
  console.log("  --help, -h        Show this message");
  console.log("  --list            List the available seeders");
  console.log("  --only <names>    Run only these seeders (comma-separated)\n");
  console.log("Examples:");
  console.log("  bun run db:seed");
  console.log("  bun run db:seed --only super-admin");
  console.log("  bun run db:seed --only job-boards,user-boards");
  console.log("  bun run db:seed --only job-listings\n");
}

function listSeeders(): void {
  console.log("\n📋 Available seeders:\n");
  for (const [name, seeder] of Object.entries(seeders)) {
    console.log(`  ${name.padEnd(16)} - ${seeder.description}${seeder.optIn ? " (--only)" : ""}`);
  }
  console.log();
}

/** A bare `db:seed` runs the seeders that are safe to replay on every setup. */
function defaultSeeders(): SeederName[] {
  return (Object.keys(seeders) as SeederName[]).filter((name) => !seeders[name].optIn);
}

function parseArgs(): SeederName[] | "all" | "help" | "list" {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    return "help";
  }
  if (args.includes("--list")) {
    return "list";
  }

  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex === -1 ? undefined : args[onlyIndex + 1];
  if (!only) {
    return "all";
  }

  const selected: SeederName[] = [];
  for (const name of only.split(",").map((part) => part.trim())) {
    if (!(name in seeders)) {
      console.error(`❌ Unknown seeder: "${name}". Use --list to see the available ones.`);
      process.exit(1);
    }
    selected.push(name as SeederName);
  }
  return selected;
}

async function main(): Promise<void> {
  const selected = parseArgs();
  if (selected === "help") {
    printHelp();
    return;
  }
  if (selected === "list") {
    listSeeders();
    return;
  }

  const names = selected === "all" ? defaultSeeders() : selected;
  console.log("\n🌱 Starting database seed...");
  for (const name of names) {
    console.log(`\n📦 Running seeder: ${name}`);
    await seeders[name].fn();
  }
  console.log("\n🌱 Database seed completed.");
}

main()
  .catch((error) => {
    console.error("❌ Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

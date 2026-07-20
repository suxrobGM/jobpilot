import { describe, expect, it } from "bun:test";

const migrationUrl = new URL(
  "../../../prisma/migrations/20260720010000_clean_break_pilot_campaign/migration.sql",
  import.meta.url,
);

describe("clean-break pilot and campaign migration", () => {
  it("validates legacy JSON and enum values before the first mutation", async () => {
    const sql = await Bun.file(migrationUrl).text();
    const validationEnd = sql.indexOf("END $$;");
    expect(validationEnd).toBeGreaterThan(0);
    expect(validationEnd).toBeLessThan(sql.indexOf("CREATE TYPE"));
    for (const table of [
      "campaigns",
      "jobs",
      "pilot_leases",
      "questions",
      "pilot_journal_entries",
      "promotion_posts",
      "contacts",
      "networking_messages",
    ]) {
      expect(sql.slice(0, validationEnd)).toContain(table);
    }
    expect(sql.slice(0, validationEnd)).toContain("jsonb_typeof");
  });

  it("performs the one-way schema cutover without compatibility columns", async () => {
    const sql = await Bun.file(migrationUrl).text();
    expect(sql).toContain("UPDATE campaigns SET status = 'paused' WHERE status = 'interrupted'");
    expect(sql).toContain("CREATE TEMP TABLE campaign_id_cutover");
    expect(sql).toContain("SET campaign_id = ids.new_id");
    expect(sql).toContain("ALTER TABLE campaigns DROP COLUMN summary");
    expect(sql).toContain("DROP TABLE campaign_events");
    expect(sql).toContain("ALTER TABLE jobs ADD COLUMN updated_at");
    expect(sql).toContain("ALTER TABLE pilot_states ADD COLUMN agenda_snapshot jsonb");
    expect(sql).toContain("CREATE UNIQUE INDEX pilot_leases_active_subject_unique");
    expect(sql).toContain("WHERE released_at IS NULL");
  });
});

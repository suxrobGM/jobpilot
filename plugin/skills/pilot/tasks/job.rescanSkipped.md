# `job.rescanSkipped`

Payload `{feedId, skippedCount, jobKeys?, minScore?}`. Run the `rescan-skipped` skill's procedure
(`../../rescan-skipped/SKILL.md`) on this feed, with `--jobs <jobKeys>` when the user picked jobs
and `--min-score <minScore>` when the user named a bar.

Summary: "Rescanned 8 skipped jobs - 2 promoted to approved."

#!/usr/bin/env bash
# Returns a JSON array of previously applied jobs from all run files.
# Usage: bash scripts/applied-jobs.sh [runs_dir]
# Output: [{"url":"...","title":"...","company":"...","runId":"...","appliedAt":"..."},...]

RUNS_DIR="${1:-${CLAUDE_PLUGIN_ROOT:-.}/runs}"

if [ ! -d "$RUNS_DIR" ] || [ -z "$(ls -A "$RUNS_DIR" 2>/dev/null)" ]; then
  echo "[]"
  exit 0
fi

# Use jq if available, fall back to node, then python
if command -v jq &>/dev/null; then
  jq -s '[
    .[] | .runId as $rid |
    .jobs[]? | select(.status == "applied") |
    {url, title, company, runId: $rid, appliedAt}
  ]' "$RUNS_DIR"/*.json 2>/dev/null || echo "[]"
elif command -v node &>/dev/null; then
  node -e "
    const fs = require('fs'), path = require('path');
    const dir = process.argv[1];
    const applied = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        for (const job of (run.jobs || [])) {
          if (job.status === 'applied') {
            applied.push({ url: job.url, title: job.title, company: job.company, runId: run.runId, appliedAt: job.appliedAt });
          }
        }
      } catch(e) {}
    }
    console.log(JSON.stringify(applied));
  " "$RUNS_DIR"
elif command -v python3 &>/dev/null; then
  python3 -c "
import json, os, sys
d = sys.argv[1]
applied = []
for f in os.listdir(d):
    if not f.endswith('.json'): continue
    try:
        run = json.load(open(os.path.join(d, f)))
        for job in run.get('jobs', []):
            if job.get('status') == 'applied':
                applied.append({'url': job.get('url',''), 'title': job.get('title',''), 'company': job.get('company',''), 'runId': run.get('runId',''), 'appliedAt': job.get('appliedAt','')})
    except: pass
print(json.dumps(applied))
" "$RUNS_DIR"
else
  echo "[]"
fi

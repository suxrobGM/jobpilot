#!/usr/bin/env bash
# Updates a specific job or field in a run file without reading the full JSON.
# Usage:
#   bash scripts/update-run.sh <run-file> job <job-id> <field> <value>
#   bash scripts/update-run.sh <run-file> status <new-status>
#   bash scripts/update-run.sh <run-file> summary
#   bash scripts/update-run.sh <run-file> add-job <json-object>
#
# Examples:
#   bash scripts/update-run.sh runs/my-run.json job 3 status applied
#   bash scripts/update-run.sh runs/my-run.json job 3 appliedAt "2026-03-22T14:00:00Z"
#   bash scripts/update-run.sh runs/my-run.json job 3 failReason "CAPTCHA required"
#   bash scripts/update-run.sh runs/my-run.json job 3 retryNotes "Try direct careers page"
#   bash scripts/update-run.sh runs/my-run.json status completed
#   bash scripts/update-run.sh runs/my-run.json summary   # recalculates summary from jobs
#   bash scripts/update-run.sh runs/my-run.json add-job '{"id":1,"title":"Dev","company":"Co","status":"pending"}'

RUN_FILE="$1"
ACTION="$2"

if [ ! -f "$RUN_FILE" ]; then
  echo "Error: Run file not found: $RUN_FILE"
  exit 1
fi

if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const file = process.argv[1];
    const action = process.argv[2];
    const args = process.argv.slice(3);
    const run = JSON.parse(fs.readFileSync(file, 'utf8'));

    if (action === 'job') {
      const [jobId, field, ...valueParts] = args;
      const value = valueParts.join(' ');
      const job = run.jobs.find(j => String(j.id) === jobId);
      if (!job) { console.log('Error: Job ' + jobId + ' not found'); process.exit(1); }
      // Parse value: booleans, numbers, null
      let parsed = value;
      if (value === 'true') parsed = true;
      else if (value === 'false') parsed = false;
      else if (value === 'null') parsed = null;
      else if (!isNaN(value) && value !== '') parsed = Number(value);
      job[field] = parsed;
      run.updatedAt = new Date().toISOString();
    } else if (action === 'status') {
      run.status = args[0];
      run.updatedAt = new Date().toISOString();
      if (args[0] === 'completed') run.completedAt = new Date().toISOString();
    } else if (action === 'summary') {
      const s = { totalFound: run.jobs.length, qualified: 0, applied: 0, failed: 0, skipped: 0, remaining: 0 };
      for (const j of run.jobs) {
        if (j.status === 'applied') s.applied++;
        else if (j.status === 'failed') s.failed++;
        else if (j.status === 'skipped') s.skipped++;
        else if (j.status === 'approved' || j.status === 'applying') s.remaining++;
        if (j.status !== 'skipped' && j.status !== 'pending') s.qualified++;
      }
      run.summary = s;
      run.updatedAt = new Date().toISOString();
    } else if (action === 'add-job') {
      const job = JSON.parse(args[0]);
      run.jobs.push(job);
      run.updatedAt = new Date().toISOString();
    } else {
      console.log('Unknown action: ' + action);
      process.exit(1);
    }

    fs.writeFileSync(file, JSON.stringify(run, null, 2));
    console.log('OK');
  " "$RUN_FILE" "$ACTION" "$3" "$4" "${@:5}"
elif command -v python3 &>/dev/null; then
  python3 -c "
import json, sys
from datetime import datetime, timezone
file, action = sys.argv[1], sys.argv[2]
args = sys.argv[3:]
with open(file) as f: run = json.load(f)

if action == 'job':
    job_id, field = args[0], args[1]
    value = ' '.join(args[2:])
    job = next((j for j in run['jobs'] if str(j.get('id')) == job_id), None)
    if not job: print(f'Error: Job {job_id} not found'); sys.exit(1)
    if value == 'true': value = True
    elif value == 'false': value = False
    elif value == 'null': value = None
    else:
        try: value = int(value)
        except: pass
    job[field] = value
    run['updatedAt'] = datetime.now(timezone.utc).isoformat()
elif action == 'status':
    run['status'] = args[0]
    run['updatedAt'] = datetime.now(timezone.utc).isoformat()
    if args[0] == 'completed': run['completedAt'] = datetime.now(timezone.utc).isoformat()
elif action == 'summary':
    s = {'totalFound': len(run['jobs']), 'qualified': 0, 'applied': 0, 'failed': 0, 'skipped': 0, 'remaining': 0}
    for j in run['jobs']:
        st = j.get('status','')
        if st == 'applied': s['applied'] += 1
        elif st == 'failed': s['failed'] += 1
        elif st == 'skipped': s['skipped'] += 1
        elif st in ('approved','applying'): s['remaining'] += 1
        if st not in ('skipped','pending'): s['qualified'] += 1
    run['summary'] = s
    run['updatedAt'] = datetime.now(timezone.utc).isoformat()
elif action == 'add-job':
    run['jobs'].append(json.loads(args[0]))
    run['updatedAt'] = datetime.now(timezone.utc).isoformat()
else:
    print(f'Unknown action: {action}'); sys.exit(1)

with open(file, 'w') as f: json.dump(run, f, indent=2)
print('OK')
" "$RUN_FILE" "$ACTION" "$3" "$4" "${@:5}"
else
  echo "Error: No runtime available (need node or python3)"
  exit 1
fi

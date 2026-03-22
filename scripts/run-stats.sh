#!/usr/bin/env bash
# Aggregates stats from all autopilot run files into a compact JSON summary.
# Usage: bash scripts/run-stats.sh [runs_dir]
# Output: JSON with totals, per-board breakdown, applied/failed/skipped lists, reason summaries, and recent runs.

RUNS_DIR="${1:-${CLAUDE_PLUGIN_ROOT:-.}/runs}"

if [ ! -d "$RUNS_DIR" ] || [ -z "$(ls -A "$RUNS_DIR" 2>/dev/null)" ]; then
  echo '{"totalRuns":0,"totalJobsFound":0,"totalApplied":0,"totalFailed":0,"totalSkipped":0,"successRate":"0%","byBoard":{},"applied":[],"failed":[],"skipped":[],"failReasons":{},"skipReasons":{},"recentRuns":[]}'
  exit 0
fi

if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs'), path = require('path');
    const dir = process.argv[1];
    const runs = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try { runs.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch(e) {}
    }
    const stats = {
      totalRuns: runs.length,
      totalJobsFound: 0, totalApplied: 0, totalFailed: 0, totalSkipped: 0,
      successRate: '0%',
      byBoard: {},
      applied: [],
      failed: [],
      skipped: [],
      failReasons: {},
      skipReasons: {},
      recentRuns: []
    };
    for (const run of runs) {
      const jobs = run.jobs || [];
      stats.totalJobsFound += jobs.length;
      for (const job of jobs) {
        const board = job.board || 'unknown';
        if (!stats.byBoard[board]) stats.byBoard[board] = { found: 0, applied: 0, failed: 0, skipped: 0 };
        stats.byBoard[board].found++;
        if (job.status === 'applied') {
          stats.totalApplied++;
          stats.byBoard[board].applied++;
          stats.applied.push({ title: job.title, company: job.company, score: job.matchScore, board, appliedAt: job.appliedAt, runId: run.runId, url: job.url });
        } else if (job.status === 'failed') {
          stats.totalFailed++;
          stats.byBoard[board].failed++;
          const reason = job.failReason || 'Unknown';
          stats.failReasons[reason] = (stats.failReasons[reason] || 0) + 1;
          stats.failed.push({ title: job.title, company: job.company, board, failReason: reason, retryNotes: job.retryNotes || '', runId: run.runId, url: job.url });
        } else if (job.status === 'skipped') {
          stats.totalSkipped++;
          stats.byBoard[board].skipped++;
          const reason = job.skipReason || 'Unknown';
          stats.skipReasons[reason] = (stats.skipReasons[reason] || 0) + 1;
          stats.skipped.push({ title: job.title, company: job.company, board, skipReason: reason, runId: run.runId, url: job.url });
        }
      }
      stats.recentRuns.push({ runId: run.runId, query: run.query, status: run.status, applied: (run.summary||{}).applied||0, failed: (run.summary||{}).failed||0, skipped: (run.summary||{}).skipped||0, startedAt: run.startedAt });
    }
    const attempts = stats.totalApplied + stats.totalFailed;
    stats.successRate = attempts > 0 ? Math.round((stats.totalApplied / attempts) * 100) + '%' : '0%';
    stats.recentRuns.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
    console.log(JSON.stringify(stats));
  " "$RUNS_DIR"
elif command -v python3 &>/dev/null; then
  python3 -c "
import json, os, sys
d = sys.argv[1]
runs = []
for f in sorted(os.listdir(d)):
    if not f.endswith('.json'): continue
    try: runs.append(json.load(open(os.path.join(d, f))))
    except: pass
stats = {'totalRuns': len(runs), 'totalJobsFound': 0, 'totalApplied': 0, 'totalFailed': 0, 'totalSkipped': 0, 'successRate': '0%', 'byBoard': {}, 'applied': [], 'failed': [], 'skipped': [], 'failReasons': {}, 'skipReasons': {}, 'recentRuns': []}
for run in runs:
    jobs = run.get('jobs', [])
    stats['totalJobsFound'] += len(jobs)
    for job in jobs:
        board = job.get('board', 'unknown')
        if board not in stats['byBoard']:
            stats['byBoard'][board] = {'found': 0, 'applied': 0, 'failed': 0, 'skipped': 0}
        stats['byBoard'][board]['found'] += 1
        if job.get('status') == 'applied':
            stats['totalApplied'] += 1
            stats['byBoard'][board]['applied'] += 1
            stats['applied'].append({'title': job.get('title',''), 'company': job.get('company',''), 'score': job.get('matchScore'), 'board': board, 'appliedAt': job.get('appliedAt',''), 'runId': run.get('runId',''), 'url': job.get('url','')})
        elif job.get('status') == 'failed':
            stats['totalFailed'] += 1
            stats['byBoard'][board]['failed'] += 1
            reason = job.get('failReason', 'Unknown')
            stats['failReasons'][reason] = stats['failReasons'].get(reason, 0) + 1
            stats['failed'].append({'title': job.get('title',''), 'company': job.get('company',''), 'board': board, 'failReason': reason, 'retryNotes': job.get('retryNotes',''), 'runId': run.get('runId',''), 'url': job.get('url','')})
        elif job.get('status') == 'skipped':
            stats['totalSkipped'] += 1
            stats['byBoard'][board]['skipped'] += 1
            reason = job.get('skipReason', 'Unknown')
            stats['skipReasons'][reason] = stats['skipReasons'].get(reason, 0) + 1
            stats['skipped'].append({'title': job.get('title',''), 'company': job.get('company',''), 'board': board, 'skipReason': reason, 'runId': run.get('runId',''), 'url': job.get('url','')})
    s = run.get('summary', {})
    stats['recentRuns'].append({'runId': run.get('runId',''), 'query': run.get('query',''), 'status': run.get('status',''), 'applied': s.get('applied',0), 'failed': s.get('failed',0), 'skipped': s.get('skipped',0), 'startedAt': run.get('startedAt','')})
attempts = stats['totalApplied'] + stats['totalFailed']
stats['successRate'] = f\"{round(stats['totalApplied']/attempts*100)}%\" if attempts > 0 else '0%'
stats['recentRuns'].sort(key=lambda r: r.get('startedAt',''), reverse=True)
print(json.dumps(stats))
" "$RUNS_DIR"
else
  echo '{"error":"No runtime available (need node or python3)"}'
fi

/**
 * server.ts — Minimal HTTP dashboard server (no external web framework).
 *
 * Routes:
 *   GET /           → HTML dashboard (auto-refreshes every 5s)
 *   GET /api/results   → latest.json
 *   GET /api/history   → history.json
 *   GET /api/flakiness → flakiness.json
 */

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { loadJson } from './index.js'
import type { RunRecord, RunSummary, FlakinessEntry } from './index.js'

export interface ServerOptions {
  port?: number
  cwd?: string
}

export function startDashboardServer(options: ServerOptions = {}): http.Server {
  const port = options.port ?? 3333
  const cwd = options.cwd ?? process.cwd()
  const resultsDir = path.join(cwd, '.codecheck-results')

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/'

    try {
      if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(buildHtml())
        return
      }

      if (url === '/api/results') {
        const data = await loadJson<RunRecord | null>(
          path.join(resultsDir, 'latest.json'),
          null,
        )
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
        return
      }

      if (url === '/api/history') {
        const data = await loadJson<RunSummary[]>(
          path.join(resultsDir, 'history.json'),
          [],
        )
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(data))
        return
      }

      if (url === '/api/flakiness') {
        const data = await loadJson<Record<string, FlakinessEntry>>(
          path.join(resultsDir, 'flakiness.json'),
          {},
        )
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(Object.values(data)))
        return
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(`Server error: ${String(err)}`)
    }
  })

  server.listen(port)
  return server
}

// ─── HTML Dashboard ───────────────────────────────────────────────────────────

function buildHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeCheck Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117; --surface: #1a1d2e; --border: #2d3148;
      --text: #e2e8f0; --muted: #718096; --accent: #6366f1;
      --green: #22c55e; --red: #ef4444; --yellow: #f59e0b;
    }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.5; }
    header { padding: 1.25rem 2rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 1rem; }
    header h1 { font-size: 1.1rem; font-weight: 600; color: var(--accent); }
    header .badge { font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 9999px; background: var(--surface); color: var(--muted); border: 1px solid var(--border); }
    #status { margin-left: auto; font-size: 0.75rem; color: var(--muted); }
    main { padding: 1.5rem 2rem; max-width: 1200px; margin: 0 auto; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; }
    .card .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.5rem; }
    .card .value { font-size: 1.75rem; font-weight: 700; }
    .card .value.green { color: var(--green); }
    .card .value.red { color: var(--red); }
    .card .value.yellow { color: var(--yellow); }
    .progress-bar { height: 6px; background: var(--border); border-radius: 3px; margin-top: 0.75rem; overflow: hidden; }
    .progress-bar .fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
    section h2 { font-size: 0.85rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
    .results-table { width: 100%; border-collapse: collapse; }
    .results-table th { text-align: left; padding: 0.5rem 0.75rem; font-size: 0.7rem; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); }
    .results-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
    .results-table tr:hover td { background: var(--surface); }
    .pill { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
    .pill.pass { background: rgba(34,197,94,0.15); color: var(--green); }
    .pill.fail { background: rgba(239,68,68,0.15); color: var(--red); }
    .pill.flaky { background: rgba(245,158,11,0.15); color: var(--yellow); }
    .pill.type { background: rgba(99,102,241,0.15); color: var(--accent); }
    .error-msg { color: var(--red); font-size: 0.72rem; font-family: monospace; margin-top: 0.2rem; white-space: pre-wrap; word-break: break-word; max-width: 600px; }
    .trend { display: flex; align-items: flex-end; gap: 3px; height: 32px; }
    .trend-bar { width: 8px; border-radius: 2px; }
    .empty { text-align: center; padding: 4rem 0; color: var(--muted); }
    .empty p { margin-top: 0.5rem; font-size: 0.85rem; }
    .flakiness-section { margin-top: 1.5rem; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .tab { padding: 0.4rem 1rem; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; font-size: 0.8rem; }
    .tab.active { background: var(--accent); border-color: var(--accent); color: white; }
    .file-group { margin-bottom: 1rem; }
    .file-group .file-header { font-size: 0.75rem; color: var(--muted); padding: 0.4rem 0.75rem; background: var(--surface); border-radius: 6px 6px 0 0; border: 1px solid var(--border); border-bottom: none; font-family: monospace; }
    .file-group table { width: 100%; }
    .file-group table { border: 1px solid var(--border); border-radius: 0 0 6px 6px; overflow: hidden; }
  </style>
</head>
<body>
  <header>
    <h1>&#9670; CodeCheck</h1>
    <span class="badge">Dashboard</span>
    <span id="status">Loading&#8230;</span>
  </header>
  <main>
    <div id="root">
      <div class="empty">
        <div style="font-size:2rem;">&#9670;</div>
        <p>No test results yet. Run CodeCheck to see results here.</p>
      </div>
    </div>
  </main>

  <script>
    let activeTab = 'results';
    let refreshTimer;

    async function fetchAll() {
      const [resultsRes, historyRes, flakinessRes] = await Promise.all([
        fetch('/api/results').then(r => r.json()),
        fetch('/api/history').then(r => r.json()),
        fetch('/api/flakiness').then(r => r.json()),
      ]);
      return { results: resultsRes, history: historyRes, flakiness: flakinessRes };
    }

    function pct(n) { return Math.round(n * 100); }
    function rateColor(rate) {
      if (rate >= 0.9) return 'green';
      if (rate >= 0.7) return 'yellow';
      return 'red';
    }

    function renderTrend(history) {
      if (!history.length) return '';
      const bars = history.slice(0, 20).reverse().map(h => {
        const color = h.passRate >= 0.9 ? '#22c55e' : h.passRate >= 0.7 ? '#f59e0b' : '#ef4444';
        const height = Math.max(4, Math.round(h.passRate * 32));
        return '<div class="trend-bar" style="height:' + height + 'px;background:' + color + ';title=' + pct(h.passRate) + '%"></div>';
      }).join('');
      return '<div class="trend">' + bars + '</div>';
    }

    function renderCards(run, history) {
      const s = run.summary;
      const color = rateColor(s.passRate);
      return '<div class="cards">' +
        card('Pass Rate', pct(s.passRate) + '%', color, s.passRate) +
        card('Passed', s.passedTests, 'green', null) +
        card('Failed', s.totalTests - s.passedTests, s.totalTests - s.passedTests > 0 ? 'red' : 'green', null) +
        card('Total Tests', s.totalTests, '', null) +
        '<div class="card"><div class="label">Run Trend</div>' + renderTrend(history) + '</div>' +
        '</div>';
    }

    function card(label, value, colorClass, rate) {
      const bar = rate !== null ? '<div class="progress-bar"><div class="fill" style="width:' + pct(rate) + '%;background:var(--' + colorClass + ')"></div></div>' : '';
      return '<div class="card"><div class="label">' + label + '</div><div class="value ' + colorClass + '">' + value + '</div>' + bar + '</div>';
    }

    function groupByFile(results) {
      const groups = {};
      for (const r of results) {
        const key = r.filePath;
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      }
      return groups;
    }

    function renderResults(results) {
      if (!results.length) return '<div class="empty"><p>No test results in this run.</p></div>';
      const groups = groupByFile(results);
      return Object.entries(groups).map(([file, rows]) => {
        const passed = rows.filter(r => r.passed).length;
        const rowHtml = rows.map(r => {
          const status = r.passed
            ? '<span class="pill pass">PASS</span>'
            : '<span class="pill fail">FAIL</span>';
          const type = '<span class="pill type">' + escHtml(r.testType) + '</span>';
          const err = !r.passed && r.error ? '<div class="error-msg">' + escHtml(r.error.slice(0, 300)) + '</div>' : '';
          return '<tr><td>' + status + '</td><td>' + escHtml(r.targetName) + '</td><td>' + escHtml(r.description) + err + '</td><td>' + type + '</td><td>' + r.duration + 'ms</td></tr>';
        }).join('');
        return '<div class="file-group">' +
          '<div class="file-header">' + escHtml(file) + ' &nbsp;<span style="color:var(--green)">' + passed + '</span>/<span style="color:var(--muted)">' + rows.length + '</span></div>' +
          '<table class="results-table"><thead><tr><th>Status</th><th>Function</th><th>Description</th><th>Type</th><th>Time</th></tr></thead><tbody>' + rowHtml + '</tbody></table>' +
          '</div>';
      }).join('');
    }

    function renderFlakiness(flakiness) {
      const flaky = flakiness.filter(f => f.isFlaky);
      if (!flaky.length) return '<div class="empty"><p>No flaky tests detected. All tests have consistent results.</p></div>';
      const rows = flaky.map(f => {
        const rate = f.passCount / f.totalRuns;
        return '<tr>' +
          '<td><span class="pill flaky">FLAKY</span></td>' +
          '<td>' + escHtml(f.targetName) + '</td>' +
          '<td><span class="pill type">' + escHtml(f.testType) + '</span></td>' +
          '<td>' + f.passCount + '/' + f.totalRuns + ' (' + pct(rate) + '%)</td>' +
          '<td>' + escHtml(f.filePath) + '</td>' +
          '</tr>';
      }).join('');
      return '<table class="results-table"><thead><tr><th>Status</th><th>Function</th><th>Type</th><th>Pass Rate</th><th>File</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function escHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderTabs() {
      return '<div class="tabs">' +
        '<button class="tab' + (activeTab === 'results' ? ' active' : '') + '" onclick="switchTab(\'results\')">Test Results</button>' +
        '<button class="tab' + (activeTab === 'flakiness' ? ' active' : '') + '" onclick="switchTab(\'flakiness\')">Flakiness</button>' +
        '</div>';
    }

    window.switchTab = function(tab) {
      activeTab = tab;
      render(window._lastData);
    };

    function render(data) {
      window._lastData = data;
      if (!data.results) {
        document.getElementById('root').innerHTML =
          '<div class="empty"><div style="font-size:2rem;">&#9670;</div><p>No results yet. Run CodeCheck to populate the dashboard.</p></div>';
        return;
      }
      const run = data.results;
      const ts = new Date(run.summary.timestamp).toLocaleString();
      document.getElementById('status').textContent = 'Last run: ' + ts + ' · auto-refresh in 5s';
      const tabContent = activeTab === 'results'
        ? renderResults(run.results)
        : renderFlakiness(data.flakiness);
      document.getElementById('root').innerHTML =
        renderCards(run, data.history) +
        renderTabs() +
        tabContent;
    }

    async function refresh() {
      try {
        const data = await fetchAll();
        render(data);
      } catch (e) {
        document.getElementById('status').textContent = 'Error loading data';
      }
    }

    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`
}

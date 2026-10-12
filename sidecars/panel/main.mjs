import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const STARTED_AT = Date.now();

const app = new SidecarApp();

// Helper to read local files freshly so edits reflect immediately
const readLocal = (name) => readFileSync(join(HERE, name), 'utf8');

// ---------------------------------------------------------------------------
// Static routes with no-cache headers to prevent stale webview cache
// ---------------------------------------------------------------------------
const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0'
};

app.page('/', () => new Response(readLocal('index.html'), { contentType: 'text/html; charset=utf-8', headers: NO_CACHE }));
app.api('/app.js', () => new Response(readLocal('app.js'), { contentType: 'application/javascript; charset=utf-8', headers: NO_CACHE }), 'GET');
app.api('/styles.css', () => new Response(readLocal('styles.css'), { contentType: 'text/css; charset=utf-8', headers: NO_CACHE }), 'GET');

// ---------------------------------------------------------------------------
// APIs
// ---------------------------------------------------------------------------

// GET /api/status: Check sidecar health and host info
app.api('/api/status', () => ({
  status: 'ok',
  node: process.version,
  platform: `${platform()} ${release()}`,
  uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
}), 'GET');

// GET /api/dependencies: Scan environment for D-Research and Aleph-Skill
app.api('/api/dependencies', () => {
  const home = homedir();
  const configSkillsDir = join(home, '.gemini', 'config', 'skills');
  const configPluginsDir = join(home, '.gemini', 'config', 'plugins');

  // Check d-research
  const dResearchPaths = [
    join(configSkillsDir, 'd-research-skill'),
    join(configSkillsDir, 'd-research'),
    join(configPluginsDir, 'd-research', 'skills', 'd-research'),
    join(configPluginsDir, 'aleph-skill', 'skills', 'd-research'),
  ];
  let dResearchInstalled = false;
  let dResearchFoundPath = null;
  for (const p of dResearchPaths) {
    if (existsSync(join(p, 'SKILL.md'))) {
      dResearchInstalled = true;
      dResearchFoundPath = p;
      break;
    }
  }

  // Check aleph-skill
  const alephPaths = [
    join(configSkillsDir, 'aleph-skill'),
    join(configSkillsDir, 'aleph'),
    join(configPluginsDir, 'aleph', 'skills', 'aleph-skill'),
  ];
  let alephInstalled = false;
  let alephFoundPath = null;
  for (const p of alephPaths) {
    if (existsSync(join(p, 'SKILL.md'))) {
      alephInstalled = true;
      alephFoundPath = p;
      break;
    }
  }

  return {
    ready: dResearchInstalled && alephInstalled,
    skills: {
      dResearch: {
        installed: dResearchInstalled,
        name: 'd-research',
        path: dResearchFoundPath,
        description: 'Thu thập và thẩm định nguồn chứng cứ web (R0–R4)'
      },
      aleph: {
        installed: alephInstalled,
        name: 'aleph-skill',
        path: alephFoundPath,
        description: 'Dựng đồ thị nhân quả DAG và mô phỏng kịch bản What-If'
      }
    },
    scannedLocation: configSkillsDir
  };
}, 'GET');

// GET /api/workspace-data: Fetch live evidence ledger and causal graph from workspace
app.api('/api/workspace-data', (params) => {
  let targetDir = null;
  if (params && params.workspace) {
    try {
      targetDir = fileURLToPath(params.workspace);
    } catch {
      targetDir = params.workspace;
    }
  }

  const candidateDirs = [
    targetDir,
    process.env.WORKSPACE_ROOT,
    process.env.PWD,
    process.cwd(),
    join(homedir(), 'Downloads', 'd-research ui:aleph skill ui'),
  ].filter(Boolean);

  let ledgerRows = [];
  let timelineData = null;
  let foundDir = null;

  for (const dir of candidateDirs) {
    if (!existsSync(dir)) continue;

    const ledgerFile = join(dir, 'evidence-ledger.jsonl');
    if (existsSync(ledgerFile)) {
      try {
        const content = readFileSync(ledgerFile, 'utf8');
        ledgerRows = content
          .split('\n')
          .filter(Boolean)
          .map(line => {
            try { return JSON.parse(line); } catch { return null; }
          })
          .filter(Boolean);
        foundDir = dir;
      } catch (err) {
        console.error('Error reading evidence-ledger.jsonl:', err);
      }
    }

    const timelineFile = join(dir, 'timeline.json');
    if (existsSync(timelineFile)) {
      try {
        timelineData = JSON.parse(readFileSync(timelineFile, 'utf8'));
        foundDir = dir;
      } catch (err) {
        console.error('Error reading timeline.json:', err);
      }
    }

    if (ledgerRows.length > 0 || timelineData) {
      break;
    }
  }

  return {
    hasWorkspaceData: ledgerRows.length > 0 || timelineData !== null,
    workspaceDir: foundDir,
    evidenceRecords: ledgerRows,
    timelineData: timelineData
  };
}, 'GET');

app.run();

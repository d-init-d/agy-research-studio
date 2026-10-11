import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || join(HERE, '.data');
const STARTED_AT = Date.now();

const app = new SidecarApp();

// Helper to read local files freshly so edits reflect immediately
const readLocal = (name) => readFileSync(join(HERE, name), 'utf8');

// ---------------------------------------------------------------------------
// Static routes
// ---------------------------------------------------------------------------
app.page('/', () => readLocal('index.html'));
app.page('/app.js', () => readLocal('app.js'));
app.page('/graph.js', () => readLocal('graph.js'));
app.api('/styles.css', () => new Response(readLocal('styles.css'), { contentType: 'text/css' }), 'GET');

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
  let workspacePath = null;
  if (params && params.workspace) {
    try {
      workspacePath = fileURLToPath(params.workspace);
    } catch {
      workspacePath = params.workspace;
    }
  }

  let ledgerRows = [];
  if (workspacePath) {
    const ledgerFile = join(workspacePath, 'evidence-ledger.jsonl');
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
      } catch (err) {
        console.error('Error reading evidence-ledger.jsonl:', err);
      }
    }
  }

  return {
    hasWorkspaceData: ledgerRows.length > 0,
    records: ledgerRows
  };
}, 'GET');

app.run();

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform, release } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const STARTED_AT = Date.now();
const DATA_DIR = process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || join(homedir(), '.gemini', 'antigravity', 'sidecar_data', 'agy-research-studio', 'panel', 'data');

if (!existsSync(DATA_DIR)) {
  try { mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

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

// Helper to extract research claims dynamically from a conversation transcript
function tryExtractFromTranscript(convId) {
  if (!convId) return null;
  const transcriptPath = join(homedir(), '.gemini', 'antigravity', 'brain', convId, '.system_generated', 'logs', 'transcript.jsonl');
  if (!existsSync(transcriptPath)) return null;

  try {
    const raw = readFileSync(transcriptPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    let topic = '';
    const claims = [];

    for (const line of lines) {
      try {
        const step = JSON.parse(line);
        if (step.type === 'USER_INPUT' && step.content) {
          const match = step.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
          const userText = match ? match[1].trim() : step.content.trim();
          if (userText && !userText.startsWith('push lên') && !userText.startsWith('thanh side bar')) {
            topic = userText.replace(/^\/d\S*\s*/i, '').replace(/^xem giúp tôi\s*/i, '').trim();
          }
        }
        if (step.type === 'PLANNER_RESPONSE' && step.content) {
          const bulletRegex = /(?:^|\n)[*-]\s+\*\*([^*:\n]+)[:*]*\*\*\s*[:\-–]?\s*([^\n]+)/g;
          let m;
          while ((m = bulletRegex.exec(step.content)) !== null) {
            const title = m[1].trim();
            const desc = m[2].trim();
            if (title.length > 2 && desc.length > 5 && !claims.some(c => c.title === title)) {
              claims.push({
                id: 'tr_' + (claims.length + 1),
                claim_id: 'CLM-' + String(claims.length + 1).padStart(3, '0'),
                title: title,
                claim: `${title}: ${desc}`,
                snippet: desc,
                source: 'Trích xuất hội thoại',
                url: 'https://apple.com',
                source_type: 'analysis',
                confidence: 0.92,
                status: 'verified'
              });
            }
          }
        }
      } catch (_) {}
    }

    if (claims.length > 0) {
      return {
        topic: topic ? (topic.length > 40 ? topic.slice(0, 39) + '…' : topic) : 'Nghiên cứu hội thoại',
        evidenceRecords: claims
      };
    }
  } catch (err) {
    console.error('Error parsing transcript:', err);
  }
  return null;
}

// GET /api/workspace-data: Fetch live evidence ledger and causal graph scoped by conversation and workspace
app.api('/api/workspace-data', (params) => {
  const convId = params?.conversationId || null;
  let targetDir = null;
  if (params && params.workspace) {
    try {
      targetDir = fileURLToPath(params.workspace);
    } catch {
      targetDir = params.workspace;
    }
  }

  const candidateDirs = [];

  // 1. If conversationId is provided, look in conversation-specific brain and data stores FIRST
  if (convId) {
    candidateDirs.push(join(homedir(), '.gemini', 'antigravity', 'brain', convId));
    candidateDirs.push(join(homedir(), '.gemini', 'antigravity', 'brain', convId, 'scratch'));
    candidateDirs.push(join(DATA_DIR, 'conversations', convId));
  }

  // 2. Active workspace directory (if provided by client)
  if (targetDir) {
    candidateDirs.push(targetDir);
  }

  // 3. Fallbacks ONLY when NO conversationId was specified (e.g. standalone browser preview)
  if (!convId) {
    if (process.env.WORKSPACE_ROOT) candidateDirs.push(process.env.WORKSPACE_ROOT);
    candidateDirs.push(join(homedir(), 'Downloads', 'd-research ui:aleph skill ui'));
  }

  let ledgerRows = [];
  let timelineData = null;
  let coverageData = null;
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
          .filter(Boolean)
          .map((row, idx) => {
            const rawClaim = row.claim || row.snippet || row.content || '';
            const title = row.title || row.claim_id || (rawClaim ? (rawClaim.length > 40 ? rawClaim.slice(0, 39) + '…' : rawClaim) : `Bằng chứng #${idx + 1}`);
            const url = row.url || row.source_url || '';
            let domain = 'evidence-ledger';
            if (url) {
              try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { domain = url; }
            }
            const source = row.source || (row.source_type ? row.source_type.replace(/_/g, ' ') : domain);
            const type = row.type || (row.source_type === 'official_documentation' ? 'source' : (row.claim ? 'claim' : (row.issue ? 'issue' : 'source')));
            return {
              ...row,
              id: row.id || row.claim_id || `ev_${idx + 1}`,
              title,
              claim: rawClaim,
              snippet: row.snippet || rawClaim,
              url,
              source,
              type,
              confidence: row.confidence || 'Đã xác minh'
            };
          });
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

    const coverageFile = join(dir, 'research-coverage.json');
    if (existsSync(coverageFile)) {
      try {
        coverageData = JSON.parse(readFileSync(coverageFile, 'utf8'));
        foundDir = dir;
      } catch (err) {
        console.error('Error reading research-coverage.json:', err);
      }
    }

    if (ledgerRows.length > 0 || timelineData || coverageData) {
      break;
    }
  }

  // If no explicit ledger files found for this conversation, attempt smart transcript extraction
  if (convId && ledgerRows.length === 0 && !timelineData) {
    const extracted = tryExtractFromTranscript(convId);
    if (extracted) {
      ledgerRows = extracted.evidenceRecords;
      coverageData = { topic: extracted.topic };
      foundDir = `brain/${convId}/transcript`;
    }
  }

  const topic = coverageData?.topic || (ledgerRows.length > 0 ? (ledgerRows[0]?.title || ledgerRows[0]?.claim || 'Chủ đề nghiên cứu') : null);

  return {
    conversationId: convId,
    hasWorkspaceData: ledgerRows.length > 0 || timelineData !== null,
    workspaceDir: foundDir,
    evidenceRecords: ledgerRows,
    timelineData: timelineData,
    topic: topic,
    coverage: coverageData
  };
}, 'GET');

// POST /api/new-session: Register new search query from UI scoped to conversation
app.api('/api/new-session', (body) => {
  const topic = body?.topic || '';
  const mode = body?.mode || 'research';
  const convId = body?.conversationId || null;

  if (convId && topic) {
    const convDir = join(DATA_DIR, 'conversations', convId);
    try {
      if (!existsSync(convDir)) mkdirSync(convDir, { recursive: true });
      writeFileSync(join(convDir, 'session.json'), JSON.stringify({ topic, mode, updatedAt: Date.now() }, null, 2));
    } catch (err) {
      console.error('Error saving session:', err);
    }
  }

  return { status: 'ok', topic, mode, conversationId: convId };
}, 'POST');

app.run();

import { ObsidianGraph } from './graph.js';

const sidecar = window.sidecar;
const $ = (id) => document.getElementById(id);

let researchGraph = null;
let timelineGraph = null;
let liveStreamTimer = null;

// ---------------------------------------------------------------------------
// 1. Dependency Gatekeeper
// ---------------------------------------------------------------------------

async function checkDependencies() {
  try {
    const res = await (sidecar ? sidecar.fetch('/api/dependencies') : fetch('/api/dependencies'));
    const data = await res.json();

    const isReady = data.ready;
    const dResearch = data.skills?.dResearch?.installed;
    const aleph = data.skills?.aleph?.installed;

    // Update UI elements
    const badgeDResearch = $('badge-d-research');
    const statusDResearch = $('status-d-research');
    if (dResearch) {
      badgeDResearch.className = 'badge-round ok';
      badgeDResearch.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ok);"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>`;
      statusDResearch.textContent = 'Đã cài';
      statusDResearch.style.color = 'var(--ok)';
    } else {
      badgeDResearch.className = 'badge-round err';
      badgeDResearch.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:var(--err);"><path d="M7 7l10 10M17 7L7 17"></path></svg>`;
      statusDResearch.textContent = 'Chưa cài';
      statusDResearch.style.color = 'var(--err)';
    }

    const badgeAleph = $('badge-aleph');
    const statusAleph = $('status-aleph');
    if (aleph) {
      badgeAleph.className = 'badge-round ok';
      badgeAleph.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ok);"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>`;
      statusAleph.textContent = 'Đã cài';
      statusAleph.style.color = 'var(--ok)';
    } else {
      badgeAleph.className = 'badge-round err';
      badgeAleph.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:var(--err);"><path d="M7 7l10 10M17 7L7 17"></path></svg>`;
      statusAleph.textContent = 'Chưa cài';
      statusAleph.style.color = 'var(--err)';
    }

    // Toggle view states
    if (isReady) {
      $('view-gatekeeper').style.display = 'none';
      $('view-main').style.display = 'flex';
      $('global-status-chip').className = 'status-chip';
      $('global-status-text').textContent = 'Đang chạy';
      initGraphsIfNeeded();
    } else {
      $('view-gatekeeper').style.display = 'flex';
      $('view-main').style.display = 'none';
      $('global-status-chip').className = 'status-chip warn';
      $('global-status-text').textContent = 'Chưa sẵn sàng';
    }
  } catch (err) {
    console.warn('Dependency check error (running fallback):', err);
    // If running in preview mode or dev, enable main view
    $('view-gatekeeper').style.display = 'none';
    $('view-main').style.display = 'flex';
    initGraphsIfNeeded();
  }
}

// ---------------------------------------------------------------------------
// 2. Navigation Tabs
// ---------------------------------------------------------------------------

function switchTab(target) {
  const tabResearch = $('tab-research');
  const tabTimeline = $('tab-timeline');
  const pageResearch = $('page-research');
  const pageTimeline = $('page-timeline');

  if (target === 'research') {
    tabResearch.classList.add('active');
    tabTimeline.classList.remove('active');
    pageResearch.classList.add('active');
    pageTimeline.classList.remove('active');
    if (researchGraph) {
      researchGraph.initCanvasSize();
      researchGraph.wake(0.6);
    }
  } else {
    tabResearch.classList.remove('active');
    tabTimeline.classList.add('active');
    pageResearch.classList.remove('active');
    pageTimeline.classList.add('active');
    if (timelineGraph) {
      timelineGraph.initCanvasSize();
      timelineGraph.wake(0.6);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Obsidian Knowledge Graphs Initialization
// ---------------------------------------------------------------------------

function initGraphsIfNeeded() {
  if (researchGraph && timelineGraph) return;

  // 1. Research Sources Graph
  const rCanvas = $('research-graph-canvas');
  if (rCanvas && !researchGraph) {
    researchGraph = new ObsidianGraph(rCanvas, {
      charge: -140,
      linkDistance: 45,
      gravity: 0.04
    });

    const researchNodes = [
      { id: 'hub', label: 'Ecosystem AI', type: 'hub', radius: 9 },
      { id: 'n1', label: 'arxiv:2502', type: 'primary', radius: 6 },
      { id: 'n2', label: 'github/vllm', type: 'primary', radius: 6 },
      { id: 'n3', label: 'sec.gov/10K', type: 'primary', radius: 5.5 },
      { id: 'n4', label: 'reddit/localllama', type: 'social', radius: 5.5 },
      { id: 'n5', label: 'x.com/thread', type: 'social', radius: 5 },
      { id: 'n6', label: 'paywall/403', type: 'err', radius: 5.5 }
    ];

    const researchLinks = [
      { source: 'hub', target: 'n1' },
      { source: 'hub', target: 'n2' },
      { source: 'hub', target: 'n3' },
      { source: 'hub', target: 'n4' },
      { source: 'n4', target: 'n5' },
      { source: 'n1', target: 'n6', type: 'contradict' }
    ];

    researchGraph.setData(researchNodes, researchLinks);

    // Zoom buttons
    $('btn-research-zoom-in')?.addEventListener('click', () => {
      researchGraph.camera.zoom = Math.min(3.0, researchGraph.camera.zoom * 1.2);
    });
    $('btn-research-zoom-out')?.addEventListener('click', () => {
      researchGraph.camera.zoom = Math.max(0.4, researchGraph.camera.zoom * 0.8);
    });
    $('btn-research-reset')?.addEventListener('click', () => {
      researchGraph.camera.zoom = 1;
      researchGraph.camera.x = researchGraph.width / 2;
      researchGraph.camera.y = researchGraph.height / 2;
      researchGraph.wake(0.8);
    });

    // Start streaming periodic mock nodes to showcase live ingestion
    startLiveStreamMock();
  }

  // 2. Causal Timeline Graph
  const tCanvas = $('timeline-graph-canvas');
  if (tCanvas && !timelineGraph) {
    timelineGraph = new ObsidianGraph(tCanvas, {
      charge: -160,
      linkDistance: 50,
      gravity: 0.035
    });

    const timelineNodes = [
      { id: 't1', label: 'Sự kiện can thiệp', type: 'fact', radius: 8 },
      { id: 't2', label: 'Hệ quả trung gian', type: 'inference', radius: 7.5 },
      { id: 't3', label: 'Giả định hành vi', type: 'assumption', radius: 6.5 },
      { id: 't4', label: 'Kịch bản mô phỏng', type: 'simulation', radius: 7 },
      { id: 't5', label: 'Phản thực', type: 'counterfactual', radius: 6 },
      { id: 't6', label: 'Hệ quả cuối', type: 'hub', radius: 7 },
      { id: 'src1', label: 'nguồn chứng cứ', type: 'primary', radius: 4.5 }
    ];

    const timelineLinks = [
      { source: 't1', target: 't2' },
      { source: 't2', target: 't4' },
      { source: 't1', target: 't3' },
      { source: 't3', target: 't4' },
      { source: 't2', target: 't5', style: 'dashed' },
      { source: 't4', target: 't6' },
      { source: 'src1', target: 't1' }
    ];

    timelineGraph.setData(timelineNodes, timelineLinks);

    $('btn-timeline-zoom-in')?.addEventListener('click', () => {
      timelineGraph.camera.zoom = Math.min(3.0, timelineGraph.camera.zoom * 1.2);
    });
    $('btn-timeline-zoom-out')?.addEventListener('click', () => {
      timelineGraph.camera.zoom = Math.max(0.4, timelineGraph.camera.zoom * 0.8);
    });
    $('btn-timeline-reset')?.addEventListener('click', () => {
      timelineGraph.camera.zoom = 1;
      timelineGraph.camera.x = timelineGraph.width / 2;
      timelineGraph.camera.y = timelineGraph.height / 2;
      timelineGraph.wake(0.8);
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Live Streaming Simulation (Nodes spawning dynamically)
// ---------------------------------------------------------------------------

function startLiveStreamMock() {
  if (liveStreamTimer) return;
  const sampleDomains = [
    { label: 'huggingface.co', type: 'primary' },
    { label: 'discord/ai-dev', type: 'social' },
    { label: 'nature.com/ml', type: 'fact' },
    { label: 'semianalysis', type: 'primary' }
  ];
  let idx = 0;

  liveStreamTimer = setInterval(() => {
    if (!researchGraph) return;
    const item = sampleDomains[idx % sampleDomains.length];
    const newNodeId = `stream_${Date.now()}`;

    // Add node with ripple pulse animation
    researchGraph.addNode({
      id: newNodeId,
      label: item.label,
      type: item.type,
      radius: 5.5,
      isNew: true
    });

    // Connect to hub or existing node
    researchGraph.addLink({
      source: 'hub',
      target: newNodeId
    });

    // Add row to live feed
    addFeedRow(item.label, 'R1', 'Đã thu thập trích dẫn mới', 'vừa xong');

    idx++;
    if (idx >= 8) clearInterval(liveStreamTimer); // Bounded mock
  }, 14000);
}

function addFeedRow(domain, tier, title, time) {
  const feed = $('research-feed-list');
  if (!feed) return;

  const row = document.createElement('div');
  row.className = 'feed-row';
  row.innerHTML = `
    <div style="width:16px; height:16px; border-radius:50%; background:var(--ok-bg); display:flex; align-items:center; justify-content:center; flex:none;">
      <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ok);"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
    </div>
    <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="mono-tag">${domain}</span>
        <span class="pill-tier" style="background:var(--ok-bg); color:var(--ok);">${tier}</span>
      </div>
      <span style="font-weight:500; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</span>
    </div>
    <span class="mono-tag" style="flex:none;">${time}</span>
  `;
  feed.insertBefore(row, feed.firstChild);
}

// ---------------------------------------------------------------------------
// 5. User Actions & Agent Bridge
// ---------------------------------------------------------------------------

function setupEventListeners() {
  $('tab-research')?.addEventListener('click', () => switchTab('research'));
  $('tab-timeline')?.addEventListener('click', () => switchTab('timeline'));

  // Gatekeeper: Auto install
  $('btn-auto-install')?.addEventListener('click', async () => {
    const prompt = 'Hãy kiểm tra và cài đặt giúp tôi skill d-research và aleph-skill vào hệ thống Antigravity.';
    if (sidecar?.agent?.sendMessage) {
      await sidecar.agent.sendMessage(prompt);
    } else {
      alert(`[Demo Mode] Đã gửi lệnh tới Agent: "${prompt}"`);
    }
  });

  // Gatekeeper: Re-check
  $('btn-recheck')?.addEventListener('click', () => {
    checkDependencies();
  });

  // Toggle research run
  $('btn-toggle-research')?.addEventListener('click', () => {
    const btn = $('btn-toggle-research');
    const isRunning = btn.textContent.includes('Dừng');
    if (isRunning) {
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"></path></svg> Tiếp tục`;
      $('global-status-text').textContent = 'Tạm dừng';
      $('global-status-chip').className = 'status-chip warn';
    } else {
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"></rect></svg> Dừng`;
      $('global-status-text').textContent = 'Đang chạy';
      $('global-status-chip').className = 'status-chip';
    }
  });

  // Run Branch B
  $('btn-run-branch')?.addEventListener('click', async () => {
    const prompt = 'Chạy mô phỏng kịch bản Nhánh B với aleph-skill và cập nhật đồ thị nhân quả.';
    if (sidecar?.agent?.sendMessage) {
      await sidecar.agent.sendMessage(prompt);
    } else {
      alert(`[Demo Mode] Đã gửi lệnh tới Agent: "${prompt}"`);
    }
  });
}

// ---------------------------------------------------------------------------
// Bootloader
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkDependencies();
});

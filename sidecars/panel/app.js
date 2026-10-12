(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const icon = (name, cls = 'ico small') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const getDomain = (u) => {
    if (!u) return '';
    try {
      const parsed = new URL(u);
      return parsed.hostname.replace(/^www\./, '');
    } catch (_) {
      return u.length > 25 ? u.slice(0, 24) + '…' : u;
    }
  };

  const colors = {
    source: 'var(--source)',
    claim: 'var(--claim)',
    issue: 'var(--issue)',
    event: 'var(--event)',
    actor: 'var(--actor)',
    scenario: 'var(--scenario)'
  };

  const labels = {
    source: 'Nguồn tin',
    claim: 'Luận điểm',
    issue: 'Cần kiểm chứng',
    event: 'Sự kiện',
    actor: 'Tác nhân',
    scenario: 'Kịch bản'
  };

  // Clean initial datasets (no dummy AI demo data)
  const baseResearchNodes = [
    ['r0', 'Chưa có nghiên cứu', 'claim', 'Nhập chủ đề vào thanh tìm kiếm và bấm D Research để bắt đầu thu thập.', 0, 0]
  ];
  const baseResearchEdges = [];

  const baseAlephNodes = [
    ['a0', 'Chưa có mô phỏng', 'event', 'Nhập kịch bản hoặc điểm can thiệp để bắt đầu dựng đồ thị nhân quả.', 0, 0]
  ];
  const baseAlephEdges = [];

  const templates = {
    research: [
      ['Nghiên cứu thị trường', 'source', 'Báo cáo khảo sát thực nghiệm chuyên sâu.', 'r0'],
      ['Kiểm chứng chéo', 'issue', 'Đối chiếu phương pháp đo lường giữa các nguồn tài liệu.', 'r0'],
      ['Phân tích kỹ thuật', 'claim', 'Đánh giá tính năng, kiến trúc và hiệu năng thực tế.', 'r0'],
      ['Tài liệu công bố', 'source', 'Tài liệu thông số và báo cáo chính thức từ nhà sản xuất.', 'r0']
    ],
    aleph: [
      ['Điểm can thiệp', 'event', 'Tác động điều chỉnh biến đầu vào của hệ thống.', 'a0'],
      ['Tác nhân tham gia', 'actor', 'Đối tượng chịu tác động hoặc đưa ra phản ứng.', 'a0'],
      ['Kịch bản phân nhánh', 'scenario', 'Khả năng diễn tiến trong các điều kiện khác nhau.', 'a0']
    ]
  };

  function buildStore(kind, baseNodes, baseEdges) {
    const nodes = baseNodes.map(([id, label, type, desc, x, y], i) => ({
      id, label, type, desc, x, y, vx: 0, vy: 0, seed: true, number: i + 1
    }));
    const links = baseEdges.map(([a, b]) => ({ a, b }));
    const feed = [];

    return {
      nodes,
      links,
      feed,
      live: true,
      step: 0,
      query: '',
      selected: kind === 'research' ? 'r0' : 'a0'
    };
  }

  const data = {
    research: buildStore('research', baseResearchNodes, baseResearchEdges),
    aleph: buildStore('aleph', baseAlephNodes, baseAlephEdges)
  };

  let mode = 'research';
  let inspect = 'feed';
  let filter = 'all';
  let theme = 'system';
  let width = 360;
  let height = 310;
  let scale = 0.85;
  let panX = 0;
  let panY = 0;
  let drag = null;
  let frames = 0;
  let recentNode = '';
  let toastTimeout = null;
  let autoTimer = null;
  let dependenciesState = { ready: true, dResearch: true, aleph: true };
  let activeTopic = '';

  try {
    const saved = localStorage.getItem('agy-theme-v2');
    theme = (saved === 'dark' || saved === 'light') ? saved : 'system';
  } catch (_) {}

  const currentStore = () => data[mode];
  const selectedNode = () => currentStore().nodes.find((n) => n.id === currentStore().selected);

  // ---------------------------------------------------------------------------
  // Theme Management
  // ---------------------------------------------------------------------------
  function detectHostTheme() {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    if (bg) {
      if (bg.startsWith('#') && bg.length >= 7) {
        const r = parseInt(bg.slice(1, 3), 16);
        const g = parseInt(bg.slice(3, 5), 16);
        const b = parseInt(bg.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) < 135 ? 'dark' : 'light';
      }
      if (bg.startsWith('rgb')) {
        const m = bg.match(/\d+/g);
        if (m && m.length >= 3) {
          const lum = 0.299 * (+m[0]) + 0.587 * (+m[1]) + 0.114 * (+m[2]);
          return lum < 135 ? 'dark' : 'light';
        }
      }
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const actual = theme === 'system' ? detectHostTheme() : theme;

    document.documentElement.dataset.theme = actual;
    const themeBtn = $('#theme-button');
    if (themeBtn) {
      themeBtn.innerHTML = icon(actual === 'light' ? 'sun' : 'moon', 'ico');
      const label = theme === 'system' ? `Hệ thống (${actual === 'light' ? 'Sáng' : 'Tối'})` : (theme === 'dark' ? 'Tối' : 'Sáng');
      themeBtn.title = `Giao diện: ${label}`;
    }

    $$('[data-theme-choice]').forEach((b) => {
      b.classList.toggle('on', b.dataset.themeChoice === theme);
    });

    try {
      localStorage.setItem('agy-theme-v2', theme);
    } catch (_) {}

    frames = 15;
    renderGraph();
  }

  function showToast(text) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ---------------------------------------------------------------------------
  // Dependency Gatekeeper Integration
  // ---------------------------------------------------------------------------
  async function checkDependencies() {
    try {
      const res = await (window.sidecar ? window.sidecar.fetch('/api/dependencies') : fetch('/api/dependencies'));
      const result = await res.json();

      const dReady = !!result.skills?.dResearch?.installed;
      const aReady = !!result.skills?.aleph?.installed;
      const isReady = dReady && aReady;

      dependenciesState = {
        ready: isReady,
        dResearch: dReady,
        aleph: aReady
      };

      // Update gatekeeper UI
      const gateD = $('#gate-d');
      const gateA = $('#gate-a');
      const gate = $('#gate');

      if (gateD) {
        gateD.innerHTML = dReady
          ? `${icon('check')} Đã cài đặt`
          : '<span style="color:var(--bad);">○ Chưa cài</span>';
        gateD.style.color = dReady ? 'var(--good)' : 'var(--bad)';
      }

      if (gateA) {
        gateA.innerHTML = aReady
          ? `${icon('check')} Đã cài đặt`
          : '<span style="color:var(--bad);">○ Chưa cài</span>';
        gateA.style.color = aReady ? 'var(--good)' : 'var(--bad)';
      }

      // Update settings modal indicators
      const setD = $('#setting-status-d');
      const setA = $('#setting-status-a');
      if (setD) {
        setD.textContent = dReady ? '✓ Đã sẵn sàng' : '✗ Chưa cài';
        setD.style.color = dReady ? 'var(--good)' : 'var(--bad)';
      }
      if (setA) {
        setA.textContent = aReady ? '✓ Đã sẵn sàng' : '✗ Chưa cài';
        setA.style.color = aReady ? 'var(--good)' : 'var(--bad)';
      }

      // Show or hide gatekeeper
      if (gate) {
        gate.hidden = isReady;
      }

      return isReady;
    } catch (err) {
      console.warn('Dependency check fallback:', err);
      // Fallback: unlock for preview mode
      dependenciesState = { ready: true, dResearch: true, aleph: true };
      const gate = $('#gate');
      if (gate) gate.hidden = true;
      return true;
    }
  }

  // ---------------------------------------------------------------------------
  // Workspace Data Integration (evidence-ledger.jsonl & timeline.json)
  // ---------------------------------------------------------------------------
  async function loadWorkspaceData() {
    try {
      const workspaceUri = window.sidecar?.workspace?.uri || '';
      const url = workspaceUri ? `/api/workspace-data?workspace=${encodeURIComponent(workspaceUri)}` : '/api/workspace-data';
      const res = await (window.sidecar ? window.sidecar.fetch(url) : fetch(url));
      const resData = await res.json();

      if (resData.hasWorkspaceData) {
        const badge = $('#workspace-badge');
        if (badge) badge.textContent = 'SYNCED';

        // Load evidence records into research graph
        if (resData.evidenceRecords && resData.evidenceRecords.length > 0) {
          const rStore = data.research;

          // Resolve research topic from backend
          const topicName = resData.topic || 'Chủ đề nghiên cứu';
          const cleanTopic = topicName.length > 22 ? topicName.slice(0, 21) + '…' : topicName;

          // If user initiated a new research query and backend has NOT caught up yet, do not revert research graph!
          let skipResearchUpdate = false;
          if (mode === 'research' && activeTopic && !topicName.toLowerCase().includes(activeTopic.toLowerCase()) && !activeTopic.toLowerCase().includes(topicName.toLowerCase())) {
            console.log(`Backend topic ("${topicName}") does not match active query ("${activeTopic}"). Waiting for Agent.`);
            skipResearchUpdate = true;
          }

          if (!skipResearchUpdate) {
            if (!activeTopic && mode === 'research') {
              activeTopic = topicName;
            }

            // Synchronize query input ONLY if in research mode and not focused / typing
            const qInput = $('#query');
            if (mode === 'research' && qInput && document.activeElement !== qInput && (!qInput.value || qInput.value.includes('lao động') || qInput.value.trim() === '')) {
              qInput.value = topicName;
            }

            // Check if topic changed compared to root node
            const rootNode = rStore.nodes.find(n => n.id === 'r0');
            const topicChanged = !rootNode || !rootNode.label.toLowerCase().includes(cleanTopic.toLowerCase());
            const hasDummyNodes = rStore.nodes.some(n => (!n.id.startsWith('ev_') && n.id !== 'r0') || n.label.includes('Chưa có') || n.label.includes('lao động') || n.label.includes('ILO') || n.label.includes('trợ cấp') || n.label.includes('MIT'));

            if (topicChanged || hasDummyNodes || rStore.nodes.length <= 1) {
              rStore.nodes = [{
                id: 'r0',
                label: cleanTopic,
                fullLabel: topicName,
                type: 'claim',
                desc: `Chủ đề nghiên cứu trung tâm: ${topicName}`,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                seed: true,
                number: 1
              }];
              rStore.links = [];
              rStore.feed = [];
            }

            resData.evidenceRecords.forEach((item, idx) => {
              const id = 'ev_' + (item.id || idx);
              if (!rStore.nodes.some(n => n.id === id)) {
                const label = item.title || item.source || item.url || `Bằng chứng #${idx + 1}`;
                const type = item.type || (item.claim ? 'claim' : (item.issue ? 'issue' : 'source'));
                const angle = (idx * 2.39996);
                const dist = 75 + (idx % 3) * 35;
                rStore.nodes.push({
                  id,
                  label: label.length > 22 ? label.slice(0, 21) + '…' : label,
                  fullLabel: label,
                  type: type,
                  desc: item.snippet || item.claim || item.content || item.summary || 'Dữ liệu được trích xuất từ workspace.',
                  source: item.source || '',
                  url: item.url || '',
                  confidence: item.confidence || '',
                  timestamp: item.timestamp || '',
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  vx: 0,
                  vy: 0,
                  seed: false
                });
                rStore.links.push({ a: id, b: 'r0' });

                if (!rStore.feed.some(f => f.id === id)) {
                  rStore.feed.unshift({
                    id,
                    title: `${label.length > 24 ? label.slice(0, 23) + '…' : label}`,
                    sub: `${labels[type] || 'Bằng chứng'} · ${item.source || 'evidence-ledger.jsonl'}`,
                    time: 'Đã xác minh',
                    type,
                    url: item.url || '',
                    source: item.source || ''
                  });
                }
              }
            });
            rStore.feed = rStore.feed.slice(0, 30);

            if (mode === 'research') {
              const sessionLabel = $('#session-label');
              if (sessionLabel) {
                sessionLabel.textContent = `Workspace Synced · ${cleanTopic}`;
              }
            }
          }
        }

        // Load timeline records into aleph graph if available
        if (resData.timelineData && resData.timelineData.events && resData.timelineData.events.length > 0) {
          const aStore = data.aleph;
          const rootTopic = resData.timelineData.intervention || 'Mô phỏng nhân quả';
          const cleanAlephTopic = rootTopic.length > 22 ? rootTopic.slice(0, 21) + '…' : rootTopic;

          if (mode === 'aleph') {
            const qInput = $('#query');
            if (qInput && document.activeElement !== qInput && (!qInput.value || qInput.value.includes('Chưa có') || qInput.value.trim() === '')) {
              qInput.value = rootTopic;
            }
            const sessionLabel = $('#session-label');
            if (sessionLabel) {
              sessionLabel.textContent = `Workspace Synced · ${cleanAlephTopic}`;
            }
          }

          const hasDummyAleph = aStore.nodes.some(n => (!n.id.startsWith('tl_') && n.id !== 'a0') || n.label.includes('Chưa có'));
          const rootNode = aStore.nodes.find(n => n.id === 'a0');
          const topicChanged = !rootNode || !rootNode.label.toLowerCase().includes(cleanAlephTopic.toLowerCase());

          if (topicChanged || hasDummyAleph || aStore.nodes.length <= 1) {
            aStore.nodes = [{
              id: 'a0',
              label: cleanAlephTopic,
              fullLabel: rootTopic,
              type: 'event',
              desc: `Điểm can thiệp ban đầu: ${rootTopic}`,
              x: 0,
              y: 0,
              vx: 0,
              vy: 0,
              seed: true,
              number: 1
            }];
            aStore.links = [];
            aStore.feed = [];
          }

          resData.timelineData.events.forEach((ev, idx) => {
            const id = 'tl_' + (ev.id || idx);
            if (!aStore.nodes.some(n => n.id === id)) {
              const label = ev.label || ev.title || ev.name || `Sự kiện #${idx + 1}`;
              const type = ev.type || 'event';
              const angle = (idx * 2.39996);
              const dist = 75 + (idx % 3) * 35;
              aStore.nodes.push({
                id,
                label: label.length > 22 ? label.slice(0, 21) + '…' : label,
                fullLabel: ev.name || label,
                type,
                desc: ev.desc || ev.description || 'Sự kiện mô phỏng nhân quả từ timeline.json',
                source: ev.source || 'aleph-skill',
                url: ev.url || '',
                confidence: ev.confidence || ev.status || 'Mô phỏng',
                timestamp: ev.time || ev.timestamp || '',
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                vx: 0,
                vy: 0,
                seed: false
              });

              if (!aStore.feed.some(f => f.id === id)) {
                aStore.feed.unshift({
                  id,
                  title: `${label.length > 24 ? label.slice(0, 23) + '…' : label}`,
                  sub: `${labels[type] || 'Sự kiện'} · ${ev.source || 'timeline.json'}`,
                  time: ev.time || 'Mô phỏng',
                  type,
                  url: ev.url || '',
                  source: ev.source || ''
                });
              }
            }
          });

          // Connect links: if timelineData.links is provided, connect defined causal pairs; otherwise link to a0
          if (Array.isArray(resData.timelineData.links) && resData.timelineData.links.length > 0) {
            resData.timelineData.links.forEach(l => {
              const aId = (String(l.source).startsWith('tl_') || l.source === 'a0') ? l.source : 'tl_' + l.source;
              const bId = (String(l.target).startsWith('tl_') || l.target === 'a0') ? l.target : 'tl_' + l.target;
              if (!aStore.links.some(existing => (existing.a === aId && existing.b === bId) || (existing.a === bId && existing.b === aId))) {
                aStore.links.push({ a: aId, b: bId });
              }
            });
          } else {
            resData.timelineData.events.forEach((ev, idx) => {
              const id = 'tl_' + (ev.id || idx);
              if (!aStore.links.some(l => l.a === id && l.b === 'a0')) {
                aStore.links.push({ a: id, b: 'a0' });
              }
            });
          }

          aStore.feed = aStore.feed.slice(0, 30);
        }

        frames = 60;
        updateUI();
      }
    } catch (err) {
      console.log('No workspace data file found, using built-in graph template.');
    }
  }

  // ---------------------------------------------------------------------------
  // Graph & Mode Switching
  // ---------------------------------------------------------------------------
  function fitScale() {
    return Math.min(0.95, Math.max(0.65, width / 430)) * Math.min(1, Math.max(0.78, height / 310));
  }

  function setMode(newMode) {
    if (mode === newMode) return;
    currentStore().query = $('#query').value;
    mode = newMode;
    filter = 'all';
    inspect = 'feed';
    scale = fitScale();
    panX = panY = 0;

    const targetStore = currentStore();
    const activeLabel = targetStore.nodes[0]?.fullLabel || targetStore.nodes[0]?.label || '';
    if (activeLabel && !activeLabel.includes('Chưa có')) {
      targetStore.query = activeLabel;
    }
    $('#query').value = targetStore.query || '';
    $('#command-heading').textContent = mode === 'research' ? 'D Research' : 'Aleph';
    $('#run-label').textContent = mode === 'research' ? 'D Research' : 'Aleph';
    $('#graph-name').textContent = mode === 'research' ? 'D Research Graph' : 'Aleph Graph';

    const sessionLabel = $('#session-label');
    if (sessionLabel && activeLabel && !activeLabel.includes('Chưa có')) {
      const clean = activeLabel.length > 22 ? activeLabel.slice(0, 21) + '…' : activeLabel;
      sessionLabel.textContent = `Workspace Synced · ${clean}`;
    }

    $$('.mode').forEach((b) => b.classList.toggle('selected', b.dataset.mode === mode));

    updateUI();
    showToast(mode === 'research' ? 'Đã chuyển sang D Research' : 'Đã chuyển sang Aleph');
  }

  function updateMetrics() {
    const s = currentStore();
    const isR = mode === 'research';

    $('#m1').textContent = String(s.nodes.filter((n) => n.type === (isR ? 'source' : 'scenario')).length).padStart(2, '0');
    $('#m2').textContent = String(s.links.length).padStart(2, '0');
    $('#m3').textContent = String(s.nodes.filter((n) => n.type === (isR ? 'issue' : 'actor')).length).padStart(2, '0');

    $('#l1').textContent = isR ? 'Nguồn thu thập' : 'Nhánh kịch bản';
    $('#l2').textContent = isR ? 'Liên kết' : 'Quan hệ nhân quả';
    $('#l3').textContent = isR ? 'Cần xác minh' : 'Tác nhân';

    $('#graph-counter').textContent = `${s.nodes.length} nodes · ${s.links.length} links`;
    $('#live-text').textContent = s.live ? 'Live' : 'Paused';

    const liveDot = $('#live-dot');
    const graphDot = $('#graph-dot');
    const footerDot = $('#footer-dot');

    if (liveDot) liveDot.classList.toggle('stopped', !s.live);
    if (graphDot) graphDot.classList.toggle('stopped', !s.live);
    if (footerDot) footerDot.style.background = s.live ? 'var(--good)' : 'var(--muted)';

    $('#graph-hint').textContent = s.live ? 'LIVE MAPPING' : 'STREAM PAUSED';
    $('#footer-status').textContent = s.live ? 'Đang theo dõi workspace' : 'Tạm dừng stream';

    const autoSwitch = $('#auto-update');
    if (autoSwitch) autoSwitch.checked = s.live;
  }

  function updateFilters() {
    const opts = mode === 'research'
      ? [['all', 'Tất cả'], ['source', 'Nguồn tin'], ['claim', 'Luận điểm'], ['issue', 'Xác minh']]
      : [['all', 'Tất cả'], ['event', 'Sự kiện'], ['actor', 'Tác nhân'], ['scenario', 'Kịch bản']];

    const filtersEl = $('#filters');
    if (filtersEl) {
      filtersEl.innerHTML = opts.map(([id, name]) => `
        <button class="filter ${id === filter ? 'on' : ''}" data-filter="${id}">${name}</button>
      `).join('');
    }

    const legendEl = $('#legend');
    if (legendEl) {
      legendEl.innerHTML = opts.slice(1).map(([id, name]) => `
        <span class="lgitem"><span class="lgdot" style="background:${colors[id]}"></span>${name}</span>
      `).join('');
    }
  }

  function neighbours(id) {
    return currentStore().links
      .filter((l) => l.a === id || l.b === id)
      .map((l) => (l.a === id ? l.b : l.a));
  }

  function renderGraph() {
    const s = currentStore();
    const map = new Map(s.nodes.map((n) => [n.id, n]));
    const sel = s.selected;

    let es = '';
    let ns = '';

    // Render Edges
    for (const l of s.links) {
      const a = map.get(l.a);
      const b = map.get(l.b);
      if (!a || !b) continue;

      const active = (l.a === sel || l.b === sel);
      const dim = filter !== 'all' && a.type !== filter && b.type !== filter;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const endX = mode === 'aleph' ? b.x - (dx / dist) * 10 : b.x;
      const endY = mode === 'aleph' ? b.y - (dy / dist) * 10 : b.y;

      es += `<line class="edge ${active ? 'active' : ''}"
        x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}"
        x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}"
        ${mode === 'aleph' ? 'marker-end="url(#causal-arrow)"' : ''}
        style="${dim ? 'stroke-opacity:0.045;' : ''}${active ? 'stroke:var(--accent);' : ''}" />`;
    }

    // Render Nodes
    for (const n of s.nodes) {
      const focus = n.id === sel;
      const faded = filter !== 'all' && n.type !== filter;
      const radius = focus ? 7.4 : (n.id.endsWith('0') ? 6.2 : 5.1);
      const shortLabel = n.label.length > 20 ? n.label.slice(0, 19) + '…' : n.label;

      ns += `<g class="node ${focus ? 'focus ' : ''}${faded ? 'faded ' : ''}${n.id === recentNode ? 'new' : ''}"
        data-id="${esc(n.id)}"
        transform="translate(${n.x.toFixed(1)}, ${n.y.toFixed(1)})">
        <title>${esc(n.label)} — ${esc(labels[n.type])}</title>
        <circle class="halo" r="${radius + 8}" stroke="${colors[n.type]}" />
        <circle class="core" r="${radius}" fill="${colors[n.type]}" />
        <text x="${radius + 7}" y="3.5">${esc(shortLabel)}</text>
      </g>`;
    }

    $('#edges').innerHTML = es;
    $('#nodes').innerHTML = ns;

    const transformStr = `translate(${(width / 2 + panX).toFixed(2)}, ${(height / 2 + panY).toFixed(2)}) scale(${scale.toFixed(3)})`;
    $('#graph-transform').setAttribute('transform', transformStr);
  }

  function updateInspection() {
    const s = currentStore();
    $$('[data-inspect]').forEach((b) => b.classList.toggle('on', b.dataset.inspect === inspect));
    const area = $('#inspect-content');
    if (!area) return;

    if (inspect === 'feed') {
      $('#panel-count').textContent = `${s.feed.length} hoạt động`;
      area.innerHTML = s.feed.map((f) => `
        <button class="feed-entry" data-select="${esc(f.id)}">
          <span class="type-icon" style="color:${colors[f.type]}">
            ${icon(f.type === 'source' ? 'file' : f.type === 'scenario' ? 'branch' : 'network')}
          </span>
          <span class="entry-body">
            <div class="entry-title">${esc(f.title)}</div>
            <div class="entry-sub">${esc(f.sub)}</div>
          </span>
          <span class="entry-time">${esc(f.time)}</span>
        </button>
      `).join('');
    } else if (inspect === 'sources') {
      const sources = mode === 'research'
        ? s.nodes.filter((n) => n.id !== 'r0' && (n.url || n.source || n.type === 'source'))
        : s.nodes.filter((n) => n.type === 'event' || n.type === 'scenario');

      $('#panel-count').textContent = `${sources.length} ${mode === 'research' ? 'nguồn' : 'sự kiện'}`;
      if (sources.length === 0) {
        area.innerHTML = '<div class="empty">Chưa có nguồn trích xuất nào.</div>';
        return;
      }
      area.innerHTML = sources.map((n) => {
        const domain = getDomain(n.url);
        return `
          <div class="source-card" data-select="${esc(n.id)}">
            <div class="source-card-top">
              <span class="type-icon" style="color:${colors[n.type]}">
                ${icon(n.type === 'source' ? 'file' : n.type === 'scenario' ? 'branch' : 'network')}
              </span>
              <div class="source-card-meta">
                <div class="source-card-title">${esc(n.fullLabel || n.label)}</div>
                <div class="source-card-sub">
                  <span class="source-card-tag" style="color:${colors[n.type]}">${esc(labels[n.type] || 'Nguồn')}</span>
                  ${n.source ? `<span class="source-publisher-badge">${esc(n.source)}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="source-card-desc">${esc(n.desc)}</div>
            ${n.url ? `
              <div class="source-link-action">
                <a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" class="source-link-pill" onclick="event.stopPropagation()">
                  <svg class="ico tiny"><use href="#i-expand"/></svg>
                  <span class="source-link-domain">${esc(domain || 'Mở nguồn gốc')}</span>
                  <span class="source-link-arrow">↗ Mở liên kết</span>
                </a>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } else {
      const n = selectedNode();
      $('#panel-count').textContent = n ? `#${n.id}` : 'Chưa chọn';
      if (!n) {
        area.innerHTML = '<div class="empty">Chọn một node trên đồ thị để xem chi tiết.</div>';
        return;
      }
      const connected = neighbours(n.id).map((id) => s.nodes.find((v) => v.id === id)).filter(Boolean);
      const domain = getDomain(n.url);
      area.innerHTML = `
        <div class="detail">
          <div class="detail-heading">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[n.type]}"></span>
            <strong>${esc(n.fullLabel || n.label)}</strong>
            <span class="type-pill">${esc(labels[n.type])}</span>
          </div>
          <p>${esc(n.desc)}</p>
          ${n.url ? `
            <div class="detail-source-box">
              <div class="detail-source-head">
                <span class="detail-source-badge">NGUỒN THAM CHIẾU GỐC</span>
                <strong>${esc(n.source || domain)}</strong>
              </div>
              <a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer" class="detail-source-link">
                <span class="link-url-text">${esc(n.url)}</span>
                <span class="link-open-pill">↗ Mở liên kết</span>
              </a>
            </div>
          ` : ''}
          <div class="meta">
            <span>Định danh <strong>${esc(n.id.toUpperCase())}</strong></span>
            <span>Liên kết <strong>${connected.length}</strong></span>
            <span>Trạng thái <strong>Sẵn sàng</strong></span>
          </div>
          <div class="refs">
            ${connected.map((v) => `<button class="ref" data-select="${esc(v.id)}">↗ ${esc(v.label)}</button>`).join('')}
          </div>
        </div>
      `;
    }
  }

  function updateUI() {
    updateMetrics();
    updateFilters();
    renderGraph();
    updateInspection();
  }

  function selectNode(id) {
    if (!currentStore().nodes.some((n) => n.id === id)) return;
    currentStore().selected = id;
    inspect = 'details';
    updateInspection();
    renderGraph();
  }

  // ---------------------------------------------------------------------------
  // Adding New Nodes & Running Agent Tasks
  // ---------------------------------------------------------------------------
  function addDataNode() {
    if (!dependenciesState.ready) {
      $('#gate').hidden = false;
      return;
    }

    const s = currentStore();
    const pool = templates[mode];
    const t = pool[s.step % pool.length];
    s.step++;

    const [baseName, type, desc, target] = t;
    const id = (mode === 'research' ? 'rn' : 'an') + s.step;
    const parent = s.nodes.find((n) => n.id === target) || s.nodes[0];
    const angle = s.step * 2.39996;
    const label = baseName + (s.step > pool.length ? ` ${1 + Math.floor(s.step / pool.length)}` : '');

    const node = {
      id,
      label,
      type,
      desc,
      x: parent.x + 75 * Math.cos(angle),
      y: parent.y + 75 * Math.sin(angle),
      vx: 0,
      vy: 0,
      seed: false
    };

    s.nodes.push(node);
    s.links.push({ a: id, b: target });

    if (s.nodes.length > 7) {
      const candidates = s.nodes.filter((n) => n.id !== id && n.type === (type === 'source' ? 'claim' : 'event'));
      if (candidates.length) {
        const dest = candidates[(s.step * 5) % candidates.length];
        if (dest.id !== target) s.links.push({ a: id, b: dest.id });
      }
    }

    // Keep memory clean
    if (s.nodes.length > 36) {
      const oldest = s.nodes.find((n) => !n.seed && n.id !== id);
      if (oldest) {
        s.nodes = s.nodes.filter((n) => n !== oldest);
        s.links = s.links.filter((l) => l.a !== oldest.id && l.b !== oldest.id);
      }
    }

    s.feed.unshift({
      id,
      title: mode === 'research' ? `Phát hiện · ${label}` : `Mô phỏng · ${label}`,
      sub: `${labels[type]} · ${s.links.filter((l) => l.a === id || l.b === id).length} liên kết mới`,
      time: 'Vừa xong',
      type
    });
    s.feed = s.feed.slice(0, 30);

    recentNode = id;
    frames = 80;
    updateUI();

    setTimeout(() => {
      if (recentNode === id) {
        recentNode = '';
        renderGraph();
      }
    }, 1250);
  }

  function startNewSession(topic) {
    activeTopic = topic;
    const s = currentStore();
    s.query = topic;
    s.step = 0;

    const cleanLabel = topic.length > 22 ? topic.slice(0, 21) + '…' : topic;
    const rootId = mode === 'research' ? 'r0' : 'a0';
    const rootType = mode === 'research' ? 'claim' : 'event';
    const rootDesc = mode === 'research'
      ? `Chủ đề nghiên cứu trung tâm: ${topic}`
      : `Điểm can thiệp ban đầu: ${topic}`;

    // Clear old sources & links completely
    s.nodes = [{
      id: rootId,
      label: cleanLabel,
      fullLabel: topic,
      type: rootType,
      desc: rootDesc,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      seed: true,
      number: 1
    }];
    s.links = [];

    // Reset activity feed
    s.feed = [{
      id: rootId,
      title: mode === 'research' ? `Khởi tạo: ${cleanLabel}` : `Điểm can thiệp: ${cleanLabel}`,
      sub: `${labels[rootType]} · Bắt đầu thu thập`,
      time: 'Vừa xong',
      type: rootType
    }];

    s.selected = rootId;
    panX = 0;
    panY = 0;
    scale = fitScale();
    frames = 70;

    const sessionLabel = $('#session-label');
    if (sessionLabel) {
      sessionLabel.textContent = `Phiên mới · ${cleanLabel}`;
    }

    updateUI();
  }

  function resetCurrentGraph() {
    const s = currentStore();
    const queryInput = $('#query');
    const topic = (queryInput && queryInput.value.trim()) || s.query || (mode === 'research' ? 'Nghiên cứu mới' : 'Mô phỏng mới');
    startNewSession(topic);
    showToast('Đã làm mới đồ thị & dọn sạch các nguồn cũ');
  }

  function onRunQuery() {
    if (!dependenciesState.ready) {
      $('#gate').hidden = false;
      return;
    }

    const queryInput = $('#query');
    const value = queryInput ? queryInput.value.trim() : '';
    if (!value) {
      showToast('Hãy nhập chủ đề nghiên cứu hoặc điểm can thiệp');
      return;
    }

    activeTopic = value;

    // Clear old sources and initialize clean graph with new central topic
    startNewSession(value);

    // Notify backend about new session
    try {
      const payload = JSON.stringify({ topic: value, mode: mode });
      const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload };
      if (window.sidecar) {
        window.sidecar.fetch('/api/new-session', opts);
      } else {
        fetch('/api/new-session', opts);
      }
    } catch (_) {}

    // Send command to Antigravity Agent via Sidecar SDK
    if (window.sidecar?.agent?.sendMessage) {
      const prompt = mode === 'research'
        ? `Nghiên cứu sâu (d-research) về chủ đề: "${value}". Cập nhật bằng chứng vào evidence-ledger.jsonl.`
        : `Chạy mô phỏng kịch bản nhân quả (aleph-skill) cho điểm can thiệp: "${value}". Cập nhật timeline.json.`;
      window.sidecar.agent.sendMessage(prompt);
      showToast(`Đã dọn nguồn cũ & gửi yêu cầu ${mode === 'research' ? 'D Research' : 'Aleph'} tới Agent`);
    } else {
      showToast(`Đã dọn nguồn cũ và khởi tạo đồ thị ${mode === 'research' ? 'D Research' : 'Aleph'}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Graph Physics & Pointer Interaction
  // ---------------------------------------------------------------------------
  function world(cx, cy) {
    const r = $('#network').getBoundingClientRect();
    return {
      x: (cx - r.left - width / 2 - panX) / scale,
      y: (cy - r.top - height / 2 - panY) / scale
    };
  }

  function pointerDown(e) {
    const g = e.target.closest('.node');
    if (g) {
      const n = currentStore().nodes.find((node) => node.id === g.dataset.id);
      if (!n) return;
      selectNode(n.id);
      drag = { kind: 'node', id: n.id };
    } else {
      drag = { kind: 'pan', px: e.clientX, py: e.clientY, startX: panX, startY: panY };
    }
    $('#network').setPointerCapture(e.pointerId);
    $('#network').classList.add('dragging');
  }

  function pointerMove(e) {
    if (!drag) return;
    if (drag.kind === 'pan') {
      panX = drag.startX + (e.clientX - drag.px);
      panY = drag.startY + (e.clientY - drag.py);
    } else {
      const n = currentStore().nodes.find((node) => node.id === drag.id);
      if (n) {
        const pos = world(e.clientX, e.clientY);
        n.x = pos.x;
        n.y = pos.y;
        n.vx = n.vy = 0;
        frames = 25;
      }
    }
    renderGraph();
  }

  function pointerUp(e) {
    if (!drag) return;
    drag = null;
    $('#network').classList.remove('dragging');
    try {
      $('#network').releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  function zoom(k) {
    scale = Math.max(0.35, Math.min(2.4, scale * k));
    renderGraph();
  }

  function resizeGraph() {
    const box = $('#network').getBoundingClientRect();
    if (!box.width || !box.height) return;
    const old = width;
    width = box.width;
    height = box.height;
    if (Math.abs(old - width) > 30) scale = fitScale();
    $('#network').setAttribute('viewBox', `0 0 ${width} ${height}`);
    renderGraph();
  }

  function physicsStep() {
    if (!frames || drag?.kind === 'pan') return;
    frames--;

    const s = currentStore();
    const nodes = s.nodes;
    const map = new Map(nodes.map((n) => [n.id, n]));

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (drag?.kind === 'node' && drag.id === n.id) continue;

      let fx = -n.x * 0.00024;
      let fy = -n.y * 0.00024;

      // Repulsion between nodes
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const o = nodes[j];
        const dx = n.x - o.x;
        const dy = n.y - o.y;
        const dist2 = dx * dx + dy * dy + 180;
        fx += (dx / dist2) * 16.5;
        fy += (dy / dist2) * 16.5;
      }

      // Spring tension along links
      for (const l of s.links) {
        const o = l.a === n.id ? map.get(l.b) : (l.b === n.id ? map.get(l.a) : null);
        if (o) {
          const dx = o.x - n.x;
          const dy = o.y - n.y;
          const d = Math.hypot(dx, dy) || 1;
          const force = (d - 90) * 0.0024;
          fx += (dx / d) * force;
          fy += (dy / d) * force;
        }
      }

      n.vx = (n.vx + fx) * 0.84;
      n.vy = (n.vy + fy) * 0.84;
      n.x += n.vx;
      n.y += n.vy;

      n.x = Math.max(-190, Math.min(190, n.x));
      n.y = Math.max(-190, Math.min(190, n.y));
    }

    renderGraph();
  }

  let lastTs = 0;
  function animationLoop(t) {
    if (t - lastTs > 28) {
      physicsStep();
      lastTs = t;
    }
    requestAnimationFrame(animationLoop);
  }

  // ---------------------------------------------------------------------------
  // Event Listeners
  // ---------------------------------------------------------------------------
  function setupEvents() {
    // Mode switcher
    $$('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Live toggle
    $('#live-button').onclick = () => {
      currentStore().live = !currentStore().live;
      updateMetrics();
      showToast(currentStore().live ? 'Đã bật luồng tự động' : 'Đã tạm dừng luồng');
    };

    // Theme button
    $('#theme-button').onclick = () => {
      theme = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
      applyTheme();
    };

    $$('[data-theme-choice]').forEach((b) => {
      b.onclick = () => {
        theme = b.dataset.themeChoice;
        applyTheme();
      };
    });

    // Settings modal
    $('#settings-button').onclick = () => {
      $('#modal').hidden = false;
    };
    $('#modal-close').onclick = () => {
      $('#modal').hidden = true;
    };
    $('#modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') $('#modal').hidden = true;
    });

    // Gatekeeper modal
    $('#gate-recheck').onclick = async () => {
      const ok = await checkDependencies();
      showToast(ok ? 'Tất cả skill đã sẵn sàng' : 'Chưa tìm thấy đủ 2 skill');
    };

    $('#gate-install-btn').onclick = () => {
      if (window.sidecar?.agent?.sendMessage) {
        window.sidecar.agent.sendMessage(
          'Hãy cài đặt 2 skill bắt buộc cho AGY Research Studio: d-research (tại ~/.gemini/config/skills/d-research-skill) và aleph-skill (tại ~/.gemini/config/skills/aleph-skill).'
        );
        showToast('Đã gửi yêu cầu cài đặt tới Agent trong chat');
      } else {
        showToast('Vui lòng mở Antigravity Chat để yêu cầu Agent cài skill');
      }
    };

    // Auto-update switch
    $('#auto-update').onchange = (e) => {
      currentStore().live = e.target.checked;
      updateMetrics();
    };

    // Filters
    $('#filters').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (b) {
        filter = b.dataset.filter;
        updateFilters();
        renderGraph();
      }
    });

    // Inspector tabs
    $$('[data-inspect]').forEach((b) => {
      b.onclick = () => {
        inspect = b.dataset.inspect;
        updateInspection();
      };
    });

    // Node selection from inspector lists
    $('#inspect-content').addEventListener('click', (e) => {
      const b = e.target.closest('[data-select]');
      if (b) selectNode(b.dataset.select);
    });

    // Run query
    $('#run').onclick = onRunQuery;
    $('#query').onkeydown = (e) => {
      if (e.key === 'Enter') onRunQuery();
    };

    // Graph toolbar
    $('#add-node').onclick = () => {
      addDataNode();
      showToast('Đã thêm node mẫu');
    };

    $('#zoom-in').onclick = () => zoom(1.22);
    $('#zoom-out').onclick = () => zoom(0.82);
    $('#zoom-reset').onclick = () => {
      scale = fitScale();
      panX = panY = 0;
      renderGraph();
    };

    $('#expand').onclick = () => {
      $('#shell').classList.toggle('graph-expanded');
      $('#expand').classList.toggle('active');
      setTimeout(resizeGraph, 35);
    };

    // Pointer events for graph
    const network = $('#network');
    network.addEventListener('pointerdown', pointerDown);
    network.addEventListener('pointermove', pointerMove);
    network.addEventListener('pointerup', pointerUp);
    network.addEventListener('pointercancel', pointerUp);

    $('#graph').addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.09 : 0.91);
    }, { passive: false });

    // Resize observer
    new ResizeObserver(resizeGraph).observe($('#graph'));

    // Reset graph button
    const resetBtn = $('#reset-graph');
    if (resetBtn) {
      resetBtn.onclick = resetCurrentGraph;
    }

    // OS & Host Theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme === 'system') applyTheme();
    });

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'theme-change' && theme === 'system') {
        setTimeout(applyTheme, 40);
      }
    });

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $('#modal').hidden = true;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrapping
  // ---------------------------------------------------------------------------
  applyTheme();
  setupEvents();
  updateUI();
  resizeGraph();
  frames = 55;
  requestAnimationFrame(animationLoop);

  // Check dependencies and workspace data
  checkDependencies();
  loadWorkspaceData();

  // Periodic sync with workspace data (evidence-ledger.jsonl / timeline.json)
  autoTimer = setInterval(() => {
    if (!$('#modal').hidden || !dependenciesState.ready) return;
    if (currentStore().live) {
      loadWorkspaceData();
    }
  }, 3500);

})();

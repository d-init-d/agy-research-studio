// Obsidian-style Force-Directed Knowledge Graph Engine (Zero Dependencies)
// High-performance HTML5 Canvas simulation with dynamic node streaming & retina support

export class ObsidianGraph {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.nodes = [];
    this.links = [];
    this.nodeMap = new Map();

    // Simulation settings
    this.options = {
      charge: options.charge || -180,       // Node repulsion force
      linkDistance: options.linkDistance || 55, // Natural spring length
      springStrength: options.springStrength || 0.06,
      gravity: options.gravity || 0.035,   // Center gravity pull
      damping: options.damping || 0.86,     // Velocity friction
      enablePhysics: true,
      ...options
    };

    // Camera viewport (Pan & Zoom)
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isDragging = false;
    this.draggedNode = null;
    this.hoveredNode = null;
    this.dragStart = { x: 0, y: 0 };
    this.alpha = 1.0; // Simulation energy (settles to 0)

    // Palette & Semantic Themes
    this.colors = {
      primary: '#38bdf8',       // Cyan (Verified Primary Sources)
      social: '#c084fc',        // Violet (Social Discussions)
      hub: '#f59e0b',           // Amber (Pivotal Causal Claims)
      fact: '#5fcf94',          // Green (Established Facts)
      err: '#f28b82',           // Red (Blocked / Contradictions)
      counterfactual: '#94a3b8',// Dashed (Counterfactuals)
      linkDefault: 'rgba(155, 155, 165, 0.22)',
      linkActive: 'rgba(56, 189, 248, 0.75)',
      linkContradict: 'rgba(242, 139, 130, 0.65)'
    };

    this.initCanvasSize();
    this.bindEvents();
    this.startLoop();
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width || 408;
    this.height = rect.height || 220;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(this.dpr, this.dpr);
    this.camera.x = this.width / 2;
    this.camera.y = this.height / 2;
  }

  // Set dataset
  setData(nodes, links) {
    this.nodes = [];
    this.links = [];
    this.nodeMap.clear();

    nodes.forEach(n => this.addNode(n, false));
    links.forEach(l => this.addLink(l));
    this.wake(1.0);
  }

  addNode(nodeData, wake = true) {
    if (this.nodeMap.has(nodeData.id)) return this.nodeMap.get(nodeData.id);

    const initialAngle = Math.random() * Math.PI * 2;
    const initialDist = 20 + Math.random() * 60;

    const node = {
      id: nodeData.id,
      label: nodeData.label || nodeData.id,
      type: nodeData.type || 'primary',
      radius: nodeData.radius || 6.5,
      x: nodeData.x !== undefined ? nodeData.x : Math.cos(initialAngle) * initialDist,
      y: nodeData.y !== undefined ? nodeData.y : Math.sin(initialAngle) * initialDist,
      vx: 0,
      vy: 0,
      isNew: nodeData.isNew || false,
      pulse: nodeData.isNew ? 0 : 1,
      ...nodeData
    };

    this.nodes.push(node);
    this.nodeMap.set(node.id, node);

    if (wake) {
      this.wake(0.45);
    }
    return node;
  }

  addLink(linkData) {
    const source = typeof linkData.source === 'string' ? this.nodeMap.get(linkData.source) : linkData.source;
    const target = typeof linkData.target === 'string' ? this.nodeMap.get(linkData.target) : linkData.target;

    if (!source || !target) return;

    const link = {
      source,
      target,
      type: linkData.type || 'default',
      style: linkData.style || 'solid'
    };

    this.links.push(link);
    this.wake(0.3);
  }

  wake(amount = 0.5) {
    this.alpha = Math.max(this.alpha, amount);
  }

  // Physics step
  stepPhysics() {
    if (!this.options.enablePhysics || this.alpha < 0.005) {
      return;
    }

    const dt = 1.0;
    const nodes = this.nodes;
    const links = this.links;

    // 1. Repulsion between all pairs (Coulomb's Law)
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distSq = dx * dx + dy * dy;
        if (distSq === 0) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; distSq = 4; }

        const dist = Math.sqrt(distSq);
        const force = (this.options.charge / distSq) * this.alpha;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (a !== this.draggedNode) { a.vx += fx; a.vy += fy; }
        if (b !== this.draggedNode) { b.vx -= fx; b.vy -= fy; }
      }
    }

    // 2. Spring attraction along links (Hooke's Law)
    for (let k = 0; k < links.length; k++) {
      const { source, target } = links[k];
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const displacement = dist - this.options.linkDistance;
      const force = displacement * this.options.springStrength * this.alpha;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (source !== this.draggedNode) { source.vx += fx; source.vy += fy; }
      if (target !== this.draggedNode) { target.vx -= fx; target.vy -= fy; }
    }

    // 3. Center gravity & Velocity integration
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n === this.draggedNode) continue;

      n.vx -= n.x * this.options.gravity * this.alpha;
      n.vy -= n.y * this.options.gravity * this.alpha;

      n.vx *= this.options.damping;
      n.vy *= this.options.damping;

      n.x += n.vx * dt;
      n.y += n.vy * dt;
    }

    // Energy dissipation
    this.alpha *= 0.985;
  }

  // Draw frame
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    // Center & Zoom viewport
    ctx.translate(this.camera.x, this.camera.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    // 1. Draw Links
    for (let i = 0; i < this.links.length; i++) {
      const { source, target, type, style } = this.links[i];
      const isHighlighted = (source === this.hoveredNode || target === this.hoveredNode);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (type === 'contradict') {
        ctx.strokeStyle = this.colors.linkContradict;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = isHighlighted ? 2.2 : 1.2;
      } else if (style === 'dashed') {
        ctx.strokeStyle = isHighlighted ? this.colors.linkActive : this.colors.linkDefault;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = isHighlighted ? 2 : 1;
      } else {
        ctx.strokeStyle = isHighlighted ? this.colors.linkActive : this.colors.linkDefault;
        ctx.setLineDash([]);
        ctx.lineWidth = isHighlighted ? 2 : 1;
      }

      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 2. Draw Nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      const isHovered = (node === this.hoveredNode);
      const isConnected = this.hoveredNode ? this.links.some(l => (l.source === node && l.target === this.hoveredNode) || (l.target === node && l.source === this.hoveredNode)) : true;

      const nodeColor = this.colors[node.type] || this.colors.primary;
      const opacity = this.hoveredNode ? (isHovered || isConnected ? 1 : 0.25) : 1;

      ctx.save();
      ctx.globalAlpha = opacity;

      // Dynamic radar ripple pulse for newly ingested nodes
      if (node.isNew) {
        node.pulse = (node.pulse + 0.025) % 1;
        const ringRadius = node.radius + node.pulse * 18;
        const ringAlpha = (1 - node.pulse) * 0.7 * opacity;

        ctx.beginPath();
        ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = nodeColor;
        ctx.globalAlpha = ringAlpha;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.globalAlpha = opacity;
      }

      // Hover halo ring
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.globalAlpha = 0.25;
        ctx.fill();
        ctx.globalAlpha = opacity;
      }

      // Main Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // Counterfactual dashed stroke
      if (node.type === 'counterfactual') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Node label
      if (node.radius >= 6 || isHovered) {
        ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Text stroke backdrop for legibility
        ctx.strokeStyle = 'rgba(20, 20, 24, 0.85)';
        ctx.lineWidth = 3;
        ctx.strokeText(node.label, node.x, node.y + node.radius + 3);

        ctx.fillStyle = isHovered ? '#ffffff' : (this.hoveredNode ? '#cbd5e1' : '#94a3b8');
        ctx.fillText(node.label, node.x, node.y + node.radius + 3);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // Animation Loop
  startLoop() {
    const loop = () => {
      this.stepPhysics();
      this.render();
      this.animationFrame = requestAnimationFrame(loop);
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  // Coordinate transforms
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.camera.x) / this.camera.zoom,
      y: (screenY - this.camera.y) / this.camera.zoom
    };
  }

  findNodeAt(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = n.x - world.x;
      const dy = n.y - world.y;
      if (dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5)) {
        return n;
      }
    }
    return null;
  }

  bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.x;
      const mouseY = e.clientY - rect.y;

      const hit = this.findNodeAt(mouseX, mouseY);
      if (hit) {
        this.draggedNode = hit;
        this.wake(0.8);
      } else {
        this.isDragging = true;
        this.dragStart = { x: mouseX - this.camera.x, y: mouseY - this.camera.y };
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.x;
      const mouseY = e.clientY - rect.y;

      if (this.draggedNode) {
        const world = this.screenToWorld(mouseX, mouseY);
        this.draggedNode.x = world.x;
        this.draggedNode.y = world.y;
        this.draggedNode.vx = 0;
        this.draggedNode.vy = 0;
        this.wake(0.4);
      } else if (this.isDragging) {
        this.camera.x = mouseX - this.dragStart.x;
        this.camera.y = mouseY - this.dragStart.y;
      } else {
        const hit = this.findNodeAt(mouseX, mouseY);
        if (hit !== this.hoveredNode) {
          this.hoveredNode = hit;
          this.canvas.style.cursor = hit ? 'pointer' : 'default';
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.draggedNode = null;
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.camera.zoom = Math.max(0.4, Math.min(3.0, this.camera.zoom * zoomFactor));
    }, { passive: false });

    window.addEventListener('resize', () => {
      this.initCanvasSize();
    });
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
  }
}

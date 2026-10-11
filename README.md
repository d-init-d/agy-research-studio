# AGY Research Studio 🌐🔍

[![Antigravity UI Extension](https://img.shields.io/badge/Antigravity-UI%20Extension-blue?style=flat-square)](https://github.com/d-init-d/agy-research-studio)
[![Plugin](https://img.shields.io/badge/Plugin-agy--research--studio-cyan?style=flat-square)](https://github.com/d-init-d/agy-research-studio)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=flat-square)](LICENSE)

**AGY Research Studio** is an official **Antigravity UI Extension** that renders a sleek, high-density auxiliary side panel next to your conversations. It brings an interactive **Obsidian-style Force-Directed Knowledge Graph** and visual cockpit to:
1. **D-Research:** Autonomous deep web research, source discovery, and cryptographic evidence ledgers (Tiers R0–R4).
2. **Aleph Simulation:** Causal DAG modeling, counterfactual timeline branching, and Monte Carlo scenario projections.

---

## ✨ Key Features

### 1. 🛡️ Dependency Gatekeeper
- Automatically inspects `~/.gemini/config/skills/` on boot for prerequisites:
  - `d-research` (Evidence crawler)
  - `aleph-skill` (Causal simulation engine)
- If missing, displays an intuitive locked verification screen with a one-click **"Auto-Install via Agent"** button.

### 2. 🕸️ Obsidian-Style Dynamic Knowledge Graph
- **Zero-Dependency Physics Engine:** High-performance HTML5 Canvas simulation with Coulomb repulsion, Hooke springs, and damping.
- **Real-Time Streaming Ingestion:** As the agent uncovers links from arXiv, GitHub, or SEC filings, new nodes dynamically spawn with an animated **radar ripple pulse** ring.
- **Interactive:** Full drag-and-drop, zoom in/out, panning, and hover inspection.
- **Categorized Color Coding:**
  - 🔵 **Cyan (`#38bdf8`):** Verified primary sources (academic papers, official filings).
  - 🟣 **Violet (`#c084fc`):** Social & community discourse (GitHub discussions, Discord, X/Bluesky).
  - 🟡 **Gold (`#f59e0b`):** Key causal hubs and core entities.
  - 🟢 **Emerald (`#5fcf94`):** Verified factual claims (`fact`).
  - 🔴 **Rose (`#f28b82`):** Blocked sources (403/captcha) or contradictions.

### 3. 📑 Deep Research Cockpit
- Real-time dual-track monitoring: **Documentary Stream** vs. **Social & Community Stream**.
- Source tally metrics (`read`, `reading`, `blocked`).
- Live chronological feed with tier pills (`R0`, `R1`, `R2`, `R3`).

### 4. ⏳ Causal Timeline & What-If Branching
- Interactive branch likelihood selectors (Branch A: 54%, Branch B: 31%, Branch C: 15%).
- Epistemological node taxonomy (`fact`, `inference`, `assumption`, `simulation`, `counterfactual`).
- One-click scenario dispatch directly to the Antigravity Agent.

### 5. 🌗 100% Native Antigravity Theming
- Fully synchronized with Antigravity IDE's theme tokens (`--background`, `--card`, `--border`, `--foreground`, `--primary`).
- Effortlessly switches between **Dark Mode** (Obsidian) and **Light Mode** without reloading.

---

## 🚀 Installation & Usage

### 1. Clone into Antigravity Plugins Directory
Clone this repository directly into your local Antigravity configuration directory:

```bash
# macOS / Linux:
git clone https://github.com/d-init-d/agy-research-studio.git ~/.gemini/config/plugins/agy-research-studio

# Windows (PowerShell):
git clone https://github.com/d-init-d/agy-research-studio.git "$env:USERPROFILE\.gemini\config\plugins\agy-research-studio"
```

### 2. Enable in Antigravity
1. Open **Antigravity IDE**.
2. Navigate to the **Customizations** page from the left sidebar and select the **Installed** tab.
3. Locate **AGY Research Studio** and click **Enable**. The background Node.js sidecar starts automatically.

### 3. Open the Side Pane
In any conversation:
- Click the **⋮ (three-dot menu)** in the top right corner $\rightarrow$ **Extensions** $\rightarrow$ select **Research Studio**.
- Or click the agent's shortcut link: `[Open Studio](sidecar://agy-research-studio/panel/)`.

---

## 📂 Project Architecture

```text
agy-research-studio/
├── plugin.json                  # Antigravity plugin manifest & logo declaration
├── assets/
│   └── logo.svg                 # Vector logo displayed in Customizations UI
├── rules/
│   └── AGENTS.md                # Agent routing rules & pill generation instructions
└── sidecars/
    └── panel/                   # UI extension process supervised by Antigravity
        ├── sidecar.json         # Sidecar manifest (has_web_ui: true)
        ├── package.json         # ES module configuration
        ├── main.mjs             # Node.js backend using built-in Sidecar SDK
        ├── index.html           # Side pane frontend markup
        ├── styles.css           # Theme-aware styles with Antigravity CSS tokens
        ├── app.js               # Frontend controller & Agent bridge
        └── graph.js             # Canvas Force-Directed Knowledge Graph Engine
```

---

## 🛠️ Technology Stack

- **Host Runtime:** Google Antigravity Sidecar SDK (`sidecar_sdk`)
- **Backend:** Node.js (Bundled with Antigravity, 0 external npm dependencies required)
- **Frontend:** Vanilla HTML5, Modern CSS Variables, ES Modules
- **Graph Visualization:** Custom HTML5 Canvas Force-Directed Simulation Engine

---

## 📄 License

MIT License. Designed with care for the Antigravity and Gemini developer community.

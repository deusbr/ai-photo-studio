# ai-photo-studio

[![CI](https://github.com/deusbr/ai-photo-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/deusbr/ai-photo-studio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](package.json)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

Zero-dependency **8-Agent Essence-Driven AI Photo Studio (v4.0)** for **OpenBot**, **Codex**, **Gemini CLI**, and **Claude Code / Claude Desktop** — combining visual essence extraction, a **curated + live-web photography research engine**, **posing geometry**, **cinema cameras & film emulsions**, **prime/anamorphic lenses**, **optical diffusion filters**, **editorial makeup science**, and **motivated cinematography lighting** without canned AI clichés.

Built to run **Subscription-First** (zero API keys required) on your existing AI plan, with optional BYOK execution (`GEMINI_API_KEY` / `OPENAI_API_KEY` / `COMFYUI_URL`) when configured.

---

## What's New in v4.0

- **Hybrid Craft Research Engine (`studio_research_craft` / `ai-photo-studio research`):** Bilingual (`PT-BR` / `EN`) search across a built-in master encyclopedia + optional live public web lookup (with local 24h cache) covering **poses**, **cameras/films**, **lenses**, **optical effects**, **editorial makeup**, and **lighting rigs**.
- **Intelligent Look Composer & Optical Guardrails (`studio_compose_look`):** Automatically recommends or overrides `poseId`, `cameraId`, `lensId`, `effectIds`, `makeupId`, and `lightingId` with real-world conflict warnings (e.g., warning against `24mm` distortion on close beauty portraits, respecting `keepPose` locks, and stripping human skin/makeup terms on `product` shoots).
- **10 Production Presets (3 New Cinematic & Beauty Looks):** Added **`cinema-trailer`** (ARRI Alexa 35 + 40mm Cooke Anamorphic 2.39:1 + Black Pro-Mist 1/4 + Teal/Amber grade), **`high-fashion-beauty`** (Hasselblad X2D + 105mm f/1.4 + Butterfly Beauty Dish + Editorial Glass Skin), and **`street-flash-editorial`** (Contax T2 + Portra 800 + Axial Direct Flash).
- **5 Prompt Engines:** Compiles `codexPrompt`, `geminiPrompt`, `claudeComfyPrompt`, **`midjourneyFluxPrompt`**, and `universalJsonSpec` (`v4.0.0`) with end-weighted `STRICT PRESERVATION RULE`.
- **Full MCP Protocol Support:** 18 MCP tools, MCP **Resources** (`studio://catalog/*`, `studio://playbook`), MCP **Prompts** (`cinema-trailer-shoot`, `editorial-beauty-shoot`, `autonomous-essence-shoot`), and dual `NDJSON` + `Content-Length` stdio framing.

---

## Operating Modes

1. **Autonomous Mode (`auto` / `studio_run_autonomous`):**
   Drop **only a photo** with zero instructions. Tall mobile screenshots are auto-cropped (`anchor_clean`) to strip UI bars; the Showrunner & Forensic Analyst triage the image, generate **3 curated creative proposals**, run the full 8-specialist crew pipeline, and compile prompts for all 5 engines immediately.
2. **Directed Mode (`direct` / `studio_run_directed`):**
   Give **exact art direction orders**. A bilingual (`EN` / `PT-BR`) intent classifier detects your **Intervention Scope** (`subtle-retouch`, `targeted-edit`, `full-editorial`), locks immutable attributes (`keepPose`, `keepWardrobe`, `keepBackground`, `keepFraming`), and matches the optimal craft stack.
3. **Multi-Shot Photo Essay Mode (`essay` / `studio_run_essay`):**
   Plan and compile a cohesive **2–6 shot editorial storyboard** varying focal lengths, poses, and camera angles while locking identity and garment micro-details across every frame.

Optional `--analyze` / `studio_analyze_photo` runs standalone BYOK vision extraction (`GEMINI_API_KEY` or `OPENAI_API_KEY`) when running outside an AI host.

---

## The 8-Specialist Studio Crew

| # | Agent Handle | Role ID | Responsibility |
| :--- | :--- | :--- | :--- |
| 1 | **Diretor de Ensaio** | `showrunner-director` | Mode routing (`autonomous` / `directed`), scope classification, and production mandate. |
| 2 | **Analista Forense** | `forensic-analyst` | 5-axis technical photo audit + **Visual Anti-Inertia** rules. |
| 3 | **Guardião de Consistência** | `consistency-guardian` | Biometric/product anchoring, `expressionTruth`, `garmentMicroDetails` (logos/patches/stripes), `antiBeautificationLocks`, and **Zero-Invention Policy**. |
| 4 | **Diretor de Arte & Styling** | `art-stylist` | Extracts `essenceAnalysis` first, then designs world-building, **pose geometry** (*contrapposto*, *turtle jawline*, *edge-of-hand*), **editorial makeup/grooming**, and foreground depth layering. |
| 5 | **Especialista em Iluminação** | `lighting-director` | Architects physically motivated light sources, contrast ratios (`2:1`–`8:1`), negative fill shadow sculpting, Kelvin separation, and iris catchlights. |
| 6 | **Câmera & Lentes** | `camera-optics` | Specifies camera body/emulsion, prime/anamorphic focal compression, **optical filters** (*Black Pro-Mist*, *Glimmerglass*, *Halation*), and melanin-safe sub-surface skin color science. |
| 7 | **Editor Master** | `prompt-editor` | Compiles `codexPrompt`, `geminiPrompt`, `claudeComfyPrompt`, `midjourneyFluxPrompt`, `universalJsonSpec`, and `revisionDeltaPrompt`. |
| 8 | **Auditor Anti-IA & Realismo** | `anti-ai-auditor` | 8-axis Anti-Slop & Garment QA gatekeeper (`pass` / `revise`) with targeted **Correction Routing** and Asset Lineage (`v1 -> v2 -> v3`). |

---

## Quick Start

### 1. Install MCP + Skill across Codex, Gemini CLI, and Claude
```bash
node bin/ai-photo-studio.cjs install
node bin/ai-photo-studio.cjs status
```

### 2. Research Techniques & Browse Craft Catalog
```bash
# Research poses, lenses, filters, makeup, or cinema trailer looks (curated + live web)
node bin/ai-photo-studio.cjs research "cinema trailer anamorphic black pro-mist"

# Browse curated catalog categories
node bin/ai-photo-studio.cjs catalog poses
node bin/ai-photo-studio.cjs catalog makeup
```

### 3. Run Autonomous, Directed, or Essay Mode from the CLI
```bash
# Autonomous: drop a photo and let the 8-agent crew decide + propose 3 concepts
node bin/ai-photo-studio.cjs auto ./photo.jpg

# Directed (Cinema Trailer): anamorphic 2.39:1 + Vision3 500T + Pro-Mist 1/4
node bin/ai-photo-studio.cjs direct ./photo.jpg --preset cinema-trailer --brief "Rainy neon street cinema trailer frame"

# Directed (Custom Craft Overrides): pick exact pose, lens, effect, and makeup
node bin/ai-photo-studio.cjs direct ./photo.jpg --preset high-fashion-beauty --pose turtle-jawline-power --lens 105mm-f14-sigma --makeup editorial-glass-skin --effect black-pro-mist-1-8 --brief "High-fashion beauty close-up"

# Multi-Shot Essay: plan 5 varied shots from one photo
node bin/ai-photo-studio.cjs essay ./photo.jpg --count 5
```

### 4. Launch the Local Web Studio Workbench
```bash
node bin/ai-photo-studio.cjs web --port 4321
```
Open `http://127.0.0.1:4321` to switch between **Autonomous**, **Directed Orders**, and **Essay 5x**, use the **Craft Studio & Live Technique Researcher**, toggle **Codex / Gemini / Claude / Flux-Midjourney / JSON** prompt tabs, compare **Anchor / v1 / v2** with the interactive slider, and submit **Anti-AI QA** scorecards.

### 5. MCP Interface (`bin/mcp-server.cjs`)
- **18 Tools:** `studio_list_crew`, `studio_create_job`, `studio_run_autonomous`, `studio_run_directed`, `studio_run_essay`, `studio_analyze_photo`, `studio_select_proposal`, `studio_save_crew_pass`, `studio_compile_prompts`, `studio_execute_render`, `studio_register_render`, `studio_submit_qa`, `studio_get_job`, `studio_list_jobs`, `studio_start_web`, **`studio_research_craft`**, **`studio_list_craft_catalog`**, **`studio_compose_look`**.
- **Resources:** `studio://catalog/poses`, `studio://catalog/cameras`, `studio://catalog/lenses`, `studio://catalog/effects`, `studio://catalog/makeup`, `studio://catalog/lighting`, `studio://catalog/presets`, `studio://playbook`.
- **Prompts:** `cinema-trailer-shoot`, `editorial-beauty-shoot`, `autonomous-essence-shoot`.

---

## Development & Tests

```bash
npm run check
npm test
```

## License

MIT — see [`LICENSE`](LICENSE).

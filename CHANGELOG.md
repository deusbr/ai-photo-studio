# Changelog

All notable changes to `ai-photo-studio` are documented in this file.

## [Unreleased — Trilha Rápida P1+P2+P4] - 2026-11-25

### Security & Hardening (P1)
- **Local Web Studio (`lib/studio-web.cjs`):** Added loopback `Host` validation (anti-DNS rebinding), `Origin`/`Sec-Fetch-Site` enforcement, strict `application/json` media-type checks (`415`), per-session constant-time `X-Studio-Token` CSRF defense (with `AI_PHOTO_STUDIO_REQUIRE_TOKEN` strict mode), rotating per-response CSP nonces on HTML, and default-deny CSP + security headers on API/assets.
- **Structural Image Validation (`lib/image-meta.cjs`, `lib/store.cjs`):** Removed insecure extension-only fallback; enforced structural header verification for PNG (`IHDR`), JPEG (SOF markers), and WebP (`VP8`/`VP8L`/`VP8X`), canonical on-disk asset extensions derived from parsed bytes, and real binary MIME serving.
- **State, Essay & CLI Fixes (`lib/orchestrator.cjs`, `lib/store.cjs`, `bin/ai-photo-studio.cjs`):** Added allowlisted `mergeCraftOptions` with explicit `null`/empty reset semantics, preserved locks/preset/craft/research across `applyVisionAnalysis`, connected `activeRenderVersion` rollback to `submitQa`, compiled all 5 engines per Essay frame, upgraded Web UI to 8-Point QA (`framingScore`), multi-effect checkboxes, toast feedback, and strict CLI option/port validation with pre-pipeline `--analyze`.

### MCP Next-Gen & Glama Packaging (P2)
- **Protocol & Transport (`bin/mcp-server.cjs`):** Added `protocolVersion` negotiation (`2025-06-18`, `2025-03-26`, `2024-11-05`), `ping`, JSON-RPC `-32700` parse errors, unbounded multi-chunk `Content-Length` parsing, and opt-in `MCP_RESPONSE_FRAMING=content-length`.
- **Multimodal & Sampling:** Added `ToolAnnotations` across all 18 tools, `structuredContent` responses, bounded `type: "image"` content blocks (`includeImage`), bidirectional `sampling/createMessage` for subscription-first vision analysis, `researchQuery` resolution in `studio_run_essay`, and safe `studio_start_web` port restart (without exposing `sessionToken`).
- **Docker / Glama Readiness:** Added hardened non-root `node:24-alpine` `Dockerfile` and `.dockerignore`.

### Prompt Compiler v5, ComfyUI & Ollama (P4)
- **Prompt Compiler v5 (`lib/crew.cjs`):** Added separated `positivePrompt`/`negativePrompt`, affirmative `fluxPrompt`, native `midjourneyPrompt` (`--style raw --no`), deduplicated guards, sanitized `researchHighlights` injection, and importable `comfyWorkflow` JSON graph generation.
- **Resilient Executors & Local Vision (`lib/executors.cjs`, `lib/craft-research.cjs`):** Added `AbortController` timeouts, safe JSON/Markdown extraction, real ComfyUI `/upload/image` + `/prompt` + `/history` + `/view` execution (including clean queued-job handling in MCP & Web), local `OLLAMA_URL` vision provider, and collision-free atomic research cache writes for Windows.

## [4.0.0] - 2026-11-23

### Added
- **Curated Craft Encyclopedia (`lib/craft-library.cjs`):** 12 posing mechanics (*contrapposto*, *turtle jawline*, *edge-of-hand*, *negative-space triangles*, *over-shoulder cinema*, *couple zero-overlap*, *product plinth/flat-lay*), 8 camera/film stocks (*Hasselblad X2D + Portra 400*, *ARRI Alexa 35 + Vision3 500T*, *Leica M6 + CineStill 800T*, *Phase One IQ4 150MP*, *Fujifilm GFX 100 II*), 9 lenses (`24mm`–`135mm`, `40mm Cooke Anamorphic`, `90mm Macro Tilt-Shift`), 10 optical filters/effects (*Black Pro-Mist 1/8 & 1/4*, *Glimmerglass 1/4*, *Anamorphic Flare*, *Volumetric Haze*, *Teal & Amber Grade*), 8 editorial makeup/grooming finishes, and 8 lighting rigs.
- **Hybrid Technique Research (`lib/craft-research.cjs`):** Bilingual (`PT-BR`/`EN`) search across the curated catalog + live Wikipedia & DuckDuckGo lookup with a 24h local cache.
- **Smart Look Composer & Guardrails (`lib/craft-planner.cjs`):** Automatic craft stack recommendation (`studio_compose_look`) with optical distortion warnings (e.g., `24mm` on tight beauty close-ups), `keepPose` lock enforcement, and automatic stripping of human skin/makeup terms on `product` shoots.
- **3 New Presets & 5th Prompt Engine:** Added `cinema-trailer` (`2.39:1` anamorphic), `high-fashion-beauty`, `street-flash-editorial`, and `midjourneyFluxPrompt`.
- **Full MCP v4 Surface (`bin/mcp-server.cjs`):** Expanded to 18 tools, 8 MCP Resources (`studio://catalog/*`, `studio://playbook`), 3 MCP Prompts, and dual `NDJSON` + `Content-Length` stdio framing.
- **Web Workbench & CLI Upgrades:** Added `research` & `catalog` CLI commands, `--pose/--camera/--lens/--effect/--makeup/--lighting/--research` flags, and interactive Craft Studio + Live Researcher panel in the Web UI.

### Fixed
- Refined `parseDirectedIntent` in `lib/orchestrator.cjs` so descriptive words like `"subtle"` inside a `full-editorial` brief no longer trigger unintended `subtle-retouch` pose locks.
- Prevented duplicate `"Shot on Shot on ..."` prefixing in `codexPrompt` when camera snippets already begin with `"Shot on"`.

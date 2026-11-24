# Changelog

All notable changes to `ai-photo-studio` are documented in this file.

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

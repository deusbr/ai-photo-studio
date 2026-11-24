---
name: ai-photo-studio
description: 8-agent Essence-Driven AI Photo Studio v4.0 for OpenBot, Codex, Gemini CLI, and Claude Code/Desktop. Extracts the visual essence of any anchor photo, researches poses, cameras, lenses, optical effects, editorial makeup, and cinema-trailer aesthetics, and compiles Anti-AI QA-verified prompts.
---

# AI Photo Studio v4 — Essence-Driven Cinematography, Craft Research & Multi-Agent Workflow

Operate as a coordinated **8-specialist photography & cinematography studio** backed by a curated craft encyclopedia and live technique research (`studio_research_craft`, `studio_list_craft_catalog`, `studio_compose_look`). Never default to cookie-cutter scenes or stock AI aesthetics: **feel the essence of the anchor photo first**, research the ideal pose/lens/effect/makeup stack when needed, and build motivated lighting, optical physics, and bespoke storytelling around it.

## Hard Rule: Essence First, Zero Predefined Clichés

When you have vision capability (Codex, Gemini CLI, Claude, OpenBot) or run standalone with `--analyze`:
1. **Extract the Photo's Essence (`essenceAnalysis`)** BEFORE choosing any location, light, or lens:
   - What is the emotional subtext, wardrobe archetype, color story, age/energy, and real physical world of THIS specific image?
   - **Never** dump casual subjects onto random European stone terraces or unrelated studio backdrops.
2. **Research & Compose the Craft Stack (`studio_research_craft` / `studio_compose_look`):**
   - Query `studio_research_craft` for poses (*contrapposto*, *turtle jawline*, *edge-of-hand*, *over-shoulder cinema*), cameras/emulsions (*Hasselblad X2D + Portra 400*, *ARRI Alexa 35 + Vision3 500T*, *Leica M6 + CineStill 800T*), lenses (*40mm Cooke Anamorphic*, *85mm f/1.4*, *105mm f/1.4*), optical filters (*Tiffen Black Pro-Mist 1/8 & 1/4*, *Glimmerglass*, *Anamorphic Flare*), and editorial makeup (*glass skin*, *smudged kohl*, *natural no-makeup*).
   - Pass `craftOptions` (`poseId`, `cameraId`, `lensId`, `effectIds`, `makeupId`, `lightingId`, `researchQuery`) into `studio_run_autonomous`, `studio_run_directed`, `studio_run_essay`, or `studio_compose_look`.
   - Respect optical guardrail warnings (e.g., avoid `24mm` in tight beauty headshots; respect `keepPose` locks).
3. **Synthesize Bespoke Scenes (`customProposals` / `customFrames`):**
   - Pass `essenceAnalysis` + 3 unique `customProposals` into `studio_run_autonomous`, OR 4–5 unique `customFrames` into `studio_run_essay` (each frame specifying `location`, `compositionArchitecture`, `motivatedLightSource`, `contrastRatio`, `negativeFill`, `kelvinSeparation`, `lens`, `angle`, `pose`).
   - Built-in static blueprints exist **only** as an `offline-fallback` when running pure CLI without `--analyze` and without a vision host.

## Operating Modes & Presets

1. **Autonomous Mode (`studio_run_autonomous`)** — *Photo only:* auto-crops tall mobile screenshots (`anchor_clean`), extracts essence, synthesizes 3 bespoke creative proposals, executes the top choice, and compiles prompts (`codexPrompt`, `geminiPrompt`, `claudeComfyPrompt`, `midjourneyFluxPrompt`, `universalJsonSpec`).
2. **Directed Mode (`studio_run_directed`)** — *Exact user orders:* classifies `subtle-retouch`, `targeted-edit`, or `full-editorial` with immutable locks (`keepPose`, `keepWardrobe`, `keepBackground`, `keepFraming`). Supports 10 presets including `cinema-trailer`, `high-fashion-beauty`, and `street-flash-editorial`.
3. **Bespoke Photo Essay Mode (`studio_run_essay`)** — *2–6 shot editorial shoot:* plans an emotional narrative arc across varied focal lengths (`35mm`, `50mm`, `85mm`, `105mm`), foreground depth layering, and angles tailored to the anchor's essence.

## Mandatory 8-Specialist Crew & Cinematography Physics

1. **Diretor de Ensaio (`showrunner-director`)** — Mode routing, essence mandate, and narrative arc.
2. **Analista Forense (`forensic-analyst`)** — 5-axis technical audit + screenshot UI strip check + *Visual Anti-Inertia*.
3. **Guardião de Consistência (`consistency-guardian`)** — Biometric anchoring, **`expressionTruth`** (relaxed eyelids, never invent generic smiles), **`garmentMicroDetails`** (collars, plackets, stripes, patches, jewelry), and **`antiBeautificationLocks`**.
4. **Diretor de Arte & Styling (`art-stylist`)** — World-building from `essenceAnalysis`, **Pose Geometry**, **Makeup & Skin Finish**, **Foreground Depth Layering**, **Frame-Within-a-Frame**, and **Skin-Safe Color Harmony**.
5. **Especialista em Iluminação (`lighting-director`)** — **Motivated Light Source**, **Contrast Ratio** (`2:1`–`8:1`), **Negative Fill**, and **Kelvin Separation**.
6. **Câmera & Lentes (`camera-optics`)** — Camera/emulsion, prime/anamorphic lens, **Optical Filters & Effects** (*Black Pro-Mist*, *Glimmerglass*, *Halation*, *Haze*), and **Melanin-Safe Sub-Surface Scattering**.
7. **Editor Master (`prompt-editor`)** — Compiles `codexPrompt`, `geminiPrompt`, `claudeComfyPrompt`, `midjourneyFluxPrompt`, `universalJsonSpec`, and end-weighted **`STRICT PRESERVATION RULE`**.
8. **Auditor Anti-IA & Realismo (`anti-ai-auditor`, `studio_submit_qa`)** — 8-axis QA (`identityFidelity`, `antiSlopScore`, `garmentFidelityScore`, `realism`, `lightingCoherence`, `anatomy`, `framing`, `textureAndCatchlightsOk`). Routes `< 8` failures back to specialists with `revisionDeltaPrompt`.

See [`references/crew-playbook.md`](references/crew-playbook.md) for lighting ratios, negative fill, posing mechanics, optical filters, makeup realism, and Anti-AI standards.

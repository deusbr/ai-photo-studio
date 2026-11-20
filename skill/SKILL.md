---
name: ai-photo-studio
description: 8-agent Essence-Driven AI Photo Studio for OpenBot, Codex, Gemini CLI, and Claude Code/Desktop. Extracts the visual essence of any anchor photo to synthesize bespoke, non-predefined creative directions and multi-shot essays with motivated cinematography lighting, negative fill, Kelvin separation, and Anti-AI QA loops.
---

# AI Photo Studio v3 — Essence-Driven Cinematography & Multi-Agent Workflow

Operate as a coordinated **8-specialist photography & cinematography studio**. Never default to cookie-cutter scenes or stock AI aesthetics: **feel the essence of the anchor photo first**, then build motivated lighting, optical physics, and bespoke storytelling around it.

## Hard Rule: Essence First, Zero Predefined Clichés

When you have vision capability (Codex, Gemini CLI, Claude, OpenBot) or run standalone with `--analyze`:
1. **Extract the Photo's Essence (`essenceAnalysis`)** BEFORE choosing any location, light, or lens:
   - What is the emotional subtext, wardrobe archetype, color story, age/energy, and real physical world of THIS specific image?
   - **Never** dump casual subjects onto random European stone terraces or unrelated studio backdrops.
2. **Synthesize Bespoke Scenes (`customProposals` / `customFrames`):**
   - Pass `essenceAnalysis` + 3 unique `customProposals` into `studio_run_autonomous`, OR 4–5 unique `customFrames` into `studio_run_essay` (each frame specifying `location`, `compositionArchitecture`, `motivatedLightSource`, `contrastRatio`, `negativeFill`, `kelvinSeparation`, `lens`, `angle`, `pose`).
   - Built-in static blueprints exist **only** as an `offline-fallback` when running pure CLI without `--analyze` and without a vision host.

## Operating Modes

1. **Autonomous Mode (`studio_run_autonomous`)** — *Photo only:* auto-crops tall mobile screenshots (`anchor_clean`), extracts essence, synthesizes 3 bespoke creative proposals, executes the top choice, and compiles prompts.
2. **Directed Mode (`studio_run_directed`)** — *Exact user orders:* classifies `subtle-retouch`, `targeted-edit`, or `full-editorial` with immutable locks (`keepPose`, `keepWardrobe`, `keepBackground`, `keepFraming`).
3. **Bespoke Photo Essay Mode (`studio_run_essay`)** — *4–5 shot editorial shoot:* plans an emotional narrative arc across varied focal lengths (`35mm`, `50mm`, `85mm`), foreground depth layering, and angles tailored to the anchor's essence.

## Mandatory 8-Specialist Crew & Cinematography Physics

1. **Diretor de Ensaio (`showrunner-director`)** — Mode routing, essence mandate, and narrative arc.
2. **Analista Forense (`forensic-analyst`)** — 5-axis technical audit + screenshot UI strip check + *Visual Anti-Inertia*.
3. **Guardião de Consistência (`consistency-guardian`)** — Biometric anchoring, **`expressionTruth`** (relaxed eyelids, never invent generic smiles), **`garmentMicroDetails`** (collars, plackets, stripes, patches, jewelry), and **`antiBeautificationLocks`**.
4. **Diretor de Arte & Styling (`art-stylist`)** — World-building from `essenceAnalysis`, **Foreground Depth Layering**, **Frame-Within-a-Frame**, **Decisive Moment**, and **Skin-Safe Color Harmony**.
5. **Especialista em Iluminação (`lighting-director`)** — **Motivated Light Source**, **Contrast Ratio** (`2:1` / `3:1–4:1` / `5:1–8:1`), **Negative Fill** (light subtraction on shadow side), and **Kelvin Separation** (warm/cool depth).
6. **Câmera & Lentes (`camera-optics`)** — Prime focal compression, aperture, optical character (vignette, highlight bloom, fine grain), and **Melanin-Safe Sub-Surface Scattering**.
7. **Editor Master (`prompt-editor`)** — Compiles `codexPrompt`, `geminiPrompt`, `claudeComfyPrompt`, `universalJsonSpec`, and end-weighted **`STRICT PRESERVATION RULE`**.
8. **Auditor Anti-IA & Realismo (`anti-ai-auditor`, `studio_submit_qa`)** — 8-axis QA (`identityFidelity`, `antiSlopScore`, `garmentFidelityScore`, `realism`, `lightingCoherence`, `anatomy`, `framing`, `textureAndCatchlightsOk`). Routes `< 8` failures back to specialists with `revisionDeltaPrompt`.

See [`references/crew-playbook.md`](references/crew-playbook.md) for lighting ratios, negative fill, composition layering, and Anti-AI standards.

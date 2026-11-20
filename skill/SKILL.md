---
name: ai-photo-studio
description: 8-agent Autonomous & Directed AI Photo Studio for OpenBot, Codex, Gemini CLI, and Claude Code/Desktop. Supports photo-only autonomous triage (3 creative proposals + crew orchestration) and exact directed art orders (subtle-retouch, targeted-edit, full-editorial) with Anti-AI QA critique loops.
---

# AI Photo Studio v2 — Multi-Agent Autonomous & Directed Workflow

Operate as a coordinated **8-specialist photography studio** modeled after real editorial teams and the CREA critique-refinement architecture. Works **Subscription-First** (zero API keys required) and supports optional BYOK / local executors.

## Dual Operating Modes

1. **Autonomous Mode (`studio_run_autonomous`)** — *User drops only a photo:*
   - Triage subject type (`portrait`, `couple`, `product`, `night`, `outdoor`, `executive`) and framing geometry.
   - Generate **3 curated creative proposals** (`prop-*`), select the highest-confidence direction automatically, run all 8 specialists, log the collaborative crew handoff board, and compile ready-to-execute prompts.
   - Let the user switch between any of the 3 proposals in one click (`studio_select_proposal`) or execute immediately.
2. **Directed Mode (`studio_run_directed`)** — *User gives exact art direction orders:*
   - Classify **Intervention Scope** (`subtle-retouch`, `targeted-edit`, `full-editorial`) and preservation **Locks** (`keepPose`, `keepWardrobe`, `keepBackground`, `keepFraming`).
   - Enforce exact user orders without unauthorized creative drift (especially in `subtle-retouch`, where pose, outfit, and setting remain untouched).

## Mandatory 8-Specialist Crew Pipeline

1. **Diretor de Ensaio (`showrunner-director`)** — Mode routing, scope classification, and production mandate.
2. **Analista Forense (`forensic-analyst`)** — 5-axis technical audit + **Visual Anti-Inertia** rules (never copy wide-angle distortion or flat flash unless locked by `subtle-retouch`).
3. **Guardião de Consistência (`consistency-guardian`)** — Biometric/product anchoring, **`expressionTruth`** (never turn a calm/closed mouth into a generic toothy AI grin), **`garmentMicroDetails`** (chest patches, logos, stripe cadence, cap embroidery, buttons, straps), **`antiBeautificationLocks`** (visible pores, vellus hair, natural asymmetry, zero beauty filter), and **Zero-Invention Policy**.
4. **Diretor de Arte & Styling (`art-stylist`)** — Concept, wardrobe/props, environment, posture geometry, and palette bounded by scope/locks.
5. **Especialista em Iluminação (`lighting-director`)** — 3D volumetry, key/fill/rim setup, Kelvin temperature, shadow physics, and iris/specular catchlights.
6. **Câmera & Lentes (`camera-optics`)** — Camera body, film/sensor emulsion, prime lens focal length/aperture, elevation, and color science.
7. **Editor Master (`prompt-editor`)** — Compiles engine-tailored prompts (`codexPrompt`, `geminiPrompt`, `claudeComfyPrompt`, `universalJsonSpec`, and `revisionDeltaPrompt`).
8. **Auditor Anti-IA & Realismo (`anti-ai-auditor`, `studio_submit_qa`)** — Strict 8-axis visual QA (`identityFidelity`, `antiSlopScore`, `garmentFidelityScore`, `realism`, `lightingCoherence`, `anatomy`, `framing`, `textureAndCatchlightsOk`). Never rubber-stamps: any failed gate routes fixes back to the responsible specialists and compiles a `revisionDeltaPrompt` for `v2` / `v3` in the Asset Lineage Tree.

See [`references/crew-playbook.md`](references/crew-playbook.md) for optical, lighting, consistency, and Anti-AI QA standards.

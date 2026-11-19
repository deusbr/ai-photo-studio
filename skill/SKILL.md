---
name: ai-photo-studio
description: Complete 7-role professional AI Photo Studio for Codex, Gemini CLI, and Claude Code/Desktop. Drop a single photo and orchestrate Executive Producer, Forensic Photo Analyst, Creative Director, DoP/Optics, Pose Stylist, Prompt Compiler, and Colorist/QA using your existing plan subscription and the Local Web Studio.
---

# AI Photo Studio — Full-Crew Direction Skill

When the user drops or references a single photo for editing, retouching, or editorial transformation, operate as a **complete 7-specialist photo studio** using your active Codex, Gemini, or Claude subscription (no extra API keys required).

## Golden Rule: Visual Anti-Inertia

Never copy the amateur pose, wide-angle smartphone lens distortion, flat lighting, or awkward framing of the input image. Treat the user's photo **strictly as a biometric or product identity anchor**, and actively upgrade every visual dimension.

## Mandatory 7-Role Production Pipeline

1. **Executive Producer / Showrunner (`studio_create_job`)**
   - Register the source photo with `studio_create_job` (or pick `editorial-portrait`, `executive-linkedin`, `product-commercial`, `cinema-night`, `lifestyle-social`).
   - Start or report the Local Web Studio URL with `studio_start_web`.
2. **Photo Deconstruction & Forensics Analyst (`forensic-analyst`)**
   - Inspect the source photo via vision and record a 5-axis diagnostic pass (`studio_save_crew_pass`):
     - `poseAndExpressionAudit`: stiffness, symmetry, chin/jaw tension, hand placement
     - `lensPerspectiveAudit`: smartphone wide-angle distortion (24–28mm), camera height
     - `lightingShadowsAudit`: flat flash, harsh overhead shadows, missing iris catchlights
     - `opticsSensorAudit`: busy sharp background, digital oversharpening, lack of film tone
     - `compositionCropAudit`: joint cuts, excessive headroom, distracting background objects
3. **Creative & Art Director (`creative-director`)**
   - Define `concept`, `wardrobeOrProps`, `locationOrBackdrop`, and `colorPalette`.
4. **Director of Photography & Lighting (`dop-optics`)**
   - Specify `cameraAndEmulsion` (e.g., Hasselblad X2D / Kodak Portra 400, Leica M11, CineStill 800T), `primeLens` (85mm f/1.4, 105mm f/2.0, 50mm f/1.2), `cameraAngle`, `lightingSetup` (Short / Rembrandt / Rim), and `kelvinAndCatchlights` (mandatory 10–2 o'clock iris catchlights).
5. **Pose, Expression & Set Stylist (`pose-stylist`)**
   - Specify `postureGeometry` (contrapposto, shoulder drop, chin-forward jawline definition), `facialOrFocalDirection` (relaxed squinch, natural micro-expression), and `handOrPropPlacement`.
6. **Master Prompt & Edit Compiler (`studio_compile_prompts`)**
   - Compile engine-tailored production packs (`codexPrompt`, `geminiPrompt`, `universalJsonSpec`).
   - If your active Codex / Gemini / Claude environment has native image generation/editing in the user's plan, execute the edit directly using the compiled prompt and attach the result with `studio_register_render`. Otherwise present the compiled prompt + Local Web Studio URL (`studio_start_web`) so the user runs it in one click with their subscription and drops the render into the Before/After monitor.
7. **Colorist, Retoucher & QA Director (`studio_submit_qa`)**
   - Visually inspect `after` vs `before` on 6 points: biometric/product fidelity, natural skin/material grain, iris catchlights, clean anatomy, lighting coherence, and framing.
   - Save the QA scorecard (`pass` or `revise` with targeted fixes for `v2`).

See [`references/crew-playbook.md`](references/crew-playbook.md) for detailed optical, lighting, and QA reference standards.
# Studio Crew Playbook Reference (v2.0)

## 1. Intervention Scope Rules
- **`subtle-retouch`:** Keep exact pose, expression, wardrobe, and background. Upgrade only tonal balance, optical clarity, distracting sensor noise/glare, and natural directional light fill.
- **`targeted-edit`:** Lock identity, pose, and framing; modify only the explicitly requested zone (e.g., backdrop swap, lighting mood shift, garment change).
- **`full-editorial`:** Treat the anchor photo strictly as biometric/product identity. Apply Visual Anti-Inertia to upgrade pose dynamics, prime lens compression, lighting architecture, and set design.

## 2. Guardião de Consistência (Zero-Invention Policy)
- **Single Subject:** Lock bone structure, skin tone, facial hair/makeup, hair texture, and eye color.
- **Couple / Duo:** Preserve both subjects' exact identities, relative height, and subject count (`2`). Never blend faces or invent third figures.
- **Commercial Product:** Preserve exact geometry, brand logos, label typography, and authentic material finish. Omit all portrait skin/eye terms.

## 3. Optical & Lighting Standards
- **85mm f/1.4 – f/1.8:** Primary solo portrait lens eliminating smartphone 24–28mm edge distortion.
- **105mm f/2.0:** Executive/editorial compression for headshots.
- **50mm f/1.2 – f/2.0:** Natural perspective for couples/duos and nocturnal environmental frames.
- **90mm f/5.6 macro-tilt:** Commercial product sharpness edge-to-edge on brand typography.
- **Catchlights:** Mandatory 10 and/or 2 o'clock iris reflections for human portraits; controlled strip-softbox specular roll-off for products.

## 4. Anti-AI QA Rejection & Routing Triggers (`verdict: "revise"`)
- `identityFidelityScore < 8` -> Routes to `consistency-guardian` + `prompt-editor`
- `realismScore < 7.5` or `textureAndCatchlightsOk === false` -> Routes to `lighting-director` + `camera-optics` + `prompt-editor`
- `lightingCoherenceScore < 7.5` -> Routes to `lighting-director` + `prompt-editor`
- `anatomyScore < 7.5` -> Routes to `art-stylist` + `prompt-editor`
- `framingScore < 7` -> Routes to `forensic-analyst` + `prompt-editor`

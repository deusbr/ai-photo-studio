# Studio Crew Playbook Reference (v3.0 — Master Cinematography & Art Direction)

## 1. Essence Extraction Protocol (Before Any Scene Choice)
- Read the anchor photo's **wardrobe archetype**, **color story**, **body language**, and **mood**.
- Ask: *Where do these clothes, this person/couple/product, and this emotional energy genuinely belong in the real world?*
- Ban cliché "stock AI" locations (random stone Roman balconies, generic neon alleys, sterile white infinity coves) unless motivated by the photo or user brief.

## 2. Master Lighting Architecture (`lighting-director`)
- **Motivated Light Source:** Every key light must have a believable physical origin in the scene (e.g., overcast north-facing glass window, open-shade archway, warm 3200K brass cafe pendant, late-afternoon golden sun).
- **Contrast Ratios:**
  - `2:1` — Open commercial / bright daylight lifestyle.
  - `3:1 – 4:1` — Classic sculpted editorial portrait (1–2 stops drop into shadow side carving cheekbones).
  - `5:1 – 8:1` — Moody chiaroscuro / nocturnal cinema.
- **Negative Fill (Subtracting Light):** Explicitly darken/flag the shadow side with a black V-flat or dark architectural wall to absorb stray bounce, deepen skin richness, and restore 3D volume.
- **Kelvin Separation:** Contrast foreground subject temperature against background depth (e.g., `5200K` daylight key on subject vs `6500K` cool open-shade background or `3200K` warm practical accents).

## 3. Master Composition & Optical Character (`art-stylist` + `camera-optics`)
- **Foreground Depth Layering:** Shoot past subtle out-of-focus foreground elements (table edge, foliage, glass frame, doorway) to create 3-plane 3D immersion.
- **Frame Within a Frame:** Use architectural doorways, window mullions, or natural shadow lines to isolate the subject naturally.
- **Decisive Moment:** Capture candid mid-conversation, mid-step, or quiet breathing expressions — never stiff mannequin stares.
- **Skin-Tone Color Science:** Preserve natural melanin distribution, rich sub-surface scattering, visible pores, vellus hair, and natural under-eye creases. Never flatten shadows into muddy grey or apply beauty filters.

## 4. Intervention Scope Rules
- **`subtle-retouch`:** Keep exact pose, expression, wardrobe, and background. Upgrade only tonal balance, optical clarity, distracting glare/noise, and motivated fill.
- **`targeted-edit`:** Lock identity, pose, and framing; modify only the explicitly requested zone.
- **`full-editorial`:** Treat anchor strictly as biometric & wardrobe identity; execute full essence-driven scene, lighting, and optical upgrade.

## 5. Anti-AI QA Rejection & Routing Triggers (`verdict: "revise"`)
- `identityFidelityScore < 8` -> Routes to `consistency-guardian` + `prompt-editor`
- `antiSlopScore < 8` (plastic skin, beautification, mannequin stare, or generic AI smile) -> Routes to `consistency-guardian` + `prompt-editor`
- `garmentFidelityScore < 8` (missing logos, patches, plackets, stripes, or color shift) -> Routes to `consistency-guardian` + `art-stylist` + `prompt-editor`
- `realismScore < 7.5` or `textureAndCatchlightsOk === false` -> Routes to `lighting-director` + `camera-optics` + `prompt-editor`
- `lightingCoherenceScore < 7.5` -> Routes to `lighting-director` + `prompt-editor`
- `anatomyScore < 7.5` -> Routes to `art-stylist` + `prompt-editor`
- `framingScore < 7` -> Routes to `forensic-analyst` + `prompt-editor`

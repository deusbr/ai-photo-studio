# Studio Crew Playbook Reference (v4.0 — Master Cinematography, Posing, Optics & Makeup)

## 1. Essence Extraction Protocol (Before Any Scene Choice)
- Read the anchor photo's **wardrobe archetype**, **color story**, **body language**, and **mood**.
- Ask: *Where do these clothes, this person/couple/product, and this emotional energy genuinely belong in the real world?*
- Ban cliché "stock AI" locations (random stone Roman balconies, generic neon alleys, sterile white infinity coves) unless motivated by the photo or user brief.

## 2. Posing & Body Geometry (`art-stylist`)
- **Contrapposto & S-Curve:** 80% weight on rear hip, soft front knee bend, front shoulder dropped 3 cm, torso 35° off-axis.
- **Submental Jawline Sculpt (Turtle Technique):** Extend forehead/ears subtly forward toward lens and drop chin 3–5° to define the jawline cleanly.
- **Edge-of-Hand Rule:** Present the side/edge of the hand toward camera with softly separated, gracefully curved fingers; never press flat palms into cheeks or body.
- **Negative-Space Triangles:** Create deliberate triangular openings between arms and torso to sculpt the silhouette.
- **Couple Zero-Overlap:** Stagger head heights 5–10 cm in an open V-angle so both faces stay tack-sharp in the focal plane.

## 3. Master Lighting Architecture (`lighting-director`)
- **Motivated Light Source:** Every key light must have a believable physical origin (north-facing overcast window, open-shade archway, 3200K brass cafe pendant, late-afternoon golden sun).
- **Contrast Ratios:** `2:1` (commercial/beauty clamshell), `3:1 – 4:1` (sculpted Rembrandt editorial), `5:1 – 8:1` (chiaroscuro / cinema trailer noir).
- **Negative Fill:** Black V-flat or dark architectural wall on the shadow side absorbing stray bounce to carve 3D facial volume.
- **Kelvin Separation:** Contrast foreground subject temperature against background depth (`5200K` vs `6500K` shade, or `3200K` amber vs `6500K` slate-teal).

## 4. Camera, Lenses, Optical Filters & Effects (`camera-optics`)
- **Focal Match Guardrail:** Never shoot tight beauty/headshots on `24mm` (causes nasal/forehead distortion); use `85mm f/1.4`, `105mm f/1.4`, or `135mm f/1.8`. Use `35mm` for documentary/street storytelling, `40mm Cooke Anamorphic` for `2.39:1` cinema trailer frames, and `90mm Macro Tilt-Shift` for product label perfection.
- **Physical Optical Diffusion:** *Tiffen Black Pro-Mist (1/8 or 1/4)* and *Glimmerglass 1/4* bloom highlights organically without digital plastic skin smoothing.
- **Cinema Trailer Look:** `ARRI Alexa 35` + `Kodak Vision3 500T`, `40mm Cooke Anamorphic`, `Black Pro-Mist 1/4`, subtle horizontal flare, volumetric haze, and `Teal & Amber` luminance-controlled grade.

## 5. Editorial Makeup & Skin Realism (Zero Plastic Filter)
- **No-Makeup / Natural Hydrated:** Neutral tone, groomed brows, visible pores, freckles, vellus hair.
- **Editorial Glass Skin + Matte T-Zone:** Luminous wet-look sheen strictly on upper cheekbones/nose bridge while keeping T-zone softly matte and pore texture 100% intact.
- **Deconstructed Cinema Kohl:** Smudged charcoal lashline, softly blurred natural lip stain, lived-in realism.
- **Product Rule:** When `subjectType === 'product'`, strip all human skin, eye, pore, and makeup terminology from compiled prompts.

## 6. Anti-AI QA Rejection & Routing Triggers (`verdict: "revise"`)
- `identityFidelityScore < 8` -> Routes to `consistency-guardian` + `prompt-editor`
- `antiSlopScore < 8` (plastic skin, beautification, mannequin stare, or generic AI smile) -> Routes to `consistency-guardian` + `prompt-editor`
- `garmentFidelityScore < 8` (missing logos, patches, plackets, stripes, or color shift) -> Routes to `consistency-guardian` + `art-stylist` + `prompt-editor`
- `realismScore < 7.5` or `textureAndCatchlightsOk === false` -> Routes to `lighting-director` + `camera-optics` + `prompt-editor`
- `lightingCoherenceScore < 7.5` -> Routes to `lighting-director` + `prompt-editor`
- `anatomyScore < 7.5` -> Routes to `art-stylist` + `prompt-editor`
- `framingScore < 7` -> Routes to `forensic-analyst` + `prompt-editor`

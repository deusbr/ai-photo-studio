'use strict';

const STUDIO_CREW = [
  {
    id: 'executive-producer',
    order: 1,
    title: 'Executive Producer / Showrunner',
    mission: 'Intake the anchor photo, classify subject genre, enforce the Visual Anti-Inertia Rule, and coordinate the crew.',
    deliverables: ['genre', 'preset', 'targetAspectRatio', 'productionGoal']
  },
  {
    id: 'forensic-analyst',
    order: 2,
    title: 'Photo Deconstruction & Forensics Analyst',
    mission: 'Audit the raw photo across 5 technical axes so amateur flaws are actively corrected rather than copied.',
    deliverables: ['poseAndExpressionAudit', 'lensPerspectiveAudit', 'lightingShadowsAudit', 'opticsSensorAudit', 'compositionCropAudit']
  },
  {
    id: 'creative-director',
    order: 3,
    title: 'Creative & Art Director',
    mission: 'Define visual concept, wardrobe or product styling, environment/set design, and color palette.',
    deliverables: ['concept', 'wardrobeOrProps', 'locationOrBackdrop', 'colorPalette']
  },
  {
    id: 'dop-optics',
    order: 4,
    title: 'Director of Photography (DoP) & Lighting',
    mission: 'Specify camera system, prime lens, film/sensor grain, camera angle, key/fill/rim lighting, Kelvin temp, and iris catchlights.',
    deliverables: ['cameraAndEmulsion', 'primeLens', 'cameraAngle', 'lightingSetup', 'kelvinAndCatchlights']
  },
  {
    id: 'pose-stylist',
    order: 5,
    title: 'Pose, Expression & Set Stylist',
    mission: 'Direct anatomical posture, jawline/gaze micro-expressions, hand placement, or commercial product staging.',
    deliverables: ['postureGeometry', 'facialOrFocalDirection', 'handOrPropPlacement']
  },
  {
    id: 'prompt-compiler',
    order: 6,
    title: 'Master Prompt & Edit Compiler',
    mission: 'Synthesize all crew specs into engine-ready prompts for Codex (ChatGPT Image), Gemini, and Claude/ComfyUI.',
    deliverables: ['codexPrompt', 'geminiPrompt', 'universalJsonSpec', 'negativeConstraints']
  },
  {
    id: 'colorist-qa',
    order: 7,
    title: 'Colorist, Retoucher & QA Director',
    mission: 'Audit the generated render against the anchor photo for biometric/product fidelity, organic texture, and zero AI artifacts.',
    deliverables: ['identityFidelityScore', 'textureAndCatchlightsOk', 'verdict', 'revisionNotes']
  }
];

const STUDIO_PRESETS = {
  'editorial-portrait': {
    id: 'editorial-portrait',
    name: 'Editorial Magazine Portrait',
    description: 'High-craft magazine portraiture with sculpted lighting, optical compression, and organic film texture.',
    defaults: {
      cameraAndEmulsion: 'Hasselblad X2D 100C / Kodak Portra 400 tonal curve',
      primeLens: '85mm f/1.4 prime, shallow depth of field, creamy natural bokeh',
      cameraAngle: 'Subtle 10-degree low angle from chest height, three-quarter facial turn',
      lightingSetup: 'Short lighting key at 45 degrees + subtle rim/hair separation light',
      kelvinAndCatchlights: '5200K daylight-balanced warmth with crisp iris catchlights at 10 and 2 o clock',
      postureGeometry: '80% weight on rear leg (contrapposto), front shoulder dropped 3 cm, chin projected slightly forward to define jawline',
      colorPalette: 'Warm skin neutrals, deep charcoal shadows, subtle natural silver-halide grain'
    }
  },
  'executive-linkedin': {
    id: 'executive-linkedin',
    name: 'Executive & Founder Headshot',
    description: 'Approachable authority portrait for LinkedIn, press kits, and company leadership pages.',
    defaults: {
      cameraAndEmulsion: 'Leica M11 medium-contrast color science, 16-bit natural skin transitions',
      primeLens: '105mm f/2.0 portrait telephoto eliminating wide-angle distortion',
      cameraAngle: 'Eye-level to 5-degree upward tilt for balanced authority',
      lightingSetup: 'Soft octagonal key light at 35 degrees + clean negative fill + subtle architectural backdrop glow',
      kelvinAndCatchlights: '5500K neutral studio daylight with clear rectangular catchlights',
      postureGeometry: 'Torso angled 35 degrees, head turned toward lens, relaxed lower-eyelid squinch, natural unforced confidence',
      colorPalette: 'Slate, navy, ivory, and true-to-life skin tones'
    }
  },
  'product-commercial': {
    id: 'product-commercial',
    name: 'Commercial Product Studio',
    description: 'Luxury e-commerce and hero campaign look with specular control and tactile surface fidelity.',
    defaults: {
      cameraAndEmulsion: 'Phase One IQ4 150MP commercial studio capture, razor-sharp micro-contrast',
      primeLens: '90mm f/5.6 macro-tilt lens keeping brand markings crisp edge-to-edge',
      cameraAngle: 'Three-quarter hero elevation (15 degrees) grounding product weight',
      lightingSetup: 'Dual diffused strip softboxes for clean edge highlights + overhead scrim + subtle ground reflection',
      kelvinAndCatchlights: '5400K calibrated studio strobes with controlled specular roll-off',
      postureGeometry: 'Hero product anchored on matte stone or brushed surface with natural contact shadow',
      colorPalette: 'Neutral architectural stone, warm accents, accurate brand Pantone fidelity'
    }
  },
  'cinema-night': {
    id: 'cinema-night',
    name: 'Cinematic Night Lifestyle',
    description: 'Atmospheric nocturnal editorial with tungsten/neon practicals and CineStill 800T halation.',
    defaults: {
      cameraAndEmulsion: 'Leica M6 / CineStill 800T tungsten emulation with subtle highlight halation',
      primeLens: '50mm f/1.2 fast prime capturing ambient street bokeh',
      cameraAngle: 'Environmental medium-close frame with subject in central/golden third',
      lightingSetup: 'Warm 3200K practical key light from café/street fixture + cool cyan ambient rim contrast',
      kelvinAndCatchlights: '3200K warm key balanced against cool evening shadows, vivid practical catchlights',
      postureGeometry: 'Relaxed candid lean, hands engaged naturally (cup, coat pocket, or watch), eyes focused off-axis or calmly at lens',
      colorPalette: 'Amber tungsten highlights, deep teal-indigo shadows, rich nocturnal contrast'
    }
  },
  'lifestyle-social': {
    id: 'lifestyle-social',
    name: 'Natural Daylight Lifestyle',
    description: 'Effortless outdoor or sunlit indoor editorial using Fujifilm Pro 400H pastel clarity.',
    defaults: {
      cameraAndEmulsion: 'Fujifilm GFX / Pro 400H daylight film response with airy highlight roll-off',
      primeLens: '35mm f/1.4 or 50mm f/1.4 environmental portrait lens',
      cameraAngle: 'Natural waist-up or three-quarter walk-by framing',
      lightingSetup: 'Open shade / late-afternoon golden sun as back-rim light + soft natural bounce fill',
      kelvinAndCatchlights: '5000K-5600K open sky wraparound light with bright natural eye reflections',
      postureGeometry: 'Asymmetric relaxed stance, fluid limb bends, genuine micro-expression',
      colorPalette: 'Airy blues, warm sand/linen neutrals, clean organic greens'
    }
  }
};

function getCrewList() {
  return STUDIO_CREW.map((m) => ({ ...m }));
}

function resolvePreset(presetId = 'editorial-portrait') {
  return STUDIO_PRESETS[presetId] || STUDIO_PRESETS['editorial-portrait'];
}

function buildProductionPacks(job) {
  const preset = resolvePreset(job.preset);
  const passes = job.crewPasses || {};
  const forensic = passes['forensic-analyst'] || {};
  const creative = passes['creative-director'] || {};
  const dop = passes['dop-optics'] || {};
  const stylist = passes['pose-stylist'] || {};

  const camera = dop.cameraAndEmulsion || preset.defaults.cameraAndEmulsion;
  const lens = dop.primeLens || preset.defaults.primeLens;
  const angle = dop.cameraAngle || preset.defaults.cameraAngle;
  const lighting = dop.lightingSetup || preset.defaults.lightingSetup;
  const kelvin = dop.kelvinAndCatchlights || preset.defaults.kelvinAndCatchlights;
  const posture = stylist.postureGeometry || preset.defaults.postureGeometry;
  const facial = stylist.facialOrFocalDirection || 'Natural focused gaze, relaxed jaw, authentic micro-expression';
  const hands = stylist.handOrPropPlacement || 'Natural relaxed hand placement consistent with wardrobe/scene';
  const concept = creative.concept || `${preset.name} transformation`;
  const wardrobe = creative.wardrobeOrProps || 'Elevated tailored attire or clean hero styling matching scene';
  const location = creative.locationOrBackdrop || 'Cohesive textured architectural or natural backdrop with clean depth separation';
  const palette = creative.colorPalette || preset.defaults.colorPalette;
  const corrections = forensic.correctionsSummary || 'Correct smartphone wide-angle distortion, flat lighting, and stiff posture.';

  const negativeConstraints = [
    'Do NOT copy the amateur pose, flat lighting, or wide-angle distortion of the reference photo',
    'No plastic/waxy skin smoothing, no dead eyes without catchlights, no face or product identity drift',
    'No extra fingers, warped anatomy, oversaturated HDR halos, or artificial CGI look'
  ];

  const codexPrompt = [
    `Edit and re-direct the attached reference image using it STRICTLY as the biometric/subject identity anchor (${job.sourceImage?.fileName || 'source image'}).`,
    `Corrections required: ${corrections}`,
    `Concept & Scene: ${concept}. Location: ${location}. Styling/Wardrobe: ${wardrobe}. Color palette: ${palette}.`,
    `Pose & Expression: ${posture}. ${facial}. ${hands}.`,
    `Optics & Lighting: Shot on ${camera} with ${lens}. Camera angle: ${angle}. Lighting: ${lighting}. ${kelvin}.`,
    `Preserve exact facial structure, skin tone, hair/product proportions, and realistic micro-texture. Constraints: ${negativeConstraints.join('; ')}.`
  ].join('\n');

  const geminiPrompt = [
    `Transform the attached photo into a high-craft ${preset.name} photograph while strictly preserving the subject's exact identity and facial/product features.`,
    `Do not replicate the original amateur pose, camera angle, or flat lighting. Instead, apply: ${posture}; ${facial}; ${hands}.`,
    `Place the subject in ${location} wearing/styled with ${wardrobe}, following a ${palette} palette.`,
    `Photographic execution: ${camera}, ${lens}, ${angle}, lit with ${lighting} and ${kelvin}.`,
    `Render authentic photographic grain, tactile fabric/material detail, and natural skin pores. Avoid: ${negativeConstraints.join('; ')}.`
  ].join(' ');

  const universalJsonSpec = {
    studio: 'ai-photo-studio',
    preset: preset.id,
    anchorImage: job.sourceImage?.fileName || null,
    antiInertiaCorrections: corrections,
    artDirection: { concept, wardrobe, location, palette },
    opticsAndLighting: { camera, lens, angle, lighting, kelvin },
    poseAndStyling: { posture, facial, hands },
    negativeConstraints
  };

  return {
    generatedAt: new Date().toISOString(),
    preset: preset.id,
    codexPrompt,
    geminiPrompt,
    universalJsonSpec,
    negativeConstraints
  };
}

module.exports = {
  STUDIO_CREW,
  STUDIO_PRESETS,
  getCrewList,
  resolvePreset,
  buildProductionPacks
};
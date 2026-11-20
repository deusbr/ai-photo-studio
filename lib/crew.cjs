'use strict';

const STUDIO_CREW = [
  {
    id: 'showrunner-director',
    order: 1,
    agentHandle: 'Diretor de Ensaio',
    title: 'Showrunner & Photo Essay Director',
    mission:
      'Intake the anchor image, decide Autonomous vs Directed mode, classify Intervention Scope (subtle-retouch, targeted-edit, full-editorial), and coordinate all specialists.',
    deliverables: ['mode', 'subjectType', 'interventionScope', 'preset', 'targetAspectRatio', 'productionGoal'],
    legacyAliases: ['executive-producer']
  },
  {
    id: 'forensic-analyst',
    order: 2,
    agentHandle: 'Analista Forense',
    title: 'Photo Deconstruction & Forensics Analyst',
    mission:
      'Audit the raw image across 5 technical axes and enforce the Visual Anti-Inertia Rule so smartphone distortion, flat flash, and stiff posture are actively corrected.',
    deliverables: [
      'poseAndExpressionAudit',
      'lensPerspectiveAudit',
      'lightingShadowsAudit',
      'opticsSensorAudit',
      'compositionCropAudit',
      'correctionsSummary'
    ],
    legacyAliases: []
  },
  {
    id: 'consistency-guardian',
    order: 3,
    agentHandle: 'Guardião de Consistência',
    title: 'Consistency & Biometric Anchor Guardian',
    mission:
      'Lock biometric/product identity, exact expression truth (no invented smiles), garment micro-details (logos/patches/stripes), and anti-beautification anchors under a strict Zero-Invention policy.',
    deliverables: [
      'anchorType',
      'lockedAttributes',
      'expressionTruth',
      'garmentMicroDetails',
      'antiBeautificationLocks',
      'zeroInventionPolicy',
      'driftRiskFlags'
    ],
    legacyAliases: []
  },
  {
    id: 'art-stylist',
    order: 4,
    agentHandle: 'Diretor de Arte & Styling',
    title: 'Creative, Art & Set Stylist Director',
    mission:
      'Define visual concept, wardrobe/props, environment/backdrop, posture geometry, and color palette — strictly bounded by Intervention Scope.',
    deliverables: [
      'concept',
      'wardrobeOrProps',
      'locationOrBackdrop',
      'colorPalette',
      'postureGeometry',
      'facialOrFocalDirection',
      'handOrPropPlacement'
    ],
    legacyAliases: ['creative-director', 'pose-stylist']
  },
  {
    id: 'lighting-director',
    order: 5,
    agentHandle: 'Especialista em Iluminação',
    title: 'Lighting & Atmosphere Consultant',
    mission:
      'Architect 3D lighting volumetry, key/fill/rim ratios, Kelvin color temperature, believable shadow falloff, and crisp iris or specular catchlights.',
    deliverables: ['lightingSetup', 'kelvinAndCatchlights', 'shadowPhysics', 'atmosphereNotes'],
    legacyAliases: []
  },
  {
    id: 'camera-optics',
    order: 6,
    agentHandle: 'Câmera & Lentes',
    title: 'Optics & Color Science Consultant',
    mission:
      'Specify camera body, prime focal length, aperture, camera elevation/angle, depth of field, and analog/digital film color science calibrated to the shot type.',
    deliverables: ['cameraAndEmulsion', 'primeLens', 'cameraAngle', 'depthOfField', 'colorScience'],
    legacyAliases: ['dop-optics']
  },
  {
    id: 'prompt-editor',
    order: 7,
    agentHandle: 'Editor Master',
    title: 'Master Prompt & Edit Compiler',
    mission:
      'Synthesize all specialist specs and locks into engine-tailored production packs for Codex (GPT Image), Gemini/Imagen, Claude/ComfyUI, and Universal JSON.',
    deliverables: ['codexPrompt', 'geminiPrompt', 'claudeComfyPrompt', 'universalJsonSpec', 'negativeConstraints'],
    legacyAliases: ['prompt-compiler']
  },
  {
    id: 'anti-ai-auditor',
    order: 8,
    agentHandle: 'Auditor Anti-IA & Realismo',
    title: 'Anti-AI Realism Auditor, Colorist & QA Gate',
    mission:
      'Perform strict 8-point visual QA comparing render vs anchor against AI slop, beautification/smile drift, and garment detail loss, routing targeted fixes back to specialists.',
    deliverables: [
      'identityFidelityScore',
      'antiSlopScore',
      'garmentFidelityScore',
      'realismScore',
      'textureAndCatchlightsOk',
      'verdict',
      'routeToRoles',
      'revisionNotes'
    ],
    legacyAliases: ['colorist-qa']
  }
];

const ROLE_ALIAS_MAP = new Map();
for (const member of STUDIO_CREW) {
  ROLE_ALIAS_MAP.set(member.id, member.id);
  for (const alias of member.legacyAliases || []) {
    ROLE_ALIAS_MAP.set(alias, member.id);
  }
}

function normalizeRoleId(roleId) {
  const key = String(roleId || '').trim();
  return ROLE_ALIAS_MAP.get(key) || null;
}

const STUDIO_PRESETS = {
  'editorial-portrait': {
    id: 'editorial-portrait',
    name: 'Editorial Magazine Portrait',
    category: 'portrait',
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
    category: 'portrait',
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
  'couple-editorial': {
    id: 'couple-editorial',
    name: 'Couple & Duo Editorial',
    category: 'couple',
    description: 'Two-subject storytelling portrait preserving both identities, natural interaction, and balanced depth of field.',
    defaults: {
      cameraAndEmulsion: 'Leica SL3 / Kodak Portra 400 natural dual-tone warmth',
      primeLens: '50mm f/2.0 prime ensuring both subjects stay tack-sharp in the focal plane',
      cameraAngle: 'Eye-level medium environmental frame following rule of thirds',
      lightingSetup: 'Broad diffused wrap-around key light + warm rim separation uniting both silhouettes',
      kelvinAndCatchlights: '5000K warm late-afternoon balance with matching natural catchlights in both subjects eyes',
      postureGeometry: 'Natural asymmetric lean, genuine candid connection, shoulders angled cleanly without overlapping faces',
      colorPalette: 'Warm earth neutrals, linen ivory, soft golden highlights'
    }
  },
  'product-commercial': {
    id: 'product-commercial',
    name: 'Commercial Product Studio',
    category: 'product',
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
    category: 'night',
    description: 'Atmospheric nocturnal editorial with tungsten/neon practicals and CineStill 800T halation.',
    defaults: {
      cameraAndEmulsion: 'Leica M6 / CineStill 800T tungsten emulation with subtle highlight halation',
      primeLens: '50mm f/1.2 fast prime capturing ambient street bokeh',
      cameraAngle: 'Environmental medium-close frame with subject in central/golden third',
      lightingSetup: 'Warm 3200K practical key light from cafe/street fixture + cool cyan ambient rim contrast',
      kelvinAndCatchlights: '3200K warm key balanced against cool evening shadows, vivid practical catchlights',
      postureGeometry: 'Relaxed candid lean, hands engaged naturally (cup, coat pocket, or watch), eyes focused off-axis or calmly at lens',
      colorPalette: 'Amber tungsten highlights, deep teal-indigo shadows, rich nocturnal contrast'
    }
  },
  'lifestyle-social': {
    id: 'lifestyle-social',
    name: 'Natural Daylight Lifestyle',
    category: 'lifestyle',
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
  },
  'subtle-retouch': {
    id: 'subtle-retouch',
    name: 'Subtle Natural Retouch',
    category: 'retouch',
    description: 'Preserve original pose, outfit, and setting while upgrading lighting polish, micro-contrast, and optical clarity.',
    defaults: {
      cameraAndEmulsion: 'Clean full-frame digital medium-format grade, faithful original color harmony',
      primeLens: 'Perspective-corrected prime rendering preserving original framing',
      cameraAngle: 'Preserve exact original camera angle and framing with subtle horizon/distortion cleanup',
      lightingSetup: 'Subtle directional fill and tonal separation enhancing existing ambient light without artificial relighting',
      kelvinAndCatchlights: 'Balanced natural white balance preserving skin/surface truth and gentle natural eye clarity',
      postureGeometry: 'Preserve exact original pose, expression, and body proportions without altering placement',
      colorPalette: 'True-to-original palette with refined dynamic range and clean highlight roll-off'
    }
  }
};

function getCrewList() {
  return STUDIO_CREW.map((m) => ({ ...m, deliverables: [...m.deliverables], legacyAliases: [...m.legacyAliases] }));
}

function resolvePreset(presetId = 'editorial-portrait') {
  return STUDIO_PRESETS[presetId] || STUDIO_PRESETS['editorial-portrait'];
}

function resolvePass(passes, primaryId, fallbackIds = []) {
  for (const id of [primaryId, ...fallbackIds]) {
    if (passes && passes[id] && typeof passes[id] === 'object') {
      return passes[id];
    }
  }
  return {};
}

function buildProductionPacks(job) {
  const preset = resolvePreset(job.preset);
  const passes = job.crewPasses || {};
  const showrunner = resolvePass(passes, 'showrunner-director', ['executive-producer']);
  const forensic = resolvePass(passes, 'forensic-analyst');
  const guardian = resolvePass(passes, 'consistency-guardian');
  const art = resolvePass(passes, 'art-stylist', ['creative-director']);
  const pose = resolvePass(passes, 'pose-stylist');
  const lightingPass = resolvePass(passes, 'lighting-director', ['dop-optics']);
  const cameraPass = resolvePass(passes, 'camera-optics', ['dop-optics']);
  const auditor = resolvePass(passes, 'anti-ai-auditor', ['colorist-qa']);

  const mode = job.mode || showrunner.mode || 'directed';
  const scope = job.interventionScope || showrunner.interventionScope || (preset.id === 'subtle-retouch' ? 'subtle-retouch' : 'full-editorial');
  const locks = {
    keepPose: Boolean(job.locks?.keepPose || scope === 'subtle-retouch'),
    keepWardrobe: Boolean(job.locks?.keepWardrobe || scope === 'subtle-retouch'),
    keepBackground: Boolean(job.locks?.keepBackground || scope === 'subtle-retouch'),
    keepFraming: Boolean(job.locks?.keepFraming)
  };

  const isProduct = preset.id === 'product-commercial' || showrunner.subjectType === 'product';
  const camera = cameraPass.cameraAndEmulsion || preset.defaults.cameraAndEmulsion;
  const lens = cameraPass.primeLens || preset.defaults.primeLens;
  const angle = locks.keepFraming
    ? 'Preserve original camera framing while correcting minor lens barrel distortion'
    : (cameraPass.cameraAngle || preset.defaults.cameraAngle);
  const lighting = lightingPass.lightingSetup || preset.defaults.lightingSetup;
  const kelvin = lightingPass.kelvinAndCatchlights || preset.defaults.kelvinAndCatchlights;

  const posture = locks.keepPose
    ? 'STRICTLY preserve the exact original pose, body placement, and expression from the reference image.'
    : (art.postureGeometry || pose.postureGeometry || preset.defaults.postureGeometry);
  const facial = locks.keepPose
    ? (isProduct ? 'Preserve exact product alignment and label legibility.' : 'Preserve original gaze and natural facial expression.')
    : (art.facialOrFocalDirection || pose.facialOrFocalDirection || (isProduct
        ? 'Hero product crisp front-facing label and typography legibility'
        : 'Natural focused gaze, relaxed jaw, authentic micro-expression'));
  const hands = locks.keepPose
    ? 'Keep original hand/object placement untouched.'
    : (art.handOrPropPlacement || pose.handOrPropPlacement || (isProduct
        ? 'Clean architectural staging on matte surface with controlled contact shadow'
        : 'Natural relaxed hand placement consistent with wardrobe/scene'));

  const concept = art.concept || (job.userBrief ? `Custom Art Direction: ${job.userBrief}` : `${preset.name} transformation`);
  const wardrobe = locks.keepWardrobe
    ? 'STRICTLY preserve original wardrobe, garments, and accessories from the reference photo.'
    : (art.wardrobeOrProps || (isProduct
        ? 'Clean hero product packaging, surface props, and subtle studio accents'
        : 'Elevated tailored attire or clean hero styling matching scene'));
  const location = locks.keepBackground
    ? 'STRICTLY preserve the original background/environment, cleaning only distracting sensor noise or harsh glare.'
    : (art.locationOrBackdrop || 'Cohesive textured architectural or natural backdrop with clean depth separation');
  const palette = art.colorPalette || preset.defaults.colorPalette;
  const corrections = forensic.correctionsSummary || (isProduct
    ? 'Correct smartphone wide-angle distortion, harsh glare, and cluttered background.'
    : scope === 'subtle-retouch'
      ? 'Apply subtle tonal balance, optical clarity, and natural lighting polish without altering identity, pose, outfit, or location.'
      : 'Correct smartphone wide-angle distortion, flat lighting, and stiff posture.');

  const lockedList = [];
  if (locks.keepPose) lockedList.push('original pose & expression');
  if (locks.keepWardrobe) lockedList.push('original wardrobe & accessories');
  if (locks.keepBackground) lockedList.push('original background & setting');
  if (locks.keepFraming) lockedList.push('original framing & aspect ratio');
  if (guardian.lockedAttributes && Array.isArray(guardian.lockedAttributes)) {
    for (const item of guardian.lockedAttributes) {
      if (item && !lockedList.includes(item)) lockedList.push(item);
    }
  }

  const expressionTruth = guardian.expressionTruth || (isProduct
    ? 'Exact product front-facing orientation.'
    : 'Preserve the exact mouth/eye expression from the anchor image (if closed-mouth/subtle, keep closed-mouth/subtle; never invent a generic open-tooth stock smile).');
  const garmentMicroDetails = guardian.garmentMicroDetails || (isProduct
    ? 'Exact brand logos, label typography, seams, and true base colors.'
    : 'Preserve exact collars, stripe cadence, chest patches/logos, cap embroidery, buttons, straps, and jewelry without redesigning or erasing details; do not let ambient light shift true fabric colors.');
  const antiBeautificationLocks = guardian.antiBeautificationLocks || (isProduct
    ? 'Authentic surface micro-texture, real-world specular roll-off, zero CGI gloss.'
    : 'Unretouched natural skin with visible pores, fine vellus facial hair, natural under-eye lines, slight natural asymmetry, and stray flyaway hairs — zero beauty filter, zero digital smoothing.');

  const negativeConstraints = isProduct
    ? [
        'Do NOT copy the amateur camera angle, flat lighting, or wide-angle distortion of the reference photo',
        'No warped typography, distorted or erased brand logos, moire screen grids, or harsh glare',
        'No melted geometry, oversaturated HDR halos, or artificial CGI look'
      ]
    : [
        scope === 'subtle-retouch'
          ? 'Do NOT alter facial identity, original pose, clothing, or setting'
          : 'Do NOT copy the amateur pose, flat lighting, or wide-angle distortion of the reference photo',
        'No beauty filter, no plastic/waxy skin smoothing, no generic AI stock smile, no expression drift',
        'No altered or erased garment logos, patches, collars, or stripe patterns; no ambient color shift on clothing',
        'No extra fingers, warped anatomy, dead eyes without catchlights, or artificial CGI look'
      ];

  const identityRule = isProduct
    ? 'Preserve exact product geometry, brand logos, label typography, and authentic surface micro-texture.'
    : 'Preserve exact facial structure, skin tone, hair/subject proportions, and realistic micro-texture. Zero-invention policy: do not add unrequested accessories, tattoos, or extra people.';

  const endPreservationGuard = isProduct
    ? `STRICT PRESERVATION RULE (DO NOT VIOLATE): Keep exact product geometry, brand logos, label typography, hardware, and true base colors 100% unchanged; do not let ambient lighting alter product colors.`
    : `STRICT PRESERVATION RULE (DO NOT VIOLATE): Keep exact facial structure, exact expression truth (${expressionTruth}), natural unretouched skin texture, and every garment micro-detail (${garmentMicroDetails}) 100% unchanged; do not beautify faces, invent generic smiles, or alter clothing details.`;

  const directiveClause = job.userBrief ? `User Art Direction (Must Follow): ${job.userBrief}` : `Autonomous Studio Mode (${mode}): Execute top creative direction cleanly.`;
  const lockClause = lockedList.length ? `Locked Elements (Immutable): ${lockedList.join(', ')}.` : '';

  const codexPrompt = [
    `Edit and re-direct the attached reference image using it STRICTLY as the ${isProduct ? 'product' : 'biometric/subject'} identity anchor (${job.sourceImage?.fileName || 'source image'}).`,
    `Mode: ${mode} | Scope: ${scope}. ${directiveClause}`,
    lockClause,
    `Corrections required: ${corrections}`,
    `Concept & Scene: ${concept}. Location: ${location}. Styling/Props: ${wardrobe}. Color palette: ${palette}.`,
    `Staging & Composition: ${posture}. ${facial}. ${hands}.`,
    `Optics & Lighting: Shot on ${camera} with ${lens}. Camera angle: ${angle}. Lighting: ${lighting}. ${kelvin}.`,
    `Anti-Slop Realism: ${antiBeautificationLocks}`,
    `Constraints: ${negativeConstraints.join('; ')}.`,
    endPreservationGuard
  ].filter(Boolean).join('\n');

  const geminiTail = isProduct
    ? `Render authentic photographic optics and tactile material detail. Avoid: ${negativeConstraints.join('; ')}. ${endPreservationGuard}`
    : `Candid authentic photography look: ${antiBeautificationLocks} Avoid: ${negativeConstraints.join('; ')}. ${endPreservationGuard}`;

  const geminiPrompt = [
    `Transform the attached photo (${scope}) into a candid ${preset.name} photograph while strictly preserving the ${isProduct ? "product's exact design, proportions, and markings" : "subject's exact identity, facial asymmetry, and natural expression"}.`,
    job.userBrief ? `Follow exact user direction: ${job.userBrief}.` : '',
    lockClause,
    scope === 'subtle-retouch'
      ? `Keep the original scene, pose, and outfit faithful while applying: ${posture}; ${facial}.`
      : `Do not replicate the original amateur framing, camera angle, or flat lighting. Instead, apply: ${posture}; ${facial}; ${hands}.`,
    `Scene & Styling: ${location}; ${wardrobe}; palette ${palette}.`,
    `Photographic execution: ${camera}, ${lens}, ${angle}, lit with ${lighting} and ${kelvin}.`,
    geminiTail
  ].filter(Boolean).join(' ');

  const claudeComfyPrompt = [
    `[STUDIO WORKFLOW] mode=${mode} scope=${scope} preset=${preset.id}`,
    `[ANCHOR] ${job.sourceImage?.fileName || 'source'} (${job.sourceImage?.width || '?'}x${job.sourceImage?.height || '?'}) | ${identityRule}`,
    lockClause ? `[LOCKS] ${lockedList.join(' | ')}` : '',
    `[EXPRESSION TRUTH] ${expressionTruth}`,
    `[GARMENT MICRO-DETAILS] ${garmentMicroDetails}`,
    `[ANTI-SLOP SKIN/TEXTURE] ${antiBeautificationLocks}`,
    job.userBrief ? `[USER ORDER] ${job.userBrief}` : `[AUTO CONCEPT] ${concept}`,
    `[LIGHTING] ${lighting} | ${kelvin}`,
    `[OPTICS] ${camera} | ${lens} | ${angle}`,
    `[ART & POSE] ${location} | ${wardrobe} | ${posture}`,
    `[NEGATIVE] ${negativeConstraints.join(' | ')}`,
    `[END PRESERVATION GUARD] ${endPreservationGuard}`
  ].filter(Boolean).join('\n');

  let revisionDeltaPrompt = null;
  if (auditor && auditor.verdict === 'revise' && auditor.revisionNotes) {
    const routes = Array.isArray(auditor.routeToRoles) && auditor.routeToRoles.length
      ? auditor.routeToRoles.join(', ')
      : 'consistency-guardian, prompt-editor';
    revisionDeltaPrompt = [
      `TARGETED REVISION PASS (Fix ONLY the flagged issues on the latest render while keeping composition & identity locked):`,
      `Routed Specialists: ${routes}.`,
      `QA Critique to Resolve: ${auditor.revisionNotes}`,
      lockClause || 'Preserve established framing, pose, and subject identity from anchor.',
      endPreservationGuard
    ].join('\n');
  }

  const universalJsonSpec = {
    studio: 'ai-photo-studio',
    version: '2.1.0',
    mode,
    interventionScope: scope,
    preset: preset.id,
    anchorImage: job.sourceImage?.fileName || null,
    userBrief: job.userBrief || null,
    locks,
    lockedAttributes: lockedList,
    expressionTruth,
    garmentMicroDetails,
    antiBeautificationLocks,
    antiInertiaCorrections: corrections,
    endPreservationGuard,
    artDirection: { concept, wardrobe, location, palette },
    opticsAndLighting: { camera, lens, angle, lighting, kelvin },
    poseAndStyling: { posture, facial, hands },
    negativeConstraints,
    revisionDeltaPrompt
  };

  return {
    generatedAt: new Date().toISOString(),
    mode,
    interventionScope: scope,
    preset: preset.id,
    codexPrompt,
    geminiPrompt,
    claudeComfyPrompt,
    universalJsonSpec,
    negativeConstraints,
    revisionDeltaPrompt
  };
}

module.exports = {
  STUDIO_CREW,
  STUDIO_PRESETS,
  ROLE_ALIAS_MAP,
  normalizeRoleId,
  getCrewList,
  resolvePreset,
  buildProductionPacks
};

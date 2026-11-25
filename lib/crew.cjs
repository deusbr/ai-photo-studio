'use strict';

const { recommendCraftStack } = require('./craft-planner.cjs');

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
      'Extract the emotional and visual essence of the anchor photo first, then craft bespoke world-building, foreground depth layering, frame-within-a-frame composition, skin-safe color harmony, and natural decisive-moment posture.',
    deliverables: [
      'essenceAnalysis',
      'concept',
      'artDirectionRationale',
      'compositionArchitecture',
      'colorHarmony',
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
    title: 'Director of Photography — Lighting & Atmosphere',
    mission:
      'Design physically motivated lighting sources, deliberate contrast ratios (2:1 to 8:1), negative fill shadow sculpting, Kelvin color-temperature separation, and believable specular/iris catchlights.',
    deliverables: [
      'motivatedLightSource',
      'contrastRatio',
      'negativeFill',
      'kelvinSeparation',
      'lightQualityAndModifier',
      'lightingSetup',
      'kelvinAndCatchlights',
      'shadowPhysics',
      'atmosphereNotes'
    ],
    legacyAliases: []
  },
  {
    id: 'camera-optics',
    order: 6,
    agentHandle: 'Câmera & Lentes',
    title: 'Optics, Film Emulsion & Color Science Consultant',
    mission:
      'Specify camera body, prime focal length, aperture, camera elevation/angle, optical character (vignette, bloom, halation), and melanin-safe sub-surface skin color science.',
    deliverables: [
      'cameraAndEmulsion',
      'primeLens',
      'cameraAngle',
      'depthOfField',
      'opticalCharacter',
      'skinToneColorScience',
      'colorScience'
    ],
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
  },
  'cinema-trailer': {
    id: 'cinema-trailer',
    name: 'Cinema Trailer Anamorphic (2.39:1)',
    category: 'cinema',
    description: 'Hollywood theatrical trailer frame with Cooke anamorphic optics, Vision3 500T dynamic range, Black Pro-Mist bloom, and teal/amber grading.',
    defaults: {
      cameraAndEmulsion: 'ARRI Alexa 35 REVEAL / Kodak Vision3 500T cinematic film print emulation',
      primeLens: '40mm Cooke Anamorphic/i T2.3 widescreen lens, oval bokeh and subtle horizontal flare',
      cameraAngle: 'Dramatic low-chest three-quarter 2.39:1 theatrical framing with deep foreground-to-background parallax',
      lightingSetup: '90-degree split chiaroscuro key light (6:1 ratio) + heavy negative fill + motivated warm practical edge rim',
      kelvinAndCatchlights: '3200K warm amber subject highlights separated against 6500K cool slate-teal background shadows',
      postureGeometry: 'Cinematic over-the-shoulder turn or grounded hero stance, quiet narrative stillness, relaxed heavy eyelids',
      colorPalette: 'Slate-teal shadow base, warm amber skin/practicals, subdued saturation with luminous highlight roll-off'
    }
  },
  'high-fashion-beauty': {
    id: 'high-fashion-beauty',
    name: 'High-Fashion Beauty & Makeup',
    category: 'beauty',
    description: 'Close-up editorial beauty and cosmetic lighting preserving authentic skin pores, fine hair, and sculptural cheekbone highlights.',
    defaults: {
      cameraAndEmulsion: 'Hasselblad X2D 100C / Kodak Portra 400 ultra-high-bit tonal transitions',
      primeLens: '105mm f/1.4 telephoto portrait prime eliminating perspective distortion, tack-sharp iris plane',
      cameraAngle: 'Eye-level tight editorial beauty crop focusing on jawline, cheekbones, and natural gaze',
      lightingSetup: 'Butterfly overhead beauty dish key + subtle lower silver clamshell reflector fill (2:1 ratio)',
      kelvinAndCatchlights: '5400K neutral calibrated beauty strobe with crisp circular upper catchlight and lower clamshell arc',
      postureGeometry: 'Subtle forward head extension (turtle jawline sculpt) + fractional downward chin tilt + graceful edge-of-hand framing',
      colorPalette: 'Luminous skin-true warmth, selective dewy highlight on cheekbones, matte T-zone control'
    }
  },
  'street-flash-editorial': {
    id: 'street-flash-editorial',
    name: 'Street Direct-Flash Editorial',
    category: 'flash',
    description: 'Raw contemporary fashion street energy using axial Contax-style direct strobe, Portra 800 grain, and crisp drop shadow.',
    defaults: {
      cameraAndEmulsion: 'Contax T2 35mm film camera / Kodak Portra 800 punchy analog color science',
      primeLens: '35mm f/1.4 Summilux wide storyteller lens capturing urban depth and candid immediacy',
      cameraAngle: 'Dynamic slightly low waist-up street angle with spontaneous off-balance energy',
      lightingSetup: 'Axial direct on-camera editorial strobe balanced over ambient twilight with crisp tight backdrop shadow',
      kelvinAndCatchlights: '5500K crisp flash key against warm streetlamp/neon ambient background spill',
      postureGeometry: 'Architectural negative-space triangles between arms and torso, mid-stride walk-by or confident candid turn',
      colorPalette: 'Punchy editorial midtones, authentic Portra 800 grain, vibrant selective lip/wardrobe accents'
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

function normalizeSegmentKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function deduplicateSegments(segments = []) {
  const seen = new Set();
  const out = [];
  for (const raw of segments) {
    const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const key = normalizeSegmentKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function sanitizeResearchHighlight(raw, maxLen = 120) {
  let text = String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[(?:\/?(?:SYSTEM|INST|PROMPT|END PRESERVATION GUARD|LOCKS|ANCHOR|NEGATIVE|USER ORDER))[^\]]*\]/gi, ' ')
    .replace(/\b(?:ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?|disregard\s+(?:all\s+)?(?:previous|prior)\s+(?:rules?|instructions?)|override\s+(?:all\s+)?(?:locks?|rules?)|system\s*prompt\s*:|strict\s+preservation\s+rule|do\s+not\s+preserve)\b/gi, ' ')
    .replace(/[<>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (text.length > maxLen) {
    text = `${text.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return text;
}

function extractResearchHighlights(job, craft, existingSnippets = []) {
  const rawItems = [];
  if (Array.isArray(craft?.researchHighlights)) {
    rawItems.push(...craft.researchHighlights);
  }
  if (Array.isArray(job?.craftRecipe?.researchHighlights)) {
    rawItems.push(...job.craftRecipe.researchHighlights);
  }
  if (Array.isArray(job?.researchInsights?.promptHighlights)) {
    rawItems.push(...job.researchInsights.promptHighlights);
  }
  if (Array.isArray(job?.researchInsights?.webReferences)) {
    for (const ref of job.researchInsights.webReferences) {
      if (!ref) continue;
      const piece = ref.title && ref.summary
        ? `${ref.title}: ${ref.summary}`
        : (ref.summary || ref.title || '');
      if (piece) rawItems.push(piece);
    }
  }
  if (Array.isArray(job?.researchInsights?.promptSnippets)) {
    rawItems.push(...job.researchInsights.promptSnippets);
  }

  const existingKeys = new Set(
    existingSnippets
      .filter(Boolean)
      .map((s) => normalizeSegmentKey(s))
  );

  const highlights = [];
  const seen = new Set();
  let totalChars = 0;
  for (const item of rawItems) {
    const clean = sanitizeResearchHighlight(item, 120);
    if (!clean) continue;
    const key = normalizeSegmentKey(clean);
    if (!key || seen.has(key) || existingKeys.has(key)) continue;
    if (highlights.length >= 3) break;
    if (totalChars + clean.length > 360 && highlights.length > 0) break;
    seen.add(key);
    highlights.push(clean);
    totalChars += clean.length;
  }
  return highlights;
}

function toAffirmativeText(raw) {
  let text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // Remove parenthetical negative reminders like "(never ...)" or "(no stiff ...)" or "(avoid ...)"
  text = text.replace(/\(\s*(?:no|not|never|avoid|do\s+not|don't|without|zero)\b[^)]*\)/gi, '');

  // Remove em-dash / hyphen trailing negative tails like "— zero beauty filter..."
  text = text.replace(/\s*[—–-]\s*(?:zero|no|never|do\s+not|don't|avoid)\b[^.]*/gi, '');

  // Split by semicolons/commas and drop purely prohibitive clauses while preserving affirmative descriptors
  const clauses = text.split(/(?<=[.;])\s+|\s*;\s*/);
  const keptClauses = [];
  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;
    if (/^(?:do\s+not|don't|never|avoid|no\s+|zero\s+)/i.test(trimmed)) continue;

    // Strip inline trailing "without ..." / "never ..." / "do not ..." / "avoid ..." phrases
    let cleaned = trimmed
      .replace(/\bwithout\s+[^,.;]+/gi, '')
      .replace(/,\s*(?:no|not|never|zero|avoid|do\s+not|don't)\b[^.;]*/gi, '')
      .replace(/\b(?:do\s+not|don't|never)\s+[^,.;]+/gi, '')
      .replace(/--no\s+[^\n]+/gi, '')
      .replace(/\s+,/g, ',')
      .replace(/,\s*\./g, '.')
      .replace(/\s+\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[,;\s]+|[,;\s]+$/g, '')
      .trim();

    if (cleaned) keptClauses.push(cleaned);
  }

  return keptClauses.join('. ').replace(/\.{2,}/g, '.').trim();
}

function toAffirmativeRealismPhrase(isProduct, antiBeautificationLocks, skinToneColorScience) {
  const baseAffirmative = isProduct
    ? 'Authentic tactile surface micro-texture, true material grain, calibrated real-world specular roll-off, razor-sharp brand logos and label typography, accurate brand Pantone color fidelity'
    : 'Authentic unretouched skin with visible natural pores, fine vellus facial hair, subtle under-eye creases, relaxed natural eyelids and genuine anchor gaze, organic silver-halide micro-grain, realistic fabric weave and folds, natural stray hairs, accurate melanin distribution with rich sub-surface scattering';

  const customClean = toAffirmativeText(antiBeautificationLocks);
  const scienceClean = toAffirmativeText(skinToneColorScience);

  const parts = deduplicateSegments([
    baseAffirmative,
    customClean && customClean.length >= 12 ? customClean : '',
    scienceClean && scienceClean.length >= 12 ? scienceClean : ''
  ]);
  return parts.join(', ').replace(/\.+$/, '');
}

function buildNegativePrompt(isProduct, scope) {
  const terms = isProduct
    ? [
        'amateur wide-angle distortion',
        'harsh flat flash glare',
        'warped typography',
        'distorted or erased brand logos',
        'moire screen patterns',
        'melted geometry',
        'oversaturated HDR halos',
        'artificial CGI gloss',
        'cluttered background'
      ]
    : [
        'beauty filter',
        'plastic skin',
        'waxy airbrushed face',
        'digital skin smoothing',
        'stiff mannequin stare',
        'generic AI stock smile',
        'expression drift',
        'altered or erased garment logos',
        'missing patches or stripes',
        'ambient color shift on clothing',
        'extra fingers',
        'warped anatomy',
        'dead eyes',
        'artificial CGI look',
        'smartphone wide-angle distortion',
        'flat overhead flash',
        'oversaturated HDR halos',
        scope === 'subtle-retouch' ? 'altered pose or wardrobe' : 'cliche European stone balustrade backdrop'
      ];
  return deduplicateSegments(terms).join(', ');
}

function resolveDimensionsForAspectRatio(aspectRatio = '4:5') {
  const normalized = String(aspectRatio || '4:5').trim();
  const presets = {
    '21:9': { width: 1344, height: 576 },
    '2.39:1': { width: 1344, height: 576 },
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768, height: 1344 },
    '4:5': { width: 1024, height: 1280 },
    '5:4': { width: 1280, height: 1024 },
    '3:4': { width: 896, height: 1152 },
    '4:3': { width: 1152, height: 896 },
    '2:3': { width: 832, height: 1216 },
    '3:2': { width: 1216, height: 832 },
    '1:1': { width: 1024, height: 1024 }
  };
  if (presets[normalized]) return presets[normalized];

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i);
  if (match) {
    const wRatio = Number(match[1]);
    const hRatio = Number(match[2]);
    if (wRatio > 0 && hRatio > 0) {
      const targetArea = 1024 * 1024;
      const ratio = wRatio / hRatio;
      const rawW = Math.sqrt(targetArea * ratio);
      const rawH = Math.sqrt(targetArea / ratio);
      const snap64 = (v) => Math.max(512, Math.min(1536, Math.round(v / 64) * 64));
      return { width: snap64(rawW), height: snap64(rawH) };
    }
  }
  return { width: 1024, height: 1280 };
}

function buildComfyWorkflow(job, options = {}) {
  const packs = options.promptPacks || job?.promptPacks || {};
  const preset = resolvePreset(job?.preset);
  const targetAspectRatio = options.aspectRatio
    || (preset.id === 'cinema-trailer'
      ? '21:9'
      : (job?.crewPasses?.['showrunner-director']?.targetAspectRatio || job?.sourceImage?.aspectRatio || '4:5'));
  const dims = resolveDimensionsForAspectRatio(targetAspectRatio);

  const scope = job?.interventionScope || job?.crewPasses?.['showrunner-director']?.interventionScope || 'full-editorial';
  const checkpoint = String(options.checkpoint || process.env.COMFYUI_CHECKPOINT || 'flux1-dev-fp8.safetensors').trim();
  const isFluxCheckpoint = /flux/i.test(checkpoint);
  const anchorImageName = String(
    options.anchorImageName
    || job?.sourceImage?.cleanedAssetName
    || job?.sourceImage?.fileName
    || 'anchor.png'
  );
  const positiveText = String(options.positivePrompt || packs.positivePrompt || packs.fluxPrompt || packs.claudeComfyPrompt || '').trim();
  const negativeText = String(options.negativePrompt || packs.negativePrompt || (packs.negativeConstraints || []).join(', ')).trim();
  const seed = Number.isFinite(Number(options.seed)) ? Math.floor(Number(options.seed)) : 424242;
  const steps = Number.isFinite(Number(options.steps)) ? Math.max(1, Math.floor(Number(options.steps))) : 28;
  const cfg = Number.isFinite(Number(options.cfg)) ? Number(options.cfg) : (isFluxCheckpoint ? 3.5 : 6.5);
  const scopeDenoise = scope === 'subtle-retouch' ? 0.25 : scope === 'targeted-edit' ? 0.45 : 0.65;
  const useImg2Img = Boolean(options.img2img);
  const denoise = Number.isFinite(Number(options.denoise))
    ? Number(options.denoise)
    : (useImg2Img ? scopeDenoise : 1.0);
  const safeJobId = String(job?.id || 'studio').replace(/[^a-zA-Z0-9_-]+/g, '_');

  const workflow = {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: checkpoint
      },
      _meta: { title: 'Load Checkpoint' }
    },
    '2': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: positiveText,
        clip: ['1', 1]
      },
      _meta: { title: 'CLIP Text Encode (Positive)' }
    },
    '3': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: negativeText,
        clip: ['1', 1]
      },
      _meta: { title: 'CLIP Text Encode (Negative)' }
    },
    '4': {
      class_type: 'LoadImage',
      inputs: {
        image: anchorImageName,
        upload: 'image'
      },
      _meta: { title: 'Load Anchor Image' }
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: dims.width,
        height: dims.height,
        batch_size: 1
      },
      _meta: { title: `Empty Latent Image (${targetAspectRatio})` }
    },
    '6': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg,
        sampler_name: options.samplerName || 'euler',
        scheduler: options.scheduler || 'simple',
        denoise,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: useImg2Img ? ['9', 0] : ['5', 0]
      },
      _meta: { title: 'KSampler' }
    },
    '7': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['6', 0],
        vae: ['1', 2]
      },
      _meta: { title: 'VAE Decode' }
    },
    '8': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: `ai_photo_studio_${safeJobId}`,
        images: ['7', 0]
      },
      _meta: { title: 'Save Image' }
    }
  };

  if (useImg2Img) {
    workflow['9'] = {
      class_type: 'VAEEncode',
      inputs: {
        pixels: ['4', 0],
        vae: ['1', 2]
      },
      _meta: { title: 'VAE Encode (Anchor)' }
    };
  }

  return workflow;
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
  const craft = job.craftRecipe || recommendCraftStack({
    brief: job.userBrief || '',
    subjectType: isProduct ? 'product' : (showrunner.subjectType || job.subjectType || 'portrait'),
    presetId: preset.id,
    locks,
    craftOptions: job.craftOptions || {},
    researchInsights: job.researchInsights || null
  });
  const camera = cameraPass.cameraAndEmulsion || craft.camera?.promptSnippet || preset.defaults.cameraAndEmulsion;
  const lens = cameraPass.primeLens || craft.lens?.promptSnippet || preset.defaults.primeLens;
  const angle = locks.keepFraming
    ? 'Preserve original camera framing while correcting minor lens barrel distortion'
    : (cameraPass.cameraAngle || preset.defaults.cameraAngle);
  const opticalEffects = cameraPass.opticalEffects || (craft.effects?.length ? craft.effects.map((e) => e.promptSnippet).join('; ') : '');
  const opticalCharacter = cameraPass.opticalCharacter || [
    'Natural optical vignette, micro-contrast, subtle highlight roll-off without sterile digital sharpness.',
    opticalEffects ? `Optical filters & effects: ${opticalEffects}.` : ''
  ].filter(Boolean).join(' ');
  const skinToneColorScience = cameraPass.skinToneColorScience || (isProduct
    ? 'True brand Pantone color fidelity without ambient spill clipping.'
    : 'Accurate melanin distribution, rich sub-surface scattering, warm natural skin undertones without muddy grey shadows.');
  const makeupStyling = isProduct
    ? ''
    : (art.makeupStyling || (scope === 'subtle-retouch' ? '' : (craft.makeup?.promptSnippet || '')));

  const lighting = lightingPass.lightingSetup || preset.defaults.lightingSetup;
  const kelvin = lightingPass.kelvinAndCatchlights || preset.defaults.kelvinAndCatchlights;
  const motivatedLight = lightingPass.motivatedLightSource || 'Natural directional light motivated by the environment (window, open sky, or practical fixture).';
  const contrastRatio = lightingPass.contrastRatio || (isProduct ? '3:1 clean sculpted studio contrast' : '3:1 to 4:1 sculpted editorial contrast ratio');
  const negativeFill = lightingPass.negativeFill || 'Strategic negative fill on the shadow side absorbing stray ambient bounce to carve 3D facial/form depth.';
  const kelvinSeparation = lightingPass.kelvinSeparation || 'Balanced foreground/background color temperature contrast creating natural spatial separation.';

  const essenceSummary = art.essenceAnalysis || showrunner.essenceAnalysis || '';
  const compositionArch = art.compositionArchitecture || (isProduct
    ? 'Three-plane depth separation with clean foreground shadow grounding and uncluttered backdrop.'
    : 'Three-plane depth (subtle out-of-focus foreground layering + sharp midground subject + deep bokeh background) capturing an authentic decisive moment.');
  const colorHarmony = art.colorHarmony || 'Cohesive tonal harmony protecting skin undertones and true garment hues.';

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
    : 'Preserve the exact mouth/eye expression, relaxed eyelid heaviness, and natural head tilt from the anchor image (never widen eyes into a stiff stare or invent a generic AI smile).');
  const garmentMicroDetails = guardian.garmentMicroDetails || (isProduct
    ? 'Exact brand logos, label typography, seams, and true base colors.'
    : 'Preserve exact collars, loose/boxy or tailored fabric drape, stripe spacing, chest patches/logos, cap embroidery, buttons, straps, and jewelry without stiffening or redrawing them; do not let ambient light shift true fabric colors.');
  const antiBeautificationLocks = guardian.antiBeautificationLocks || (isProduct
    ? 'Authentic surface micro-texture, real-world specular roll-off, zero CGI gloss.'
    : 'Unretouched natural skin with visible pores, fine vellus facial hair, natural under-eye creases, relaxed natural gaze/eyelids, authentic fabric folds, and stray hairs — zero beauty filter, zero mannequin stare, zero digital smoothing.');

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
        'No beauty filter, no plastic/waxy skin smoothing, no stiff mannequin stare, no generic AI stock smile, no expression drift',
        'No cliché European stone villa/balustrade backgrounds unless explicitly requested; background must match real outfit context',
        'No altered or erased garment logos, patches, collars, fabric fit, or stripe patterns; no ambient color shift on clothing',
        'No extra fingers, warped anatomy, dead eyes without catchlights, or artificial CGI look'
      ];

  const identityRule = isProduct
    ? 'Preserve exact product geometry, brand logos, label typography, and authentic surface micro-texture.'
    : 'Preserve exact facial structure, skin tone, hair/subject proportions, and realistic micro-texture. Zero-invention policy: keep original subject count and accessories faithful.';

  // Concise, high-signal end guard without pasting expressionTruth or garmentMicroDetails a second time
  const endPreservationGuard = isProduct
    ? 'STRICT PRESERVATION RULE (DO NOT VIOLATE): Keep exact product geometry, brand logos, label typography, hardware, and true base colors 100% unchanged under final lighting.'
    : 'STRICT PRESERVATION RULE (DO NOT VIOLATE): Lock exact facial bone structure, anchor expression truth, natural unretouched skin texture, and every garment micro-detail & fabric fit 100% unchanged.';

  const researchHighlights = extractResearchHighlights(job, craft, [
    craft.pose?.promptSnippet,
    craft.camera?.promptSnippet,
    craft.lens?.promptSnippet,
    craft.makeup?.promptSnippet,
    craft.lighting?.promptSnippet,
    ...(craft.effects || []).map((e) => e.promptSnippet)
  ]);
  const researchNotesLine = researchHighlights.length
    ? `Reference Craft Notes: ${researchHighlights.join(' | ')}.`
    : '';

  const targetAspectRatio = preset.id === 'cinema-trailer'
    ? '21:9'
    : (job.crewPasses?.['showrunner-director']?.targetAspectRatio || job.sourceImage?.aspectRatio || '4:5');

  const affirmativeRealism = toAffirmativeRealismPhrase(isProduct, antiBeautificationLocks, skinToneColorScience);
  const negativePrompt = buildNegativePrompt(isProduct, scope);

  const affConcept = toAffirmativeText(concept);
  const affLocation = toAffirmativeText(location);
  const affWardrobe = toAffirmativeText(wardrobe);
  const affMakeup = toAffirmativeText(makeupStyling);
  const affPosture = toAffirmativeText(posture);
  const affFacial = toAffirmativeText(facial);
  const affHands = toAffirmativeText(hands);
  const affComposition = toAffirmativeText(compositionArch);
  const affColorHarmony = toAffirmativeText(colorHarmony);
  const affOptical = toAffirmativeText(opticalCharacter);
  const affCamera = toAffirmativeText(camera);
  const affLens = toAffirmativeText(lens);
  const affAngle = toAffirmativeText(angle);
  const affMotivated = toAffirmativeText(motivatedLight);
  const affLighting = toAffirmativeText(lighting);
  const affContrast = toAffirmativeText(contrastRatio);
  const affNegFill = toAffirmativeText(negativeFill);
  const affKelvinSep = toAffirmativeText(kelvinSeparation);
  const affKelvin = toAffirmativeText(kelvin);
  const affExpression = toAffirmativeText(expressionTruth);
  const affGarment = toAffirmativeText(garmentMicroDetails);
  const affEssence = toAffirmativeText(essenceSummary);
  const affResearch = researchHighlights.length
    ? `Reference Craft Notes: ${researchHighlights.map((h) => toAffirmativeText(h)).filter(Boolean).join(' | ')}.`
    : '';

  const positivePrompt = deduplicateSegments([
    `${preset.name} photograph: ${affConcept}.`,
    affEssence ? `Essence: ${affEssence}.` : '',
    `Setting: ${affLocation}.`,
    `Wardrobe & Props: ${affWardrobe}${affGarment ? ` (${affGarment})` : ''}.`,
    affMakeup ? `Makeup & Grooming: ${affMakeup}.` : '',
    `Composition & Pose: ${affComposition}. ${affPosture}. ${affFacial}. ${affHands}.`,
    affExpression ? `Expression Fidelity: ${affExpression}.` : '',
    `Camera & Optics: ${/^shot on\b/i.test(affCamera) ? affCamera : `Shot on ${affCamera}`} with ${affLens}, ${affAngle}, ${affOptical}.`,
    `Lighting Physics: ${affMotivated}, ${affLighting}, ${affContrast}, ${affNegFill}, ${affKelvinSep}, ${affKelvin}.`,
    `Color & Texture: ${affColorHarmony}, palette ${palette}, ${affirmativeRealism}.`,
    affResearch
  ]).join(' ');

  const fluxPrompt = deduplicateSegments([
    `Candid ${preset.name.toLowerCase()} photograph framed in ${targetAspectRatio} aspect ratio.`,
    affEssence ? `${affEssence}.` : '',
    `${affConcept} set in ${affLocation}.`,
    `Subject wears ${affWardrobe}${affGarment ? `, preserving ${affGarment}` : ''}.`,
    affMakeup ? `Editorial grooming and makeup: ${affMakeup}.` : '',
    `${affComposition}. ${affPosture}. ${affFacial}. ${affHands}.`,
    affExpression ? `${affExpression}.` : '',
    `${/^shot on\b/i.test(affCamera) ? affCamera : `Shot on ${affCamera}`} paired with ${affLens} at ${affAngle}, rendering ${affOptical}.`,
    `Illuminated by ${affMotivated}, ${affLighting}, ${affContrast}, shaped with ${affNegFill}, ${affKelvinSep}, ${affKelvin}.`,
    `${affColorHarmony} with ${palette} tones and ${affirmativeRealism}.`,
    affResearch
  ]).join(' ');

  const mjPositiveBody = deduplicateSegments([
    `${preset.name}, ${affConcept}`,
    `setting: ${affLocation}`,
    `wardrobe: ${affWardrobe}`,
    affMakeup ? `makeup and grooming: ${affMakeup}` : '',
    `pose and framing: ${affPosture}, ${affAngle}`,
    `camera and lens: ${affCamera}, ${affLens}, ${affOptical}`,
    `lighting: ${affMotivated}, ${affLighting}, ${affContrast}, ${affKelvinSep}`,
    isProduct ? 'crisp brand typography, authentic material micro-texture, calibrated studio specular roll-off' : affirmativeRealism,
    affResearch
  ]).join(', ');

  const midjourneyPrompt = `${mjPositiveBody} --ar ${targetAspectRatio} --style raw --no ${negativePrompt}`;
  const midjourneyFluxPrompt = `${mjPositiveBody} --ar ${targetAspectRatio} --no ${negativePrompt}`;

  const directiveClause = (mode === 'directed' && job.userBrief)
    ? `User Art Direction (Must Follow): ${job.userBrief}`
    : `Autonomous Studio Mode (${mode}): Execute context-matched creative direction cleanly.`;
  const lockClause = lockedList.length ? `Locked Elements (Immutable): ${lockedList.join(', ')}.` : '';

  const codexPrompt = deduplicateSegments([
    `Edit and re-direct the attached reference image using it STRICTLY as the ${isProduct ? 'product' : 'biometric/subject'} identity anchor (${job.sourceImage?.cleanedAssetName || job.sourceImage?.fileName || 'source image'}).`,
    `Mode: ${mode} | Scope: ${scope}. ${directiveClause}`,
    essenceSummary ? `Photo Essence: ${essenceSummary}` : '',
    lockClause,
    `Corrections required: ${corrections}`,
    `Identity & Detail Anchor: ${deduplicateSegments([expressionTruth, garmentMicroDetails]).join(' ')}`,
    `Concept & Scene: ${concept}. Location (Context-Matched): ${location}. Styling/Props: ${wardrobe}.${makeupStyling ? ` Makeup & Grooming: ${makeupStyling}.` : ''} Color Harmony: ${colorHarmony} (${palette}).`,
    `Composition & Staging: ${compositionArch} ${posture}. ${facial}. ${hands}.`,
    `Cinematography & Lighting Physics: ${/^shot on\b/i.test(camera) ? camera : `Shot on ${camera}`} with ${lens}. Camera angle: ${angle}. ${opticalCharacter} ${skinToneColorScience}`,
    `Light Rig: Motivated by ${motivatedLight}. ${lighting}. Contrast Ratio: ${contrastRatio}. ${negativeFill} ${kelvinSeparation} ${kelvin}.`,
    researchNotesLine,
    `Anti-Slop Realism: ${antiBeautificationLocks}`,
    `Constraints: ${negativeConstraints.join('; ')}.`,
    endPreservationGuard
  ]).join('\n');

  const geminiTail = isProduct
    ? `Render authentic photographic optics and tactile material detail. Avoid: ${negativePrompt}. ${endPreservationGuard}`
    : `Candid real-world photography look: ${antiBeautificationLocks} ${skinToneColorScience} Avoid: ${negativePrompt}. ${endPreservationGuard}`;

  const geminiPrompt = deduplicateSegments([
    `Transform the attached photo (${scope}) into a candid ${preset.name} photograph while strictly preserving the ${isProduct ? "product's exact design, proportions, and markings" : "subject's exact identity, relaxed natural gaze, facial asymmetry, and real expression"}.`,
    essenceSummary ? `Honor photo essence: ${essenceSummary}.` : '',
    (mode === 'directed' && job.userBrief) ? `Follow exact user direction: ${job.userBrief}.` : '',
    lockClause,
    `Identity & Detail Anchor: ${deduplicateSegments([expressionTruth, garmentMicroDetails]).join(' ')}`,
    scope === 'subtle-retouch'
      ? `Keep the original scene, pose, and outfit faithful while applying: ${posture}; ${facial}.`
      : `Upgrade from amateur snapshot framing to editorial craft: ${compositionArch}; ${posture}; ${facial}; ${hands}.`,
    `Context-Matched Scene & Styling: ${location}; ${wardrobe}${makeupStyling ? `; Makeup/Grooming: ${makeupStyling}` : ''}; ${colorHarmony}; palette ${palette}.`,
    `Cinematography & Lighting: ${camera}, ${lens}, ${angle}, ${opticalCharacter}. Motivated light: ${motivatedLight}; ${lighting}; ${contrastRatio}; ${negativeFill}; ${kelvinSeparation}; ${kelvin}.`,
    researchNotesLine,
    geminiTail
  ]).join(' ');

  const claudeComfyPrompt = deduplicateSegments([
    `[STUDIO WORKFLOW] mode=${mode} scope=${scope} preset=${preset.id} compiler=5.0.0`,
    `[ANCHOR] ${job.sourceImage?.cleanedAssetName || job.sourceImage?.fileName || 'source'} (${job.sourceImage?.width || '?'}x${job.sourceImage?.height || '?'}) | ${identityRule}`,
    essenceSummary ? `[ESSENCE] ${essenceSummary}` : '',
    lockClause ? `[LOCKS] ${lockedList.join(' | ')}` : '',
    `[EXPRESSION TRUTH] ${expressionTruth}`,
    `[GARMENT MICRO-DETAILS] ${garmentMicroDetails}`,
    makeupStyling ? `[MAKEUP & GROOMING] ${makeupStyling}` : '',
    `[ANTI-SLOP SKIN/TEXTURE] ${antiBeautificationLocks} | ${skinToneColorScience}`,
    (mode === 'directed' && job.userBrief) ? `[USER ORDER] ${job.userBrief}` : `[AUTO CONCEPT] ${concept}`,
    `[COMPOSITION] ${compositionArch}`,
    `[LIGHTING PHYSICS] motivated=${motivatedLight} | ratio=${contrastRatio} | negativeFill=${negativeFill} | kelvinSep=${kelvinSeparation} | ${lighting} | ${kelvin}`,
    `[OPTICS] ${camera} | ${lens} | ${angle} | ${opticalCharacter}`,
    `[ART & POSE] ${location} | ${wardrobe} | ${posture}`,
    researchNotesLine ? `[RESEARCH HIGHLIGHTS] ${researchNotesLine}` : '',
    `[NEGATIVE] ${negativePrompt}`,
    `[END PRESERVATION GUARD] ${endPreservationGuard}`
  ]).join('\n');

  let revisionDeltaPrompt = null;
  if (auditor && auditor.verdict === 'revise' && auditor.revisionNotes) {
    const routes = Array.isArray(auditor.routeToRoles) && auditor.routeToRoles.length
      ? auditor.routeToRoles.join(', ')
      : 'consistency-guardian, prompt-editor';
    revisionDeltaPrompt = deduplicateSegments([
      `TARGETED REVISION PASS (Fix ONLY the flagged issues on the latest render while keeping composition & identity locked):`,
      `Routed Specialists: ${routes}.`,
      `QA Critique to Resolve: ${auditor.revisionNotes}`,
      lockClause || 'Preserve established framing, pose, and subject identity from anchor.',
      endPreservationGuard
    ]).join('\n');
  }

  const comfyWorkflow = buildComfyWorkflow(job, {
    aspectRatio: targetAspectRatio,
    positivePrompt,
    negativePrompt
  });

  const universalJsonSpec = {
    studio: 'ai-photo-studio',
    version: '4.0.0',
    compilerVersion: '5.0.0',
    mode,
    interventionScope: scope,
    preset: preset.id,
    targetAspectRatio,
    anchorImage: job.sourceImage?.cleanedAssetName || job.sourceImage?.fileName || null,
    essenceAnalysis: essenceSummary || null,
    userBrief: mode === 'directed' ? (job.userBrief || null) : null,
    locks,
    lockedAttributes: lockedList,
    expressionTruth,
    garmentMicroDetails,
    antiBeautificationLocks,
    antiInertiaCorrections: corrections,
    endPreservationGuard,
    positivePrompt,
    negativePrompt,
    fluxPrompt,
    midjourneyPrompt,
    researchHighlights,
    comfyWorkflow,
    artDirection: { concept, wardrobe, location, palette, compositionArch, colorHarmony, makeupStyling: makeupStyling || null },
    opticsAndLighting: {
      camera,
      lens,
      angle,
      opticalCharacter,
      opticalEffects: opticalEffects || null,
      skinToneColorScience,
      motivatedLight,
      lighting,
      contrastRatio,
      negativeFill,
      kelvinSeparation,
      kelvin
    },
    poseAndStyling: { posture, facial, hands },
    craftRecipe: {
      poseId: craft.pose?.id || null,
      cameraId: craft.camera?.id || null,
      lensId: craft.lens?.id || null,
      effectIds: (craft.effects || []).map((e) => e.id),
      makeupId: craft.makeup?.id || null,
      lightingId: craft.lighting?.id || null,
      warnings: craft.warnings || []
    },
    negativeConstraints,
    revisionDeltaPrompt
  };

  return {
    generatedAt: new Date().toISOString(),
    compilerVersion: '5.0.0',
    mode,
    interventionScope: scope,
    preset: preset.id,
    targetAspectRatio,
    positivePrompt,
    negativePrompt,
    codexPrompt,
    geminiPrompt,
    claudeComfyPrompt,
    fluxPrompt,
    midjourneyPrompt,
    midjourneyFluxPrompt,
    researchHighlights,
    comfyWorkflow,
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
  deduplicateSegments,
  sanitizeResearchHighlight,
  toAffirmativeText,
  resolveDimensionsForAspectRatio,
  buildComfyWorkflow,
  buildProductionPacks
};

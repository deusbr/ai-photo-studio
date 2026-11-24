'use strict';

const { CRAFT_CATALOG } = require('./craft-library.cjs');

function findById(category, id) {
  if (!id || !CRAFT_CATALOG[category]) return null;
  return CRAFT_CATALOG[category].find((item) => item.id === id) || null;
}

function pickBestItem(category, { explicitId, brief = '', presetId = '', subjectType = 'portrait' } = {}) {
  const items = CRAFT_CATALOG[category] || [];
  if (explicitId) {
    const exact = findById(category, explicitId);
    if (exact) return exact;
  }

  const q = `${brief} ${presetId}`.toLowerCase();

  // Explicit intent keywords in PT-BR and EN
  const keywordBoosts = {
    poses: [
      [/jaw|mandib|turtle|queixo/i, 'turtle-jawline-power'],
      [/hand|m[aã]o|dedo|finger/i, 'edge-of-hand-grace'],
      [/triangle|tri[aâ]ngulo|alta costura|high[- ]fashion/i, 'negative-space-triangles'],
      [/walk|caminh|street|rua|stride/i, 'mid-stride-walkby'],
      [/cafe|caf[eé]|sentad|seat|mesa|table/i, 'seated-cafe-lean'],
      [/shoulder|ombro|trailer|cinema|noir/i, 'over-shoulder-cinema'],
      [/exec|linkedin|corporat|founder|autoridade/i, 'executive-authority'],
      [/low[- ]angle|baixo|hero/i, 'low-angle-hero'],
      [/flat[- ]lay|topo|overhead/i, 'product-flat-lay']
    ],
    cameras: [
      [/trailer|alexa|vision3|cinema/i, 'arri-alexa35-vision3'],
      [/cinestill|800t|neon|noite|night/i, 'leica-m6-cinestill800t'],
      [/p&b|b&w|black and white|preto e branco|monochrom|hp5|tri-x/i, 'leica-m11-monochrom-hp5'],
      [/contax|flash|paparazzi|y2k/i, 'contax-t2-portra800'],
      [/fuji|gfx|pro\s*400h|praia|daylight|outdoor/i, 'fujifilm-gfx100ii-pro400h'],
      [/phase\s*one|150mp|produto|product|comercial/i, 'phase-one-iq4-150mp'],
      [/leica\s*m11|exec|linkedin/i, 'leica-m11-summilux']
    ],
    lenses: [
      [/anamorf|anamorphic|2\.39|trailer|cooke/i, '40mm-cooke-anamorphic'],
      [/135mm|plena/i, '135mm-f18-plena'],
      [/105mm|beauty|exec/i, '105mm-f14-sigma'],
      [/100mm|macro.*(make|beauty|pele)|eye close/i, '100mm-f28-macro'],
      [/90mm|tilt|produto|product/i, '90mm-f56-macro-tilt'],
      [/24mm|wide|arquitet/i, '24mm-f14-gm'],
      [/35mm|street|rua|walk/i, '35mm-f14-summilux'],
      [/50mm|noctilux|couple|casal|cafe/i, '50mm-f12-noctilux']
    ],
    effects: [
      [/pro[- ]?mist\s*1\/4|trailer|cinema/i, 'black-pro-mist-1-4'],
      [/pro[- ]?mist|bloom|difus/i, 'black-pro-mist-1-8'],
      [/glimmer|sparkle|brilho/i, 'glimmerglass-1-4'],
      [/flare|anamorf/i, 'anamorphic-flare-streak'],
      [/prism|vidro|glass/i, 'foreground-prism-refraction'],
      [/haze|neblina|fuma[cç]a|volum/i, 'volumetric-haze-beams'],
      [/drag|arrasto|1\/15|motion/i, 'slow-shutter-drag'],
      [/paparazzi|direct flash|flash direto/i, 'direct-flash-paparazzi'],
      [/wet|molhad|chuva|rain/i, 'wet-street-specular'],
      [/teal.*amber|amber.*teal|trailer/i, 'teal-amber-trailer-grade']
    ],
    makeup: [
      [/glass skin|dewy|glow|editorial.*make|beauty/i, 'editorial-glass-skin'],
      [/kohl|smudg|esfumad|rock|cinema|noir/i, 'deconstructed-cinema-kohl'],
      [/bronze|melanin|dourad/i, 'melanin-luminous-bronze'],
      [/batom|lipstick|matte lip|velvet|vermelh/i, 'classic-velvet-matte-lip'],
      [/graphic|delinead|avant|wet.*lid/i, 'graphic-avant-garde-liner'],
      [/chuva|rain|suor|grit|a[cç][aã]o/i, 'rain-swept-cinema-grit'],
      [/barba|masculin|groom|stubble/i, 'masculine-natural-grooming']
    ],
    lighting: [
      [/butterfly|paramount|beauty dish|beauty/i, 'butterfly-paramount-beauty'],
      [/split|chiaroscuro|noir|trailer/i, 'split-noir-chiaroscuro'],
      [/golden|dourad|p[oô]r do sol|sunset/i, 'golden-hour-rim-bounce'],
      [/janela|window|overcast|nublado/i, 'window-overcast-north'],
      [/neon|3200k|tungsten|kelvin|noite|night/i, 'neon-tungsten-kelvin-split'],
      [/flash direto|direct flash|strobe|paparazzi/i, 'direct-on-camera-strobe'],
      [/produto|product|strip|scrim/i, 'commercial-strip-scrim']
    ]
  };

  for (const [re, targetId] of keywordBoosts[category] || []) {
    if (re.test(q)) {
      const hit = findById(category, targetId);
      if (hit) return hit;
    }
  }

  // Fallback by preset/subjectType
  const defaultsByPreset = {
    'cinema-trailer': {
      poses: 'over-shoulder-cinema',
      cameras: 'arri-alexa35-vision3',
      lenses: '40mm-cooke-anamorphic',
      effects: 'teal-amber-trailer-grade',
      makeup: 'deconstructed-cinema-kohl',
      lighting: 'split-noir-chiaroscuro'
    },
    'high-fashion-beauty': {
      poses: 'turtle-jawline-power',
      cameras: 'hasselblad-x2d-portra400',
      lenses: '105mm-f14-sigma',
      effects: 'black-pro-mist-1-8',
      makeup: 'editorial-glass-skin',
      lighting: 'butterfly-paramount-beauty'
    },
    'street-flash-editorial': {
      poses: 'negative-space-triangles',
      cameras: 'contax-t2-portra800',
      lenses: '35mm-f14-summilux',
      effects: 'direct-flash-paparazzi',
      makeup: 'classic-velvet-matte-lip',
      lighting: 'direct-on-camera-strobe'
    },
    'executive-linkedin': {
      poses: 'executive-authority',
      cameras: 'leica-m11-summilux',
      lenses: '105mm-f14-sigma',
      effects: 'black-pro-mist-1-8',
      makeup: 'natural-hydrated-no-makeup',
      lighting: 'window-overcast-north'
    },
    'couple-editorial': {
      poses: 'couple-asymmetric-lean',
      cameras: 'hasselblad-x2d-portra400',
      lenses: '50mm-f12-noctilux',
      effects: 'black-pro-mist-1-8',
      makeup: 'natural-hydrated-no-makeup',
      lighting: 'window-overcast-north'
    },
    'cinema-night': {
      poses: 'seated-cafe-lean',
      cameras: 'leica-m6-cinestill800t',
      lenses: '50mm-f12-noctilux',
      effects: 'black-pro-mist-1-4',
      makeup: 'deconstructed-cinema-kohl',
      lighting: 'neon-tungsten-kelvin-split'
    },
    'lifestyle-social': {
      poses: 'mid-stride-walkby',
      cameras: 'fujifilm-gfx100ii-pro400h',
      lenses: '35mm-f14-summilux',
      effects: 'black-pro-mist-1-8',
      makeup: 'natural-hydrated-no-makeup',
      lighting: 'golden-hour-rim-bounce'
    },
    'product-commercial': {
      poses: 'product-three-quarter-plinth',
      cameras: 'phase-one-iq4-150mp',
      lenses: '90mm-f56-macro-tilt',
      effects: 'foreground-prism-refraction',
      makeup: null,
      lighting: 'commercial-strip-scrim'
    },
    'editorial-portrait': {
      poses: 'contrapposto-editorial',
      cameras: 'hasselblad-x2d-portra400',
      lenses: '85mm-f14-gm',
      effects: 'black-pro-mist-1-8',
      makeup: 'natural-hydrated-no-makeup',
      lighting: 'rembrandt-45-negfill'
    }
  };

  const presetMap = defaultsByPreset[presetId] || (subjectType === 'product' ? defaultsByPreset['product-commercial'] : defaultsByPreset['editorial-portrait']);
  const mappedId = presetMap[category];
  if (mappedId) {
    const hit = findById(category, mappedId);
    if (hit) return hit;
  }

  return items.find((i) => (i.categories || []).includes(subjectType)) || items[0] || null;
}

function recommendCraftStack({
  brief = '',
  subjectType = 'portrait',
  presetId = 'editorial-portrait',
  locks = {},
  craftOptions = {},
  researchInsights = null
} = {}) {
  const isProduct = subjectType === 'product' || presetId === 'product-commercial';
  const keepPose = Boolean(locks.keepPose);
  const warnings = [];

  const pose = keepPose
    ? null
    : pickBestItem('poses', { explicitId: craftOptions.poseId, brief, presetId, subjectType: isProduct ? 'product' : subjectType });
  if (keepPose && craftOptions.poseId) {
    warnings.push(`Pose lock is active (keepPose=true); custom pose "${craftOptions.poseId}" was skipped to preserve the anchor pose.`);
  }

  const camera = pickBestItem('cameras', { explicitId: craftOptions.cameraId, brief, presetId, subjectType });
  const lens = pickBestItem('lenses', { explicitId: craftOptions.lensId, brief, presetId, subjectType });
  const lighting = pickBestItem('lighting', { explicitId: craftOptions.lightingId, brief, presetId, subjectType });

  let effects = [];
  const requestedEffects = Array.isArray(craftOptions.effectIds)
    ? craftOptions.effectIds
    : (craftOptions.effectId ? [craftOptions.effectId] : []);
  if (requestedEffects.length) {
    effects = requestedEffects.map((id) => findById('effects', id)).filter(Boolean);
  } else {
    const primaryEffect = pickBestItem('effects', { brief, presetId, subjectType });
    if (primaryEffect) effects.push(primaryEffect);
    if (presetId === 'cinema-trailer' || /trailer|cinematic|anamorf/i.test(brief)) {
      const proMist = findById('effects', 'black-pro-mist-1-4');
      const flare = findById('effects', 'anamorphic-flare-streak');
      for (const extra of [proMist, flare]) {
        if (extra && !effects.some((e) => e.id === extra.id)) effects.push(extra);
      }
    }
  }

  const makeup = isProduct
    ? null
    : pickBestItem('makeup', { explicitId: craftOptions.makeupId, brief, presetId, subjectType });

  // Optical guardrail checks
  if (!isProduct && lens && lens.focalMm <= 24 && /(close[- ]?up|headshot|beauty|rost|face)/i.test(`${brief} ${presetId}`)) {
    warnings.push(`Optical warning: ${lens.name} can introduce nasal/perspective distortion in tight portraits. Consider 85mm f/1.4 or 105mm f/1.4.`);
  }
  if (!isProduct && pose && lens && pose.bestFocalLengths?.length) {
    const lensTag = `${lens.focalMm}mm`;
    if (!pose.bestFocalLengths.some((f) => f.startsWith(lensTag))) {
      warnings.push(`Framing synergy tip: "${pose.name}" pairs best with ${pose.bestFocalLengths.join(', ')} (selected ${lens.name}).`);
    }
  }

  return {
    subjectType: isProduct ? 'product' : subjectType,
    presetId,
    pose,
    camera,
    lens,
    effects,
    makeup,
    lighting,
    warnings,
    researchQuery: craftOptions.researchQuery || researchInsights?.query || null,
    researchHighlights: Array.isArray(researchInsights?.webReferences)
      ? researchInsights.webReferences.slice(0, 3).map((r) => `${r.title}: ${r.summary}`)
      : []
  };
}

module.exports = {
  recommendCraftStack
};

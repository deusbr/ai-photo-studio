'use strict';

const { classifyImageGeometry } = require('./image-meta.cjs');
const { resolvePreset, buildProductionPacks } = require('./crew.cjs');
const { recommendCraftStack } = require('./craft-planner.cjs');

function inferSubjectTypeFromHints(text = '', subjectHint = 'auto') {
  if (subjectHint && subjectHint !== 'auto') return subjectHint;
  const q = String(text || '').toLowerCase();
  if (/(product|produto|watch|rel[oó]gio|perfume|bottle|frasco|sneaker|t[eê]nis|packaging|embalagem|ecommerce|e-commerce|monitor|laptop|garrafa)/i.test(q)) {
    return 'product';
  }
  if (/(couple|casal|duo|namorad|noiv|two people|duas pessoas|juntos|together)/i.test(q)) {
    return 'couple';
  }
  if (/(linkedin|corporate|corporativ|executivo|executive|headshot|founder|curr[ií]culo|perfil profissional)/i.test(q)) {
    return 'executive';
  }
  if (/(night|noite|noturn|neon|bar|caf[eé]|cinestill|800t|tungsten|madrugada)/i.test(q)) {
    return 'night';
  }
  if (/(outdoor|praia|beach|parque|park|rua|street|daylight|sol|golden hour|lifestyle)/i.test(q)) {
    return 'outdoor';
  }
  return 'portrait';
}

function parseDirectedIntent(brief = '', overrides = {}) {
  const text = String(brief || '').trim();
  const q = text.toLowerCase();

  const explicitSubtle =
    overrides.scope !== 'full-editorial' &&
    overrides.scope !== 'targeted-edit' &&
    /(subtle\s+(?:retouch|polish|edit|lighting|adjust)|(?:retoque|ajuste)\s+sutil|\bsutil\b.*\b(?:apenas|ilumina[cç][aã]o|nitidez)\b|apenas melhore|s[oó] melhore|tratamento natural|preserv(?:e|ar) tudo|sem mudar(?:\s+nada)?|keep everything|minor polish)/i.test(q);

  const locks = {
    keepPose: overrides.locks?.keepPose === false ? false : Boolean(
      overrides.locks?.keepPose ||
      explicitSubtle ||
      overrides.scope === 'subtle-retouch' ||
      /(mesma pose|mantenha\s+(?:a|minha|sua)?\s*pose|preserv(?:e|ar)\s+(?:a|minha|sua)?\s*pose|keep\s+(?:my|the|original)?\s*pose|sem mudar a pose|n[aã]o mude a pose)/i.test(q)
    ),
    keepWardrobe: overrides.locks?.keepWardrobe === false ? false : Boolean(
      overrides.locks?.keepWardrobe ||
      explicitSubtle ||
      overrides.scope === 'subtle-retouch' ||
      /(mesma roupa|mantenha\s+(?:a|minha|sua|o|meu)?\s*(?:roupa|look|traje)|(?:pose|fundo)\s+e\s+(?:a\s+)?(?:minha\s+)?roupa|preserv(?:e|ar)\s+(?:a|minha)?\s*roupa|keep\s+(?:my|the|original)?\s*(?:outfit|wardrobe|clothes)|preserve clothing)/i.test(q)
    ),
    keepBackground: overrides.locks?.keepBackground === false ? false : Boolean(
      overrides.locks?.keepBackground ||
      explicitSubtle ||
      overrides.scope === 'subtle-retouch' ||
      /(mesmo fundo|mantenha\s+(?:o|meu)?\s*(?:fundo|cen[aá]rio)|(?:pose|roupa)\s+e\s+(?:o\s+)?(?:meu\s+)?(?:fundo|cen[aá]rio)|preserv(?:e|ar)\s+(?:o|meu)?\s*(?:fundo|cen[aá]rio)|keep\s+(?:my|the|original)?\s*(?:background|setting|location)|preserve (?:background|location))/i.test(q)
    ),
    keepFraming: overrides.locks?.keepFraming === false ? false : Boolean(
      overrides.locks?.keepFraming ||
      /(mesmo enquadramento|mantenha\s+(?:o|meu)?\s*enquadramento|keep\s+(?:my|the|original)?\s*framing|same crop|preserve framing)/i.test(q)
    )
  };

  let interventionScope = overrides.scope || null;
  if (!interventionScope) {
    if (explicitSubtle || (locks.keepPose && locks.keepWardrobe && locks.keepBackground)) {
      interventionScope = 'subtle-retouch';
    } else if (
      locks.keepPose ||
      locks.keepWardrobe ||
      locks.keepBackground ||
      /(s[oó] o fundo|apenas o fundo|troque o fundo|change background|replace background|mude a luz|apenas a ilumina[cç][aã]o|melhore a luz|only lighting|remove |remova )/i.test(q)
    ) {
      interventionScope = 'targeted-edit';
    } else {
      interventionScope = 'full-editorial';
    }
  }

  const subjectType = inferSubjectTypeFromHints(text, overrides.subjectHint || 'auto');

  let recommendedPreset = overrides.preset || null;
  if (!recommendedPreset) {
    if (interventionScope === 'subtle-retouch') recommendedPreset = 'subtle-retouch';
    else if (subjectType === 'product') recommendedPreset = 'product-commercial';
    else if (/(trailer|anamorf|anamorphic|2\.39|movie still|cinema trailer|teal and amber)/i.test(q)) recommendedPreset = 'cinema-trailer';
    else if (/(beauty|maquiagem|makeup|glass skin|butterfly|beauty dish)/i.test(q)) recommendedPreset = 'high-fashion-beauty';
    else if (/(direct flash|flash direto|paparazzi|contax|y2k)/i.test(q)) recommendedPreset = 'street-flash-editorial';
    else if (subjectType === 'couple') recommendedPreset = 'couple-editorial';
    else if (subjectType === 'executive') recommendedPreset = 'executive-linkedin';
    else if (subjectType === 'night') recommendedPreset = 'cinema-night';
    else if (subjectType === 'outdoor') recommendedPreset = 'lifestyle-social';
    else recommendedPreset = 'editorial-portrait';
  }

  return {
    brief: text,
    interventionScope,
    locks,
    subjectType,
    recommendedPreset
  };
}

function generateAutonomousProposals(job, options = {}) {
  const geo = classifyImageGeometry(job.sourceImage || {});
  const fileNameHint = String(job.sourceImage?.fileName || '').replace(/[_-]+/g, ' ');
  const subjectType = inferSubjectTypeFromHints(`${fileNameHint} ${job.userBrief || ''}`, options.subjectHint || 'auto');

  if (subjectType === 'product') {
    const p1 = resolvePreset('product-commercial');
    const p2 = resolvePreset('lifestyle-social');
    return {
      subjectType,
      geometry: geo,
      proposals: [
        {
          id: 'prop-hero-commercial',
          label: 'Luxury Commercial Studio Hero',
          preset: p1.id,
          interventionScope: 'full-editorial',
          confidence: 0.94,
          concept: 'High-craft hero campaign product staging on matte architectural stone with crisp specular edge control.',
          locationOrBackdrop: 'Minimalist sculptural limestone pedestal with soft studio depth gradient',
          wardrobeOrProps: 'Hero product centered with clean geometric contact shadow and subtle surface texture',
          lightingSetup: p1.defaults.lightingSetup,
          kelvinAndCatchlights: p1.defaults.kelvinAndCatchlights,
          cameraAndEmulsion: p1.defaults.cameraAndEmulsion,
          primeLens: p1.defaults.primeLens,
          rationale: `Best fit for product geometry (${geo.recommendedTargetRatio}) prioritizing brand typography and surface micro-contrast.`
        },
        {
          id: 'prop-targeted-polish',
          label: 'Clean E-Commerce Light & Reflection Polish',
          preset: 'product-commercial',
          interventionScope: 'targeted-edit',
          confidence: 0.86,
          concept: 'Targeted studio cleanup preserving existing staging while removing harsh glare and boosting label crispness.',
          locationOrBackdrop: 'Preserve original background tone cleaned of distractions and uneven shadows',
          wardrobeOrProps: 'Keep exact product angle and placement untouched',
          lightingSetup: 'Even wrap-around softbox fill eliminating smartphone hotspots',
          kelvinAndCatchlights: '5500K neutral calibrated commercial white balance',
          cameraAndEmulsion: p1.defaults.cameraAndEmulsion,
          primeLens: p1.defaults.primeLens,
          rationale: 'Safest choice when original composition is already accurate for catalog listings.'
        },
        {
          id: 'prop-lifestyle-context',
          label: 'Editorial Daylight Environment',
          preset: p2.id,
          interventionScope: 'full-editorial',
          confidence: 0.79,
          concept: 'Natural sunlit lifestyle placement integrating the product into an authentic tactile tabletop environment.',
          locationOrBackdrop: 'Sunlit architectural travertine table with soft window shadow falloff',
          wardrobeOrProps: 'Minimal organic props (linen, natural glass) never obscuring product markings',
          lightingSetup: p2.defaults.lightingSetup,
          kelvinAndCatchlights: '5200K warm directional window light with soft bounce fill',
          cameraAndEmulsion: p2.defaults.cameraAndEmulsion,
          primeLens: '50mm f/2.8 natural perspective keeping brand text legible',
          rationale: 'High social-engagement option for campaign banners and Instagram storytelling.'
        }
      ]
    };
  }

  if (subjectType === 'couple') {
    const c1 = resolvePreset('couple-editorial');
    const c2 = resolvePreset('lifestyle-social');
    const c3 = resolvePreset('subtle-retouch');
    return {
      subjectType,
      geometry: geo,
      proposals: [
        {
          id: 'prop-couple-editorial',
          label: 'Contemporary Urban Lifestyle Duo',
          preset: c1.id,
          interventionScope: 'full-editorial',
          confidence: 0.93,
          concept: 'Natural candid couple portrait grounded in a modern urban setting that matches casual contemporary attire.',
          locationOrBackdrop: 'Minimalist modern architectural concrete & warm wood lobby / sunlit glass lounge with soft natural depth separation (never generic European stone terraces)',
          wardrobeOrProps: 'Preserve exact casual wardrobe, fabric drape, logos, and accessories of both subjects naturally',
          lightingSetup: c1.defaults.lightingSetup,
          kelvinAndCatchlights: c1.defaults.kelvinAndCatchlights,
          cameraAndEmulsion: c1.defaults.cameraAndEmulsion,
          primeLens: c1.defaults.primeLens,
          rationale: 'Matches casual/streetwear attire cleanly while upgrading lighting and eliminating mirror/phone clutter.'
        },
        {
          id: 'prop-couple-golden',
          label: 'Golden-Hour Street / Café Candid',
          preset: c2.id,
          interventionScope: 'full-editorial',
          confidence: 0.87,
          concept: 'Spontaneous late-afternoon outdoor candid along a clean contemporary city sidewalk or cafe patio.',
          locationOrBackdrop: 'Clean contemporary urban sidewalk / modern specialty cafe facade with soft greenery and warm late-afternoon light',
          wardrobeOrProps: 'Preserve original outfits, fabric drape, and accessories faithfully',
          lightingSetup: c2.defaults.lightingSetup,
          kelvinAndCatchlights: c2.defaults.kelvinAndCatchlights,
          cameraAndEmulsion: c2.defaults.cameraAndEmulsion,
          primeLens: '35mm f/2.0 or 50mm f/1.8 keeping both faces sharp',
          rationale: 'Ideal for authentic everyday lifestyle storytelling matching casual denim/polo outfits.'
        },
        {
          id: 'prop-couple-retouch',
          label: 'Subtle Natural Duo Polish',
          preset: c3.id,
          interventionScope: 'subtle-retouch',
          confidence: 0.82,
          concept: 'Preserve the original moment, poses, outfits, and background while elevating lighting balance and optical depth.',
          locationOrBackdrop: 'Preserve original scene and background context',
          wardrobeOrProps: 'Preserve original outfits and accessories of both subjects',
          lightingSetup: c3.defaults.lightingSetup,
          kelvinAndCatchlights: c3.defaults.kelvinAndCatchlights,
          cameraAndEmulsion: c3.defaults.cameraAndEmulsion,
          primeLens: c3.defaults.primeLens,
          rationale: 'Best when the original snapshot captures an irreplaceable real-world moment.'
        }
      ]
    };
  }

  const pEditorial = resolvePreset('editorial-portrait');
  const pRetouch = resolvePreset('subtle-retouch');
  const thirdId = subjectType === 'night'
    ? 'cinema-night'
    : subjectType === 'outdoor'
      ? 'lifestyle-social'
      : 'executive-linkedin';
  const pThird = resolvePreset(thirdId);

  return {
    subjectType,
    geometry: geo,
    proposals: [
      {
        id: 'prop-editorial-signature',
        label: 'Editorial Magazine Signature',
        preset: pEditorial.id,
        interventionScope: 'full-editorial',
        confidence: 0.94,
        concept: 'GQ/editorial-grade portrait upgrading pose dynamics, 85mm optical compression, and 3D sculpted lighting.',
        locationOrBackdrop: 'Warm textured architectural concrete or muted gallery interior with creamy depth bokeh',
        wardrobeOrProps: 'Structured dark-neutral or textured tailored layers complementary to skin tone',
        lightingSetup: pEditorial.defaults.lightingSetup,
        kelvinAndCatchlights: pEditorial.defaults.kelvinAndCatchlights,
        cameraAndEmulsion: pEditorial.defaults.cameraAndEmulsion,
        primeLens: pEditorial.defaults.primeLens,
        rationale: `Top autonomous pick for ${geo.orientation || 'portrait'} (${geo.recommendedTargetRatio}) removing smartphone distortion and flat lighting.`
      },
      {
        id: 'prop-subtle-retouch',
        label: 'Subtle Natural Polish (Preserve Scene)',
        preset: pRetouch.id,
        interventionScope: 'subtle-retouch',
        confidence: 0.88,
        concept: 'Keep exact original pose, clothing, and setting while adding natural directional light polish and medium-format clarity.',
        locationOrBackdrop: 'Preserve original background cleanly without replacing the environment',
        wardrobeOrProps: 'Preserve exact original clothing and personal accessories',
        lightingSetup: pRetouch.defaults.lightingSetup,
        kelvinAndCatchlights: pRetouch.defaults.kelvinAndCatchlights,
        cameraAndEmulsion: pRetouch.defaults.cameraAndEmulsion,
        primeLens: pRetouch.defaults.primeLens,
        rationale: 'Zero-drift choice when you want the photo to look like a better camera took the exact same moment.'
      },
      {
        id: `prop-${pThird.id}`,
        label: pThird.name,
        preset: pThird.id,
        interventionScope: 'full-editorial',
        confidence: 0.84,
        concept: pThird.description,
        locationOrBackdrop: thirdId === 'cinema-night'
          ? 'Atmospheric evening street cafe with warm tungsten practicals and soft bokeh'
          : thirdId === 'lifestyle-social'
            ? 'Sunlit architectural terrace in late-afternoon open shade'
            : 'Clean modern slate architectural interior with subtle depth separation',
        wardrobeOrProps: thirdId === 'executive-linkedin'
          ? 'Tailored navy/charcoal blazer with crisp minimalist collar'
          : 'Relaxed contemporary smart-casual editorial wardrobe',
        lightingSetup: pThird.defaults.lightingSetup,
        kelvinAndCatchlights: pThird.defaults.kelvinAndCatchlights,
        cameraAndEmulsion: pThird.defaults.cameraAndEmulsion,
        primeLens: pThird.defaults.primeLens,
        rationale: `Strong alternative style matched to ${subjectType} cues and ${geo.framingHint} framing.`
      }
    ]
  };
}

function makeBoardMessage(step, agentId, agentHandle, summary, details = null) {
  return {
    step,
    agentId,
    agentHandle,
    summary,
    details,
    timestamp: new Date().toISOString()
  };
}

function mergeCraftOptions(existing = {}, incoming = {}) {
  const result = { ...existing };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value === null || value === '' || (Array.isArray(value) && !value.length)) delete result[key];
    else if (value !== undefined) result[key] = value;
  }
  return result;
}

function runMultiAgentPipeline(job, options = {}) {
  const mode = options.mode || job.mode || (job.userBrief ? 'directed' : 'autonomous');
  const now = new Date().toISOString();
  const geo = classifyImageGeometry(job.sourceImage || {});

  let proposals = job.proposals || [];
  let selectedProposal = null;
  let intent = null;
  let subjectType = options.subjectHint && options.subjectHint !== 'auto'
    ? options.subjectHint
    : (job.subjectType || 'portrait');
  let interventionScope = options.scope || job.interventionScope || 'full-editorial';
  let locks = { ...(job.locks || {}) };
  let activePreset = options.preset || job.preset;

  const customProposalsInput = Array.isArray(options.customProposals) && options.customProposals.length
    ? options.customProposals
    : (Array.isArray(job.customProposals) && job.customProposals.length ? job.customProposals : null);
  const essenceText = String(options.essenceAnalysis || job.essenceAnalysis || '').trim();
  let directionSource = customProposalsInput || essenceText ? 'essence-vision-synthesized' : 'offline-fallback';

  if (mode === 'autonomous') {
    if (customProposalsInput) {
      proposals = customProposalsInput.map((p, idx) => ({
        id: p.id || `prop-essence-${idx + 1}`,
        label: p.label || `Essence Direction ${idx + 1}`,
        preset: resolvePreset(p.preset || activePreset || 'editorial-portrait').id,
        interventionScope: p.interventionScope || 'full-editorial',
        confidence: Number(p.confidence ?? (0.95 - idx * 0.04)),
        ...p
      }));
    } else {
      const autoPlan = generateAutonomousProposals(job, options);
      proposals = autoPlan.proposals;
      subjectType = autoPlan.subjectType;
    }
    const requestedPropId = options.proposalId || job.selectedProposalId;
    selectedProposal = proposals.find((p) => p.id === requestedPropId) || proposals[0];
    interventionScope = options.scope || selectedProposal.interventionScope;
    activePreset = options.preset || selectedProposal.preset;
    if (interventionScope === 'subtle-retouch') {
      locks = { keepPose: true, keepWardrobe: true, keepBackground: true, keepFraming: Boolean(locks.keepFraming) };
    } else if (interventionScope === 'targeted-edit') {
      locks = { keepPose: true, keepWardrobe: true, keepBackground: Boolean(locks.keepBackground), keepFraming: true };
    } else {
      locks = {
        keepPose: Boolean(options.locks?.keepPose),
        keepWardrobe: Boolean(options.locks?.keepWardrobe),
        keepBackground: Boolean(options.locks?.keepBackground),
        keepFraming: Boolean(options.locks?.keepFraming)
      };
    }
  } else {
    intent = parseDirectedIntent(options.brief ?? job.userBrief ?? '', {
      scope: options.scope,
      locks: options.locks,
      preset: options.preset,
      subjectHint: options.subjectHint
    });
    subjectType = intent.subjectType;
    interventionScope = intent.interventionScope;
    locks = {
      keepPose: Boolean(intent.locks.keepPose || options.locks?.keepPose),
      keepWardrobe: Boolean(intent.locks.keepWardrobe || options.locks?.keepWardrobe),
      keepBackground: Boolean(intent.locks.keepBackground || options.locks?.keepBackground),
      keepFraming: Boolean(intent.locks.keepFraming || options.locks?.keepFraming)
    };
    activePreset = options.preset || intent.recommendedPreset;
  }

  const preset = resolvePreset(activePreset);
  const isProduct = subjectType === 'product' || preset.id === 'product-commercial';
  const isSubtle = interventionScope === 'subtle-retouch';
  const mergedCraftOptions = mergeCraftOptions(job.craftOptions, options.craftOptions);
  const researchInsights = options.researchInsights || job.researchInsights || null;
  const craftRecipe = recommendCraftStack({
    brief: intent?.brief || job.userBrief || selectedProposal?.concept || '',
    subjectType,
    presetId: preset.id,
    locks,
    craftOptions: mergedCraftOptions,
    researchInsights
  });

  const board = [];
  const passes = Object.fromEntries(Object.entries(job.crewPasses || {}).map(([key, value]) => [key, { ...value }]));
  const resetFields = {
    poseId: ['art-stylist', 'postureGeometry'], makeupId: ['art-stylist', 'makeupStyling'],
    cameraId: ['camera-optics', 'cameraAndEmulsion'], lensId: ['camera-optics', 'primeLens'],
    effectIds: ['camera-optics', 'opticalEffects'], effectId: ['camera-optics', 'opticalEffects'],
    lightingId: ['lighting-director', 'lightingSetup']
  };
  for (const [key, value] of Object.entries(options.craftOptions || {})) {
    if ((value === null || value === '' || (Array.isArray(value) && !value.length)) && resetFields[key]) {
      const [role, field] = resetFields[key];
      if (passes[role]) delete passes[role][field];
    }
  }

  // 1. Showrunner / Diretor de Ensaio
  const productionGoal = mode === 'autonomous'
    ? `Autonomous Direction (${selectedProposal.label}): ${selectedProposal.concept}`
    : (intent.brief || `Directed ${preset.name} (${interventionScope})`);

  passes['showrunner-director'] = {
    updatedAt: now,
    mode,
    subjectType,
    interventionScope,
    preset: preset.id,
    directionSource,
    essenceAnalysis: essenceText || null,
    targetAspectRatio: geo.recommendedTargetRatio,
    productionGoal,
    selectedProposalId: selectedProposal ? selectedProposal.id : null
  };
  board.push(
    makeBoardMessage(
      1,
      'showrunner-director',
      'Diretor de Ensaio',
      mode === 'autonomous'
        ? `Modo Autônomo ativo: triagem classificou "${subjectType}" (${geo.framingHint}) e selecionou "${selectedProposal.label}" (${interventionScope}).`
        : `Modo Dirigido ativo: escopo "${interventionScope}", preset "${preset.id}", seguindo ordens exatas do usuário.`,
      { mode, subjectType, interventionScope, preset: preset.id }
    )
  );

  // 2. Forensic Analyst
  const existingForensic = passes['forensic-analyst'] || {};
  const uiStripNote = geo.isTallMobileScreenshot
    ? 'Tall mobile screenshot detected: strip all app UI bars, stories, badges, and stickers; isolate ONLY the inner photograph.'
    : null;
  passes['forensic-analyst'] = {
    updatedAt: now,
    screenshotUiStripRequired: geo.isTallMobileScreenshot,
    poseAndExpressionAudit: existingForensic.poseAndExpressionAudit || (isProduct
      ? 'Audit product alignment, perspective tilt, and label distortion risks.'
      : isSubtle
        ? 'Preserve exact original expression (no smile exaggeration) and posture; check only micro-tension.'
        : 'Record exact original mouth/eye expression truth so the generator never invents a generic AI smile; identify stiff snapshot symmetry or phone occlusion.'),
    lensPerspectiveAudit: existingForensic.lensPerspectiveAudit || (geo.lowResWarning
      ? `Low-resolution source (${job.sourceImage?.width || '?'}x${job.sourceImage?.height || '?'}); enforce clean optical detail without plastic upscaling.`
      : `Counteract typical 24-28mm smartphone perspective distortion with ${preset.defaults.primeLens}.`),
    lightingShadowsAudit: existingForensic.lightingShadowsAudit || 'Replace flat ambient/overhead flash with sculpted directional key + depth fill while avoiding ambient tint shift on clothing.',
    opticsSensorAudit: existingForensic.opticsSensorAudit || 'Remove digital smartphone oversharpening and introduce organic film/medium-format tonal roll-off without skin smoothing.',
    compositionCropAudit: existingForensic.compositionCropAudit || (uiStripNote || `Target ${geo.recommendedTargetRatio} (${geo.framingHint}) eliminating awkward joint crops or distracting edges.`),
    correctionsSummary: existingForensic.correctionsSummary || (isProduct
      ? 'Correct smartphone wide-angle distortion, harsh glare, and cluttered background.'
      : isSubtle
        ? 'Apply subtle lighting balance, optical clarity, and tonal polish while preserving identity, expression, wardrobe, and scene.'
        : `${uiStripNote ? uiStripNote + ' ' : ''}Correct smartphone wide-angle distortion and flat lighting while preventing beautification or garment drift.`)
  };
  board.push(
    makeBoardMessage(
      2,
      'forensic-analyst',
      'Analista Forense',
      `Diagnóstico 5 eixos concluído (${geo.recommendedTargetRatio}${geo.isTallMobileScreenshot ? ' · Screenshot UI detectada' : ''}): ${passes['forensic-analyst'].correctionsSummary}`
    )
  );

  // 3. Consistency Guardian
  const existingGuardian = passes['consistency-guardian'] || {};
  const lockedAttributes = [];
  if (isProduct) {
    lockedAttributes.push('exact product geometry', 'brand logo & typography', 'true material finish');
  } else if (subjectType === 'couple') {
    lockedAttributes.push('both subjects facial identities', 'exact subject count (2)', 'natural relative height & skin tones');
  } else {
    lockedAttributes.push('exact facial bone structure', 'true skin tone & hair texture', 'authentic eye color & proportions');
  }
  if (locks.keepPose) lockedAttributes.push('original pose & expression');
  if (locks.keepWardrobe) lockedAttributes.push('original wardrobe, logos, patches & accessories');
  if (locks.keepBackground) lockedAttributes.push('original background & location');
  if (locks.keepFraming) lockedAttributes.push('original framing & crop');

  passes['consistency-guardian'] = {
    updatedAt: now,
    anchorType: isProduct ? 'product-geometry-anchor' : subjectType === 'couple' ? 'multi-subject-biometric-anchor' : 'single-subject-biometric-anchor',
    lockedAttributes,
    expressionTruth: existingGuardian.expressionTruth || (isProduct
      ? 'Exact hero product label orientation.'
      : 'Lock each subject exact anchor expression (never turn a calm/closed-mouth face into an open-tooth AI smile, and never normalize genuine smiles).'),
    garmentMicroDetails: existingGuardian.garmentMicroDetails || (isProduct
      ? 'Preserve exact brand logos, label text, and material finish.'
      : 'Preserve exact collars, stripe cadence, chest patches/logos, cap embroidery, buttons, bag straps, and jewelry without erasing or simplifying them.'),
    antiBeautificationLocks: existingGuardian.antiBeautificationLocks || (isProduct
      ? 'Preserve authentic material grain and real-world reflections.'
      : 'Zero beauty filter, zero skin smoothing, retain visible pores, fine vellus hair, natural under-eye creases, and slight natural facial asymmetry.'),
    zeroInventionPolicy: 'Strictly forbid inventing unrequested people, generic smiles, tattoos, logos, or clothing alterations.',
    driftRiskFlags: [
      isProduct ? 'logo/text warping' : 'expression & beautification drift (AI slop)',
      'garment patch/logo/stripe simplification',
      geo.lowResWarning ? 'low-res detail hallucination' : 'ambient lighting color shift on fabrics'
    ]
  };
  board.push(
    makeBoardMessage(
      3,
      'consistency-guardian',
      'Guardião de Consistência',
      `Ancoragem Anti-Slop travada (${passes['consistency-guardian'].anchorType}): ${lockedAttributes.join(', ')}.`
    )
  );

  // 4. Art & Set Stylist
  const existingArt = passes['art-stylist'] || {};
  const chosenConcept = selectedProposal
    ? selectedProposal.concept
    : ((mode === 'directed' && job.userBrief) ? `${job.userBrief}` : (existingArt.concept || `${preset.name} visual direction`));
  const chosenLocation = locks.keepBackground
    ? 'Preserve original background setting cleanly (remove only distracting clutter or noise).'
    : (selectedProposal?.locationOrBackdrop || existingArt.locationOrBackdrop || (isProduct
        ? 'Clean architectural matte stone or brushed metal surface coherent with the product category'
        : 'Context-matched contemporary interior, sunlit cafe/gallery wall, or modern urban street coherent with the subjects real wardrobe (avoid cliché European stone balustrades)'));
  const artDirectionRationale = locks.keepBackground
    ? 'Background locked by user request.'
    : (selectedProposal?.rationale || existingArt.artDirectionRationale || 'Location chosen specifically to stay coherent with the subjects real clothing, age, and casual/editorial energy.');
  const compositionArchitecture = selectedProposal?.compositionArchitecture || existingArt.compositionArchitecture || (isProduct
    ? 'Three-plane depth separation with clean foreground shadow grounding and negative space balance.'
    : 'Three-plane depth (subtle out-of-focus foreground layering + sharp midground subject + deep bokeh background) capturing an authentic decisive moment.');
  const colorHarmony = selectedProposal?.colorHarmony || existingArt.colorHarmony || (isProduct
    ? 'Calibrated commercial neutral harmony keeping true Pantone accuracy.'
    : 'Analogous warm-earth & skin-safe grading preserving authentic melanin undertones.');
  const chosenWardrobe = locks.keepWardrobe
    ? 'Preserve original wardrobe, fabric fit, logos, and accessories strictly.'
    : (selectedProposal?.wardrobeOrProps || (isProduct
        ? 'Hero product clean surface staging with minimal tactile accents'
        : 'Preserve subjects real-world wardrobe styling and relaxed fit unless redesign was explicitly requested'));

  passes['art-stylist'] = {
    updatedAt: now,
    essenceAnalysis: essenceText || existingArt.essenceAnalysis || null,
    concept: chosenConcept,
    artDirectionRationale,
    compositionArchitecture,
    colorHarmony,
    wardrobeOrProps: chosenWardrobe,
    locationOrBackdrop: chosenLocation,
    colorPalette: preset.defaults.colorPalette,
    makeupStyling: isProduct
      ? null
      : (isSubtle ? null : (mergedCraftOptions.makeupId || existingArt.makeupStyling ? (craftRecipe.makeup?.promptSnippet || existingArt.makeupStyling) : craftRecipe.makeup?.promptSnippet || null)),
    postureGeometry: locks.keepPose
      ? 'Preserve exact original posture and placement.'
      : (mergedCraftOptions.poseId && craftRecipe.pose ? craftRecipe.pose.promptSnippet : (existingArt.postureGeometry || craftRecipe.pose?.promptSnippet || 'Natural unposed stance with slight relaxed shoulder drop and authentic head tilt (no stiff mannequin posture).')),
    facialOrFocalDirection: locks.keepPose
      ? (isProduct ? 'Maintain original label angle and crispness.' : 'Preserve original gaze and natural expression.')
      : (isProduct ? 'Sharp hero label focus with balanced specular planes' : (craftRecipe.pose?.jawAndGaze || 'Relaxed natural eyelids and unforced expression faithful to anchor (no stiff wide-eyed stare)')),
    handOrPropPlacement: locks.keepPose
      ? 'Preserve original hand/object placement.'
      : (isProduct ? 'Grounded contact shadow on matte surface' : (craftRecipe.pose?.handsAndProps || 'Natural relaxed hands anchored effortlessly'))
  };
  board.push(
    makeBoardMessage(
      4,
      'art-stylist',
      'Diretor de Arte & Styling',
      `Direção (${directionSource}): ${chosenConcept} | Composição: ${compositionArchitecture}${craftRecipe.pose && !locks.keepPose ? ` | Pose: ${craftRecipe.pose.name}` : ''}`
    )
  );

  // 5. Lighting Director
  const existingLight = passes['lighting-director'] || {};
  const motivatedLightSource = selectedProposal?.motivatedLightSource || existingLight.motivatedLightSource || (isProduct
    ? 'Diffused overhead scrim + lateral strip softbox motivated by clean studio daylight.'
    : 'Real-world motivated window or late-afternoon open sky key light at 45 degrees camera-left.');
  const contrastRatio = selectedProposal?.contrastRatio || existingLight.contrastRatio || (isSubtle ? '2:1 subtle natural fill' : (craftRecipe.lighting?.ratio ? `${craftRecipe.lighting.ratio} sculpted editorial contrast` : '3:1 to 4:1 sculpted editorial contrast'));
  const negativeFill = selectedProposal?.negativeFill || existingLight.negativeFill || 'Black V-flat / negative fill on the shadow side absorbing stray bounce to carve cheekbone & form depth.';
  const kelvinSeparation = selectedProposal?.kelvinSeparation || existingLight.kelvinSeparation || '5200K daylight-balanced subject key separated against cooler 6500K open shade or warm 3200K practical depth.';
  const lightQualityAndModifier = selectedProposal?.lightQualityAndModifier || existingLight.lightQualityAndModifier || 'Large 8x8 silk diffusion wrapping soft transitions with crisp specular edges.';

  passes['lighting-director'] = {
    updatedAt: now,
    motivatedLightSource,
    contrastRatio,
    negativeFill,
    kelvinSeparation,
    lightQualityAndModifier,
    lightingSetup: (mergedCraftOptions.lightingId && craftRecipe.lighting?.promptSnippet) || selectedProposal?.lightingSetup || existingLight.lightingSetup || craftRecipe.lighting?.promptSnippet || preset.defaults.lightingSetup,
    kelvinAndCatchlights: selectedProposal?.kelvinAndCatchlights || existingLight.kelvinAndCatchlights || preset.defaults.kelvinAndCatchlights,
    shadowPhysics: isSubtle
      ? 'Soften harsh shadows gently while preserving natural ambient light direction.'
      : `Coherent 3D shadow falloff (${contrastRatio}) anchored to motivated source with ${negativeFill}`,
    atmosphereNotes: isProduct
      ? 'Crisp controlled edge highlights and realistic ground contact shadow.'
      : 'Three-dimensional facial sculpting without waxy/overlit HDR flatness.'
  };
  board.push(
    makeBoardMessage(
      5,
      'lighting-director',
      'Especialista em Iluminação',
      `Luz motivada (${contrastRatio}): ${motivatedLightSource} | Negative Fill ativo.`
    )
  );

  // 6. Camera & Optics
  const existingCam = passes['camera-optics'] || {};
  const craftEffectsText = craftRecipe.effects?.length ? craftRecipe.effects.map((e) => e.promptSnippet).join('; ') : '';
  passes['camera-optics'] = {
    updatedAt: now,
    cameraAndEmulsion: (mergedCraftOptions.cameraId && craftRecipe.camera?.promptSnippet) || selectedProposal?.cameraAndEmulsion || existingCam.cameraAndEmulsion || craftRecipe.camera?.promptSnippet || preset.defaults.cameraAndEmulsion,
    primeLens: (mergedCraftOptions.lensId && craftRecipe.lens?.promptSnippet) || selectedProposal?.primeLens || existingCam.primeLens || craftRecipe.lens?.promptSnippet || preset.defaults.primeLens,
    cameraAngle: locks.keepFraming ? 'Preserve original angle with barrel distortion corrected' : preset.defaults.cameraAngle,
    depthOfField: isProduct ? 'Deep crisp product plane with smooth background falloff' : 'Shallow natural optical bokeh separating foreground/subject/background planes',
    opticalEffects: (mergedCraftOptions.effectIds?.length || mergedCraftOptions.effectId) ? craftEffectsText : (existingCam.opticalEffects || craftEffectsText || null),
    opticalCharacter: existingCam.opticalCharacter || [
      'Organic lens vignette, gentle highlight bloom, fine natural grain without sterile digital sharpening.',
      craftEffectsText ? `Optical filters & effects: ${craftEffectsText}.` : ''
    ].filter(Boolean).join(' '),
    skinToneColorScience: existingCam.skinToneColorScience || (isProduct
      ? 'Exact brand Pantone fidelity and clean specular roll-off.'
      : 'Accurate melanin distribution, rich sub-surface scattering, zero muddy grey shadow clipping.'),
    colorScience: preset.defaults.colorPalette
  };
  board.push(
    makeBoardMessage(
      6,
      'camera-optics',
      'Câmera & Lentes',
      `Ótica: ${passes['camera-optics'].cameraAndEmulsion} + ${passes['camera-optics'].primeLens}.${craftRecipe.warnings?.length ? ` [Aviso: ${craftRecipe.warnings[0]}]` : ''}`
    )
  );

  const updatedJob = {
    ...job,
    mode,
    subjectType,
    interventionScope,
    locks,
    preset: preset.id,
    presetName: preset.name,
    directionSource,
    essenceAnalysis: essenceText || job.essenceAnalysis || null,
    customProposals: customProposalsInput || job.customProposals || [],
    craftOptions: mergedCraftOptions,
    craftRecipe,
    researchInsights,
    proposals,
    selectedProposalId: selectedProposal ? selectedProposal.id : null,
    crewPasses: passes,
    agentBoard: board,
    status: 'ready-to-render'
  };

  updatedJob.promptPacks = buildProductionPacks(updatedJob);

  // 7. Prompt Editor record
  updatedJob.crewPasses['prompt-editor'] = {
    updatedAt: now,
    enginesCompiled: ['codex', 'gemini', 'claude-comfyui', 'midjourney-flux', 'universal-json'],
    negativeConstraintCount: updatedJob.promptPacks.negativeConstraints.length
  };
  updatedJob.agentBoard.push(
    makeBoardMessage(
      7,
      'prompt-editor',
      'Editor Master',
      `Prompts compilados para Codex, Gemini, Claude/ComfyUI, Midjourney/Flux e Universal JSON (${updatedJob.promptPacks.negativeConstraints.length} restrições negativas).`
    )
  );

  return updatedJob;
}

function evaluateQaScorecard(scorecard = {}) {
  const identityFidelityScore = Number(scorecard.identityFidelityScore ?? 8.5);
  const antiSlopScore = Number(scorecard.antiSlopScore ?? scorecard.realismScore ?? identityFidelityScore);
  const garmentFidelityScore = Number(scorecard.garmentFidelityScore ?? identityFidelityScore);
  const realismScore = Number(scorecard.realismScore ?? identityFidelityScore);
  const lightingCoherenceScore = Number(scorecard.lightingCoherenceScore ?? identityFidelityScore);
  const anatomyScore = Number(scorecard.anatomyScore ?? identityFidelityScore);
  const framingScore = Number(scorecard.framingScore ?? identityFidelityScore);
  const textureAndCatchlightsOk = scorecard.textureAndCatchlightsOk !== false;

  const overallScore = Number(
    (
      (identityFidelityScore * 0.25) +
      (antiSlopScore * 0.2) +
      (garmentFidelityScore * 0.15) +
      (realismScore * 0.15) +
      (lightingCoherenceScore * 0.1) +
      (anatomyScore * 0.1) +
      (framingScore * 0.05)
    ).toFixed(2)
  );

  const triggers = [];
  if (identityFidelityScore < 8) triggers.push('identity-or-expression-drift');
  if (antiSlopScore < 8) triggers.push('ai-slop-beautification-or-artificial-smile');
  if (garmentFidelityScore < 8) triggers.push('garment-logo-or-pattern-loss');
  if (realismScore < 7.5 || !textureAndCatchlightsOk) triggers.push('plastic-texture-or-missing-catchlights');
  if (lightingCoherenceScore < 7.5) triggers.push('lighting-shadow-mismatch');
  if (anatomyScore < 7.5) triggers.push('anatomy-or-geometry-artifact');
  if (framingScore < 7) triggers.push('anti-inertia-or-framing-failure');

  const requestedVerdict = scorecard.verdict === 'pass' || scorecard.verdict === 'revise' ? scorecard.verdict : null;
  const verdict = requestedVerdict === 'revise' || triggers.length > 0 ? 'revise' : (requestedVerdict || 'pass');

  const routeSet = new Set();
  if (triggers.includes('identity-or-expression-drift') || triggers.includes('ai-slop-beautification-or-artificial-smile')) {
    routeSet.add('consistency-guardian');
  }
  if (triggers.includes('garment-logo-or-pattern-loss')) {
    routeSet.add('consistency-guardian');
    routeSet.add('art-stylist');
  }
  if (triggers.includes('plastic-texture-or-missing-catchlights')) {
    routeSet.add('lighting-director');
    routeSet.add('camera-optics');
  }
  if (triggers.includes('lighting-shadow-mismatch')) routeSet.add('lighting-director');
  if (triggers.includes('anatomy-or-geometry-artifact')) routeSet.add('art-stylist');
  if (triggers.includes('anti-inertia-or-framing-failure')) routeSet.add('forensic-analyst');
  if (verdict === 'revise' && routeSet.size === 0) routeSet.add('consistency-guardian');
  if (verdict === 'revise') routeSet.add('prompt-editor');

  return {
    verdict,
    identityFidelityScore,
    antiSlopScore,
    garmentFidelityScore,
    realismScore,
    lightingCoherenceScore,
    anatomyScore,
    framingScore,
    textureAndCatchlightsOk,
    overallScore,
    rejectionTriggers: triggers,
    routeToRoles: Array.from(routeSet),
    revisionNotes: String(scorecard.revisionNotes || (triggers.length ? `Auto-flagged: ${triggers.join(', ')}` : 'Approved by Anti-AI Realism Auditor.'))
  };
}

function getEssayBlueprints(subjectType = 'portrait') {
  if (subjectType === 'product') {
    return [
      {
        id: 'hero-plinth',
        title: 'Hero Three-Quarter Elevation',
        lens: '90mm f/5.6 macro-tilt',
        angle: 'Three-quarter 15-degree hero elevation',
        location: 'Minimalist architectural matte stone plinth with clean studio depth gradient',
        lighting: 'Dual diffused strip softboxes + overhead scrim + grounded contact shadow',
        pose: 'Hero product centered with crisp brand label legibility'
      },
      {
        id: 'flat-lay',
        title: 'Clean Overhead Flat-Lay',
        lens: '50mm f/4.0 prime',
        angle: '90-degree top-down flat-lay composition',
        location: 'Matte architectural travertine or brushed oak surface with minimal tonal props',
        lighting: 'Broad soft overhead directional window fill',
        pose: 'Product arranged symmetrically with balanced negative space'
      },
      {
        id: 'macro-detail',
        title: 'Macro Typography & Texture Study',
        lens: '100mm f/4.0 macro',
        angle: 'Tight close-up framing on hero markings and material finish',
        location: 'Clean studio gradient background keeping edges razor-sharp',
        lighting: 'Controlled raking side light revealing authentic surface micro-texture',
        pose: 'Tight detail crop proving logo and material fidelity'
      },
      {
        id: 'lifestyle-table',
        title: 'Sunlit Editorial Context',
        lens: '50mm f/2.2 prime',
        angle: 'Natural eye-level environmental placement',
        location: 'Sunlit modern architectural desk or cafe tabletop with natural shadows',
        lighting: 'Warm directional window light with soft bounce fill',
        pose: 'Natural everyday integration without obscuring product markings'
      },
      {
        id: 'dramatic-rim',
        title: 'Dark Studio Rim Contour',
        lens: '85mm f/4.0 prime',
        angle: 'Low hero three-quarter silhouette angle',
        location: 'Deep matte charcoal studio backdrop with subtle floor reflection',
        lighting: 'Crisp rear edge-rim lights sculpting product silhouette + soft front label fill',
        pose: 'Dramatic campaign hero angle'
      },
      {
        id: 'minimal-pack',
        title: 'Pure E-Commerce Clean Cut',
        lens: '85mm f/5.6 prime',
        angle: 'Straight-on eye-level catalog framing',
        location: 'Neutral warm-off-white seamless backdrop with soft natural shadow',
        lighting: 'Even calibrated 5500K commercial wrap lighting',
        pose: 'Straight commercial front presentation'
      }
    ];
  }

  if (subjectType === 'couple') {
    return [
      {
        id: 'street-walkby',
        title: 'Street Walk-By in Motion',
        lens: '35mm f/2.0 prime',
        angle: 'Slightly low waist-level candid tracking shot',
        location: 'Clean contemporary tree-lined urban sidewalk with glass-and-wood storefront bokeh',
        lighting: 'Warm late-afternoon natural ambient daylight',
        pose: 'Walking candidly mid-stride side by side, relaxed natural arm around shoulder'
      },
      {
        id: 'cafe-table',
        title: 'Modern Cafe Table Candid',
        lens: '50mm f/1.8 prime',
        angle: 'Diagonal three-quarter angle across warm oak table',
        location: 'Minimalist modern specialty cafe corner beside large daylight window with concrete wall',
        lighting: 'Soft directional window daylight from camera-left',
        pose: 'Seated closely together, relaxed forearm lean and genuine unforced connection'
      },
      {
        id: 'architectural-courtyard',
        title: 'Architectural Concrete Courtyard',
        lens: '35mm f/2.8 prime',
        angle: 'Dynamic diagonal side-angle with architectural leading lines',
        location: 'Modern minimalist concrete steps with dark matte metal handrail and afternoon shadows',
        lighting: 'Clean afternoon directional sunlight with open shade bounce',
        pose: 'Relaxed off-camera candid moment leaning casually near railing mid-conversation'
      },
      {
        id: 'intimate-closeup',
        title: 'Intimate Two-Shot Close Portrait',
        lens: '85mm f/2.0 prime',
        angle: 'Tight shoulders-up close portrait framing',
        location: 'Softly blurred contemporary urban greenery and neutral warm architecture',
        lighting: 'Soft golden-hour wrap light preserving natural skin pores and relaxed eyes',
        pose: 'Heads close together, gentle natural lean, authentic unexaggerated expressions'
      },
      {
        id: 'waterfront-sunset',
        title: 'Golden-Hour Waterfront Embrace',
        lens: '50mm f/1.8 prime',
        angle: 'Slightly low three-quarter backlit environmental frame',
        location: 'Contemporary coastal boardwalk / glass-railing bayfront overlook at sunset',
        lighting: 'Warm low sunset backlight creating natural hair rim separation + soft front fill',
        pose: 'Warm embrace turning naturally toward each other in candid laughter'
      },
      {
        id: 'lobby-natural',
        title: 'Contemporary Lobby Lifestyle',
        lens: '50mm f/2.0 prime',
        angle: 'Eye-level three-quarter environmental portrait',
        location: 'Modern concrete and warm oak building lobby with glass-door daylight',
        lighting: 'Diffused architectural glass daylight from camera-left',
        pose: 'Relaxed standing embrace with natural head tilt and unposed calm gaze'
      }
    ];
  }

  return [
    {
      id: 'street-walkby',
      title: 'Urban Walk-By Candid',
      lens: '35mm f/2.0 prime',
      angle: 'Waist-level candid motion angle',
      location: 'Contemporary urban sidewalk with modern glass/wood storefront depth',
      lighting: 'Soft late-afternoon open-shade daylight',
      pose: 'Natural mid-stride turn glancing toward or slightly past lens'
    },
    {
      id: 'cafe-window',
      title: 'Sunlit Cafe Window Seated',
      lens: '50mm f/1.8 prime',
      angle: 'Three-quarter seated diagonal across wooden table',
      location: 'Modern minimalist cafe/bistro corner with large window daylight',
      lighting: 'Soft wrap-around window key light at 45 degrees',
      pose: 'Seated relaxed leaning gently on forearm with natural unforced expression'
    },
    {
      id: 'architectural-lines',
      title: 'Architectural Concrete & Light',
      lens: '35mm f/2.8 prime',
      angle: 'Environmental three-quarter frame with leading lines',
      location: 'Minimalist concrete courtyard or warm wood architectural wall',
      lighting: 'Directional afternoon side light with clean shadow falloff',
      pose: 'Casual asymmetric lean against wall or railing, hands relaxed'
    },
    {
      id: 'close-85mm',
      title: '85mm Intimate Close Portrait',
      lens: '85mm f/1.8 prime',
      angle: 'Tight shoulders-up eye-level portrait',
      location: 'Softly blurred contemporary architectural or botanical background',
      lighting: 'Sculpted soft key light + subtle 10/2 o clock iris catchlights',
      pose: 'Gentle head tilt, relaxed eyelids, exact natural expression truth'
    },
    {
      id: 'golden-rim',
      title: 'Golden-Hour Backlit Profile',
      lens: '50mm f/1.4 prime',
      angle: 'Three-quarter backlit candid turn',
      location: 'Modern urban terrace or waterfront walkway at dusk',
      lighting: 'Warm low backlight rim separating hair and shoulders + soft bounce fill',
      pose: 'Candid three-quarter turn with relaxed unposed gaze'
    },
    {
      id: 'editorial-studio',
      title: 'Clean Minimalist Studio',
      lens: '105mm f/2.0 prime',
      angle: 'Eye-level authority portrait',
      location: 'Warm neutral textured plaster backdrop with subtle tonal falloff',
      lighting: 'Soft octagonal key light + clean negative fill',
      pose: 'Balanced asymmetrical shoulder drop with relaxed natural composure'
    }
  ];
}

function generateEssayPlan(job, options = {}) {
  const customFramesInput = Array.isArray(options.customFrames) && options.customFrames.length
    ? options.customFrames
    : (Array.isArray(job.customEssayFrames) && job.customEssayFrames.length ? job.customEssayFrames : null);
  const count = customFramesInput
    ? Math.max(2, Math.min(6, Number(options.count) || customFramesInput.length))
    : Math.max(2, Math.min(6, Number(options.count) || 5));

  const orchestrated = runMultiAgentPipeline(job, {
    ...options,
    mode: options.brief ? 'directed' : (options.mode || 'directed'),
    locks: {
      keepWardrobe: options.locks?.keepWardrobe !== undefined ? Boolean(options.locks.keepWardrobe) : true,
      keepPose: Boolean(options.locks?.keepPose),
      keepBackground: Boolean(options.locks?.keepBackground),
      keepFraming: Boolean(options.locks?.keepFraming)
    }
  });

  const subjectType = orchestrated.subjectType || 'portrait';
  const essaySource = customFramesInput ? 'essence-vision-synthesized' : 'offline-fallback';
  const rawFrames = customFramesInput
    ? customFramesInput.slice(0, count).map((f, idx) => ({
        id: f.id || `essence-frame-${idx + 1}`,
        title: f.title || `Scene ${idx + 1}`,
        lens: f.lens || '50mm f/1.8 prime',
        angle: f.angle || 'Three-quarter candid framing',
        location: f.location || orchestrated.crewPasses['art-stylist']?.locationOrBackdrop,
        compositionArchitecture: f.compositionArchitecture || orchestrated.crewPasses['art-stylist']?.compositionArchitecture,
        motivatedLightSource: f.motivatedLightSource || orchestrated.crewPasses['lighting-director']?.motivatedLightSource,
        contrastRatio: f.contrastRatio || orchestrated.crewPasses['lighting-director']?.contrastRatio,
        negativeFill: f.negativeFill || orchestrated.crewPasses['lighting-director']?.negativeFill,
        kelvinSeparation: f.kelvinSeparation || orchestrated.crewPasses['lighting-director']?.kelvinSeparation,
        lighting: f.lighting || orchestrated.crewPasses['lighting-director']?.lightingSetup,
        pose: f.pose || 'Authentic unposed decisive-moment posture'
      }))
    : getEssayBlueprints(subjectType).slice(0, count);

  const guardian = orchestrated.crewPasses['consistency-guardian'] || {};
  const lightPass = orchestrated.crewPasses['lighting-director'] || {};
  const artPass = orchestrated.crewPasses['art-stylist'] || {};
  const camPass = orchestrated.crewPasses['camera-optics'] || {};
  const isProduct = subjectType === 'product';
  const anchorName = orchestrated.sourceImage?.cleanedAssetName || orchestrated.sourceImage?.fileName || 'source image';
  const baseNegative = orchestrated.promptPacks?.negativeConstraints || [];

  const essayFrames = rawFrames.map((bp, idx) => {
    const frameNumber = idx + 1;
    const comp = bp.compositionArchitecture || artPass.compositionArchitecture;
    const motivated = bp.motivatedLightSource || lightPass.motivatedLightSource;
    const ratio = bp.contrastRatio || lightPass.contrastRatio;
    const negFill = bp.negativeFill || lightPass.negativeFill;
    const kelvinSep = bp.kelvinSeparation || lightPass.kelvinSeparation;

    const endGuard = isProduct
      ? `STRICT PRESERVATION RULE (DO NOT VIOLATE): Keep exact product geometry, brand logos, label typography, and true colors 100% unchanged.`
      : `STRICT PRESERVATION RULE (DO NOT VIOLATE): Keep exact facial structure, exact expression truth (${guardian.expressionTruth}), unretouched skin texture, and every garment micro-detail (${guardian.garmentMicroDetails}) 100% unchanged; do not invent generic AI smiles or alter clothing.`;

    const codexPrompt = [
      `Generate Frame ${frameNumber} of ${count} (${bp.title}) using ${anchorName} STRICTLY as the ${isProduct ? 'product' : 'biometric & wardrobe'} anchor.`,
      orchestrated.essenceAnalysis ? `Photo Essence: ${orchestrated.essenceAnalysis}` : '',
      orchestrated.userBrief ? `Essay Direction: ${orchestrated.userBrief}` : `Essence-driven ${subjectType} photo essay with bespoke pose, lens, and lighting physics.`,
      `Scene & Composition: ${bp.location}. ${comp}`,
      `Pose & Camera Angle: ${bp.pose}. Camera angle: ${bp.angle}.`,
      `Optics & Lighting Physics: ${bp.lens} (${camPass.opticalCharacter}). Motivated light: ${motivated}. ${bp.lighting}. Contrast ratio: ${ratio}. ${negFill} ${kelvinSep}`,
      isProduct
        ? 'Real commercial optics, crisp typography, authentic material finish.'
        : `Anti-Slop Realism: ${guardian.antiBeautificationLocks} ${camPass.skinToneColorScience}`,
      `Constraints: ${baseNegative.join('; ')}.`,
      endGuard
    ].filter(Boolean).join('\n');

    const geminiPrompt = [
      `Create Frame ${frameNumber}/${count} (${bp.title}) of a candid real-world photo essay anchored to ${anchorName}.`,
      orchestrated.essenceAnalysis ? `Honor essence: ${orchestrated.essenceAnalysis}.` : '',
      `Place in: ${bp.location}. Composition: ${comp}. Pose & Angle: ${bp.pose}; ${bp.angle}.`,
      `Optics & Light: ${bp.lens}; motivated by ${motivated}; ${bp.lighting}; ratio ${ratio}; ${negFill}; ${kelvinSep}.`,
      isProduct ? 'Authentic surface detail.' : `${guardian.antiBeautificationLocks} ${camPass.skinToneColorScience}`,
      `Avoid: ${baseNegative.join('; ')}.`,
      endGuard
    ].filter(Boolean).join(' ');

    const claudeComfyPrompt = [
      `[ESSAY FRAME ${frameNumber}/${count}] ${bp.title} (${essaySource})`,
      `[ANCHOR] ${anchorName}`,
      orchestrated.essenceAnalysis ? `[ESSENCE] ${orchestrated.essenceAnalysis}` : '',
      `[LENS & ANGLE] ${bp.lens} | ${bp.angle} | ${camPass.opticalCharacter}`,
      `[LOCATION & COMPOSITION] ${bp.location} | ${comp}`,
      `[POSE] ${bp.pose}`,
      `[LIGHTING PHYSICS] motivated=${motivated} | ratio=${ratio} | negativeFill=${negFill} | kelvinSep=${kelvinSep} | ${bp.lighting}`,
      `[EXPRESSION TRUTH] ${guardian.expressionTruth || 'Exact anchor truth'}`,
      `[GARMENT MICRO-DETAILS] ${guardian.garmentMicroDetails || 'Exact anchor outfit'}`,
      `[END GUARD] ${endGuard}`
    ].filter(Boolean).join('\n');

    return {
      index: frameNumber,
      id: `frame-${frameNumber}-${bp.id}`,
      title: bp.title,
      source: essaySource,
      lens: bp.lens,
      angle: bp.angle,
      location: bp.location,
      compositionArchitecture: comp,
      motivatedLightSource: motivated,
      contrastRatio: ratio,
      negativeFill: negFill,
      kelvinSeparation: kelvinSep,
      lighting: bp.lighting,
      pose: bp.pose,
      codexPrompt,
      geminiPrompt,
      claudeComfyPrompt,
      midjourneyFluxPrompt: [bp.title, bp.location, bp.pose, bp.angle, bp.lens, bp.lighting, endGuard, '--ar ' + (orchestrated.sourceImage?.aspectRatio || '4:5')].join('. '),
      universalJsonSpec: { ...orchestrated.promptPacks.universalJsonSpec, frame: frameNumber, title: bp.title, location: bp.location, pose: bp.pose, angle: bp.angle, lens: bp.lens, lighting: bp.lighting, codexPrompt, geminiPrompt, claudeComfyPrompt },
      renders: [],
      qaScorecards: []
    };
  });

  orchestrated.essayMode = true;
  orchestrated.essaySource = essaySource;
  orchestrated.essayCount = count;
  orchestrated.customEssayFrames = customFramesInput || orchestrated.customEssayFrames || [];
  orchestrated.essayFrames = essayFrames;
  orchestrated.agentBoard.push(
    makeBoardMessage(
      orchestrated.agentBoard.length + 1,
      'showrunner-director',
      'Diretor de Ensaio',
      `Ensaio completo (${essaySource}) planejado com ${count} frames (${essayFrames.map((f) => `${f.index}. ${f.title} [${f.lens}]`).join(' · ')}).`
    )
  );

  return orchestrated;
}

module.exports = {
  mergeCraftOptions,
  inferSubjectTypeFromHints,
  parseDirectedIntent,
  generateAutonomousProposals,
  runMultiAgentPipeline,
  evaluateQaScorecard,
  getEssayBlueprints,
  generateEssayPlan
};

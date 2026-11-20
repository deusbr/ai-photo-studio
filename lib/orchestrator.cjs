'use strict';

const { classifyImageGeometry } = require('./image-meta.cjs');
const { resolvePreset, buildProductionPacks } = require('./crew.cjs');

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

  const explicitSubtle = /(sutil|subtle|leve|apenas melhore|s[oó] melhore|retouch|tratamento natural|preserv(?:e|ar) tudo|sem mudar|keep everything|minor polish)/i.test(q);

  const locks = {
    keepPose: Boolean(
      overrides.locks?.keepPose ||
      explicitSubtle ||
      overrides.scope === 'subtle-retouch' ||
      /(mesma pose|mantenha\s+(?:a|minha|sua)?\s*pose|preserv(?:e|ar)\s+(?:a|minha|sua)?\s*pose|keep\s+(?:my|the|original)?\s*pose|sem mudar a pose|n[aã]o mude a pose)/i.test(q)
    ),
    keepWardrobe: Boolean(
      overrides.locks?.keepWardrobe ||
      explicitSubtle ||
      overrides.scope === 'subtle-retouch' ||
      /(mesma roupa|mantenha\s+(?:a|minha|sua|o|meu)?\s*(?:roupa|look|traje)|(?:pose|fundo)\s+e\s+(?:a\s+)?(?:minha\s+)?roupa|preserv(?:e|ar)\s+(?:a|minha)?\s*roupa|keep\s+(?:my|the|original)?\s*(?:outfit|wardrobe|clothes)|preserve clothing)/i.test(q)
    ),
    keepBackground: Boolean(
      overrides.locks?.keepBackground ||
      explicitSubtle ||
      overrides.scope === 'subtle-retouch' ||
      /(mesmo fundo|mantenha\s+(?:o|meu)?\s*(?:fundo|cen[aá]rio)|(?:pose|roupa)\s+e\s+(?:o\s+)?(?:meu\s+)?(?:fundo|cen[aá]rio)|preserv(?:e|ar)\s+(?:o|meu)?\s*(?:fundo|cen[aá]rio)|keep\s+(?:my|the|original)?\s*(?:background|setting|location)|preserve (?:background|location))/i.test(q)
    ),
    keepFraming: Boolean(
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

function runMultiAgentPipeline(job, options = {}) {
  const mode = options.mode || job.mode || (job.userBrief ? 'directed' : 'autonomous');
  const now = new Date().toISOString();
  const geo = classifyImageGeometry(job.sourceImage || {});

  let proposals = job.proposals || [];
  let selectedProposal = null;
  let intent = null;
  let subjectType = options.subjectHint && options.subjectHint !== 'auto' ? options.subjectHint : 'portrait';
  let interventionScope = options.scope || job.interventionScope || 'full-editorial';
  let locks = { ...(job.locks || {}) };
  let activePreset = options.preset || job.preset;

  if (mode === 'autonomous') {
    const autoPlan = generateAutonomousProposals(job, options);
    proposals = autoPlan.proposals;
    subjectType = autoPlan.subjectType;
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

  const board = [];
  const passes = { ...(job.crewPasses || {}) };

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
  const chosenConcept = selectedProposal
    ? selectedProposal.concept
    : ((mode === 'directed' && job.userBrief) ? `${job.userBrief}` : `${preset.name} visual direction`);
  const chosenLocation = locks.keepBackground
    ? 'Preserve original background setting cleanly (remove only distracting clutter or noise).'
    : (selectedProposal?.locationOrBackdrop || (isProduct
        ? 'Clean architectural matte stone or brushed metal surface coherent with the product category'
        : 'Context-matched contemporary interior, sunlit cafe/gallery wall, or modern urban street coherent with the subjects real wardrobe (avoid cliché European stone balustrades)'));
  const artDirectionRationale = locks.keepBackground
    ? 'Background locked by user request.'
    : (selectedProposal?.rationale || 'Location chosen specifically to stay coherent with the subjects real clothing, age, and casual/editorial energy.');
  const chosenWardrobe = locks.keepWardrobe
    ? 'Preserve original wardrobe, fabric fit, logos, and accessories strictly.'
    : (selectedProposal?.wardrobeOrProps || (isProduct
        ? 'Hero product clean surface staging with minimal tactile accents'
        : 'Preserve subjects real-world wardrobe styling and relaxed fit unless redesign was explicitly requested'));

  passes['art-stylist'] = {
    updatedAt: now,
    concept: chosenConcept,
    artDirectionRationale,
    wardrobeOrProps: chosenWardrobe,
    locationOrBackdrop: chosenLocation,
    colorPalette: preset.defaults.colorPalette,
    postureGeometry: locks.keepPose
      ? 'Preserve exact original posture and placement.'
      : 'Natural unposed stance with slight relaxed shoulder drop and authentic head tilt (no stiff mannequin posture).',
    facialOrFocalDirection: locks.keepPose
      ? (isProduct ? 'Maintain original label angle and crispness.' : 'Preserve original gaze and natural expression.')
      : (isProduct ? 'Sharp hero label focus with balanced specular planes' : 'Relaxed natural eyelids and unforced expression faithful to anchor (no stiff wide-eyed stare)'),
    handOrPropPlacement: locks.keepPose
      ? 'Preserve original hand/object placement.'
      : (isProduct ? 'Grounded contact shadow on matte surface' : 'Natural relaxed hands anchored effortlessly')
  };
  board.push(
    makeBoardMessage(
      4,
      'art-stylist',
      'Diretor de Arte & Styling',
      `Direção coerente: ${chosenConcept} | Cenário: ${chosenLocation}`
    )
  );

  // 5. Lighting Director
  passes['lighting-director'] = {
    updatedAt: now,
    lightingSetup: selectedProposal?.lightingSetup || preset.defaults.lightingSetup,
    kelvinAndCatchlights: selectedProposal?.kelvinAndCatchlights || preset.defaults.kelvinAndCatchlights,
    shadowPhysics: isSubtle
      ? 'Soften harsh shadows gently while preserving natural ambient light direction.'
      : 'Coherent 3D shadow falloff anchored to key light direction with controlled negative fill.',
    atmosphereNotes: isProduct
      ? 'Crisp controlled edge highlights and realistic ground contact shadow.'
      : 'Three-dimensional facial sculpting without waxy/overlit HDR flatness.'
  };
  board.push(
    makeBoardMessage(
      5,
      'lighting-director',
      'Especialista em Iluminação',
      `Setup de luz: ${passes['lighting-director'].lightingSetup} (${passes['lighting-director'].kelvinAndCatchlights}).`
    )
  );

  // 6. Camera & Optics
  passes['camera-optics'] = {
    updatedAt: now,
    cameraAndEmulsion: selectedProposal?.cameraAndEmulsion || preset.defaults.cameraAndEmulsion,
    primeLens: selectedProposal?.primeLens || preset.defaults.primeLens,
    cameraAngle: locks.keepFraming ? 'Preserve original angle with barrel distortion corrected' : preset.defaults.cameraAngle,
    depthOfField: isProduct ? 'Deep crisp product plane with smooth background falloff' : 'Shallow natural optical bokeh separating subject from backdrop',
    colorScience: preset.defaults.colorPalette
  };
  board.push(
    makeBoardMessage(
      6,
      'camera-optics',
      'Câmera & Lentes',
      `Ótica: ${passes['camera-optics'].cameraAndEmulsion} + ${passes['camera-optics'].primeLens}.`
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
    enginesCompiled: ['codex', 'gemini', 'claude-comfyui', 'universal-json'],
    negativeConstraintCount: updatedJob.promptPacks.negativeConstraints.length
  };
  updatedJob.agentBoard.push(
    makeBoardMessage(
      7,
      'prompt-editor',
      'Editor Master',
      `Prompts compilados para Codex, Gemini, Claude/ComfyUI e Universal JSON (${updatedJob.promptPacks.negativeConstraints.length} restrições negativas).`
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

module.exports = {
  inferSubjectTypeFromHints,
  parseDirectedIntent,
  generateAutonomousProposals,
  runMultiAgentPipeline,
  evaluateQaScorecard
};

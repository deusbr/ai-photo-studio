'use strict';

/**
 * Curated master photography, cinematography, posing, optics, effects, and editorial makeup library.
 * Used for offline precision recommendations, live research enrichment, and conflict guardrails.
 */

const CRAFT_CATALOG = {
  poses: [
    {
      id: 'contrapposto-editorial',
      name: 'Editorial Contrapposto & S-Curve',
      categories: ['portrait', 'fashion', 'editorial'],
      bestFocalLengths: ['50mm', '85mm', '105mm'],
      bodyMechanics: 'Shift 80% of body weight onto the rear hip/leg, bend the front knee softly, drop the front shoulder 3 cm, and angle the torso 35 degrees off-axis.',
      jawAndGaze: 'Extend the forehead slightly forward toward the lens and lower the chin 3-5 degrees to sculpt a clean jawline; relaxed lower eyelids.',
      handsAndProps: 'Rest the lead hand lightly along a pocket seam, coat lapel, or edge-of-hand against thigh; never press flat palms into the body.',
      avoid: 'Symmetric square-on shoulders, locked knees, stiff claw-like fingers.',
      promptSnippet: 'Editorial contrapposto stance with 80% weight on rear hip, natural S-curve spine, front shoulder dropped 3 cm, relaxed arms creating clean negative-space triangles.'
    },
    {
      id: 'turtle-jawline-power',
      name: 'Submental Jawline Sculpt (Turtle Technique)',
      categories: ['portrait', 'beauty', 'executive', 'fashion'],
      bestFocalLengths: ['85mm', '105mm', '135mm'],
      bodyMechanics: 'Square or 30-degree angled shoulders pulled back and down to elongate the neck and collarbone line.',
      jawAndGaze: 'Push the ears/forehead subtly forward toward the camera and tilt the chin down 4 degrees to tighten submental contour and sharpen jawline shadow.',
      handsAndProps: 'Optional edge-of-hand skimming gently near collar or jawline without compressing cheek skin.',
      avoid: 'Tucking chin straight back into the neck or tilting chin too high.',
      promptSnippet: 'Subtle forward head extension with fractional downward chin tilt sculpting a crisp jawline shadow, elongated neck, calm unforced eye contact.'
    },
    {
      id: 'edge-of-hand-grace',
      name: 'Edge-of-Hand & Soft Articulation',
      categories: ['portrait', 'beauty', 'fashion', 'lifestyle'],
      bestFocalLengths: ['50mm', '85mm', '100mm'],
      bodyMechanics: 'Asymmetric upper-body lean with elbow angled outward to open torso breathing room.',
      jawAndGaze: 'Soft three-quarter facial turn catching key light on the cheekbone.',
      handsAndProps: 'Present the side/edge of the hand toward the lens rather than flat palm or back-of-hand; gently separate and curve fingers in a relaxed cascade.',
      avoid: 'Flat palms pressing into cheeks, stiff splayed fingers, hidden amputated wrists.',
      promptSnippet: 'Graceful edge-of-hand orientation toward camera with gently curved, softly separated fingers lightly skimming collar or chin without skin compression.'
    },
    {
      id: 'negative-space-triangles',
      name: 'Architectural Negative-Space Triangles',
      categories: ['fashion', 'editorial', 'outdoor'],
      bestFocalLengths: ['35mm', '50mm', '85mm'],
      bodyMechanics: 'Create deliberate triangular gaps between inner arms and waist, and bent knee against standing leg to guide viewer eye lines.',
      jawAndGaze: 'Piercing editorial gaze or cool off-axis contemplation aligned with dominant triangle apex.',
      handsAndProps: 'Hook thumb casually on belt loop, sunglasses frame, or blazer edge to keep wrists natural.',
      avoid: 'Arms glued vertically to the ribcage making the silhouette boxy.',
      promptSnippet: 'High-fashion geometric posing creating clean negative-space triangles between arms and torso, dynamic bent knee line, effortless architectural balance.'
    },
    {
      id: 'mid-stride-walkby',
      name: 'Decisive-Moment Mid-Stride Walk-By',
      categories: ['portrait', 'lifestyle', 'outdoor', 'couple', 'cinema'],
      bestFocalLengths: ['35mm', '50mm'],
      bodyMechanics: 'Captured mid-step with natural coat/fabric swing, weight transferring forward, shoulders relaxed in motion.',
      jawAndGaze: 'Natural glance over shoulder or slightly past lens caught mid-thought or mid-conversation.',
      handsAndProps: 'One hand swinging naturally or holding coffee/bag strap; natural fabric crease movement.',
      avoid: 'Frozen mannequin walking pose with stiff straight arms.',
      promptSnippet: 'Candid decisive-moment mid-stride walk-by, subtle garment movement in motion, relaxed asymmetrical shoulders, authentic off-guard glance.'
    },
    {
      id: 'seated-cafe-lean',
      name: 'Seated Forearm Lean & Diagonal Frame',
      categories: ['portrait', 'lifestyle', 'couple', 'night'],
      bestFocalLengths: ['35mm', '50mm', '85mm'],
      bodyMechanics: 'Seated at 45 degrees to a table or ledge, leaning slightly forward on one forearm to create depth toward the lens.',
      jawAndGaze: 'Relaxed brow and unforced mouth posture; calm conversational engagement.',
      handsAndProps: 'Hands wrapping naturally around an espresso cup, glass, or resting edge-down on textured wood.',
      avoid: 'Slumped shoulders collapsing the torso or elbows squared directly at camera.',
      promptSnippet: 'Seated three-quarter diagonal lean resting lightly on forearm across tabletop, relaxed unposed shoulders, natural candid hand interaction.'
    },
    {
      id: 'over-shoulder-cinema',
      name: 'Over-the-Shoulder Cinema Trailer Turn',
      categories: ['cinema', 'night', 'portrait', 'fashion'],
      bestFocalLengths: ['40mm-anamorphic', '50mm', '85mm'],
      bodyMechanics: 'Back or profile turned 60% away from camera, rotating upper spine and head back toward the motivated key light.',
      jawAndGaze: 'Focused, story-driven gaze under relaxed heavy eyelids with strong rim separation along shoulder and jawline.',
      handsAndProps: 'Collar turned up or hand gripping coat/doorframe naturally.',
      avoid: 'Strained neck twist exceeding natural anatomy.',
      promptSnippet: 'Cinematic over-the-shoulder three-quarter turn, motivated rim light tracing jawline and shoulder contour, intense narrative stillness.'
    },
    {
      id: 'executive-authority',
      name: 'Executive Authority & Squinch',
      categories: ['executive', 'portrait'],
      bestFocalLengths: ['85mm', '105mm'],
      bodyMechanics: 'Torso turned 35 degrees to slim silhouette, upright balanced spine without military stiffness, chest open.',
      jawAndGaze: 'Head turned to lens with subtle lower-eyelid squinch projecting approachable confidence and competence.',
      handsAndProps: 'Arms crossed loosely without hiding hands, or relaxed hands resting at side/desk edge.',
      avoid: 'Wide-eyed deer-in-headlights stare or stiff passport posture.',
      promptSnippet: 'Composed executive stance, torso angled 35 degrees, head toward lens with subtle lower-eyelid squinch and calm natural authority.'
    },
    {
      id: 'couple-asymmetric-lean',
      name: 'Duo Asymmetric Connection (Zero Face Overlap)',
      categories: ['couple', 'portrait', 'lifestyle'],
      bestFocalLengths: ['35mm', '50mm', '85mm'],
      bodyMechanics: 'Stagger head heights by 5-10 cm; angle both torsos inward in an open V-shape toward the camera plane so both stay in focal plane.',
      jawAndGaze: 'One partner looking warmly at the other or softly toward camera; authentic unexaggerated expressions.',
      handsAndProps: 'Hand resting gently on partner forearm, waist, or lapel with visible fingers and zero awkward clamping.',
      avoid: 'Overlapping noses/chins, matching identical poses, forced open-tooth AI grins.',
      promptSnippet: 'Asymmetric two-subject composition in an open V-angle keeping both faces tack-sharp, staggered head levels, natural unposed affection.'
    },
    {
      id: 'low-angle-hero',
      name: 'Low-Angle Cinema Hero Stance',
      categories: ['cinema', 'fashion', 'outdoor', 'night'],
      bestFocalLengths: ['24mm', '35mm', '40mm-anamorphic'],
      bodyMechanics: 'Camera positioned at chest-to-waist height looking up 10 degrees; wide grounded stance with relaxed shoulders.',
      jawAndGaze: 'Strong chin line parallel to horizon, focused gaze slightly off-lens.',
      handsAndProps: 'Jacket draped over shoulder or hands naturally in trouser pockets.',
      avoid: 'Extreme upward nostril angle.',
      promptSnippet: 'Subtle low-angle hero framing from chest height, grounded asymmetrical stance, strong architectural horizon lines behind subject.'
    },
    {
      id: 'product-three-quarter-plinth',
      name: 'Hero Product 15-Degree Plinth Elevation',
      categories: ['product'],
      bestFocalLengths: ['90mm-macro', '100mm-macro', '85mm'],
      bodyMechanics: 'Product positioned at a 15-degree three-quarter hero elevation on matte limestone, travertine, or brushed steel plinth.',
      jawAndGaze: 'Front brand label and typography rotated cleanly within the plane of critical focus.',
      handsAndProps: 'Grounded natural contact shadow with subtle tonal prop balance; zero label occlusion.',
      avoid: 'Floating objects without contact shadows or skewed typography.',
      promptSnippet: 'Hero commercial product staged at 15-degree three-quarter elevation on matte architectural stone plinth with crisp contact shadow and legible branding.'
    },
    {
      id: 'product-flat-lay',
      name: 'Orthogonal 90-Degree Editorial Flat-Lay',
      categories: ['product'],
      bestFocalLengths: ['50mm', '90mm-macro'],
      bodyMechanics: 'Strict 90-degree overhead perpendicular framing arranged on rule-of-thirds grid with generous negative space.',
      jawAndGaze: 'Even label orientation readable straight-on with zero keystone distortion.',
      handsAndProps: 'Tactile linen, raw stone, or botanical accents supporting brand color story.',
      avoid: 'Cluttered overlaps or uneven shadow edges.',
      promptSnippet: 'Crisp 90-degree overhead flat-lay arrangement on textured travertine surface with balanced negative space and zero perspective keystoning.'
    }
  ],

  cameras: [
    {
      id: 'hasselblad-x2d-portra400',
      name: 'Hasselblad X2D 100C + Kodak Portra 400 Curve',
      categories: ['portrait', 'fashion', 'beauty', 'editorial', 'couple'],
      sensorType: 'Medium Format 100MP 16-bit',
      colorCharacter: 'Creamy highlight roll-off, warm true-to-life skin undertones, organic silver-halide micro-grain.',
      promptSnippet: 'Shot on Hasselblad X2D 100C medium format sensor with Kodak Portra 400 color curve, 16-bit skin tonal transitions, subtle organic film grain'
    },
    {
      id: 'arri-alexa35-vision3',
      name: 'ARRI Alexa 35 + Kodak Vision3 500T Emulsion',
      categories: ['cinema', 'night', 'portrait', 'fashion'],
      sensorType: 'Super35 Cinema Digital (17 stops DR)',
      colorCharacter: 'Hollywood trailer dynamic range, deep clean shadows without crushing blacks, rich tungsten-to-cyan separation.',
      promptSnippet: 'Captured on ARRI Alexa 35 with REVEAL Color Science and Kodak Vision3 500T film print emulation, 17-stop cinematic dynamic range'
    },
    {
      id: 'leica-m11-summilux',
      name: 'Leica M11 Digital Rangefinder',
      categories: ['executive', 'portrait', 'lifestyle', 'couple'],
      sensorType: 'Full-Frame 60MP BSI CMOS',
      colorCharacter: 'Natural neutral contrast, crisp micro-acutance, authentic documentary presence.',
      promptSnippet: 'Shot on Leica M11 full-frame rangefinder, natural medium-contrast color science, crisp realistic micro-detail'
    },
    {
      id: 'leica-m6-cinestill800t',
      name: 'Leica M6 + CineStill 800T Tungsten Film',
      categories: ['night', 'cinema', 'portrait'],
      sensorType: '35mm Tungsten Color Negative',
      colorCharacter: 'Signature red/amber halation around bright street/neon practicals, cool shadow base.',
      promptSnippet: 'Shot on 35mm Leica M6 loaded with CineStill 800T tungsten film, subtle natural red halation around practical lights, organic film grain'
    },
    {
      id: 'fujifilm-gfx100ii-pro400h',
      name: 'Fujifilm GFX 100 II + Pro 400H Daylight',
      categories: ['lifestyle', 'outdoor', 'couple', 'portrait'],
      sensorType: 'Large Format 102MP',
      colorCharacter: 'Airy pastel greens and blues, luminous daylight skin clarity, smooth highlight roll-off.',
      promptSnippet: 'Shot on Fujifilm GFX 100 II large-format camera with Fujifilm Pro 400H daylight color response, airy highlight roll-off'
    },
    {
      id: 'phase-one-iq4-150mp',
      name: 'Phase One IQ4 150MP Commercial Studio',
      categories: ['product', 'beauty', 'fashion'],
      sensorType: 'Medium Format 150MP Commercial',
      colorCharacter: 'Ultra-clean Pantone accuracy, razor-sharp material micro-texture, calibrated studio neutral white balance.',
      promptSnippet: 'Shot on Phase One IQ4 150MP commercial medium-format system, true Pantone color fidelity, razor-sharp tactile material resolution'
    },
    {
      id: 'contax-t2-portra800',
      name: 'Contax T2 + Portra 800 Direct Editorial',
      categories: ['flash', 'fashion', 'night', 'lifestyle'],
      sensorType: '35mm Compact Film',
      colorCharacter: 'Raw candid flash aesthetic, punchy midtones, unmistakable analog grain and lively spontaneity.',
      promptSnippet: 'Shot on Contax T2 35mm film camera with Kodak Portra 800, candid analog immediacy, crisp flash-lit midtones and organic grain'
    },
    {
      id: 'leica-m11-monochrom-hp5',
      name: 'Leica M11 Monochrom + Ilford HP5 400',
      categories: ['monochrome', 'portrait', 'cinema', 'executive'],
      sensorType: 'True Monochrome Sensor',
      colorCharacter: 'Rich silver-gelatin tonal gradations, deep velvet blacks, expressive high-craft grain.',
      promptSnippet: 'Shot on Leica M11 Monochrom with Ilford HP5 400 silver-gelatin tonal curve, luminous skin highlights and deep velvet shadows'
    }
  ],

  lenses: [
    {
      id: '24mm-f14-gm',
      name: '24mm f/1.4 Wide Environmental Prime',
      focalMm: 24,
      categories: ['outdoor', 'cinema', 'lifestyle'],
      closePortraitWarning: 'Wide 24mm exaggerates nose/forehead proportions in tight close-ups; keep subject framed waist-up or full-body.',
      opticalEffect: 'Expansive spatial storytelling, dramatic foreground-to-background perspective lines.',
      promptSnippet: '24mm f/1.4 wide environmental prime lens framing full architectural context with clean edge geometry'
    },
    {
      id: '35mm-f14-summilux',
      name: '35mm f/1.4 Summilux Storyteller',
      focalMm: 35,
      categories: ['lifestyle', 'outdoor', 'couple', 'cinema', 'flash'],
      closePortraitWarning: null,
      opticalEffect: 'Intimate documentary presence placing subject seamlessly inside their physical world.',
      promptSnippet: '35mm f/1.4 Summilux prime lens, natural environmental storytelling perspective with gentle edge falloff'
    },
    {
      id: '40mm-cooke-anamorphic',
      name: '40mm T2.3 Cooke Anamorphic /i (2.39:1)',
      focalMm: 40,
      categories: ['cinema', 'night', 'fashion'],
      closePortraitWarning: null,
      opticalEffect: 'Widescreen 2.39:1 movie-trailer geometry, signature oval out-of-focus bokeh, subtle horizontal flare.',
      promptSnippet: '40mm Cooke Anamorphic/i T2.3 cinema lens, 2.39:1 widescreen trailer aspect feel, creamy oval bokeh and subtle horizontal flare'
    },
    {
      id: '50mm-f12-noctilux',
      name: '50mm f/1.2 Fast Standard Prime',
      focalMm: 50,
      categories: ['portrait', 'couple', 'night', 'lifestyle', 'cinema'],
      closePortraitWarning: null,
      opticalEffect: 'True human-eye perspective with three-dimensional subject pop and buttery ambient bokeh.',
      promptSnippet: '50mm f/1.2 fast prime lens, natural human-eye perspective, ultra-shallow depth of field melting background lights'
    },
    {
      id: '85mm-f14-gm',
      name: '85mm f/1.4 Portrait Master Prime',
      focalMm: 85,
      categories: ['portrait', 'fashion', 'editorial', 'couple'],
      closePortraitWarning: null,
      opticalEffect: 'Flattering facial compression, creamy background separation, zero wide-angle distortion.',
      promptSnippet: '85mm f/1.4 portrait prime lens, flattering optical facial compression, creamy smooth background bokeh'
    },
    {
      id: '105mm-f14-sigma',
      name: '105mm f/1.4 Telephoto Authority & Beauty',
      focalMm: 105,
      categories: ['executive', 'beauty', 'portrait'],
      closePortraitWarning: null,
      opticalEffect: 'Zero nasal elongation, razor-sharp iris plane, dreamy compressed background abstraction.',
      promptSnippet: '105mm f/1.4 telephoto portrait lens, zero perspective distortion, tack-sharp iris plane and creamy background compression'
    },
    {
      id: '135mm-f18-plena',
      name: '135mm f/1.8 Plena Dream Telephoto',
      focalMm: 135,
      categories: ['fashion', 'portrait', 'outdoor'],
      closePortraitWarning: null,
      opticalEffect: 'Extreme telephoto compression turning distant clutter into luminous circular bokeh.',
      promptSnippet: '135mm f/1.8 telephoto prime lens, dramatic background compression and circular edge-to-edge bokeh'
    },
    {
      id: '90mm-f56-macro-tilt',
      name: '90mm f/5.6 Macro Tilt-Shift Commercial',
      focalMm: 90,
      categories: ['product'],
      closePortraitWarning: null,
      opticalEffect: 'Scheimpflug focal-plane alignment keeping front-to-back brand logos and packaging razor-sharp.',
      promptSnippet: '90mm f/5.6 macro tilt-shift commercial lens keeping full product label and edges tack-sharp'
    },
    {
      id: '100mm-f28-macro',
      name: '100mm f/2.8 Macro Detail Lens',
      focalMm: 100,
      categories: ['beauty', 'product'],
      closePortraitWarning: null,
      opticalEffect: 'Microscopic skin/cosmetic shimmer or product surface texture fidelity at close focus.',
      promptSnippet: '100mm f/2.8 macro lens capturing microscopic authentic surface texture and crisp material edges'
    }
  ],

  effects: [
    {
      id: 'black-pro-mist-1-4',
      name: 'Tiffen Black Pro-Mist 1/4 Optical Diffusion',
      categories: ['cinema', 'night', 'portrait', 'fashion'],
      humanOnly: false,
      promptSnippet: 'Tiffen Black Pro-Mist 1/4 physical optical filter creating gentle atmospheric halation around highlights while preserving tack-sharp core texture'
    },
    {
      id: 'black-pro-mist-1-8',
      name: 'Tiffen Black Pro-Mist 1/8 Subtle Bloom',
      categories: ['portrait', 'beauty', 'editorial', 'couple', 'lifestyle'],
      humanOnly: false,
      promptSnippet: 'Tiffen Black Pro-Mist 1/8 subtle highlight bloom softening digital harshness without blurring pores or fine hair'
    },
    {
      id: 'glimmerglass-1-4',
      name: 'Tiffen Glimmerglass 1/4 Specular Sparkle',
      categories: ['beauty', 'fashion', 'portrait'],
      humanOnly: false,
      promptSnippet: 'Glimmerglass 1/4 optical filter adding refined specular sparkle around highlights while retaining deep contrast blacks'
    },
    {
      id: 'anamorphic-flare-streak',
      name: 'Anamorphic Horizontal Flare & Oval Bokeh',
      categories: ['cinema', 'night'],
      humanOnly: false,
      promptSnippet: 'Subtle horizontal anamorphic lens flare streak and elliptical background bokeh orbs'
    },
    {
      id: 'foreground-prism-refraction',
      name: 'Foreground Glass / Optical Refraction Layer',
      categories: ['editorial', 'fashion', 'cinema', 'product'],
      humanOnly: false,
      promptSnippet: 'Subtle out-of-focus foreground glass edge or prism light refraction framing the corner without obscuring the subject'
    },
    {
      id: 'volumetric-haze-beams',
      name: 'Atmospheric Haze & Motivated Light Shafts',
      categories: ['cinema', 'night', 'fashion'],
      humanOnly: false,
      promptSnippet: 'Fine atmospheric haze catching subtle volumetric shafts of motivated directional light for spatial depth'
    },
    {
      id: 'slow-shutter-drag',
      name: 'Slow-Shutter Motion Drag (1/15s Ambient Blur)',
      categories: ['night', 'fashion', 'cinema'],
      humanOnly: false,
      promptSnippet: 'Controlled 1/15s shutter drag creating subtle dynamic motion trails in background lights while keeping subject razor-sharp'
    },
    {
      id: 'direct-flash-paparazzi',
      name: 'Direct Axial Strobe + Crisp Drop Shadow',
      categories: ['flash', 'fashion', 'night'],
      humanOnly: false,
      promptSnippet: 'Crisp direct on-camera editorial flash producing punchy specular pop and a clean tight drop shadow behind the subject'
    },
    {
      id: 'wet-street-specular',
      name: 'Wet-Down Pavement Specular Reflections',
      categories: ['night', 'cinema', 'outdoor'],
      humanOnly: false,
      promptSnippet: 'Damp reflective street surface mirroring warm tungsten and cool cyan ambient light accents'
    },
    {
      id: 'teal-amber-trailer-grade',
      name: 'Cinema Trailer Teal & Amber Color Grade',
      categories: ['cinema', 'night'],
      humanOnly: false,
      promptSnippet: 'Hollywood trailer color grade pushing deep shadows toward cool slate-teal while keeping skin tones and practical highlights rich warm amber'
    }
  ],

  makeup: [
    {
      id: 'natural-hydrated-no-makeup',
      name: 'Minimalist Hydrated "No-Makeup" Skin',
      categories: ['portrait', 'lifestyle', 'couple', 'executive', 'outdoor'],
      promptSnippet: 'Minimalist hydrated no-makeup finish with neutral natural lip tone, groomed brows, visible skin pores, freckles, and zero beauty-filter smoothing'
    },
    {
      id: 'editorial-glass-skin',
      name: 'Editorial Dewy Cheekbone + Matte T-Zone Control',
      categories: ['beauty', 'fashion', 'editorial'],
      promptSnippet: 'High-fashion skin prep with fine luminous sheen along upper cheekbones and bridge of nose paired with softly controlled matte T-zone, preserving real pores and vellus hair'
    },
    {
      id: 'deconstructed-cinema-kohl',
      name: 'Smudged Kohl & Deconstructed Cinema Eye',
      categories: ['cinema', 'night', 'fashion'],
      promptSnippet: 'Editorial lived-in smudged charcoal kohl along lashline, softly blurred natural lip stain, brushed natural brows, raw authentic skin texture'
    },
    {
      id: 'melanin-luminous-bronze',
      name: 'Melanin-Rich Warm Bronze & Sub-Surface Glow',
      categories: ['beauty', 'portrait', 'editorial', 'lifestyle'],
      promptSnippet: 'Warm bronze-gold micro-shimmer accentuating cheekbones harmoniously with melanin-rich undertones, natural satin skin finish, zero ashy highlight cast'
    },
    {
      id: 'classic-velvet-matte-lip',
      name: 'Classic Velvet Matte Statement Lip & Clean Skin',
      categories: ['fashion', 'editorial', 'beauty'],
      promptSnippet: 'Clean natural satin skin with crisp velvet-matte terracotta or deep crimson lip, subtle tightlined lashes, visible natural skin texture'
    },
    {
      id: 'graphic-avant-garde-liner',
      name: 'Graphic Editorial Liner & Wet Eyelid Gloss',
      categories: ['beauty', 'fashion'],
      promptSnippet: 'Sharp graphic liquid eyeliner paired with subtle wet-gloss neutral eyelid texture and unretouched pore-level skin realism'
    },
    {
      id: 'rain-swept-cinema-grit',
      name: 'Rain-Swept / Lived-In Action Realism',
      categories: ['cinema', 'night'],
      promptSnippet: 'Subtle realistic moisture sheen on skin, stray wind-swept hair strands, weathered authentic film texture without artificial glamour'
    },
    {
      id: 'masculine-natural-grooming',
      name: 'Natural Grooming & Crisp Facial Hair Detail',
      categories: ['executive', 'portrait', 'cinema', 'couple'],
      promptSnippet: 'Clean natural grooming preserving individual facial hair stubble, natural brow texture, matte-satin skin finish, and authentic under-eye character'
    }
  ],

  lighting: [
    {
      id: 'rembrandt-45-negfill',
      name: 'Rembrandt 45-Deg Key + Negative Fill (3:1-4:1)',
      categories: ['portrait', 'editorial', 'fashion'],
      ratio: '3:1 to 4:1',
      promptSnippet: '45-degree Rembrandt key light sculpting a subtle cheek triangle, paired with black V-flat negative fill on the shadow side for 3D facial depth'
    },
    {
      id: 'butterfly-paramount-beauty',
      name: 'Butterfly Beauty Dish + Clamshell Fill (2:1)',
      categories: ['beauty', 'fashion', 'editorial'],
      ratio: '2:1',
      promptSnippet: 'Overhead beauty dish Butterfly lighting casting delicate symmetrical shadow beneath the nose with soft lower silver reflector clamshell fill'
    },
    {
      id: 'split-noir-chiaroscuro',
      name: 'Split Chiaroscuro Trailer Lighting (6:1)',
      categories: ['cinema', 'night'],
      ratio: '5:1 to 8:1',
      promptSnippet: '90-degree dramatic split key light with deep 6:1 chiaroscuro shadow falloff, motivated rim separation, and rich negative fill'
    },
    {
      id: 'golden-hour-rim-bounce',
      name: 'Golden-Hour Back-Rim + Warm Bounce Fill (2.5:1)',
      categories: ['outdoor', 'lifestyle', 'couple'],
      ratio: '2.5:1',
      promptSnippet: 'Low late-afternoon golden sun creating glowing hair rim separation paired with soft warm open-shade bounce fill on faces'
    },
    {
      id: 'window-overcast-north',
      name: 'North-Facing Overcast Window Wrap (3:1)',
      categories: ['portrait', 'executive', 'couple', 'lifestyle'],
      ratio: '3:1',
      promptSnippet: 'Large north-facing diffused glass window key at 45 degrees with crisp rectangular iris catchlights and dark opposite wall negative fill'
    },
    {
      id: 'neon-tungsten-kelvin-split',
      name: '3200K Practical Key vs 6500K Cool Rim Split',
      categories: ['night', 'cinema'],
      ratio: '4:1',
      promptSnippet: 'Warm 3200K tungsten practical light illuminating subject face separated against 6500K cool evening cyan background depth'
    },
    {
      id: 'commercial-strip-scrim',
      name: 'Dual Strip Softboxes + Overhead Scrim (3:1)',
      categories: ['product'],
      ratio: '3:1',
      promptSnippet: 'Dual vertical strip softboxes defining sleek edge highlights + diffused overhead scrim for smooth product gradients and grounded contact shadow'
    },
    {
      id: 'direct-on-camera-strobe',
      name: 'Axial Editorial Flash + Ambient Balance',
      categories: ['flash', 'fashion', 'night'],
      ratio: '3.5:1',
      promptSnippet: 'Crisp axial on-camera strobe balanced slightly over ambient background exposure for high-fashion editorial punch'
    }
  ]
};

const PORTRAIT_SAFE_CATEGORIES = ['poses', 'cameras', 'lenses', 'effects', 'makeup', 'lighting'];

module.exports = {
  CRAFT_CATALOG,
  PORTRAIT_SAFE_CATEGORIES
};

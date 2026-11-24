#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getCrewList, STUDIO_PRESETS } = require('../lib/crew.cjs');
const { CRAFT_CATALOG } = require('../lib/craft-library.cjs');
const { listCraftCatalog, researchPhotographyTechniques } = require('../lib/craft-research.cjs');
const { recommendCraftStack } = require('../lib/craft-planner.cjs');
const { StudioStore, defaultStudioHome } = require('../lib/store.cjs');
const { createStudioWebServer } = require('../lib/studio-web.cjs');
const {
  detectAvailableExecutors,
  executeRenderWithProvider,
  analyzeAnchorWithVision
} = require('../lib/executors.cjs');

const store = new StudioStore(defaultStudioHome());
let webInstance = null;
let webInfo = null;

const ROLE_ENUM = [
  'showrunner-director',
  'forensic-analyst',
  'consistency-guardian',
  'art-stylist',
  'lighting-director',
  'camera-optics',
  'prompt-editor',
  'anti-ai-auditor',
  'executive-producer',
  'creative-director',
  'dop-optics',
  'pose-stylist',
  'prompt-compiler',
  'colorist-qa'
];

const SCOPE_ENUM = ['subtle-retouch', 'targeted-edit', 'full-editorial'];
const SUBJECT_ENUM = ['auto', 'portrait', 'couple', 'product', 'night', 'outdoor', 'executive'];
const CRAFT_OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    poseId: { type: 'string', description: 'Catalog pose ID (e.g. contrapposto-editorial, turtle-jawline-power, over-shoulder-cinema).' },
    cameraId: { type: 'string', description: 'Catalog camera/film ID (e.g. hasselblad-x2d-portra400, arri-alexa35-vision3).' },
    lensId: { type: 'string', description: 'Catalog lens ID (e.g. 85mm-f14-gm, 40mm-cooke-anamorphic, 105mm-f14-sigma).' },
    effectIds: { type: 'array', items: { type: 'string' }, description: 'Optical filter/effect IDs (e.g. black-pro-mist-1-4, teal-amber-trailer-grade).' },
    makeupId: { type: 'string', description: 'Catalog makeup/grooming ID (e.g. editorial-glass-skin, deconstructed-cinema-kohl).' },
    lightingId: { type: 'string', description: 'Catalog lighting setup ID (e.g. rembrandt-45-negfill, butterfly-paramount-beauty).' },
    researchQuery: { type: 'string', description: 'Optional live photography research query to enrich direction.' }
  },
  additionalProperties: false
};

const TOOLS = [
  {
    name: 'studio_list_crew',
    description: 'List the 8-specialist AI Photo Studio crew, presets, operating modes, and available executors.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'studio_create_job',
    description: 'Intake a local photo as the biometric/product anchor and start a studio job (optional autoRun).',
    inputSchema: {
      type: 'object',
      required: ['imagePath'],
      properties: {
        imagePath: { type: 'string', description: 'Absolute path to source PNG/JPEG/WebP.' },
        mode: { type: 'string', enum: ['autonomous', 'directed'] },
        scope: { type: 'string', enum: SCOPE_ENUM },
        preset: { type: 'string', enum: Object.keys(STUDIO_PRESETS) },
        brief: { type: 'string', description: 'Exact art direction order (if directed).' },
        subjectHint: { type: 'string', enum: SUBJECT_ENUM },
        locks: {
          type: 'object',
          properties: {
            keepPose: { type: 'boolean' },
            keepWardrobe: { type: 'boolean' },
            keepBackground: { type: 'boolean' },
            keepFraming: { type: 'boolean' }
          },
          additionalProperties: false
        },
        craftOptions: CRAFT_OPTIONS_SCHEMA,
        autoRun: { type: 'boolean', description: 'Run all 8 specialists immediately.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_run_autonomous',
    description: 'Autonomous mode: triage photo and run 8-agent crew. Pass essenceAnalysis & customProposals synthesized from vision to avoid static templates.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        imagePath: { type: 'string' },
        subjectHint: { type: 'string', enum: SUBJECT_ENUM },
        proposalId: { type: 'string' },
        essenceAnalysis: { type: 'string', description: 'Essence & visual subtext extracted from the photo.' },
        customProposals: { type: 'array', items: { type: 'object' }, description: '3 bespoke creative directions derived from photo essence.' },
        craftOptions: CRAFT_OPTIONS_SCHEMA
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_run_directed',
    description: 'Directed mode: follow exact user art direction orders with intervention scope and preservation locks.',
    inputSchema: {
      type: 'object',
      required: ['brief'],
      properties: {
        jobId: { type: 'string' },
        imagePath: { type: 'string' },
        brief: { type: 'string' },
        scope: { type: 'string', enum: SCOPE_ENUM },
        preset: { type: 'string', enum: Object.keys(STUDIO_PRESETS) },
        locks: {
          type: 'object',
          properties: {
            keepPose: { type: 'boolean' },
            keepWardrobe: { type: 'boolean' },
            keepBackground: { type: 'boolean' },
            keepFraming: { type: 'boolean' }
          },
          additionalProperties: false
        },
        craftOptions: CRAFT_OPTIONS_SCHEMA
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_run_essay',
    description: 'Plan and compile a cohesive multi-photo essay (2-6 frames). Pass essenceAnalysis & customFrames synthesized from the photo essence rather than static templates.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        imagePath: { type: 'string' },
        count: { type: 'integer', description: 'Number of shots (2-6, default 5).' },
        subjectHint: { type: 'string', enum: SUBJECT_ENUM },
        brief: { type: 'string' },
        keepWardrobe: { type: 'boolean' },
        essenceAnalysis: { type: 'string', description: 'Essence & visual subtext extracted from the anchor photo.' },
        customFrames: { type: 'array', items: { type: 'object' }, description: 'Bespoke storyboard frames derived from the photo essence.' },
        craftOptions: CRAFT_OPTIONS_SCHEMA
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_analyze_photo',
    description: 'Optional BYOK vision pass: analyze the anchor photo via Gemini or OpenAI Vision to populate expressionTruth and garmentMicroDetails.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'string' },
        provider: { type: 'string', enum: ['auto', 'gemini', 'openai'] },
        model: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_select_proposal',
    description: 'Switch between the 3 autonomous creative proposals on a job and recompile all crew passes.',
    inputSchema: {
      type: 'object',
      required: ['jobId', 'proposalId'],
      properties: {
        jobId: { type: 'string' },
        proposalId: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_save_crew_pass',
    description: 'Record or override a specific specialist crew pass on a job.',
    inputSchema: {
      type: 'object',
      required: ['jobId', 'role', 'payload'],
      properties: {
        jobId: { type: 'string' },
        role: { type: 'string', enum: ROLE_ENUM },
        payload: { type: 'object' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_compile_prompts',
    description: 'Compile all crew passes into prompts for Codex, Gemini, Claude/ComfyUI, and Universal JSON.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'string' },
        preset: { type: 'string', enum: Object.keys(STUDIO_PRESETS) }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_execute_render',
    description: 'Optional BYOK executor: dispatch the compiled edit directly via Gemini or OpenAI API if configured.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'string' },
        provider: { type: 'string', enum: ['gemini', 'openai', 'comfyui'] },
        model: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_register_render',
    description: 'Attach a generated image file to a studio job lineage (v1, v2, ...) for Before/After QA.',
    inputSchema: {
      type: 'object',
      required: ['jobId', 'imagePath'],
      properties: {
        jobId: { type: 'string' },
        imagePath: { type: 'string' },
        engine: { type: 'string' },
        notes: { type: 'string' },
        parentVersion: { type: 'integer' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_submit_qa',
    description: 'Record the Anti-AI Realism Auditor 6-point scorecard; auto-routes fixes and delta prompt on revise.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'string' },
        verdict: { type: 'string', enum: ['pass', 'revise'] },
        identityFidelityScore: { type: 'number' },
        antiSlopScore: { type: 'number' },
        garmentFidelityScore: { type: 'number' },
        realismScore: { type: 'number' },
        lightingCoherenceScore: { type: 'number' },
        anatomyScore: { type: 'number' },
        framingScore: { type: 'number' },
        textureAndCatchlightsOk: { type: 'boolean' },
        revisionNotes: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_get_job',
    description: 'Get full job state, crew board, proposals, prompt packs, asset lineage, and QA history.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: { jobId: { type: 'string' } },
      additionalProperties: false
    }
  },
  {
    name: 'studio_list_jobs',
    description: 'List recent photo studio production jobs.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'studio_start_web',
    description: 'Start (or return URL of) the Local Web Studio Workbench on 127.0.0.1.',
    inputSchema: {
      type: 'object',
      properties: { port: { type: 'integer', description: 'Port on 127.0.0.1 (default 4321).' } },
      additionalProperties: false
    }
  },
  {
    name: 'studio_research_craft',
    description: 'Research photography & cinematography techniques (poses, cameras, lenses, optical filters, makeup, trailer looks) combining curated studio encyclopedia + optional live web lookup.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Search query in PT-BR or EN (e.g. "cinema trailer anamorphic", "jawline posing", "black pro-mist", "editorial glass skin").' },
        category: { type: 'string', enum: ['all', 'poses', 'cameras', 'lenses', 'effects', 'makeup', 'lighting'] },
        subjectType: { type: 'string', enum: ['portrait', 'couple', 'product', 'night', 'outdoor', 'executive'] },
        liveWeb: { type: 'boolean', description: 'Query public web references with local 24h cache (default true).' },
        limit: { type: 'integer' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_list_craft_catalog',
    description: 'Browse the full curated catalog of poses, cameras/emulsions, lenses, optical effects, makeup finishes, lighting rigs, and presets.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['all', 'poses', 'cameras', 'lenses', 'effects', 'makeup', 'lighting', 'presets'] },
        subjectType: { type: 'string', enum: ['portrait', 'couple', 'product', 'night', 'outdoor', 'executive'] }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_compose_look',
    description: 'Recommend or apply a complete look recipe (pose, camera, lens, optical effects, makeup, lighting) with optical conflict warnings, optionally updating a job and recompiling prompts.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Optional existing job ID to update and recompile.' },
        brief: { type: 'string', description: 'Desired mood/goal (e.g. "cinema trailer rain noir", "editorial beauty glass skin").' },
        subjectType: { type: 'string', enum: ['portrait', 'couple', 'product', 'night', 'outdoor', 'executive'] },
        preset: { type: 'string', enum: Object.keys(STUDIO_PRESETS) },
        craftOptions: CRAFT_OPTIONS_SCHEMA
      },
      additionalProperties: false
    }
  }
];

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function respondError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handleToolCall(name, args = {}) {
  switch (name) {
    case 'studio_list_crew':
      return {
        crew: getCrewList(),
        presets: Object.values(STUDIO_PRESETS),
        modes: ['autonomous', 'directed'],
        interventionScopes: SCOPE_ENUM,
        executors: detectAvailableExecutors()
      };
    case 'studio_create_job':
      return {
        job: store.createJobFromFile({
          imagePath: args.imagePath,
          mode: args.mode,
          scope: args.scope,
          preset: args.preset,
          brief: args.brief,
          subjectHint: args.subjectHint,
          locks: args.locks,
          craftOptions: args.craftOptions,
          autoRun: Boolean(args.autoRun)
        })
      };
    case 'studio_run_autonomous': {
      let jobId = args.jobId;
      if (!jobId) {
        if (!args.imagePath) throw new Error('Provide either jobId or imagePath.');
        const created = store.createJobFromFile({ imagePath: args.imagePath, mode: 'autonomous', craftOptions: args.craftOptions });
        jobId = created.id;
      }
      const researchInsights = args.craftOptions?.researchQuery
        ? await researchPhotographyTechniques({ query: args.craftOptions.researchQuery, studioHome: store.studioHome })
        : null;
      return {
        job: store.runAutonomous(jobId, {
          subjectHint: args.subjectHint,
          proposalId: args.proposalId,
          essenceAnalysis: args.essenceAnalysis,
          customProposals: args.customProposals,
          craftOptions: args.craftOptions,
          researchInsights
        })
      };
    }
    case 'studio_run_directed': {
      let jobId = args.jobId;
      if (!jobId) {
        if (!args.imagePath) throw new Error('Provide either jobId or imagePath.');
        const created = store.createJobFromFile({
          imagePath: args.imagePath,
          mode: 'directed',
          brief: args.brief,
          scope: args.scope,
          preset: args.preset,
          locks: args.locks,
          craftOptions: args.craftOptions
        });
        jobId = created.id;
      }
      const researchInsights = args.craftOptions?.researchQuery
        ? await researchPhotographyTechniques({ query: args.craftOptions.researchQuery, studioHome: store.studioHome })
        : null;
      return {
        job: store.runDirected(jobId, {
          brief: args.brief,
          scope: args.scope,
          preset: args.preset,
          locks: args.locks,
          craftOptions: args.craftOptions,
          researchInsights
        })
      };
    }
    case 'studio_run_essay': {
      let jobId = args.jobId;
      if (!jobId) {
        if (!args.imagePath) throw new Error('Provide either jobId or imagePath.');
        const created = store.createJobFromFile({ imagePath: args.imagePath, mode: 'directed', brief: args.brief || '', craftOptions: args.craftOptions });
        jobId = created.id;
      }
      return {
        job: store.runEssay(jobId, {
          count: args.count || 5,
          subjectHint: args.subjectHint,
          brief: args.brief,
          essenceAnalysis: args.essenceAnalysis,
          customFrames: args.customFrames,
          craftOptions: args.craftOptions,
          locks: { keepWardrobe: args.keepWardrobe !== false }
        })
      };
    }
    case 'studio_analyze_photo': {
      const current = store.readJob(args.jobId);
      const vision = await analyzeAnchorWithVision({
        store,
        job: current,
        provider: args.provider || 'auto',
        model: args.model || ''
      });
      return {
        job: store.applyVisionAnalysis(current.id, vision.analysis, vision.provider),
        provider: vision.provider,
        assetUsed: vision.assetUsed
      };
    }
    case 'studio_select_proposal':
      return { job: store.selectProposal(args.jobId, args.proposalId) };
    case 'studio_save_crew_pass':
      return { job: store.saveCrewPass(args.jobId, args.role, args.payload) };
    case 'studio_compile_prompts':
      return { job: store.compilePrompts(args.jobId, args.preset) };
    case 'studio_execute_render': {
      const job = store.readJob(args.jobId);
      const rendered = await executeRenderWithProvider({
        store,
        job,
        provider: args.provider || 'gemini',
        model: args.model || ''
      });
      const updated = store.registerRenderFromBuffer(job.id, rendered);
      return { job: updated, engine: rendered.engine };
    }
    case 'studio_register_render':
      return {
        job: store.registerRenderFromFile(args.jobId, args.imagePath, {
          engine: args.engine,
          notes: args.notes,
          parentVersion: args.parentVersion
        })
      };
    case 'studio_submit_qa':
      return {
        job: store.submitQa(args.jobId, {
          verdict: args.verdict,
          identityFidelityScore: args.identityFidelityScore,
          antiSlopScore: args.antiSlopScore,
          garmentFidelityScore: args.garmentFidelityScore,
          realismScore: args.realismScore,
          lightingCoherenceScore: args.lightingCoherenceScore,
          anatomyScore: args.anatomyScore,
          framingScore: args.framingScore,
          textureAndCatchlightsOk: args.textureAndCatchlightsOk,
          revisionNotes: args.revisionNotes || ''
        })
      };
    case 'studio_get_job':
      return { job: store.readJob(args.jobId), webUrl: webInfo?.url || null };
    case 'studio_list_jobs':
      return { jobs: store.listJobs(), webUrl: webInfo?.url || null };
    case 'studio_start_web': {
      if (!webInstance) {
        webInstance = createStudioWebServer({ store, port: args.port || 4321 });
        webInfo = await webInstance.listen();
      }
      return { ok: true, ...webInfo };
    }
    case 'studio_research_craft':
      return researchPhotographyTechniques({
        query: args.query,
        category: args.category || 'all',
        subjectType: args.subjectType || null,
        liveWeb: args.liveWeb !== false,
        limit: args.limit || 6,
        studioHome: store.studioHome
      });
    case 'studio_list_craft_catalog': {
      if (args.category === 'presets') {
        return { presets: Object.values(STUDIO_PRESETS) };
      }
      const catalog = listCraftCatalog({
        category: args.category || 'all',
        subjectType: args.subjectType || null
      });
      return args.category && args.category !== 'all'
        ? catalog
        : { ...catalog, presets: Object.values(STUDIO_PRESETS) };
    }
    case 'studio_compose_look': {
      const researchInsights = args.craftOptions?.researchQuery
        ? await researchPhotographyTechniques({
            query: args.craftOptions.researchQuery,
            subjectType: args.subjectType || null,
            studioHome: store.studioHome
          })
        : null;
      if (args.jobId) {
        const job = store.composeLook(args.jobId, { ...(args.craftOptions || {}), preset: args.preset }, researchInsights);
        return { job, craftRecipe: job.craftRecipe, promptPacks: job.promptPacks };
      }
      const recipe = recommendCraftStack({
        brief: args.brief || '',
        subjectType: args.subjectType || 'portrait',
        presetId: args.preset || 'editorial-portrait',
        craftOptions: args.craftOptions || {},
        researchInsights
      });
      return { craftRecipe: recipe };
    }
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }
}

const STUDIO_RESOURCES = [
  ...Object.keys(CRAFT_CATALOG).map((cat) => ({
    uri: `studio://catalog/${cat}`,
    name: `Craft Catalog: ${cat}`,
    description: `Curated photography & cinematography ${cat} specifications and prompt snippets.`,
    mimeType: 'application/json'
  })),
  {
    uri: 'studio://catalog/presets',
    name: 'Studio Presets',
    description: 'All 10 studio production presets including cinema-trailer and high-fashion-beauty.',
    mimeType: 'application/json'
  },
  {
    uri: 'studio://playbook',
    name: 'Studio Crew Playbook',
    description: 'Master cinematography, lighting ratios, negative fill, posing, and Anti-AI QA standards.',
    mimeType: 'text/markdown'
  }
];

const STUDIO_PROMPTS = [
  {
    name: 'cinema-trailer-shoot',
    description: 'Direct an anamorphic 2.39:1 movie-trailer grade transformation preserving identity.',
    arguments: [
      { name: 'imagePath', description: 'Absolute path to anchor photo', required: true },
      { name: 'mood', description: 'Optional scene mood (e.g. rainy neon noir, golden dusk)', required: false }
    ]
  },
  {
    name: 'editorial-beauty-shoot',
    description: 'Direct a Hasselblad 105mm beauty portrait with authentic pore-level skin & editorial makeup.',
    arguments: [
      { name: 'imagePath', description: 'Absolute path to anchor photo', required: true },
      { name: 'makeupStyle', description: 'Optional makeup style (glass skin, smudged kohl, velvet matte lip)', required: false }
    ]
  },
  {
    name: 'autonomous-essence-shoot',
    description: 'Analyze anchor photo essence first and produce 3 bespoke non-cliché proposals.',
    arguments: [
      { name: 'imagePath', description: 'Absolute path to anchor photo', required: true }
    ]
  }
];

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.method === 'initialize') {
    return respond(msg.id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'ai-photo-studio', version: require('../package.json').version },
      capabilities: { tools: {}, resources: {}, prompts: {} }
    });
  }
  if (msg.method === 'notifications/initialized') return;
  if (msg.method === 'tools/list') {
    return respond(msg.id, { tools: TOOLS });
  }
  if (msg.method === 'resources/list') {
    return respond(msg.id, { resources: STUDIO_RESOURCES });
  }
  if (msg.method === 'resources/read') {
    const uri = String(msg.params?.uri || '');
    if (uri === 'studio://playbook') {
      const playbookPath = path.resolve(__dirname, '..', 'skill', 'references', 'crew-playbook.md');
      const text = fs.existsSync(playbookPath) ? fs.readFileSync(playbookPath, 'utf8') : '';
      return respond(msg.id, { contents: [{ uri, mimeType: 'text/markdown', text }] });
    }
    if (uri === 'studio://catalog/presets') {
      return respond(msg.id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(STUDIO_PRESETS, null, 2) }] });
    }
    const catMatch = uri.match(/^studio:\/\/catalog\/([a-z]+)$/);
    if (catMatch && CRAFT_CATALOG[catMatch[1]]) {
      return respond(msg.id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(CRAFT_CATALOG[catMatch[1]], null, 2) }] });
    }
    return respondError(msg.id, -32602, `Unknown resource URI: ${uri}`);
  }
  if (msg.method === 'prompts/list') {
    return respond(msg.id, { prompts: STUDIO_PROMPTS });
  }
  if (msg.method === 'prompts/get') {
    const pName = String(msg.params?.name || '');
    const pArgs = msg.params?.arguments || {};
    const promptDef = STUDIO_PROMPTS.find((p) => p.name === pName);
    if (!promptDef) return respondError(msg.id, -32602, `Unknown prompt: ${pName}`);
    const instructions = pName === 'cinema-trailer-shoot'
      ? `Run studio_research_craft for "cinema trailer anamorphic ${pArgs.mood || ''}", then call studio_run_directed with imagePath="${pArgs.imagePath || '<path>'}" and preset="cinema-trailer".`
      : pName === 'editorial-beauty-shoot'
        ? `Run studio_research_craft for "editorial beauty makeup ${pArgs.makeupStyle || ''}", then call studio_run_directed with imagePath="${pArgs.imagePath || '<path>'}" and preset="high-fashion-beauty".`
        : `Inspect imagePath="${pArgs.imagePath || '<path>'}" visually, extract essenceAnalysis + 3 bespoke proposals, and call studio_run_autonomous.`;
    return respond(msg.id, {
      description: promptDef.description,
      messages: [{ role: 'user', content: { type: 'text', text: instructions } }]
    });
  }
  if (msg.method === 'tools/call') {
    const { name, arguments: args = {} } = msg.params || {};
    try {
      const payload = await handleToolCall(name, args);
      return respond(msg.id, {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }]
      });
    } catch (err) {
      if (err.code === -32601) {
        return respondError(msg.id, -32601, err.message);
      }
      return respond(msg.id, {
        isError: true,
        content: [{ type: 'text', text: err.message }]
      });
    }
  }
  if (msg.id !== undefined) {
    respondError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

if (require.main === module) {
  let buffer = Buffer.alloc(0);
  const processLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed || /^content-length:/i.test(trimmed)) return;
    try {
      const msg = JSON.parse(trimmed);
      handleMessage(msg).catch((err) => {
        if (msg && msg.id !== undefined) respondError(msg.id, -32603, err.message);
      });
    } catch {}
  };

  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      const headerMatch = buffer.toString('utf8', 0, Math.min(buffer.length, 256)).match(/^Content-Length:\s*(\d+)\r?\n\r?\n/i);
      if (headerMatch) {
        const headerBytes = Buffer.byteLength(headerMatch[0], 'utf8');
        const bodyLen = Number(headerMatch[1]);
        if (buffer.length < headerBytes + bodyLen) break;
        const body = buffer.slice(headerBytes, headerBytes + bodyLen).toString('utf8');
        buffer = buffer.slice(headerBytes + bodyLen);
        processLine(body);
        continue;
      }
      const nlIdx = buffer.indexOf(0x0a);
      if (nlIdx === -1) break;
      const line = buffer.slice(0, nlIdx).toString('utf8');
      buffer = buffer.slice(nlIdx + 1);
      processLine(line);
    }
  });
}

module.exports = { TOOLS, STUDIO_RESOURCES, STUDIO_PROMPTS, handleMessage, handleToolCall };

#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { getCrewList, STUDIO_PRESETS } = require('../lib/crew.cjs');
const { StudioStore, defaultStudioHome } = require('../lib/store.cjs');
const { createStudioWebServer } = require('../lib/studio-web.cjs');
const { detectAvailableExecutors, executeRenderWithProvider } = require('../lib/executors.cjs');

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
        autoRun: { type: 'boolean', description: 'Run all 8 specialists immediately.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_run_autonomous',
    description: 'Autonomous mode: pass a photo (or jobId) and let the 8-agent crew triage, propose 3 directions, and compile prompts.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        imagePath: { type: 'string' },
        subjectHint: { type: 'string', enum: SUBJECT_ENUM },
        proposalId: { type: 'string' }
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
        }
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
          autoRun: Boolean(args.autoRun)
        })
      };
    case 'studio_run_autonomous': {
      let jobId = args.jobId;
      if (!jobId) {
        if (!args.imagePath) throw new Error('Provide either jobId or imagePath.');
        const created = store.createJobFromFile({ imagePath: args.imagePath, mode: 'autonomous' });
        jobId = created.id;
      }
      return {
        job: store.runAutonomous(jobId, {
          subjectHint: args.subjectHint,
          proposalId: args.proposalId
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
          locks: args.locks
        });
        jobId = created.id;
      }
      return {
        job: store.runDirected(jobId, {
          brief: args.brief,
          scope: args.scope,
          preset: args.preset,
          locks: args.locks
        })
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
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }
}

async function handleMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.method === 'initialize') {
    return respond(msg.id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'ai-photo-studio', version: require('../package.json').version },
      capabilities: { tools: {} }
    });
  }
  if (msg.method === 'notifications/initialized') return;
  if (msg.method === 'tools/list') {
    return respond(msg.id, { tools: TOOLS });
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
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      handleMessage(msg).catch((err) => {
        if (msg && msg.id !== undefined) respondError(msg.id, -32603, err.message);
      });
    } catch {}
  });
}

module.exports = { TOOLS, handleMessage, handleToolCall };

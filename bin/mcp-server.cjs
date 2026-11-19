#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const { getCrewList, STUDIO_PRESETS } = require('../lib/crew.cjs');
const { StudioStore, defaultStudioHome } = require('../lib/store.cjs');
const { createStudioWebServer } = require('../lib/studio-web.cjs');

const store = new StudioStore(defaultStudioHome());
let webInstance = null;
let webInfo = null;

const TOOLS = [
  {
    name: 'studio_list_crew',
    description: 'List the 7-member AI Photo Studio crew roles, workflow order, and available visual presets.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'studio_create_job',
    description: 'Intake a local source photo as the biometric/product anchor and start a new full-crew studio production job.',
    inputSchema: {
      type: 'object',
      required: ['imagePath'],
      properties: {
        imagePath: { type: 'string', description: 'Absolute path to source PNG/JPEG/WebP photo.' },
        preset: {
          type: 'string',
          enum: Object.keys(STUDIO_PRESETS),
          description: 'Production preset (defaults to editorial-portrait).'
        },
        brief: { type: 'string', description: 'Optional user goal or mood note.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_save_crew_pass',
    description: 'Record a specialist crew member deliverable on a studio job (forensic-analyst, creative-director, dop-optics, pose-stylist, colorist-qa).',
    inputSchema: {
      type: 'object',
      required: ['jobId', 'role', 'payload'],
      properties: {
        jobId: { type: 'string' },
        role: {
          type: 'string',
          enum: [
            'executive-producer',
            'forensic-analyst',
            'creative-director',
            'dop-optics',
            'pose-stylist',
            'prompt-compiler',
            'colorist-qa'
          ]
        },
        payload: { type: 'object' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_compile_prompts',
    description: 'Compile all crew passes into ready-to-run prompts for Codex (ChatGPT Image), Gemini, and Claude/Universal JSON.',
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
    name: 'studio_register_render',
    description: 'Attach a generated/edited output image file to a studio job for Before/After comparison and QA.',
    inputSchema: {
      type: 'object',
      required: ['jobId', 'imagePath'],
      properties: {
        jobId: { type: 'string' },
        imagePath: { type: 'string' },
        engine: { type: 'string', description: 'e.g. codex, gemini, claude, comfyui' },
        notes: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_submit_qa',
    description: 'Record the Colorist & QA Director 6-point scorecard comparing the render against the anchor photo.',
    inputSchema: {
      type: 'object',
      required: ['jobId', 'verdict'],
      properties: {
        jobId: { type: 'string' },
        verdict: { type: 'string', enum: ['pass', 'revise'] },
        identityFidelityScore: { type: 'number' },
        textureAndCatchlightsOk: { type: 'boolean' },
        revisionNotes: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_get_job',
    description: 'Get full status, crew passes, prompt packs, renders, and QA history for a job.',
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
    description: 'Start (or return the URL of) the Local Web Studio UI on 127.0.0.1 for Before/After comparison and 1-click prompt copying.',
    inputSchema: {
      type: 'object',
      properties: { port: { type: 'integer', description: 'Port on 127.0.0.1 (defaults to 4321).' } },
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
      return { crew: getCrewList(), presets: Object.values(STUDIO_PRESETS) };
    case 'studio_create_job':
      return { job: store.createJobFromFile({ imagePath: args.imagePath, preset: args.preset, brief: args.brief }) };
    case 'studio_save_crew_pass':
      return { job: store.saveCrewPass(args.jobId, args.role, args.payload) };
    case 'studio_compile_prompts':
      return { job: store.compilePrompts(args.jobId, args.preset) };
    case 'studio_register_render':
      return {
        job: store.registerRenderFromFile(args.jobId, args.imagePath, { engine: args.engine, notes: args.notes })
      };
    case 'studio_submit_qa':
      return {
        job: store.submitQa(args.jobId, {
          verdict: args.verdict,
          identityFidelityScore: args.identityFidelityScore,
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
      serverInfo: { name: 'ai-photo-studio', version: '1.0.0' },
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
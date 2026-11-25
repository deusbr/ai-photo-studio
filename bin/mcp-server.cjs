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

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_PROTOCOL_VERSION = '2025-03-26';
const MAX_HEADER_BYTES = 16 * 1024;
const MAX_MCP_MESSAGE_BYTES = 64 * 1024 * 1024;
const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;

let clientCapabilities = {};
let negotiatedProtocolVersion = DEFAULT_PROTOCOL_VERSION;
let nextServerRequestId = 1;
const pendingClientRequests = new Map();

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
    annotations: {
      title: 'List Studio Crew',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'studio_create_job',
    description: 'Intake a local photo as the biometric/product anchor and start a studio job (optional autoRun).',
    annotations: {
      title: 'Create Studio Job',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    },
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
    annotations: {
      title: 'Run Autonomous Direction',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
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
    annotations: {
      title: 'Run Directed Shoot',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
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
    annotations: {
      title: 'Plan Multi-Shot Essay',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
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
    description: 'Analyze the anchor photo via MCP sampling, Ollama, Gemini, or OpenAI Vision to populate expressionTruth and garmentMicroDetails.',
    annotations: {
      title: 'Analyze Anchor Photo',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'string' },
        provider: { type: 'string', enum: ['auto', 'sampling', 'gemini', 'openai', 'ollama'] },
        model: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_select_proposal',
    description: 'Switch between the 3 autonomous creative proposals on a job and recompile all crew passes.',
    annotations: {
      title: 'Select Proposal',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
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
    annotations: {
      title: 'Save Crew Pass',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
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
    annotations: {
      title: 'Compile Prompt Packs',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
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
    description: 'Optional BYOK executor: dispatch the compiled edit directly via Gemini, OpenAI, or ComfyUI API if configured.',
    annotations: {
      title: 'Execute Render',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'string' },
        provider: { type: 'string', enum: ['gemini', 'openai', 'comfyui'] },
        model: { type: 'string' },
        includeImage: { type: 'boolean', description: 'Attach rendered image block in response content when <= 4 MB (default true).' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_register_render',
    description: 'Attach a generated image file to a studio job lineage (v1, v2, ...) for Before/After QA.',
    annotations: {
      title: 'Register Render',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      required: ['jobId', 'imagePath'],
      properties: {
        jobId: { type: 'string' },
        imagePath: { type: 'string' },
        engine: { type: 'string' },
        notes: { type: 'string' },
        parentVersion: { type: 'integer' },
        includeImage: { type: 'boolean', description: 'Attach registered image block in response content when <= 4 MB (default true).' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_submit_qa',
    description: 'Record the Anti-AI Realism Auditor 8-point scorecard; auto-routes fixes and delta prompt on revise.',
    annotations: {
      title: 'Submit Anti-AI QA Scorecard',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    },
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
    annotations: {
      title: 'Get Studio Job',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'string' },
        includeImage: { type: 'boolean', description: 'Attach active render or clean anchor image block when <= 4 MB (default false).' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'studio_list_jobs',
    description: 'List recent photo studio production jobs.',
    annotations: {
      title: 'List Studio Jobs',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'studio_start_web',
    description: 'Start (or return URL of) the Local Web Studio Workbench on 127.0.0.1.',
    annotations: {
      title: 'Start Web Workbench',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: 'object',
      properties: { port: { type: 'integer', description: 'Port on 127.0.0.1 (default 4321).' } },
      additionalProperties: false
    }
  },
  {
    name: 'studio_research_craft',
    description: 'Research photography & cinematography techniques (poses, cameras, lenses, optical filters, makeup, trailer looks) combining curated studio encyclopedia + optional live web lookup.',
    annotations: {
      title: 'Research Photography Craft',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
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
    annotations: {
      title: 'List Craft Catalog',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
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
    annotations: {
      title: 'Compose Craft Look',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
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

function useContentLengthResponses() {
  return process.env.MCP_RESPONSE_FRAMING === 'content-length' || process.argv.includes('--content-length-responses');
}

function writeProtocolMessage(payload) {
  const json = JSON.stringify(payload);
  if (useContentLengthResponses()) {
    const byteLength = Buffer.byteLength(json, 'utf8');
    process.stdout.write(`Content-Length: ${byteLength}\r\n\r\n${json}`);
    return;
  }
  process.stdout.write(json + '\n');
}

function respond(id, result) {
  writeProtocolMessage({ jsonrpc: '2.0', id, result });
}

function respondError(id, code, message) {
  writeProtocolMessage({ jsonrpc: '2.0', id, error: { code, message } });
}

function sendClientRequest(method, params = {}, timeoutMs = Number(process.env.MCP_SAMPLING_TIMEOUT_MS) || 45000) {
  return new Promise((resolve, reject) => {
    const id = `srv_${nextServerRequestId++}`;
    const timer = setTimeout(() => {
      pendingClientRequests.delete(id);
      reject(new Error(`MCP client request "${method}" timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    pendingClientRequests.set(id, { resolve, reject, timer, method });
    writeProtocolMessage({ jsonrpc: '2.0', id, method, params });
  });
}

function rejectPendingClientRequests(reason) {
  for (const [id, entry] of pendingClientRequests.entries()) {
    clearTimeout(entry.timer);
    entry.reject(new Error(reason));
    pendingClientRequests.delete(id);
  }
}

function parseVisionJsonFromText(rawText) {
  let cleaned = String(rawText || '').trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {}
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  }
  throw new Error('MCP sampling vision response did not return a valid JSON object.');
}

function resolveAnchorPayload(job) {
  const targetAsset = job.sourceImage?.cleanedAssetName || job.sourceImage?.assetName;
  const anchorPath = store.resolveAssetPath(job.id, targetAsset);
  const bytes = fs.readFileSync(anchorPath);
  const mimeType = job.sourceImage?.cleanedAssetName && targetAsset.endsWith('.jpg')
    ? 'image/jpeg'
    : (job.sourceImage?.mimeType || 'image/png');
  return {
    assetUsed: targetAsset,
    mimeType,
    base64: bytes.toString('base64')
  };
}

function buildSamplingVisionInstruction() {
  return [
    'Analyze this photo deeply as a master Executive Showrunner, Forensic Photo Analyst, Art Director, and Director of Photography.',
    'Feel the emotional essence, clothing archetype, color story, and natural world of THIS specific photo—do NOT output generic or cliché European stone terraces unless the photo truly calls for it.',
    'Return ONLY a compact JSON object with these keys:',
    'subjectType (portrait|couple|product|night|outdoor|executive),',
    'essenceAnalysis (2-3 sentences capturing mood, wardrobe archetype, cultural context, and visual subtext),',
    'poseAndExpressionAudit, lightingShadowsAudit, correctionsSummary,',
    'expressionTruth (exact mouth/eye expression and eyelid relaxation to preserve without inventing generic smiles),',
    'garmentMicroDetails (exact collars, plackets, stripe spacing, chest patches/logos, caps, jewelry, buttons, nail polish, bags),',
    'antiBeautificationLocks (pores, freckles, vellus hair, natural asymmetry to preserve),',
    'recommendedLocation (bespoke context-matched setting derived from the photo essence),',
    'artDirectionRationale, compositionArchitecture (foreground depth layering + frame-within-frame + decisive moment),',
    'makeupStyling (natural grooming or editorial finish honoring visible pores & texture),',
    'motivatedLightSource, contrastRatio (e.g. 3:1 or 4:1), negativeFill, kelvinSeparation,',
    'customProposals (array of 3 unique creative directions tailored ONLY to this photo, each with id, label, preset, interventionScope, confidence, concept, locationOrBackdrop, compositionArchitecture, motivatedLightSource, contrastRatio, negativeFill, kelvinSeparation, cameraAndEmulsion, primeLens, rationale),',
    'customEssayFrames (array of 5 unique cohesive storyboard shots evolving naturally from this photo essence, each with id, title, lens, angle, location, compositionArchitecture, motivatedLightSource, contrastRatio, negativeFill, kelvinSeparation, lighting, pose).'
  ].join(' ');
}

function extractSamplingText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (typeof result.content === 'string') return result.content;
  if (Array.isArray(result.content)) {
    return result.content.map((c) => c?.text || '').join('\n');
  }
  if (result.content && typeof result.content === 'object') {
    return result.content.text || '';
  }
  return result.text || '';
}

async function analyzeAnchorWithMcpSampling(job, requester) {
  const anchor = resolveAnchorPayload(job);
  const response = await requester('sampling/createMessage', {
    messages: [
      {
        role: 'user',
        content: {
          type: 'image',
          data: anchor.base64,
          mimeType: anchor.mimeType
        }
      },
      {
        role: 'user',
        content: {
          type: 'text',
          text: buildSamplingVisionInstruction()
        }
      }
    ],
    maxTokens: 2048
  });
  const rawText = extractSamplingText(response);
  const parsed = parseVisionJsonFromText(rawText);
  return {
    provider: 'mcp-sampling',
    assetUsed: anchor.assetUsed,
    analysis: parsed
  };
}

function resolveMimeTypeForAsset(assetName, fallbackMime = 'image/png') {
  const ext = path.extname(String(assetName || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return fallbackMime || 'image/png';
}

function selectTargetAssetForJob(job, preferRender = true) {
  if (!job) return null;
  if (preferRender && Array.isArray(job.renders) && job.renders.length > 0) {
    const active = job.activeRenderVersion !== undefined && job.activeRenderVersion !== null
      ? job.renders.find((r) => r.version === Number(job.activeRenderVersion))
      : null;
    const chosen = active || job.renders[job.renders.length - 1];
    if (chosen?.assetName) {
      return {
        assetName: chosen.assetName,
        mimeType: chosen.mimeType || resolveMimeTypeForAsset(chosen.assetName)
      };
    }
  }
  const anchorAsset = job.sourceImage?.cleanedAssetName || job.sourceImage?.assetName;
  if (!anchorAsset) return null;
  return {
    assetName: anchorAsset,
    mimeType: resolveMimeTypeForAsset(anchorAsset, job.sourceImage?.mimeType)
  };
}

function buildImageContentBlocks(job, { preferRender = true, maxBytes = Number(process.env.MCP_MAX_IMAGE_BYTES) || MAX_INLINE_IMAGE_BYTES } = {}) {
  const target = selectTargetAssetForJob(job, preferRender);
  if (!target) return [];
  try {
    const fullPath = store.resolveAssetPath(job.id, target.assetName);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile() || stat.size === 0 || stat.size > maxBytes) {
      return [];
    }
    const buf = fs.readFileSync(fullPath);
    return [
      {
        type: 'image',
        data: buf.toString('base64'),
        mimeType: target.mimeType
      }
    ];
  } catch {
    return [];
  }
}

async function handleToolCall(name, args = {}, context = {}) {
  const requester = context.sendClientRequest || sendClientRequest;
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
      const researchInsights = args.craftOptions?.researchQuery
        ? await researchPhotographyTechniques({
            query: args.craftOptions.researchQuery,
            subjectType: args.subjectHint || null,
            studioHome: store.studioHome
          })
        : null;
      return {
        job: store.runEssay(jobId, {
          count: args.count || 5,
          subjectHint: args.subjectHint,
          brief: args.brief,
          essenceAnalysis: args.essenceAnalysis,
          customFrames: args.customFrames,
          craftOptions: args.craftOptions,
          researchInsights,
          locks: { keepWardrobe: args.keepWardrobe !== false }
        })
      };
    }
    case 'studio_analyze_photo': {
      const current = store.readJob(args.jobId);
      const requestedProvider = args.provider || 'auto';
      const hasCloudKeys = Boolean(
        (process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim()) ||
        (process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim())
      );
      const canSample = Boolean(clientCapabilities && clientCapabilities.sampling);

      if (requestedProvider === 'sampling' || requestedProvider === 'mcp-sampling') {
        if (!canSample) {
          throw new Error('MCP client did not advertise sampling capability during initialize.');
        }
        const vision = await analyzeAnchorWithMcpSampling(current, requester);
        return {
          job: store.applyVisionAnalysis(current.id, vision.analysis, 'mcp-sampling'),
          provider: 'mcp-sampling',
          assetUsed: vision.assetUsed
        };
      }

      if (requestedProvider === 'auto' && !hasCloudKeys && canSample) {
        try {
          const vision = await analyzeAnchorWithMcpSampling(current, requester);
          return {
            job: store.applyVisionAnalysis(current.id, vision.analysis, 'mcp-sampling'),
            provider: 'mcp-sampling',
            assetUsed: vision.assetUsed
          };
        } catch (samplingErr) {
          if (!process.env.OLLAMA_URL) {
            throw samplingErr;
          }
        }
      }

      const vision = await analyzeAnchorWithVision({
        store,
        job: current,
        provider: requestedProvider,
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
      const requestedPort = args.port !== undefined && args.port !== null ? Number(args.port) : null;
      if (webInstance && webInfo && requestedPort !== null && requestedPort !== webInfo.port) {
        await webInstance.close();
        webInstance = null;
        webInfo = null;
      }
      if (!webInstance) {
        webInstance = createStudioWebServer({ store, port: requestedPort !== null ? requestedPort : 4321 });
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

function shouldAttachToolImages(toolName, args = {}) {
  const explicit = args.includeImage !== undefined ? args.includeImage : args.includeImages;
  if (toolName === 'studio_get_job') {
    return explicit === true;
  }
  if (toolName === 'studio_execute_render' || toolName === 'studio_register_render') {
    return explicit !== false;
  }
  return false;
}

function handleClientResponse(msg) {
  const pending = pendingClientRequests.get(msg.id);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingClientRequests.delete(msg.id);
  if (msg.error) {
    pending.reject(new Error(msg.error.message || `Client error (${msg.error.code ?? 'unknown'})`));
  } else {
    pending.resolve(msg.result);
  }
  return true;
}

async function handleMessage(msg, context = {}) {
  if (!msg || typeof msg !== 'object') return;

  if (!msg.method && msg.id !== undefined && ('result' in msg || 'error' in msg)) {
    handleClientResponse(msg);
    return;
  }

  if (msg.method === 'initialize') {
    const requestedVersion = msg.params?.protocolVersion;
    negotiatedProtocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
      ? requestedVersion
      : DEFAULT_PROTOCOL_VERSION;
    clientCapabilities = msg.params?.capabilities && typeof msg.params.capabilities === 'object'
      ? msg.params.capabilities
      : {};
    return respond(msg.id, {
      protocolVersion: negotiatedProtocolVersion,
      serverInfo: { name: 'ai-photo-studio', version: require('../package.json').version },
      capabilities: { tools: {}, resources: {}, prompts: {} }
    });
  }
  if (msg.method === 'notifications/initialized') return;
  if (msg.method === 'ping') {
    if (msg.id !== undefined) return respond(msg.id, {});
    return;
  }
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
      const payload = await handleToolCall(name, args, context);
      const imageBlocks = shouldAttachToolImages(name, args) && payload?.job
        ? buildImageContentBlocks(payload.job, { preferRender: true })
        : [];
      return respond(msg.id, {
        content: [
          { type: 'text', text: JSON.stringify(payload, null, 2) },
          ...imageBlocks
        ],
        structuredContent: payload
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

function findHeaderTerminator(buf) {
  const crlfIdx = buf.indexOf('\r\n\r\n');
  const lfIdx = buf.indexOf('\n\n');
  if (crlfIdx !== -1 && (lfIdx === -1 || crlfIdx <= lfIdx)) {
    return { index: crlfIdx, length: 4 };
  }
  if (lfIdx !== -1) {
    return { index: lfIdx, length: 2 };
  }
  return null;
}

function parseContentLengthHeader(headerText) {
  const lines = headerText.split(/\r?\n/);
  let contentLength = null;
  for (const line of lines) {
    const match = line.match(/^content-length\s*:\s*(\d+)\s*$/i);
    if (match) {
      contentLength = Number(match[1]);
    }
  }
  if (contentLength === null || !Number.isInteger(contentLength) || contentLength < 0 || contentLength > MAX_MCP_MESSAGE_BYTES) {
    return null;
  }
  return contentLength;
}

function createStdioFramingParser(onMessage, onParseError) {
  let buffer = Buffer.alloc(0);

  const dispatchJson = (rawText) => {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      onParseError('Parse error: malformed JSON payload');
      return;
    }
    onMessage(msg);
  };

  const skipLeadingWhitespace = () => {
    let offset = 0;
    while (offset < buffer.length) {
      const b = buffer[offset];
      if (b === 0x0d || b === 0x0a || b === 0x20 || b === 0x09) {
        offset += 1;
      } else {
        break;
      }
    }
    if (offset > 0) {
      buffer = buffer.subarray(offset);
    }
  };

  return {
    push(chunk) {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8')]);
      while (buffer.length > 0) {
        skipLeadingWhitespace();
        if (buffer.length === 0) break;

        const peek = buffer.subarray(0, Math.min(buffer.length, 64)).toString('utf8');
        const looksLikeHeader = /^(?:content-length|content-type|[a-z][a-z0-9-]*)\s*:/i.test(peek) && !peek.startsWith('{') && !peek.startsWith('[');

        if (looksLikeHeader) {
          const term = findHeaderTerminator(buffer);
          if (!term) {
            if (buffer.length > MAX_HEADER_BYTES) {
              buffer = Buffer.alloc(0);
              onParseError('Parse error: MCP header exceeds maximum size');
            }
            break;
          }
          if (term.index > MAX_HEADER_BYTES) {
            buffer = buffer.subarray(term.index + term.length);
            onParseError('Parse error: MCP header exceeds maximum size');
            continue;
          }
          const headerText = buffer.subarray(0, term.index).toString('utf8');
          const contentLength = parseContentLengthHeader(headerText);
          if (contentLength === null) {
            buffer = buffer.subarray(term.index + term.length);
            onParseError('Parse error: invalid or missing Content-Length header');
            continue;
          }
          const bodyStart = term.index + term.length;
          const totalBytes = bodyStart + contentLength;
          if (buffer.length < totalBytes) {
            break;
          }
          const bodyText = buffer.subarray(bodyStart, totalBytes).toString('utf8');
          buffer = buffer.subarray(totalBytes);
          dispatchJson(bodyText);
          continue;
        }

        const nlIdx = buffer.indexOf(0x0a);
        if (nlIdx === -1) break;
        const lineText = buffer.subarray(0, nlIdx).toString('utf8');
        buffer = buffer.subarray(nlIdx + 1);
        dispatchJson(lineText);
      }
    },
    end() {
      skipLeadingWhitespace();
      if (buffer.length > 0) {
        const trailing = buffer.toString('utf8');
        buffer = Buffer.alloc(0);
        dispatchJson(trailing);
      }
    }
  };
}

if (require.main === module) {
  const parser = createStdioFramingParser(
    (msg) => {
      handleMessage(msg).catch((err) => {
        if (msg && msg.id !== undefined) respondError(msg.id, -32603, err.message);
      });
    },
    (errorMsg) => {
      respondError(null, -32700, errorMsg);
    }
  );

  process.stdin.on('data', (chunk) => parser.push(chunk));
  process.stdin.on('end', () => {
    parser.end();
    rejectPendingClientRequests('MCP stdin stream closed.');
  });
}

module.exports = {
  TOOLS,
  STUDIO_RESOURCES,
  STUDIO_PROMPTS,
  SUPPORTED_PROTOCOL_VERSIONS,
  handleMessage,
  handleToolCall,
  createStdioFramingParser,
  parseVisionJsonFromText,
  buildImageContentBlocks
};

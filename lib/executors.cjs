'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { MAX_IMAGE_BYTES } = require('./image-meta.cjs');
const { withHttpResponse, readBoundedBody } = require('./http-response.cjs');
const { buildComfyWorkflow } = require('./crew.cjs');

const DEFAULT_RENDER_TIMEOUT_MS = 60_000;
const DEFAULT_VISION_TIMEOUT_MS = 45_000;
const DEFAULT_PROBE_TIMEOUT_MS = 10_000;
const VISION_JSON_BYTES = 1024 * 1024;
const RENDER_JSON_BYTES = 4 * Math.ceil(MAX_IMAGE_BYTES / 3) + 1024 * 1024;
const COMFY_UPLOAD_JSON_BYTES = 64 * 1024;
const COMFY_PROMPT_JSON_BYTES = 256 * 1024;
const COMFY_HISTORY_JSON_BYTES = 4 * 1024 * 1024;
const ERROR_JSON_BYTES = 64 * 1024;

const COMFY_IMAGE_EXTENSIONS = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp']
]);

function resolveTimeoutMs(explicitMs, fallbackMs) {
  const explicit = Number(explicitMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const fromEnv = Number(process.env.AI_PHOTO_STUDIO_HTTP_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return fallbackMs;
}

function redactSecretPreview(text, maxLen = 200) {
  const cleaned = String(text || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{15,})\b/g, '[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen)}…`;
}

function validateHttpEndpointUrl(rawUrl, envName = 'URL') {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    throw new Error(`${envName} is not set.`);
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid ${envName}: must be a valid http:// or https:// URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid ${envName} protocol "${parsed.protocol}": only http: and https: are allowed.`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

async function fetchJsonResponse(fetchImpl, url, init, { maxBytes, readError = true, ...timing }) {
  return withHttpResponse(fetchImpl, url, init, timing, async (res, request) => {
    const { ok, status } = res;
    if (!ok && !readError) return { ok, status, json: null };
    const limit = ok ? maxBytes : Math.min(maxBytes, ERROR_JSON_BYTES);
    const body = await readBoundedBody(res, limit, timing.label, request);
    const rawText = body.toString('utf8').replace(/^\uFEFF/, '');
    if (!rawText.trim()) return { ok, status, json: {} };
    try {
      return { ok, status, json: JSON.parse(rawText) };
    } catch {
      const preview = redactSecretPreview(rawText, 200);
      throw new Error(`${timing.label} returned non-JSON response (HTTP ${status}): ${preview}`);
    }
  });
}

function decodeRenderImage(base64, label) {
  if (typeof base64 !== 'string') throw new Error(label + ' returned an invalid image payload.');
  if (Buffer.byteLength(base64, 'base64') > MAX_IMAGE_BYTES) {
    throw new Error(`${label} image exceeds ${MAX_IMAGE_BYTES} bytes.`);
  }
  return Buffer.from(base64, 'base64');
}

function extractBalancedJsonObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractJsonFromText(rawText) {
  if (rawText && typeof rawText === 'object' && !Array.isArray(rawText)) {
    return rawText;
  }
  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('Empty vision response; expected a JSON object.');
  }

  // 1. Direct JSON parse
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct;
    }
  } catch {}

  // 2. Markdown code fence extraction (```json ... ``` or ``` ... ```)
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    const inner = fenceMatch[1].trim();
    try {
      const parsed = JSON.parse(inner);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    const balancedInner = extractBalancedJsonObject(inner);
    if (balancedInner) {
      try {
        const parsed = JSON.parse(balancedInner);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {}
    }
  }

  // 3. Balanced JSON object slice from surrounding prose
  const balanced = extractBalancedJsonObject(text);
  if (balanced) {
    try {
      const parsed = JSON.parse(balanced);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
  }

  throw new Error(`Failed to parse JSON object from response: ${redactSecretPreview(text, 160)}`);
}

function detectAvailableExecutors(env = process.env) {
  const providers = [
    {
      id: 'subscription-manual',
      label: 'Subscription-First (Codex / Gemini CLI / Claude / Web UI)',
      available: true,
      requiresApiKey: false,
      notes: 'Default zero-key workflow using your active AI subscription.'
    },
    {
      id: 'openai',
      label: 'OpenAI GPT Image (Optional BYOK)',
      available: Boolean(env.OPENAI_API_KEY && String(env.OPENAI_API_KEY).trim()),
      requiresApiKey: true,
      envVar: 'OPENAI_API_KEY'
    },
    {
      id: 'gemini',
      label: 'Google Gemini Image (Optional BYOK)',
      available: Boolean(env.GEMINI_API_KEY && String(env.GEMINI_API_KEY).trim()),
      requiresApiKey: true,
      envVar: 'GEMINI_API_KEY'
    },
    {
      id: 'comfyui',
      label: 'Local ComfyUI Endpoint (Optional Local GPU)',
      available: Boolean(env.COMFYUI_URL && String(env.COMFYUI_URL).trim()),
      requiresApiKey: false,
      envVar: 'COMFYUI_URL'
    },
    {
      id: 'ollama',
      label: 'Local Ollama Vision (Private Local GPU)',
      available: Boolean(env.OLLAMA_URL && String(env.OLLAMA_URL).trim()),
      requiresApiKey: false,
      envVar: 'OLLAMA_URL',
      capability: 'vision'
    }
  ];
  return providers;
}

function resolveAnchorBase64(store, job) {
  const targetAsset = job.sourceImage.cleanedAssetName || job.sourceImage.assetName;
  const anchorPath = store.resolveAssetPath(job.id, targetAsset);
  const bytes = fs.readFileSync(anchorPath);
  return {
    mimeType: job.sourceImage.cleanedAssetName && targetAsset.endsWith('.jpg')
      ? 'image/jpeg'
      : (job.sourceImage.mimeType || 'image/png'),
    base64: bytes.toString('base64'),
    bytes,
    fileName: job.sourceImage.fileName || targetAsset,
    assetUsed: targetAsset,
    anchorPath
  };
}

function buildExecutorPayload(job, provider = 'gemini') {
  const packs = job.promptPacks || {};
  const prompt = packs.revisionDeltaPrompt
    ? `${packs.revisionDeltaPrompt}\n\nBase Direction:\n${provider === 'openai' ? packs.codexPrompt : packs.geminiPrompt}`
    : (provider === 'openai' ? packs.codexPrompt : provider === 'comfyui' ? (packs.positivePrompt || packs.claudeComfyPrompt) : packs.geminiPrompt);
  const payload = {
    provider,
    prompt: String(prompt || '').trim(),
    aspectRatio: job.crewPasses?.['showrunner-director']?.targetAspectRatio || job.sourceImage?.aspectRatio || '4:5'
  };
  if (provider === 'comfyui') {
    payload.workflow = packs.comfyWorkflow || null;
  }
  return payload;
}

function findFirstComfyOutputImage(historyJson, promptId) {
  const entry = (historyJson && promptId && historyJson[promptId])
    ? historyJson[promptId]
    : historyJson;
  const outputs = entry?.outputs;
  if (!outputs || typeof outputs !== 'object') return null;
  for (const nodeOutput of Object.values(outputs)) {
    if (Array.isArray(nodeOutput?.images) && nodeOutput.images.length > 0) {
      const img = nodeOutput.images.find((item) => item && item.filename);
      if (img) return img;
    }
  }
  return null;
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSafePreloadedInput(name) {
  return Boolean(name) && name === name.trim() && !name.endsWith('.') &&
    !/[/\\:[\]\p{Cc}\p{Cf}]/u.test(name);
}

async function executeRenderWithProvider({
  store,
  job,
  provider = 'gemini',
  apiKey = '',
  endpoint = '',
  model = '',
  timeoutMs,
  waitForResult = true,
  requireBuffer = false,
  pollIntervalMs = 250,
  maxPollAttempts = 8,
  uploadAnchor = true,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable in this Node.js runtime.');
  }
  const anchor = resolveAnchorBase64(store, job);
  const { prompt } = buildExecutorPayload(job, provider);
  if (!prompt) {
    throw new Error('Job has no compiled prompt pack. Run compilePrompts or orchestration first.');
  }
  const effectiveTimeout = resolveTimeoutMs(timeoutMs, DEFAULT_RENDER_TIMEOUT_MS);

  if (provider === 'gemini') {
    const key = String(apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) throw new Error('GEMINI_API_KEY is not set. Use Subscription-First mode or pass an API key.');
    const targetModel = model || 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`;
    const res = await fetchJsonResponse(fetchImpl, url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: anchor.mimeType, data: anchor.base64 } }
            ]
          }
        ],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    }, { timeoutMs: effectiveTimeout, label: 'Gemini API', maxBytes: RENDER_JSON_BYTES });
    const { json } = res;
    if (!res.ok) {
      throw new Error(`Gemini API error (${res.status}): ${redactSecretPreview(json.error?.message || 'Request failed')}`);
    }
    const parts = json.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => (p.inlineData && p.inlineData.data) || (p.inline_data && p.inline_data.data));
    const inline = imgPart?.inlineData || imgPart?.inline_data;
    if (!inline?.data) {
      throw new Error('Gemini response did not return an image payload.');
    }
    const mime = inline.mimeType || inline.mime_type || 'image/png';
    const ext = mime.includes('jpeg') ? '.jpg' : mime.includes('webp') ? '.webp' : '.png';
    return {
      engine: `gemini:${targetModel}`,
      fileName: `gemini_render${ext}`,
      buffer: decodeRenderImage(inline.data, 'Gemini API'),
      notes: 'Generated via optional Gemini API executor'
    };
  }

  if (provider === 'openai') {
    const key = String(apiKey || process.env.OPENAI_API_KEY || '').trim();
    if (!key) throw new Error('OPENAI_API_KEY is not set. Use Subscription-First mode or pass an API key.');
    const targetModel = model || 'gpt-image-1';
    const form = new FormData();
    form.append('model', targetModel);
    form.append('prompt', prompt);
    form.append('image', new Blob([anchor.bytes], { type: anchor.mimeType }), path.basename(anchor.fileName));
    const res = await fetchJsonResponse(fetchImpl, 'https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form
    }, { timeoutMs: effectiveTimeout, label: 'OpenAI API', maxBytes: RENDER_JSON_BYTES });
    const { json } = res;
    if (!res.ok) {
      throw new Error(`OpenAI API error (${res.status}): ${redactSecretPreview(json.error?.message || 'Request failed')}`);
    }
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('OpenAI images/edits response did not include b64_json.');
    }
    return {
      engine: `openai:${targetModel}`,
      fileName: 'openai_render.png',
      buffer: decodeRenderImage(b64, 'OpenAI API'),
      notes: 'Generated via optional OpenAI Images Edit executor'
    };
  }

  if (provider === 'comfyui') {
    const rawEndpoint = String(endpoint || process.env.COMFYUI_URL || '').trim();
    if (!rawEndpoint) {
      throw new Error('COMFYUI_URL is not set. Provide a local ComfyUI URL or use Subscription-First mode.');
    }
    const baseUrl = validateHttpEndpointUrl(rawEndpoint, 'COMFYUI_URL');
    const deadline = performance.now() + effectiveTimeout;
    const comfyTiming = { timeoutMs: DEFAULT_PROBE_TIMEOUT_MS, deadline };
    const stats = await withHttpResponse(
      fetchImpl, `${baseUrl}/system_stats`, { method: 'GET' },
      { ...comfyTiming, label: 'ComfyUI' },
      ({ ok, status }) => ({ ok, status })
    );
    if (!stats.ok) {
      throw new Error(`ComfyUI endpoint unreachable (${stats.status}).`);
    }

    let anchorReference;
    if (uploadAnchor === false) {
      // Explicit opt-out for operators who manage preloaded inputs themselves.
      anchorReference = path.basename(anchor.fileName);
      if (!isSafePreloadedInput(anchorReference)) {
        throw new Error('ComfyUI preloaded input must be a plain filename in the input directory.');
      }
    } else {
      const ext = COMFY_IMAGE_EXTENSIONS.get(anchor.mimeType);
      if (!ext) throw new Error('ComfyUI Upload requires a PNG, JPEG or WebP anchor.');
      const uploadName = `ai-photo-studio-${crypto.randomUUID()}${ext}`;
      const uploadForm = new FormData();
      uploadForm.append('image', new Blob([anchor.bytes], { type: anchor.mimeType }), uploadName);
      uploadForm.append('type', 'input');
      uploadForm.append('overwrite', 'false');

      const upload = await fetchJsonResponse(fetchImpl, `${baseUrl}/upload/image`, {
        method: 'POST',
        body: uploadForm
      }, { ...comfyTiming, label: 'ComfyUI Upload', maxBytes: COMFY_UPLOAD_JSON_BYTES, readError: false });
      if (!upload.ok) throw new Error(`ComfyUI Upload failed (HTTP ${upload.status}).`);
      // Accept only the generated filename in the requested directory and storage type.
      if (upload.json?.name !== uploadName || upload.json?.subfolder !== '' || upload.json?.type !== 'input') {
        throw new Error('ComfyUI Upload did not confirm the requested input reference.');
      }
      anchorReference = uploadName;
    }

    const baseWorkflow = job.promptPacks?.comfyWorkflow
      ? JSON.parse(JSON.stringify(job.promptPacks.comfyWorkflow))
      : buildComfyWorkflow(job, { checkpoint: model || undefined, anchorImageName: anchorReference });

    let boundInput = false;
    for (const node of Object.values(baseWorkflow)) {
      if (!node || typeof node !== 'object' || !node.inputs) continue;
      if (node.class_type === 'LoadImage') {
        node.inputs.image = anchorReference;
        boundInput = true;
      }
      if (node.class_type === 'CheckpointLoaderSimple' && model) {
        node.inputs.ckpt_name = model;
      }
    }
    if (!boundInput) throw new Error('ComfyUI workflow must include a LoadImage node for the anchor.');

    const clientId = `ai-photo-studio-${crypto.randomBytes(6).toString('hex')}`;
    const queued = await fetchJsonResponse(fetchImpl, `${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: baseWorkflow, client_id: clientId })
    }, { timeoutMs: effectiveTimeout, deadline, label: 'ComfyUI', maxBytes: COMFY_PROMPT_JSON_BYTES });
    const promptJson = queued.json;
    if (!queued.ok) {
      throw new Error(`ComfyUI /prompt error (${queued.status}): ${redactSecretPreview(promptJson?.error?.message || promptJson?.error || 'Workflow rejected')}`);
    }
    const promptId = String(promptJson?.prompt_id || promptJson?.promptId || '').trim();
    if (!promptId) {
      throw new Error('ComfyUI /prompt response did not return a prompt_id.');
    }

    if (waitForResult !== false) {
      const attempts = Math.max(1, Number(maxPollAttempts) || 1);
      const interval = Math.max(0, Number(pollIntervalMs) || 0);

      for (let attempt = 0; attempt < attempts && performance.now() < deadline; attempt += 1) {
        const history = await fetchJsonResponse(
          fetchImpl,
          `${baseUrl}/history/${encodeURIComponent(promptId)}`,
          { method: 'GET' },
          { ...comfyTiming, label: 'ComfyUI History', maxBytes: COMFY_HISTORY_JSON_BYTES, readError: false }
        );
        const img = history.ok ? findFirstComfyOutputImage(history.json, promptId) : null;
        if (img) {
          const viewParams = new URLSearchParams({
            filename: String(img.filename),
            subfolder: String(img.subfolder || ''),
            type: String(img.type || 'output')
          });
          const buffer = await withHttpResponse(
            fetchImpl,
            `${baseUrl}/view?${viewParams.toString()}`,
            { method: 'GET' },
            { timeoutMs: effectiveTimeout, deadline, label: 'ComfyUI View' },
            (res, request) => {
              if (!res.ok) {
                throw new Error(`ComfyUI /view error (${res.status}) for promptId=${promptId}.`);
              }
              return readBoundedBody(res, MAX_IMAGE_BYTES, 'ComfyUI View', request);
            }
          );
          return {
            engine: 'comfyui',
            fileName: path.basename(String(img.filename || 'comfyui_render.png')),
            buffer,
            promptId,
            workflow: baseWorkflow,
            notes: `Generated via local ComfyUI API (promptId=${promptId})`
          };
        }
        if (attempt + 1 >= attempts || performance.now() + interval >= deadline) break;
        if (interval > 0) await sleepMs(interval);
      }
    }

    if (requireBuffer) {
      throw new Error(`ComfyUI workflow queued (promptId=${promptId}) but no output image was available before polling ended.`);
    }

    return {
      engine: 'comfyui',
      queued: true,
      promptId,
      workflow: baseWorkflow,
      notes: `ComfyUI workflow queued successfully (promptId=${promptId}).`
    };
  }

  throw new Error(`Unsupported executor provider: ${provider}. Use gemini, openai, or comfyui.`);
}

async function analyzeAnchorWithVision({
  store,
  job,
  provider = 'auto',
  apiKey = '',
  endpoint = '',
  model = '',
  timeoutMs,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable in this Node.js runtime.');
  }

  const hasOpenAi = Boolean((apiKey && !process.env.GEMINI_API_KEY) || (process.env.OPENAI_API_KEY && String(process.env.OPENAI_API_KEY).trim()));
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim());
  const hasOllama = Boolean((endpoint && String(endpoint).trim()) || (process.env.OLLAMA_URL && String(process.env.OLLAMA_URL).trim()));

  const resolvedProvider = provider === 'auto'
    ? (hasOpenAi ? 'openai' : hasGemini ? 'gemini' : hasOllama ? 'ollama' : 'gemini')
    : provider;

  const anchor = resolveAnchorBase64(store, job);
  const visionTimeout = resolveTimeoutMs(timeoutMs, DEFAULT_VISION_TIMEOUT_MS);

  const instruction = [
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

  if (resolvedProvider === 'gemini') {
    const key = String(apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) throw new Error('GEMINI_API_KEY is not set for standalone vision analysis.');
    const targetModel = model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`;
    const res = await fetchJsonResponse(fetchImpl, url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: instruction },
              { inline_data: { mime_type: anchor.mimeType, data: anchor.base64 } }
            ]
          }
        ],
        generationConfig: { responseMimeType: 'application/json' }
      })
    }, { timeoutMs: visionTimeout, label: 'Gemini Vision', maxBytes: VISION_JSON_BYTES });
    const { json } = res;
    if (!res.ok) throw new Error(`Gemini Vision error (${res.status}): ${redactSecretPreview(json.error?.message || 'Request failed')}`);
    const rawText = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
    return { provider: `gemini:${targetModel}`, assetUsed: anchor.assetUsed, analysis: extractJsonFromText(rawText) };
  }

  if (resolvedProvider === 'openai') {
    const key = String(apiKey || process.env.OPENAI_API_KEY || '').trim();
    if (!key) throw new Error('OPENAI_API_KEY is not set for standalone vision analysis.');
    const targetModel = model || 'gpt-4.1-mini';
    const res = await fetchJsonResponse(fetchImpl, 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: targetModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: `data:${anchor.mimeType};base64,${anchor.base64}` } }
            ]
          }
        ]
      })
    }, { timeoutMs: visionTimeout, label: 'OpenAI Vision', maxBytes: VISION_JSON_BYTES });
    const { json } = res;
    if (!res.ok) throw new Error(`OpenAI Vision error (${res.status}): ${redactSecretPreview(json.error?.message || 'Request failed')}`);
    const rawText = json.choices?.[0]?.message?.content || '{}';
    return { provider: `openai:${targetModel}`, assetUsed: anchor.assetUsed, analysis: extractJsonFromText(rawText) };
  }

  if (resolvedProvider === 'ollama') {
    const ollamaUrl = validateHttpEndpointUrl(endpoint || process.env.OLLAMA_URL || '', 'OLLAMA_URL');
    const targetModel = String(model || process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision').trim();
    const res = await fetchJsonResponse(fetchImpl, `${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: targetModel,
        stream: false,
        format: 'json',
        messages: [
          {
            role: 'user',
            content: instruction,
            images: [anchor.base64]
          }
        ]
      })
    }, { timeoutMs: visionTimeout, label: 'Ollama Vision', maxBytes: VISION_JSON_BYTES });
    const { json } = res;
    if (!res.ok) {
      throw new Error(`Ollama Vision error (${res.status}): ${redactSecretPreview(json.error || 'Request failed')}`);
    }
    const rawText = json.message?.content ?? json.response ?? '';
    return {
      provider: `ollama:${targetModel}`,
      assetUsed: anchor.assetUsed,
      analysis: extractJsonFromText(rawText)
    };
  }

  throw new Error(`Unsupported vision analysis provider: ${resolvedProvider}`);
}

module.exports = {
  DEFAULT_RENDER_TIMEOUT_MS,
  DEFAULT_VISION_TIMEOUT_MS,
  validateHttpEndpointUrl,
  extractJsonFromText,
  detectAvailableExecutors,
  buildExecutorPayload,
  executeRenderWithProvider,
  analyzeAnchorWithVision
};

'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
    }
  ];
  return providers;
}

function resolveAnchorBase64(store, job) {
  const anchorPath = store.resolveAssetPath(job.id, job.sourceImage.assetName);
  const bytes = fs.readFileSync(anchorPath);
  return {
    mimeType: job.sourceImage.mimeType || 'image/png',
    base64: bytes.toString('base64'),
    fileName: job.sourceImage.fileName || job.sourceImage.assetName,
    anchorPath
  };
}

function buildExecutorPayload(job, provider = 'gemini') {
  const packs = job.promptPacks || {};
  const prompt = packs.revisionDeltaPrompt
    ? `${packs.revisionDeltaPrompt}\n\nBase Direction:\n${provider === 'openai' ? packs.codexPrompt : packs.geminiPrompt}`
    : (provider === 'openai' ? packs.codexPrompt : provider === 'comfyui' ? packs.claudeComfyPrompt : packs.geminiPrompt);
  return {
    provider,
    prompt: String(prompt || '').trim(),
    aspectRatio: job.crewPasses?.['showrunner-director']?.targetAspectRatio || job.sourceImage?.aspectRatio || '4:5'
  };
}

async function executeRenderWithProvider({
  store,
  job,
  provider = 'gemini',
  apiKey = '',
  endpoint = '',
  model = '',
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

  if (provider === 'gemini') {
    const key = String(apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) throw new Error('GEMINI_API_KEY is not set. Use Subscription-First mode or pass an API key.');
    const targetModel = model || 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`;
    const res = await fetchImpl(url, {
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
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Gemini API error (${res.status}): ${json.error?.message || 'Request failed'}`);
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
      buffer: Buffer.from(inline.data, 'base64'),
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
    form.append('image', new Blob([Buffer.from(anchor.base64, 'base64')], { type: anchor.mimeType }), path.basename(anchor.fileName));
    const res = await fetchImpl('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`OpenAI API error (${res.status}): ${json.error?.message || 'Request failed'}`);
    }
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('OpenAI images/edits response did not include b64_json.');
    }
    return {
      engine: `openai:${targetModel}`,
      fileName: 'openai_render.png',
      buffer: Buffer.from(b64, 'base64'),
      notes: 'Generated via optional OpenAI Images Edit executor'
    };
  }

  if (provider === 'comfyui') {
    const baseUrl = String(endpoint || process.env.COMFYUI_URL || '').trim().replace(/\/+$/, '');
    if (!baseUrl) throw new Error('COMFYUI_URL is not set. Provide a local ComfyUI URL or use Subscription-First mode.');
    const res = await fetchImpl(`${baseUrl}/system_stats`);
    if (!res.ok) throw new Error(`ComfyUI endpoint unreachable (${res.status}).`);
    throw new Error('ComfyUI endpoint is reachable; import the compiled claudeComfyPrompt / universalJsonSpec into your workflow graph or attach the output render.');
  }

  throw new Error(`Unsupported executor provider: ${provider}. Use gemini, openai, or comfyui.`);
}

module.exports = {
  detectAvailableExecutors,
  buildExecutorPayload,
  executeRenderWithProvider
};

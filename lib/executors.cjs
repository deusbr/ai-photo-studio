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
  const targetAsset = job.sourceImage.cleanedAssetName || job.sourceImage.assetName;
  const anchorPath = store.resolveAssetPath(job.id, targetAsset);
  const bytes = fs.readFileSync(anchorPath);
  return {
    mimeType: job.sourceImage.cleanedAssetName && targetAsset.endsWith('.jpg')
      ? 'image/jpeg'
      : (job.sourceImage.mimeType || 'image/png'),
    base64: bytes.toString('base64'),
    fileName: job.sourceImage.fileName || targetAsset,
    assetUsed: targetAsset,
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

async function analyzeAnchorWithVision({
  store,
  job,
  provider = 'auto',
  apiKey = '',
  model = '',
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable in this Node.js runtime.');
  }
  const resolvedProvider = provider === 'auto'
    ? ((apiKey || process.env.OPENAI_API_KEY) ? 'openai' : 'gemini')
    : provider;
  const anchor = resolveAnchorBase64(store, job);

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
    'motivatedLightSource, contrastRatio (e.g. 3:1 or 4:1), negativeFill, kelvinSeparation,',
    'customProposals (array of 3 unique creative directions tailored ONLY to this photo, each with id, label, preset, interventionScope, confidence, concept, locationOrBackdrop, compositionArchitecture, motivatedLightSource, contrastRatio, negativeFill, kelvinSeparation, cameraAndEmulsion, primeLens, rationale),',
    'customEssayFrames (array of 5 unique cohesive storyboard shots evolving naturally from this photo essence, each with id, title, lens, angle, location, compositionArchitecture, motivatedLightSource, contrastRatio, negativeFill, kelvinSeparation, lighting, pose).'
  ].join(' ');

  if (resolvedProvider === 'gemini') {
    const key = String(apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) throw new Error('GEMINI_API_KEY is not set for standalone vision analysis.');
    const targetModel = model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`;
    const res = await fetchImpl(url, {
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
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Gemini Vision error (${res.status}): ${json.error?.message || 'Request failed'}`);
    const rawText = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '{}';
    return { provider: `gemini:${targetModel}`, assetUsed: anchor.assetUsed, analysis: JSON.parse(rawText) };
  }

  if (resolvedProvider === 'openai') {
    const key = String(apiKey || process.env.OPENAI_API_KEY || '').trim();
    if (!key) throw new Error('OPENAI_API_KEY is not set for standalone vision analysis.');
    const targetModel = model || 'gpt-4.1-mini';
    const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
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
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`OpenAI Vision error (${res.status}): ${json.error?.message || 'Request failed'}`);
    const rawText = json.choices?.[0]?.message?.content || '{}';
    return { provider: `openai:${targetModel}`, assetUsed: anchor.assetUsed, analysis: JSON.parse(rawText) };
  }

  throw new Error(`Unsupported vision analysis provider: ${resolvedProvider}`);
}

module.exports = {
  detectAvailableExecutors,
  buildExecutorPayload,
  executeRenderWithProvider,
  analyzeAnchorWithVision
};

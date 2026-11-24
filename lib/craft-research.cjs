'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { CRAFT_CATALOG } = require('./craft-library.cjs');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SYNONYM_GROUPS = [
  ['pose', 'postura', 'posing'],
  ['jawline', 'mandibula', 'queixo', 'submental'],
  ['hand', 'hands', 'mao', 'maos', 'dedos'],
  ['shoulder', 'ombro', 'ombros'],
  ['camera', 'cameras', 'filme', 'pelicula', 'sensor', 'emulsion'],
  ['lente', 'lenses', 'lens', 'focal'],
  ['anamorfica', 'anamorphic', 'widescreen', 'trailer'],
  ['efeito', 'efeitos', 'effect', 'effects', 'filtro', 'filter'],
  ['neblina', 'fumaca', 'haze', 'volumetric'],
  ['maquiagem', 'makeup', 'make', 'cosmetic'],
  ['pele', 'skin', 'poros', 'pores'],
  ['batom', 'lipstick', 'lip'],
  ['delineado', 'delineador', 'liner', 'eyeliner', 'kohl'],
  ['iluminacao', 'lighting', 'luz', 'light'],
  ['sombra', 'sombras', 'shadow', 'shadows'],
  ['noite', 'noturno', 'night']
];

function stripHtmlTags(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuery(query) {
  const normalized = String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const primary = normalized.split(/[^a-z0-9.+-]+/).filter((t) => t.length >= 2);
  const expanded = new Set();
  for (const tok of primary) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(tok)) {
        for (const w of group) {
          if (!primary.includes(w)) expanded.add(w);
        }
      }
    }
  }
  return { primary, expanded: Array.from(expanded) };
}

function searchCraftCatalog(query = '', { category = 'all', subjectType = null, limit = 8 } = {}) {
  const { primary, expanded } = tokenizeQuery(query);
  const categories = category && category !== 'all' && CRAFT_CATALOG[category]
    ? [category]
    : Object.keys(CRAFT_CATALOG);

  const results = [];
  for (const cat of categories) {
    for (const item of CRAFT_CATALOG[cat]) {
      if (subjectType === 'product' && cat === 'makeup') continue;
      if (subjectType === 'product' && cat === 'poses' && !(item.categories || []).includes('product')) continue;

      const haystack = [
        item.id,
        item.name,
        ...(item.categories || []),
        item.bodyMechanics || '',
        item.jawAndGaze || '',
        item.handsAndProps || '',
        item.colorCharacter || '',
        item.opticalEffect || '',
        item.promptSnippet || ''
      ]
        .join(' ')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      let score = 0;
      if (!primary.length) {
        score = 1;
      } else {
        for (const tok of primary) {
          if (item.id.toLowerCase().includes(tok)) score += 6;
          else if (item.name.toLowerCase().includes(tok)) score += 4;
          else if (haystack.includes(tok)) score += 2;
        }
        for (const tok of expanded) {
          if (item.id.toLowerCase().includes(tok)) score += 2.5;
          else if (item.name.toLowerCase().includes(tok)) score += 1.5;
          else if (haystack.includes(tok)) score += 0.75;
        }
      }
      if (subjectType && (item.categories || []).includes(subjectType)) {
        score += 2;
      }
      if (score > 0) {
        results.push({ category: cat, score: Number(score.toFixed(2)), ...item });
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, Math.min(30, Number(limit) || 8)));
}

function listCraftCatalog({ category = 'all', subjectType = null } = {}) {
  const categories = category && category !== 'all' && CRAFT_CATALOG[category]
    ? [category]
    : Object.keys(CRAFT_CATALOG);
  const out = {};
  for (const cat of categories) {
    if (subjectType === 'product' && cat === 'makeup') continue;
    out[cat] = CRAFT_CATALOG[cat].filter((item) => {
      if (subjectType && cat !== 'cameras' && cat !== 'effects') {
        if ((item.categories || []).length && !item.categories.includes(subjectType)) {
          return subjectType === 'portrait' ? true : false;
        }
      }
      return true;
    });
  }
  return out;
}

function readResearchCache(cachePath) {
  try {
    if (!cachePath || !fs.existsSync(cachePath)) return {};
    return JSON.parse(fs.readFileSync(cachePath, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeResearchCache(cachePath, cacheObj) {
  if (!cachePath) return;
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const entries = Object.entries(cacheObj).slice(-60);
    const trimmed = Object.fromEntries(entries);
    const tmp = `${cachePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, cachePath);
  } catch {}
}

async function fetchJsonWithTimeout(url, fetchImpl, timeoutMs = 4500) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'ai-photo-studio-mcp/4.0 (photography research tool)'
      },
      ...(controller ? { signal: controller.signal } : {})
    });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildSearchTopicQuery(query, category = 'all') {
  const suffixMap = {
    poses: 'portrait photography posing technique',
    cameras: 'camera sensor film stock photography',
    lenses: 'camera lens focal length photography',
    effects: 'optical lens filter cinematography effect',
    makeup: 'editorial photography makeup technique',
    lighting: 'studio portrait lighting setup',
    all: 'photography cinematography technique'
  };
  const base = String(query || '').trim();
  const suffix = suffixMap[category] || suffixMap.all;
  return base.length > 40 ? base : `${base} ${suffix}`.trim();
}

async function queryPublicWebKnowledge(query, category = 'all', { fetchImpl = globalThis.fetch, timeoutMs = 4500 } = {}) {
  if (typeof fetchImpl !== 'function' || !String(query || '').trim()) {
    return { sources: [], errors: ['fetch-unavailable'] };
  }

  const qualified = buildSearchTopicQuery(query, category);
  const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(qualified)}&srlimit=4&format=json&utf8=1`;
  const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(qualified)}&format=json&no_html=1&skip_disambig=1`;

  const [wikiData, ddgData] = await Promise.all([
    fetchJsonWithTimeout(wikiUrl, fetchImpl, timeoutMs),
    fetchJsonWithTimeout(ddgUrl, fetchImpl, timeoutMs)
  ]);

  const sources = [];
  if (ddgData && (ddgData.AbstractText || ddgData.Heading)) {
    const summary = stripHtmlTags(ddgData.AbstractText);
    if (summary) {
      sources.push({
        provider: 'duckduckgo',
        title: ddgData.Heading || query,
        summary,
        url: ddgData.AbstractURL || null
      });
    }
    if (Array.isArray(ddgData.RelatedTopics)) {
      for (const topic of ddgData.RelatedTopics.slice(0, 3)) {
        if (topic && topic.Text) {
          sources.push({
            provider: 'duckduckgo-topic',
            title: stripHtmlTags(topic.Text).split(' - ')[0] || query,
            summary: stripHtmlTags(topic.Text),
            url: topic.FirstURL || null
          });
        }
      }
    }
  }

  const wikiHits = wikiData?.query?.search;
  if (Array.isArray(wikiHits)) {
    for (const hit of wikiHits.slice(0, 4)) {
      const snippet = stripHtmlTags(hit.snippet);
      if (!snippet) continue;
      sources.push({
        provider: 'wikipedia',
        title: hit.title,
        summary: snippet,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(hit.title || '').replace(/\s+/g, '_'))}`
      });
    }
  }

  return { sources, errors: [] };
}

async function researchPhotographyTechniques({
  query,
  category = 'all',
  subjectType = null,
  liveWeb = true,
  limit = 6,
  studioHome = null,
  fetchImpl = globalThis.fetch,
  timeoutMs = 4500
} = {}) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    throw new Error('Provide a non-empty photography research query.');
  }

  const cacheKey = `${category}::${subjectType || 'any'}::${cleanQuery.toLowerCase()}`;
  const cachePath = studioHome ? path.join(studioHome, 'research-cache.json') : null;
  const cache = readResearchCache(cachePath);
  const existing = cache[cacheKey];

  const curatedMatches = searchCraftCatalog(cleanQuery, { category, subjectType, limit });

  if (!liveWeb) {
    return {
      query: cleanQuery,
      category,
      source: 'curated-offline',
      cached: false,
      curatedMatches,
      webReferences: [],
      promptSnippets: curatedMatches.map((m) => m.promptSnippet).filter(Boolean)
    };
  }

  if (existing && (Date.now() - Number(existing.cachedAt || 0)) < CACHE_TTL_MS) {
    return {
      query: cleanQuery,
      category,
      source: 'curated+web-cache',
      cached: true,
      curatedMatches,
      webReferences: existing.webReferences || [],
      promptSnippets: curatedMatches.map((m) => m.promptSnippet).filter(Boolean)
    };
  }

  const web = await queryPublicWebKnowledge(cleanQuery, category, { fetchImpl, timeoutMs });
  const webReferences = web.sources || [];

  if (cachePath && webReferences.length) {
    cache[cacheKey] = { cachedAt: Date.now(), webReferences };
    writeResearchCache(cachePath, cache);
  }

  return {
    query: cleanQuery,
    category,
    source: webReferences.length ? 'curated+live-web' : 'curated-fallback',
    cached: false,
    curatedMatches,
    webReferences,
    promptSnippets: curatedMatches.map((m) => m.promptSnippet).filter(Boolean)
  };
}

module.exports = {
  searchCraftCatalog,
  listCraftCatalog,
  queryPublicWebKnowledge,
  researchPhotographyTechniques
};

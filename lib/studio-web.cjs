'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const { STUDIO_CREW, STUDIO_PRESETS } = require('./crew.cjs');
const { detectAvailableExecutors, executeRenderWithProvider } = require('./executors.cjs');

const MAX_BODY_BYTES = 36 * 1024 * 1024;

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body exceeds limit (36 MB).'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw.trim() ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    req.on('error', reject);
  });
}

function decodeBase64DataUrl(raw) {
  const str = String(raw || '').trim();
  const match = str.match(/^data:[^;]+;base64,(.+)$/i);
  return Buffer.from(match ? match[1] : str, 'base64');
}

function renderStudioHtml() {
  const presetOptions = Object.values(STUDIO_PRESETS)
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AI Photo Studio v2 — Multi-Agent Autonomous & Directed Workbench</title>
<style>
  :root {
    --bg: #090b10; --panel: #111622; --panel-2: #182032; --border: #253047;
    --text: #edf1f7; --muted: #93a0b8; --accent: #f59e0b; --ok: #10b981; --warn: #ef4444; --info: #38bdf8;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--text); }
  header { padding: 14px 22px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #0d111b; gap: 12px; flex-wrap: wrap; }
  header h1 { margin: 0; font-size: 16px; letter-spacing: 0.4px; display: flex; align-items: center; gap: 8px; }
  header span { color: var(--muted); font-size: 12px; }
  .layout { display: grid; grid-template-columns: 335px 1fr; min-height: calc(100vh - 55px); }
  @media (max-width: 920px) { .layout { grid-template-columns: 1fr; } }
  aside { border-right: 1px solid var(--border); padding: 16px; background: var(--panel); display: flex; flex-direction: column; gap: 14px; }
  main { padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
  .card h2, .card h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--muted); }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  input, select, textarea { width: 100%; background: var(--panel-2); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-size: 13px; margin-bottom: 10px; }
  input[type="checkbox"] { width: auto; margin: 0; }
  button { background: var(--accent); color: #111; border: none; border-radius: 6px; padding: 8px 12px; font-weight: 600; font-size: 12px; cursor: pointer; }
  button.secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--border); }
  button.ok { background: var(--ok); color: #051b14; }
  button.warn { background: var(--warn); color: #fff; }
  button.active-tab { background: var(--accent); color: #111; border-color: var(--accent); }
  .mode-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
  .checks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; font-size: 12px; color: var(--text); }
  .checks label { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--text); cursor: pointer; }
  .job-item { padding: 10px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; cursor: pointer; background: var(--panel-2); }
  .job-item.active { border-color: var(--accent); }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 11px; background: #262e42; color: var(--text); }
  .badge.auto { background: rgba(56,189,248,0.18); color: var(--info); }
  .badge.directed { background: rgba(245,158,11,0.18); color: var(--accent); }
  .badge.pass { background: rgba(16,185,129,0.2); color: var(--ok); }
  .badge.revise { background: rgba(239,68,68,0.2); color: var(--warn); }
  .compare-wrap { position: relative; width: 100%; max-width: 720px; max-height: 75vh; aspect-ratio: 4 / 5; background: #07090d; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
  .compare-wrap img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .compare-after { clip-path: inset(0 0 0 50%); }
  .slider-row { max-width: 720px; display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; }
  .prop-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .prop-card { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px; cursor: pointer; }
  .prop-card.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .crew-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
  .crew-card { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
  .crew-card.done { border-left: 3px solid var(--ok); }
  .board-item { padding: 8px 10px; border-left: 2px solid var(--info); background: var(--panel-2); border-radius: 0 6px 6px 0; margin-bottom: 6px; font-size: 12px; }
  pre { white-space: pre-wrap; word-break: break-word; background: #0a0c11; padding: 10px; border-radius: 6px; border: 1px solid var(--border); font-size: 12px; margin: 6px 0; max-height: 220px; overflow-y: auto; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .delta-box { border: 1px solid var(--accent); background: rgba(245,158,11,0.08); border-radius: 8px; padding: 10px; margin-bottom: 10px; }
  .qa-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
</style>
</head>
<body>
<header>
  <h1>AI PHOTO STUDIO <span class="badge">v2.0 · 8-Agent Autonomous &amp; Directed Studio</span></h1>
  <span id="healthText">Local Studio Ready</span>
</header>
<div class="layout">
  <aside>
    <div class="card">
      <h3>New Photo Shoot</h3>
      <div class="mode-tabs">
        <button id="tabAuto" type="button" class="active-tab">Autonomous</button>
        <button id="tabDirected" type="button" class="secondary">Directed Orders</button>
      </div>
      <label>Source Photo (Anchor)</label>
      <input id="photoInput" type="file" accept="image/png,image/jpeg,image/webp" />
      <label>Subject Hint</label>
      <select id="subjectSelect">
        <option value="auto">Auto-Detect (Triage)</option>
        <option value="portrait">Solo Portrait</option>
        <option value="couple">Couple / Duo</option>
        <option value="product">Commercial Product</option>
        <option value="executive">Executive / LinkedIn</option>
        <option value="night">Cinema Night</option>
        <option value="outdoor">Daylight Lifestyle</option>
      </select>
      <div id="directedFields" style="display:none;">
        <label>Intervention Scope</label>
        <select id="scopeSelect">
          <option value="">Auto-detect from orders</option>
          <option value="subtle-retouch">Subtle Retouch (Preserve pose/outfit/scene)</option>
          <option value="targeted-edit">Targeted Edit (Specific zone only)</option>
          <option value="full-editorial">Full Editorial Reimagining</option>
        </select>
        <label>Production Preset</label>
        <select id="presetSelect"><option value="">Auto from brief</option>${presetOptions}</select>
        <label>Exact Art Direction / Orders</label>
        <textarea id="briefInput" rows="3" placeholder="e.g. Keep my pose and outfit, improve lighting to warm Rembrandt 85mm f/1.4..."></textarea>
        <div class="checks">
          <label><input id="lockPose" type="checkbox" /> Keep Pose</label>
          <label><input id="lockWardrobe" type="checkbox" /> Keep Outfit</label>
          <label><input id="lockBg" type="checkbox" /> Keep Background</label>
          <label><input id="lockFraming" type="checkbox" /> Keep Framing</label>
        </div>
      </div>
      <button id="createBtn" type="button" style="width:100%;">Launch 8-Agent Crew</button>
    </div>
    <div class="card" style="flex:1; overflow-y:auto;">
      <h3>Studio Jobs</h3>
      <div id="jobsList">No jobs yet. Drop a photo or send one from Codex/Gemini/Claude.</div>
    </div>
  </aside>
  <main id="mainStage">
    <div class="card">
      <h2>Welcome to AI Photo Studio v2.0</h2>
      <p style="color:var(--muted);font-size:13px;">Drop a photo in <strong>Autonomous</strong> mode to let the 8-specialist crew triage the image and generate 3 curated directions automatically, or switch to <strong>Directed Orders</strong> to enforce exact art direction, intervention scope, and preservation locks.</p>
    </div>
  </main>
</div>
<script>
const state = { jobs: [], crew: [], executors: [], activeId: null, slider: 50, intakeMode: 'autonomous', promptTab: 'codex', compareBefore: 'anchor', compareAfterIdx: -1 };

async function api(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setIntakeMode(mode) {
  state.intakeMode = mode;
  document.getElementById('directedFields').style.display = mode === 'directed' ? 'block' : 'none';
  document.getElementById('tabAuto').className = mode === 'autonomous' ? 'active-tab' : 'secondary';
  document.getElementById('tabDirected').className = mode === 'directed' ? 'active-tab' : 'secondary';
}
document.getElementById('tabAuto').addEventListener('click', () => setIntakeMode('autonomous'));
document.getElementById('tabDirected').addEventListener('click', () => setIntakeMode('directed'));

async function refresh() {
  const [crewData, jobsData] = await Promise.all([api('/api/crew'), api('/api/jobs')]);
  state.crew = crewData.crew || [];
  state.executors = crewData.executors || [];
  state.jobs = jobsData.jobs || [];
  if (!state.activeId && state.jobs.length) state.activeId = state.jobs[0].id;
  const activeExecs = state.executors.filter((e) => e.available).map((e) => e.id).join(', ');
  document.getElementById('healthText').textContent = 'Executors: ' + (activeExecs || 'subscription-manual');
  renderSidebar();
  renderMain();
}

function renderSidebar() {
  const el = document.getElementById('jobsList');
  if (!state.jobs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:12px;">No jobs yet.</div>'; return; }
  el.innerHTML = state.jobs.map((j) => {
    const modeCls = j.mode === 'autonomous' ? 'auto' : 'directed';
    const statusCls = j.status === 'approved' ? 'pass' : j.status === 'revision-requested' ? 'revise' : '';
    return '<div class="job-item ' + (j.id === state.activeId ? 'active' : '') + '" data-id="' + esc(j.id) + '">' +
      '<div style="font-size:13px;font-weight:600;">' + esc(j.sourceImage?.fileName || j.id) + '</div>' +
      '<div class="row" style="margin-top:5px;">' +
        '<span class="badge ' + modeCls + '">' + esc((j.mode || 'directed').toUpperCase()) + '</span>' +
        '<span class="badge">' + esc(j.interventionScope || j.preset) + '</span>' +
        '<span class="badge ' + statusCls + '">' + esc(j.status) + '</span>' +
      '</div></div>';
  }).join('');
  el.querySelectorAll('.job-item').forEach((n) => n.addEventListener('click', () => {
    state.activeId = n.dataset.id;
    state.compareBefore = 'anchor';
    state.compareAfterIdx = -1;
    renderSidebar();
    renderMain();
  }));
}

function renderMain() {
  const main = document.getElementById('mainStage');
  const job = state.jobs.find((j) => j.id === state.activeId);
  if (!job) return;

  const anchorUrl = '/api/jobs/' + encodeURIComponent(job.id) + '/assets/' + encodeURIComponent(job.sourceImage.assetName);
  const renders = job.renders || [];
  const afterIdx = state.compareAfterIdx >= 0 && state.compareAfterIdx < renders.length ? state.compareAfterIdx : renders.length - 1;
  const latestRender = afterIdx >= 0 ? renders[afterIdx] : null;
  const afterUrl = latestRender ? ('/api/jobs/' + encodeURIComponent(job.id) + '/assets/' + encodeURIComponent(latestRender.assetName)) : '';

  let beforeUrl = anchorUrl;
  let beforeLabel = 'Anchor';
  if (state.compareBefore !== 'anchor') {
    const bRender = renders.find((r) => String(r.version) === String(state.compareBefore));
    if (bRender) {
      beforeUrl = '/api/jobs/' + encodeURIComponent(job.id) + '/assets/' + encodeURIComponent(bRender.assetName);
      beforeLabel = 'v' + bRender.version;
    }
  }

  const proposalsHtml = (job.proposals && job.proposals.length)
    ? '<div class="card"><h2>Autonomous Crew Proposals (Click to Switch Direction)</h2><div class="prop-grid">' +
      job.proposals.map((p) => {
        const sel = p.id === job.selectedProposalId ? 'selected' : '';
        return '<div class="prop-card ' + sel + '" data-prop="' + esc(p.id) + '">' +
          '<div class="row" style="justify-content:space-between;"><strong>' + esc(p.label) + '</strong><span class="badge">' + Math.round((p.confidence || 0.9) * 100) + '%</span></div>' +
          '<div style="font-size:11px;color:var(--info);margin:4px 0;">' + esc(p.preset) + ' · ' + esc(p.interventionScope) + '</div>' +
          '<div style="font-size:12px;color:var(--muted);">' + esc(p.rationale || p.concept) + '</div>' +
        '</div>';
      }).join('') + '</div></div>'
    : '';

  const boardHtml = (job.agentBoard && job.agentBoard.length)
    ? '<div class="card"><h2>Studio Channel Handoff Log</h2>' +
      job.agentBoard.map((m) =>
        '<div class="board-item"><strong>' + m.step + '. ' + esc(m.agentHandle) + ':</strong> ' + esc(m.summary) + '</div>'
      ).join('') + '</div>'
    : '';

  const packs = job.promptPacks || {};
  const activePromptText = state.promptTab === 'gemini'
    ? (packs.geminiPrompt || '')
    : state.promptTab === 'claude'
      ? (packs.claudeComfyPrompt || '')
      : state.promptTab === 'json'
        ? JSON.stringify(packs.universalJsonSpec || {}, null, 2)
        : (packs.codexPrompt || '');

  const deltaHtml = packs.revisionDeltaPrompt
    ? '<div class="delta-box"><strong>Targeted Revision Delta (Cycle ' + (job.revisionCycle || 1) + ')</strong><pre id="deltaPre">' + esc(packs.revisionDeltaPrompt) + '</pre><button type="button" data-copy="deltaPre">Copy Delta Patch</button></div>'
    : '';

  const aspectStyle = (job.sourceImage && job.sourceImage.width && job.sourceImage.height)
    ? ' style="aspect-ratio:' + job.sourceImage.width + ' / ' + job.sourceImage.height + ';"'
    : '';

  const lineageOptions = renders.map((r) => '<option value="' + r.version + '">v' + r.version + ' (' + esc(r.engine) + ')</option>').join('');
  const liveExecutors = state.executors.filter((e) => e.available && e.id !== 'subscription-manual' && e.id !== 'comfyui');
  const execBtns = liveExecutors.map((e) =>
    '<button type="button" class="secondary" data-exec="' + esc(e.id) + '">Run Live (' + esc(e.id) + ')</button>'
  ).join('');

  const crewCards = state.crew.map((m) => {
    const pass = job.crewPasses && job.crewPasses[m.id];
    const body = pass ? '<pre>' + esc(JSON.stringify(pass, null, 2)) + '</pre>' : '<div style="color:var(--muted);font-size:12px;">Pending specialist pass</div>';
    return '<div class="crew-card ' + (pass ? 'done' : '') + '"><strong>' + m.order + '. ' + esc(m.agentHandle || m.title) + '</strong><div style="color:var(--muted);font-size:11px;margin:4px 0;">' + esc(m.mission) + '</div>' + body + '</div>';
  }).join('');

  main.innerHTML =
    proposalsHtml +
    '<div class="grid-2">' +
      '<div class="card"><h2>Before / After &amp; Asset Lineage</h2>' +
        (renders.length ? '<div class="row" style="margin-bottom:8px;"><label style="margin:0;">Before:</label><select id="beforeSel" style="width:auto;margin:0;"><option value="anchor">Anchor</option>' + lineageOptions + '</select><label style="margin:0;">After:</label><select id="afterSel" style="width:auto;margin:0;">' + renders.map((r, idx) => '<option value="' + idx + '" ' + (idx === afterIdx ? 'selected' : '') + '>v' + r.version + ' (' + esc(r.qaVerdict || 'pending') + ')</option>').join('') + '</select></div>' : '') +
        '<div class="compare-wrap"' + aspectStyle + '>' +
          '<img src="' + beforeUrl + '" alt="Before" />' +
          (afterUrl ? '<img id="afterImg" class="compare-after" src="' + afterUrl + '" alt="After" style="clip-path:inset(0 0 0 ' + (100 - state.slider) + '%);" />' : '') +
        '</div>' +
        (afterUrl ? '<div class="slider-row"><span style="font-size:11px;">' + esc(beforeLabel) + '</span><input id="cmpSlider" type="range" min="0" max="100" value="' + state.slider + '" style="margin:0;" /><span style="font-size:11px;">v' + latestRender.version + '</span></div>' : '<p style="color:var(--muted);font-size:12px;">No render attached yet. Copy a prompt pack and execute in Codex/Gemini/Claude, or attach below.</p>') +
        '<div class="row" style="margin-top:10px;"><input id="renderInput" type="file" accept="image/png,image/jpeg,image/webp" style="margin:0;flex:1;" /><button id="uploadRenderBtn" type="button">Attach Render</button>' + execBtns + '</div>' +
      '</div>' +
      '<div class="card"><h2>Compiled Prompt Packs</h2>' +
        deltaHtml +
        '<div class="row" style="margin-bottom:8px;">' +
          '<button type="button" class="' + (state.promptTab === 'codex' ? 'active-tab' : 'secondary') + '" data-ptab="codex">Codex / GPT Image</button>' +
          '<button type="button" class="' + (state.promptTab === 'gemini' ? 'active-tab' : 'secondary') + '" data-ptab="gemini">Gemini / Imagen</button>' +
          '<button type="button" class="' + (state.promptTab === 'claude' ? 'active-tab' : 'secondary') + '" data-ptab="claude">Claude / ComfyUI</button>' +
          '<button type="button" class="' + (state.promptTab === 'json' ? 'active-tab' : 'secondary') + '" data-ptab="json">Universal JSON</button>' +
        '</div>' +
        '<pre id="activePromptPre">' + esc(activePromptText) + '</pre>' +
        '<div class="row"><button class="secondary" data-copy="activePromptPre" type="button">Copy Prompt</button></div>' +
        '<hr style="border:0;border-top:1px solid var(--border);margin:14px 0;" />' +
        '<h3>6-Point Anti-AI Realism QA Gate</h3>' +
        '<div class="qa-grid">' +
          '<div><label>Identity (0-10)</label><input id="qaId" type="number" min="0" max="10" step="0.5" value="9" /></div>' +
          '<div><label>Anti-Slop (0-10)</label><input id="qaSlop" type="number" min="0" max="10" step="0.5" value="9" /></div>' +
          '<div><label>Garment/Logo</label><input id="qaGarment" type="number" min="0" max="10" step="0.5" value="9" /></div>' +
          '<div><label>Realism/Grain</label><input id="qaReal" type="number" min="0" max="10" step="0.5" value="9" /></div>' +
          '<div><label>Lighting</label><input id="qaLight" type="number" min="0" max="10" step="0.5" value="9" /></div>' +
          '<div><label>Anatomy/Shape</label><input id="qaAnat" type="number" min="0" max="10" step="0.5" value="9" /></div>' +
        '</div>' +
        '<label><input id="qaCatch" type="checkbox" checked /> Iris catchlights &amp; organic surface micro-texture OK</label>' +
        '<textarea id="qaNotes" rows="2" placeholder="QA review notes or specific fixes for next iteration..."></textarea>' +
        '<div class="row">' +
          '<button id="qaPassBtn" type="button" class="ok">Approve (Pass)</button>' +
          '<button id="qaReviseBtn" type="button" class="warn">Request Revision (Loop v+1)</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    boardHtml +
    '<div class="card"><h2>8-Specialist Studio Crew</h2><div class="crew-grid">' + crewCards + '</div></div>';

  main.querySelectorAll('[data-prop]').forEach((el) => el.addEventListener('click', async () => {
    await api('/api/jobs/' + encodeURIComponent(job.id) + '/proposal', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proposalId: el.dataset.prop })
    });
    await refresh();
  }));
  main.querySelectorAll('[data-ptab]').forEach((btn) => btn.addEventListener('click', () => {
    state.promptTab = btn.dataset.ptab;
    renderMain();
  }));
  main.querySelectorAll('[data-exec]').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Running...';
    try {
      await api('/api/jobs/' + encodeURIComponent(job.id) + '/execute', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: btn.dataset.exec })
      });
      await refresh();
    } catch (err) {
      alert(err.message);
      renderMain();
    }
  }));

  const beforeSel = document.getElementById('beforeSel');
  if (beforeSel) {
    beforeSel.value = state.compareBefore;
    beforeSel.addEventListener('change', (e) => { state.compareBefore = e.target.value; renderMain(); });
  }
  const afterSel = document.getElementById('afterSel');
  if (afterSel) {
    afterSel.addEventListener('change', (e) => { state.compareAfterIdx = Number(e.target.value); renderMain(); });
  }
  const slider = document.getElementById('cmpSlider');
  if (slider) slider.addEventListener('input', (e) => {
    state.slider = Number(e.target.value);
    const img = document.getElementById('afterImg');
    if (img) img.style.clipPath = 'inset(0 0 0 ' + (100 - state.slider) + '%)';
  });
  main.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', () => {
    const txt = document.getElementById(btn.dataset.copy).textContent;
    const prev = btn.textContent;
    navigator.clipboard?.writeText(txt);
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = prev; }, 1200);
  }));
  document.getElementById('uploadRenderBtn').addEventListener('click', async () => {
    const f = document.getElementById('renderInput').files[0];
    if (!f) return alert('Select a rendered image first.');
    const dataUrl = await fileToDataUrl(f);
    await api('/api/jobs/' + encodeURIComponent(job.id) + '/renders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: f.name, base64: dataUrl, engine: 'studio-web' })
    });
    state.compareAfterIdx = -1;
    await refresh();
  });
  async function submitQa(verdict) {
    await api('/api/jobs/' + encodeURIComponent(job.id) + '/qa', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        verdict,
        identityFidelityScore: Number(document.getElementById('qaId').value),
        antiSlopScore: Number(document.getElementById('qaSlop').value),
        garmentFidelityScore: Number(document.getElementById('qaGarment').value),
        realismScore: Number(document.getElementById('qaReal').value),
        lightingCoherenceScore: Number(document.getElementById('qaLight').value),
        anatomyScore: Number(document.getElementById('qaAnat').value),
        textureAndCatchlightsOk: document.getElementById('qaCatch').checked,
        revisionNotes: document.getElementById('qaNotes').value
      })
    });
    await refresh();
  }
  document.getElementById('qaPassBtn').addEventListener('click', () => submitQa('pass'));
  document.getElementById('qaReviseBtn').addEventListener('click', () => submitQa('revise'));
}

document.getElementById('createBtn').addEventListener('click', async () => {
  const f = document.getElementById('photoInput').files[0];
  if (!f) return alert('Choose an anchor photo first.');
  const base64 = await fileToDataUrl(f);
  const payload = {
    fileName: f.name,
    base64,
    mode: state.intakeMode,
    subjectHint: document.getElementById('subjectSelect').value,
    autoRun: true
  };
  if (state.intakeMode === 'directed') {
    payload.scope = document.getElementById('scopeSelect').value || undefined;
    payload.preset = document.getElementById('presetSelect').value || undefined;
    payload.brief = document.getElementById('briefInput').value;
    payload.locks = {
      keepPose: document.getElementById('lockPose').checked,
      keepWardrobe: document.getElementById('lockWardrobe').checked,
      keepBackground: document.getElementById('lockBg').checked,
      keepFraming: document.getElementById('lockFraming').checked
    };
  }
  const created = await api('/api/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  state.activeId = created.job.id;
  state.compareBefore = 'anchor';
  state.compareAfterIdx = -1;
  await refresh();
});
refresh().catch((e) => { document.getElementById('healthText').textContent = e.message; });
</script>
</body>
</html>`;
}

function createStudioWebServer({ store, port = 4321 } = {}) {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;

    try {
      if (req.method === 'GET' && pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(renderStudioHtml());
        return;
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        sendJson(res, 200, {
          ok: true,
          studioHome: store.studioHome,
          jobCount: store.listJobs().length,
          executors: detectAvailableExecutors()
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/crew') {
        sendJson(res, 200, {
          crew: STUDIO_CREW,
          presets: Object.values(STUDIO_PRESETS),
          modes: ['autonomous', 'directed'],
          executors: detectAvailableExecutors()
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/executors') {
        sendJson(res, 200, { executors: detectAvailableExecutors() });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/jobs') {
        sendJson(res, 200, { jobs: store.listJobs() });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/jobs') {
        const body = await readJsonBody(req);
        const buffer = decodeBase64DataUrl(body.base64);
        const job = store.createJobFromBuffer({
          fileName: body.fileName || 'photo.png',
          buffer,
          preset: body.preset,
          brief: body.brief,
          mode: body.mode,
          scope: body.scope,
          locks: body.locks,
          subjectHint: body.subjectHint || 'auto',
          autoRun: body.autoRun !== undefined ? Boolean(body.autoRun) : true
        });
        sendJson(res, 201, { job });
        return;
      }

      const jobMatch = pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]{4,64})(?:\/(.*))?$/);
      if (jobMatch) {
        const jobId = jobMatch[1];
        const sub = jobMatch[2] || '';

        if (req.method === 'GET' && !sub) {
          sendJson(res, 200, { job: store.readJob(jobId) });
          return;
        }

        if (req.method === 'POST' && sub === 'autonomous') {
          const body = await readJsonBody(req);
          const job = store.runAutonomous(jobId, body);
          sendJson(res, 200, { job });
          return;
        }

        if (req.method === 'POST' && sub === 'directed') {
          const body = await readJsonBody(req);
          const job = store.runDirected(jobId, body);
          sendJson(res, 200, { job });
          return;
        }

        if (req.method === 'POST' && sub === 'proposal') {
          const body = await readJsonBody(req);
          const job = store.selectProposal(jobId, body.proposalId);
          sendJson(res, 200, { job });
          return;
        }

        if (req.method === 'POST' && sub === 'passes') {
          const body = await readJsonBody(req);
          const job = store.saveCrewPass(jobId, body.role, body.payload || {});
          sendJson(res, 200, { job });
          return;
        }

        if (req.method === 'POST' && sub === 'renders') {
          const body = await readJsonBody(req);
          const buffer = decodeBase64DataUrl(body.base64);
          const job = store.registerRenderFromBuffer(jobId, {
            fileName: body.fileName || 'render.png',
            buffer,
            engine: body.engine || 'studio-web',
            notes: body.notes || '',
            parentVersion: body.parentVersion
          });
          sendJson(res, 201, { job });
          return;
        }

        if (req.method === 'POST' && sub === 'execute') {
          const body = await readJsonBody(req);
          const current = store.readJob(jobId);
          const rendered = await executeRenderWithProvider({
            store,
            job: current,
            provider: body.provider || 'gemini',
            model: body.model || ''
          });
          const job = store.registerRenderFromBuffer(jobId, rendered);
          sendJson(res, 201, { job, engine: rendered.engine });
          return;
        }

        if (req.method === 'POST' && sub === 'qa') {
          const body = await readJsonBody(req);
          const job = store.submitQa(jobId, body);
          sendJson(res, 200, { job });
          return;
        }

        if (req.method === 'POST' && sub === 'rollback') {
          const body = await readJsonBody(req);
          const job = store.rollbackToRender(jobId, body.version);
          sendJson(res, 200, { job });
          return;
        }

        const assetMatch = sub.match(/^assets\/([A-Za-z0-9._-]+)$/);
        if (req.method === 'GET' && assetMatch) {
          const assetPath = store.resolveAssetPath(jobId, assetMatch[1]);
          const ext = path.extname(assetPath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
          fs.createReadStream(assetPath).pipe(res);
          return;
        }
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      const status = /not found/i.test(err.message) ? 404 : /invalid|exceeds|unsupported|requires/i.test(err.message) ? 400 : 500;
      sendJson(res, status, { error: err.message });
    }
  });

  return {
    server,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          const addr = server.address();
          resolve({ port: addr.port, url: `http://127.0.0.1:${addr.port}` });
        });
      }),
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

module.exports = {
  createStudioWebServer
};

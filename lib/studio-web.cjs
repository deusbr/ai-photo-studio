'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const { STUDIO_CREW, STUDIO_PRESETS } = require('./crew.cjs');

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
<title>AI Photo Studio — Full-Crew Creative Direction</title>
<style>
  :root {
    --bg: #0b0d12; --panel: #131722; --panel-2: #1a2030; --border: #262e42;
    --text: #edf1f7; --muted: #93a0b8; --accent: #f59e0b; --ok: #10b981; --warn: #ef4444;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--bg); color: var(--text); }
  header { padding: 14px 22px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: #0f131c; }
  header h1 { margin: 0; font-size: 16px; letter-spacing: 0.4px; }
  header span { color: var(--muted); font-size: 12px; }
  .layout { display: grid; grid-template-columns: 310px 1fr; min-height: calc(100vh - 53px); }
  aside { border-right: 1px solid var(--border); padding: 16px; background: var(--panel); display: flex; flex-direction: column; gap: 16px; }
  main { padding: 20px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
  .card h2, .card h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted); }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  input, select, textarea { width: 100%; background: var(--panel-2); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 8px; font-size: 13px; margin-bottom: 10px; }
  button { background: var(--accent); color: #111; border: none; border-radius: 6px; padding: 8px 12px; font-weight: 600; font-size: 12px; cursor: pointer; }
  button.secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--border); }
  .job-item { padding: 10px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; cursor: pointer; background: var(--panel-2); }
  .job-item.active { border-color: var(--accent); }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 11px; background: #262e42; color: var(--text); }
  .badge.pass { background: rgba(16,185,129,0.2); color: var(--ok); }
  .compare-wrap { position: relative; width: 100%; max-width: 720px; aspect-ratio: 4 / 5; background: #07090d; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
  .compare-wrap img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .compare-after { clip-path: inset(0 0 0 50%); }
  .slider-row { max-width: 720px; display: flex; align-items: center; gap: 10px; margin-top: 8px; }
  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
  .crew-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
  .crew-card { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
  .crew-card.done { border-left: 3px solid var(--ok); }
  pre { white-space: pre-wrap; word-break: break-word; background: #0a0c11; padding: 10px; border-radius: 6px; border: 1px solid var(--border); font-size: 12px; margin: 6px 0; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
</style>
</head>
<body>
<header>
  <h1>AI PHOTO STUDIO <span class="badge">Subscription-First · Codex · Gemini · Claude</span></h1>
  <span id="healthText">Local Studio Ready</span>
</header>
<div class="layout">
  <aside>
    <div class="card">
      <h3>New Photo Intake</h3>
      <label>Source Photo (Anchor)</label>
      <input id="photoInput" type="file" accept="image/png,image/jpeg,image/webp" />
      <label>Production Preset</label>
      <select id="presetSelect">${presetOptions}</select>
      <label>Creative Brief (Optional)</label>
      <textarea id="briefInput" rows="2" placeholder="e.g. Editorial portrait, warm evening mood..."></textarea>
      <button id="createBtn" type="button">Launch Studio Crew</button>
    </div>
    <div class="card" style="flex:1; overflow-y:auto;">
      <h3>Studio Jobs</h3>
      <div id="jobsList">No jobs yet. Drop a photo or send one from Codex/Gemini/Claude.</div>
    </div>
  </aside>
  <main id="mainStage">
    <div class="card">
      <h2>Welcome to AI Photo Studio</h2>
      <p style="color:var(--muted);font-size:13px;">Upload a photo on the left or run the <code>ai-photo-studio</code> skill/MCP from Codex, Gemini CLI, or Claude Code. The 7-member crew will appear here with Before/After comparison and engine-ready prompts.</p>
    </div>
  </main>
</div>
<script>
const state = { jobs: [], crew: [], activeId: null, slider: 50 };
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
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
async function refresh() {
  const [crewData, jobsData] = await Promise.all([api('/api/crew'), api('/api/jobs')]);
  state.crew = crewData.crew || [];
  state.jobs = jobsData.jobs || [];
  if (!state.activeId && state.jobs.length) state.activeId = state.jobs[0].id;
  renderSidebar();
  renderMain();
}
function renderSidebar() {
  const el = document.getElementById('jobsList');
  if (!state.jobs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:12px;">No jobs yet.</div>'; return; }
  el.innerHTML = state.jobs.map((j) =>
    '<div class="job-item ' + (j.id === state.activeId ? 'active' : '') + '" data-id="' + esc(j.id) + '">' +
    '<div style="font-size:13px;font-weight:600;">' + esc(j.sourceImage?.fileName || j.id) + '</div>' +
    '<div class="row" style="margin-top:4px;"><span class="badge">' + esc(j.preset) + '</span><span class="badge ' + (j.status === 'approved' ? 'pass' : '') + '">' + esc(j.status) + '</span></div>' +
    '</div>'
  ).join('');
  el.querySelectorAll('.job-item').forEach((n) => n.addEventListener('click', () => { state.activeId = n.dataset.id; renderSidebar(); renderMain(); }));
}
function renderMain() {
  const main = document.getElementById('mainStage');
  const job = state.jobs.find((j) => j.id === state.activeId);
  if (!job) return;
  const anchorUrl = '/api/jobs/' + encodeURIComponent(job.id) + '/assets/' + encodeURIComponent(job.sourceImage.assetName);
  const latestRender = job.renders && job.renders.length ? job.renders[job.renders.length - 1] : null;
  const afterUrl = latestRender ? ('/api/jobs/' + encodeURIComponent(job.id) + '/assets/' + encodeURIComponent(latestRender.assetName)) : '';
  const crewCards = state.crew.map((m) => {
    const pass = job.crewPasses && job.crewPasses[m.id];
    const body = pass ? '<pre>' + esc(JSON.stringify(pass, null, 2)) + '</pre>' : '<div style="color:var(--muted);font-size:12px;">Pending specialist pass</div>';
    return '<div class="crew-card ' + (pass ? 'done' : '') + '"><strong>' + m.order + '. ' + esc(m.title) + '</strong><div style="color:var(--muted);font-size:11px;margin:4px 0;">' + esc(m.mission) + '</div>' + body + '</div>';
  }).join('');
  const packs = job.promptPacks || {};
  main.innerHTML =
    '<div class="grid-2">' +
      '<div class="card"><h2>Before / After Monitor</h2>' +
        '<div class="compare-wrap">' +
          '<img src="' + anchorUrl + '" alt="Before" />' +
          (afterUrl ? '<img id="afterImg" class="compare-after" src="' + afterUrl + '" alt="After" style="clip-path:inset(0 0 0 ' + (100 - state.slider) + '%);" />' : '') +
        '</div>' +
        (afterUrl ? '<div class="slider-row"><span style="font-size:11px;">Before</span><input id="cmpSlider" type="range" min="0" max="100" value="' + state.slider + '" style="margin:0;" /><span style="font-size:11px;">After (v' + latestRender.version + ')</span></div>' : '<p style="color:var(--muted);font-size:12px;">No render attached yet. Generate in Codex/Gemini/Claude and upload below.</p>') +
        '<div class="row" style="margin-top:10px;"><input id="renderInput" type="file" accept="image/png,image/jpeg,image/webp" style="margin:0;flex:1;" /><button id="uploadRenderBtn" type="button">Attach Render</button></div>' +
      '</div>' +
      '<div class="card"><h2>Subscription Prompt Packs</h2>' +
        '<label>Codex / ChatGPT Image Prompt</label><pre id="codexPre">' + esc(packs.codexPrompt || '') + '</pre><button class="secondary" data-copy="codexPre" type="button">Copy Codex Prompt</button>' +
        '<label style="margin-top:10px;">Gemini / Imagen Prompt</label><pre id="geminiPre">' + esc(packs.geminiPrompt || '') + '</pre><button class="secondary" data-copy="geminiPre" type="button">Copy Gemini Prompt</button>' +
        '<label style="margin-top:10px;">Claude / Universal JSON Spec</label><pre id="jsonPre">' + esc(JSON.stringify(packs.universalJsonSpec || {}, null, 2)) + '</pre><button class="secondary" data-copy="jsonPre" type="button">Copy JSON Spec</button>' +
      '</div>' +
    '</div>' +
    '<div class="card"><h2>7-Member Professional Crew</h2><div class="crew-grid">' + crewCards + '</div></div>';

  const slider = document.getElementById('cmpSlider');
  if (slider) slider.addEventListener('input', (e) => {
    state.slider = Number(e.target.value);
    const img = document.getElementById('afterImg');
    if (img) img.style.clipPath = 'inset(0 0 0 ' + (100 - state.slider) + '%)';
  });
  main.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', () => {
    const txt = document.getElementById(btn.dataset.copy).textContent;
    navigator.clipboard?.writeText(txt);
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
  }));
  document.getElementById('uploadRenderBtn').addEventListener('click', async () => {
    const f = document.getElementById('renderInput').files[0];
    if (!f) return alert('Select a rendered image first.');
    const dataUrl = await fileToDataUrl(f);
    await api('/api/jobs/' + encodeURIComponent(job.id) + '/renders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: f.name, base64: dataUrl, engine: 'studio-web' })
    });
    await refresh();
  });
}
document.getElementById('createBtn').addEventListener('click', async () => {
  const f = document.getElementById('photoInput').files[0];
  if (!f) return alert('Choose an anchor photo first.');
  const base64 = await fileToDataUrl(f);
  const created = await api('/api/jobs', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName: f.name,
      base64,
      preset: document.getElementById('presetSelect').value,
      brief: document.getElementById('briefInput').value
    })
  });
  state.activeId = created.job.id;
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
        sendJson(res, 200, { ok: true, studioHome: store.studioHome, jobCount: store.listJobs().length });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/crew') {
        sendJson(res, 200, { crew: STUDIO_CREW, presets: Object.values(STUDIO_PRESETS) });
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
          brief: body.brief
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
            notes: body.notes || ''
          });
          sendJson(res, 201, { job });
          return;
        }

        if (req.method === 'POST' && sub === 'qa') {
          const body = await readJsonBody(req);
          const job = store.submitQa(jobId, body);
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
      const status = /not found/i.test(err.message) ? 404 : /invalid|exceeds|unsupported/i.test(err.message) ? 400 : 500;
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
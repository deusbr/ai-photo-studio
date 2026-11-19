'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const {
  inspectImageFile,
  getCrewList,
  StudioStore,
  createStudioWebServer,
  getClientTargets,
  installStudioClients,
  checkStudioStatus
} = require('../index.cjs');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-photo-studio-test-'));
}

function makeFakePng(width = 800, height = 1000) {
  const buf = Buffer.alloc(32, 0);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 4, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8;
  buf[25] = 6;
  return buf;
}

test('inspectImageFile extracts PNG dimensions, aspect ratio, and SHA-256 safely', () => {
  const dir = makeTempDir();
  try {
    const imgPath = path.join(dir, 'sample.png');
    fs.writeFileSync(imgPath, makeFakePng(800, 1000));

    const meta = inspectImageFile(imgPath);
    assert.equal(meta.format, 'png');
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 1000);
    assert.equal(meta.orientation, 'portrait');
    assert.equal(meta.aspectRatio, '4:5');
    assert.equal(meta.sha256.length, 64);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('StudioStore orchestrates full 7-role crew lifecycle and compiles engine prompts', () => {
  const dir = makeTempDir();
  try {
    const imgPath = path.join(dir, 'anchor.png');
    const renderPath = path.join(dir, 'render.png');
    fs.writeFileSync(imgPath, makeFakePng(1080, 1350));
    fs.writeFileSync(renderPath, makeFakePng(1080, 1350));

    const store = new StudioStore(path.join(dir, 'studio-home'));
    assert.equal(getCrewList().length, 7);

    const job = store.createJobFromFile({ imagePath: imgPath, preset: 'editorial-portrait', brief: 'Clean magazine portrait' });
    assert.equal(job.status, 'intake');
    assert.ok(job.promptPacks.codexPrompt.includes('anchor.png'));
    assert.ok(job.promptPacks.geminiPrompt.includes('Editorial Magazine Portrait'));

    store.saveCrewPass(job.id, 'forensic-analyst', {
      correctionsSummary: 'Fix wide-angle nose distortion and flat overhead lighting'
    });
    store.saveCrewPass(job.id, 'creative-director', {
      concept: 'Architectural dusk portrait',
      wardrobeOrProps: 'Unstructured charcoal linen blazer'
    });
    const compiled = store.compilePrompts(job.id);
    assert.equal(compiled.status, 'ready-to-render');
    assert.ok(compiled.promptPacks.codexPrompt.includes('Architectural dusk portrait'));

    const withRender = store.registerRenderFromFile(job.id, renderPath, { engine: 'codex', notes: 'Pass 1' });
    assert.equal(withRender.renders.length, 1);
    assert.equal(withRender.status, 'awaiting-qa');

    const approved = store.submitQa(job.id, {
      verdict: 'pass',
      identityFidelityScore: 9.5,
      textureAndCatchlightsOk: true,
      revisionNotes: 'Approved for release'
    });
    assert.equal(approved.status, 'approved');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Local Studio Web Server creates jobs via upload, attaches renders, and serves Before/After assets', async () => {
  const dir = makeTempDir();
  const store = new StudioStore(path.join(dir, 'studio-home'));
  const web = createStudioWebServer({ store, port: 0 });
  const info = await web.listen();

  try {
    const htmlRes = await fetch(info.url);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /AI PHOTO STUDIO/);

    const pngB64 = makeFakePng(600, 600).toString('base64');
    const createRes = await fetch(`${info.url}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'input.png', base64: `data:image/png;base64,${pngB64}`, preset: 'executive-linkedin' })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.job.sourceImage.width, 600);

    const renderRes = await fetch(`${info.url}/api/jobs/${created.job.id}/renders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'out.png', base64: pngB64, engine: 'gemini' })
    });
    assert.equal(renderRes.status, 201);
    const rendered = await renderRes.json();
    assert.equal(rendered.job.renders.length, 1);

    const assetRes = await fetch(`${info.url}/api/jobs/${created.job.id}/assets/${rendered.job.renders[0].assetName}`);
    assert.equal(assetRes.status, 200);
    assert.equal(assetRes.headers.get('content-type'), 'image/png');
  } finally {
    await web.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('installStudioClients writes Codex TOML, Gemini JSON, Claude JSON, and portable SKILL.md safely', () => {
  const dir = makeTempDir();
  try {
    const home = path.join(dir, 'home');
    const appdata = path.join(dir, 'appdata');
    fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(home, '.codex', 'config.toml'), 'model = "gpt-5"\n');

    const targets = getClientTargets({ home, appdata, platform: 'win32' });
    const installed = installStudioClients({ targets });
    assert.equal(installed.length, 4);
    assert.ok(installed.every((r) => r.mcpInstalled));

    const status = checkStudioStatus(targets);
    assert.ok(status.every((s) => s.mcpConfigured));
    assert.equal(status.find((s) => s.id === 'codex').skillInstalled, true);
    assert.equal(status.find((s) => s.id === 'gemini').skillInstalled, true);
    assert.equal(status.find((s) => s.id === 'claude-code').skillInstalled, true);

    const codexToml = fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8');
    assert.match(codexToml, /model = "gpt-5"/);
    assert.match(codexToml, /\[mcp_servers\.ai-photo-studio\]/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stdio MCP server serves initialize, tools/list, and full studio job workflow', async () => {
  const dir = makeTempDir();
  try {
    const imgPath = path.join(dir, 'portrait.png');
    fs.writeFileSync(imgPath, makeFakePng(900, 1200));

    const child = spawn(process.execPath, [path.resolve(__dirname, '../bin/mcp-server.cjs')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, AI_PHOTO_STUDIO_HOME: path.join(dir, 'studio-home') }
    });

    const responses = [];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('MCP server test timeout')), 4000);
      let buf = '';
      child.stdout.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || '';
        for (const l of lines) {
          if (!l.trim()) continue;
          responses.push(JSON.parse(l));
          if (responses.length === 4) {
            clearTimeout(timer);
            resolve();
          }
        }
      });

      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'studio_list_crew', arguments: {} }
        }) + '\n'
      );
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'studio_create_job',
            arguments: { imagePath: imgPath, preset: 'cinema-night', brief: 'Night cafe scene' }
          }
        }) + '\n'
      );
    });

    child.kill();
    assert.equal(responses[0].result.serverInfo.name, 'ai-photo-studio');
    assert.equal(responses[1].result.tools.length, 9);
    const crewRes = JSON.parse(responses[2].result.content[0].text);
    assert.equal(crewRes.crew.length, 7);
    const jobRes = JSON.parse(responses[3].result.content[0].text);
    assert.equal(jobRes.job.preset, 'cinema-night');
    assert.equal(jobRes.job.sourceImage.width, 900);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('product-commercial preset omits portrait skin/eye terms and Web UI uses dynamic aspect-ratio', async () => {
  const dir = makeTempDir();
  try {
    const imgPath = path.join(dir, 'product.png');
    fs.writeFileSync(imgPath, makeFakePng(1600, 1200));

    const store = new StudioStore(path.join(dir, 'studio-home'));
    const job = store.createJobFromFile({ imagePath: imgPath, preset: 'product-commercial', brief: 'Studio monitor' });

    assert.doesNotMatch(job.promptPacks.codexPrompt, /skin pores|dead eyes|catchlights/i);
    assert.doesNotMatch(job.promptPacks.geminiPrompt, /skin pores|dead eyes|catchlights/i);
    assert.match(job.promptPacks.codexPrompt, /brand logos/i);
    assert.match(job.promptPacks.codexPrompt, /typography/i);

    const web = createStudioWebServer({ store, port: 0 });
    const info = await web.listen();
    try {
      const html = await (await fetch(info.url)).text();
      assert.match(html, /job\.sourceImage\.width/);
      assert.match(html, /max-height:\s*75vh/);
    } finally {
      await web.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

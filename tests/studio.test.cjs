'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const {
  inspectImageFile,
  classifyImageGeometry,
  getCrewList,
  normalizeRoleId,
  parseDirectedIntent,
  detectAvailableExecutors,
  executeRenderWithProvider,
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

test('inspectImageFile and classifyImageGeometry extract dimensions, aspect ratio, and framing hints safely', () => {
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
    assert.equal(meta.megapixels, 0.8);
    assert.equal(meta.sha256.length, 64);

    const geo = classifyImageGeometry(meta);
    assert.equal(geo.framingHint, 'classic-portrait-4x5');
    assert.equal(geo.isTallMobileScreenshot, false);
    assert.equal(geo.lowResWarning, false);

    const shotGeo = classifyImageGeometry({ width: 1080, height: 2209 });
    assert.equal(shotGeo.isTallMobileScreenshot, true);
    assert.equal(shotGeo.framingHint, 'tall-mobile-screenshot-strip-ui');
    assert.equal(shotGeo.recommendedTargetRatio, '4:5');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Autonomous mode triages photo-only input, generates 3 proposals, switches proposals, and logs 8-agent board', () => {
  const dir = makeTempDir();
  try {
    const imgPath = path.join(dir, 'couple_beach.png');
    fs.writeFileSync(imgPath, makeFakePng(1500, 1000));

    const store = new StudioStore(path.join(dir, 'studio-home'));
    assert.equal(getCrewList().length, 8);
    assert.equal(normalizeRoleId('executive-producer'), 'showrunner-director');
    assert.equal(normalizeRoleId('dop-optics'), 'camera-optics');

    const created = store.createJobFromFile({ imagePath: imgPath });
    const autoJob = store.runAutonomous(created.id, { subjectHint: 'couple' });
    assert.equal(autoJob.mode, 'autonomous');
    assert.equal(autoJob.subjectType, 'couple');
    assert.equal(autoJob.proposals.length, 3);
    assert.equal(autoJob.selectedProposalId, 'prop-couple-editorial');
    assert.equal(autoJob.agentBoard.length, 7);
    assert.equal(autoJob.status, 'ready-to-render');
    assert.ok(autoJob.promptPacks.claudeComfyPrompt.includes('couple-editorial'));

    const switched = store.selectProposal(autoJob.id, 'prop-couple-retouch');
    assert.equal(switched.selectedProposalId, 'prop-couple-retouch');
    assert.equal(switched.interventionScope, 'subtle-retouch');
    assert.equal(switched.locks.keepPose, true);
    assert.equal(switched.locks.keepWardrobe, true);
    assert.equal(switched.locks.keepBackground, true);
    assert.match(switched.promptPacks.codexPrompt, /STRICTLY preserve original wardrobe/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Directed mode parses bilingual exact orders, enforces subtle-retouch locks, and runs Anti-AI critique loop', () => {
  const dir = makeTempDir();
  try {
    const imgPath = path.join(dir, 'anchor.png');
    const render1 = path.join(dir, 'render1.png');
    const render2 = path.join(dir, 'render2.png');
    fs.writeFileSync(imgPath, makeFakePng(1080, 1350));
    fs.writeFileSync(render1, makeFakePng(1080, 1350));
    fs.writeFileSync(render2, makeFakePng(1080, 1350));

    const intent = parseDirectedIntent('Mantenha a pose e mesma roupa, ajuste sutil apenas na iluminação e nitidez');
    assert.equal(intent.interventionScope, 'subtle-retouch');
    assert.equal(intent.locks.keepPose, true);
    assert.equal(intent.locks.keepWardrobe, true);
    assert.equal(intent.locks.keepBackground, true);

    const partialIntent = parseDirectedIntent('Mantenha minha pose e roupa, melhore a luz');
    assert.equal(partialIntent.interventionScope, 'targeted-edit');
    assert.equal(partialIntent.locks.keepPose, true);
    assert.equal(partialIntent.locks.keepWardrobe, true);
    assert.equal(partialIntent.locks.keepBackground, false);

    const store = new StudioStore(path.join(dir, 'studio-home'));
    const job = store.createJobFromFile({
      imagePath: imgPath,
      mode: 'directed',
      brief: 'Editorial portrait in warm dusk gallery, keep pose only',
      scope: 'targeted-edit',
      locks: { keepPose: true },
      autoRun: true
    });
    assert.equal(job.mode, 'directed');
    assert.equal(job.interventionScope, 'targeted-edit');
    assert.equal(job.locks.keepPose, true);
    assert.match(job.promptPacks.codexPrompt, /STRICTLY preserve the exact original pose/i);

    // Legacy v1 role alias still works
    store.saveCrewPass(job.id, 'creative-director', { concept: 'Warm dusk gallery portrait' });

    const r1 = store.registerRenderFromFile(job.id, render1, { engine: 'codex', notes: 'Initial pass' });
    assert.equal(r1.renders[0].parentRenderVersion, 0);

    // Anti-AI QA rejects identity/anti-slop/garment drift < 8 and routes fixes + delta prompt
    const revised = store.submitQa(job.id, {
      verdict: 'pass',
      identityFidelityScore: 7.0,
      antiSlopScore: 6.5,
      garmentFidelityScore: 7.2,
      realismScore: 6.5,
      textureAndCatchlightsOk: false,
      revisionNotes: 'Jawline drifted, AI stock smile added, and shirt chest logo missing.'
    });
    assert.equal(revised.status, 'revision-requested');
    assert.equal(revised.revisionCycle, 1);
    assert.ok(revised.crewPasses['anti-ai-auditor'].rejectionTriggers.includes('ai-slop-beautification-or-artificial-smile'));
    assert.ok(revised.crewPasses['anti-ai-auditor'].rejectionTriggers.includes('garment-logo-or-pattern-loss'));
    assert.ok(revised.crewPasses['anti-ai-auditor'].routeToRoles.includes('consistency-guardian'));
    assert.ok(revised.crewPasses['anti-ai-auditor'].routeToRoles.includes('art-stylist'));
    assert.ok(revised.crewPasses['anti-ai-auditor'].routeToRoles.includes('lighting-director'));
    assert.match(revised.promptPacks.codexPrompt, /STRICT PRESERVATION RULE \(DO NOT VIOLATE\)/);
    assert.match(revised.promptPacks.revisionDeltaPrompt, /TARGETED REVISION PASS/);
    assert.match(revised.promptPacks.revisionDeltaPrompt, /shirt chest logo missing/);

    const r2 = store.registerRenderFromFile(job.id, render2, { engine: 'codex', notes: 'Revision v2' });
    assert.equal(r2.renders[1].parentRenderVersion, 1);

    const approved = store.submitQa(job.id, {
      verdict: 'pass',
      identityFidelityScore: 9.4,
      realismScore: 9.2,
      lightingCoherenceScore: 9.1,
      anatomyScore: 9.5,
      framingScore: 9.0,
      textureAndCatchlightsOk: true,
      revisionNotes: 'Identity locked, catchlights natural.'
    });
    assert.equal(approved.status, 'approved');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Local Studio Web Server creates autonomous/directed jobs, switches proposals, submits QA, and serves assets', async () => {
  const dir = makeTempDir();
  const store = new StudioStore(path.join(dir, 'studio-home'));
  const web = createStudioWebServer({ store, port: 0 });
  const info = await web.listen();

  try {
    const htmlRes = await fetch(info.url);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /AI PHOTO STUDIO/);
    assert.match(html, /6-Point Anti-AI Realism QA Gate/);

    const pngB64 = makeFakePng(600, 600).toString('base64');
    const createRes = await fetch(`${info.url}/api/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'input.png', base64: `data:image/png;base64,${pngB64}`, mode: 'autonomous', autoRun: true })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.job.mode, 'autonomous');
    assert.equal(created.job.proposals.length, 3);

    const propRes = await fetch(`${info.url}/api/jobs/${created.job.id}/proposal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proposalId: created.job.proposals[1].id })
    });
    assert.equal(propRes.status, 200);
    const switched = await propRes.json();
    assert.equal(switched.job.selectedProposalId, created.job.proposals[1].id);

    const renderRes = await fetch(`${info.url}/api/jobs/${created.job.id}/renders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'out.png', base64: pngB64, engine: 'gemini' })
    });
    assert.equal(renderRes.status, 201);
    const rendered = await renderRes.json();
    assert.equal(rendered.job.renders.length, 1);

    const qaRes = await fetch(`${info.url}/api/jobs/${created.job.id}/qa`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ verdict: 'pass', identityFidelityScore: 9.1, textureAndCatchlightsOk: true })
    });
    assert.equal(qaRes.status, 200);
    const qaDone = await qaRes.json();
    assert.equal(qaDone.job.status, 'approved');

    const assetRes = await fetch(`${info.url}/api/jobs/${created.job.id}/assets/${rendered.job.renders[0].assetName}`);
    assert.equal(assetRes.status, 200);
    assert.equal(assetRes.headers.get('content-type'), 'image/png');
  } finally {
    await web.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Optional BYOK executor detects env providers and executes Gemini payload cleanly with mocked fetch', async () => {
  const dir = makeTempDir();
  try {
    const executors = detectAvailableExecutors({ GEMINI_API_KEY: 'dummy-test-val' });
    assert.equal(executors.find((e) => e.id === 'gemini').available, true);
    assert.equal(executors.find((e) => e.id === 'openai').available, false);

    const imgPath = path.join(dir, 'anchor.png');
    const fakePng = makeFakePng(800, 1000);
    fs.writeFileSync(imgPath, fakePng);
    const store = new StudioStore(path.join(dir, 'studio-home'));
    const job = store.createJobFromFile({ imagePath: imgPath, mode: 'autonomous', autoRun: true });

    let capturedUrl = '';
    const mockFetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            { content: { parts: [{ inlineData: { mimeType: 'image/png', data: fakePng.toString('base64') } }] } }
          ]
        })
      };
    };

    const result = await executeRenderWithProvider({
      store,
      job,
      provider: 'gemini',
      apiKey: 'dummy-test-val',
      fetchImpl: mockFetch
    });
    assert.match(capturedUrl, /gemini-2\.5-flash-image:generateContent/);
    assert.equal(result.fileName, 'gemini_render.png');
    assert.ok(Buffer.isBuffer(result.buffer));
  } finally {
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

test('stdio MCP server serves v2.0.0 initialize, 13 tools, studio_run_autonomous, and studio_run_directed', async () => {
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
      const timer = setTimeout(() => reject(new Error('MCP server test timeout')), 5000);
      let buf = '';
      child.stdout.on('data', (chunk) => {
        buf += chunk.toString('utf8');
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || '';
        for (const l of lines) {
          if (!l.trim()) continue;
          responses.push(JSON.parse(l));
          if (responses.length === 5) {
            clearTimeout(timer);
            resolve();
          }
        }
      });

      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'studio_list_crew', arguments: {} } }) + '\n');
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'studio_run_autonomous', arguments: { imagePath: imgPath } }
        }) + '\n'
      );
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'studio_run_directed',
            arguments: { imagePath: imgPath, brief: 'Mantenha minha pose e roupa, ajuste sutil na luz', scope: 'subtle-retouch' }
          }
        }) + '\n'
      );
    });

    child.kill();
    assert.equal(responses[0].result.serverInfo.name, 'ai-photo-studio');
    assert.equal(responses[0].result.serverInfo.version, '2.1.0');
    assert.equal(responses[1].result.tools.length, 13);
    const crewRes = JSON.parse(responses[2].result.content[0].text);
    assert.equal(crewRes.crew.length, 8);
    const autoRes = JSON.parse(responses[3].result.content[0].text);
    assert.equal(autoRes.job.mode, 'autonomous');
    assert.equal(autoRes.job.proposals.length, 3);
    const directRes = JSON.parse(responses[4].result.content[0].text);
    assert.equal(directRes.job.mode, 'directed');
    assert.equal(directRes.job.interventionScope, 'subtle-retouch');
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
    const job = store.createJobFromFile({ imagePath: imgPath, preset: 'product-commercial', brief: 'Studio monitor', autoRun: true });

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

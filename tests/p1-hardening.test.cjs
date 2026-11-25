'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { StudioStore } = require('../lib/store.cjs');
const { inspectImageFile } = require('../lib/image-meta.cjs');
const { mergeCraftOptions } = require('../lib/orchestrator.cjs');
const { createStudioWebServer } = require('../lib/studio-web.cjs');
function png() {
  const b = Buffer.alloc(32); Buffer.from('89504e470d0a1a0a', 'hex').copy(b);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(800, 16); b.writeUInt32BE(1000, 20); return b;
}
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-p1-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return new StudioStore(home);
}
function request(port, route = '/', { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    }); req.on('error', reject); req.end(body);
  });
}
async function webFixture(t, requireToken = false) {
  const store = fixture(t); const web = createStudioWebServer({ store, port: 0, requireToken });
  const info = await web.listen(); t.after(() => web.close()); return { store, ...info };
}
test('magic bytes reject disguised extensions and derive actual MIME from content', t => {
  const store = fixture(t); const file = path.join(store.studioHome, 'fake.png'); fs.writeFileSync(file, '<html>not an image</html>');
  assert.throws(() => inspectImageFile(file), /file signature/);
  assert.throws(() => store.createJobFromBuffer({ fileName: 'fake.jpg', buffer: Buffer.from('not JPEG') }), /file signature/);
  fs.writeFileSync(file, png()); assert.equal(inspectImageFile(file).mimeType, 'image/png');
});
test('structural signatures reject malformed PNG, JPEG and WebP headers', t => {
  const store = fixture(t); const file = path.join(store.studioHome, 'payload.png');
  const badChunk = png(); badChunk.write('XXXX', 12);
  const zeroSize = png(); zeroSize.writeUInt32BE(0, 16);
  const webp = Buffer.alloc(30); webp.write('RIFF'); webp.writeUInt32LE(22, 4); webp.write('WEBPFAKE', 8);
  for (const buffer of [badChunk, zeroSize, Buffer.concat([Buffer.from([255, 216]), Buffer.from('<html>payload</html>')]), webp]) {
    fs.writeFileSync(file, buffer); assert.throws(() => inspectImageFile(file), /file signature/);
  }
  // Minimal supported lossless WebP header is 25 bytes; it need not be VP8X-sized.
  const lossless = Buffer.alloc(25); lossless.write('RIFF'); lossless.writeUInt32LE(17, 4); lossless.write('WEBPVP8L', 8); lossless.writeUInt32LE(5, 16); lossless[20] = 0x2f;
  fs.writeFileSync(file, lossless); assert.equal(inspectImageFile(file).format, 'webp');
  const extended = Buffer.alloc(30); extended.write('RIFF'); extended.writeUInt32LE(22, 4); extended.write('WEBPVP8X', 8); extended.writeUInt32LE(10, 16);
  fs.writeFileSync(file, extended); assert.equal(inspectImageFile(file).width, 1);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
  fs.writeFileSync(file, jpeg); assert.equal(inspectImageFile(file).format, 'jpeg');
  fs.writeFileSync(file, jpeg.subarray(0, 10)); assert.throws(() => inspectImageFile(file), /file signature/);
});
test('canonical asset names follow verified bytes and new render becomes active after rollback', t => {
  const store = fixture(t); let job = store.createJobFromBuffer({ fileName: 'evil.html', buffer: png() });
  assert.equal(job.sourceImage.assetName, 'anchor.png');
  job = store.registerRenderFromBuffer(job.id, { fileName: 'evil.html:stream', buffer: png() });
  assert.equal(job.renders[0].assetName, 'render_v1.png');
  store.registerRenderFromBuffer(job.id, { fileName: 'render.png', buffer: png() }); store.rollbackToRender(job.id, 1);
  job = store.registerRenderFromBuffer(job.id, { fileName: 'render.webp', buffer: png() });
  assert.equal(job.activeRenderVersion, 3); assert.equal(store.submitQa(job.id, {}).qaScorecards.at(-1).renderVersion, 3);
  const source = path.join(store.studioHome, 'source.html'); fs.writeFileSync(source, png());
  assert.equal(store.createJobFromFile({ imagePath: source }).sourceImage.assetName, 'anchor.png');
  job = store.registerRenderFromFile(job.id, source); assert.equal(job.renders.at(-1).assetName, 'render_v4.png'); assert.equal(job.activeRenderVersion, 4);
});
test('craft allowlist blocks prototype keys and effects reset removes legacy and derived data', t => {
  const hostile = JSON.parse('{"effectIds":[],"__proto__":{"isAdmin":true},"arbitraryKey":"x"}');
  const merged = mergeCraftOptions({ effectId: 'mist' }, hostile);
  assert.deepEqual(merged, {}); assert.equal(merged.isAdmin, undefined); assert.equal({}.isAdmin, undefined);
  assert.deepEqual(mergeCraftOptions({}, { effectIds: [' mist ', 'mist', ''], cameraId: ' camera ' }), { effectIds: ['mist'], cameraId: 'camera' });
  assert.throws(() => mergeCraftOptions({}, { effectIds: [{}] }), /Invalid craft option/);
  const store = fixture(t); let job = store.createJobFromBuffer({ fileName: 'a.png', buffer: png(), brief: 'portrait', autoRun: true });
  job.craftOptions.effectId = 'mist'; job.crewPasses['camera-optics'].opticalCharacter = 'STALE_EFFECT_CHARACTER'; store.writeJob(job);
  job = store.composeLook(job.id, { effectIds: [] }); assert.equal(job.craftOptions.effectId, undefined); assert.notEqual(job.crewPasses['camera-optics'].opticalCharacter, 'STALE_EFFECT_CHARACTER');
  assert.doesNotThrow(() => store.composeLook(job.id, JSON.parse('{"__proto__":null,"constructor":null}')));
});
test('HTTP strict environment, media type and fetch-site-only metadata cannot bypass token enforcement', async t => {
  const store = fixture(t); const original = process.env.AI_PHOTO_STUDIO_REQUIRE_TOKEN;
  let web;
  try { process.env.AI_PHOTO_STUDIO_REQUIRE_TOKEN = '1'; web = createStudioWebServer({ store, port: 0 }); }
  finally { if (original === undefined) delete process.env.AI_PHOTO_STUDIO_REQUIRE_TOKEN; else process.env.AI_PHOTO_STUDIO_REQUIRE_TOKEN = original; }
  const info = await web.listen(); t.after(() => web.close());
  assert.equal((await request(info.port, '/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 403);
  const normal = await webFixture(t);
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    assert.equal((await request(normal.port, '/api/jobs', { method, headers: { 'content-type': 'application/json-evil' }, body: '{}' })).status, 415);
    assert.equal((await request(normal.port, '/api/jobs', { method, headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }, body: '{}' })).status, 403);
  }
  assert.equal((await request(normal.port, '/api/jobs')).headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'");
  // Historical assets with an untrusted extension are served by verified content as well.
  const job = normal.store.createJobFromBuffer({ fileName: 'a.png', buffer: png() });
  fs.writeFileSync(path.join(normal.store.jobDir(job.id), 'assets', 'historical.html'), png());
  const asset = await request(normal.port, `/api/jobs/${job.id}/assets/historical.html`);
  assert.equal(asset.headers['content-type'], 'image/png');
  assert.equal(asset.headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'");
});
test('HTTP guards enforce loopback Host, JSON, Origin, fetch metadata and browser tokens', async t => {
  const { port, sessionToken, store } = await webFixture(t);
  const post = headers => request(port, '/api/jobs', { method: 'POST', headers, body: '{}' });
  const json = { 'content-type': 'application/json' };
  assert.match(sessionToken, /^[a-f0-9]{48}$/);
  for (const host of ['evil.test', '127.0.0.1.evil.test', 'localhost@evil.test']) assert.equal((await request(port, '/', { headers: { host } })).status, 403);
  for (const host of ['localhost', '[::1]:123', '127.0.0.1']) assert.equal((await request(port, '/', { headers: { host } })).status, 200);
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await request(port, '/api/jobs', { method })).status, 415);
  assert.equal((await post({ ...json, origin: 'https://evil.test', 'x-studio-token': sessionToken })).status, 403);
  assert.equal((await post({ ...json, origin: `http://localhost:${port + 1}`, 'x-studio-token': sessionToken })).status, 403);
  for (const site of ['cross-site', 'same-site']) assert.equal((await post({ ...json, 'sec-fetch-site': site, 'x-studio-token': sessionToken })).status, 403);
  for (const headers of [{ origin: `http://localhost:${port}` }, { referer: `http://localhost:${port}/` }, { 'sec-fetch-mode': 'cors' }]) {
    assert.equal((await post({ ...json, ...headers })).status, 403);
    assert.equal((await post({ ...json, ...headers, 'x-studio-token': 'wrong' })).status, 403);
  }
  // Native clients without browser metadata retain the optional-token contract.
  assert.equal((await post(json)).status, 400);
  const goodHeaders = { ...json, origin: `http://127.0.0.1:${port}`, 'sec-fetch-site': 'same-origin', 'x-studio-token': sessionToken };
  const created = await request(port, '/api/jobs', { method: 'POST', headers: goodHeaders, body: JSON.stringify({ fileName: 'anchor.png', base64: png().toString('base64') }) });
  assert.equal(created.status, 201); const job = JSON.parse(created.text).job;
  const base = '/api/jobs/' + job.id;
  assert.equal((await request(port, base + '/assets/' + job.sourceImage.assetName)).status, 200);
  for (let n = 0; n < 2; n++) assert.equal((await request(port, base + '/renders', { method: 'POST', headers: goodHeaders, body: JSON.stringify({ fileName: 'render.png', base64: png().toString('base64') }) })).status, 201);
  assert.equal((await request(port, base + '/rollback', { method: 'POST', headers: goodHeaders, body: '{"version":1}' })).status, 200);
  const qa = await request(port, base + '/qa', { method: 'POST', headers: goodHeaders, body: '{"framingScore":3}' });
  assert.equal(qa.status, 200); const reviewed = JSON.parse(qa.text).job;
  assert.equal(reviewed.qaScorecards.at(-1).renderVersion, 1); assert.equal(reviewed.qaScorecards.at(-1).framingScore, 3);
  const craft = await request(port, base + '/craft', { method: 'POST', headers: goodHeaders, body: '{"poseId":null,"effectIds":[]}' });
  assert.equal(craft.status, 200); assert.deepEqual(store.readJob(job.id).craftOptions, {});
});
test('strict token mode isolates instances and all HTTP paths carry security headers', async t => {
  const first = await webFixture(t, true); const second = await webFixture(t, true);
  assert.notEqual(first.sessionToken, second.sessionToken);
  for (const [route, options, status] of [['/', {}, 200], ['/missing', {}, 404], ['/api/jobs', { method: 'POST' }, 415], ['/', { headers: { host: 'evil.test' } }, 403]]) {
    const res = await request(first.port, route, options); assert.equal(res.status, status);
    assert.equal(res.headers['x-content-type-options'], 'nosniff'); assert.equal(res.headers['x-frame-options'], 'DENY'); assert.equal(res.headers['referrer-policy'], 'no-referrer');
  }
  const post = token => request(first.port, '/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-studio-token': token } : {}) }, body: '{}' });
  assert.equal((await post()).status, 403); assert.equal((await post(second.sessionToken)).status, 403); assert.equal((await post(first.sessionToken)).status, 400);
});
test('HTML nonce matches CSP, rotates per response, and UI script is valid JavaScript', async t => {
  const { port, sessionToken } = await webFixture(t); const a = await request(port); const b = await request(port);
  const nonce = a.text.match(/<script nonce="([^"]+)">/)[1];
  assert.ok(a.headers['content-security-policy'].includes(`script-src 'nonce-${nonce}'`));
  assert.notEqual(nonce, b.text.match(/<script nonce="([^"]+)">/)[1]);
  assert.ok(a.text.includes(`<meta name="studio-token" content="${sessionToken}" />`));
  new vm.Script(a.text.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]);
  for (const text of ['Welcome to AI Photo Studio v4.1', '8-Point Anti-AI Realism QA Gate', 'qaFraming', 'framingScore:', 'data-effect', 'data-frame-engine', 'midjourneyFluxPrompt', 'universalJsonSpec', 'Set Active (Rollback)', 'job.activeRenderVersion', 'function guarded', 'x-studio-token']) assert.ok(a.text.includes(text), text);
  assert.ok(!a.text.includes('id="craftEffect"'));
});
test('craft resets remove overrides and stale derived passes without mutating the input', t => {
  const existing = { poseId: 'old', lensId: 'old', effectIds: ['old'], cameraId: 'keep' };
  assert.deepEqual(mergeCraftOptions(existing, { poseId: null, lensId: '', effectIds: [] }), { cameraId: 'keep' }); assert.equal(existing.poseId, 'old');
  const store = fixture(t); let job = store.createJobFromBuffer({ fileName: 'anchor.png', buffer: png(), brief: 'editorial portrait', autoRun: true });
  job.craftOptions = { poseId: 'old', cameraId: 'old', lensId: 'old', effectIds: ['old'], makeupId: 'old', lightingId: 'old' };
  job.crewPasses['camera-optics'].opticalEffects = 'STALE_EFFECT'; job.crewPasses['camera-optics'].primeLens = 'STALE_LENS';
  store.writeJob(job);
  job = store.composeLook(job.id, { poseId: null, cameraId: '', lensId: null, effectIds: [], makeupId: null, lightingId: null });
  assert.deepEqual(job.craftOptions, {}); assert.notEqual(job.crewPasses['camera-optics'].opticalEffects, 'STALE_EFFECT'); assert.notEqual(job.crewPasses['camera-optics'].primeLens, 'STALE_LENS');
});
test('vision reruns preserve directed, autonomous and essay settings; all frames compile five engines', t => {
  const store = fixture(t);
  for (const mode of ['directed', 'autonomous', 'essay']) {
    const options = { mode: mode === 'autonomous' ? 'autonomous' : 'directed', brief: 'editorial portrait', scope: 'full-editorial', preset: 'cinema-night', locks: { keepPose: true, keepWardrobe: true, keepBackground: true, keepFraming: true }, craftOptions: { cameraId: 'test-camera' }, researchInsights: { promptHighlights: ['reference'] }, subjectHint: 'portrait' };
    let job = store.createJobFromBuffer({ fileName: 'anchor.png', buffer: png(), ...options });
    job = mode === 'essay' ? store.runEssay(job.id, { ...options, count: 3 }) : store[mode === 'directed' ? 'runDirected' : 'runAutonomous'](job.id, options);
    const before = structuredClone(job); job = store.applyVisionAnalysis(job.id, { essenceAnalysis: 'Vision essence' });
    for (const key of ['mode', 'userBrief', 'interventionScope', 'preset', 'locks', 'craftOptions', 'researchInsights']) assert.deepEqual(job[key], before[key], mode + ':' + key);
    assert.ok(job.crewPasses['prompt-editor'].enginesCompiled.includes('midjourney-flux'));
    if (mode === 'essay') {
      assert.equal(job.essayFrames.length, 3);
      for (const frame of job.essayFrames) { assert.ok(frame.midjourneyFluxPrompt.includes(frame.location)); assert.equal(frame.universalJsonSpec.frame, frame.index); assert.equal(frame.universalJsonSpec.pose, frame.pose); }
    }
  }
});
test('QA uses active render and falls back to latest when active version is missing', t => {
  const store = fixture(t); let job = store.createJobFromBuffer({ fileName: 'anchor.png', buffer: png() });
  for (let i = 0; i < 2; i++) job = store.registerRenderFromBuffer(job.id, { fileName: 'render.png', buffer: png() });
  store.rollbackToRender(job.id, 1); job = store.submitQa(job.id, {}); assert.equal(job.qaScorecards.at(-1).renderVersion, 1);
  assert.equal(job.renders[0].qaVerdict, 'pass'); assert.equal(job.renders[1].qaVerdict, undefined);
  job.activeRenderVersion = 999; store.writeJob(job); assert.equal(store.submitQa(job.id, {}).qaScorecards.at(-1).renderVersion, 2);
});
test('atomic writes use random suffix and clean failed temporary writes', t => {
  const store = fixture(t); const job = store.createJobFromBuffer({ fileName: 'anchor.png', buffer: png() });
  const original = fs.renameSync; let tmp;
  try {
    fs.renameSync = (source) => { tmp = source; throw new Error('simulated rename failure'); };
    assert.throws(() => store.writeJob(job), /simulated rename/);
  } finally { fs.renameSync = original; }
  assert.match(tmp, /\.[a-f0-9]{8}\.tmp$/); assert.equal(fs.existsSync(tmp), false); assert.equal(store.readJob(job.id).id, job.id);
});
test('CLI rejects unknown and incomplete flags and preserves help aliases', () => {
  const cli = path.resolve(__dirname, '../bin/ai-photo-studio.cjs');
  for (const args of [['auto', '--foo'], ['--foo'], ['direct', '--brief']]) {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' }); assert.equal(r.status, 1); assert.match(r.stderr, /Unknown option: --foo|Missing value for option: --brief/);
  }
  for (const args of [['--help'], ['-h'], ['auto', '--help']]) { const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0); assert.match(r.stdout, /Usage:/); }
  for (const port of ['abc', '-1', '0', '65536', '1.5']) { const r = spawnSync(process.execPath, [cli, 'crew', '--port', port], { encoding: 'utf8' }); assert.equal(r.status, 1); assert.match(r.stderr, /Invalid --port/); }
  const missing = spawnSync(process.execPath, [cli, 'direct', '--brief', '-h'], { encoding: 'utf8' }); assert.equal(missing.status, 1); assert.match(missing.stderr, /Missing value/);
});
test('CLI analyzes intake before a single pipeline in auto, direct and essay, preserving every option', async t => {
  const store = fixture(t); const image = path.join(store.studioHome, 'anchor.png'); fs.writeFileSync(image, png());
  const cli = path.resolve(__dirname, '../bin/ai-photo-studio.cjs');
  const { createRequire } = require('node:module'); const localRequire = createRequire(cli);
  for (const command of ['auto', 'direct', 'essay']) {
    let visionCalls = 0, analysisCalls = 0; const output = [];
    class InstrumentedStore extends StudioStore {
      runAutonomous() { throw new Error('Redundant runAutonomous'); }
      runDirected() { throw new Error('Redundant runDirected'); }
      runEssay() { throw new Error('Redundant runEssay'); }
      applyVisionAnalysis(...args) { analysisCalls++; return super.applyVisionAnalysis(...args); }
    }
    const context = vm.createContext({
      require(name) {
        if (name === '../lib/store.cjs') return { StudioStore: InstrumentedStore, defaultStudioHome: () => store.studioHome };
        if (name === '../lib/executors.cjs') return { analyzeAnchorWithVision: async ({ job }) => { visionCalls++; assert.equal(job.status, 'intake'); return { provider: 'mock', analysis: { subjectType: 'couple', essenceAnalysis: 'CLI vision essence' } }; } };
        if (name === '../lib/craft-research.cjs') return { researchPhotographyTechniques: async () => ({ promptHighlights: ['CLI research'] }) };
        return localRequire(name);
      },
      process: { argv: ['node', cli, command, image, '--analyze', '--json', '--brief', 'editorial', '--scope', 'full-editorial', '--preset', 'cinema-night', '--keep-pose', '--keep-background', '--keep-wardrobe', '--keep-framing', '--camera', 'test-camera', '--research', 'light', '--count', '3'] },
      console: { log: value => output.push(value) }
    });
    const source = fs.readFileSync(cli, 'utf8').replace(/main\(\)\.catch\([\s\S]*$/, '');
    vm.runInContext(source, context); await context.main(); const job = JSON.parse(output[0]);
    assert.equal(visionCalls, 1); assert.equal(analysisCalls, 1); assert.equal(job.essenceAnalysis, 'CLI vision essence');
    assert.equal(job.preset, 'cinema-night'); assert.equal(job.interventionScope, 'full-editorial'); assert.equal(job.userBrief, 'editorial');
    assert.deepEqual(job.locks, { keepPose: true, keepWardrobe: true, keepBackground: true, keepFraming: true });
    assert.equal(job.craftOptions.cameraId, 'test-camera'); assert.deepEqual(job.researchInsights.promptHighlights, ['CLI research']);
    if (command === 'essay') assert.equal(job.essayCount, 3);
  }
});

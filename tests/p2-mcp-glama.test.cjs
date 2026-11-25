'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const { TOOLS, createStdioFramingParser } = require('../bin/mcp-server.cjs');

const SERVER_PATH = path.resolve(__dirname, '../bin/mcp-server.cjs');
const ROOT_DIR = path.resolve(__dirname, '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-photo-studio-p2-test-'));
}

function makeFakePng(width = 800, height = 1000, extraPadBytes = 0) {
  const buf = Buffer.alloc(32 + extraPadBytes, 0);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 4, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8;
  buf[25] = 6;
  return buf;
}

function frameContentLength(objOrString, extraHeaders = []) {
  const body = typeof objOrString === 'string' ? objOrString : JSON.stringify(objOrString);
  const headers = [...extraHeaders, `Content-Length: ${Buffer.byteLength(body, 'utf8')}`].join('\r\n');
  return `${headers}\r\n\r\n${body}`;
}

function spawnMcpServer(studioHome, { env = {}, args = [] } = {}) {
  const cleanEnv = { ...process.env };
  delete cleanEnv.GEMINI_API_KEY;
  delete cleanEnv.OPENAI_API_KEY;
  delete cleanEnv.OLLAMA_URL;
  delete cleanEnv.MCP_RESPONSE_FRAMING;

  const child = spawn(process.execPath, [SERVER_PATH, ...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...cleanEnv,
      AI_PHOTO_STUDIO_HOME: studioHome,
      ...env
    }
  });
  return child;
}

test('MCP protocolVersion negotiation, ping, and ToolAnnotations across all 18 tools', async () => {
  const dir = makeTempDir();
  try {
    assert.equal(TOOLS.length, 18);
    for (const tool of TOOLS) {
      assert.ok(tool.annotations, `Missing annotations on ${tool.name}`);
      assert.equal(typeof tool.annotations.title, 'string');
      assert.equal(typeof tool.annotations.readOnlyHint, 'boolean');
      assert.equal(typeof tool.annotations.destructiveHint, 'boolean');
      assert.equal(typeof tool.annotations.idempotentHint, 'boolean');
      assert.equal(typeof tool.annotations.openWorldHint, 'boolean');
    }

    const qaTool = TOOLS.find((t) => t.name === 'studio_submit_qa');
    assert.match(qaTool.description, /8-point scorecard/i);

    const analyzeTool = TOOLS.find((t) => t.name === 'studio_analyze_photo');
    assert.deepEqual(analyzeTool.inputSchema.properties.provider.enum, ['auto', 'sampling', 'gemini', 'openai', 'ollama']);

    const checkVersion = async (requested, expected) => {
      const child = spawnMcpServer(path.join(dir, `home-${requested || 'none'}`));
      try {
        const messages = [];
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Negotiation test timeout')), 5000);
          let buf = '';
          child.stdout.on('data', (chunk) => {
            buf += chunk.toString('utf8');
            const lines = buf.split(/\r?\n/);
            buf = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              messages.push(JSON.parse(line));
              if (messages.length === 2) {
                clearTimeout(timer);
                resolve();
              }
            }
          });
          child.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: requested ? { protocolVersion: requested, capabilities: {} } : {}
          }) + '\n');
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping', params: {} }) + '\n');
        });
        assert.equal(messages[0].result.protocolVersion, expected);
        assert.deepEqual(messages[1].result, {});
      } finally {
        child.kill();
      }
    };

    await checkVersion('2025-06-18', '2025-06-18');
    await checkVersion('2025-03-26', '2025-03-26');
    await checkVersion('2024-11-05', '2024-11-05');
    await checkVersion('2099-01-01', '2025-03-26');
    await checkVersion(null, '2025-03-26');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Robust Content-Length parser handles >256B headers, extra headers, multi-byte UTF-8 fragmented chunks, and -32700 parse errors', async () => {
  const parsedMessages = [];
  const parseErrors = [];
  const parser = createStdioFramingParser(
    (msg) => parsedMessages.push(msg),
    (err) => parseErrors.push(err)
  );

  const longHeader = `X-Long-Trace: ${'a'.repeat(320)}`;
  const utf8Payload = {
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: { name: 'studio_research_craft', arguments: { query: 'Café 📸 iluminação cinematográfica', liveWeb: false } }
  };
  const frame1 = frameContentLength(utf8Payload, ['Content-Type: application/vscode-jsonrpc; charset=utf-8', longHeader]);
  const frame2 = `${'Content-Length: ' + Buffer.byteLength('{"jsonrpc":"2.0","id":11,"method":"ping"}', 'utf8')}\n\n{"jsonrpc":"2.0","id":11,"method":"ping"}`;
  const malformedFrame = frameContentLength('{broken_json');
  const malformedLine = '{"bad": \n';
  const validLine = JSON.stringify({ jsonrpc: '2.0', id: 12, method: 'ping' }) + '\n';

  const fullStream = Buffer.concat([
    Buffer.from(frame1, 'utf8'),
    Buffer.from(malformedFrame, 'utf8'),
    Buffer.from(frame2, 'utf8'),
    Buffer.from(malformedLine, 'utf8'),
    Buffer.from(validLine, 'utf8')
  ]);

  // Feed in tiny 5-byte chunks so headers and multi-byte UTF-8 characters split across chunks
  for (let i = 0; i < fullStream.length; i += 5) {
    parser.push(fullStream.subarray(i, i + 5));
  }
  parser.end();

  assert.equal(parsedMessages.length, 3);
  assert.equal(parsedMessages[0].id, 10);
  assert.equal(parsedMessages[0].params.arguments.query, 'Café 📸 iluminação cinematográfica');
  assert.equal(parsedMessages[1].id, 11);
  assert.equal(parsedMessages[2].id, 12);
  assert.equal(parseErrors.length, 2);

  // Also verify -32700 JSON-RPC error over live stdio process without breaking stream
  const dir = makeTempDir();
  try {
    const child = spawnMcpServer(path.join(dir, 'studio-home'));
    const responses = [];
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Parse error stdio timeout')), 5000);
      let outBuf = '';
      child.stdout.on('data', (chunk) => {
        outBuf += chunk.toString('utf8');
        const lines = outBuf.split(/\r?\n/);
        outBuf = lines.pop() || '';
        for (const l of lines) {
          if (!l.trim()) continue;
          responses.push(JSON.parse(l));
          if (responses.length === 3) {
            clearTimeout(timer);
            resolve();
          }
        }
      });
      child.stdin.write('{not valid json\n');
      child.stdin.write(frameContentLength('{also_broken'));
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'ping' }) + '\n');
    });
    child.kill();

    assert.equal(responses[0].id, null);
    assert.equal(responses[0].error.code, -32700);
    assert.equal(responses[1].id, null);
    assert.equal(responses[1].error.code, -32700);
    assert.equal(responses[2].id, 99);
    assert.deepEqual(responses[2].result, {});
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Opt-in Content-Length response framing works via MCP_RESPONSE_FRAMING=content-length and --content-length-responses', async () => {
  const dir = makeTempDir();
  try {
    const runFramedPing = async (opts) => {
      const child = spawnMcpServer(path.join(dir, `home-${opts.label}`), opts);
      const outMessages = [];
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Content-Length response timeout')), 5000);
        const parser = createStdioFramingParser(
          (msg) => {
            outMessages.push(msg);
            if (outMessages.length === 1) {
              clearTimeout(timer);
              resolve();
            }
          },
          (err) => reject(new Error(err))
        );
        let rawStdout = '';
        child.stdout.on('data', (chunk) => {
          rawStdout += chunk.toString('utf8');
          parser.push(chunk);
        });
        child.stdin.write(frameContentLength({ jsonrpc: '2.0', id: 1, method: 'ping' }));
        child.once('exit', () => {
          assert.match(rawStdout, /^Content-Length:\s*\d+\r\n\r\n/i);
        });
      });
      child.kill();
      assert.equal(outMessages[0].id, 1);
      assert.deepEqual(outMessages[0].result, {});
    };

    await runFramedPing({ label: 'env', env: { MCP_RESPONSE_FRAMING: 'content-length' } });
    await runFramedPing({ label: 'flag', args: ['--content-length-responses'] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tools/call returns structuredContent, multimodal type:"image" blocks with 4MB cap, researchQuery in essay, and studio_start_web port switch', async () => {
  const dir = makeTempDir();
  try {
    const anchorPath = path.join(dir, 'anchor.png');
    const smallRenderPath = path.join(dir, 'render_small.png');
    const hugeRenderPath = path.join(dir, 'render_huge.png');
    const smallPng = makeFakePng(600, 800);
    fs.writeFileSync(anchorPath, smallPng);
    fs.writeFileSync(smallRenderPath, smallPng);
    fs.writeFileSync(hugeRenderPath, makeFakePng(600, 800, 4 * 1024 * 1024 + 512));

    const child = spawnMcpServer(path.join(dir, 'studio-home'));
    const responses = new Map();
    const waitForId = (targetId) => new Promise((resolve, reject) => {
      if (responses.has(targetId)) return resolve(responses.get(targetId));
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for id ${targetId}`)), 5000);
      const check = () => {
        if (responses.has(targetId)) {
          clearTimeout(timer);
          resolve(responses.get(targetId));
        }
      };
      child.stdout.on('data', check);
    });

    let outBuf = '';
    child.stdout.on('data', (chunk) => {
      outBuf += chunk.toString('utf8');
      const lines = outBuf.split(/\r?\n/);
      outBuf = lines.pop() || '';
      for (const l of lines) {
        if (!l.trim()) continue;
        const msg = JSON.parse(l);
        if (msg.id !== undefined) responses.set(msg.id, msg);
      }
    });

    const send = (id, method, params) => {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      return waitForId(id);
    };

    const essayResp = await send(1, 'tools/call', {
      name: 'studio_run_essay',
      arguments: {
        imagePath: anchorPath,
        count: 3,
        craftOptions: { researchQuery: 'black pro-mist' }
      }
    });
    assert.ok(essayResp.result.structuredContent);
    assert.equal(essayResp.result.structuredContent.job.essayMode, true);
    assert.ok(essayResp.result.structuredContent.job.researchInsights);
    assert.equal(essayResp.result.structuredContent.job.researchInsights.query, 'black pro-mist');
    const jobId = essayResp.result.structuredContent.job.id;

    // Default studio_get_job omits image for token economy
    const getDefault = await send(2, 'tools/call', {
      name: 'studio_get_job',
      arguments: { jobId }
    });
    assert.equal(getDefault.result.content.length, 1);
    assert.equal(getDefault.result.structuredContent.job.id, jobId);

    // studio_get_job with includeImage: true attaches base64 image block
    const getWithImage = await send(3, 'tools/call', {
      name: 'studio_get_job',
      arguments: { jobId, includeImage: true }
    });
    assert.equal(getWithImage.result.content.length, 2);
    assert.equal(getWithImage.result.content[1].type, 'image');
    assert.equal(getWithImage.result.content[1].mimeType, 'image/png');
    assert.equal(getWithImage.result.content[1].data, smallPng.toString('base64'));

    // studio_register_render attaches image by default
    const regSmall = await send(4, 'tools/call', {
      name: 'studio_register_render',
      arguments: { jobId, imagePath: smallRenderPath, engine: 'flux' }
    });
    assert.equal(regSmall.result.content.length, 2);
    assert.equal(regSmall.result.content[1].type, 'image');

    // studio_register_render with includeImage: false omits image
    const regNoImg = await send(5, 'tools/call', {
      name: 'studio_register_render',
      arguments: { jobId, imagePath: smallRenderPath, engine: 'flux', includeImage: false }
    });
    assert.equal(regNoImg.result.content.length, 1);

    // studio_register_render > 4 MB omits image safely without failing
    const regHuge = await send(6, 'tools/call', {
      name: 'studio_register_render',
      arguments: { jobId, imagePath: hugeRenderPath, engine: 'flux' }
    });
    assert.equal(regHuge.result.isError, undefined);
    assert.equal(regHuge.result.content.length, 1);
    assert.equal(regHuge.result.structuredContent.job.renders.length, 3);

    // studio_start_web restarts on new explicit port
    const web1 = await send(7, 'tools/call', { name: 'studio_start_web', arguments: { port: 0 } });
    const port1 = web1.result.structuredContent.port;
    assert.ok(port1 > 0);
    const web2 = await send(8, 'tools/call', { name: 'studio_start_web', arguments: { port: 0 } });
    const port2 = web2.result.structuredContent.port;
    assert.ok(port2 > 0);
    assert.notEqual(port1, port2);

    child.kill();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Bidirectional MCP sampling/createMessage powers studio_analyze_photo in auto and sampling modes', async () => {
  const dir = makeTempDir();
  try {
    const anchorPath = path.join(dir, 'subject.png');
    fs.writeFileSync(anchorPath, makeFakePng(900, 1200));

    const child = spawnMcpServer(path.join(dir, 'studio-home'));
    const serverResponses = new Map();
    const clientRequestsSeen = [];

    let outBuf = '';
    child.stdout.on('data', (chunk) => {
      outBuf += chunk.toString('utf8');
      const lines = outBuf.split(/\r?\n/);
      outBuf = lines.pop() || '';
      for (const l of lines) {
        if (!l.trim()) continue;
        const msg = JSON.parse(l);
        if (msg.method && msg.id !== undefined) {
          clientRequestsSeen.push(msg);
          const mockVisionJson = {
            subjectType: 'portrait',
            essenceAnalysis: 'Quiet late-afternoon architectural stillness with muted earth tones.',
            expressionTruth: 'Calm relaxed eyelids and soft closed-mouth composure',
            garmentMicroDetails: 'Olive linen overshirt with matte horn buttons and rolled cuffs',
            antiBeautificationLocks: 'Natural skin pores, subtle under-eye crease, fine beard stubble',
            recommendedLocation: 'Brutalist concrete gallery atrium with skylight bounce',
            motivatedLightSource: 'Overhead diffused skylight 40 degrees camera-left',
            contrastRatio: '3:1 soft editorial contrast',
            negativeFill: 'Matte black V-flat camera-right',
            kelvinSeparation: '5400K neutral skylight vs 4600K warm stone reflection'
          };
          child.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              role: 'assistant',
              content: {
                type: 'text',
                text: '```json\n' + JSON.stringify(mockVisionJson) + '\n```'
              },
              model: 'host-subscription-vision',
              stopReason: 'endTurn'
            }
          }) + '\n');
        } else if (msg.id !== undefined) {
          serverResponses.set(msg.id, msg);
        }
      }
    });

    const waitForId = (targetId) => new Promise((resolve, reject) => {
      if (serverResponses.has(targetId)) return resolve(serverResponses.get(targetId));
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for id ${targetId}`)), 5000);
      const onData = () => {
        if (serverResponses.has(targetId)) {
          clearTimeout(timer);
          child.stdout.off('data', onData);
          resolve(serverResponses.get(targetId));
        }
      };
      child.stdout.on('data', onData);
    });

    const send = (id, method, params) => {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      return waitForId(id);
    };

    const initResp = await send(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: { sampling: {} }
    });
    assert.equal(initResp.result.protocolVersion, '2025-06-18');

    const created = await send(2, 'tools/call', {
      name: 'studio_create_job',
      arguments: { imagePath: anchorPath, autoRun: true }
    });
    const jobId = created.result.structuredContent.job.id;

    // Auto mode without cloud keys uses MCP sampling
    const autoVision = await send(3, 'tools/call', {
      name: 'studio_analyze_photo',
      arguments: { jobId, provider: 'auto' }
    });
    assert.equal(autoVision.result.structuredContent.provider, 'mcp-sampling');
    assert.match(autoVision.result.structuredContent.job.crewPasses['consistency-guardian'].garmentMicroDetails, /Olive linen overshirt/);

    // Explicit provider: 'sampling' also works
    const explicitVision = await send(4, 'tools/call', {
      name: 'studio_analyze_photo',
      arguments: { jobId, provider: 'sampling' }
    });
    assert.equal(explicitVision.result.structuredContent.provider, 'mcp-sampling');
    assert.equal(clientRequestsSeen.length, 2);
    assert.equal(clientRequestsSeen[0].method, 'sampling/createMessage');
    assert.equal(clientRequestsSeen[0].params.messages[0].content.type, 'image');
    assert.equal(clientRequestsSeen[0].params.messages[0].content.mimeType, 'image/png');

    child.kill();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Dockerfile and .dockerignore meet hardened Glama non-root production standards', () => {
  const dockerfile = fs.readFileSync(path.join(ROOT_DIR, 'Dockerfile'), 'utf8');
  const dockerignore = fs.readFileSync(path.join(ROOT_DIR, '.dockerignore'), 'utf8');

  assert.match(dockerfile, /^FROM node:24-alpine/m);
  assert.match(dockerfile, /NODE_ENV=production/);
  assert.match(dockerfile, /AI_PHOTO_STUDIO_HOME=\/tmp\/ai-photo-studio/);
  assert.match(dockerfile, /^USER node/m);
  assert.match(dockerfile, /ENTRYPOINT \["node", "bin\/mcp-server\.cjs"\]/);

  assert.match(dockerignore, /^\.git$/m);
  assert.match(dockerignore, /^tests$/m);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.github$/m);
  assert.match(dockerignore, /^\*\.log$/m);
});

test('studio_execute_render attaches multimodal image block by default and respects includeImage: false', async () => {
  const dir = makeTempDir();
  try {
    const anchorPath = path.join(dir, 'anchor.png');
    const pngBuf = makeFakePng(640, 800);
    fs.writeFileSync(anchorPath, pngBuf);

    const script = `
      const fs = require('node:fs');
      const { handleMessage } = require(${JSON.stringify(SERVER_PATH)});
      const b64 = fs.readFileSync(${JSON.stringify(anchorPath)}).toString('base64');
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: b64 } }] } }]
        })
      });
      const captured = [];
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk) => { captured.push(chunk.toString('utf8')); return true; };
      (async () => {
        await handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'studio_create_job', arguments: { imagePath: ${JSON.stringify(anchorPath)}, autoRun: true } } });
        const created = JSON.parse(captured[0]);
        const jobId = created.result.structuredContent.job.id;
        await handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'studio_execute_render', arguments: { jobId, provider: 'gemini' } } });
        await handleMessage({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'studio_execute_render', arguments: { jobId, provider: 'gemini', includeImage: false } } });
        origWrite(JSON.stringify(captured.map((c) => JSON.parse(c))));
      })();
    `;

    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', script], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          AI_PHOTO_STUDIO_HOME: path.join(dir, 'studio-home'),
          GEMINI_API_KEY: 'dummy-test-key'
        }
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
      child.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
      child.on('exit', (code) => {
        if (code !== 0) return reject(new Error(`Subprocess exited ${code}: ${stderr}`));
        resolve(JSON.parse(stdout));
      });
    });

    assert.equal(output[1].result.content.length, 2);
    assert.equal(output[1].result.content[1].type, 'image');
    assert.equal(output[1].result.content[1].mimeType, 'image/png');
    assert.equal(output[1].result.content[1].data, pngBuf.toString('base64'));
    assert.equal(output[2].result.content.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

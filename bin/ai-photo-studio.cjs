#!/usr/bin/env node
'use strict';

const { getCrewList } = require('../lib/crew.cjs');
const { StudioStore, defaultStudioHome } = require('../lib/store.cjs');
const { createStudioWebServer } = require('../lib/studio-web.cjs');
const { installStudioClients, checkStudioStatus } = require('../lib/installers.cjs');

function parseArgs(argv) {
  const [cmd = 'help', ...rest] = argv;
  const opts = { cmd, port: 4321, clients: null, json: false };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--port' && rest[i + 1]) opts.port = Number(rest[++i]) || 4321;
    else if (a === '--clients' && rest[i + 1]) opts.clients = rest[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--json') opts.json = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.cmd === 'help' || opts.cmd === '--help' || opts.cmd === '-h') {
    console.log('Usage: ai-photo-studio <web|mcp|install|status|crew> [--port 4321] [--clients codex,gemini,claude-code,claude-desktop] [--json]');
    process.exit(0);
  }

  if (opts.cmd === 'mcp') {
    require('./mcp-server.cjs');
    return;
  }

  if (opts.cmd === 'crew') {
    console.log(JSON.stringify(getCrewList(), null, 2));
    return;
  }

  if (opts.cmd === 'status') {
    const status = checkStudioStatus();
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  if (opts.cmd === 'install') {
    const results = installStudioClients({ clientIds: opts.clients });
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (opts.cmd === 'web') {
    const store = new StudioStore(defaultStudioHome());
    const web = createStudioWebServer({ store, port: opts.port });
    const info = await web.listen();
    console.log(`AI Photo Studio Web UI running at ${info.url} (home: ${store.studioHome})`);
    return;
  }

  throw new Error(`Unknown command: ${opts.cmd}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
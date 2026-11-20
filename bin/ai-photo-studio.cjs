#!/usr/bin/env node
'use strict';

const { getCrewList, STUDIO_PRESETS } = require('../lib/crew.cjs');
const { StudioStore, defaultStudioHome } = require('../lib/store.cjs');
const { createStudioWebServer } = require('../lib/studio-web.cjs');
const { installStudioClients, checkStudioStatus } = require('../lib/installers.cjs');
const { detectAvailableExecutors } = require('../lib/executors.cjs');

function parseArgs(argv) {
  const [cmd = 'help', ...rest] = argv;
  const opts = {
    cmd,
    positional: [],
    port: 4321,
    clients: null,
    json: false,
    brief: '',
    scope: null,
    preset: null,
    subject: 'auto',
    keepPose: false,
    keepWardrobe: false,
    keepBackground: false,
    keepFraming: false
  };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--port' && rest[i + 1]) opts.port = Number(rest[++i]) || 4321;
    else if (a === '--clients' && rest[i + 1]) opts.clients = rest[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--brief' && rest[i + 1]) opts.brief = rest[++i];
    else if (a === '--scope' && rest[i + 1]) opts.scope = rest[++i];
    else if (a === '--preset' && rest[i + 1]) opts.preset = rest[++i];
    else if (a === '--subject' && rest[i + 1]) opts.subject = rest[++i];
    else if (a === '--keep-pose') opts.keepPose = true;
    else if (a === '--keep-wardrobe') opts.keepWardrobe = true;
    else if (a === '--keep-background') opts.keepBackground = true;
    else if (a === '--keep-framing') opts.keepFraming = true;
    else if (a === '--json') opts.json = true;
    else if (!a.startsWith('-')) opts.positional.push(a);
  }
  return opts;
}

function printUsage() {
  console.log([
    'Usage: ai-photo-studio <command> [options]',
    '',
    'Commands:',
    '  auto <imagePath>     Run 8-agent Autonomous Mode (triages photo, proposes 3 concepts, compiles prompts)',
    '  direct <imagePath>   Run 8-agent Directed Mode following --brief and optional --scope / --keep-* locks',
    '  web                  Start Local Web Studio Workbench (default port 4321)',
    '  mcp                  Start stdio MCP Server',
    '  crew                 Print the 8 specialist crew roles',
    '  presets              Print all production presets and executors',
    '  install              Install MCP + SKILL.md across Codex, Gemini CLI, Claude Code, Claude Desktop',
    '  status               Check MCP + Skill installation status',
    '',
    'Options:',
    '  --brief "..."        Exact art direction order for direct mode',
    '  --scope <scope>      subtle-retouch | targeted-edit | full-editorial',
    '  --preset <id>        Preset override',
    '  --subject <type>     auto | portrait | couple | product | night | outdoor | executive',
    '  --keep-pose          Lock original pose & expression',
    '  --keep-wardrobe      Lock original clothing & accessories',
    '  --keep-background    Lock original background',
    '  --keep-framing       Lock original camera framing',
    '  --port <num>         Web UI port (default 4321)',
    '  --clients <list>     Comma-separated client ids',
    '  --json               Emit raw JSON output'
  ].join('\n'));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.cmd === 'help' || opts.cmd === '--help' || opts.cmd === '-h') {
    printUsage();
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

  if (opts.cmd === 'presets') {
    console.log(JSON.stringify({ presets: Object.values(STUDIO_PRESETS), executors: detectAvailableExecutors() }, null, 2));
    return;
  }

  if (opts.cmd === 'status') {
    console.log(JSON.stringify(checkStudioStatus(), null, 2));
    return;
  }

  if (opts.cmd === 'install') {
    console.log(JSON.stringify(installStudioClients({ clientIds: opts.clients }), null, 2));
    return;
  }

  if (opts.cmd === 'auto') {
    const imagePath = opts.positional[0];
    if (!imagePath) throw new Error('Missing <imagePath>. Usage: ai-photo-studio auto <imagePath>');
    const store = new StudioStore(defaultStudioHome());
    const created = store.createJobFromFile({ imagePath, mode: 'autonomous', subjectHint: opts.subject });
    const job = store.runAutonomous(created.id, { subjectHint: opts.subject });
    if (opts.json) {
      console.log(JSON.stringify(job, null, 2));
      return;
    }
    console.log(`Job ${job.id} [AUTONOMOUS | ${job.subjectType} | ${job.interventionScope}]`);
    console.log(`Selected Proposal: ${job.selectedProposalId} (${job.preset})`);
    console.log('Proposals:', job.proposals.map((p) => `${p.id}: ${p.label}`).join(' | '));
    console.log('\n--- Codex Prompt ---\n' + job.promptPacks.codexPrompt);
    return;
  }

  if (opts.cmd === 'direct') {
    const imagePath = opts.positional[0];
    if (!imagePath) throw new Error('Missing <imagePath>. Usage: ai-photo-studio direct <imagePath> --brief "..."');
    if (!opts.brief) throw new Error('Missing --brief "...". Directed mode requires an art direction order.');
    const store = new StudioStore(defaultStudioHome());
    const locks = {
      keepPose: opts.keepPose,
      keepWardrobe: opts.keepWardrobe,
      keepBackground: opts.keepBackground,
      keepFraming: opts.keepFraming
    };
    const created = store.createJobFromFile({
      imagePath,
      mode: 'directed',
      brief: opts.brief,
      scope: opts.scope,
      preset: opts.preset,
      locks,
      subjectHint: opts.subject
    });
    const job = store.runDirected(created.id, {
      brief: opts.brief,
      scope: opts.scope,
      preset: opts.preset,
      locks,
      subjectHint: opts.subject
    });
    if (opts.json) {
      console.log(JSON.stringify(job, null, 2));
      return;
    }
    console.log(`Job ${job.id} [DIRECTED | ${job.interventionScope} | ${job.preset}]`);
    console.log('\n--- Codex Prompt ---\n' + job.promptPacks.codexPrompt);
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

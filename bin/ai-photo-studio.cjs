#!/usr/bin/env node
'use strict';

const { getCrewList, STUDIO_PRESETS } = require('../lib/crew.cjs');
const { listCraftCatalog, researchPhotographyTechniques } = require('../lib/craft-research.cjs');
const { StudioStore, defaultStudioHome } = require('../lib/store.cjs');
const { createStudioWebServer } = require('../lib/studio-web.cjs');
const { installStudioClients, checkStudioStatus } = require('../lib/installers.cjs');
const { detectAvailableExecutors, analyzeAnchorWithVision } = require('../lib/executors.cjs');

function parseArgs(argv) {
  const [cmd = 'help', ...rest] = argv;
  if (cmd.startsWith('-') && cmd !== '--help' && cmd !== '-h') throw new Error('Unknown option: ' + cmd);
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
    count: 5,
    analyze: false,
    keepPose: false,
    keepWardrobe: false,
    keepBackground: false,
    keepFraming: false,
    pose: null,
    camera: null,
    lens: null,
    effects: [],
    makeup: null,
    lighting: null,
    research: null,
    category: 'all',
    offline: false
  };
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    const valueFlags = ['--port', '--clients', '--brief', '--scope', '--preset', '--subject', '--count', '--pose', '--camera', '--lens', '--effect', '--makeup', '--lighting', '--research', '--category'];
    if (valueFlags.includes(a) && (!rest[i + 1] || (rest[i + 1].startsWith('--') || rest[i + 1] === '-h'))) throw new Error('Missing value for option: ' + a);
    if (a === '--port') {
      opts.port = Number(rest[++i]);
      if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) throw new Error('Invalid --port: expected an integer from 1 to 65535.');
    }
    else if (a === '--clients' && rest[i + 1]) opts.clients = rest[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--brief' && rest[i + 1]) opts.brief = rest[++i];
    else if (a === '--scope' && rest[i + 1]) opts.scope = rest[++i];
    else if (a === '--preset' && rest[i + 1]) opts.preset = rest[++i];
    else if (a === '--subject' && rest[i + 1]) opts.subject = rest[++i];
    else if (a === '--count' && rest[i + 1]) opts.count = Number(rest[++i]) || 5;
    else if (a === '--pose' && rest[i + 1]) opts.pose = rest[++i];
    else if (a === '--camera' && rest[i + 1]) opts.camera = rest[++i];
    else if (a === '--lens' && rest[i + 1]) opts.lens = rest[++i];
    else if (a === '--effect' && rest[i + 1]) opts.effects = rest[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--makeup' && rest[i + 1]) opts.makeup = rest[++i];
    else if (a === '--lighting' && rest[i + 1]) opts.lighting = rest[++i];
    else if (a === '--research' && rest[i + 1]) opts.research = rest[++i];
    else if (a === '--category' && rest[i + 1]) opts.category = rest[++i];
    else if (a === '--offline') opts.offline = true;
    else if (a === '--analyze') opts.analyze = true;
    else if (a === '--keep-pose') opts.keepPose = true;
    else if (a === '--keep-wardrobe') opts.keepWardrobe = true;
    else if (a === '--keep-background') opts.keepBackground = true;
    else if (a === '--keep-framing') opts.keepFraming = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.cmd = 'help';
    else if (!a.startsWith('-')) opts.positional.push(a);
    else throw new Error('Unknown option: ' + a);
  }
  return opts;
}

function buildCraftOptions(opts) {
  const out = {};
  if (opts.pose) out.poseId = opts.pose;
  if (opts.camera) out.cameraId = opts.camera;
  if (opts.lens) out.lensId = opts.lens;
  if (opts.effects && opts.effects.length) out.effectIds = opts.effects;
  if (opts.makeup) out.makeupId = opts.makeup;
  if (opts.lighting) out.lightingId = opts.lighting;
  if (opts.research) out.researchQuery = opts.research;
  return Object.keys(out).length ? out : null;
}

function printUsage() {
  console.log([
    'Usage: ai-photo-studio <command> [options]',
    '',
    'Commands:',
    '  auto <imagePath>     Run 8-agent Autonomous Mode (auto-crops tall screenshots, proposes 3 concepts)',
    '  direct <imagePath>   Run 8-agent Directed Mode following --brief and optional --scope / --keep-* locks',
    '  essay <imagePath>    Plan & compile a cohesive multi-shot Photo Essay (2-6 frames, default 5)',
    '  research <query>     Research poses, cameras, lenses, optical effects, makeup, and cinema trailer styles',
    '  catalog [category]   List curated craft items (poses|cameras|lenses|effects|makeup|lighting|presets)',
    '  web                  Start Local Web Studio Workbench (default port 4321)',
    '  mcp                  Start stdio MCP Server',
    '  crew                 Print the 8 specialist crew roles',
    '  presets              Print all production presets and executors',
    '  install              Install MCP + SKILL.md across Codex, Gemini CLI, Claude Code, Claude Desktop',
    '  status               Check MCP + Skill installation status',
    '',
    'Options:',
    '  --count <2-6>        Number of frames for essay mode (default 5)',
    '  --analyze            Run optional BYOK vision analysis (GEMINI_API_KEY / OPENAI_API_KEY) before compiling',
    '  --brief "..."        Exact art direction order for direct or essay mode',
    '  --scope <scope>      subtle-retouch | targeted-edit | full-editorial',
    '  --preset <id>        Preset override (incl. cinema-trailer, high-fashion-beauty, street-flash-editorial)',
    '  --subject <type>     auto | portrait | couple | product | night | outdoor | executive',
    '  --pose <id>          Pose ID from craft catalog',
    '  --camera <id>        Camera/emulsion ID from craft catalog',
    '  --lens <id>          Lens ID from craft catalog',
    '  --effect <id,...>    Comma-separated optical filter/effect IDs',
    '  --makeup <id>        Makeup/grooming ID from craft catalog',
    '  --lighting <id>      Lighting rig ID from craft catalog',
    '  --research "<q>"     Enrich direction with live photography research',
    '  --offline            Disable live web lookup during research',
    '  --keep-pose          Lock original pose & expression',
    '  --keep-wardrobe      Lock original clothing & accessories',
    '  --keep-background    Lock original background',
    '  --keep-framing       Lock original camera framing',
    '  --port <num>         Web UI port (default 4321)',
    '  --clients <list>     Comma-separated client ids',
    '  --json               Emit raw JSON output'
  ].join('\n'));
}

async function runWithAnalysis(store, job, enabled, method, options) {
  if (!enabled) return store[method](job.id, options);
  const vision = await analyzeAnchorWithVision({ store, job });
  return store.applyVisionAnalysis(job.id, vision.analysis, vision.provider, { ...options, essayMode: method === 'runEssay' });
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

  if (opts.cmd === 'catalog') {
    const cat = opts.positional[0] || opts.category || 'all';
    if (cat === 'presets') {
      console.log(JSON.stringify({ presets: Object.values(STUDIO_PRESETS) }, null, 2));
      return;
    }
    const data = listCraftCatalog({ category: cat, subjectType: opts.subject === 'auto' ? null : opts.subject });
    console.log(JSON.stringify(cat === 'all' ? { ...data, presets: Object.values(STUDIO_PRESETS) } : data, null, 2));
    return;
  }

  if (opts.cmd === 'research') {
    const query = opts.positional.join(' ').trim() || opts.research || opts.brief;
    const store = new StudioStore(defaultStudioHome());
    const result = await researchPhotographyTechniques({
      query,
      category: opts.category || 'all',
      subjectType: opts.subject === 'auto' ? null : opts.subject,
      liveWeb: !opts.offline,
      studioHome: store.studioHome
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (opts.cmd === 'auto') {
    const imagePath = opts.positional[0];
    if (!imagePath) throw new Error('Missing <imagePath>. Usage: ai-photo-studio auto <imagePath>');
    const store = new StudioStore(defaultStudioHome());
    const craftOptions = buildCraftOptions(opts);
    const researchInsights = opts.research
      ? await researchPhotographyTechniques({ query: opts.research, liveWeb: !opts.offline, studioHome: store.studioHome })
      : null;
    const locks = { keepPose: opts.keepPose, keepWardrobe: opts.keepWardrobe, keepBackground: opts.keepBackground, keepFraming: opts.keepFraming };
    const created = store.createJobFromFile({ imagePath, mode: 'autonomous', brief: opts.brief, scope: opts.scope, preset: opts.preset, locks, subjectHint: opts.subject, craftOptions });
    let job = await runWithAnalysis(store, created, opts.analyze, 'runAutonomous', { mode: 'autonomous', brief: opts.brief, scope: opts.scope, preset: opts.preset, locks, subjectHint: opts.subject, craftOptions, researchInsights });
    if (opts.json) {
      console.log(JSON.stringify(job, null, 2));
      return;
    }
    console.log(`Job ${job.id} [AUTONOMOUS | ${job.subjectType} | ${job.directionSource}]${job.sourceImage.cropApplied ? ' [UI AUTO-CROPPED]' : ''}`);
    if (job.essenceAnalysis) console.log(`Essence: ${job.essenceAnalysis}`);
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
    const craftOptions = buildCraftOptions(opts);
    const researchInsights = opts.research
      ? await researchPhotographyTechniques({ query: opts.research, liveWeb: !opts.offline, studioHome: store.studioHome })
      : null;
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
      subjectHint: opts.subject,
      craftOptions
    });
    let job = await runWithAnalysis(store, created, opts.analyze, 'runDirected', {
      mode: 'directed',
      brief: opts.brief,
      scope: opts.scope,
      preset: opts.preset,
      locks,
      subjectHint: opts.subject,
      craftOptions,
      researchInsights
    });
    if (opts.json) {
      console.log(JSON.stringify(job, null, 2));
      return;
    }
    console.log(`Job ${job.id} [DIRECTED | ${job.interventionScope} | ${job.preset}]${job.sourceImage.cropApplied ? ' [UI AUTO-CROPPED]' : ''}`);
    console.log('\n--- Codex Prompt ---\n' + job.promptPacks.codexPrompt);
    return;
  }

  if (opts.cmd === 'essay') {
    const imagePath = opts.positional[0];
    if (!imagePath) throw new Error('Missing <imagePath>. Usage: ai-photo-studio essay <imagePath> [--count 5]');
    const store = new StudioStore(defaultStudioHome());
    const craftOptions = buildCraftOptions(opts);
    const researchInsights = opts.research
      ? await researchPhotographyTechniques({ query: opts.research, liveWeb: !opts.offline, studioHome: store.studioHome })
      : null;
    const created = store.createJobFromFile({
      imagePath,
      mode: 'directed',
      brief: opts.brief,
      subjectHint: opts.subject,
      craftOptions
    });
    let job = await runWithAnalysis(store, created, opts.analyze, 'runEssay', {
      mode: 'directed', scope: opts.scope, preset: opts.preset,
      count: opts.count,
      subjectHint: opts.subject,
      brief: opts.brief,
      craftOptions,
      researchInsights,
      locks: { keepWardrobe: !opts.brief || opts.keepWardrobe, keepPose: opts.keepPose, keepBackground: opts.keepBackground, keepFraming: opts.keepFraming }
    });
    if (opts.json) {
      console.log(JSON.stringify(job, null, 2));
      return;
    }
    console.log(`Job ${job.id} [ESSAY | ${job.essayCount} frames | ${job.subjectType} | ${job.essaySource}]${job.sourceImage.cropApplied ? ' [UI AUTO-CROPPED]' : ''}`);
    if (job.essaySource === 'offline-fallback') {
      console.log('Note: using offline fallback scenes; pass --analyze (with API key) or run inside an AI host with vision for bespoke essence-synthesized scenes.');
    }
    for (const f of job.essayFrames) {
      console.log(`  ${f.index}. ${f.title} (${f.lens}) — ${f.location}`);
    }
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

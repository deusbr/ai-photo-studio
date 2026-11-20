'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const { inspectImageFile, MAX_IMAGE_BYTES } = require('./image-meta.cjs');
const { prepareCleanAnchor } = require('./preprocess.cjs');
const { STUDIO_CREW, normalizeRoleId, resolvePreset, buildProductionPacks } = require('./crew.cjs');
const {
  runMultiAgentPipeline,
  evaluateQaScorecard,
  parseDirectedIntent,
  generateEssayPlan
} = require('./orchestrator.cjs');

const SAFE_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

function defaultStudioHome(home = os.homedir()) {
  return process.env.AI_PHOTO_STUDIO_HOME || path.join(home, '.ai-photo-studio');
}

function atomicWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function assertSafeId(jobId) {
  if (!SAFE_ID_RE.test(String(jobId || ''))) {
    throw new Error('Invalid jobId format.');
  }
}

function buildInitialJob({ id, meta, cleanInfo = null, fileNameOverride = null, preset, brief = '', mode = null, scope = null, locks = null }) {
  const cleanBrief = String(brief || '').trim();
  const resolvedMode = mode || (cleanBrief ? 'directed' : 'autonomous');
  const intent = cleanBrief ? parseDirectedIntent(cleanBrief, { scope, locks, preset }) : null;
  const resolvedPreset = resolvePreset(preset || intent?.recommendedPreset || 'editorial-portrait');
  const resolvedScope = scope || intent?.interventionScope || (resolvedPreset.id === 'subtle-retouch' ? 'subtle-retouch' : 'full-editorial');
  const resolvedLocks = {
    keepPose: Boolean(locks?.keepPose || intent?.locks?.keepPose || resolvedScope === 'subtle-retouch'),
    keepWardrobe: Boolean(locks?.keepWardrobe || intent?.locks?.keepWardrobe || resolvedScope === 'subtle-retouch'),
    keepBackground: Boolean(locks?.keepBackground || intent?.locks?.keepBackground || resolvedScope === 'subtle-retouch'),
    keepFraming: Boolean(locks?.keepFraming || intent?.locks?.keepFraming)
  };
  const now = new Date().toISOString();

  const job = {
    id,
    createdAt: now,
    updatedAt: now,
    status: 'intake',
    mode: resolvedMode,
    subjectType: intent?.subjectType || 'portrait',
    interventionScope: resolvedScope,
    locks: resolvedLocks,
    preset: resolvedPreset.id,
    presetName: resolvedPreset.name,
    userBrief: cleanBrief,
    proposals: [],
    selectedProposalId: null,
    essayMode: false,
    essayCount: 0,
    essayFrames: [],
    sourceImage: {
      ...meta,
      ...(fileNameOverride ? { fileName: fileNameOverride } : {}),
      assetName: path.basename(meta.path || `anchor.${meta.format || 'png'}`),
      cleanedAssetName: cleanInfo?.applied ? cleanInfo.assetName : null,
      cropApplied: Boolean(cleanInfo?.applied),
      cropDetails: cleanInfo || null
    },
    crewPasses: {
      'showrunner-director': {
        updatedAt: now,
        mode: resolvedMode,
        interventionScope: resolvedScope,
        preset: resolvedPreset.id,
        targetAspectRatio: meta.aspectRatio || '4:5',
        productionGoal: cleanBrief || `Upgrade source photo to ${resolvedPreset.name} standard`
      }
    },
    agentBoard: [],
    promptPacks: null,
    renders: [],
    qaScorecards: [],
    revisionCycle: 0
  };
  job.promptPacks = buildProductionPacks(job);
  return job;
}

class StudioStore {
  constructor(studioHome = defaultStudioHome()) {
    this.studioHome = path.resolve(studioHome);
    this.jobsDir = path.join(this.studioHome, 'jobs');
    fs.mkdirSync(this.jobsDir, { recursive: true });
  }

  jobDir(jobId) {
    assertSafeId(jobId);
    return path.join(this.jobsDir, jobId);
  }

  jobJsonPath(jobId) {
    return path.join(this.jobDir(jobId), 'job.json');
  }

  readJob(jobId) {
    const p = this.jobJsonPath(jobId);
    if (!fs.existsSync(p)) {
      throw new Error(`Studio job not found: ${jobId}`);
    }
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  writeJob(job) {
    job.updatedAt = new Date().toISOString();
    atomicWriteJson(this.jobJsonPath(job.id), job);
    return job;
  }

  listJobs() {
    if (!fs.existsSync(this.jobsDir)) return [];
    const entries = fs.readdirSync(this.jobsDir, { withFileTypes: true });
    const jobs = [];
    for (const e of entries) {
      if (!e.isDirectory() || !SAFE_ID_RE.test(e.name)) continue;
      const p = path.join(this.jobsDir, e.name, 'job.json');
      if (!fs.existsSync(p)) continue;
      try {
        jobs.push(JSON.parse(fs.readFileSync(p, 'utf8')));
      } catch {}
    }
    return jobs.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  }

  createJobFromFile({ imagePath, preset = null, brief = '', mode = null, scope = null, locks = null, subjectHint = 'auto', autoRun = false, autoCropScreenshot = true }) {
    const meta = inspectImageFile(imagePath);
    const id = `job_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const assetsDir = path.join(this.jobDir(id), 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    const ext = path.extname(meta.fileName) || `.${meta.format}`;
    const anchorAsset = `anchor${ext.toLowerCase()}`;
    const destAnchor = path.join(assetsDir, anchorAsset);
    fs.copyFileSync(meta.path, destAnchor);

    const cleanInfo = prepareCleanAnchor({
      sourcePath: destAnchor,
      assetsDir,
      meta,
      enabled: autoCropScreenshot
    });

    let job = buildInitialJob({
      id,
      meta: { ...meta, assetName: anchorAsset },
      cleanInfo,
      preset,
      brief,
      mode,
      scope,
      locks
    });
    job.sourceImage.assetName = anchorAsset;
    if (autoRun) {
      job = runMultiAgentPipeline(job, { mode: job.mode, scope, locks, preset, brief, subjectHint });
    }
    return this.writeJob(job);
  }

  createJobFromBuffer({ fileName, buffer, preset = null, brief = '', mode = null, scope = null, locks = null, subjectHint = 'auto', autoRun = false, autoCropScreenshot = true }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      throw new Error('Uploaded image buffer is empty or exceeds 25 MB.');
    }
    const cleanName = path.basename(String(fileName || 'photo.png')).replace(/[^A-Za-z0-9._-]/g, '_');
    const ext = path.extname(cleanName) || '.png';
    const id = `job_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const assetsDir = path.join(this.jobDir(id), 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const tempSource = path.join(assetsDir, `anchor${ext.toLowerCase()}`);
    fs.writeFileSync(tempSource, buffer);

    let meta;
    try {
      meta = inspectImageFile(tempSource);
    } catch (err) {
      fs.rmSync(this.jobDir(id), { recursive: true, force: true });
      throw err;
    }

    const cleanInfo = prepareCleanAnchor({
      sourcePath: tempSource,
      assetsDir,
      meta,
      enabled: autoCropScreenshot
    });

    let job = buildInitialJob({
      id,
      meta: { ...meta, assetName: path.basename(tempSource) },
      cleanInfo,
      fileNameOverride: cleanName,
      preset,
      brief,
      mode,
      scope,
      locks
    });
    job.sourceImage.assetName = path.basename(tempSource);
    if (autoRun) {
      job = runMultiAgentPipeline(job, { mode: job.mode, scope, locks, preset, brief, subjectHint });
    }
    return this.writeJob(job);
  }

  runAutonomous(jobId, options = {}) {
    const job = this.readJob(jobId);
    const orchestrated = runMultiAgentPipeline(job, { ...options, mode: 'autonomous' });
    return this.writeJob(orchestrated);
  }

  runDirected(jobId, options = {}) {
    const job = this.readJob(jobId);
    const brief = options.brief !== undefined ? String(options.brief).trim() : job.userBrief;
    if (!brief) {
      throw new Error('Directed mode requires a user brief / art direction order.');
    }
    job.userBrief = brief;
    const orchestrated = runMultiAgentPipeline(job, { ...options, brief, mode: 'directed' });
    return this.writeJob(orchestrated);
  }

  runEssay(jobId, options = {}) {
    const job = this.readJob(jobId);
    if (options.brief !== undefined) {
      job.userBrief = String(options.brief || '').trim();
    }
    const essayJob = generateEssayPlan(job, options);
    return this.writeJob(essayJob);
  }

  applyVisionAnalysis(jobId, analysis = {}, providerLabel = 'vision-analyzer') {
    const job = this.readJob(jobId);
    if (analysis.subjectType) job.subjectType = analysis.subjectType;
    const now = new Date().toISOString();
    job.crewPasses = job.crewPasses || {};
    job.crewPasses['forensic-analyst'] = {
      ...(job.crewPasses['forensic-analyst'] || {}),
      updatedAt: now,
      poseAndExpressionAudit: analysis.poseAndExpressionAudit || job.crewPasses['forensic-analyst']?.poseAndExpressionAudit,
      lightingShadowsAudit: analysis.lightingShadowsAudit || job.crewPasses['forensic-analyst']?.lightingShadowsAudit,
      correctionsSummary: analysis.correctionsSummary || job.crewPasses['forensic-analyst']?.correctionsSummary
    };
    job.crewPasses['consistency-guardian'] = {
      ...(job.crewPasses['consistency-guardian'] || {}),
      updatedAt: now,
      expressionTruth: analysis.expressionTruth || job.crewPasses['consistency-guardian']?.expressionTruth,
      garmentMicroDetails: analysis.garmentMicroDetails || job.crewPasses['consistency-guardian']?.garmentMicroDetails,
      antiBeautificationLocks: analysis.antiBeautificationLocks || job.crewPasses['consistency-guardian']?.antiBeautificationLocks
    };
    job.crewPasses['art-stylist'] = {
      ...(job.crewPasses['art-stylist'] || {}),
      updatedAt: now,
      locationOrBackdrop: analysis.recommendedLocation || job.crewPasses['art-stylist']?.locationOrBackdrop,
      artDirectionRationale: analysis.artDirectionRationale || job.crewPasses['art-stylist']?.artDirectionRationale
    };
    job.agentBoard = job.agentBoard || [];
    job.agentBoard.push({
      step: job.agentBoard.length + 1,
      agentId: 'forensic-analyst',
      agentHandle: `Analista Forense (${providerLabel})`,
      summary: `Visão automática extraiu expressão, roupa e cenário coerente (${job.subjectType}).`,
      timestamp: now
    });
    job.promptPacks = buildProductionPacks(job);
    if (job.essayMode && Array.isArray(job.essayFrames) && job.essayFrames.length) {
      const updatedEssay = generateEssayPlan(job, { count: job.essayCount || job.essayFrames.length, subjectHint: job.subjectType });
      return this.writeJob(updatedEssay);
    }
    return this.writeJob(job);
  }

  selectProposal(jobId, proposalId) {
    const job = this.readJob(jobId);
    const match = (job.proposals || []).find((p) => p.id === proposalId);
    if (!match) {
      throw new Error(`Proposal not found on job ${jobId}: ${proposalId}`);
    }
    const orchestrated = runMultiAgentPipeline(job, {
      mode: 'autonomous',
      proposalId: match.id,
      preset: match.preset,
      scope: match.interventionScope
    });
    return this.writeJob(orchestrated);
  }

  saveCrewPass(jobId, roleId, payload) {
    const canonicalRole = normalizeRoleId(roleId);
    if (!canonicalRole) {
      const valid = STUDIO_CREW.map((c) => c.id).join(', ');
      throw new Error(`Unknown crew role: ${roleId}. Valid roles: ${valid}`);
    }
    const job = this.readJob(jobId);
    job.crewPasses = job.crewPasses || {};
    const entry = {
      ...(payload && typeof payload === 'object' ? payload : { notes: String(payload || '') }),
      updatedAt: new Date().toISOString()
    };
    job.crewPasses[canonicalRole] = entry;
    job.agentBoard = job.agentBoard || [];
    const roleMeta = STUDIO_CREW.find((c) => c.id === canonicalRole);
    job.agentBoard.push({
      step: job.agentBoard.length + 1,
      agentId: canonicalRole,
      agentHandle: roleMeta?.agentHandle || canonicalRole,
      summary: entry.concept || entry.correctionsSummary || entry.lightingSetup || entry.notes || `Updated ${canonicalRole} pass.`,
      timestamp: entry.updatedAt
    });
    job.status = 'in-production';
    job.promptPacks = buildProductionPacks(job);
    return this.writeJob(job);
  }

  compilePrompts(jobId, presetOverride) {
    const job = this.readJob(jobId);
    if (presetOverride) {
      const resolved = resolvePreset(presetOverride);
      job.preset = resolved.id;
      job.presetName = resolved.name;
    }
    job.promptPacks = buildProductionPacks(job);
    job.status = 'ready-to-render';
    return this.writeJob(job);
  }

  registerRenderFromFile(jobId, imagePath, { engine = 'subscription', notes = '', parentVersion = null } = {}) {
    const job = this.readJob(jobId);
    const meta = inspectImageFile(imagePath);
    const version = (job.renders?.length || 0) + 1;
    const ext = path.extname(meta.fileName) || `.${meta.format}`;
    const assetName = `render_v${version}${ext.toLowerCase()}`;
    const assetsDir = path.join(this.jobDir(jobId), 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.copyFileSync(meta.path, path.join(assetsDir, assetName));

    const prevVersion = parentVersion !== null && parentVersion !== undefined
      ? Number(parentVersion)
      : (job.renders?.length ? job.renders[job.renders.length - 1].version : 0);

    const entry = {
      version,
      parentRenderVersion: prevVersion,
      sourceProposalId: job.selectedProposalId || null,
      engine: String(engine || 'subscription'),
      notes: String(notes || ''),
      createdAt: new Date().toISOString(),
      ...meta,
      assetName
    };
    job.renders = job.renders || [];
    job.renders.push(entry);
    job.status = 'awaiting-qa';
    return this.writeJob(job);
  }

  registerRenderFromBuffer(jobId, { fileName, buffer, engine = 'studio-web', notes = '', parentVersion = null }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
      throw new Error('Render image buffer is empty or exceeds 25 MB.');
    }
    const job = this.readJob(jobId);
    const version = (job.renders?.length || 0) + 1;
    const ext = path.extname(String(fileName || '.png')) || '.png';
    const assetName = `render_v${version}${ext.toLowerCase()}`;
    const assetsDir = path.join(this.jobDir(jobId), 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    const targetPath = path.join(assetsDir, assetName);
    fs.writeFileSync(targetPath, buffer);

    let meta;
    try {
      meta = inspectImageFile(targetPath);
    } catch (err) {
      fs.rmSync(targetPath, { force: true });
      throw err;
    }

    const prevVersion = parentVersion !== null && parentVersion !== undefined
      ? Number(parentVersion)
      : (job.renders?.length ? job.renders[job.renders.length - 1].version : 0);

    const entry = {
      version,
      parentRenderVersion: prevVersion,
      sourceProposalId: job.selectedProposalId || null,
      engine: String(engine || 'studio-web'),
      notes: String(notes || ''),
      createdAt: new Date().toISOString(),
      ...meta,
      assetName
    };
    job.renders = job.renders || [];
    job.renders.push(entry);
    job.status = 'awaiting-qa';
    return this.writeJob(job);
  }

  submitQa(jobId, scorecard) {
    const job = this.readJob(jobId);
    const evaluated = evaluateQaScorecard(scorecard);
    const latestRender = job.renders?.length ? job.renders[job.renders.length - 1] : null;
    const qaEntry = {
      ...evaluated,
      renderVersion: latestRender ? latestRender.version : 0,
      reviewedAt: new Date().toISOString()
    };
    job.qaScorecards = job.qaScorecards || [];
    job.qaScorecards.push(qaEntry);
    job.crewPasses['anti-ai-auditor'] = qaEntry;
    if (latestRender) {
      latestRender.qaVerdict = qaEntry.verdict;
      latestRender.qaOverallScore = qaEntry.overallScore;
    }

    job.agentBoard = job.agentBoard || [];
    job.agentBoard.push({
      step: job.agentBoard.length + 1,
      agentId: 'anti-ai-auditor',
      agentHandle: 'Auditor Anti-IA & Realismo',
      summary: qaEntry.verdict === 'pass'
        ? `QA APROVADO (score ${qaEntry.overallScore}/10): ${qaEntry.revisionNotes}`
        : `QA REVISÃO SOLICITADA (score ${qaEntry.overallScore}/10) -> Roteado para [${qaEntry.routeToRoles.join(', ')}]: ${qaEntry.revisionNotes}`,
      timestamp: qaEntry.reviewedAt
    });

    if (qaEntry.verdict === 'pass') {
      job.status = 'approved';
    } else {
      job.status = 'revision-requested';
      job.revisionCycle = (job.revisionCycle || 0) + 1;
    }
    job.promptPacks = buildProductionPacks(job);
    return this.writeJob(job);
  }

  rollbackToRender(jobId, version) {
    const job = this.readJob(jobId);
    const target = (job.renders || []).find((r) => r.version === Number(version));
    if (!target) {
      throw new Error(`Render version v${version} not found on job ${jobId}`);
    }
    job.activeRenderVersion = target.version;
    job.agentBoard = job.agentBoard || [];
    job.agentBoard.push({
      step: job.agentBoard.length + 1,
      agentId: 'showrunner-director',
      agentHandle: 'Diretor de Ensaio',
      summary: `Lineage rollback/branch selecionado para render v${target.version} (${target.assetName}).`,
      timestamp: new Date().toISOString()
    });
    return this.writeJob(job);
  }

  resolveAssetPath(jobId, assetName) {
    assertSafeId(jobId);
    const clean = path.basename(String(assetName || ''));
    if (!clean || clean !== assetName) {
      throw new Error('Invalid asset name.');
    }
    const full = path.join(this.jobDir(jobId), 'assets', clean);
    if (!fs.existsSync(full)) {
      throw new Error(`Asset not found: ${clean}`);
    }
    return full;
  }
}

module.exports = {
  defaultStudioHome,
  StudioStore
};

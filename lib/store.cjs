'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const { inspectImageFile, MAX_IMAGE_BYTES } = require('./image-meta.cjs');
const { STUDIO_CREW, resolvePreset, buildProductionPacks } = require('./crew.cjs');

const VALID_ROLES = new Set(STUDIO_CREW.map((c) => c.id));
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

  createJobFromFile({ imagePath, preset = 'editorial-portrait', brief = '' }) {
    const meta = inspectImageFile(imagePath);
    const resolvedPreset = resolvePreset(preset);
    const id = `job_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const dir = this.jobDir(id);
    const assetsDir = path.join(dir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    const ext = path.extname(meta.fileName) || `.${meta.format}`;
    const anchorAsset = `anchor${ext.toLowerCase()}`;
    fs.copyFileSync(meta.path, path.join(assetsDir, anchorAsset));

    const now = new Date().toISOString();
    const job = {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'intake',
      preset: resolvedPreset.id,
      presetName: resolvedPreset.name,
      userBrief: String(brief || '').trim(),
      sourceImage: {
        ...meta,
        assetName: anchorAsset
      },
      crewPasses: {
        'executive-producer': {
          updatedAt: now,
          preset: resolvedPreset.id,
          targetAspectRatio: meta.aspectRatio || '4:5',
          productionGoal: String(brief || '').trim() || `Upgrade source photo to ${resolvedPreset.name} standard`
        }
      },
      promptPacks: null,
      renders: [],
      qaScorecards: []
    };

    job.promptPacks = buildProductionPacks(job);
    return this.writeJob(job);
  }

  createJobFromBuffer({ fileName, buffer, preset = 'editorial-portrait', brief = '' }) {
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

    const resolvedPreset = resolvePreset(preset);
    const now = new Date().toISOString();
    const job = {
      id,
      createdAt: now,
      updatedAt: now,
      status: 'intake',
      preset: resolvedPreset.id,
      presetName: resolvedPreset.name,
      userBrief: String(brief || '').trim(),
      sourceImage: {
        ...meta,
        fileName: cleanName,
        assetName: path.basename(tempSource)
      },
      crewPasses: {
        'executive-producer': {
          updatedAt: now,
          preset: resolvedPreset.id,
          targetAspectRatio: meta.aspectRatio || '4:5',
          productionGoal: String(brief || '').trim() || `Upgrade source photo to ${resolvedPreset.name} standard`
        }
      },
      promptPacks: null,
      renders: [],
      qaScorecards: []
    };

    job.promptPacks = buildProductionPacks(job);
    return this.writeJob(job);
  }

  saveCrewPass(jobId, roleId, payload) {
    if (!VALID_ROLES.has(roleId)) {
      throw new Error(`Unknown crew role: ${roleId}. Valid roles: ${Array.from(VALID_ROLES).join(', ')}`);
    }
    const job = this.readJob(jobId);
    job.crewPasses = job.crewPasses || {};
    job.crewPasses[roleId] = {
      ...(payload && typeof payload === 'object' ? payload : { notes: String(payload || '') }),
      updatedAt: new Date().toISOString()
    };
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

  registerRenderFromFile(jobId, imagePath, { engine = 'subscription', notes = '' } = {}) {
    const job = this.readJob(jobId);
    const meta = inspectImageFile(imagePath);
    const version = (job.renders?.length || 0) + 1;
    const ext = path.extname(meta.fileName) || `.${meta.format}`;
    const assetName = `render_v${version}${ext.toLowerCase()}`;
    const assetsDir = path.join(this.jobDir(jobId), 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.copyFileSync(meta.path, path.join(assetsDir, assetName));

    const entry = {
      version,
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

  registerRenderFromBuffer(jobId, { fileName, buffer, engine = 'studio-web', notes = '' }) {
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

    const entry = {
      version,
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
    const qaEntry = {
      ...(scorecard && typeof scorecard === 'object' ? scorecard : {}),
      reviewedAt: new Date().toISOString()
    };
    job.qaScorecards = job.qaScorecards || [];
    job.qaScorecards.push(qaEntry);
    job.crewPasses['colorist-qa'] = qaEntry;
    job.status = qaEntry.verdict === 'pass' ? 'approved' : 'revision-requested';
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
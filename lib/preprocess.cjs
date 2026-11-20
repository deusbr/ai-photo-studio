'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { inspectImageFile, classifyImageGeometry } = require('./image-meta.cjs');

function detectScreenshotCropBox(meta = {}) {
  const geo = classifyImageGeometry(meta);
  if (!geo.isTallMobileScreenshot || !meta.width || !meta.height) {
    return null;
  }
  const top = Math.round(meta.height * 0.22);
  const cropHeight = Math.max(200, Math.round(meta.height * 0.59));
  return {
    left: 0,
    top,
    width: meta.width,
    height: Math.min(cropHeight, meta.height - top),
    reason: 'tall-mobile-screenshot-strip-ui'
  };
}

function runWindowsCrop({ inputPath, outputPath, box, execFileSyncImpl = execFileSync }) {
  const psScript = [
    "$ProgressPreference = 'SilentlyContinue'",
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Drawing',
    '$bmp = [System.Drawing.Bitmap]::FromFile($env:APS_CROP_IN)',
    'try {',
    '  $rect = New-Object System.Drawing.Rectangle([int]$env:APS_CROP_X, [int]$env:APS_CROP_Y, [int]$env:APS_CROP_W, [int]$env:APS_CROP_H)',
    '  $crop = $bmp.Clone($rect, $bmp.PixelFormat)',
    '  try {',
    '    $ext = [System.IO.Path]::GetExtension($env:APS_CROP_OUT).ToLowerInvariant()',
    '    $fmt = if ($ext -eq ".png") { [System.Drawing.Imaging.ImageFormat]::Png } else { [System.Drawing.Imaging.ImageFormat]::Jpeg }',
    '    $crop.Save($env:APS_CROP_OUT, $fmt)',
    '  } finally { $crop.Dispose() }',
    '} finally { $bmp.Dispose() }'
  ].join('; ');
  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  execFileSyncImpl(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    {
      shell: false,
      windowsHide: true,
      timeout: 15000,
      env: {
        ...process.env,
        APS_CROP_IN: inputPath,
        APS_CROP_OUT: outputPath,
        APS_CROP_X: String(box.left),
        APS_CROP_Y: String(box.top),
        APS_CROP_W: String(box.width),
        APS_CROP_H: String(box.height)
      }
    }
  );
}

function runMacOsCrop({ inputPath, outputPath, box, execFileSyncImpl = execFileSync }) {
  fs.copyFileSync(inputPath, outputPath);
  execFileSyncImpl(
    'sips',
    ['-c', String(box.height), String(box.width), '--cropOffset', String(box.top), String(box.left), outputPath],
    { shell: false, timeout: 15000 }
  );
}

function prepareCleanAnchor({
  sourcePath,
  assetsDir,
  meta,
  enabled = true,
  platform = process.platform,
  execFileSyncImpl = execFileSync
}) {
  if (!enabled) return { applied: false, reason: 'disabled' };
  const box = detectScreenshotCropBox(meta);
  if (!box) return { applied: false, reason: 'not-tall-mobile-screenshot' };

  const ext = path.extname(sourcePath).toLowerCase() === '.png' ? '.png' : '.jpg';
  const cleanName = `anchor_clean${ext}`;
  const outPath = path.join(assetsDir, cleanName);

  try {
    if (platform === 'win32') {
      runWindowsCrop({ inputPath: sourcePath, outputPath: outPath, box, execFileSyncImpl });
    } else if (platform === 'darwin') {
      runMacOsCrop({ inputPath: sourcePath, outputPath: outPath, box, execFileSyncImpl });
    } else {
      return { applied: false, reason: `no-native-cropper-on-${platform}`, box };
    }
    const cleanMeta = inspectImageFile(outPath);
    return {
      applied: true,
      assetName: cleanName,
      path: outPath,
      width: cleanMeta.width,
      height: cleanMeta.height,
      aspectRatio: cleanMeta.aspectRatio,
      box
    };
  } catch (err) {
    if (fs.existsSync(outPath)) {
      try { fs.rmSync(outPath, { force: true }); } catch {}
    }
    return { applied: false, reason: err.message, box };
  }
}

module.exports = {
  detectScreenshotCropBox,
  prepareCleanAnchor
};

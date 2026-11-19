'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function parsePngDimensions(buf) {
  if (buf.length < 24) return null;
  const sig = '89504e470d0a1a0a';
  if (buf.subarray(0, 8).toString('hex') !== sig) return null;
  return {
    format: 'png',
    mimeType: 'image/png',
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20)
  };
}

function parseJpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) break;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 9 <= buf.length) {
      return {
        format: 'jpeg',
        mimeType: 'image/jpeg',
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + segLen;
  }
  return { format: 'jpeg', mimeType: 'image/jpeg', width: null, height: null };
}

function parseWebpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF' || buf.subarray(8, 12).toString('ascii') !== 'WEBP') {
    return null;
  }
  const chunk = buf.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X' && buf.length >= 30) {
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { format: 'webp', mimeType: 'image/webp', width, height };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { format: 'webp', mimeType: 'image/webp', width, height };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { format: 'webp', mimeType: 'image/webp', width, height };
  }
  return { format: 'webp', mimeType: 'image/webp', width: null, height: null };
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Inspects a local image file safely (rejecting symlinks and oversized files) and extracts dimensions and SHA-256.
 * @param {string} filePath
 */
function inspectImageFile(filePath) {
  const abs = path.resolve(String(filePath || ''));
  if (!abs || !fs.existsSync(abs)) {
    throw new Error(`Image file not found: ${abs}`);
  }
  const st = fs.lstatSync(abs);
  if (st.isSymbolicLink()) {
    throw new Error(`Symlink image targets are rejected for safety: ${abs}`);
  }
  if (!st.isFile() || st.size === 0 || st.size > MAX_IMAGE_BYTES) {
    throw new Error(`Invalid or oversized image file (max 25 MB): ${abs}`);
  }

  const ext = path.extname(abs).toLowerCase();
  const buf = fs.readFileSync(abs);
  const parsed = parsePngDimensions(buf) || parseJpegDimensions(buf) || parseWebpDimensions(buf);
  if (!parsed && !SUPPORTED_EXTS.has(ext)) {
    throw new Error(`Unsupported image format (${ext || 'unknown'}). Use PNG, JPEG, or WebP.`);
  }

  const info = parsed || {
    format: ext.replace('.', '') || 'unknown',
    mimeType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
    width: null,
    height: null
  };

  let orientation = 'unknown';
  let aspectRatio = null;
  if (info.width && info.height) {
    orientation = info.width > info.height ? 'landscape' : info.height > info.width ? 'portrait' : 'square';
    const d = gcd(info.width, info.height);
    aspectRatio = `${info.width / d}:${info.height / d}`;
  }

  return {
    path: abs,
    fileName: path.basename(abs),
    sizeBytes: st.size,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    format: info.format,
    mimeType: info.mimeType,
    width: info.width,
    height: info.height,
    orientation,
    aspectRatio
  };
}

module.exports = {
  MAX_IMAGE_BYTES,
  parsePngDimensions,
  parseJpegDimensions,
  parseWebpDimensions,
  inspectImageFile
};
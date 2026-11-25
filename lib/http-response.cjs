'use strict';

const { performance } = require('node:perf_hooks');
const MAX_TIMER_MS = 2_147_483_647;

async function withHttpResponse(fetchImpl, url, init, { timeoutMs, label, deadline = Infinity }, consume) {
  const startedAt = performance.now();
  const requestDeadline = Math.min(deadline, startedAt + Math.min(timeoutMs, MAX_TIMER_MS));
  const remaining = Math.ceil(requestDeadline - startedAt);
  const timeoutError = new Error('Request to ' + label + ' timed out after ' + remaining + 'ms.');
  if (remaining <= 0) throw timeoutError;

  const controller = new AbortController();
  const { signal } = controller;
  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  function checkDeadline() {
    if (performance.now() >= requestDeadline) controller.abort(timeoutError);
    signal.throwIfAborted();
  }

  const timer = setTimeout(() => controller.abort(timeoutError), remaining);
  let response;
  try {
    checkDeadline();
    response = await fetchImpl(url, { ...init, signal });
    checkDeadline();
    const result = await consume(response, { signal, checkDeadline });
    checkDeadline();
    return result;
  } catch (err) {
    if (signal.aborted) throw signal.reason;
    throw err;
  } finally {
    // Cancel responses whose bodies were intentionally skipped (status-only and error paths).
    if (response?.body && !response.bodyUsed && !response.body.locked) {
      void response.body.cancel().catch(() => {});
    }
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

async function readBoundedBody(response, maxBytes, label, { signal, checkDeadline }) {
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  let buffer = Buffer.alloc(0);
  let bytesRead = 0;
  let complete = false;

  try {
    checkDeadline();
    while (true) {
      const { done, value } = await reader.read();
      checkDeadline();
      if (done) {
        complete = true;
        break;
      }
      // Fetch delivers decompressed bytes. Content-Length can refer to the compressed body.
      const nextSize = bytesRead + value.byteLength;
      if (nextSize > maxBytes) throw new Error(label + ' response exceeds ' + maxBytes + ' bytes.');
      if (nextSize > buffer.length) {
        const capacity = Math.min(maxBytes, Math.max(nextSize, 4096, buffer.length * 2));
        const grown = Buffer.allocUnsafe(capacity);
        buffer.copy(grown, 0, 0, bytesRead);
        buffer = grown;
      }
      buffer.set(value, bytesRead);
      bytesRead = nextSize;
    }
    return buffer.subarray(0, bytesRead);
  } finally {
    signal.removeEventListener('abort', cancel);
    if (!complete) cancel();
    reader.releaseLock();
  }
}

module.exports = { withHttpResponse, readBoundedBody };

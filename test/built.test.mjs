import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { test } from 'node:test';
import { defaultInput, simulate } from '../dist/index.js';
import { createEngineClient } from '../dist/client.js';

test('built library and built worker return identical results', async () => {
  const worker = new Worker(new URL('./fixtures/node-worker.mjs', import.meta.url), {
    workerData: { entry: new URL('../dist/worker.js', import.meta.url).href },
  });
  try {
    await once(worker, 'message');
    const input = defaultInput(); input.paths = 500;
    const response = once(worker, 'message');
    worker.postMessage({ id: 1, input });
    const [message] = await response;
    assert.deepEqual(message.result, simulate(input));
  } finally { await worker.terminate(); }
});

test('built client resolves its emitted worker asset relative to the package', async () => {
  class BrowserWorkerAdapter {
    onmessage = null;
    onerror = null;
    onmessageerror = null;
    constructor(url) {
      assert.ok(url.href.startsWith(new URL('../dist/assets/', import.meta.url).href));
      this.thread = new Worker(new URL('./fixtures/node-worker.mjs', import.meta.url), {
        workerData: { entry: url.href },
      });
      this.thread.on('message', data => this.onmessage?.({ data }));
      this.thread.on('error', error => this.onerror?.({ message: error.message }));
    }
    postMessage(message) { this.thread.postMessage(message); }
    terminate() { void this.thread.terminate(); }
  }
  globalThis.Worker = BrowserWorkerAdapter;
  const client = createEngineClient();
  try {
    const input = defaultInput(); input.paths = 500;
    const old = client.run(input);
    const rejection = assert.rejects(old, { name: 'AbortError' });
    const result = await client.run(input);
    await rejection;
    assert.deepEqual(result, simulate(input));
  } finally {
    client.dispose();
    delete globalThis.Worker;
  }
});

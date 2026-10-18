import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import { defaultInput } from '../dist/index.js';
import { createEngineClient } from '../dist/client.js';

// Runs the emitted browser worker through the same message-port adapter as the smoke test.
class BrowserWorkerAdapter {
  onmessage = null;
  onerror = null;
  onmessageerror = null;
  constructor(url) {
    this.thread = new Worker(new URL('./fixtures/node-worker.mjs', import.meta.url), { workerData: { entry: url.href } });
    this.thread.on('message', data => this.onmessage?.({ data }));
    this.thread.on('error', error => this.onerror?.({ message: error.message }));
  }
  postMessage(message) { this.thread.postMessage(message); }
  terminate() { void this.thread.terminate(); }
}
globalThis.Worker = BrowserWorkerAdapter;
console.log(`${process.version} · ${cpus()[0].model} · elapsed includes postMessage round trip`);
for (const years of [14, 15]) {
  const client = createEngineClient();
  const input = defaultInput(); input.endAge = input.startAge + years;
  try {
    const start = performance.now();
    await client.run(input);
    const cold = performance.now() - start;
    const samples = [];
    for (let i = 0; i < 30; i++) {
      input.savingsPlan.monthly = i % 2 ? 200 : 210;
      const t = performance.now();
      await client.run(input);
      samples.push(performance.now() - t);
    }
    samples.sort((a, b) => a - b);
    console.log(JSON.stringify({ years, paths: input.paths, coldMs: +cold.toFixed(2),
      warmMedianMs: +((samples[14] + samples[15]) / 2).toFixed(2), warmP95Ms: +samples[28].toFixed(2) }));
  } finally { client.dispose(); }
}
delete globalThis.Worker;

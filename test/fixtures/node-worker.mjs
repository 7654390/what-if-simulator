import { parentPort, workerData } from 'node:worker_threads';

// Browser message-port adapter; the engine and its worker entry remain unchanged.
if (workerData.entry.endsWith('.ts')) {
  const { register } = await import('tsx/esm/api');
  register();
}
globalThis.self = {
  onmessage: null,
  postMessage(message) { parentPort.postMessage(message); },
};
await import(workerData.entry);
parentPort.on('message', data => globalThis.self.onmessage?.({ data }));
parentPort.postMessage({ ready: true });

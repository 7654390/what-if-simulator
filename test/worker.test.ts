import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';
import { simulate } from '../src/simulate.js';
import { defaultInput } from '../src/defaults.js';
import { installWorker } from '../src/worker.js';
import { diff } from '../src/index.js';
import { quiet } from './helpers.js';

describe('worker protocol and public API', () => {
  it('executes the actual entry in an isolated Node worker and transfers plain results', async () => {
    const worker = new Worker(new URL('./fixtures/node-worker.mjs', import.meta.url), {
      workerData: { entry: new URL('../src/worker.ts', import.meta.url).href },
    });
    try {
      await once(worker, 'message');
      const input = defaultInput(); input.paths = 500;
      const response = once(worker, 'message');
      worker.postMessage({ id: 42, input });
      const [message] = await response;
      expect(message.id).toBe(42);
      expect(message.result).toEqual(simulate(input));
      const failure = once(worker, 'message');
      worker.postMessage({ id: 43, input: null });
      expect((await failure)[0]).toMatchObject({ id: 43, error: 'Eingabe muss ein Objekt sein' });
    } finally { await worker.terminate(); }
  });
  it('ignores malformed envelopes', () => {
    const port = { onmessage: null, postMessage: () => { throw new Error('unexpected'); } };
    installWorker(port);
    const handle = port.onmessage as unknown as (event: { data: unknown }) => void;
    handle({ data: null }); handle({ data: {} });
  });
  it('computes b minus a and rejects incompatible comparisons', () => {
    const input = quiet(); const a = simulate(input);
    input.start.cash = 100;
    const b = simulate(input);
    expect(diff(a, b)).toEqual({ medianDeltaAtEnd: 100,
      bandsDelta: Object.fromEntries([5, 25, 50, 75, 95].map(p => [p, [100, 100]])) });
    b.meta.outputMode = 'nominal'; expect(() => diff(a, b)).toThrow('Ausgabemodus');
    b.meta.outputMode = 'real'; b.ages.pop(); expect(() => diff(a, b)).toThrow('Altersraster');
  });
});

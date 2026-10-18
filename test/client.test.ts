import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEngineClient } from '../src/client.js';
import type { EngineClient } from '../src/client.js';
import { simulate } from '../src/simulate.js';
import { quiet } from './helpers.js';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  requests: { id: number; input: ReturnType<typeof quiet> }[] = [];
  constructor() { FakeWorker.instances.push(this); }
  postMessage(request: { id: number; input: ReturnType<typeof quiet> }) { this.requests.push(structuredClone(request)); }
  terminate() { this.terminated = true; }
  reply() {
    const request = this.requests.at(-1)!;
    this.onmessage?.({ data: { id: request.id, result: simulate(request.input) } });
  }
  error(message: string) { this.onmessage?.({ data: { id: this.requests.at(-1)!.id, error: message } }); }
}

let client: EngineClient;
beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  client = createEngineClient();
});
afterEach(() => { client.dispose(); vi.unstubAllGlobals(); });

describe('worker client', () => {
  it('terminates in-flight work and rejects superseded promises without queueing', async () => {
    const first = client.run(quiet());
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const staleHandler = FakeWorker.instances[0].onmessage;
    const staleError = FakeWorker.instances[0].onerror;
    const second = client.run(quiet());
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
    staleHandler?.({ data: { id: 1, error: 'stale' } });
    staleError?.({ message: 'stale crash' });
    FakeWorker.instances[1].reply();
    await rejected;
    expect(await second).toEqual(simulate(quiet()));
  });
  it('reuses an idle worker and ignores mismatched response IDs', async () => {
    const first = client.run(quiet()); FakeWorker.instances[0].reply(); await first;
    const second = client.run(quiet());
    FakeWorker.instances[0].onmessage?.({ data: { id: 999, error: 'falsch' } });
    FakeWorker.instances[0].reply(); await second;
    expect(FakeWorker.instances).toHaveLength(1);
  });
  it('emits a 1000-path preview, then full resolution from a stable input snapshot', async () => {
    const input = quiet(); input.paths = 1500;
    const callback = vi.fn();
    client.runProgressive(input, callback);
    input.start.cash = 100;
    expect(FakeWorker.instances[0].requests[0].input.paths).toBe(1000);
    FakeWorker.instances[0].reply();
    await vi.waitFor(() => expect(FakeWorker.instances[0].requests).toHaveLength(2));
    expect(callback.mock.calls[0][1]).toBe(false);
    FakeWorker.instances[0].reply();
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(2));
    expect(callback.mock.calls[1][1]).toBe(true);
    expect(callback.mock.calls[1][0].meta.paths).toBe(1500);
    expect(callback.mock.calls[1][0].summary.medianAtEnd).toBe(0);
  });
  it('cancels without callbacks and prevents obsolete cancellation from aborting new work', async () => {
    const callback = vi.fn(); const cancel = client.runProgressive(quiet(), callback);
    const run = client.run(quiet()); cancel();
    FakeWorker.instances.at(-1)!.reply(); await run;
    expect(callback).not.toHaveBeenCalled();
    const cancelSecond = client.runProgressive(quiet(), callback); cancelSecond();
    await Promise.resolve();
    expect(FakeWorker.instances.at(-1)!.terminated).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });
  it('cancels full resolution when cancellation occurs after preview', async () => {
    const input = quiet(); input.paths = 1500;
    const callback = vi.fn(); const cancel = client.runProgressive(input, callback);
    FakeWorker.instances[0].reply();
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
    cancel();
    expect(FakeWorker.instances[0].terminated).toBe(true);
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
  });
  it('reports progressive failures through the optional error callback', async () => {
    const callback = vi.fn(); const onError = vi.fn();
    client.runProgressive(quiet(), callback, onError);
    FakeWorker.instances[0].error('Ungültige Eingabe');
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].message).toBe('Ungültige Eingabe');
    expect(callback).not.toHaveBeenCalled();
  });
  it('rejects worker crashes, deserialization failures and startup failures', async () => {
    const run = client.run(quiet());
    FakeWorker.instances[0].onerror?.({ message: 'Crash' });
    await expect(run).rejects.toThrow('Crash');
    const another = client.run(quiet());
    FakeWorker.instances[1].onmessageerror?.();
    await expect(another).rejects.toThrow('nicht gelesen');
    vi.stubGlobal('Worker', class { constructor() { throw new Error('Startfehler'); } });
    await expect(client.run(quiet())).rejects.toThrow('Startfehler');
  });
  it('settles pending work on dispose and disallows subsequent use', async () => {
    const run = client.run(quiet()); client.dispose(); client.dispose();
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
    await expect(client.run(quiet())).rejects.toThrow('beendet');
  });
});

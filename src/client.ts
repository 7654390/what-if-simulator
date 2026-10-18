import type { SimulationInput, SimulationResult } from './types.js';
import type { WorkerResponse } from './protocol.js';

export interface EngineClient {
  /** Latest request wins. Superseded promises reject with name AbortError. */
  run(input: SimulationInput): Promise<SimulationResult>;
  /** Optional onError receives non-cancellation failures of either resolution. */
  runProgressive(input: SimulationInput, onResult: (r: SimulationResult, final: boolean) => void,
    onError?: (error: Error) => void): () => void;
  dispose(): void;
}

function abortError(): Error {
  const error = new Error('Simulationsanfrage abgebrochen');
  error.name = 'AbortError';
  return error;
}

export function createEngineClient(): EngineClient {
  let worker: Worker | undefined;
  let disposed = false;
  let nextId = 0;
  let generation = 0;
  let pending: { id: number; resolve: (result: SimulationResult) => void; reject: (error: Error) => void } | undefined;

  function terminate(): void {
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    worker = undefined;
  }

  function abort(): void {
    if (pending) {
      pending.reject(abortError());
      pending = undefined;
      // Synchronous work cannot read a cancel message; termination actually interrupts it.
      terminate();
    }
  }

  function fail(error: Error): void {
    pending?.reject(error);
    pending = undefined;
    terminate();
  }

  function request(input: SimulationInput): Promise<SimulationResult> {
    if (disposed) return Promise.reject(new Error('EngineClient wurde bereits beendet'));
    abort();
    return new Promise((resolve, reject) => {
      pending = { id: ++nextId, resolve, reject };
      try {
        if (!worker) {
          worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
          const currentWorker = worker;
          worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
            if (!pending || data.id !== pending.id) return;
            const current = pending;
            pending = undefined;
            if ('error' in data) current.reject(new Error(data.error));
            else current.resolve(data.result);
          };
          worker.onerror = (event) => {
            if (worker === currentWorker) fail(new Error(event.message || 'Worker konnte nicht ausgeführt werden'));
          };
          worker.onmessageerror = () => {
            if (worker === currentWorker) fail(new Error('Worker-Antwort konnte nicht gelesen werden'));
          };
        }
        worker.postMessage({ id: nextId, input });
      } catch (error) {
        fail(error instanceof Error ? error : new Error('Worker konnte nicht gestartet werden'));
      }
    });
  }

  return {
    run(input) {
      generation++;
      return request(input);
    },
    runProgressive(input, onResult, onError) {
      const token = ++generation;
      let cancelled = false;
      // Snapshot so slider mutations cannot mix preview and final scenario inputs.
      const snapshot = structuredClone(input);
      const active = () => !cancelled && !disposed && token === generation;
      void (async () => {
        try {
          if (snapshot.paths > 1000) {
            const preview = await request({ ...snapshot, paths: 1000 });
            if (!active()) return;
            onResult(preview, false);
          }
          if (!active()) return;
          const result = await request(snapshot);
          if (active()) onResult(result, true);
        } catch (error) {
          if (!active() || (error instanceof Error && error.name === 'AbortError')) return;
          const failure = error instanceof Error ? error : new Error('Simulation fehlgeschlagen');
          if (onError) onError(failure);
          else if (typeof globalThis.reportError === 'function') globalThis.reportError(failure);
          else console.error(failure);
        }
      })();
      return () => {
        cancelled = true;
        if (token === generation) { generation++; abort(); }
      };
    },
    dispose() {
      disposed = true;
      generation++;
      abort();
      terminate();
    },
  };
}

import type { EngineClient } from '../../../src/client';
import type { SimulationInput, SimulationResult } from '../../../src/types';
import type { LaneResponse } from './sim.worker';

/**
 * Gleicher Vertrag wie createEngineClient() aus src/client.ts, aber mit anderer Planung:
 * Laufende Rechnungen werden nicht per terminate() abgebrochen, sondern höchstens eine
 * neueste Anfrage wartet. So bleiben die Markt- und Lohn-Caches der Engine warm, und
 * beim Ziehen eines Reglers kostet jeder Schritt nur einen warmen Aufruf.
 * Vorschau (1.000 Pfade) und volle Auflösung laufen in getrennten Workern, damit jeder
 * seinen eigenen Cache für seine Pfadzahl behält.
 */
const PREVIEW_PATHS = 1_000;

interface Job { id: number; input: SimulationInput; resolve: (r: SimulationResult) => void; reject: (e: Error) => void }

function abortError(): Error {
  const error = new Error('Simulationsanfrage abgebrochen');
  error.name = 'AbortError';
  return error;
}

class Lane {
  private worker: Worker | undefined;
  private running: Job | undefined;
  private queued: Job | undefined;
  private nextId = 0;

  submit(input: SimulationInput): Promise<SimulationResult> {
    return new Promise((resolve, reject) => {
      const job = { id: ++this.nextId, input, resolve, reject };
      if (this.running) {
        this.queued?.reject(abortError());
        this.queued = job;
      } else this.start(job);
    });
  }

  dispose(): void {
    this.queued?.reject(abortError());
    this.running?.reject(abortError());
    this.queued = this.running = undefined;
    this.worker?.terminate();
    this.worker = undefined;
  }

  private start(job: Job): void {
    this.running = job;
    try {
      this.ensureWorker().postMessage({ id: job.id, input: job.input });
    } catch (error) {
      this.running = undefined;
      job.reject(error instanceof Error ? error : new Error('Worker konnte nicht gestartet werden'));
    }
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<LaneResponse>) => {
      const job = this.running;
      if (!job || job.id !== data.id) return;
      this.running = undefined;
      if ('error' in data) job.reject(new Error(data.error));
      else job.resolve(data.result);
      const next = this.queued;
      this.queued = undefined;
      if (next) this.start(next);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      const job = this.running;
      this.running = undefined;
      this.worker?.terminate();
      this.worker = undefined;
      job?.reject(new Error(event.message || 'Worker konnte nicht ausgeführt werden'));
      const next = this.queued;
      this.queued = undefined;
      if (next) this.start(next);
    };
    this.worker = worker;
    return worker;
  }
}

export function createCoalescingClient(): EngineClient {
  const preview = new Lane();
  const full = new Lane();
  let generation = 0;
  let disposed = false;

  return {
    run(input) {
      generation++;
      if (disposed) return Promise.reject(new Error('EngineClient wurde bereits beendet'));
      return full.submit(structuredClone(input));
    },
    runProgressive(input, onResult, onError) {
      const token = ++generation;
      const snapshot = structuredClone(input);
      let finalDelivered = false;
      const active = () => !disposed && token === generation;
      const report = (error: unknown) => {
        if (!active() || (error instanceof Error && error.name === 'AbortError')) return;
        const failure = error instanceof Error ? error : new Error('Simulation fehlgeschlagen');
        if (onError) onError(failure);
        else console.error(failure);
      };
      if (snapshot.paths > PREVIEW_PATHS) {
        preview.submit({ ...snapshot, paths: PREVIEW_PATHS }).then((r) => {
          if (active() && !finalDelivered) onResult(r, false);
        }, report);
      }
      full.submit(snapshot).then((r) => {
        if (!active()) return;
        finalDelivered = true;
        onResult(r, true);
      }, report);
      return () => { if (token === generation) generation++; };
    },
    dispose() {
      disposed = true;
      generation++;
      preview.dispose();
      full.dispose();
    },
  };
}

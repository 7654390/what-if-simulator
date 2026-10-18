/// <reference lib="webworker" />
import { simulate } from '../../../src/simulate';
import type { SimulationInput, SimulationResult } from '../../../src/types';

export type LaneRequest = { id: number; input: SimulationInput };
export type LaneResponse = { id: number; result: SimulationResult } | { id: number; error: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = ({ data }: MessageEvent<LaneRequest>) => {
  const started = performance.now();
  try {
    const result = simulate(data.input);
    // Die Engine setzt durationMs bewusst auf 0 (Bitgleichheit); gemessen wird hier.
    result.meta.durationMs = performance.now() - started;
    scope.postMessage({ id: data.id, result } satisfies LaneResponse);
  } catch (error) {
    scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Simulation fehlgeschlagen' } satisfies LaneResponse);
  }
};

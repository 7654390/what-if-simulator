import type { SimulationInput, SimulationResult } from './types.js';

export interface WorkerRequest { id: number; input: SimulationInput }
export type WorkerResponse = { id: number; result: SimulationResult } | { id: number; error: string };

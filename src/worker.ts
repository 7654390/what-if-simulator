import { simulate } from './simulate.js';
import type { WorkerRequest, WorkerResponse } from './protocol.js';

interface WorkerPort {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

/** The small port abstraction also allows execution in a Node worker adapter. */
export function installWorker(port: WorkerPort): void {
  port.onmessage = ({ data }) => {
    if (!data || typeof data.id !== 'number') return;
    try {
      port.postMessage({ id: data.id, result: simulate(data.input) });
    } catch (error) {
      port.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Simulation fehlgeschlagen' });
    }
  };
}

// Importing the Node library never touches the DOM or installs a window handler.
if (typeof self !== 'undefined' && !('document' in self)) installWorker(self as unknown as WorkerPort);

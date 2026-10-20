export type * from './types.js';
export { simulate, ENGINE_VERSION } from './simulate.js';
export { defaultInput } from './defaults.js';
export { validateInput } from './validate.js';
export { createEngineClient } from './client.js';
export type { EngineClient } from './client.js';

import type { Euro, PercentileBands, SimulationResult } from './types.js';

export function diff(a: SimulationResult, b: SimulationResult): { medianDeltaAtEnd: Euro; bandsDelta: PercentileBands } {
  if (a.meta.outputMode !== b.meta.outputMode || a.ages.length !== b.ages.length || a.ages.some((age, i) => age !== b.ages[i])) {
    throw new TypeError('Vergleiche benötigen dasselbe Altersraster und denselben Ausgabemodus');
  }
  const keys = Object.keys(a.netWorth);
  if (keys.length !== Object.keys(b.netWorth).length) throw new TypeError('Vergleiche benötigen dieselben Perzentile');
  const bandsDelta: PercentileBands = {};
  for (const key of keys) {
    if (!b.netWorth[key] || a.netWorth[key].length !== a.ages.length || b.netWorth[key].length !== b.ages.length) {
      throw new TypeError('Vergleiche benötigen gleich lange Perzentilbänder');
    }
    bandsDelta[key] = a.netWorth[key].map((value, i) => b.netWorth[key][i] - value);
  }
  return { medianDeltaAtEnd: b.summary.medianAtEnd - a.summary.medianAtEnd, bandsDelta };
}

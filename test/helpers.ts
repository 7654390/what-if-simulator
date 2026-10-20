import { defaultInput } from '../src/defaults.js';
import type { SimulationInput } from '../src/types.js';

export function quiet(years = 1): SimulationInput {
  const input = defaultInput();
  input.paths = 500;
  input.endAge = input.startAge + years;
  input.start = { cash: 0, etf: 0, etfCostBasis: 0, debt: 0 };
  input.market = { etfReturn: 0, etfVolatility: 0, fatTails: false, cashRate: 0,
    inflationMean: 0, inflationVolatility: 0, etfTer: 0 };
  input.phases = [{ ...input.phases[0], kind: 'break', grossMonthly: 0, livingCostsMonthly: 0,
    salaryGrowth: 0, taxClass: 'minijob' }];
  input.events = [];
  input.savingsPlan = { monthly: 0, dynamic: false };
  return input;
}

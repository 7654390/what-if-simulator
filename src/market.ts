import { nextShocks, Random } from './rng.js';
import type { Shocks } from './rng.js';
import type { SimulationInput } from './types.js';

export interface MarketFactors { etf: Float64Array; prices: Float64Array; salary: Float64Array }

// Bounded, one-entry cache: repeated slider inputs reuse the same market paths.
const MAX_CACHED_STEPS = 2_500_000;
let cached: { key: string; factors: MarketFactors } | undefined;

export function allocateFactors(length: number): MarketFactors {
  return { etf: new Float64Array(length), prices: new Float64Array(length), salary: new Float64Array(length) };
}

export function fillMarketPath(input: SimulationInput, path: number, months: number, out: MarketFactors, offset: number): void {
  const rng = new Random(input.seed, path);
  const shocks: Shocks = { equity: 0, inflation: 0, salary: 0, studentT: 0 };
  const market = input.market;
  const sigma = market.etfVolatility / Math.sqrt(12);
  // Arithmetic annual expectation for GBM; fees are continuously deducted.
  const drift = (Math.log1p(market.etfReturn) - market.etfTer - market.etfVolatility ** 2 / 2) / 12;
  const inflationMean = Math.log1p(market.inflationMean);
  const innovation = market.inflationVolatility * Math.sqrt(1 - 0.85 ** 2);
  let inflation = inflationMean;
  let prices = 1;
  for (let m = 0; m < months; m++) {
    nextShocks(rng, shocks);
    // Truncated t(5) avoids its nonexistent exponential moment and explosive prices.
    const z = market.fatTails ? Math.max(-12, Math.min(12, shocks.studentT)) : shocks.equity;
    out.etf[offset + m] = Math.exp(drift + sigma * z);
    inflation = inflationMean + 0.85 * (inflation - inflationMean) + innovation * shocks.inflation;
    prices *= Math.exp(inflation / 12);
    out.prices[offset + m] = prices;
    // 1% annual salary noise; fixed draws also during study/break.
    out.salary[offset + m] = Math.exp(0.01 / Math.sqrt(12) * shocks.salary - 0.0001 / 24);
  }
}

export function cachedMarket(input: SimulationInput, months: number): MarketFactors | undefined {
  const size = months * input.paths;
  if (size > MAX_CACHED_STEPS) { cached = undefined; return undefined; }
  const key = JSON.stringify([input.seed, input.paths, months, input.market.etfReturn,
    input.market.etfVolatility, input.market.fatTails, input.market.inflationMean,
    input.market.inflationVolatility, input.market.etfTer]);
  if (cached?.key === key) return cached.factors;
  const factors = allocateFactors(size);
  for (let p = 0; p < input.paths; p++) fillMarketPath(input, p, months, factors, p * months);
  cached = { key, factors };
  return factors;
}

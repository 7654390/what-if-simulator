import { incomeTax, TAX_DE_2026 } from './taxDE.js';
import type { MarketFactors } from './market.js';

export interface Payroll { net: Float64Array; tax: Float64Array }
interface Schedule { gross: Float64Array; socialRate: Float64Array; work: Uint8Array }
let cached: { market: MarketFactors; key: string; result: Payroll } | undefined;

/** Reuse payroll when only savings, living costs or cash/debt sliders move. */
export function preparePayroll(market: MarketFactors, plan: Schedule, paths: number, months: number): Payroll {
  const key = JSON.stringify([Array.from(plan.gross), Array.from(plan.socialRate), Array.from(plan.work)]);
  if (cached?.market === market && cached.key === key) return cached.result;
  const result = { net: new Float64Array(paths * months), tax: new Float64Array(paths * months) };
  const cap = TAX_DE_2026.socialAnnualCap / 12;
  for (let p = 0; p < paths; p++) {
    let salary = 1;
    const offset = p * months;
    for (let m = 0; m < months; m++) {
      const index = offset + m;
      salary = plan.work[m] ? salary * market.salary[index] : 1;
      const gross = plan.gross[m] * market.prices[index] * salary;
      const rate = plan.socialRate[m];
      const social = Math.min(gross, cap) * rate;
      // Annualized monthly payroll: no end-of-year reconciliation or eligibility test.
      const tax = rate === 0 ? 0 : incomeTax((gross - social) * 12 - TAX_DE_2026.employeeAllowance) / 12;
      result.net[index] = gross - tax - social;
      result.tax[index] = tax;
    }
  }
  cached = { market, key, result };
  return result;
}

export function clearPayrollCache(): void { cached = undefined; }

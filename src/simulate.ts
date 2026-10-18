import type { PercentileBands, SimulationInput, SimulationResult } from './types.js';
import { allocateFactors, cachedMarket, fillMarketPath } from './market.js';
import { loanSchedule, monthlyRate } from './loan.js';
import { capitalGainsTax, grossWithdrawal, incomeTax, TAX_DE_2026 } from './taxDE.js';
import { percentile, Quantiles } from './percentiles.js';
import { validateInput } from './validate.js';
import { clearPayrollCache, preparePayroll } from './payroll.js';

export const ENGINE_VERSION = '0.1.0';

function schedule(input: SimulationInput, months: number) {
  const gross = new Float64Array(months);
  const costs = new Float64Array(months);
  const extra = new Float64Array(months);
  const work = new Uint8Array(months);
  const socialRate = new Float64Array(months);
  let phaseIndex = 0;
  for (let m = 0; m < months; m++) {
    while (phaseIndex + 1 < input.phases.length && m >= Math.round((input.phases[phaseIndex + 1].fromAge - input.startAge) * 12)) phaseIndex++;
    const phase = input.phases[phaseIndex];
    let factor = phase.partTimeFactor;
    let boost = 1;
    for (const event of input.events) {
      if (!event.enabled) continue;
      if (event.type === 'partTime') {
        // Overlapping overrides intentionally follow input order: last event wins.
        if (m >= Math.round((event.fromAge - input.startAge) * 12) && m < Math.round((event.toAge - input.startAge) * 12)) factor = event.factor;
      } else if (event.type === 'semesterAbroad') {
        const start = Math.round((event.atAge - input.startAge) * 12);
        if (m >= start && m < start + event.months) extra[m] += event.grantMonthly - event.extraCostsMonthly;
        if (m >= start + event.months) boost *= 1 + event.salaryBoostAfter;
      } else if (event.type === 'oneOff' && m === Math.round((event.atAge - input.startAge) * 12)) extra[m] += event.amount;
    }
    const elapsed = Math.max(0, m - Math.round((phase.fromAge - input.startAge) * 12));
    // A new work phase starts its own real salary trend; no inferred career transitions.
    gross[m] = phase.grossMonthly * factor * boost * (phase.kind === 'work' ? (1 + phase.salaryGrowth) ** (elapsed / 12) : 1);
    costs[m] = extra[m] - phase.livingCostsMonthly;
    socialRate[m] = phase.taxClass === 'minijob' ? 0 : phase.taxClass === 'werkstudent'
      ? TAX_DE_2026.werkstudentRate : TAX_DE_2026.socialRate;
    work[m] = phase.kind === 'work' ? 1 : 0;
  }
  return { gross, costs, work, socialRate, loans: loanSchedule(input.events, input.startAge, months) };
}

function bands(values: Float64Array, paths: number, years: number, requested: number[], scratch: Float64Array): PercentileBands {
  const result: PercentileBands = {};
  for (const p of requested) result[String(p)] = [];
  const quantiles = new Quantiles(paths, requested);
  for (let y = 0; y <= years; y++) {
    scratch.set(values.subarray(y * paths, (y + 1) * paths));
    let constant = true;
    for (let i = 1; i < paths; i++) if (scratch[i] !== scratch[0]) { constant = false; break; }
    if (constant) {
      for (const p of requested) result[String(p)].push(scratch[0]);
      continue;
    }
    quantiles.compute(scratch);
    for (let i = 0; i < requested.length; i++) result[String(requested[i])].push(quantiles.value(i));
  }
  return result;
}

export function simulate(input: SimulationInput): SimulationResult {
  const validation = validateInput(input);
  if (!validation.ok) throw new TypeError(validation.errors.join('; '));
  const years = input.endAge - input.startAge;
  const months = years * 12;
  const paths = input.paths;
  const requested = input.percentiles ?? [5, 25, 50, 75, 95];
  const plan = schedule(input, months);
  const cached = cachedMarket(input, months);
  const market = cached ?? allocateFactors(months);
  if (!cached) clearPayrollCache();
  const payroll = cached ? preparePayroll(market, plan, paths, months) : undefined;
  const net = new Float64Array((years + 1) * paths);
  const cashValues = new Float64Array(net.length);
  const etfValues = new Float64Array(net.length);
  const debts = new Float64Array(net.length);
  const taxesPaid = new Float64Array(paths);
  const contributions = new Float64Array(paths);
  const drawdowns = new Float64Array(paths);
  const cashFactor = 1 + monthlyRate(input.market.cashRate);
  const overdraftFactor = 1 + monthlyRate(0.12);
  const real = input.outputMode === 'real';
  const initialDebt = input.start.debt; // Legacy debt has no inferred rate or repayment contract.
  const monthlySavings = input.savingsPlan.monthly;
  const dynamicSavings = input.savingsPlan.dynamic;
  const etfFactors = market.etf, priceFactors = market.prices, salaryFactors = market.salary;
  const grossSchedule = plan.gross, costsSchedule = plan.costs, workSchedule = plan.work;
  const socialRates = plan.socialRate, loanFlow = plan.loans.cashFlow, loanDebt = plan.loans.debt;
  const socialCap = TAX_DE_2026.socialAnnualCap / 12;
  const taxableShare = 1 - TAX_DE_2026.equityExemption;
  const capitalRate = TAX_DE_2026.capitalRate;
  let sum = 0;
  let negatives = 0;
  let targets = 0;
  for (let p = 0; p < paths; p++) {
    if (!cached) fillMarketPath(input, p, months, market, 0);
    const offset = cached ? p * months : 0;
    let cash = input.start.cash;
    let etf = input.start.etf;
    let basis = input.start.etfCostBasis;
    let allowance: number = TAX_DE_2026.capitalAllowance;
    const initialEtf = etf - capitalGainsTax(etf - basis, allowance);
    const initial = cash + initialEtf - input.start.debt;
    net[p] = initial;
    cashValues[p] = Math.max(0, cash);
    etfValues[p] = initialEtf;
    debts[p] = input.start.debt + Math.max(0, -cash);
    let peak = Math.max(0, initial);
    let drawdown = 0;
    let salary = 1;
    let totalTax = 0;
    let totalContribution = 0;
    for (let m = 0; m < months; m++) {
      // Twelve simulated months stand in for a calendar tax year (no start date in the API).
      if (m % 12 === 0) allowance = TAX_DE_2026.capitalAllowance;
      const index = offset + m;
      const prices = priceFactors[index];
      const deflator = real ? 1 / prices : 1;
      etf *= etfFactors[index];
      cash *= cash < 0 ? overdraftFactor : cashFactor; // Cash-interest taxes omitted.
      let payTax: number, netIncome: number;
      if (payroll) {
        payTax = payroll.tax[index];
        netIncome = payroll.net[index];
      } else {
        salary = workSchedule[m] ? salary * salaryFactors[index] : 1;
        const gross = grossSchedule[m] * prices * salary;
        const rate = socialRates[m];
        const social = Math.min(gross, socialCap) * rate;
        payTax = rate === 0 ? 0 : incomeTax((gross - social) * 12 - TAX_DE_2026.employeeAllowance) / 12;
        netIncome = gross - payTax - social;
      }
      cash += netIncome + costsSchedule[m] * prices + loanFlow[m];
      totalTax += payTax * deflator;
      if (cash < 0 && etf > 0) {
        const sale = grossWithdrawal(-cash, etf, basis, allowance);
        const removedBasis = basis * (sale / etf);
        const gain = Math.max(0, sale - removedBasis);
        const tax = capitalGainsTax(gain, allowance);
        allowance = Math.max(0, allowance - gain * (1 - TAX_DE_2026.equityExemption));
        cash += sale - tax;
        etf = Math.max(0, etf - sale);
        basis = Math.max(0, basis - removedBasis);
        totalTax += tax * deflator;
      } else if (cash > 0) {
        // Never borrow merely to buy the ETF, or buy and sell in the same month.
        const purchase = Math.min(cash, monthlySavings * (dynamicSavings ? prices : 1));
        etf += purchase;
        basis += purchase;
        cash -= purchase;
        totalContribution += purchase * deflator;
      }
      const taxableGain = (etf - basis) * taxableShare - allowance;
      const netEtf = etf - (taxableGain > 0 ? taxableGain * capitalRate : 0);
      const wealth = (cash + netEtf - initialDebt - loanDebt[m]) * deflator;
      // Net-worth drawdown may exceed 100% when wealth becomes negative.
      if (wealth > peak) peak = wealth;
      else if (peak > 0) drawdown = Math.max(drawdown, (peak - wealth) / peak);
      if ((m + 1) % 12 === 0) {
        const position = ((m + 1) / 12) * paths + p;
        net[position] = wealth;
        cashValues[position] = Math.max(0, cash) * deflator;
        etfValues[position] = netEtf * deflator;
        debts[position] = (initialDebt + loanDebt[m] + Math.max(0, -cash)) * deflator;
      }
    }
    const last = net[years * paths + p];
    sum += last;
    if (last < 0) negatives++;
    if (input.targetNetWorth !== undefined && last >= input.targetNetWorth) targets++;
    taxesPaid[p] = totalTax;
    contributions[p] = totalContribution;
    drawdowns[p] = drawdown;
  }
  const scratch = new Float64Array(paths);
  const netWorth = bands(net, paths, years, requested, scratch);
  scratch.set(net.subarray(years * paths));
  const median = percentile(scratch, 50);
  const samplePaths: number[][] = [];
  for (let p = 0; p < Math.min(20, paths); p++) {
    const sample: number[] = [];
    for (let y = 0; y <= years; y++) sample.push(net[y * paths + p]);
    samplePaths.push(sample);
  }
  return {
    ages: Array.from({ length: years + 1 }, (_, y) => input.startAge + y),
    netWorth,
    components: {
      cash: bands(cashValues, paths, years, requested, scratch),
      etf: bands(etfValues, paths, years, requested, scratch),
      debt: bands(debts, paths, years, requested, scratch),
    },
    summary: {
      medianAtEnd: median, meanAtEnd: sum / paths, probNegativeAtEnd: negatives / paths,
      ...(input.targetNetWorth === undefined ? {} : { probReachTarget: targets / paths }),
      maxDrawdownMedian: percentile(drawdowns, 50), totalTaxesPaidMedian: percentile(taxesPaid, 50),
      totalContributionsMedian: percentile(contributions, 50),
    },
    samplePaths,
    // Wall-clock timing is deliberately external so complete results remain bit-identical.
    meta: { paths, seed: input.seed, durationMs: 0, engineVersion: ENGINE_VERSION, outputMode: input.outputMode },
  };
}

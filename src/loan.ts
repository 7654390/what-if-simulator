import type { LifeEvent } from './types.js';

export const BAFOEG = Object.freeze({ loanShare: 0.5, repaymentCap: 10_010, graceMonths: 60, monthlyRepayment: 130 });

/** Effective annual rate converted to an effective monthly rate. */
export function monthlyRate(annualRate: number): number {
  return Math.expm1(Math.log1p(annualRate) / 12);
}

export function annuity(principal: number, annualRate: number, months: number): number {
  if (months <= 0 || !Number.isInteger(months)) throw new RangeError('Tilgungsmonate müssen eine positive ganze Zahl sein');
  const r = monthlyRate(annualRate);
  return r === 0 ? principal / months : principal * r / -Math.expm1(-months * Math.log1p(r));
}

export interface LoanSchedule { cashFlow: Float64Array; debt: Float64Array }

/** Deterministic nominal contracts compiled once, outside every path loop. */
export function loanSchedule(events: LifeEvent[], startAge: number, months: number): LoanSchedule {
  const cashFlow = new Float64Array(months);
  const debt = new Float64Array(months);
  for (const event of events) {
    if (!event.enabled || (event.type !== 'studentLoan' && event.type !== 'bafoeg')) continue;
    const start = Math.round((event.atAge - startAge) * 12);
    const payoutMonths = event.type === 'studentLoan' ? event.payoutMonths : event.months;
    const repaymentStart = start + payoutMonths + (event.type === 'studentLoan' ? event.graceMonths : BAFOEG.graceMonths);
    const r = event.type === 'studentLoan' ? monthlyRate(event.interestRate) : 0;
    let balance = 0;
    let payment = 0;
    for (let m = 0; m < months; m++) {
      balance *= 1 + r;
      if (m >= start && m < start + payoutMonths) {
        const payout = event.type === 'studentLoan' ? event.payoutMonthly : event.monthly;
        cashFlow[m] += payout;
        // BAföG cap is per event/contract; all amounts beyond the loan share are grants.
        balance = event.type === 'studentLoan' ? balance + payout
          : Math.min(BAFOEG.repaymentCap, balance + payout * BAFOEG.loanShare);
      }
      if (m === repaymentStart) payment = event.type === 'studentLoan'
        ? annuity(balance / (1 + r), event.interestRate, event.repaymentMonths)
        : BAFOEG.monthlyRepayment;
      if (m >= repaymentStart && balance > 0) {
        const paid = Math.min(balance, payment);
        cashFlow[m] -= paid;
        balance = Math.max(0, balance - paid);
      }
      debt[m] += balance;
    }
  }
  return { cashFlow, debt };
}

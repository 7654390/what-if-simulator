/** Simplified 2026 basic tariff, EUR/year; no splitting, church tax or income Soli. */
export const TAX_DE_2026 = Object.freeze({
  basicAllowance: 12_348,
  firstZoneEnd: 17_799,
  secondZoneEnd: 69_878,
  topZoneEnd: 277_825,
  zone1Quadratic: 914.51,
  zone1Linear: 1_400,
  zone2Quadratic: 173.10,
  zone2Linear: 2_397,
  zone2Offset: 1_034.87,
  highRate: 0.42,
  highOffset: 11_135.63,
  topRate: 0.45,
  topOffset: 19_470.38,
  socialRate: 0.20,
  socialAnnualCap: 101_400,
  werkstudentRate: 0.093,
  employeeAllowance: 1_230,
  capitalRate: 0.26375,
  capitalAllowance: 1_000,
  equityExemption: 0.30,
});

export type TaxTariff = { [K in keyof typeof TAX_DE_2026]: number };

export function incomeTax(annualTaxableIncome: number, t: TaxTariff = TAX_DE_2026): number {
  const x = Math.max(0, Math.floor(annualTaxableIncome));
  if (x <= t.basicAllowance) return 0;
  if (x <= t.firstZoneEnd) {
    const y = (x - t.basicAllowance) / 10_000;
    return Math.floor((t.zone1Quadratic * y + t.zone1Linear) * y);
  }
  if (x <= t.secondZoneEnd) {
    const z = (x - t.firstZoneEnd) / 10_000;
    return Math.floor((t.zone2Quadratic * z + t.zone2Linear) * z + t.zone2Offset);
  }
  return Math.floor(x <= t.topZoneEnd ? t.highRate * x - t.highOffset : t.topRate * x - t.topOffset);
}

/** Social contributions approximated by one shared cap; all deductible for this model. */
export function monthlyIncomeTax(gross: number, kind: 'standard' | 'minijob' | 'werkstudent'): number {
  // Flag-driven exemption; earnings limits and working-hour eligibility are not checked.
  if (kind === 'minijob') return 0;
  const social = Math.min(gross, TAX_DE_2026.socialAnnualCap / 12)
    * (kind === 'werkstudent' ? TAX_DE_2026.werkstudentRate : TAX_DE_2026.socialRate);
  return incomeTax(Math.max(0, (gross - social) * 12 - TAX_DE_2026.employeeAllowance)) / 12;
}

export function socialContributions(gross: number, kind: 'standard' | 'minijob' | 'werkstudent'): number {
  return kind === 'minijob' ? 0 : Math.min(gross, TAX_DE_2026.socialAnnualCap / 12)
    * (kind === 'werkstudent' ? TAX_DE_2026.werkstudentRate : TAX_DE_2026.socialRate);
}

export function capitalGainsTax(gain: number, allowance: number = TAX_DE_2026.capitalAllowance): number {
  return Math.max(0, Math.max(0, gain) * (1 - TAX_DE_2026.equityExemption) - allowance) * TAX_DE_2026.capitalRate;
}

/** Gross sale needed to obtain a given net withdrawal (average cost basis). */
export function grossWithdrawal(net: number, value: number, basis: number, allowance: number): number {
  if (value <= 0) return 0;
  const taxableFraction = Math.max(0, 1 - basis / value) * (1 - TAX_DE_2026.equityExemption);
  if (taxableFraction === 0) return Math.min(net, value);
  const freeGross = allowance / taxableFraction;
  const gross = net <= freeGross ? net : freeGross + (net - freeGross) / (1 - taxableFraction * TAX_DE_2026.capitalRate);
  return Math.min(gross, value);
}

// TODO: Vorabpauschale and loss carry-forwards are deliberately omitted.

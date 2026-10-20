import type { SimulationInput } from './types.js';

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validateInput(input: unknown): { ok: true; value: SimulationInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!record(input)) return { ok: false, errors: ['Eingabe muss ein Objekt sein'] };
  const number = (o: RecordValue, key: string, min: number, max: number, integer = false) => {
    const n = o[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
      errors.push(`${key}: ${integer ? 'Ganze, endliche Zahl' : 'Endliche Zahl'} zwischen ${min} und ${max} erforderlich`);
      return false;
    }
    return true;
  };
  const text = (o: RecordValue, key: string) => {
    if (typeof o[key] !== 'string' || !(o[key] as string).trim()) errors.push(`${key}: Text darf nicht leer sein`);
  };
  const bool = (o: RecordValue, key: string) => {
    if (typeof o[key] !== 'boolean') errors.push(`${key}: Wahrheitswert erforderlich`);
  };
  number(input, 'seed', 0, 0xffffffff, true);
  number(input, 'paths', 500, 50_000, true);
  const agesValid = number(input, 'startAge', 0, 120) && number(input, 'endAge', 0, 120);
  const startAge = input.startAge as number;
  const endAge = input.endAge as number;
  if (agesValid && (endAge <= startAge || !Number.isInteger(endAge - startAge))) {
    errors.push('endAge muss um eine positive ganze Anzahl Jahre über startAge liegen');
  }
  if (input.outputMode !== 'real' && input.outputMode !== 'nominal') errors.push('outputMode muss real oder nominal sein');
  if (!record(input.start)) errors.push('start: Anfangsvermögen fehlt');
  else {
    number(input.start, 'cash', -1e12, 1e12);
    for (const key of ['etf', 'etfCostBasis', 'debt']) number(input.start, key, 0, 1e12);
    if (input.start.etf === 0 && input.start.etfCostBasis !== 0) errors.push('etfCostBasis muss bei leerem Depot 0 sein');
  }
  if (!record(input.market)) errors.push('market: Marktparameter fehlen');
  else {
    for (const key of ['etfReturn', 'cashRate', 'inflationMean']) number(input.market, key, -0.99, 1);
    for (const key of ['etfVolatility', 'inflationVolatility', 'etfTer']) number(input.market, key, 0, 1);
    bool(input.market, 'fatTails');
  }
  if (!record(input.savingsPlan)) errors.push('savingsPlan: Sparplan fehlt');
  else { number(input.savingsPlan, 'monthly', 0, 1e9); bool(input.savingsPlan, 'dynamic'); }
  const ids = new Set<string>();
  const id = (o: RecordValue) => {
    text(o, 'id');
    if (typeof o.id === 'string') {
      if (ids.has(o.id)) errors.push(`id muss eindeutig sein: ${o.id}`);
      ids.add(o.id);
    }
  };
  if (!Array.isArray(input.phases) || !input.phases.length) errors.push('phases: Mindestens eine Lebensphase erforderlich');
  else {
    let previous = -Infinity;
    input.phases.forEach((p: unknown, index: number) => {
      if (!record(p)) { errors.push(`Phase ${index}: Objekt erforderlich`); return; }
      id(p); text(p, 'label');
      number(p, 'fromAge', startAge, endAge);
      if (index === 0 && p.fromAge !== startAge) errors.push('Phasen müssen bei startAge beginnen');
      if (typeof p.fromAge === 'number') {
        if (p.fromAge <= previous || p.fromAge >= endAge) errors.push('Phasen müssen streng aufsteigend vor endAge beginnen');
        previous = p.fromAge;
      }
      if (!['study', 'work', 'break'].includes(p.kind as string)) errors.push('kind muss study, work oder break sein');
      if (!['standard', 'minijob', 'werkstudent'].includes(p.taxClass as string)) errors.push('Unbekannte taxClass');
      number(p, 'grossMonthly', 0, 1e9); number(p, 'livingCostsMonthly', 0, 1e9);
      number(p, 'partTimeFactor', 0, 1); number(p, 'salaryGrowth', -0.99, 1);
    });
  }
  if (!Array.isArray(input.events)) errors.push('events muss eine Liste sein');
  else input.events.forEach((event: unknown, index: number) => {
    if (!record(event)) { errors.push(`Event ${index}: Objekt erforderlich`); return; }
    id(event); bool(event, 'enabled');
    if (event.type === 'partTime') {
      number(event, 'fromAge', startAge, 120); number(event, 'toAge', startAge, 120);
      if ((event.toAge as number) <= (event.fromAge as number)) errors.push('Teilzeit: toAge muss nach fromAge liegen');
      number(event, 'factor', 0, 1);
      return;
    }
    number(event, 'atAge', startAge, 120);
    switch (event.type) {
      case 'semesterAbroad':
        number(event, 'months', 1, 1440, true); number(event, 'extraCostsMonthly', 0, 1e9);
        number(event, 'grantMonthly', 0, 1e9); number(event, 'salaryBoostAfter', -0.99, 1); break;
      case 'studentLoan':
        number(event, 'payoutMonthly', 0, 1e9); number(event, 'payoutMonths', 1, 1440, true);
        number(event, 'interestRate', 0, 1); number(event, 'graceMonths', 0, 1440, true);
        number(event, 'repaymentMonths', 1, 1440, true); break;
      case 'bafoeg': number(event, 'monthly', 0, 1e9); number(event, 'months', 1, 1440, true); break;
      case 'oneOff': number(event, 'amount', -1e12, 1e12); text(event, 'label'); break;
      default: errors.push('Unbekannter Event-Typ');
    }
  });
  if (input.percentiles !== undefined) {
    if (!Array.isArray(input.percentiles) || !input.percentiles.length || input.percentiles.some(p =>
      typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 100)) errors.push('Perzentile müssen Zahlen von 0 bis 100 enthalten');
    else if (new Set(input.percentiles).size !== input.percentiles.length) errors.push('Perzentile dürfen nicht doppelt vorkommen');
  }
  if (input.targetNetWorth !== undefined) number(input, 'targetNetWorth', -1e12, 1e12);
  return errors.length ? { ok: false, errors } : { ok: true, value: input as unknown as SimulationInput };
}

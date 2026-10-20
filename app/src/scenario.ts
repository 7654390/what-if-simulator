import { defaultInput } from '../../src/defaults';
import { validateInput } from '../../src/validate';
import type { LifeEvent, SimulationInput } from '../../src/types';
import { euro, percent } from './format';

const STORAGE_KEY = 'what-if-cockpit:input:v1';

/** defaultInput() der Engine, ergänzt um die Events, die dort noch fehlen (alle aus). */
export function initialInput(): SimulationInput {
  const input = defaultInput();
  const has = (type: LifeEvent['type']) => input.events.some((e) => e.type === type);
  if (!has('bafoeg')) input.events.push({ type: 'bafoeg', id: 'bafoeg', enabled: false, atAge: 20, monthly: 600, months: 36 });
  if (!has('oneOff')) input.events.push({ type: 'oneOff', id: 'one-off', enabled: false, atAge: 27, amount: -8_000, label: 'Weltreise' });
  return input;
}

export function loadInput(): SimulationInput {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = validateInput(JSON.parse(raw));
      if (parsed.ok) return parsed.value;
    }
  } catch { /* Speicher gesperrt oder kaputt: Standard nehmen */ }
  return initialInput();
}

export function saveInput(input: SimulationInput): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(input)); } catch { /* egal */ }
}

export function clearSavedInput(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* egal */ }
}

export const EVENT_LABEL: Record<LifeEvent['type'], string> = {
  semesterAbroad: 'Auslandssemester',
  bafoeg: 'BAföG',
  studentLoan: 'Studienkredit',
  partTime: 'Teilzeit',
  oneOff: 'Einmalbetrag',
};

/** Kurze Beschreibungen, was sich gegenüber der Referenz geändert hat (für die Delta-Badge). */
export function describeChanges(ref: SimulationInput, cur: SimulationInput): string[] {
  const out: string[] = [];
  const d = cur.savingsPlan.monthly - ref.savingsPlan.monthly;
  if (d !== 0) out.push(`${euro(Math.abs(d))} ${d > 0 ? 'höhere' : 'niedrigere'} Sparrate`);
  if (cur.savingsPlan.dynamic !== ref.savingsPlan.dynamic) out.push(cur.savingsPlan.dynamic ? 'dynamischen Sparplan' : 'festen Sparplan');
  const startDelta = cur.start.cash + cur.start.etf - ref.start.cash - ref.start.etf;
  if (startDelta !== 0) out.push(`${euro(Math.abs(startDelta))} ${startDelta > 0 ? 'mehr' : 'weniger'} Startkapital`);
  for (const event of cur.events) {
    const before = ref.events.find((e) => e.id === event.id);
    const label = event.type === 'oneOff' ? event.label || EVENT_LABEL.oneOff : EVENT_LABEL[event.type];
    if (!before || before.enabled !== event.enabled) {
      if (event.enabled) out.push(label);
      else if (before?.enabled) out.push(`kein(e) ${label}`);
    } else if (event.enabled && JSON.stringify(before) !== JSON.stringify(event)) out.push(`geänderte(s) ${label}`);
  }
  if (JSON.stringify(ref.phases) !== JSON.stringify(cur.phases)) out.push('geänderte Lebensphasen');
  const m = cur.market, rm = ref.market;
  if (m.etfReturn !== rm.etfReturn) out.push(`ETF-Rendite ${percent(m.etfReturn, 1)}`);
  if (m.etfVolatility !== rm.etfVolatility) out.push(`Volatilität ${percent(m.etfVolatility)}`);
  if (m.inflationMean !== rm.inflationMean) out.push(`Inflation ${percent(m.inflationMean, 1)}`);
  if (m.fatTails !== rm.fatTails) out.push(m.fatTails ? 'Crash-Modell' : 'ohne Crash-Modell');
  return out;
}

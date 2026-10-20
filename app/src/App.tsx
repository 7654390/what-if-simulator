import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, Pin, PinOff, RotateCcw, ShieldCheck, Zap } from 'lucide-react';
import type { SimulationInput, SimulationResult } from '../../src/types';
import { FanChart, type Marker } from './components/FanChart';
import { Segmented, Switch } from './components/Controls';
import { AssumptionsPanel, DecisionsPanel, QuickPanel, type Update } from './components/Panels';
import { compactEuro, euro, num, percent, signedEuro } from './format';
import { clearSavedInput, EVENT_LABEL, initialInput, loadInput, saveInput } from './scenario';
import { useSimulation } from './useSimulation';
import { useMediaQuery } from './useMediaQuery';

type View = 'netWorth' | 'etf' | 'cash' | 'debt';
type Tab = 'quick' | 'decisions' | 'assumptions';

const VIEWS: { value: View; label: string }[] = [
  { value: 'netWorth', label: 'Nettovermögen' },
  { value: 'etf', label: 'ETF-Depot' },
  { value: 'cash', label: 'Cash' },
  { value: 'debt', label: 'Schulden' },
];

function bandsOf(result: SimulationResult, view: View) {
  return view === 'netWorth' ? result.netWorth : result.components[view];
}

function markersOf(input: SimulationInput): Marker[] {
  const out: Marker[] = input.phases.slice(1).map((p) => ({ age: p.fromAge, label: `${p.label} mit ${p.fromAge.toLocaleString('de-DE')}` }));
  for (const e of input.events) {
    if (!e.enabled) continue;
    const at = e.type === 'partTime' ? e.fromAge : e.atAge;
    const label = e.type === 'oneOff' ? e.label || EVENT_LABEL.oneOff : EVENT_LABEL[e.type];
    out.push({ age: at, label });
  }
  return out;
}

export default function App() {
  const [input, setInput] = useState<SimulationInput>(loadInput);
  const [view, setView] = useState<View>('netWorth');
  const [showSamples, setShowSamples] = useState(false);
  const [tab, setTab] = useState<Tab>('quick');
  const sim = useSimulation(input);
  const wide = useMediaQuery('(min-width: 1024px)');

  useEffect(() => { saveInput(input); }, [input]);

  const update: Update = useCallback((mutate) => {
    setInput((prev) => { const next = structuredClone(prev); mutate(next); return next; });
  }, []);

  const reset = () => { clearSavedInput(); setInput(initialInput()); sim.unpin(); };

  const result = sim.result;
  const bands = useMemo(() => (result ? bandsOf(result, view) : null), [result, view]);
  const ghost = useMemo(() => {
    if (!sim.reference || !result) return undefined;
    const ref = bandsOf(sim.reference, view)['50'];
    return ref && ref.length === result.ages.length ? ref : undefined;
  }, [sim.reference, result, view]);
  const markers = useMemo(() => markersOf(input), [input]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1400px] lg:grid lg:grid-cols-[400px_1fr] lg:gap-6 lg:px-6">
        {/* Chart-Spalte: mobil oben klebend, am Desktop rechts fixiert */}
        <main className="sticky top-0 z-20 bg-[var(--bg)] px-4 pt-3 pb-2 lg:order-2 lg:h-screen lg:overflow-y-auto lg:px-0 lg:pt-6">
          <Header input={input} result={result} final={sim.final} onReset={reset} />
          {wide && result && <Kpis result={result} />}

          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:mt-4 lg:p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="max-w-full overflow-x-auto"><Segmented label="Kennzahl" options={VIEWS} value={view} onChange={setView} /></div>
              <Segmented label="Kaufkraft" value={input.outputMode}
                options={[{ value: 'real', label: wide ? 'Real (heutige Kaufkraft)' : 'Real' }, { value: 'nominal', label: wide ? 'Nominal (inkl. Inflation)' : 'Nominal' }]}
                onChange={(v) => update((d) => { d.outputMode = v; })} />
              <div className="ml-auto flex items-center gap-2">
                <PinButton pinned={sim.pinned} onPin={sim.pin} onUnpin={sim.unpin} compact={!wide} />
              </div>
            </div>
            <DeltaBadge pinned={sim.pinned} delta={sim.medianDelta} changes={sim.changes} endAge={input.endAge} />
            {result && bands ? (
              <FanChart ages={result.ages} bands={bands} ghost={ghost} markers={markers} height={wide ? 420 : 200}
                samples={showSamples && view === 'netWorth' ? result.samplePaths : undefined} />
            ) : (
              <div className="grid place-items-center text-sm text-[var(--text-muted)]" style={{ height: wide ? 420 : 200 }}>
                {sim.errors.length ? 'Eingabe ungültig' : 'Rechne 10.000 Zukünfte …'}
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-secondary)]">
              <Legend swatch={<span className="h-0.5 w-4 rounded bg-[var(--fan)]" />} label="Median" />
              <Legend swatch={<span className="h-3 w-4 rounded-sm bg-[var(--fan)] opacity-40" />} label={wide ? '50 % der Fälle' : '50 %'} />
              <Legend swatch={<span className="h-3 w-4 rounded-sm bg-[var(--fan)] opacity-20" />} label={wide ? '90 % der Fälle' : '90 %'} />
              {ghost && <Legend swatch={<span className="w-4 border-t-2 border-dashed border-[var(--ghost)]" />} label="Referenz" />}
              <label className={`ml-auto flex items-center gap-2 ${view !== 'netWorth' ? 'opacity-40' : ''}`}>
                <span>{wide ? 'Einzelne Schicksalspfade' : 'Pfade'}</span>
                <Switch checked={showSamples} onChange={setShowSamples} label="Einzelne Schicksalspfade zeigen" />
              </label>
            </div>
          </div>
          {sim.errors.length > 0 && (
            <div role="alert" className="mt-3 rounded-lg border border-[var(--critical)] bg-[var(--critical-soft)] px-3 py-2 text-xs text-[var(--text-primary)]">
              {sim.errors.map((e) => <div key={e}>{e}</div>)}
            </div>
          )}
          {!wide && (
            <div className="mt-3 flex gap-1 rounded-lg bg-[var(--track)] p-0.5" role="tablist">
              {([['quick', 'Regler'], ['decisions', 'Entscheidungen'], ['assumptions', 'Annahmen']] as [Tab, string][]).map(([t, label]) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium ${tab === t ? 'bg-[var(--surface-raised)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {wide && <Footer />}
        </main>

        <aside className="space-y-4 px-4 pt-3 pb-8 lg:order-1 lg:px-0 lg:pt-6">
          {!wide && result && <Kpis result={result} />}
          {(wide || tab === 'quick') && <QuickPanel input={input} update={update} />}
          {(wide || tab === 'decisions') && <DecisionsPanel input={input} update={update} />}
          {(wide || tab === 'assumptions') && <AssumptionsPanel input={input} update={update} />}
          {!wide && <Footer />}
        </aside>
      </div>
    </div>
  );
}

function Header({ input, result, final, onReset }: { input: SimulationInput; result: SimulationResult | null; final: boolean; onReset: () => void }) {
  return (
    <header className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold tracking-tight lg:text-xl">Zukunfts-Fächer</h1>
        <p className="truncate text-xs text-[var(--text-secondary)]">
          Dein Vermögen von {input.startAge} bis {input.endAge}, {input.outputMode === 'real' ? 'in heutiger Kaufkraft' : 'in nominalen Euro'}
        </p>
      </div>
      {result && (
        <span className="hidden items-center gap-1 rounded-full bg-[var(--track)] px-2.5 py-1 text-xs tabular-nums text-[var(--text-secondary)] sm:inline-flex"
          title={final ? 'Volle Auflösung' : 'Schnelle Vorschau, volle Auflösung folgt'}>
          <Zap size={12} className={final ? 'text-[var(--fan)]' : 'text-[var(--text-muted)]'} />
          {Math.round(result.meta.durationMs)} ms · {num(result.meta.paths)} Szenarien
        </span>
      )}
      <button type="button" onClick={onReset} title="Auf Standard zurücksetzen"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <RotateCcw size={14} /> <span className="hidden sm:inline">Zurücksetzen</span>
      </button>
    </header>
  );
}

function Kpis({ result }: { result: SimulationResult }) {
  const s = result.summary;
  const last = result.ages.length - 1;
  const p25 = result.netWorth['25']?.[last] ?? 0, p75 = result.netWorth['75']?.[last] ?? 0;
  const risk = s.probNegativeAtEnd;
  const status = risk < 0.05 ? { icon: <ShieldCheck size={14} />, label: 'Gering', color: 'var(--good)' }
    : risk <= 0.15 ? { icon: <AlertTriangle size={14} />, label: 'Erhöht', color: 'var(--warning)' }
      : { icon: <AlertOctagon size={14} />, label: 'Hoch', color: 'var(--critical)' };
  const contributed = s.totalContributionsMedian;
  const share = s.medianAtEnd > 0 ? Math.min(1, contributed / s.medianAtEnd) : 0;
  const endAge = result.ages[last];

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 lg:mt-4 lg:grid-cols-4 lg:gap-3">
      <Kpi title={`Erwartet mit ${endAge} (Median)`} value={euro(s.medianAtEnd)} sub={`Spanne ${compactEuro(p25)} bis ${compactEuro(p75)}`} />
      <Kpi title="Schulden-Risiko" value={percent(risk, 1)}
        sub={<span className="inline-flex items-center gap-1" style={{ color: status.color }}>{status.icon}{status.label}</span>}
        hint="Anteil der Szenarien mit negativem Nettovermögen am Ende" />
      <Kpi title="Selbst in ETFs eingezahlt" value={euro(contributed)}
        sub={<span className="block">
          <span className="mb-1 flex h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
            <span className="bg-[var(--fan)]" style={{ width: `${share * 100}%` }} />
          </span>
          {s.medianAtEnd > contributed ? `${compactEuro(s.medianAtEnd - contributed)} aus Rendite & Konto` : 'Endvermögen unter den Einzahlungen'}
        </span>} />
      <Kpi title="Gezahlte Steuern" value={euro(s.totalTaxesPaidMedian)} sub="Einkommen- & Kapitalertragsteuer, Median"
        hint="Sozialabgaben sind nicht enthalten" />
    </div>
  );
}

function Kpi({ title, value, sub, hint }: { title: string; value: string; sub: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" title={hint}>
      <div className="text-xs text-[var(--text-secondary)]">{title}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums lg:text-xl">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</div>
    </div>
  );
}

function PinButton({ pinned, onPin, onUnpin, compact }: { pinned: boolean; onPin: () => void; onUnpin: () => void; compact: boolean }) {
  return pinned ? (
    <div className="flex gap-1">
      <button type="button" onClick={onPin} title="Aktuellen Stand als neue Referenz"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fan)] px-2.5 py-1.5 text-xs font-medium text-white">
        <Pin size={14} /> {compact ? 'Neu' : 'Neu einfrieren'}
      </button>
      <button type="button" onClick={onUnpin} title="Referenz entfernen"
        className="inline-flex items-center rounded-lg border border-[var(--border)] px-2 py-1.5 text-[var(--text-secondary)]">
        <PinOff size={14} />
      </button>
    </div>
  ) : (
    <button type="button" onClick={onPin}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--fan)]">
      <Pin size={14} /> {compact ? 'Pin' : 'Als Referenz einfrieren'}
    </button>
  );
}

function DeltaBadge({ pinned, delta, changes, endAge }: { pinned: boolean; delta: number | null; changes: string[]; endAge: number }) {
  if (!pinned) return null;
  if (delta === null) return <div className="mb-2 h-7 text-xs text-[var(--text-muted)]">Referenz wird berechnet …</div>;
  const cause = changes.length === 0 ? 'keine Änderung seit dem Einfrieren'
    : changes.length <= 2 ? `durch ${changes.join(' und ')}` : `durch ${changes.slice(0, 2).join(', ')} und ${changes.length - 2} weitere`;
  const tone = Math.abs(delta) < 1 ? 'var(--text-secondary)' : delta > 0 ? 'var(--good)' : 'var(--warning)';
  return (
    <div className="mb-2 flex min-h-7 flex-wrap items-center gap-x-2 text-sm" title={changes.join(', ')}>
      <span className="rounded-md px-2 py-0.5 font-semibold tabular-nums" style={{ color: tone, background: 'var(--track-soft)' }}>
        {signedEuro(delta)}
      </span>
      <span className="text-[var(--text-secondary)]">{cause} <span className="text-[var(--text-muted)]">(Median mit {endAge})</span></span>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1.5">{swatch}{label}</span>;
}

function Footer() {
  return (
    <footer className="mt-4 pb-4 text-center text-xs text-[var(--text-muted)]">
      Simulation dient nur zu Bildungszwecken – keine Finanz- oder Steuerberatung.
    </footer>
  );
}

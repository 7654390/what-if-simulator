import { Banknote, Globe, GraduationCap, Hourglass, Landmark, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import type { LifeEvent, LifePhase, SimulationInput } from '../../../src/types';
import { euro, percent, signedEuro } from '../format';
import { EventCard, Section, Segmented, Slider, Toggle } from './Controls';

export type Update = (mutate: (draft: SimulationInput) => void) => void;

const age = (v: number) => `${v.toLocaleString('de-DE')} J.`;
const months = (v: number) => `${v} Mon.`;
const pct = (digits: number) => (v: number) => percent(v, digits);

export function QuickPanel({ input, update }: { input: SimulationInput; update: Update }) {
  const lastPhase = input.phases[input.phases.length - 1]?.fromAge ?? input.startAge;
  return (
    <Section title="Schnell-Regler" icon={<Wallet size={16} />}>
      <Slider label="ETF-Sparplan monatlich" value={input.savingsPlan.monthly} min={0} max={1500} step={10} format={euro}
        onChange={(v) => update((d) => { d.savingsPlan.monthly = v; })} />
      <Toggle label="Dynamisch mit Inflation anpassen" checked={input.savingsPlan.dynamic}
        description="Die Sparrate wächst mit den Preisen und bleibt real gleich."
        onChange={(v) => update((d) => { d.savingsPlan.dynamic = v; })} />
      <Slider label="Startkapital Konto" value={input.start.cash} min={0} max={50_000} step={250} format={euro}
        onChange={(v) => update((d) => { d.start.cash = v; })} />
      <Slider label="Startkapital ETF-Depot" value={input.start.etf} min={0} max={50_000} step={250} format={euro}
        hint="Wird zum Einstandswert angenommen, also ohne bisherige Kursgewinne."
        onChange={(v) => update((d) => { d.start.etf = v; d.start.etfCostBasis = v; })} />
      <Slider label="Zielalter" value={input.endAge} min={Math.max(input.startAge + 3, Math.ceil(lastPhase) + 1)} max={50} step={1} format={age}
        onChange={(v) => update((d) => { d.endAge = v; })} />
    </Section>
  );
}

function eventMeta(type: LifeEvent['type']) {
  switch (type) {
    case 'semesterAbroad': return { icon: <Globe size={18} />, title: 'Auslandssemester', description: 'Kostet erst Geld, kann aber später das Gehalt anheben.' };
    case 'bafoeg': return { icon: <GraduationCap size={18} />, title: 'BAföG', description: 'Hälfte Zuschuss, Hälfte zinsloses Darlehen mit Rückzahlungsdeckel.' };
    case 'studentLoan': return { icon: <Landmark size={18} />, title: 'Studienkredit', description: 'Monatliche Auszahlung, Karenzzeit, danach Tilgung mit Zinsen.' };
    case 'partTime': return { icon: <Hourglass size={18} />, title: 'Teilzeit-Phase', description: 'Weniger Stunden, weniger Gehalt, mehr Leben.' };
    case 'oneOff': return { icon: <Sparkles size={18} />, title: 'Einmalbetrag', description: 'Große Ausgabe (Weltreise, Auto) oder Einnahme (Erbe, Startzuschuss).' };
  }
}

export function DecisionsPanel({ input, update }: { input: SimulationInput; update: Update }) {
  const { startAge, endAge } = input;
  const setEvent = <T extends LifeEvent>(id: string, mutate: (e: T) => void) =>
    update((d) => { const e = d.events.find((x) => x.id === id); if (e) mutate(e as T); });
  const ageSlider = (label: string, value: number, onChange: (v: number) => void, min = startAge, max = endAge - 0.5) => (
    <Slider label={label} value={value} min={min} max={max} step={0.5} format={age} onChange={onChange} />
  );

  return (
    <div className="space-y-3">
      <h2 className="px-1 text-sm font-semibold text-[var(--text-primary)]">Lebens-Entscheidungen</h2>
      {input.events.map((event) => {
        const meta = eventMeta(event.type);
        const toggle = (v: boolean) => setEvent(event.id, (e) => { e.enabled = v; });
        return (
          <EventCard key={event.id} {...meta} title={event.type === 'oneOff' && event.label ? `${meta.title}: ${event.label}` : meta.title}
            enabled={event.enabled} onToggle={toggle}>
            {event.type === 'semesterAbroad' && <>
              {ageSlider('Beginn mit', event.atAge, (v) => setEvent<typeof event>(event.id, (e) => { e.atAge = v; }))}
              <Slider label="Dauer" value={event.months} min={1} max={12} step={1} format={months} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.months = v; })} />
              <Slider label="Zusatzkosten pro Monat" value={event.extraCostsMonthly} min={0} max={2000} step={25} format={euro} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.extraCostsMonthly = v; })} />
              <Slider label="Stipendium / Erasmus pro Monat" value={event.grantMonthly} min={0} max={1200} step={25} format={euro} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.grantMonthly = v; })} />
              <Slider label="Gehaltsboost danach" value={event.salaryBoostAfter} min={0} max={0.1} step={0.005} format={(v) => `+${percent(v, 1)}`} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.salaryBoostAfter = v; })} />
            </>}
            {event.type === 'bafoeg' && <>
              {ageSlider('Beginn mit', event.atAge, (v) => setEvent<typeof event>(event.id, (e) => { e.atAge = v; }))}
              <Slider label="BAföG pro Monat" value={event.monthly} min={50} max={1000} step={10} format={euro} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.monthly = v; })} />
              <Slider label="Förderdauer" value={event.months} min={6} max={72} step={6} format={months} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.months = v; })} />
            </>}
            {event.type === 'studentLoan' && <>
              {ageSlider('Beginn mit', event.atAge, (v) => setEvent<typeof event>(event.id, (e) => { e.atAge = v; }))}
              <Slider label="Auszahlung pro Monat" value={event.payoutMonthly} min={100} max={1000} step={50} format={euro} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.payoutMonthly = v; })} />
              <Slider label="Auszahlungsdauer" value={event.payoutMonths} min={6} max={72} step={6} format={months} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.payoutMonths = v; })} />
              <Slider label="Zinssatz" value={event.interestRate} min={0} max={0.1} step={0.0025} format={pct(2)} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.interestRate = v; })} />
              <Slider label="Karenzzeit" value={event.graceMonths} min={0} max={36} step={3} format={months} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.graceMonths = v; })} />
              <Slider label="Tilgungsdauer" value={event.repaymentMonths} min={12} max={240} step={12} format={months} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.repaymentMonths = v; })} />
            </>}
            {event.type === 'partTime' && <>
              {ageSlider('Von', event.fromAge, (v) => setEvent<typeof event>(event.id, (e) => { e.fromAge = v; e.toAge = Math.max(e.toAge, v + 0.5); }))}
              {ageSlider('Bis', event.toAge, (v) => setEvent<typeof event>(event.id, (e) => { e.toAge = v; e.fromAge = Math.min(e.fromAge, v - 0.5); }), startAge + 0.5, endAge)}
              <Slider label="Arbeitszeit" value={event.factor} min={0.5} max={0.9} step={0.05} format={pct(0)} onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.factor = v; })} />
            </>}
            {event.type === 'oneOff' && <>
              <label className="block space-y-1.5">
                <span className="text-sm text-[var(--text-secondary)]">Bezeichnung</span>
                <input type="text" value={event.label} maxLength={40}
                  onChange={(e) => { const label = e.target.value; setEvent<typeof event>(event.id, (x) => { x.label = label; }); }}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm text-[var(--text-primary)]" />
              </label>
              {ageSlider('Mit', event.atAge, (v) => setEvent<typeof event>(event.id, (e) => { e.atAge = v; }))}
              <Slider label="Betrag" value={event.amount} min={-30_000} max={30_000} step={500} format={signedEuro}
                hint="Negativ ist eine Ausgabe, positiv eine Einnahme." onChange={(v) => setEvent<typeof event>(event.id, (e) => { e.amount = v; })} />
            </>}
          </EventCard>
        );
      })}
    </div>
  );
}

const TAX_LABEL: Record<LifePhase['taxClass'], string> = { standard: 'Normal', werkstudent: 'Werkstudent', minijob: 'Minijob' };

export function AssumptionsPanel({ input, update }: { input: SimulationInput; update: Update }) {
  const setPhase = (i: number, mutate: (p: LifePhase) => void) => update((d) => mutate(d.phases[i]));
  return (
    <div className="space-y-3">
      <Section title="Lebensphasen & Gehalt" icon={<Banknote size={16} />} defaultOpen={false}>
        {input.phases.map((phase, i) => (
          <div key={phase.id} className="space-y-4 rounded-lg bg-[var(--track-soft)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{phase.label}</span>
              <Segmented label={`Abgaben ${phase.label}`} value={phase.taxClass}
                options={(Object.keys(TAX_LABEL) as LifePhase['taxClass'][]).map((v) => ({ value: v, label: TAX_LABEL[v] }))}
                onChange={(v) => setPhase(i, (p) => { p.taxClass = v; })} />
            </div>
            {i > 0 && (
              <Slider label="Beginnt mit" value={phase.fromAge} step={0.5} format={age}
                min={input.phases[i - 1].fromAge + 0.5} max={Math.min(input.endAge - 1, input.phases[i + 1]?.fromAge ?? Infinity) - 0.5}
                onChange={(v) => setPhase(i, (p) => { p.fromAge = v; })} />
            )}
            <Slider label="Brutto pro Monat (heutige €)" value={phase.grossMonthly} min={0} max={8000} step={50} format={euro}
              onChange={(v) => setPhase(i, (p) => { p.grossMonthly = v; })} />
            <Slider label="Lebenshaltung pro Monat" value={phase.livingCostsMonthly} min={300} max={4000} step={25} format={euro}
              onChange={(v) => setPhase(i, (p) => { p.livingCostsMonthly = v; })} />
            {phase.kind === 'work' && (
              <Slider label="Reales Gehaltswachstum p. a." value={phase.salaryGrowth} min={0} max={0.06} step={0.0025} format={pct(2)}
                onChange={(v) => setPhase(i, (p) => { p.salaryGrowth = v; })} />
            )}
          </div>
        ))}
      </Section>
      <Section title="Markt & Crash-Risiko" icon={<TrendingUp size={16} />} defaultOpen={false}>
        <Slider label="Erwartete ETF-Rendite p. a." value={input.market.etfReturn} min={0} max={0.12} step={0.0025} format={pct(2)}
          onChange={(v) => update((d) => { d.market.etfReturn = v; })} />
        <Slider label="Volatilität p. a." value={input.market.etfVolatility} min={0.05} max={0.35} step={0.01} format={pct(0)}
          onChange={(v) => update((d) => { d.market.etfVolatility = v; })} />
        <Slider label="Inflation p. a. (Mittelwert)" value={input.market.inflationMean} min={0} max={0.06} step={0.0025} format={pct(2)}
          onChange={(v) => update((d) => { d.market.inflationMean = v; })} />
        <Toggle label="Fat Tails" description="Extremszenarien und Börsencrashs häufiger simulieren." checked={input.market.fatTails}
          onChange={(v) => update((d) => { d.market.fatTails = v; })} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--text-secondary)]">Anzahl Szenarien</span>
          <Segmented label="Anzahl Szenarien" value={input.paths}
            options={[{ value: 2000, label: '2.000' }, { value: 10000, label: '10.000' }, { value: 25000, label: '25.000' }]}
            onChange={(v) => update((d) => { d.paths = v; })} />
        </div>
        <p className="text-xs text-[var(--text-muted)]">Marktregler erzeugen neue Zufallspfade und rechnen deshalb spürbar länger als die übrigen Regler.</p>
      </Section>
    </div>
  );
}

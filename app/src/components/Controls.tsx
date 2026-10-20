import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}

export function Slider({ label, value, min, max, step, format, onChange, hint }: SliderProps) {
  const id = useId();
  const fill = ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-[var(--text-secondary)]">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range w-full" style={{ '--fill': `${fill}%` } as React.CSSProperties} />
      {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm text-[var(--text-primary)]">{label}</span>
        {description && <span className="block text-xs text-[var(--text-muted)]">{description}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[var(--fan)]' : 'bg-[var(--track)]'}`}>
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)]">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">{children}</div>}
    </section>
  );
}

interface EventCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: ReactNode;
}

export function EventCard({ icon, title, description, enabled, onToggle, children }: EventCardProps) {
  return (
    <div className={`rounded-xl border transition-colors ${enabled ? 'border-[var(--fan)] bg-[var(--fan-soft)]' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 rounded-lg p-2 ${enabled ? 'bg-[var(--fan)] text-white' : 'bg-[var(--track)] text-[var(--text-secondary)]'}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        </div>
        <Switch checked={enabled} onChange={onToggle} label={title} />
      </div>
      {enabled && <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">{children}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-[var(--track)] p-0.5">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${o.value === value
            ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

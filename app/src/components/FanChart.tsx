import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { compactEuro, euro } from '../format';
import { useTween, type Series } from '../useTween';

export interface Marker { age: number; label: string }

interface Props {
  ages: number[];
  bands: Series; // Schlüssel "5" | "25" | "50" | "75" | "95"
  samples?: number[][];
  ghost?: number[];
  markers: Marker[];
  height: number;
}

const M = { top: 34, right: 16, bottom: 28, left: 64 };

function niceStep(span: number, ticks: number): number {
  const raw = span / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function linePath(xs: number[], ys: number[]): string {
  let d = '';
  for (let i = 0; i < xs.length; i++) d += `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`;
  return d;
}

function areaPath(xs: number[], upper: number[], lower: number[]): string {
  let d = linePath(xs, upper);
  for (let i = xs.length - 1; i >= 0; i--) d += `L${xs[i].toFixed(1)},${lower[i].toFixed(1)}`;
  return d + 'Z';
}

export function FanChart({ ages, bands, samples, ghost, markers, height }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Alles, was sich bewegen soll, in eine Serie packen und gemeinsam gleiten lassen.
  const target = useMemo(() => {
    const s: Series = { ...bands };
    samples?.forEach((path, i) => { s[`s${i}`] = path; });
    if (ghost && ghost.length === ages.length) s.ghost = ghost;
    return s;
  }, [bands, samples, ghost, ages.length]);
  const shown = useTween(target);

  const p5 = shown['5'] ?? [], p25 = shown['25'] ?? [], p50 = shown['50'] ?? [], p75 = shown['75'] ?? [], p95 = shown['95'] ?? [];
  const sampleKeys = Object.keys(shown).filter((k) => k.startsWith('s'));

  let lo = Math.min(0, ...p5), hi = Math.max(0, ...p95);
  if (shown.ghost) { lo = Math.min(lo, ...shown.ghost); hi = Math.max(hi, ...shown.ghost); }
  if (hi - lo < 1) hi = lo + 1;
  const step = niceStep(hi - lo, height < 300 ? 4 : 6);
  const yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step;

  const innerW = width - M.left - M.right, innerH = height - M.top - M.bottom;
  const a0 = ages[0] ?? 0, a1 = ages[ages.length - 1] ?? 1;
  const x = (age: number) => M.left + ((age - a0) / Math.max(1, a1 - a0)) * innerW;
  const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const xs = ages.map(x);
  const ys = (vals: number[]) => vals.map(y);

  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v);
  const ageStep = innerW < 420 ? 5 : innerW < 700 ? 2 : 1;
  const ageTicks = ages.filter((a) => (a - a0) % ageStep === 0 || a === a1);

  const visibleMarkers = markers.filter((m) => m.age > a0 && m.age < a1).sort((a, b) => a.age - b.age);
  let lastX = -Infinity, row = 0;
  const placedMarkers = visibleMarkers.map((m) => {
    const mx = x(m.age);
    row = mx - lastX < 110 ? (row + 1) % 2 : 0;
    lastX = mx;
    return { ...m, x: mx, row };
  });

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
    setHover(best);
  }

  const zeroY = y(0);
  const h = hover !== null && hover < ages.length ? hover : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <svg width={width} height={height} className="block touch-none" onPointerMove={onMove} onPointerDown={onMove}
        onPointerLeave={() => setHover(null)} role="img"
        aria-label={`Fächerdiagramm von Alter ${a0} bis ${a1}. Median am Ende ${euro(p50[p50.length - 1] ?? 0)}.`}>
        {/* Schuldenbereich */}
        {yMin < 0 && <rect x={M.left} y={zeroY} width={innerW} height={M.top + innerH - zeroY} fill="var(--debt)" opacity={0.08} />}

        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--text-muted)] text-[11px] tabular-nums">{compactEuro(t)}</text>
          </g>
        ))}
        {ageTicks.map((a) => (
          <text key={a} x={x(a)} y={height - 8} textAnchor="middle" className="fill-[var(--text-muted)] text-[11px] tabular-nums">{a}</text>
        ))}

        {placedMarkers.map((m) => (
          <g key={`${m.label}-${m.age}`}>
            <line x1={m.x} x2={m.x} y1={M.top - 4} y2={M.top + innerH} stroke="var(--marker)" strokeDasharray="3 4" strokeWidth={1} />
            <text x={m.x + 4} y={14 + m.row * 13} className="fill-[var(--text-secondary)] text-[11px]">{m.label}</text>
          </g>
        ))}

        {sampleKeys.map((k) => (
          <path key={k} d={linePath(xs, ys(shown[k]))} fill="none" stroke="var(--fan)" strokeWidth={1} opacity={0.18} />
        ))}

        {p5.length === xs.length && <path d={areaPath(xs, ys(p95), ys(p5))} fill="var(--fan)" opacity={0.14} />}
        {p25.length === xs.length && <path d={areaPath(xs, ys(p75), ys(p25))} fill="var(--fan)" opacity={0.28} />}

        {yMin < 0 && <line x1={M.left} x2={M.left + innerW} y1={zeroY} y2={zeroY} stroke="var(--debt)" strokeWidth={1.5} />}

        {shown.ghost && (
          <path d={linePath(xs, ys(shown.ghost))} fill="none" stroke="var(--ghost)" strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />
        )}
        {p50.length === xs.length && (
          <path d={linePath(xs, ys(p50))} fill="none" stroke="var(--fan)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {h !== null && (
          <g pointerEvents="none">
            <line x1={xs[h]} x2={xs[h]} y1={M.top} y2={M.top + innerH} stroke="var(--text-muted)" strokeWidth={1} />
            {[p95[h], p50[h], p5[h]].map((v, i) => (
              <circle key={i} cx={xs[h]} cy={y(v)} r={i === 1 ? 5 : 4} fill={i === 1 ? 'var(--fan)' : 'var(--surface)'}
                stroke={i === 1 ? 'var(--surface)' : 'var(--fan)'} strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>

      {h !== null && (
        <div className="pointer-events-none absolute z-10 min-w-44 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-xs shadow-lg"
          style={{ top: M.top, left: xs[h] > width * 0.6 ? undefined : xs[h] + 12, right: xs[h] > width * 0.6 ? width - xs[h] + 12 : undefined }}>
          <div className="mb-1 font-semibold text-[var(--text-primary)]">Alter {ages[h]}</div>
          <Row label="Best Case (P95)" value={p95[h]} />
          <Row label="Median (P50)" value={p50[h]} strong />
          <Row label="Worst Case (P5)" value={p5[h]} />
          {shown.ghost && <Row label="Referenz (P50)" value={shown.ghost[h]} muted />}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4 tabular-nums">
      <span className={muted ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}>{label}</span>
      <span className={strong ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}>{euro(value)}</span>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

export type Series = Record<string, number[]>;

const compatible = (a: Series, b: Series) => {
  const keys = Object.keys(b);
  return keys.length === Object.keys(a).length && keys.every((k) => a[k] && a[k].length === b[k].length);
};

/**
 * Gleitet von den zuletzt gezeigten Werten zu neuen Zielwerten (requestAnimationFrame).
 * Ergebnisse kommen beim Ziehen etwa 10–30× pro Sekunde, gezeichnet wird mit voller Bildrate.
 */
export function useTween(target: Series, duration = 220): Series {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (!compatible(from, target)) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - k) ** 3;
      const next: Series = {};
      for (const key in target) {
        const a = from[key], b = target[key];
        next[key] = b.map((v, i) => a[i] + (v - a[i]) * ease);
      }
      shownRef.current = next;
      setShown(next);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}

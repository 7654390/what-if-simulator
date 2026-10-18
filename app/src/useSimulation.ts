import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineClient } from '../../src/client';
import { diff } from '../../src/index';
import { validateInput } from '../../src/validate';
import type { SimulationInput, SimulationResult } from '../../src/types';
import { createCoalescingClient } from './engine/coalescingClient';
import { describeChanges } from './scenario';

export interface SimulationState {
  result: SimulationResult | null;
  final: boolean;
  errors: string[];
  /** Eingefrorene Referenz, neu gerechnet mit aktuellem Zielalter, Kaufkraftmodus und Pfadzahl. */
  reference: SimulationResult | null;
  pinned: boolean;
  pin: () => void;
  unpin: () => void;
  medianDelta: number | null;
  changes: string[];
}

const isAbort = (e: unknown) => e instanceof Error && e.name === 'AbortError';

export function useSimulation(input: SimulationInput): SimulationState {
  const clientRef = useRef<EngineClient | null>(null);
  const referenceClientRef = useRef<EngineClient | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [final, setFinal] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pinnedInput, setPinnedInput] = useState<SimulationInput | null>(null);
  const [reference, setReference] = useState<SimulationResult | null>(null);

  useEffect(() => {
    clientRef.current = createCoalescingClient();
    referenceClientRef.current = createCoalescingClient();
    return () => {
      clientRef.current?.dispose();
      referenceClientRef.current?.dispose();
      clientRef.current = referenceClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    const validation = validateInput(input);
    if (!validation.ok) { setErrors(validation.errors); return; }
    setErrors([]);
    return client.runProgressive(validation.value, (r, isFinal) => {
      setResult(r);
      setFinal(isFinal);
    }, (error) => setErrors([error.message]));
  }, [input]);

  const { endAge, outputMode, paths } = input;
  useEffect(() => {
    const client = referenceClientRef.current;
    if (!pinnedInput || !client) { setReference(null); return; }
    // Zielalter, Kaufkraft und Pfadzahl sind Ansichtseinstellungen und gelten für beide Szenarien.
    const validation = validateInput({ ...pinnedInput, endAge, outputMode, paths });
    if (!validation.ok) { setReference(null); return; }
    let live = true;
    client.run(validation.value).then((r) => { if (live) setReference(r); }, (e) => { if (!isAbort(e)) console.error(e); });
    return () => { live = false; };
  }, [pinnedInput, endAge, outputMode, paths]);

  const medianDelta = useMemo(() => {
    if (!reference || !result) return null;
    try { return diff(reference, result).medianDeltaAtEnd; } catch { return null; }
  }, [reference, result]);

  const changes = useMemo(() => (pinnedInput ? describeChanges(pinnedInput, input) : []), [pinnedInput, input]);

  return {
    result, final, errors, reference,
    pinned: pinnedInput !== null,
    pin: () => setPinnedInput(structuredClone(input)),
    unpin: () => setPinnedInput(null),
    medianDelta, changes,
  };
}

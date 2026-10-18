# What-if Simulator

Deterministische Monte-Carlo-Engine für persönliche Finanz- und Lebensszenarien in Deutschland. TypeScript strict, ES2022, keine Laufzeit-Abhängigkeiten und kein UI. **Keine Finanzberatung.**

## Cockpit

Das interaktive Frontend liegt in [`app/`](app/README.md): `cd app && npm ci && npm run dev`.

## Installation und Entwicklung

Node.js ab 22.12 (getestet mit Node 24), npm und das vorhandene Checkout verwenden:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:built
npm run demo
```

`npm run demo` druckt Alter × Perzentile für 10.000 Pfade von 20 bis 35 Jahren. Der Library-Build enthält ESM, Deklarationen und ein separat geladenes Worker-Asset. Beim Kopieren des Builds immer das vollständige `dist/` einschließlich `assets/` und gemeinsamer Chunks übernehmen. Kein Server, API-Key oder externer Dienst ist erforderlich. Node nutzt den synchronen Kern; der Client setzt einen Browser mit Modul-Workern voraus.

## Browser-Client: zehn Zeilen

Nach dem Build, in einem Browser-ES-Modul (der konsumierende Bundler muss relative Worker-Assets erhalten):

```ts
import { createEngineClient, defaultInput } from './dist/index.js';
const client = createEngineClient();
const input = defaultInput();
const cancel = client.runProgressive(input, (result, final) => {
  console.log(final ? 'Vollständig' : 'Vorschau', result.netWorth);
}, console.error);
// Beim nächsten Reglerwert erneut runProgressive mit neuem Input aufrufen.
// Beim Abbrechen oder Abbau des Cockpits beide Schritte ausführen:
cancel();
client.dispose();
```

`run(input)` liefert ein Promise. Eine neuere Anfrage verwirft die ältere: deren Promise wird mit `name === 'AbortError'` abgelehnt. Ein beschäftigter Worker wird tatsächlich beendet und ersetzt; ein unbeschäftigter bleibt für seine Caches erhalten. Es entsteht kein Nachrichtenrückstau. `runProgressive` liefert zunächst 1.000 Pfade und anschließend automatisch die volle Auflösung; bei höchstens 1.000 Pfaden nur das finale Ergebnis. Der zurückgegebene Cancel-Aufruf stoppt beide Stufen. Ein optionaler dritter Callback nimmt Fehler entgegen; ohne ihn werden Fehler über `reportError` bzw. die Konsole gemeldet. Der Input wird für beide Stufen kopiert.

## Synchrone API und Ausgabe

```ts
import { defaultInput, simulate, validateInput, diff } from './dist/index.js';
const input = defaultInput();
const validation = validateInput(input);
if (!validation.ok) throw new Error(validation.errors.join('\n'));
const baseline = simulate(validation.value);
input.savingsPlan.monthly = 210;
const comparison = diff(baseline, simulate(input)); // b minus a
console.log(comparison.medianDeltaAtEnd);
```

- `src/types.ts` ist der öffentliche Typvertrag. `targetNetWorth?: number` ergänzt die optionale Zielwahrscheinlichkeit. `defaultInput()` liefert jedes Mal ein neues, vollständig belegtes Beispiel; die Pflichtfelder werden bei fehlenden Werten nicht stillschweigend ergänzt.
- `validateInput(unknown)` prüft endliche Zahlen, 500–50.000 Pfade, Phasen, Ereignisse, IDs und Perzentile mit deutschen Fehlermeldungen. `simulate` validiert ebenfalls und wirft bei ungültigen Eingaben einen `TypeError`.
- Das jährliche Raster enthält Start und Ende. Die Laufzeit muss eine positive ganze Anzahl Jahre betragen; Startalter und Phasen dürfen gebrochene Alterswerte haben. Monatsgrenzen werden auf den nächsten Monat gerundet. Eine Phase endet beim Beginn der nächsten, die letzte am Zielalter. Ereignisse nach dem Zielalter bleiben ohne Wirkung.
- Alle Bänder sind marginale, linear interpolierte Perzentile (R-7). Komponentenperzentile addieren sich deshalb im Allgemeinen **nicht** zum Nettovermögensperzentil. ETF-Komponenten enthalten bereits latente Steuer; Dispo wird als Schuld ausgewiesen. Die ersten 20 Pfade dienen als reproduzierbare Beispiele.
- `diff(a, b)` berechnet **b − a** und verlangt gleiche Altersraster, Perzentile und Ausgabemodi.
- Gleicher Seed und gleicher Input ergeben einschließlich Metadaten bitgleiche Ergebnisse im selben JS-Runtime. `meta.durationMs` ist deshalb bewusst immer **0**; echte Laufzeit separat mit `performance.now()` messen. Engine-Version: `0.1.0`.

## Modell und Grenzen

Monatliche ETF-Renditen, Inflation als AR(1), Gehaltsrauschen, vereinfachter Einkommensteuertarif 2026, Sozialabgaben, ETF-Entnahmen mit Pauschbetrag und Teilfreistellung, Studienkredit, BAföG, Ausland, Teilzeit und einmalige Zahlungen sind implementiert. Die konfigurierbaren Tarifkonstanten liegen in `src/taxDE.ts`; die Hilfsfunktion `incomeTax` akzeptiert einen alternativen Tarif. Die Simulation verwendet den dort hinterlegten Basistarif. Sämtliche Vereinfachungen und Reihenfolgen stehen in [ASSUMPTIONS.md](ASSUMPTIONS.md).

**Common Random Numbers bedeuten keine garantierte monotone Rendite.** Zufallsströme hängen ausschließlich von Seed, Pfad und Monat ab, unabhängig von Sparrate, Ereignissen und Feature-Schaltern. Mehr ETF-Sparen verschiebt aber Geld vom Tagesgeld in riskante Anlagen: bei Verlusten kann selbst mit identischen Zufallszahlen ein Perzentil sinken. Eine universelle Forderung „200 → 210 EUR lässt jedes Perzentil steigen“ widerspricht diesem Finanzmodell. Tests belegen sowohl Monotonie bei sicheren positiven Mehrerträgen als auch einen korrekten Verlustfall; Verluste werden nicht künstlich entfernt.

## Benchmarks

```sh
npm run bench
npm run build
npm run bench:worker
```

`vitest bench` misst 10.000 Pfade × 14 Jahre mit sämtlichen Komponenten, fünf Perzentilen und Kennzahlen. Die warme Messung wechselt den Sparplan zwischen 200 und 210 EUR; kalte Messungen wechseln den Seed. Der separate Worker-Benchmark führt das gebaute Browser-Worker-Asset in einem Node-Worker mit Nachrichtenport-Adapter aus, einschließlich Nachrichtenübertragung. Das ist kein Browser- oder Laptop-Benchmark.

Gemessen am 18.10.2026 in der Cloud auf AMD EPYC 9V74 (fünf sichtbare logische CPUs, Engine rechnet einsträngig), Node **24.19.0**, Vitest **4.1.12**:

| Messung, je 10.000 Pfade | Warmer Aufruf | Kalter Aufruf |
| --- | --- | --- |
| Vitest, 14 Jahre | Mittel **46,69 ms**, Min. 41,68 / Max. 60,82 ms, 22 Messungen | Mittel **324,77 ms**, 5 Messungen mit neuem Seed |
| Gebauter Worker, 14 Jahre | Median **46,83 ms**, p95 57,28 ms, 30 Messungen | **368,36 ms**, erste Anfrage einschließlich Workerstart |
| Gebauter Worker, 15 Jahre | Median **47,63 ms**, p95 99,92 ms, 30 Messungen | **439,55 ms**, erste Anfrage einschließlich Workerstart |

Der warme Median liegt damit unter 50 ms; einzelne Aufrufe und insbesondere kalte Aufrufe liegen darüber. Die Werte sind eine Messung dieser Instanz, keine plattformübergreifende Zusicherung.

Die Caches speichern **keine Ergebnisse**: jede Anfrage simuliert alle Pfade erneut. Marktfaktoren und Lohnabrechnung werden für wiederholte Reglerbewegungen wiederverwendet, solange ihre jeweiligen Eingaben gleich bleiben. Die Eintragszahl ist auf je einen Cache mit höchstens 2,5 Millionen Monatsschritten begrenzt (ca. 100 MB für die fünf Float64-Felder, zusätzlich jährliche Ergebnisse). Größere Anfragen streamen pfadweise ohne vollständigen Monatscache. Neuer Seed, Markteingaben oder ein unter Last ersetzter Worker verursachen einen kalten Aufruf.

**Das pauschale Ziel unter 50 ms ist für kalte Aufrufe derzeit nicht erreicht.** Vorschau, echte Worker-Unterbrechung und warme Caches halten die Reglerbedienung responsiv; eine Erstberechnung darf entsprechend länger dauern. Es wird keine universelle Hardwaregarantie behauptet.

## Tests und CI

Vitest prüft Determinismus einschließlich Cache-Wechsel, gemeinsame Zufallsströme über Pfadzahl und Horizont, Zinseszins, Steuerbeispiele, Entnahmen, Kreditannuitäten, BAföG, Ereignisse, Dispo, Perzentilauswahl, Eingabevalidierung sowie die Client-Lebenszyklen. Ein echter isolierter Worker wird mit dem synchronen Kern verglichen. `test:built` prüft zusätzlich das gebaute Client-Asset und dessen relative Worker-Auflösung. Der Node-Adapter dient Tests und Benchmarks; der Produktionskern benötigt ihn nicht.

CI läuft ausschließlich auf `ubuntu-latest` und führt Installation aus dem Lockfile, Typprüfung, Tests, Build, gebaute Worker-Tests und CLI aus. Laufzeit-Benchmarks sind wegen schwankender geteilter CI-Hardware kein harter CI-Grenzwert. `.gitignore` schließt Umgebungsdateien, private Schlüssel und lokale IDE-Dateien aus.

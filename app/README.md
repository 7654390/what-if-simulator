# Cockpit

Interaktives Frontend für die Engine im Hauptordner: Schieberegler für Lebens-Entscheidungen, ein Zukunfts-Fächer, der sich beim Ziehen in Echtzeit verformt, und ein Vergleich gegen einen eingefrorenen Stand. React 18, TypeScript strict, Vite, Tailwind CSS, lucide-react. Läuft komplett im Browser, ohne Server und ohne externe Dienste.

```sh
cd app
npm ci
npm run dev      # Entwicklungsserver
npm run build    # Typprüfung + Produktions-Build nach app/dist
```

## Anbindung an die Engine

Das Cockpit importiert die Engine direkt aus `../src` (Typen, `validateInput`, `diff`, `defaultInput`, `simulate`). Es gibt keinen Mock: die echte Engine ist vorhanden.

Statt `createEngineClient()` aus `src/client.ts` nutzt das Cockpit `createCoalescingClient()` aus `src/engine/coalescingClient.ts`. Beide erfüllen denselben `EngineClient`-Vertrag; der Unterschied liegt in der Planung:

- Der Engine-Client beendet einen beschäftigten Worker bei jeder neueren Anfrage. Damit gehen die Markt- und Lohn-Caches verloren, und beim Ziehen eines Reglers wird fast jeder Schritt zum kalten Aufruf (300 ms und mehr).
- Der Engine-Cache hängt an der Pfadzahl. Vorschau (1.000 Pfade) und volle Auflösung (10.000) im selben Worker verdrängen sich deshalb gegenseitig.
- Der Cockpit-Client lässt laufende Rechnungen zu Ende laufen und hält höchstens die neueste Anfrage in der Warteschlange. Vorschau und volle Auflösung laufen in zwei getrennten Workern, jeder mit eigenem warmem Cache.

Zwischen zwei Ergebnissen gleitet der Fächer per `requestAnimationFrame` weiter, damit das Bild auch dann flüssig bleibt, wenn neue Zahlen nur 10–30× pro Sekunde kommen. `meta.durationMs` ist in der Engine bewusst immer 0; der Worker des Cockpits misst die Rechenzeit selbst und trägt sie für die Anzeige ein.

Gemessen im Headless-Chromium beim Ziehen des Sparplan-Reglers: Vorschau 5–18 ms, volle Auflösung 50–145 ms, Bildrate konstant 60 FPS. Markt-Regler erzeugen neue Zufallspfade und sind langsamer (Vorschau 50–100 ms, volle Auflösung ca. 0,8 s).

## Bedienung

- **Pin:** friert den aktuellen Stand als Referenz ein. Die Referenz wird mit dem aktuellen Zielalter, Kaufkraftmodus und der Pfadzahl neu gerechnet, damit der Vergleich fair bleibt; alles andere bleibt eingefroren.
- Eingaben werden im `localStorage` gespeichert; „Zurücksetzen“ stellt den Standard wieder her.
- `defaultInput()` der Engine enthält kein BAföG- und kein Einmalbetrag-Event; das Cockpit ergänzt beide (ausgeschaltet).

Simulation dient nur zu Bildungszwecken – keine Finanz- oder Steuerberatung.

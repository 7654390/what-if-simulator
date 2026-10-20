import { defaultInput, simulate } from '../src/index.js';

const input = defaultInput();
const start = performance.now();
const result = simulate(input);
const elapsed = performance.now() - start;
const format = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 });
console.log(`Vermögen in heutigen Euro · ${result.meta.paths.toLocaleString('de-DE')} Pfade · Seed ${result.meta.seed}`);
console.log(['Alter', ...Object.keys(result.netWorth).map(p => `p${p} (€)`)].join('\t'));
for (let i = 0; i < result.ages.length; i++) {
  console.log([result.ages[i], ...Object.values(result.netWorth).map(band => format(band[i]))].join('\t'));
}
console.log(`Laufzeit (einschließlich kaltem Marktcache): ${elapsed.toFixed(1)} ms`);
console.log('Keine Finanzberatung.');

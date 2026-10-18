const euroFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export const euro = (value: number) => euroFormat.format(Math.round(value));
export const signedEuro = (value: number) => (value > 0 ? '+ ' : value < 0 ? '− ' : '± ') + euro(Math.abs(value));
export const num = (value: number) => numberFormat.format(value);
export const percent = (value: number, digits = 0) =>
  `${(value * 100).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

/** Kurzform für Achsen: 1.200 €, 45 T€, 1,2 Mio. € */
export function compactEuro(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €`;
  if (abs >= 10_000) return `${sign}${numberFormat.format(abs / 1_000)} T€`;
  return `${sign}${numberFormat.format(abs)} €`;
}

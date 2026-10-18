// Marsaglia's 128-strip normal ziggurat. Tables are generated once from the strip area.
const NORMAL_EDGE = 3.442619855899;
const thresholds = new Uint32Array(128);
const widths = new Float64Array(128);
const heights = new Float64Array(128);
{
  const scale = 2147483648;
  const area = 0.00991256303526217;
  let edge = NORMAL_EDGE;
  let previous = edge;
  const q = area / Math.exp(-0.5 * edge * edge);
  thresholds[0] = Math.floor(edge / q * scale);
  thresholds[1] = 0;
  widths[0] = q / scale;
  widths[127] = edge / scale;
  heights[0] = 1;
  heights[127] = Math.exp(-0.5 * edge * edge);
  for (let i = 126; i >= 1; i--) {
    edge = Math.sqrt(-2 * Math.log(area / edge + Math.exp(-0.5 * edge * edge)));
    thresholds[i + 1] = Math.floor(edge / previous * scale);
    previous = edge;
    heights[i] = Math.exp(-0.5 * edge * edge);
    widths[i] = edge / scale;
  }
}

/** Fixed per-path stream: horizon, phases and event branches never affect draws. */
export class Random {
  private state: number;

  constructor(seed: number, path = 0) {
    let x = (seed >>> 0) ^ Math.imul(path + 1, 0x9e3779b9);
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    this.state = (x ^ (x >>> 15)) >>> 0;
  }

  private int32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let x = this.state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (x ^ (x >>> 14)) | 0;
  }

  uniform(): number {
    // Open interval: log(0) is impossible.
    return (this.int32() >>> 0) / 4294967296 + 0.5 / 4294967296;
  }

  normal(): number {
    for (;;) {
      const bits = this.int32();
      const strip = bits & 127;
      if (Math.abs(bits) < thresholds[strip]) return bits * widths[strip];
      if (strip === 0) {
        let x: number, y: number;
        do {
          x = -Math.log(this.uniform()) / NORMAL_EDGE;
          y = -Math.log(this.uniform());
        } while (2 * y < x * x);
        return bits > 0 ? NORMAL_EDGE + x : -NORMAL_EDGE - x;
      }
      const x = bits * widths[strip];
      if (heights[strip] + this.uniform() * (heights[strip - 1] - heights[strip]) < Math.exp(-0.5 * x * x)) return x;
    }
  }
}

export interface Shocks { equity: number; inflation: number; salary: number; studentT: number }

/** Exactly eight normals per month, even when a feature is disabled. */
export function nextShocks(rng: Random, out: Shocks): void {
  const equity = rng.normal();
  out.equity = equity;
  out.inflation = rng.normal();
  out.salary = rng.normal();
  let chiSquared = 0;
  for (let i = 0; i < 5; i++) {
    const z = rng.normal();
    chiSquared += z * z;
  }
  // Student-t(5), normalized to unit variance.
  out.studentT = equity * Math.sqrt(3 / chiSquared);
}

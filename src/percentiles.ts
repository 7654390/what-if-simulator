/** In-place quickselect; no sort or allocation per percentile. */
function select(a: Float64Array, k: number, left = 0, right = a.length - 1): number {
  while (left < right) {
    const pivot = a[(left + right) >>> 1];
    let i = left;
    let j = right;
    while (i <= j) {
      while (a[i] < pivot) i++;
      while (a[j] > pivot) j--;
      if (i <= j) {
        const tmp = a[i]; a[i++] = a[j]; a[j--] = tmp;
      }
    }
    if (k <= j) right = j;
    else if (k >= i) left = i;
    else break;
  }
  return a[k];
}

/** Partition once per rank tree, reusing the partitions for every requested band. */
export class Quantiles {
  private readonly ranks: number[];
  private readonly values: Float64Array;
  private readonly lower: number[];
  private readonly upper: number[];
  private readonly weights: number[];

  constructor(size: number, requested: number[]) {
    const positions = requested.map(p => (size - 1) * p / 100);
    this.ranks = [...new Set(positions.flatMap(p => [Math.floor(p), Math.ceil(p)]))].sort((a, b) => a - b);
    this.values = new Float64Array(this.ranks.length);
    this.lower = positions.map(p => this.ranks.indexOf(Math.floor(p)));
    this.upper = positions.map(p => this.ranks.indexOf(Math.ceil(p)));
    this.weights = positions.map(p => p - Math.floor(p));
  }

  private partition(a: Float64Array, from: number, to: number, left: number, right: number): void {
    if (from > to) return;
    const middle = (from + to) >>> 1;
    const rank = this.ranks[middle];
    this.values[middle] = select(a, rank, left, right);
    this.partition(a, from, middle - 1, left, rank - 1);
    this.partition(a, middle + 1, to, rank + 1, right);
  }

  compute(scratch: Float64Array): void {
    this.partition(scratch, 0, this.ranks.length - 1, 0, scratch.length - 1);
  }

  value(index: number): number {
    const low = this.values[this.lower[index]];
    return low + (this.values[this.upper[index]] - low) * this.weights[index];
  }
}

/** Linear interpolation (R-7), endpoints supported; mutates scratch. */
export function percentile(scratch: Float64Array, p: number): number {
  if (!scratch.length) throw new RangeError('Perzentile benötigen mindestens einen Wert');
  const rank = (scratch.length - 1) * p / 100;
  const lo = Math.floor(rank);
  const low = select(scratch, lo);
  return rank === lo ? low : low + (select(scratch, lo + 1) - low) * (rank - lo);
}

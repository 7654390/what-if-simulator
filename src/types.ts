export type Euro = number;
export type Rate = number; // 0.07 = 7 % p. a.

export interface SimulationInput {
  seed: number;
  paths: number;
  startAge: number;
  endAge: number;
  outputMode: 'real' | 'nominal';
  start: { cash: Euro; etf: Euro; etfCostBasis: Euro; debt: Euro };
  market: {
    etfReturn: Rate;
    etfVolatility: Rate;
    fatTails: boolean;
    cashRate: Rate;
    inflationMean: Rate;
    inflationVolatility: Rate;
    etfTer: Rate;
  };
  /** Lebensphasen, lückenlos von startAge bis endAge, nach fromAge sortiert. */
  phases: LifePhase[];
  /** Monatlicher ETF-Sparplan in heutigen Euro. */
  savingsPlan: { monthly: Euro; dynamic: boolean };
  events: LifeEvent[];
  percentiles?: number[];
  /** Optionales Vermögensziel in derselben Kaufkraft wie outputMode. */
  targetNetWorth?: Euro;
}

export interface LifePhase {
  id: string;
  label: string;
  fromAge: number;
  kind: 'study' | 'work' | 'break';
  grossMonthly: Euro;
  partTimeFactor: number;
  salaryGrowth: Rate;
  livingCostsMonthly: Euro;
  taxClass: 'standard' | 'minijob' | 'werkstudent';
}

export type LifeEvent =
  | { type: 'semesterAbroad'; id: string; enabled: boolean;
      atAge: number; months: number;
      extraCostsMonthly: Euro; grantMonthly: Euro; salaryBoostAfter: Rate }
  | { type: 'studentLoan'; id: string; enabled: boolean;
      atAge: number; payoutMonthly: Euro; payoutMonths: number;
      interestRate: Rate; graceMonths: number; repaymentMonths: number }
  | { type: 'bafoeg'; id: string; enabled: boolean;
      atAge: number; monthly: Euro; months: number }
  | { type: 'partTime'; id: string; enabled: boolean;
      fromAge: number; toAge: number; factor: number }
  | { type: 'oneOff'; id: string; enabled: boolean;
      atAge: number; amount: Euro; label: string };

export interface SimulationResult {
  /** Jahresraster, einschließlich Start- und Zielalter. */
  ages: number[];
  /** Nettovermögen nach latenter ETF-Steuer und nach Schulden. */
  netWorth: PercentileBands;
  components: { cash: PercentileBands; etf: PercentileBands; debt: PercentileBands };
  summary: {
    medianAtEnd: Euro;
    meanAtEnd: Euro;
    probNegativeAtEnd: number;
    probReachTarget?: number;
    maxDrawdownMedian: Rate;
    totalTaxesPaidMedian: Euro;
    totalContributionsMedian: Euro;
  };
  samplePaths: number[][];
  meta: {
    paths: number;
    seed: number;
    durationMs: number;
    engineVersion: string;
    outputMode: 'real' | 'nominal';
  };
}

export type PercentileBands = Record<string, number[]>;

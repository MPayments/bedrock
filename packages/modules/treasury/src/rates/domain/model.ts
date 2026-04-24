export interface CrossRate {
  base: string;
  quote: string;
  rateNum: bigint;
  rateDen: bigint;
  source: string | null;
}

export interface LottoResult {
  game: string;
  combination: string;
  date: string;
  prize: string;
  winners: string;
  jackpot_prize?: string;
  winners_2nd?: string;
  prize_2nd?: string;
  winners_3rd?: string;
  prize_3rd?: string;
  winners_4th?: string;
  prize_4th?: string;
}

export type TemperatureCategory = 'hot' | 'warm' | 'cold';

export interface NumberData {
  number: number;
  frequency: number;
  category: TemperatureCategory;
  emoji: string;
}

export interface BlueprintNumber {
  number: number;
  category: TemperatureCategory;
  emoji: string;
}

export interface FrequencyMap {
  [number: string]: number;
}

export interface PatternResult {
  combo: string;
  count: number;
}
export interface LottoResult {
  game: string;
  combination: string;
  date: string;
  prize: string;
  winners: string;
  originalGame?: string;  // ← ADD THIS LINE
}

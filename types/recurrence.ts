// Sdílené TypeScript typy pro klienta – stejné jako supabase/functions/_shared/recurrence.ts
export type RecurrenceRule =
  | { type: 'once'; start_date: string; end_date: string }
  | { type: 'weekly'; days: string[]; interval?: number }
  | {
    type: 'seasonal';
    base: { type: 'weekly'; days: string[]; interval?: number };
    exclude_ranges?: { from: string; to: string }[];
  }
  | {
    type: 'alternating_weeks';
    week_a: { days: string[] };
    week_b: { days: string[] };
    anchor_date: string;
  }
  | {
    type: 'pattern';
    cycle_days: number;
    anchor_date: string;
    pattern: { work: boolean; start?: string; end?: string }[];
  }
  | {
    type: 'multi';
    dates: string[];
  };

export interface EventSeries {
  id: number;
  nazev: string;
  zakladatel_id: number;
  pocet_lidi: number;
  is_group: boolean;
  cas_od: string;
  cas_do: string;
  timezone: string;
  recurrence_rule: RecurrenceRule;
  valid_from: string | null;
  valid_until: string | null;
}

// src/lib/normalizeRecords.ts

export type NormalizedTrainingRecord = {
    date: string;
    rpe: number;
    duration_min: number;
    load?: number;
  };
  
  export function normalizeTrainingRecord(
    record: {
      date?: string | null;
      rpe?: number | null;
      duration_min?: number | null;
      load?: number | null;
    } | null
  ): NormalizedTrainingRecord | null {
    if (!record?.date) return null;
  
    return {
      date: record.date,
      rpe: typeof record.rpe === 'number' ? record.rpe : 0,
      duration_min:
        typeof record.duration_min === 'number' ? record.duration_min : 0,
      load: typeof record.load === 'number' ? record.load : 0,
    };
  }
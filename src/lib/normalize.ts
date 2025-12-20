// src/lib/normalize.ts

export type TrainingRecordLike = {
    date: string | null | undefined;
    rpe: number | null | undefined;
    duration_min: number | null | undefined;
    load?: number | null | undefined;
  };
  
  export type LastTrainingRecordForForm = {
    date: string;
    rpe: number;
    duration_min: number;
    load?: number;
  };
  
  export type LastTrainingRecordForCheckIn = {
    date: string;
    rpe: number;
    duration_min: number;
  };
  
  export function normalizeTrainingForForm(
    lastTrainingRecord: TrainingRecordLike | null | undefined
  ): LastTrainingRecordForForm | null {
    if (!lastTrainingRecord?.date) return null;
  
    return {
      date: lastTrainingRecord.date,
      rpe: lastTrainingRecord.rpe ?? 0,
      duration_min: lastTrainingRecord.duration_min ?? 0,
      load: lastTrainingRecord.load ?? 0,
    };
  }
  
  export function normalizeTrainingForCheckIn(
    lastTrainingRecord: TrainingRecordLike | null | undefined
  ): LastTrainingRecordForCheckIn | null {
    if (!lastTrainingRecord?.date) return null;
  
    return {
      date: lastTrainingRecord.date,
      rpe: lastTrainingRecord.rpe ?? 0,
      duration_min: lastTrainingRecord.duration_min ?? 0,
    };
  }
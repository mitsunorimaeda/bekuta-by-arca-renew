import {
    normalizeTrainingRecord,
    toCheckInTrainingRecord,
    normalizeSleepRecord,
    normalizeMotivationRecord,
    toMotivationLastRecordInfo,
    normalizeWeightRecord,
  } from '../lib/normalizeRecords';
  
  type UseLastRecordsInput = {
    lastTrainingRecord: any | null;
    lastWeightRecord: any | null;
    lastSleepRecord: any | null;
    lastMotivationRecord: any | null;
  };
  
  export function useLastRecords({
    lastTrainingRecord,
    lastWeightRecord,
    lastSleepRecord,
    lastMotivationRecord,
  }: UseLastRecordsInput) {
    const normalizedLastTrainingRecord =
      lastTrainingRecord ? normalizeTrainingRecord(lastTrainingRecord) : null;
  
    const normalizedLastTrainingRecordForCheckIn =
      normalizedLastTrainingRecord
        ? toCheckInTrainingRecord(normalizedLastTrainingRecord)
        : null;
  
    const normalizedLastWeightRecord =
      lastWeightRecord ? normalizeWeightRecord(lastWeightRecord) : null;
  
    const normalizedLastSleepRecord =
      lastSleepRecord ? normalizeSleepRecord(lastSleepRecord) : null;

    const normalizedLastMotivationRecord =
      lastMotivationRecord ? toMotivationLastRecordInfo(lastMotivationRecord) : null;
  
    return {
      normalizedLastTrainingRecord,
      normalizedLastTrainingRecordForCheckIn,
      normalizedLastWeightRecord,
      normalizedLastSleepRecord,
      normalizedLastMotivationRecord,
    };
  }
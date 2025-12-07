export interface BMIResult {
  bmi: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
  categoryLabel: string;
  healthRisk: 'low' | 'normal' | 'increased' | 'high';
  idealWeightRange: { min: number; max: number };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function getBMICategory(bmi: number): {
  category: BMIResult['category'];
  label: string;
  healthRisk: BMIResult['healthRisk'];
} {
  if (bmi < 18.5) {
    return {
      category: 'underweight',
      label: '低体重',
      healthRisk: 'increased'
    };
  } else if (bmi < 25) {
    return {
      category: 'normal',
      label: '標準体重',
      healthRisk: 'normal'
    };
  } else if (bmi < 30) {
    return {
      category: 'overweight',
      label: '過体重',
      healthRisk: 'increased'
    };
  } else {
    return {
      category: 'obese',
      label: '肥満',
      healthRisk: 'high'
    };
  }
}

export function getIdealWeightRange(heightCm: number): { min: number; max: number } {
  const heightM = heightCm / 100;
  const minBMI = 18.5;
  const maxBMI = 24.9;

  return {
    min: minBMI * heightM * heightM,
    max: maxBMI * heightM * heightM
  };
}

export function getAthleteIdealWeightRange(
  heightCm: number,
  gender: 'male' | 'female' | null
): { min: number; max: number } | null {
  if (!gender) return null;

  const heightM = heightCm / 100;

  if (gender === 'male') {
    const minBMI = 20;
    const maxBMI = 25;
    return {
      min: minBMI * heightM * heightM,
      max: maxBMI * heightM * heightM
    };
  } else {
    const minBMI = 19;
    const maxBMI = 24;
    return {
      min: minBMI * heightM * heightM,
      max: maxBMI * heightM * heightM
    };
  }
}

export function getAgeCorrectedIdealWeight(
  heightCm: number,
  age: number,
  gender: 'male' | 'female' | null
): { min: number; max: number } | null {
  if (!gender) return null;

  const heightM = heightCm / 100;
  let minBMI: number;
  let maxBMI: number;

  if (age < 20) {
    minBMI = gender === 'male' ? 19 : 18;
    maxBMI = gender === 'male' ? 24 : 23;
  } else if (age < 30) {
    minBMI = gender === 'male' ? 20 : 19;
    maxBMI = gender === 'male' ? 25 : 24;
  } else if (age < 50) {
    minBMI = gender === 'male' ? 21 : 20;
    maxBMI = gender === 'male' ? 26 : 25;
  } else {
    minBMI = gender === 'male' ? 22 : 21;
    maxBMI = gender === 'male' ? 27 : 26;
  }

  return {
    min: minBMI * heightM * heightM,
    max: maxBMI * heightM * heightM
  };
}

export function getBMIAnalysis(
  weightKg: number,
  heightCm: number,
  age?: number,
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
): BMIResult {
  const bmi = calculateBMI(weightKg, heightCm);
  const { category, label, healthRisk } = getBMICategory(bmi);

  let idealWeightRange: { min: number; max: number };

  const genderForCalc = (gender === 'male' || gender === 'female') ? gender : null;

  if (age && genderForCalc) {
    const ageCorrected = getAgeCorrectedIdealWeight(heightCm, age, genderForCalc);
    idealWeightRange = ageCorrected || getIdealWeightRange(heightCm);
  } else if (genderForCalc) {
    const athleteRange = getAthleteIdealWeightRange(heightCm, genderForCalc);
    idealWeightRange = athleteRange || getIdealWeightRange(heightCm);
  } else {
    idealWeightRange = getIdealWeightRange(heightCm);
  }

  return {
    bmi,
    category,
    categoryLabel: label,
    healthRisk,
    idealWeightRange
  };
}

export function getBMITrend(
  weightRecords: Array<{ date: string; weight_kg: number }>,
  heightCm: number
): Array<{ date: string; bmi: number }> {
  return weightRecords.map(record => ({
    date: record.date,
    bmi: calculateBMI(record.weight_kg, heightCm)
  }));
}

export function calculateAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

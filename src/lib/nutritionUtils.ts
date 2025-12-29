// src/lib/nutritionUtils.ts
export type FoodSuggestion = {
    label: string;
    amount: number;
    unit: string;
    kcalPerUnit: number;
    proteinPerUnit?: number;
  };
  
  const FOODS: FoodSuggestion[] = [
    { label: 'おにぎり', amount: 0, unit: '個', kcalPerUnit: 180 },
    { label: '卵', amount: 0, unit: '個', kcalPerUnit: 80, proteinPerUnit: 6 },
    { label: '牛乳', amount: 0, unit: '本(200ml)', kcalPerUnit: 130, proteinPerUnit: 7 },
  ];
  
  export type NutritionSuggestionResult = {
    targetKcal: number;
    items: FoodSuggestion[];
    estimate: {
      totalKcal: number;
      totalProtein: number;
      note: string;
    };
    // ✅ Reactでそのまま描ける“表示用”
    summaryText: string;     // 例: "おにぎり2個 / 卵1個 / 牛乳1本"
    estimateText: string;    // 例: "推定: 490kcal / 13g たんぱく"
    missingText?: string;    // 例: "目標まであと 120kcal"
  };
  
  function formatItems(items: FoodSuggestion[]) {
    return items.map(i => `${i.label}${i.amount}${i.unit}`).join(' / ');
  }
  
  // kcal を「主食＋たんぱく」へざっくり配分して、個数にする
  export function suggestFoodsFromKcal(targetKcal: number): NutritionSuggestionResult {
    const kcal = Math.max(0, Math.round(targetKcal));
  
    // 配分（固定）
    // 60% 主食（おにぎり）、40% たんぱく（卵＋牛乳）
    const carbsKcal = Math.round(kcal * 0.6);
    const proteinKcal = kcal - carbsKcal;
  
    const onigiri = Math.max(0, Math.round(carbsKcal / 180));
  
    // たんぱく側：まず牛乳1本、残り卵
    const milk = proteinKcal >= 130 ? 1 : 0;
    const remaining = proteinKcal - milk * 130;
    const egg = Math.max(0, Math.round(remaining / 80));
  
    const totalKcal = onigiri * 180 + egg * 80 + milk * 130;
    const totalProtein = egg * 6 + milk * 7;
  
    const items = [
      { ...FOODS[0], amount: onigiri },
      { ...FOODS[1], amount: egg },
      { ...FOODS[2], amount: milk },
    ].filter(i => i.amount > 0);
  
    const summaryText = items.length ? formatItems(items) : '提案なし';
    const estimateText = `推定: ${totalKcal}kcal / ${totalProtein}g たんぱく`;
  
    const diff = kcal - totalKcal;
    const missingText =
      diff > 60 ? `目標まであと ${diff}kcal` : undefined; // 誤差は小さいなら出さない
  
    return {
      targetKcal: kcal,
      items,
      estimate: {
        totalKcal,
        totalProtein,
        note: 'ざっくり換算（目安）',
      },
      summaryText,
      estimateText,
      missingText,
    };
  }
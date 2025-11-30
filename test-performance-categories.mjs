#!/usr/bin/env node

/**
 * パフォーマンス測定カテゴリーのテスト
 * データベースから各カテゴリーの測定種目を取得して表示します
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCategories() {
  console.log('\n🔬 パフォーマンス測定カテゴリーのテスト\n');
  console.log('━'.repeat(80));

  const categories = ['jump', 'endurance', 'strength'];

  for (const categoryName of categories) {
    console.log(`\n📊 カテゴリー: ${categoryName}`);
    console.log('─'.repeat(80));

    // カテゴリー情報を取得
    const { data: category, error: catError } = await supabase
      .from('performance_categories')
      .select('*')
      .eq('name', categoryName)
      .single();

    if (catError) {
      console.error(`❌ カテゴリー取得エラー:`, catError.message);
      continue;
    }

    console.log(`📁 ${category.display_name} (${category.description})`);

    // 測定種目を取得
    const { data: testTypes, error: testError } = await supabase
      .from('performance_test_types')
      .select('*')
      .eq('category_id', category.id)
      .eq('is_active', true)
      .order('sort_order');

    if (testError) {
      console.error(`❌ 測定種目取得エラー:`, testError.message);
      continue;
    }

    console.log(`\n測定種目数: ${testTypes.length}件\n`);

    testTypes.forEach((test, index) => {
      const inputStatus = test.user_can_input ? '✅ 個人入力可能' : '🔒 専門業者測定';
      console.log(`${index + 1}. ${test.display_name} (${inputStatus})`);
      console.log(`   単位: ${test.unit}`);
      console.log(`   ${test.higher_is_better ? '↗️  高い方が良い' : '↘️  低い方が良い'}`);

      if (Array.isArray(test.fields)) {
        const fieldNames = test.fields.map(f => f.label).join(', ');
        console.log(`   入力項目: ${fieldNames}`);
      }
      console.log();
    });
  }

  console.log('━'.repeat(80));
  console.log('\n✅ テスト完了\n');
}

testCategories().catch(error => {
  console.error('\n❌ エラーが発生しました:', error);
  process.exit(1);
});

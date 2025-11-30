#!/usr/bin/env node

/**
 * Production Migration Script
 *
 * このスクリプトは本番環境にマイグレーションを適用します
 *
 * 警告: これは本番データベースに直接変更を加えます！
 * 必ずバックアップを取ってから実行してください。
 *
 * 使用方法:
 *   node scripts/apply-migrations-to-production.mjs [migration-file.sql]
 *
 *   引数なし: すべてのマイグレーションをリスト表示
 *   引数あり: 指定したマイグレーションファイルの内容を表示
 */

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const migrationsDir = join(projectRoot, 'supabase', 'migrations');

// Load production environment
const envPath = join(projectRoot, '.env.production');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('⚠️  Production Migration Tool');
console.log('═══════════════════════════════════════════════════════\n');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Production environment variables not found!');
  console.error('\nMake sure .env.production contains:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY\n');
  process.exit(1);
}

console.log(`📦 Target Database: ${supabaseUrl}`);
console.log('');

// Get list of migration files
const migrationFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (migrationFiles.length === 0) {
  console.log('No migration files found in supabase/migrations/');
  process.exit(0);
}

const args = process.argv.slice(2);

if (args.length === 0) {
  // List all migrations
  console.log('📋 Available Migrations:\n');
  migrationFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  console.log('\n');
  console.log('Usage:');
  console.log('  node scripts/apply-migrations-to-production.mjs [filename.sql]');
  console.log('');
  console.log('To view a migration file:');
  console.log('  node scripts/apply-migrations-to-production.mjs 20250622013949_rapid_moon.sql');
  console.log('');
  console.log('⚠️  WARNING: This script is for viewing migrations only.');
  console.log('   To apply migrations safely, use Supabase Dashboard:');
  console.log('   1. Go to https://supabase.com/dashboard');
  console.log('   2. Select your production project');
  console.log('   3. Navigate to SQL Editor');
  console.log('   4. Copy and paste the migration SQL');
  console.log('   5. Review and execute');
  console.log('');
  process.exit(0);
}

// Show specific migration file
const migrationFile = args[0];
const migrationPath = join(migrationsDir, migrationFile);

try {
  const content = readFileSync(migrationPath, 'utf-8');

  console.log(`📄 Migration File: ${migrationFile}\n`);
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(content);
  console.log('\n═══════════════════════════════════════════════════════\n');

  console.log('To apply this migration:');
  console.log('1. Copy the SQL above');
  console.log('2. Go to Supabase Dashboard → SQL Editor');
  console.log('3. Paste and execute');
  console.log('');

} catch (error) {
  console.error(`❌ Error reading migration file: ${error.message}`);
  process.exit(1);
}

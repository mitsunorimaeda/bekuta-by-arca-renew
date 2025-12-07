#!/usr/bin/env node

/**
 * Environment Switcher Script
 *
 * Switches between development and production environments by copying
 * the appropriate environment file to .env
 *
 * Usage:
 *   node scripts/switch-env.mjs development
 *   node scripts/switch-env.mjs production
 *   node scripts/switch-env.mjs dev (shorthand)
 *   node scripts/switch-env.mjs prod (shorthand)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const environment = args[0];

if (!environment) {
  console.error('❌ Error: Environment not specified');
  console.log('\nUsage:');
  console.log('  npm run env:dev     # Switch to development');
  console.log('  npm run env:prod    # Switch to production');
  console.log('  node scripts/switch-env.mjs development');
  console.log('  node scripts/switch-env.mjs production');
  process.exit(1);
}

// Normalize environment name
let envName;
if (environment === 'dev' || environment === 'development') {
  envName = 'development';
} else if (environment === 'prod' || environment === 'production') {
  envName = 'production';
} else {
  console.error(`❌ Error: Unknown environment "${environment}"`);
  console.log('\nValid environments: development (dev), production (prod)');
  process.exit(1);
}

const sourceFile = join(projectRoot, `.env.${envName}`);
const targetFile = join(projectRoot, '.env');
const localFile = join(projectRoot, '.env.local');

// Check if source file exists
if (!existsSync(sourceFile)) {
  console.error(`❌ Error: Environment file not found: .env.${envName}`);
  process.exit(1);
}

// Check for .env.local override
if (existsSync(localFile)) {
  console.log('\n⚠️  WARNING: .env.local file detected!');
  console.log('   .env.local will override the environment you select.');
  console.log('   To use environment switching, consider removing .env.local\n');
}

try {
  // Read source environment file
  const envContent = readFileSync(sourceFile, 'utf-8');

  // Parse to show which project is being used
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
  const url = urlMatch ? urlMatch[1].trim() : 'unknown';

  // Write to .env
  writeFileSync(targetFile, envContent, 'utf-8');

  console.log('✅ Environment switched successfully!');
  console.log('');
  console.log(`   Environment: ${envName.toUpperCase()}`);
  console.log(`   Supabase URL: ${url}`);
  console.log(`   Config file: .env.${envName} → .env`);
  console.log('');
  console.log('ℹ️  Please restart your development server for changes to take effect.');
  console.log('');

  if (envName === 'production') {
    console.log('⚠️  WARNING: You are now using PRODUCTION environment!');
    console.log('   Any changes will affect production data.');
    console.log('   Make sure you know what you are doing.\n');
  }
} catch (error) {
  console.error('❌ Error switching environment:', error.message);
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Environment Checker Script
 *
 * Displays current environment configuration and validates settings
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production'
];

const KNOWN_PROJECTS = {
  'ucicxvepktvotvtafowm': 'PRODUCTION',
  'qetusppzdmktdwywxghd': 'DEVELOPMENT'
};

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const env = {};

    content.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        env[key] = value;
      }
    });

    return env;
  } catch (error) {
    return null;
  }
}

function identifyProject(url) {
  if (!url) return 'UNKNOWN';

  for (const [projectId, envName] of Object.entries(KNOWN_PROJECTS)) {
    if (url.includes(projectId)) {
      return envName;
    }
  }

  return 'UNKNOWN';
}

console.log('🔍 Environment Configuration Check\n');
console.log('═══════════════════════════════════════════════════════\n');

let activeEnv = null;
let activeFile = null;

// Check each environment file
for (const envFile of ENV_FILES) {
  const filePath = join(projectRoot, envFile);
  const env = parseEnvFile(filePath);

  if (!env) {
    console.log(`❌ ${envFile}: Not found`);
    continue;
  }

  const url = env.VITE_SUPABASE_URL || 'Not set';
  const project = identifyProject(url);
  const isActive = envFile === '.env' || envFile === '.env.local';

  console.log(`${isActive ? '✅' : '📄'} ${envFile}:`);
  console.log(`   Project: ${project}`);
  console.log(`   URL: ${url}`);

  if (isActive) {
    activeEnv = project;
    activeFile = envFile;
  }

  console.log('');
}

// Determine active configuration
console.log('═══════════════════════════════════════════════════════\n');

if (existsSync(join(projectRoot, '.env.local'))) {
  console.log('⚠️  ACTIVE CONFIGURATION: .env.local (OVERRIDES ALL)');
  const localEnv = parseEnvFile(join(projectRoot, '.env.local'));
  if (localEnv) {
    const project = identifyProject(localEnv.VITE_SUPABASE_URL);
    console.log(`   Using: ${project} environment`);
  }
} else if (existsSync(join(projectRoot, '.env'))) {
  const env = parseEnvFile(join(projectRoot, '.env'));
  if (env) {
    const project = identifyProject(env.VITE_SUPABASE_URL);
    console.log(`✅ ACTIVE CONFIGURATION: .env`);
    console.log(`   Using: ${project} environment`);

    if (project === 'PRODUCTION') {
      console.log('\n⚠️  WARNING: Using PRODUCTION environment!');
      console.log('   All operations affect production data.');
    }
  }
} else {
  console.log('❌ ERROR: No .env file found!');
  console.log('\nTo create one, run:');
  console.log('   npm run env:dev   # For development');
  console.log('   npm run env:prod  # For production');
}

console.log('\n═══════════════════════════════════════════════════════\n');

// Show how to switch environments
console.log('💡 To switch environments:');
console.log('   npm run env:dev   # Switch to development');
console.log('   npm run env:prod  # Switch to production');
console.log('   npm run env:check # Check current environment (this command)');
console.log('');

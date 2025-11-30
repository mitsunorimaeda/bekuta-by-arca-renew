#!/usr/bin/env node

/**
 * Environment Protection Script
 *
 * This script monitors and protects the .env file from being overwritten
 * with incorrect values. It will automatically restore correct values if
 * the .env file is corrupted.
 */

import { readFileSync, writeFileSync, watchFile } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CORRECT_CONFIG = {
  VITE_SUPABASE_URL: 'https://ucicxvepktvotvtafowm.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaWN4dmVwa3R2b3R2dGFmb3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NTQ1MDcsImV4cCI6MjA2NjEzMDUwN30.qt26aAlVJw4BbicnCjWME47rqtGDr7aWGP73b2MSA38',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaWN4dmVwa3R2b3R2dGFmb3dtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDU1NDUwNywiZXhwIjoyMDY2MTMwNTA3fQ.5GDPMnWuYQRNixNvJEQWAe8HCrihgI4SYMSEmGQY2R8'
};

const INCORRECT_SUPABASE_URL = 'https://qetusppzdmktdwywxghd.supabase.co';

const envPath = join(__dirname, '..', '.env');

function parseEnvFile(content) {
  const envVars = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });
  return envVars;
}

function createEnvContent(vars) {
  return `# Supabase Configuration
# CRITICAL: DO NOT change these URLs! This project uses a specific Supabase instance.
# The correct project URL is: https://ucicxvepktvotvtafowm.supabase.co
# DO NOT use: https://qetusppzdmktdwywxghd.supabase.co (WRONG PROJECT!)

VITE_SUPABASE_URL=${vars.VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${vars.VITE_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${vars.SUPABASE_SERVICE_ROLE_KEY}
`;
}

function checkAndFixEnv() {
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const envVars = parseEnvFile(envContent);

    let needsRepair = false;
    const issues = [];

    if (envVars.VITE_SUPABASE_URL === INCORRECT_SUPABASE_URL) {
      needsRepair = true;
      issues.push('❌ INCORRECT Supabase URL detected (qetusppzdmktdwywxghd)');
    } else if (envVars.VITE_SUPABASE_URL !== CORRECT_CONFIG.VITE_SUPABASE_URL) {
      needsRepair = true;
      issues.push('❌ Wrong Supabase URL');
    }

    if (envVars.VITE_SUPABASE_ANON_KEY?.includes('qetusppzdmktdwywxghd')) {
      needsRepair = true;
      issues.push('❌ ANON_KEY belongs to wrong project');
    } else if (envVars.VITE_SUPABASE_ANON_KEY !== CORRECT_CONFIG.VITE_SUPABASE_ANON_KEY) {
      needsRepair = true;
      issues.push('❌ Wrong ANON_KEY');
    }

    if (envVars.SUPABASE_SERVICE_ROLE_KEY !== CORRECT_CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
      needsRepair = true;
      issues.push('❌ Wrong SERVICE_ROLE_KEY');
    }

    if (needsRepair) {
      console.error('\n🚨 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🚨 CRITICAL: .env FILE CORRUPTION DETECTED!');
      console.error('🚨 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      issues.forEach(issue => console.error('  ' + issue));

      console.error('\n🔧 AUTO-REPAIRING .env file with correct values...\n');

      const correctContent = createEnvContent(CORRECT_CONFIG);
      writeFileSync(envPath, correctContent, 'utf-8');

      console.log('✅ .env file has been REPAIRED with correct values!');
      console.log('✅ Correct Supabase URL: https://ucicxvepktvotvtafowm.supabase.co\n');

      return true;
    } else {
      console.log('✅ .env file is correct');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking .env file:', error.message);
    return false;
  }
}

console.log('🛡️  Environment Protection Service Starting...\n');
console.log('Monitoring .env file for unauthorized changes...\n');

// Initial check
checkAndFixEnv();

// Watch for changes
let isProcessing = false;

watchFile(envPath, { interval: 500 }, (curr, prev) => {
  if (isProcessing) return;

  if (curr.mtime !== prev.mtime) {
    isProcessing = true;
    console.log('\n📝 .env file changed, checking...');

    setTimeout(() => {
      const wasRepaired = checkAndFixEnv();
      if (wasRepaired) {
        console.log('\n⚠️  Please refresh your browser to load correct configuration\n');
      }
      isProcessing = false;
    }, 100);
  }
});

console.log('🛡️  Protection active. Press Ctrl+C to stop.\n');

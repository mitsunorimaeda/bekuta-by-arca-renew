#!/usr/bin/env node

/**
 * Pre-Deployment Checklist Script
 *
 * Validates the project is ready for deployment to production
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🚀 Pre-Deployment Checklist\n');
console.log('═══════════════════════════════════════════════════════\n');

const checks = [];
let allPassed = true;

// Check 1: Environment configuration
function checkEnvironmentConfig() {
  const envPath = join(projectRoot, '.env');
  const envProdPath = join(projectRoot, '.env.production');

  if (!existsSync(envProdPath)) {
    return {
      passed: false,
      message: '.env.production file not found'
    };
  }

  try {
    const content = readFileSync(envProdPath, 'utf-8');

    if (!content.includes('VITE_SUPABASE_URL')) {
      return {
        passed: false,
        message: 'VITE_SUPABASE_URL not found in .env.production'
      };
    }

    if (!content.includes('VITE_SUPABASE_ANON_KEY')) {
      return {
        passed: false,
        message: 'VITE_SUPABASE_ANON_KEY not found in .env.production'
      };
    }

    if (content.includes('ucicxvepktvotvtafowm')) {
      return {
        passed: true,
        message: 'Production environment configured correctly'
      };
    }

    return {
      passed: false,
      message: 'Production Supabase URL not detected'
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error reading .env.production: ${error.message}`
    };
  }
}

// Check 2: No .env.local override
function checkNoLocalOverride() {
  const localPath = join(projectRoot, '.env.local');

  if (existsSync(localPath)) {
    return {
      passed: false,
      message: '.env.local exists and will override production settings'
    };
  }

  return {
    passed: true,
    message: 'No .env.local override detected'
  };
}

// Check 3: Package.json has required scripts
function checkPackageScripts() {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, 'package.json'), 'utf-8')
    );

    const requiredScripts = ['build', 'build:production'];
    const missing = requiredScripts.filter(script => !packageJson.scripts[script]);

    if (missing.length > 0) {
      return {
        passed: false,
        message: `Missing scripts: ${missing.join(', ')}`
      };
    }

    return {
      passed: true,
      message: 'All required scripts present'
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error reading package.json: ${error.message}`
    };
  }
}

// Check 4: No hardcoded credentials in source
function checkNoHardcodedCredentials() {
  const configPath = join(projectRoot, 'src', 'lib', 'supabase.config.ts');

  try {
    const content = readFileSync(configPath, 'utf-8');

    if (content.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')) {
      return {
        passed: false,
        message: 'Hardcoded JWT tokens found in supabase.config.ts'
      };
    }

    return {
      passed: true,
      message: 'No hardcoded credentials in config'
    };
  } catch (error) {
    return {
      passed: true,
      message: 'Config file check skipped (file not found)'
    };
  }
}

// Check 5: README exists and is updated
function checkReadme() {
  const readmePath = join(projectRoot, 'README.md');

  if (!existsSync(readmePath)) {
    return {
      passed: false,
      message: 'README.md not found'
    };
  }

  return {
    passed: true,
    message: 'README.md exists'
  };
}

// Check 6: .gitignore properly configured
function checkGitignore() {
  const gitignorePath = join(projectRoot, '.gitignore');

  try {
    const content = readFileSync(gitignorePath, 'utf-8');

    if (!content.includes('.env')) {
      return {
        passed: false,
        message: '.env not in .gitignore'
      };
    }

    if (!content.includes('.env.local')) {
      return {
        passed: false,
        message: '.env.local not in .gitignore'
      };
    }

    return {
      passed: true,
      message: 'Environment files properly gitignored'
    };
  } catch (error) {
    return {
      passed: false,
      message: '.gitignore not found'
    };
  }
}

// Run all checks
const checkSuite = [
  { name: 'Environment Configuration', fn: checkEnvironmentConfig },
  { name: 'No Local Override', fn: checkNoLocalOverride },
  { name: 'Package Scripts', fn: checkPackageScripts },
  { name: 'No Hardcoded Credentials', fn: checkNoHardcodedCredentials },
  { name: 'README Documentation', fn: checkReadme },
  { name: 'Git Ignore Configuration', fn: checkGitignore }
];

checkSuite.forEach(({ name, fn }) => {
  const result = fn();
  checks.push({ name, ...result });

  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  console.log(`   ${result.message}\n`);

  if (!result.passed) {
    allPassed = false;
  }
});

console.log('═══════════════════════════════════════════════════════\n');

if (allPassed) {
  console.log('🎉 All checks passed! Ready for deployment.\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run build:production');
  console.log('  2. Test the build: npm run preview');
  console.log('  3. Deploy to your hosting platform\n');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please fix the issues before deploying.\n');
  process.exit(1);
}

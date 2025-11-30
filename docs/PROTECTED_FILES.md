# Protected Files

The following files contain critical configuration and MUST NOT be modified by AI agents or automated tools:

## Environment Files
- `.env` - Contains production Supabase credentials (READ-ONLY)
- `.env.example` - Template for environment variables
- `.env.local` - Local environment overrides (if present)

## Configuration Files
- `src/lib/supabase.config.ts` - Hardcoded Supabase configuration (PROTECTED)

## Correct Configuration

VITE_SUPABASE_URL=https://ucicxvepktvotvtafowm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjaWN4dmVwa3R2b3R2dGFmb3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NTQ1MDcsImV4cCI6MjA2NjEzMDUwN30.qt26aAlVJw4BbicnCjWME47rqtGDr7aWGP73b2MSA38

## DO NOT USE (WRONG PROJECT)

https://qetusppzdmktdwywxghd.supabase.co

## Protection Mechanisms

1. `.env` file is set to read-only (chmod 444)
2. Hardcoded configuration in `src/lib/supabase.config.ts` takes precedence
3. Multiple validation scripts check configuration on startup
4. Files listed in `.aiexclude` and `.claudeignore`

## If Configuration Gets Corrupted

The application will automatically use the hardcoded configuration from `src/lib/supabase.config.ts`, so the app will continue to work even if `.env` is corrupted.

To manually fix:
1. Run: `chmod 644 .env` (make writable)
2. Run: `npm run fix-env` (auto-repair)
3. Run: `chmod 444 .env` (make read-only again)

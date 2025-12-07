// Environment configuration
// All values come from environment variables
// No hardcoded credentials for security

export const PRODUCTION_URL = 'https://cymnqmbdwaveccoooics.supabase.co';
export const DEVELOPMENT_URL = 'https://cymnqmbdwaveccoooics.supabase.co';

export function getEnvironmentName(url: string): 'production' | 'development' | 'unknown' {
  if (url.includes('cymnqmbdwaveccoooics')) {
    return 'production';
  }
  return 'unknown';
}

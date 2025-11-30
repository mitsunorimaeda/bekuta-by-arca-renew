import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { getEnvironmentName, PRODUCTION_URL, DEVELOPMENT_URL } from './supabase.config';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!envUrl || !envAnonKey) {
  throw new Error(
    '❌ Missing Supabase configuration!\n' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.\n' +
    'Run: npm run env:dev (for development) or npm run env:prod (for production)'
  );
}

const environment = getEnvironmentName(envUrl);

if (environment === 'unknown') {
  console.warn('⚠️  Warning: Unknown Supabase project detected');
  console.warn('   URL:', envUrl);
  console.warn('   Expected:', PRODUCTION_URL, 'or', DEVELOPMENT_URL);
}

console.log(`✅ Supabase client initialized`);
console.log(`   Environment: ${environment.toUpperCase()}`);
console.log(`   URL: ${envUrl}`);

if (environment === 'production') {
  console.log('⚠️  Using PRODUCTION environment - changes affect real data!');
}

const supabaseUrl = envUrl;
const supabaseAnonKey = envAnonKey;

// Custom fetch implementation to handle refresh token errors
const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
  const response = await fetch(url, options);
  
  // Check if this is a refresh token error
  if (response.status === 400) {
    try {
      const body = await response.clone().text();
      const errorData = JSON.parse(body);
      
      if (errorData.code === 'refresh_token_not_found') {
        return response;
      }
    } catch (e) {
      // If we can't parse the response, just return the original response
    }
  }
  
  return response;
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch,
  },
});

export type User = Database['public']['Tables']['users']['Row'];
export type Team = Database['public']['Tables']['teams']['Row'];
export type TrainingRecord = Database['public']['Tables']['training_records']['Row'];
export type StaffTeamLink = Database['public']['Tables']['staff_team_links']['Row'];
export type PerformanceCategory = Database['public']['Tables']['performance_categories']['Row'];
export type PerformanceTestType = Database['public']['Tables']['performance_test_types']['Row'];
export type PerformanceRecord = Database['public']['Tables']['performance_records']['Row'];
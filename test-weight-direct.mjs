import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const supabaseUrl = process.env.VITE_SUPABASE_URL;

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL in .env file!');
  process.exit(1);
}

const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
const connectionString = `postgresql://postgres.${projectRef}:zFEjCuuFy7lOg8VY@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;

console.log('📡 Using Supabase project:', projectRef);

const client = new Client({ connectionString });

try {
  await client.connect();
  console.log('✅ Connected to database\n');
  
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'weight_records'
  `);
  
  console.log('Query result:', res.rows);
  
  if (res.rows.length > 0) {
    console.log('\n✅ weight_records table exists!');
    
    // Try to count records
    const countRes = await client.query('SELECT COUNT(*) FROM public.weight_records');
    console.log('Record count:', countRes.rows[0].count);
  } else {
    console.log('\n❌ weight_records table NOT found');
  }
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await client.end();
}

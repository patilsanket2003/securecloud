import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// Database initialization
export async function initSupabaseDb() {
  console.log('🗄️ Supabase client initialized');
  
  // Test connection
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      throw error;
    }
    console.log('✅ Supabase connection successful');
  } catch (err) {
    console.error('❌ Supabase initialization error:', err);
    throw err;
  }
}

export default supabase;

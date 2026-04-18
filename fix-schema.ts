import { pool } from './src/server/db-postgres.ts';

async function fixSchema() {
  console.log('🔧 Fixing activity tracking schema...');
  
  try {
    // Add missing columns to users table
    const alterUsersTable = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_time_spent_seconds INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
`;

    await pool.query(alterUsersTable);
    console.log('✅ Users table updated successfully!');
    
    // Check existing columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Users table columns:', columnsResult.rows.map(row => `${row.column_name} (${row.data_type})`));
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
  } finally {
    await pool.end();
  }
}

fixSchema();

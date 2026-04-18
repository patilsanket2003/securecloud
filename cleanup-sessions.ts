import { pool } from './src/server/db-postgres.ts';

async function cleanupSessions() {
  console.log('🧹 Cleaning up orphaned sessions...');
  
  try {
    // Find all active sessions for admin user
    const activeSessions = await pool.query(
      `SELECT us.id, us.user_id, us.login_at, us.last_activity_at
       FROM user_sessions us 
       JOIN users u ON us.user_id = u.id 
       WHERE us.is_active = TRUE 
       AND u.email = 'admin@securecloud.com'`
    );
    
    console.log(`📊 Found ${activeSessions.rows.length} active sessions for admin`);
    
    // End all active sessions
    for (const session of activeSessions.rows) {
      const loginAt = new Date(session.login_at);
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - loginAt.getTime()) / 1000);
      
      await pool.query(
        `UPDATE user_sessions 
         SET logout_at = $1, 
             session_duration_seconds = $2, 
             is_active = FALSE 
         WHERE id = $3`,
        [now, durationSeconds, session.id]
      );
      
      console.log(`✅ Ended session ${session.id} (duration: ${durationSeconds}s)`);
    }
    
    // Update user status
    await pool.query(
      `UPDATE users 
       SET is_online = FALSE, 
           last_logout_at = NOW() 
       WHERE email = 'admin@securecloud.com'`
    );
    
    console.log('✅ Updated user status to offline');
    
    // Verify cleanup
    const remainingSessions = await pool.query(
      `SELECT COUNT(*) as count 
       FROM user_sessions us 
       JOIN users u ON us.user_id = u.id 
       WHERE us.is_active = TRUE 
       AND u.email = 'admin@securecloud.com'`
    );
    
    console.log(`📊 Remaining active sessions: ${remainingSessions.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error);
  } finally {
    await pool.end();
  }
}

cleanupSessions();

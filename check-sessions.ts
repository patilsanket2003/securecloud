import { pool } from './src/server/db-postgres.ts';

async function checkSessionStatus() {
  console.log('🔍 Checking session status...');
  
  try {
    // Check active sessions
    const activeSessions = await pool.query(
      `SELECT us.*, u.name, u.email, u.is_online
       FROM user_sessions us 
       JOIN users u ON us.user_id = u.id 
       WHERE us.is_active = TRUE 
       ORDER BY us.login_at DESC`
    );
    
    console.log(`📊 Active sessions: ${activeSessions.rows.length}`);
    activeSessions.rows.forEach(session => {
      console.log(`  - ${session.name} (${session.email}) - Session ${session.id} - Login: ${session.login_at}`);
    });
    
    // Check user status
    const userStatus = await pool.query(
      `SELECT name, email, is_online, last_login_at, last_logout_at, session_count
       FROM users 
       WHERE email = 'admin@securecloud.com'`
    );
    
    if (userStatus.rows.length > 0) {
      const user = userStatus.rows[0];
      console.log(`👤 Admin user status:`);
      console.log(`  - Name: ${user.name}`);
      console.log(`  - Online: ${user.is_online}`);
      console.log(`  - Last login: ${user.last_login_at}`);
      console.log(`  - Last logout: ${user.last_logout_at}`);
      console.log(`  - Session count: ${user.session_count}`);
    }
    
    // Check recent audit logs
    const recentLogs = await pool.query(
      `SELECT action_type, module_name, description, created_at
       FROM audit_logs 
       WHERE action_type IN ('LOGIN', 'LOGOUT')
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    console.log(`📋 Recent audit logs:`);
    recentLogs.rows.forEach(log => {
      console.log(`  - ${log.action_type}: ${log.description} (${log.created_at})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking session status:', error);
  } finally {
    await pool.end();
  }
}

checkSessionStatus();

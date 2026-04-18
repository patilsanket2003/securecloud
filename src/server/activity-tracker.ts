import { pool } from './db-postgres.ts';

export interface SessionData {
  id: number;
  user_id: number;
  login_at: Date;
  logout_at?: Date;
  session_duration_seconds?: number;
  last_activity_at: Date;
  is_active: boolean;
  ip_address?: string;
  user_agent?: string;
}

export interface AuditLogData {
  user_id?: number;
  role?: string;
  action_type: string;
  module_name: string;
  record_id?: string;
  target_table?: string;
  description: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
}

// Session Management
export class ActivityTracker {
  
  // Create new session on login
  static async createSession(userId: number, ipAddress?: string, userAgent?: string): Promise<SessionData> {
    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, ip_address, user_agent) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [userId, ipAddress, userAgent]
    );
    
    // Update user login info
    await pool.query(
      `UPDATE users 
       SET last_login_at = NOW(), 
           is_online = TRUE, 
           session_count = COALESCE(session_count, 0) + 1 
       WHERE id = $1`,
      [userId]
    );
    
    return result.rows[0];
  }
  
  // End session on logout
  static async endSession(sessionId: number): Promise<void> {
    try {
      const sessionResult = await pool.query(
        `SELECT login_at FROM user_sessions WHERE id = $1 AND is_active = TRUE`,
        [sessionId]
      );
      
      if (sessionResult.rows.length === 0) return;
      
      const loginAt = new Date(sessionResult.rows[0].login_at);
      const logoutAt = new Date();
      const durationSeconds = Math.floor((logoutAt.getTime() - loginAt.getTime()) / 1000);
      
      await pool.query(
        `UPDATE user_sessions 
         SET logout_at = $1, 
             session_duration_seconds = $2, 
             is_active = FALSE 
         WHERE id = $3`,
        [logoutAt, durationSeconds, sessionId]
      );
    } catch (error) {
      console.error('❌ Error ending session:', error);
      // Don't throw the error, just log it and continue
    }
  }
  
  // Update session activity (heartbeat)
  static async updateSessionActivity(sessionId: number): Promise<void> {
    await pool.query(
      `UPDATE user_sessions 
       SET last_activity_at = NOW() 
       WHERE id = $1 AND is_active = TRUE`,
      [sessionId]
    );
  }
  
  // Get active user sessions
  static async getActiveSessions(): Promise<SessionData[]> {
    const result = await pool.query(
      `SELECT us.*, u.name, u.email, u.role 
       FROM user_sessions us 
       JOIN users u ON us.user_id = u.id 
       WHERE us.is_active = TRUE 
       ORDER BY us.last_activity_at DESC`
    );
    return result.rows;
  }
  
  // Get user session history
  static async getUserSessionHistory(userId: number, limit: number = 50): Promise<SessionData[]> {
    const result = await pool.query(
      `SELECT * FROM user_sessions 
       WHERE user_id = $1 
       ORDER BY login_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }
  
  // Get user activity summary
  static async getUserActivitySummary(userId: number): Promise<any> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_sessions,
         COALESCE(SUM(session_duration_seconds), 0) as total_time_seconds,
         COALESCE(AVG(session_duration_seconds), 0) as avg_session_seconds,
         MAX(login_at) as last_login,
         MAX(last_activity_at) as last_activity
       FROM user_sessions 
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0];
  }
}

// Audit Logging
export class AuditLogger {
  
  // Log an audit action
  static async logAction(data: AuditLogData): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs (
           user_id, role, action_type, module_name, record_id, 
           target_table, description, old_values, new_values, 
           ip_address, user_agent
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          data.user_id,
          data.role,
          data.action_type,
          data.module_name,
          data.record_id,
          data.target_table,
          data.description,
          data.old_values ? JSON.stringify(data.old_values) : null,
          data.new_values ? JSON.stringify(data.new_values) : null,
          data.ip_address,
          data.user_agent
        ]
      );
    } catch (error: any) {
      // Handle foreign key constraint errors gracefully
      if (error.code === '23503') {
        console.warn('⚠️ Audit logging failed - user_id not found:', {
          user_id: data.user_id,
          action_type: data.action_type,
          description: data.description
        });
        // Don't throw the error, just log it and continue
        return;
      }
      // For other errors, still log but don't crash the logout process
      console.error('❌ Audit logging error:', error);
    }
  }
  
  // Get audit logs with filters
  static async getAuditLogs(filters: {
    user_id?: number;
    role?: string;
    action_type?: string;
    module_name?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    let query = `
      SELECT al.*, u.name, u.email 
      FROM audit_logs al 
      LEFT JOIN users u ON al.user_id = u.id 
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (filters.user_id) {
      query += ` AND al.user_id = $${paramIndex++}`;
      params.push(filters.user_id);
    }
    
    if (filters.role) {
      query += ` AND al.role = $${paramIndex++}`;
      params.push(filters.role);
    }
    
    if (filters.action_type) {
      query += ` AND al.action_type = $${paramIndex++}`;
      params.push(filters.action_type);
    }
    
    if (filters.module_name) {
      query += ` AND al.module_name = $${paramIndex++}`;
      params.push(filters.module_name);
    }
    
    if (filters.date_from) {
      query += ` AND al.created_at >= $${paramIndex++}`;
      params.push(filters.date_from);
    }
    
    if (filters.date_to) {
      query += ` AND al.created_at <= $${paramIndex++}`;
      params.push(filters.date_to);
    }
    
    query += ` ORDER BY al.created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }
    
    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  }
  
  // Get audit statistics
  static async getAuditStats(): Promise<any> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_actions,
         COUNT(DISTINCT user_id) as unique_users,
         COUNT(DISTINCT module_name) as unique_modules,
         action_type,
         COUNT(*) as count
       FROM audit_logs 
       WHERE created_at >= NOW() - INTERVAL '30 days'
       GROUP BY action_type
       ORDER BY count DESC`
    );
    return result.rows;
  }
}

// Helper functions for common audit actions
export const auditActions = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT'
};

export const auditModules = {
  USERS: 'USERS',
  COMPLAINTS: 'COMPLAINTS',
  CRIMINALS: 'CRIMINALS',
  EVIDENCE: 'EVIDENCE',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM'
};

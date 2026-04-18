import React, { useState, useEffect } from 'react';
import { Users, Clock, Activity, Calendar, Search, Filter, Download, Eye, LogOut, LogIn, Trash, Edit, Upload } from 'lucide-react';

interface UserActivity {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at?: string;
  last_logout_at?: string;
  total_time_spent_seconds: number;
  is_online: boolean;
  session_count: number;
  total_sessions: number;
  avg_session_seconds: number;
  last_activity: string;
}

interface Session {
  id: number;
  user_id: number;
  login_at: string;
  logout_at?: string;
  session_duration_seconds?: number;
  last_activity_at: string;
  is_active: boolean;
  ip_address?: string;
  user_agent?: string;
}

interface AuditLog {
  id: number;
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
  created_at: string;
  name?: string;
  email?: string;
}

function AdminActivityDashboard() {
  const [activeTab, setActiveTab] = useState<'users' | 'sessions' | 'audit' | 'active'>('users');
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeUsers, setActiveUsers] = useState<Session[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    role: '',
    action_type: '',
    module_name: '',
    date_from: '',
    date_to: ''
  });

  useEffect(() => {
    fetchUsers();
    if (activeTab === 'sessions') fetchSessions();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'active') fetchActiveUsers();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users/activity', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async (userId?: number) => {
    try {
      setLoading(true);
      const url = userId 
        ? `/api/admin/users/${userId}/sessions`
        : '/api/admin/users/active';
      const res = await fetch(url, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (userId) {
          setSessions(data);
        } else {
          setActiveUsers(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await fetch(`/api/admin/audit-logs?${params}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users/active', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setActiveUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch active users:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'LOGIN': return <LogIn className="w-4 h-4 text-green-500" />;
      case 'LOGOUT': return <LogOut className="w-4 h-4 text-red-500" />;
      case 'CREATE': return <Upload className="w-4 h-4 text-blue-500" />;
      case 'DELETE': return <Trash className="w-4 h-4 text-red-500" />;
      case 'UPDATE': return <Edit className="w-4 h-4 text-yellow-500" />;
      case 'VIEW': return <Eye className="w-4 h-4 text-purple-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Activity Tracking Dashboard</h1>
        <p className="text-zinc-600">Monitor user activity, sessions, and audit logs</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-8 bg-zinc-100 p-1 rounded-lg">
        {[
          { id: 'users', label: 'Users', icon: Users },
          { id: 'active', label: 'Active Now', icon: Activity },
          { id: 'sessions', label: 'Sessions', icon: Clock },
          { id: 'audit', label: 'Audit Logs', icon: Eye }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
          <div className="p-6 border-b border-zinc-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">All Users Activity</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={fetchUsers}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Sessions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Total Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Last Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-zinc-900">{user.name}</div>
                        <div className="text-sm text-zinc-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${user.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-sm text-zinc-600">
                          {user.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-900">{user.total_sessions}</td>
                    <td className="px-6 py-4 text-sm text-zinc-900">
                      {formatDuration(user.total_time_spent_seconds)}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-900">
                      {user.last_activity ? formatDate(user.last_activity) : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          fetchSessions(user.id);
                          setActiveTab('sessions');
                        }}
                        className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                      >
                        View Sessions
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Users Tab */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
          <div className="p-6 border-b border-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900">Currently Active Users</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeUsers.map((session) => (
                <div key={session.id} className="p-4 border border-zinc-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-zinc-900">{session.name}</h3>
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  </div>
                  <p className="text-sm text-zinc-600 mb-1">{session.email}</p>
                  <p className="text-xs text-zinc-500">
                    Login: {formatDate(session.login_at)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Last active: {formatDate(session.last_activity_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
          <div className="p-6 border-b border-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900">
              {selectedUser ? `Sessions for ${selectedUser.name}` : 'User Sessions'}
            </h2>
            {selectedUser && (
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setActiveTab('users');
                }}
                className="mt-2 text-sm text-emerald-600 hover:text-emerald-700"
              >
                ← Back to Users
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Login Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Logout Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4 text-sm text-zinc-900">
                      {formatDate(session.login_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-900">
                      {session.logout_at ? formatDate(session.logout_at) : 'Still active'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-900">
                      {session.session_duration_seconds 
                        ? formatDuration(session.session_duration_seconds)
                        : 'In progress'
                      }
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        session.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {session.is_active ? 'Active' : 'Ended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-900">
                      {session.ip_address || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
          <div className="p-6 border-b border-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900 mb-4">Audit Logs</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <select
                value={filters.action_type}
                onChange={(e) => setFilters({...filters, action_type: e.target.value})}
                className="px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Actions</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
                <option value="CREATE">Create</option>
                <option value="DELETE">Delete</option>
                <option value="UPDATE">Update</option>
              </select>
              <select
                value={filters.module_name}
                onChange={(e) => setFilters({...filters, module_name: e.target.value})}
                className="px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Modules</option>
                <option value="USERS">Users</option>
                <option value="CRIMINALS">Criminals</option>
                <option value="EVIDENCE">Evidence</option>
                <option value="SYSTEM">System</option>
              </select>
              <button
                onClick={fetchAuditLogs}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Apply Filters
              </button>
            </div>
          </div>
          
          <div className="divide-y divide-zinc-200">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-zinc-50">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getActionIcon(log.action_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-zinc-900">{log.description}</h3>
                      <span className="text-sm text-zinc-500">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-600">
                      <span>{log.name || 'System'}</span>
                      <span>•</span>
                      <span className="px-2 py-1 bg-zinc-100 rounded text-xs">
                        {log.action_type}
                      </span>
                      <span className="px-2 py-1 bg-zinc-100 rounded text-xs">
                        {log.module_name}
                      </span>
                      {log.ip_address && (
                        <>
                          <span>•</span>
                          <span>IP: {log.ip_address}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminActivityDashboard;

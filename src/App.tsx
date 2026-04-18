import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  FilePlus, 
  LogOut, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Search,
  Filter,
  Eye,
  Menu,
  X,
  User,
  Lock,
  Mail,
  FileText,
  Upload,
  Download,
  Hash,
  Users,
  Camera,
  Trash,
  UserPlus,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CriminalManagement from './CriminalManagement';
import AdminActivityDashboard from './AdminActivityDashboard';
import ActivityTracker from './activityTracker';

// --- Types ---
interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

interface Complaint {
  id: number;
  user_id: number;
  user_name?: string;
  title: string;
  description: string;
  category: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  created_at: string;
  file_name?: string;
  file_path?: string;
  file_hash?: string;
  remark?: string;
  reviewed_at?: string;
}

// --- Components ---

const Badge = ({ status }: { status: string }) => {
  const colors = {
    Pending: 'bg-amber-100 text-amber-700 border-amber-200',
    Verified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      {status}
    </span>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'submit' | 'admin' | 'criminals' | 'activity' | 'details'>('dashboard');
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Activity tracker instance
  const activityTracker = ActivityTracker.getInstance();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        if (data.role === 'admin') setView('admin');
      }
    } catch (err) {
      console.error('Auth check failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (userData: User, sessionId: string) => {
    setUser(userData);
    setSessionId(sessionId);
    if (userData.role === 'admin') setView('admin');
    
    // Start activity tracking
    activityTracker.startTracking(sessionId);
  };

  const handleLogout = async () => {
    try {
      // Stop activity tracking first
      activityTracker.stopTracking();
      
      // Call logout API with session ID if available
      if (sessionId) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ session_id: sessionId })
        });
      } else {
        // Fallback logout without session ID
        await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include'
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state and redirect
      setUser(null);
      setSessionId(null);
      setView('dashboard');
      setAuthMode('login');
      
      // Clear any stored auth data
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Force page reload to clear any cached state
      window.location.href = '/login';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage mode={authMode} setMode={setAuthMode} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-zinc-900 text-zinc-400 transition-all duration-300 flex flex-col border-r border-zinc-800`}>
        <div className="p-6 flex items-center gap-3 text-white">
          <Shield className="w-8 h-8 text-emerald-500" />
          {sidebarOpen && <span className="font-bold text-xl tracking-tight">SecureCloud</span>}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {user.role === 'user' && (
            <>
              <NavItem 
                icon={<LayoutDashboard />} 
                label="Dashboard" 
                active={view === 'dashboard'} 
                onClick={() => setView('dashboard')} 
                collapsed={!sidebarOpen}
              />
              <NavItem 
                icon={<FilePlus />} 
                label="Submit Complaint" 
                active={view === 'submit'} 
                onClick={() => setView('submit')} 
                collapsed={!sidebarOpen}
              />
            </>
          )}
          {user.role === 'admin' && (
            <>
              <NavItem 
                icon={<Shield />} 
                label="Admin Panel" 
                active={view === 'admin'} 
                onClick={() => setView('admin')} 
                collapsed={!sidebarOpen}
              />
              <NavItem 
                icon={<Camera />} 
                label="Criminal Database" 
                active={view === 'criminals'} 
                onClick={() => setView('criminals')} 
                collapsed={!sidebarOpen}
              />
              <NavItem 
                icon={<Activity />} 
                label="Activity Tracking" 
                active={view === 'activity'} 
                onClick={() => setView('activity')} 
                collapsed={!sidebarOpen}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <User className="w-5 h-5" />
            </div>
            {sidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-zinc-500 truncate capitalize">{user.role}</p>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className={`w-full mt-4 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors ${sidebarOpen ? '' : 'justify-center'}`}
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-zinc-100 rounded-lg">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-zinc-500">Current Session</p>
              <p className="text-sm font-medium">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && <Dashboard key="dashboard" onSelect={(id) => { setSelectedComplaintId(id); setView('details'); }} />}
            {view === 'submit' && <SubmitForm key="submit" onSuccess={() => setView('dashboard')} />}
            {view === 'admin' && <AdminPanel key="admin" onSelect={(id) => { setSelectedComplaintId(id); setView('details'); }} />}
            {view === 'criminals' && <CriminalManagement key="criminals" />}
            {view === 'activity' && <AdminActivityDashboard key="activity" />}
            {view === 'details' && selectedComplaintId && (
              <ComplaintDetails 
                key="details" 
                id={selectedComplaintId} 
                onBack={() => setView(user.role === 'admin' ? 'admin' : 'dashboard')} 
                isAdmin={user.role === 'admin'}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
        active 
          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
          : 'hover:bg-zinc-800 hover:text-white'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      {React.cloneElement(icon, { className: 'w-5 h-5 shrink-0' })}
      {!collapsed && <span className="font-medium text-sm">{label}</span>}
    </button>
  );
}

// --- Page Components ---

function AuthPage({ mode, setMode, onLogin }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, role: 'user' }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('✅ Account created successfully! Please login.');
        setName('');
        setEmail('');
        setPassword('');
        setMode('login');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('✅ Login successful!');
        onLogin(result.user, result.session_id);
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">SecureCloud</h1>
          <p className="text-zinc-400">Digital Evidence Submission & Verification</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-zinc-900 mb-6">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          
          {mode === 'register' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••"
                />
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}

          <button
            onClick={mode === 'register' ? handleRegister : handleLogin}
            disabled={loading}
            className="w-full mt-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
                setName('');
                setEmail('');
                setPassword('');
              }}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onSelect, key }: { onSelect: (id: number) => void, key?: any }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/complaints')
      .then(res => res.json())
      .then(data => setComplaints(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Your Complaints</h2>
          <p className="text-zinc-500">Track the status of your submitted evidence</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl px-4 py-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">{complaints.filter(c => c.status === 'Pending').length} Pending</span>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl px-4 py-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">{complaints.filter(c => c.status === 'Verified').length} Verified</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Complaint ID</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Submitted</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400">Loading complaints...</td></tr>
            ) : complaints.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400">No complaints found.</td></tr>
            ) : complaints.map(c => (
              <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-zinc-500">#SC-{c.id.toString().padStart(4, '0')}</td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-zinc-900">{c.title}</p>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">{c.category}</td>
                <td className="px-6 py-4 text-sm text-zinc-500">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4"><Badge status={c.status} /></td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => onSelect(c.id)}
                    className="p-2 hover:bg-zinc-200 rounded-lg text-zinc-600 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function SubmitForm({ onSuccess, key }: { onSuccess: () => void, key?: any }) {
  const [formData, setFormData] = useState({ title: '', description: '', category: 'Cybercrime' });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return alert('Please upload at least one evidence file');
    setLoading(true);

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('category', formData.category);
    
    // Append all files
    files.forEach(file => {
      data.append('evidence', file);
    });

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        body: data
      });
      if (res.ok) {
        alert('Complaint submitted successfully!');
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || 'Submission failed');
      }
    } catch (err) {
      alert('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-zinc-900">Submit New Complaint</h2>
        <p className="text-zinc-500">Provide accurate details and evidence for verification</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="grid grid-cols-2 gap-6">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-zinc-700 mb-1">Complaint Title</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="Brief summary of the issue"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
            <select
              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
            >
              <option>cybercrime</option>
              <option>financial fraud</option>
              <option>harassment</option>
              <option>theft</option>
              <option>vandalism</option>
              <option>other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Evidence Files (Max 5)</label>
            <div className="relative">
              <input
                required
                type="file"
                multiple
                className="hidden"
                id="file-upload"
                onChange={e => setFiles(Array.from(e.target.files || []))}
              />
              <label 
                htmlFor="file-upload"
                className="w-full flex items-center gap-2 px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-100 transition-colors"
              >
                <Upload className="w-4 h-4 text-zinc-400" />
                <span className="text-sm text-zinc-600 truncate">
                  {files.length > 0 ? `${files.length} file(s) selected` : 'Choose files...'}
                </span>
              </label>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((file, index) => (
                    <div key={`file-${index}-${file.name}`} className="text-xs text-zinc-500 truncate">
                      • {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-[10px] text-zinc-400">PDF, JPG, PNG, MP4 (Max 50MB per file, up to 5 files)</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Detailed Description</label>
          <textarea
            required
            rows={4}
            className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            placeholder="Provide all relevant details, dates, and names..."
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="bg-emerald-50 p-4 rounded-xl flex gap-3 border border-emerald-100">
          <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-700 leading-relaxed">
            By submitting, you confirm that the evidence provided is authentic. A SHA-256 hash will be generated to ensure data integrity.
          </p>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Submitting...' : (
            <>
              <FilePlus className="w-5 h-5" />
              Submit Evidence
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}

function AdminPanel({ onSelect, key }: { onSelect: (id: number) => void, key?: any }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminFormData, setAdminFormData] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    fetch('/api/complaints')
      .then(res => res.json())
      .then(data => setComplaints(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'All' ? complaints : complaints.filter(c => c.status === filter);

  const handleDeleteComplaint = async (complaintId: number) => {
    if (!confirm('Are you sure you want to delete this complaint and all its evidence files? This action cannot be undone.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/complaints/${complaintId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (res.ok) {
        alert('Complaint deleted successfully');
        // Refresh the complaints list
        fetch('/api/complaints')
          .then(res => res.json())
          .then(data => setComplaints(data));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete complaint');
      }
    } catch (err) {
      console.error('Failed to delete complaint:', err);
      alert('Failed to delete complaint');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);

    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(adminFormData)
      });
      
      if (res.ok) {
        alert('Admin account created successfully');
        setShowAdminForm(false);
        setAdminFormData({ name: '', email: '', password: '', role: 'admin' });
      } else {
        const err = await res.json();
        setAdminError(err.error || 'Failed to create admin account');
      }
    } catch (err) {
      console.error('Failed to create admin:', err);
      setAdminError('Failed to create admin account');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Admin Verification Queue</h2>
          <p className="text-zinc-500">Review and verify submitted digital evidence</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl p-1">
          {['All', 'Pending', 'Verified', 'Rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Admin Management Section */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 mb-6 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          Admin Management
        </h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-amber-800">
            <strong>Security Notice:</strong> Only existing admins can create new admin accounts. Public registration is restricted to user accounts only.
          </p>
        </div>
        <button
          onClick={() => setShowAdminForm(true)}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Create New Admin Account
        </button>
      </div>

      {/* Admin Creation Form Modal */}
      {showAdminForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-zinc-900">Create Admin Account</h3>
              <button 
                onClick={() => setShowAdminForm(false)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    required
                    type="text"
                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="Admin Name"
                    value={adminFormData.name}
                    onChange={e => setAdminFormData({ ...adminFormData, name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    required
                    type="email"
                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="admin@company.com"
                    value={adminFormData.email}
                    onChange={e => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    required
                    type="password"
                    className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="•••••••"
                    value={adminFormData.password}
                    onChange={e => setAdminFormData({ ...adminFormData, password: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Admin Role</label>
                <select 
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  value={adminFormData.role}
                  onChange={e => setAdminFormData({ ...adminFormData, role: e.target.value })}
                >
                  <option value="admin">Admin (Full Access)</option>
                  <option value="user">User (Submitter Only)</option>
                </select>
              </div>

              {adminError && <p className="text-rose-500 text-sm font-medium">{adminError}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdminForm(false)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={adminLoading}
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {adminLoading ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Submitter</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400">Loading queue...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-400">No complaints in this queue.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-zinc-500">#SC-{c.id}</td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-zinc-900">{c.user_name}</p>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">{c.title}</td>
                <td className="px-6 py-4 text-sm text-zinc-500">{c.category}</td>
                <td className="px-6 py-4"><Badge status={c.status} /></td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onSelect(c.id)}
                      className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      Review
                    </button>
                    <button
                      onClick={() => handleDeleteComplaint(c.id)}
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      title="Delete Complaint"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function ComplaintDetails({ id, onBack, isAdmin, key }: { id: number, onBack: () => void, isAdmin: boolean, key?: any }) {
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/complaints/${id}`)
      .then(res => res.json())
      .then(data => setComplaint(data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusUpdate = async (status: string) => {
    if (!remark) return alert('Please provide a verification remark');
    
    try {
      const res = await fetch(`/api/admin/complaints/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remark })
      });
      if (res.ok) {
        alert('Status updated successfully');
        onBack();
      }
    } catch (err) {
      alert('Update failed');
    }
  };

  if (loading) return <div className="text-center py-12">Loading details...</div>;
  if (!complaint) return <div className="text-center py-12">Complaint not found.</div>;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 font-medium">
        <AlertCircle className="w-4 h-4 rotate-180" />
        Back to List
      </button>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-zinc-900">{complaint.title}</h2>
                  <Badge status={complaint.status} />
                </div>
                <p className="text-sm text-zinc-500">Submitted by {complaint.user_name || 'User'} on {new Date(complaint.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400 font-mono uppercase tracking-widest">Case ID</p>
                <p className="text-lg font-bold font-mono">#SC-{id.toString().padStart(4, '0')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-zinc-600 leading-relaxed bg-zinc-50 p-4 rounded-xl border border-zinc-100">{complaint.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="flex items-center gap-2 text-zinc-500 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Evidence Files ({complaint.evidence_files?.length || 0})</span>
                  </div>
                  {complaint.evidence_files && complaint.evidence_files.length > 0 ? (
                    <div className="space-y-2">
                      {complaint.evidence_files.map((file: any, index: number) => (
                        <div key={`evidence-${index}-${file.file_name}`} className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-zinc-900 truncate">{file.file_name}</p>
                            <p className="text-xs text-zinc-500">{file.file_type}</p>
                          </div>
                          <a 
                            href={`/api/files/${id}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No evidence files uploaded</p>
                  )}
                </div>
                <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="flex items-center gap-2 text-zinc-500 mb-1">
                    <Hash className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Integrity Hash (SHA-256)</span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-600 break-all leading-tight">{complaint.file_hash}</p>
                </div>
              </div>
            </div>
          </div>

          {complaint.remark && (
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">Verification Remark</h3>
              <div className="bg-zinc-900 text-zinc-300 p-6 rounded-xl relative overflow-hidden">
                <Shield className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5" />
                <p className="relative z-10 italic">"{complaint.remark}"</p>
                <p className="mt-4 text-xs text-zinc-500 relative z-10">Reviewed on {new Date(complaint.reviewed_at!).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {isAdmin && complaint.status === 'Pending' && (
            <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm sticky top-8">
              <h3 className="text-lg font-bold text-zinc-900 mb-4">Verification Action</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Admin Remark</label>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                    placeholder="Enter verification details or rejection reason..."
                    value={remark}
                    onChange={e => setRemark(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleStatusUpdate('Verified')}
                    className="py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                  >
                    Verify
                  </button>
                  <button 
                    onClick={() => handleStatusUpdate('Rejected')}
                    className="py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-zinc-900 p-6 rounded-2xl text-white">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Security Info
            </h4>
            <ul className="space-y-3 text-xs text-zinc-400">
              <li className="flex gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>Evidence is stored with SHA-256 hashing for non-repudiation.</span>
              </li>
              <li className="flex gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>Access is restricted via JWT-based role authentication.</span>
              </li>
              <li className="flex gap-2">
                <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>All verification actions are timestamped and logged.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

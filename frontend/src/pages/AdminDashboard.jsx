import ActivityLogsPage from './ActivityLogsPage';
import React, { useState, useEffect, useContext } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Trash2, Edit, FileText, Search, ChevronDown, ChevronRight, Activity, Users as UsersIcon, Settings, Clock, CheckCircle, X } from 'lucide-react';

import JobLogTable from '../components/JobLogTable';
import { AuthContext } from '../context/AuthContext';
import { fetchWithCache, invalidateCache, CACHE_KEYS, isCached } from '../utils/cache';
import { cacheGet, cacheSet } from '../utils/cacheStorage';
import Spinner from '../components/Spinner';
import API_URL from '../utils/api';
import { formatJobCode } from '../utils/serialUtils';

function Dashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    ongoingJobs: 0,
    completedJobs: 0,
    activeAnalysts: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [statsLoading, setStatsLoading] = useState(
    () => !isCached(CACHE_KEYS.STATS) || !isCached(CACHE_KEYS.INSTANCES)
  );

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use cache for initial render
        const cachedStats = await cacheGet(CACHE_KEYS.STATS);
        const cachedInstances = await cacheGet(CACHE_KEYS.INSTANCES);
        const cachedUsers = await cacheGet(CACHE_KEYS.USERS);

        const computeStats = (statsObj, instances, users) => {
          if (!statsObj) statsObj = { ongoingJobs: 0, completedJobs: 0 };
          if (!Array.isArray(instances)) instances = [];
          if (!Array.isArray(users)) users = [];

          const activeAnalysts = new Set(
            instances.filter(i => i.status === 'PENDING' && i.assignedTo).map(i => i.assignedTo._id || i.assignedTo)
          ).size;

          setStats({
            ongoingJobs: statsObj.ongoingJobs || 0,
            completedJobs: statsObj.completedJobs || 0,
            activeAnalysts
          });

          const sortedInstances = [...instances]
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 5);

          setRecentActivity(sortedInstances);
        };

        if (cachedStats && cachedInstances && cachedUsers) {
          computeStats(cachedStats, cachedInstances, cachedUsers);
        }

        const [statsRes, instancesRes, usersRes] = await Promise.all([
          axios.get(`${API_URL}/api/jobs/stats`),
          axios.get(`${API_URL}/api/tests/instances`),
          axios.get(`${API_URL}/api/users`)
        ]);

        computeStats(statsRes.data, instancesRes.data, usersRes.data);

        cacheSet(CACHE_KEYS.STATS, statsRes.data);
        cacheSet(CACHE_KEYS.INSTANCES, instancesRes.data);
        cacheSet(CACHE_KEYS.USERS, usersRes.data);

      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const StatCard = ({ icon: Icon, title, value, color, subtitle }) => (
    <div className="card" style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ padding: '0.6rem', backgroundColor: `${color}15`, color: color, borderRadius: 'var(--radius-md)' }}>
          <Icon size={20} />
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{value}</div>
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.9rem' }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{subtitle}</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>Admin Dashboard</h1>
      </div>

      <div className="stat-cards">
        <StatCard
          icon={Activity}
          title="Ongoing Jobs"
          value={stats.ongoingJobs}
          color="var(--color-primary)"
          subtitle="Currently in progress"
        />
        <StatCard
          icon={CheckCircle}
          title="Completed Jobs"
          value={stats.completedJobs}
          color="var(--color-success)"
          subtitle="Fully completed"
        />
        <StatCard
          icon={UsersIcon}
          title="Active Analysts"
          value={stats.activeAnalysts}
          color="#8B5CF6"
          subtitle="Currently working on jobs"
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} /> Recent Activity
          </h3>
        </div>
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--color-surface-hover)' }}>
              <tr>
                <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ID / Code</th>
                <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client</th>
                <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analyst</th>
                <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {statsLoading ? (
                <tr><td colSpan="4"><Spinner message="Fetching activity..." /></td></tr>
              ) : recentActivity.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)' }}>No recent activity detected.</td></tr>
              ) : (
                recentActivity.map(inst => (
                  <tr key={inst._id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{formatJobCode(inst.testCode)}</td>
                    <td style={{ fontWeight: 500 }}>{inst.clientName}</td>
                    <td>{inst.assignedTo?.name || <span style={{ color: 'var(--color-text-muted)' }}>Unassigned</span>}</td>
                    <td>
                      <span className={`badge ${inst.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                        {inst.status === 'COMPLETED' ? 'Finished' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StaffTable({ users, isLoading, emptyMessage, onDelete }) {
  if (isLoading && users.length === 0) {
    return <Spinner message={emptyMessage.replace('No ', 'Loading ').replace(' found', '...')} />;
  }
  if (users.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table style={{ margin: 0 }}>
        <thead style={{ backgroundColor: 'var(--color-surface-hover)' }}>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u._id}>
              <td style={{ fontWeight: 500 }}>{u.name}</td>
              <td>{u.email}</td>
              <td>
                <span className={`badge ${u.role === 'ADMIN' || u.role === 'ADMIN_OFFICER' ? 'badge-primary' : u.role === 'HEAD' ? 'badge-warning' : 'badge-success'}`}>
                  {u.role}
                </span>
              </td>
              <td>{u.department || 'All'}</td>
              <td>
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${u.name}?`)) {
                      onDelete(u._id);
                    }
                  }}
                  style={{ padding: '0.25rem 0.5rem', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}
                  title="Delete User"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollapsibleSection({ title, count, isOpen, onToggle, children }) {
  return (
    <div className="card" style={{ padding: 0, marginBottom: '1rem', overflow: 'hidden' }}>
      <div
        onClick={onToggle}
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          backgroundColor: isOpen ? 'var(--color-surface-hover)' : 'white',
          transition: 'background-color 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <h3 style={{ margin: 0 }}>{title}</h3>
          <span className="badge badge-secondary" style={{ marginLeft: '0.5rem' }}>{count}</span>
        </div>
      </div>
      {isOpen && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [expanded, setExpanded] = useState({
    management: true,
    heads: true,
    assistants: false
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', role: 'ADMIN_OFFICER'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [usersLoading, setUsersLoading] = useState(() => !isCached(CACHE_KEYS.USERS));

  const fetchUsers = async () => {
    try {
      await fetchWithCache(
        `${API_URL}/api/users`,
        CACHE_KEYS.USERS,
        setUsers
      );
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleSection = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleNameChange = (e) => {
    const newName = e.target.value;
    const firstName = newName.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    setFormData(prev => ({
      ...prev, name: newName, password: firstName ? `${firstName}123` : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{10,15}$/;

    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!phoneRegex.test(formData.phone)) {
      setError("Please enter a valid phone number (10-15 digits).");
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/api/users`, formData);
      setSuccess(`User created successfully. Temporary password is: ${res.data.temporaryPassword}`);
      setFormData({ name: '', email: '', phone: '', password: '', role: 'ADMIN_OFFICER' });
      setShowForm(false);
      invalidateCache(CACHE_KEYS.USERS);
      fetchUsers();

      // Auto-dismiss after 15 seconds so they have time to copy the password
      setTimeout(() => {
        setSuccess('');
      }, 15000);
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/users/${id}`);
      setSuccess('User successfully removed');
      invalidateCache(CACHE_KEYS.USERS);
      fetchUsers();

      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const managementUsers = users.filter(u => u.role === 'ADMIN' || u.role === 'ADMIN_OFFICER');
  const headUsers = users.filter(u => u.role === 'HEAD');
  const assistantUsers = users.filter(u => u.role === 'ASSISTANT');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1>Staff Directory</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Close Form' : '+ Create User'}
        </button>
      </div>

      {error && <div style={{ marginBottom: '1rem', color: 'var(--color-danger)', backgroundColor: 'var(--color-danger-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>{error}</div>}
      {success && (
        <div style={{
          position: 'fixed', top: '6rem', right: '2rem', zIndex: 1000,
          color: 'white', backgroundColor: 'var(--color-success)',
          padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '1rem',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle size={20} />
            <span style={{ fontWeight: 500 }}>{success}</span>
          </div>
          <button
            onClick={() => setSuccess('')}
            style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Create New User</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 500 }}>Full Name</label>
                <input type="text" value={formData.name} onChange={handleNameChange} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 500 }}>Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 500 }}>Phone Number</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 500 }}>Password (Auto-generated)</label>
                <input type="text" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 500 }}>Role</label>
                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} required style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-main)', width: '100%', fontSize: '0.95rem' }}>
                  <option value="ADMIN_OFFICER">Admin Officer</option>
                  <option value="ADMIN">System Admin</option>
                </select>
              </div>
              <div style={{ flex: 1 }}></div>
            </div>

            <div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Submit & Create User</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <CollapsibleSection
          title="Management"
          count={managementUsers.length}
          isOpen={expanded.management}
          onToggle={() => toggleSection('management')}
        >
          <StaffTable users={managementUsers} isLoading={usersLoading} emptyMessage="No management staff found" onDelete={handleDeleteUser} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Department Heads"
          count={headUsers.length}
          isOpen={expanded.heads}
          onToggle={() => toggleSection('heads')}
        >
          <StaffTable users={headUsers} isLoading={usersLoading} emptyMessage="No department heads found" onDelete={handleDeleteUser} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Lab Assistants"
          count={assistantUsers.length}
          isOpen={expanded.assistants}
          onToggle={() => toggleSection('assistants')}
        >
          <StaffTable users={assistantUsers} isLoading={usersLoading} emptyMessage="No lab assistants found" onDelete={handleDeleteUser} />
        </CollapsibleSection>
      </div>
    </div>
  );
}

function Audit() {
  const location = useLocation();
  return (
    <ActivityLogsPage
      title="Activity Logs"
      fetchUrl={`${API_URL}/api/jobs?includeCancelled=true`}
      enableSocketUpdates={false}
      defaultExpandedId={location.state?.expandJobId}
      cacheKey={CACHE_KEYS.JOBS_ALL}
    />
  );
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/audit" element={<Audit />} />
    </Routes>
  );
}

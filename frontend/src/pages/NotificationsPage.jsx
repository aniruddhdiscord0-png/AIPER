import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Check, Info, AlertTriangle, CheckCircle, Clock, Circle, X, ArrowLeft } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import { useSocket } from '../context/SocketContext';
import API_URL from '../utils/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const socket = useSocket();

  useEffect(() => {
    if (!socket || !user) return;
    
    const handleNewNotification = (payload) => {
      if (payload.recipientId === user._id) {
        fetchNotifications();
      }
    };

    socket.on('NEW_NOTIFICATION', handleNewNotification);

    return () => {
      socket.off('NEW_NOTIFICATION', handleNewNotification);
    };
  }, [socket, user]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleDeleteNotification = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification._id);
    }
    if (notification.link) {
      let targetLink = notification.link;
      if (user && !targetLink.startsWith(`/${user.role.toLowerCase().replace('_', '-')}`)) {
        const prefix = `/${user.role.toLowerCase().replace('_', '-')}`;
        if (targetLink.startsWith('/review') || targetLink.startsWith('/audit') || targetLink.startsWith('/dispatcher')) {
          targetLink = `${prefix}${targetLink}`;
        }
      }
      navigate(targetLink);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'ACTION_REQUIRED': return <AlertTriangle size={20} color="var(--color-warning)" />;
      case 'SUCCESS': return <CheckCircle size={20} color="var(--color-success)" />;
      case 'WARNING': return <AlertTriangle size={20} color="var(--color-danger)" />;
      default: return <Info size={20} color="var(--color-primary)" />;
    }
  };

  const getTypeBadge = (type) => {
    const styles = {
      'ACTION_REQUIRED': { bg: 'rgba(241, 196, 15, 0.12)', color: '#d35400', label: 'Action Required' },
      'SUCCESS': { bg: 'rgba(46, 204, 113, 0.12)', color: 'var(--color-success)', label: 'Success' },
      'WARNING': { bg: 'rgba(231, 76, 60, 0.12)', color: 'var(--color-danger)', label: 'Warning' },
      'INFO': { bg: 'rgba(52, 152, 219, 0.12)', color: 'var(--color-primary)', label: 'Info' }
    };
    const s = styles[type] || styles['INFO'];
    return (
      <span style={{
        fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
        borderRadius: '9999px', backgroundColor: s.bg, color: s.color
      }}>
        {s.label}
      </span>
    );
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const filterBtnStyle = (active) => ({
    padding: '0.4rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 500,
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: active ? 'var(--color-primary)' : 'var(--color-surface-hover)',
    color: active ? 'white' : 'var(--color-text-muted)',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'none', border: 'none', color: 'var(--color-primary)',
          cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
          padding: '0.5rem 0', marginBottom: '1rem'
        }}
      >
        <ArrowLeft size={18} /> Back
      </button>

      {/* Header */}
      <div className="flex-row-responsive" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Bell size={28} style={{ color: 'var(--color-primary)' }} />
          <h1 style={{ margin: 0 }}>Notifications</h1>
          {unreadCount > 0 && (
            <span style={{
              backgroundColor: 'var(--color-danger)', color: 'white',
              fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.55rem',
              borderRadius: '9999px'
            }}>
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="btn"
            style={{
              padding: '0.4rem 1rem', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              backgroundColor: 'transparent', border: '1px solid var(--color-border)',
              color: 'var(--color-primary)', cursor: 'pointer', borderRadius: 'var(--radius-md)'
            }}
          >
            <Check size={16} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button style={filterBtnStyle(filter === 'all')} onClick={() => setFilter('all')}>
          All ({notifications.length})
        </button>
        <button style={filterBtnStyle(filter === 'unread')} onClick={() => setFilter('unread')}>
          Unread ({unreadCount})
        </button>
        <button style={filterBtnStyle(filter === 'read')} onClick={() => setFilter('read')}>
          Read ({notifications.length - unreadCount})
        </button>
      </div>

      {/* Notifications list */}
      {loading ? (
        <Spinner message="Loading notifications..." />
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          <Bell size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 0 0.3rem 0' }}>
            {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
          </p>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            {filter === 'all' ? "You're all caught up!" : 'Try switching filters.'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((notif, idx) => (
            <div
              key={notif._id}
              onClick={() => handleNotificationClick(notif)}
              style={{
                padding: '1rem 1.25rem',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                backgroundColor: notif.read ? 'transparent' : 'rgba(var(--color-primary-rgb), 0.04)',
                cursor: notif.link ? 'pointer' : 'default',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                transition: 'background-color 0.15s',
                position: 'relative'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = notif.read ? 'transparent' : 'rgba(var(--color-primary-rgb), 0.04)'}
            >
              {/* Unread indicator bar */}
              {!notif.read && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', backgroundColor: 'var(--color-primary)', borderRadius: '0 2px 2px 0' }} />
              )}

              {/* Icon */}
              <div style={{ marginTop: '0.15rem', flexShrink: 0 }}>
                {getIcon(notif.type)}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.3rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: notif.read ? 500 : 700, color: 'var(--color-text-main)' }}>
                    {notif.title}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {getTypeBadge(notif.type)}
                  </div>
                </div>
                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {notif.message}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  <Clock size={12} />
                  <span>{new Date(notif.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
                {!notif.read && (
                  <button
                    onClick={(e) => handleMarkAsRead(notif._id, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '0.25rem' }}
                    title="Mark as read"
                  >
                    <Circle size={14} fill="var(--color-primary)" />
                  </button>
                )}
                <button
                  onClick={(e) => handleDeleteNotification(notif._id, e)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                  title="Remove"
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Showing {filtered.length} of {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

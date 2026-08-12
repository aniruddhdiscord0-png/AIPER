import React, { useState, useEffect, useRef, useContext } from 'react';
import { Bell, Check, Info, AlertTriangle, CheckCircle, Clock, Circle, X } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import API_URL from '../utils/api';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (err) {
      if (axios.isCancel(err) || err.message === 'canceled' || err.message === 'Request aborted' || err.code === 'ERR_CANCELED') return;
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Polling every 60 seconds as a fallback
    const interval = setInterval(fetchNotifications, 60000);

    // Fetch on window focus
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const socket = useSocket();

  useEffect(() => {
    if (!socket || !user) return;
    
    const handleNewNotification = (payload) => {
      // If the notification was meant for this user, fetch the latest
      if (payload.recipientId === user._id) {
        fetchNotifications();
      }
    };

    socket.on('NEW_NOTIFICATION', handleNewNotification);

    return () => {
      socket.off('NEW_NOTIFICATION', handleNewNotification);
    };
  }, [socket, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      
      // Robust link normalization: if it's a relative path like "/review" or "/audit",
      // prepend the correct dashboard prefix based on user role.
      if (user && !targetLink.startsWith(`/${user.role.toLowerCase().replace('_', '-')}`)) {
        const prefix = `/${user.role.toLowerCase().replace('_', '-')}`;
        if (targetLink.startsWith('/review') || targetLink.startsWith('/audit') || targetLink.startsWith('/dispatcher')) {
          targetLink = `${prefix}${targetLink}`;
        }
      }

      navigate(targetLink);
      setIsOpen(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'ACTION_REQUIRED': return <AlertTriangle size={18} color="var(--color-warning)" />;
      case 'SUCCESS': return <CheckCircle size={18} color="var(--color-success)" />;
      case 'WARNING': return <AlertTriangle size={18} color="var(--color-danger)" />;
      default: return <Info size={18} color="var(--color-primary)" />;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div 
        style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={24} color="var(--color-text-main)" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0px',
            right: '-4px',
            backgroundColor: 'var(--color-danger)',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            borderRadius: '10px',
            minWidth: '20px',
            height: '20px',
            padding: '0 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--color-surface)',
            boxSizing: 'border-box'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>

      {isOpen && (
        <div className="notification-dropdown">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-surface-hover)' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Check size={14} /> Mark all read
              </button>
            )}
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={32} opacity={0.5} />
                <p style={{ margin: 0 }}>You're all caught up!</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif._id} 
                  onClick={() => handleNotificationClick(notif)}
                  style={{ 
                    padding: '1rem', 
                    borderBottom: '1px solid var(--color-border)', 
                    backgroundColor: notif.read ? 'transparent' : 'rgba(var(--color-primary-rgb), 0.05)',
                    cursor: notif.link ? 'pointer' : 'default',
                    display: 'flex',
                    gap: '1rem',
                    transition: 'background-color 0.2s',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = notif.read ? 'transparent' : 'rgba(var(--color-primary-rgb), 0.05)'}
                >
                  {!notif.read && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', backgroundColor: 'var(--color-primary)' }} />
                  )}
                  <div style={{ marginTop: '0.2rem' }}>
                    {getIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: notif.read ? 500 : 700, color: 'var(--color-text-main)' }}>
                        {notif.title}
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}>
                        <Clock size={12} />
                        {new Date(notif.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {notif.message}
                    </p>
                  </div>
                  {!notif.read && (
                    <button 
                      onClick={(e) => handleMarkAsRead(notif._id, e)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '0.2rem', alignSelf: 'flex-start' }}
                      title="Mark as read"
                    >
                      <Circle size={12} fill="var(--color-primary)" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => handleDeleteNotification(notif._id, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.2rem', alignSelf: 'flex-start' }}
                    title="Remove notification"
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer link to full page */}
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-hover)'
          }}>
            <button
              onClick={() => { navigate('/notifications'); setIsOpen(false); }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--color-primary)', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600
              }}
            >
              View All Notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

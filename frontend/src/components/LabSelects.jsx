import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import API_URL from '../utils/api';
import axios from 'axios';

export function MethodSelect({ value, onChange, onManualAdd }) {
  const [methods, setMethods] = useState([]);
  const [filter, setFilter] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setFilter(value || "");
  }, [value]);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/parameters/methods`, { headers: { Authorization: `Bearer ${token}` } });
        setMethods(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMethods();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = methods.filter(m => m.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={filter}
          onChange={e => { setFilter(e.target.value); onChange(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          className="input-field"
          placeholder="Type or select test method..."
          style={{ width: '100%', fontSize: '0.85rem', paddingRight: '2.5rem' }}
        />
        <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }}>
          <Search size={16} />
        </div>
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', zIndex: 1000, width: '100%', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', marginTop: '0.25rem' }}>
          {filtered.length > 0 ? (
            filtered.map((m, idx) => (
              <div
                key={idx}
                onClick={() => { setFilter(m); onChange(m); setIsOpen(false); }}
                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-surface-hover)' : 'none' }}
                onMouseEnter={e => e.target.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
              >
                {m}
              </div>
            ))
          ) : (
            <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              <div style={{ marginBottom: '0.5rem' }}>No matching methods found.</div>
              {onManualAdd && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                  onClick={() => {
                    setIsOpen(false);
                    onManualAdd(filter);
                  }}
                >
                  + Create "{filter}"
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EquipmentSelect({ value, onChange }) {
  const [equipment, setEquipment] = useState([]);
  const [filter, setFilter] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setFilter(value || "");
  }, [value]);

  useEffect(() => {
    const fetchEq = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/parameters/equipment`, { headers: { Authorization: `Bearer ${token}` } });
        setEquipment(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchEq();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = equipment.filter(e => e.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={{ position: 'relative', minWidth: '100px' }}>
      <input
        type="text"
        value={filter}
        onChange={e => { setFilter(e.target.value); onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        className="input-field"
        placeholder="Type or select..."
        style={{ width: '100%', fontSize: '0.85rem' }}
      />
      {isOpen && (
        <div style={{ position: 'absolute', zIndex: 1000, width: '100%', maxHeight: '150px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', marginTop: '0.25rem' }}>
          {filtered.length > 0 ? (
            filtered.map((eq, idx) => (
              <div
                key={idx}
                onClick={() => { setFilter(eq); onChange(eq); setIsOpen(false); }}
                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: idx < filtered.length - 1 ? '1px solid var(--color-surface-hover)' : 'none' }}
                onMouseEnter={e => e.target.style.backgroundColor = 'var(--color-surface-hover)'}
                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
              >
                {eq}
              </div>
            ))
          ) : (
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              (Will add as new: {filter})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

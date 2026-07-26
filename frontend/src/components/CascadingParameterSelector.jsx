import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Spinner from './Spinner';
import { AlertCircle, Beaker, Search, X, Plus, Save, Trash2 } from 'lucide-react';
import axios from 'axios';
import API_URL from '../utils/api';

const CascadingParameterSelector = ({ 
  label = "Parameters", 
  onDataChange, 
  modeClass = "",
  allGroupData = null, // Fix 2: Accept pre-fetched data from parent
  initialSelectedParams = [],
  initialGroupMetadata = null,
  initialPesticidePanel = { enabled: false, panelType: null },
  initialShowSpecifications = false,
  externalSync = null, // Hybrid mode sync
  immutable = false
}) => {
  const [selectedGroups, setSelectedGroups] = useState(initialGroupMetadata?.group ? initialGroupMetadata.group.split(', ') : []);
  const [selectedSubGroups, setSelectedSubGroups] = useState(initialGroupMetadata?.subGroup ? initialGroupMetadata.subGroup.split(', ') : []);
  const [selectedProductCategory, setSelectedProductCategory] = useState(initialGroupMetadata?.productCategory || '');
  
  // Officer's curated pick list
  const [selectedParams, setSelectedParams] = useState(initialSelectedParams);
  const [showSpecifications, setShowSpecifications] = useState(initialShowSpecifications);
  const [specModalParam, setSpecModalParam] = useState(null);
  const [specModalValue, setSpecModalValue] = useState('');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef(null);

  // Global parameters state
  const [globalParameters, setGlobalParameters] = useState([]);

  const getParamId = (p) => p.parameterId || p._id;

  // Hybrid Mode One-Way Sync (Additions only)
  useEffect(() => {
    if (externalSync) {
      if (externalSync.group) {
        const extGroups = externalSync.group.split(', ').filter(Boolean);
        setSelectedGroups(prev => {
          const newGroups = [...prev];
          let changed = false;
          extGroups.forEach(g => { if (!newGroups.includes(g)) { newGroups.push(g); changed = true; } });
          return changed ? newGroups : prev;
        });
      }
      if (externalSync.subGroup) {
        const extSubGroups = externalSync.subGroup.split(', ').filter(Boolean);
        setSelectedSubGroups(prev => {
          const newSubGroups = [...prev];
          let changed = false;
          extSubGroups.forEach(sg => { if (!newSubGroups.includes(sg)) { newSubGroups.push(sg); changed = true; } });
          return changed ? newSubGroups : prev;
        });
      }
      if (externalSync.productCategory && !selectedProductCategory) {
        setSelectedProductCategory(externalSync.productCategory);
      }
    }
  }, [externalSync]);

  // Fetch global parameters on mount
  useEffect(() => {
    const fetchParams = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/parameters`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const fresh = res.data || [];
        setGlobalParameters(fresh);

        // Sync live specification into already-selected params so the
        // "✓ Edit" indicator and dispatch payload always reflect Data Settings.
        const specMap = {};
        fresh.forEach(p => { specMap[p._id?.toString()] = p.specification || ''; });
        setSelectedParams(prev =>
          prev.map(p => {
            const id = (p.parameterId?._id || p.parameterId)?.toString();
            return id && specMap[id] !== undefined
              ? { ...p, specification: specMap[id] }
              : p;
          })
        );
      } catch (err) {
        console.error('Failed to fetch global parameters', err);
      }
    };
    fetchParams();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ═══════ ALL LOCAL FILTERING — zero API calls on interaction ═══════
  const allData = allGroupData || [];

  const groups = useMemo(() => {
    const s = new Set(allData.map(d => d.group));
    return Array.from(s).sort();
  }, [allData]);

  const subGroups = useMemo(() => {
    if (selectedGroups.length === 0) return [];
    const filtered = allData.filter(d => selectedGroups.includes(d.group));
    const seen = new Set();
    return filtered.filter(d => {
      if (seen.has(d.subGroup)) return false;
      seen.add(d.subGroup);
      return true;
    });
  }, [allData, selectedGroups]);

  const matchedDocs = useMemo(() => {
    if (selectedGroups.length === 0 || selectedSubGroups.length === 0) return [];
    return allData.filter(d => 
      selectedGroups.includes(d.group) && selectedSubGroups.includes(d.subGroup)
    );
  }, [allData, selectedGroups, selectedSubGroups]);

  const isPesticidePanel = useMemo(() => matchedDocs.some(d => d.isPesticidePanel), [matchedDocs]);
  const pesticidePanelType = useMemo(() => {
    const panel = matchedDocs.find(d => d.isPesticidePanel);
    return panel ? panel.pesticidePanelType : null;
  }, [matchedDocs]);
  const pesticideSubPanels = useMemo(() => {
    const panel = matchedDocs.find(d => d.isPesticidePanel);
    return panel ? (panel.pesticideSubPanels || []) : [];
  }, [matchedDocs]);

  const productCategories = useMemo(() => {
    const cats = new Set();
    matchedDocs.forEach(d => (d.productCategories || []).forEach(c => cats.add(c)));
    return Array.from(cats).sort();
  }, [matchedDocs]);

  const availableParameters = useMemo(() => {
    // Return all global parameters instead of restricting by matchedDocs
    return globalParameters;
  }, [globalParameters]);

  const hasNonPanelSubGroups = useMemo(() => matchedDocs.some(d => !d.isPesticidePanel), [matchedDocs]);

  // ═══════ NOTIFY PARENT ═══════
  // Fix 1: onDataChange is NOT in the dependency array — breaks the infinite loop
  useEffect(() => {
    if (onDataChange) {
      onDataChange({
        parameters: selectedParams,
        groupMetadata: {
          group: selectedGroups.join(', '),
          subGroup: selectedSubGroups.join(', '),
          productCategory: selectedProductCategory
        },
        pesticidePanel: {
          enabled: isPesticidePanel,
          panelType: pesticidePanelType
        },
        showSpecifications
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParams, selectedGroups, selectedSubGroups, selectedProductCategory, isPesticidePanel, pesticidePanelType, showSpecifications]);

  // ═══════ HANDLERS ═══════
  // Fix 3: Inline cleanup in handlers instead of cascading useEffects
  const handleGroupSelect = (e) => {
    const value = e.target.value;
    if (value && !selectedGroups.includes(value)) {
      setSelectedGroups(prev => [...prev, value]);
    }
  };

  const handleGroupRemove = (group) => {
    const newGroups = selectedGroups.filter(g => g !== group);
    setSelectedGroups(newGroups);
    // Immediately prune subgroups that no longer belong to any selected group
    const validSubGroupNames = allData
      .filter(d => newGroups.includes(d.group))
      .map(d => d.subGroup);
    setSelectedSubGroups(prev => prev.filter(sg => validSubGroupNames.includes(sg)));
  };

  const handleSubGroupSelect = (e) => {
    const value = e.target.value;
    if (value && !selectedSubGroups.includes(value)) {
      setSelectedSubGroups(prev => [...prev, value]);
    }
  };

  const handleSubGroupRemove = (subGroup) => {
    setSelectedSubGroups(prev => prev.filter(sg => sg !== subGroup));
    // Reset product category if it's no longer valid after subgroup removal
  };

  const filteredSuggestions = availableParameters.filter(p => {
    if (selectedParams.some(sp => getParamId(sp) === getParamId(p))) return false;
    if (!searchTerm.trim()) return true;
    return p.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Reset active index when search term changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchTerm]);

  const handleSearchKeyDown = (e) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const paramToAdd = filteredSuggestions[activeIndex];
      if (paramToAdd) {
        addParameter(paramToAdd);
        setSearchTerm('');
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSearchTerm('');
    }
  };

  
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newParamForm, setNewParamForm] = useState({ name: '', type: 'Micro', unit: '' });

  const handleCreateParameter = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newParamForm.name.trim()) {
      alert("Parameter Name is required");
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/api/parameters`, newParamForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGlobalParameters(prev => [...prev, res.data].sort((a,b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())));
      addParameter(res.data);
      setIsCreatingNew(false);
      setNewParamForm({ name: '', type: 'Micro', unit: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating parameter');
    }
  };

  const handleDeleteParameter = async (paramId) => {
    if (!window.confirm("Are you sure you want to permanently delete this parameter from the library?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/parameters/${paramId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGlobalParameters(prev => prev.filter(p => getParamId(p) !== paramId));
      setSelectedParams(prev => prev.filter(p => getParamId(p) !== paramId));
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting parameter');
    }
  };

  const handleTypeChange = async (paramId, newType) => {
    setSelectedParams(prev => prev.map(p => getParamId(p) === paramId ? { ...p, type: newType } : p));
    setGlobalParameters(prev => prev.map(p => getParamId(p) === paramId ? { ...p, type: newType } : p));
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/parameters/${paramId}`, { type: newType }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error(err);
      alert('Failed to update type');
    }
  };

  const addParameter = (param) => {
    if (!selectedParams.some(sp => getParamId(sp) === getParamId(param))) {
      setSelectedParams(prev => [...prev, param]);
    }
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const removeParameter = (paramId) => setSelectedParams(prev => prev.filter(p => getParamId(p) !== paramId));

  const addAllAvailable = () => {
    const newParams = availableParameters.filter(p => !selectedParams.some(sp => getParamId(sp) === getParamId(p)));
    setSelectedParams(prev => [...prev, ...newParams]);
  };

  const handleUnitChange = (paramId, newUnit) => {
    setSelectedParams(prev => prev.map(p => 
      getParamId(p) === paramId ? { ...p, unit: newUnit } : p
    ));
  };

  const handleSaveUnit = async (paramId, unit) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/api/parameters/${paramId}`, { unit }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // silent success for blur save
    } catch (err) {
      console.error('Error saving unit', err);
      alert('Failed to save unit to database.');
    }
  };

  // ═══════ RENDER ═══════
  if (!allGroupData) {
    return (
      <div className={`cascading-selector ${modeClass}`} style={{ 
        padding: '2rem', textAlign: 'center',
        backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', 
        border: '1px solid var(--color-border)' 
      }}>
        <Spinner message="Loading parameter data..." />
      </div>
    );
  }

  return (
    <div className={`cascading-selector ${modeClass}`} style={{ 
      display: 'flex', flexDirection: 'column', gap: '1rem', 
      padding: '1.25rem', backgroundColor: 'var(--color-surface)', 
      borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' 
    }}>
      <h3 style={{ margin: 0, fontSize: '1.1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        {label}
      </h3>
      
      <div className="flex-row-responsive">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Select Group(s)</label>
          <select 
            onChange={handleGroupSelect} 
            value=""
            disabled={immutable}
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
          >
            <option value="">-- Add Group --</option>
            {groups.filter(g => !selectedGroups.includes(g)).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedGroups.map(g => (
              <div key={g} className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.6rem' }}>
                {g}
                {!immutable && (
                  <button 
                    type="button" 
                    onClick={() => handleGroupRemove(g)} 
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <AlertCircle size={18} style={{ transform: 'rotate(45deg)' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Select Sub-Group(s)</label>
          <select 
            onChange={handleSubGroupSelect} 
            value=""
            disabled={selectedGroups.length === 0 || immutable}
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
          >
            <option value="">-- Add Sub-Group --</option>
            {subGroups.filter(sg => !selectedSubGroups.includes(sg.subGroup)).map(sg => (
              <option key={sg.subGroup} value={sg.subGroup}>
                {sg.subGroup}
              </option>
            ))}
          </select>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedSubGroups.map(sg => (
              <div key={sg} className="badge badge-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.6rem' }}>
                {sg}
                {!immutable && (
                  <button 
                    type="button" 
                    onClick={() => handleSubGroupRemove(sg)} 
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <AlertCircle size={18} style={{ transform: 'rotate(45deg)' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-row-responsive">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Product Category (Aggregate)</label>
          <select 
            value={selectedProductCategory} 
            onChange={e => setSelectedProductCategory(e.target.value)}
            disabled={productCategories.length === 0 || immutable}
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
          >
            <option value="">{productCategories.length === 0 ? '-- No Categories Available --' : '-- Select Category --'}</option>
            {productCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {isPesticidePanel && (
        <div style={{ 
          backgroundColor: '#e8f4fd', color: '#1a5276', 
          padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: '1rem',
          border: '1px solid #aed6f1'
        }}>
          <Beaker size={24} style={{ flexShrink: 0 }} />
          <div>
            <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem' }}>Pesticide Panel Selected (Food)</h5>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              This will automatically create separate assignments for:
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                {pesticideSubPanels.map(sp => (
                  <li key={sp.panelName}>{sp.panelName} ({sp.parameterCount} parameters)</li>
                ))}
              </ul>
            </p>
          </div>
        </div>
      )}

      {(hasNonPanelSubGroups || !!externalSync) && selectedSubGroups.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem' }}>
              Test Parameters 
              <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
                ({selectedParams.length} selected, {availableParameters.length} available)
              </span>
            </h4>
            
          </div>
          
          {!immutable && (
          <div ref={searchRef} style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-surface)'
            }}>
              <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder={`Search from ${availableParameters.length} parameters...`}
                title="Use Arrow keys to navigate, Tab/Enter to select"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleSearchKeyDown}
                style={{ 
                  border: 'none', outline: 'none', width: '100%', 
                  backgroundColor: 'transparent', fontSize: '0.9rem' 
                }}
              />
              {searchTerm && (
                <button 
                  type="button" 
                  onClick={() => { setSearchTerm(''); setShowSuggestions(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', color: 'var(--color-text-muted)' }}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {showSuggestions && filteredSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                maxHeight: '200px', overflowY: 'auto',
                backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderTop: 'none', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                {filteredSuggestions.map((p, index) => (
                  <div
                    key={getParamId(p)}
                    onClick={() => addParameter(p)}
                    onMouseEnter={() => setActiveIndex(index)}
                    style={{
                      padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: activeIndex === index ? 'var(--color-surface-hover)' : 'transparent',
                      borderLeft: activeIndex === index ? '3px solid var(--color-primary)' : '3px solid transparent',
                      transition: 'background-color 0.1s'
                    }}
                  >
                    <span>{p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`badge ${p.type === 'Micro' ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: '0.65rem' }}>
                        {p.type}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{p.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {showSuggestions && searchTerm && filteredSuggestions.length === 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                padding: '0.75rem', textAlign: 'center',
                backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderTop: 'none', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic'
              }}>
                No matching parameters found
              </div>
            )}
          </div>
          )}

          {!immutable && (
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
            <button type="button" onClick={() => setIsCreatingNew(!isCreatingNew)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Plus size={16} /> {isCreatingNew ? 'Cancel Creation' : 'Create New Parameter'}
            </button>
          </div>
          )}
          {isCreatingNew && (
            <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Parameter Name" value={newParamForm.name} onChange={e => setNewParamForm({...newParamForm, name: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleCreateParameter(e)} style={{ padding: '0.4rem', flex: 1, minWidth: '150px' }} />
              <select value={newParamForm.type} onChange={e => setNewParamForm({...newParamForm, type: e.target.value})} style={{ padding: '0.4rem' }}>
                <option value="Micro">Micro</option>
                <option value="Chemical">Chemical</option>
              </select>
              <input type="text" placeholder="Unit (e.g. mg/L)" value={newParamForm.unit} onChange={e => setNewParamForm({...newParamForm, unit: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleCreateParameter(e)} style={{ padding: '0.4rem', width: '100px' }} />
              <button type="button" onClick={handleCreateParameter} className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)' }}>Create</button>
            </div>
          )}
          {/* Selected parameters list */}
          {selectedParams.length > 0 && (
            <>
              <div className="hide-on-mobile" style={{ 
                maxHeight: '250px', overflowY: 'auto', overflowX: 'auto',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', 
                backgroundColor: 'var(--color-surface)' 
              }}>
                <table style={{ width: '100%', minWidth: '400px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ backgroundColor: 'var(--color-surface-hover)', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Parameter Name</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', width: '80px' }}>Type</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', width: '120px' }}>Unit</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', width: '140px' }}>Specification</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedParams.map((p) => (
                      <tr key={getParamId(p)} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{p.name}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <select 
                            value={p.type} 
                            onChange={(e) => handleTypeChange(getParamId(p), e.target.value)}
                            disabled={immutable}
                            style={{ fontSize: '0.75rem', padding: '0.2rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                          >
                            <option value="Micro">Micro</option>
                            <option value="Chemical">Chemical</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <input
                              type="text"
                              value={p.unit}
                              onChange={(e) => handleUnitChange(getParamId(p), e.target.value)}
                              onBlur={() => handleSaveUnit(getParamId(p), p.unit)}
                              disabled={immutable}
                              style={{ 
                                width: '80px', padding: '0.25rem', fontSize: '0.8rem',
                                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)'
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          {(p.name.includes('GCM') || p.name.includes('LCMSMS')) ? (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>N/A</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setSpecModalParam(p); setSpecModalValue(p.specification || ''); }}
                              disabled={immutable}
                              style={{
                                background: p.specification ? 'var(--color-surface-hover)' : 'var(--color-primary)',
                                color: p.specification ? 'var(--color-text-main)' : '#fff',
                                border: p.specification ? '1px solid var(--color-border)' : 'none',
                                padding: '0.3rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                cursor: immutable ? 'not-allowed' : 'pointer',
                                display: 'inline-block'
                              }}
                            >
                              {p.specification ? '✓ Edit' : 'Set Spec'}
                            </button>
                          )}
                        </td>
                        {!immutable && (
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeParameter(getParamId(p))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.35rem', display: 'flex' }}
                                title="Remove from current job selection"
                              >
                                <X size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteParameter(getParamId(p))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0.35rem', display: 'flex' }}
                                title="Delete permanently from database"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="show-on-mobile-flex" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedParams.map((p) => (
                  <div key={`mobile-param-${getParamId(p)}`} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1rem', backgroundColor: 'var(--color-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-primary)', wordBreak: 'break-word', paddingRight: '0.5rem' }}>{p.name}</div>
                      {!immutable && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" onClick={() => removeParameter(getParamId(p))} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: '0.25rem' }}><X size={16}/></button>
                          <button type="button" onClick={() => handleDeleteParameter(getParamId(p))} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', padding: '0.25rem' }}><Trash2 size={16}/></button>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <select 
                        value={p.type} 
                        onChange={(e) => handleTypeChange(getParamId(p), e.target.value)}
                        disabled={immutable}
                        style={{ fontSize: '0.8rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--color-border)', flex: 1 }}
                      >
                        <option value="Micro">Micro</option>
                        <option value="Chemical">Chemical</option>
                      </select>
                      
                      <input
                        type="text"
                        value={p.unit}
                        placeholder="Unit"
                        onChange={(e) => handleUnitChange(getParamId(p), e.target.value)}
                        onBlur={() => handleSaveUnit(getParamId(p), p.unit)}
                        disabled={immutable}
                        style={{ width: '80px', padding: '0.4rem', fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
                      />
                    </div>

                    {(p.name.includes('GCM') || p.name.includes('LCMSMS')) ? (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Specification: N/A</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setSpecModalParam(p); setSpecModalValue(p.specification || ''); }}
                        disabled={immutable}
                        style={{
                          width: '100%',
                          background: p.specification ? 'var(--color-surface-hover)' : 'var(--color-primary)',
                          color: p.specification ? 'var(--color-text-main)' : '#fff',
                          border: p.specification ? '1px solid var(--color-border)' : 'none',
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: immutable ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {p.specification ? `Spec: ${p.specification} (Edit)` : 'Set Specification'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {selectedParams.length > 0 && (
            <div
              onClick={() => setShowSpecifications(!showSpecifications)}
              style={{
                marginTop: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: showSpecifications ? 'rgba(var(--color-primary-rgb, 59, 130, 246), 0.08)' : 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-md)',
                border: showSpecifications ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                userSelect: 'none',
              }}
            >
              {/* Toggle switch */}
              <div style={{
                width: '38px',
                height: '22px',
                borderRadius: '11px',
                backgroundColor: showSpecifications ? 'var(--color-primary)' : 'var(--color-border)',
                position: 'relative',
                transition: 'background-color 0.2s ease',
                flexShrink: 0,
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  position: 'absolute',
                  top: '3px',
                  left: showSpecifications ? '19px' : '3px',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: showSpecifications ? 'var(--color-primary)' : 'var(--color-text-main)',
                  transition: 'color 0.2s ease',
                }}>
                  Include specifications in the report
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {showSpecifications ? 'Specification column will appear in the report' : 'No specification column in the report'}
                </span>
              </div>
            </div>
          )}
          
          {selectedParams.length === 0 && (
            <div style={{ 
              color: 'var(--color-text-muted)', fontSize: '0.9rem', fontStyle: 'italic', 
              padding: '1rem', textAlign: 'center', 
              backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' 
            }}>
              Type above to search and add parameters from the selected sub-group(s).
            </div>
          )}
        </div>
      )}

      {/* No subgroups selected state */}
      {!hasNonPanelSubGroups && !isPesticidePanel && selectedSubGroups.length === 0 && selectedGroups.length > 0 && (
        <div style={{ 
          color: 'var(--color-text-muted)', fontSize: '0.9rem', fontStyle: 'italic', 
          padding: '1rem', textAlign: 'center', 
          backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' 
        }}>
          Select a sub-group to start adding parameters.
        </div>
      )}

      {specModalParam && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', animation: 'slideUp 0.3s ease' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Specification for "{specModalParam.name}"</h3>
            <input 
              autoFocus
              value={specModalValue} 
              onChange={e => setSpecModalValue(e.target.value)} 
              placeholder="Enter specification (e.g. Max 50, 6.5 - 8.5)" 
              style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setSpecModalParam(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={async () => {
                const paramId = getParamId(specModalParam);
                // Update locally
                setSelectedParams(prev => prev.map(p => getParamId(p) === paramId ? { ...p, specification: specModalValue } : p));
                setGlobalParameters(prev => prev.map(p => getParamId(p) === paramId ? { ...p, specification: specModalValue } : p));
                // Update DB
                try {
                  const token = localStorage.getItem('token');
                  await axios.put(`${API_URL}/api/parameters/${paramId}`, { specification: specModalValue }, { headers: { Authorization: `Bearer ${token}` } });
                } catch(e) { console.error('Failed to save spec', e); }
                setSpecModalParam(null);
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CascadingParameterSelector;

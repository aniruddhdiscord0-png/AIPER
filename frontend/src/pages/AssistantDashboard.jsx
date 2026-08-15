import React, { useState, useEffect, useRef, useCallback } from 'react';

import axios from 'axios';
import { Play, Check, Clock, AlertTriangle, RotateCcw, Calendar, X, Edit, Trash2, Plus } from 'lucide-react';
import { fetchWithCache, invalidateCache, CACHE_KEYS, isCached } from '../utils/cache';
import Spinner from '../components/Spinner';
import { useSocket } from '../context/SocketContext';
import API_URL from '../utils/api';



export default function AssistantDashboard() {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [resultsData, setResultsData] = useState([]);
  const [testingPeriod, setTestingPeriod] = useState({ startDate: '', endDate: '' });
  const [testMethods, setTestMethods] = useState([]);
  const [units, setUnits] = useState([]);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(() => !isCached(CACHE_KEYS.MY_TASKS));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorModalData, setErrorModalData] = useState(null); // string for error message

  const [showAddMethod, setShowAddMethod] = useState(false);
  const [newMethodText, setNewMethodText] = useState('');

  // Sample Description
  const [sampleDescription, setSampleDescription] = useState('');
  const descDebounceRef = useRef(null);
  const isTypingDescRef = useRef(false);

  const formatJobCode = (code) => {
    if (!code) return '';
    return code.replace(/-N[12]([a-z]?)(?:-v\d+)?$/g, '-N$1').replace(/-[12][a-z]?(?:-v\d+)?$/g, '');
  };

  const fetchTasks = async () => {
    try {
      await fetchWithCache(
        `${API_URL}/api/tests/instances`,
        CACHE_KEYS.MY_TASKS,
        setTasks
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestMethods = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/test-methods`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setTestMethods(res.data);
    } catch (err) {
      console.error('Failed to fetch test methods', err);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/units`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setUnits(res.data);
    } catch (err) {
      console.error('Failed to fetch units', err);
    }
  };

  useEffect(() => { 
    fetchTasks(); 
    fetchTestMethods();
    fetchUnits();
  }, []);

  const handleAddTestMethod = async (newText) => {
    if (!newText.trim()) return null;
    try {
      const res = await axios.post(`${API_URL}/api/test-methods`, { text: newText }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchTestMethods();
      return res.data;
    } catch (err) {
      alert(err.response?.data?.message || 'Error adding test method');
      return null;
    }
  };

  const handleUpdateTestMethod = async (id, newText) => {
    if (!newText.trim()) return;
    try {
      await axios.put(`${API_URL}/api/test-methods/${id}`, { text: newText }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchTestMethods();
      setEditingMethodId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating test method');
    }
  };

  const handleDeleteTestMethod = async (id) => {
    if (!window.confirm('Are you sure you want to delete this test method?')) return;
    try {
      await axios.delete(`${API_URL}/api/test-methods/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchTestMethods();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting test method');
    }
  };

  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const updateTasks = () => { invalidateCache(CACHE_KEYS.MY_TASKS); fetchTasks(); };

    socket.on('JOB_DISTRIBUTED', updateTasks);
    socket.on('TEST_REVIEWED', updateTasks);
    socket.on('JOB_UPDATED', updateTasks);
    socket.on('JOB_DELETED', updateTasks);
    socket.on('SAMPLE_DESCRIPTION_UPDATED', ({ jobId, description }) => {
      // Update the open task's description if it matches (and the analyst isn't currently typing)
      if (activeTask && activeTask.jobId?.toString() === jobId && !isTypingDescRef.current) {
        setSampleDescription(description);
      }
      // Also update cached task list so re-opening shows latest description
      setTasks(prev => prev.map(t =>
        t.jobId?.toString() === jobId ? { ...t, sampleDescription: description } : t
      ));
    });

    return () => {
      socket.off('JOB_DISTRIBUTED', updateTasks);
      socket.off('TEST_REVIEWED', updateTasks);
      socket.off('JOB_UPDATED', updateTasks);
      socket.off('JOB_DELETED', updateTasks);
      socket.off('SAMPLE_DESCRIPTION_UPDATED');
    };
  }, [socket]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowConfirmModal(false);
        setErrorModalData(null);
        setShowAddMethod(false);
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (showConfirmModal) {
          executeSubmit();
          return;
        }
        
        const activeForm = document.querySelector('form:focus-within');
        if (activeForm) {
          const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
          activeForm.dispatchEvent(submitEvent);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmModal, errorModalData, showAddMethod]);

  const formatDateTimeLocal = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleDateChange = (field, newDateStr) => {
    setTestingPeriod(p => {
      const current = p[field] || '';
      const [, oldTime] = current.split('T');
      let newTime = oldTime;
      if (!newTime) {
         const d = new Date();
         const pad = (n) => String(n).padStart(2, '0');
         newTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      return { ...p, [field]: newDateStr ? `${newDateStr}T${newTime}` : '' };
    });
  };

  const handleTimeChange = (field, newTimeStr) => {
    setTestingPeriod(p => {
      const current = p[field] || '';
      const [oldDate] = current.split('T');
      let newDate = oldDate;
      if (!newDate) {
         const d = new Date();
         const pad = (n) => String(n).padStart(2, '0');
         newDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      }
      return { ...p, [field]: newTimeStr ? `${newDate}T${newTimeStr}` : '' };
    });
  };

  const openTask = (task) => {
    setActiveTask(task);
    setSampleDescription(task.sampleDescription || '');
    setResultsData(task.results.map(r => ({ 
      ...r, 
      value: r.value || '',
      isSaved: r.isSaved || false,
      testMethod: r.testMethod || '',
      specification: r.specification || ''
    })));
    setTestingPeriod({
      startDate: task.testingPeriod?.startDate ? formatDateTimeLocal(task.testingPeriod.startDate) : '',
      endDate: task.testingPeriod?.endDate ? formatDateTimeLocal(task.testingPeriod.endDate) : ''
    });
  };

  const closeTask = () => {
    setActiveTask(null);
    setSampleDescription('');
    setResultsData([]);
    setTestingPeriod({ startDate: '', endDate: '' });
  };

  const handleDescriptionChange = useCallback((val) => {
    setSampleDescription(val);
    isTypingDescRef.current = true;
    if (descDebounceRef.current) clearTimeout(descDebounceRef.current);
    descDebounceRef.current = setTimeout(async () => {
      isTypingDescRef.current = false;
      if (!activeTask?.jobId) return;
      try {
        await axios.patch(`${API_URL}/api/jobs/${activeTask.jobId}/sample-description`,
          { description: val },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
      } catch (err) {
        console.error('Failed to auto-save sample description', err);
      }
    }, 1000);
  }, [activeTask]);

  const handleResultChange = (index, field, val) => {
    const updated = [...resultsData];
    updated[index][field] = val;
    if (field === 'value' || field === 'unit' || field === 'specification') {
      updated[index].isSaved = false;
    }
    setResultsData(updated);
  };



  const handleIndividualSave = async (index) => {
    if (isSubmitting) return;
    const hasRetestOnly = activeTask?.retestOnly && activeTask.retestOnly.length > 0;
    if (hasRetestOnly && !activeTask.retestOnly.includes(resultsData[index].parameterId)) return;

    const val = resultsData[index].value;
    const testMethod = resultsData[index].testMethod;

    if (!val || val.trim() === '' || !testMethod || testMethod.trim() === '') {
      setErrorModalData(`Please enter both a value and a test method for "${resultsData[index].name}"`);
      return;
    }
    
    const numericVal = parseFloat(val);
    if (!isNaN(numericVal) && numericVal < 0) {
      setErrorModalData(`Value for "${resultsData[index].name}" cannot be negative`);
      return;
    }

    setIsSubmitting(true);
    const updated = [...resultsData];
    updated[index].isSaved = true;
    setResultsData(updated);

    try {
      await axios.put(`${API_URL}/api/tests/instances/${activeTask._id}/save-progress`, {
        results: updated
      });
      setSuccess(`Parameter "${updated[index].name}" saved!`);
      invalidateCache(CACHE_KEYS.MY_TASKS);
      fetchTasks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      updated[index].isSaved = false;
      setResultsData(updated);
      setErrorModalData(err.response?.data?.message || 'Error saving parameter');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProgress = async () => {
    const hasRetestOnly = activeTask?.retestOnly && activeTask.retestOnly.length > 0;
    const editableParams = hasRetestOnly 
      ? resultsData.filter(r => activeTask.retestOnly.includes(r.parameterId))
      : resultsData;

    const partiallyFilled = editableParams.filter(r => {
      const hasVal = r.value && r.value.trim() !== '';
      const hasMethod = r.testMethod && r.testMethod.trim() !== '';
      return hasVal !== hasMethod; 
    });

    const negativeParams = editableParams.filter(r => {
      const num = parseFloat(r.value);
      return !isNaN(num) && num < 0;
    });

    if (partiallyFilled.length > 0 || negativeParams.length > 0) {
      const issues = [];
      if (partiallyFilled.length > 0) {
        issues.push(`Partially filled (need both value & test method): ${partiallyFilled.map(p => p.name).join(', ')}`);
      }
      if (negativeParams.length > 0) {
        issues.push(`Negative values: ${negativeParams.map(p => p.name).join(', ')}`);
      }
      setErrorModalData(`Some parameters have issues and won't be saved:\n\n${issues.join('\n')}\n\nAll other valid parameters will be saved.`);
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const updatedResults = resultsData.map(r => {
      const hasVal = r.value && r.value.trim() !== '';
      const hasMethod = r.testMethod && r.testMethod.trim() !== '';
      const num = parseFloat(r.value);
      const isNeg = !isNaN(num) && num < 0;
      if (hasVal && hasMethod && !isNeg) {
        return { ...r, isSaved: true };
      }
      return r;
    });
    setResultsData(updatedResults);

    try {
      await axios.put(`${API_URL}/api/tests/instances/${activeTask._id}/save-progress`, {
        results: updatedResults,
        testingPeriod: {
          startDate: testingPeriod.startDate || null,
          endDate: testingPeriod.endDate || null
        }
      });
      setSuccess(`Progress for ${formatJobCode(activeTask.testCode)} saved! You can continue later.`);
      invalidateCache(CACHE_KEYS.MY_TASKS);
      fetchTasks();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setErrorModalData(err.response?.data?.message || 'Error saving draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreSubmit = (e) => {
    e.preventDefault();
    const hasRetestOnly = activeTask?.retestOnly && activeTask.retestOnly.length > 0;
    const editableParams = hasRetestOnly 
      ? resultsData.filter(r => activeTask.retestOnly.includes(r.parameterId))
      : resultsData;

    const unsavedParams = editableParams.filter(r => !r.isSaved);
    if (unsavedParams.length > 0) {
      setErrorModalData(`Please save all parameters before submitting. \n\nUnsaved fields: ${unsavedParams.map(p => p.name).join(', ')}`);
      return;
    }

    const invalidParams = editableParams.filter(r => {
      const val = r.value;
      const testMethod = r.testMethod;
      if (!val || val.trim() === '' || !testMethod || testMethod.trim() === '') return true;
      const num = parseFloat(val);
      return !isNaN(num) && num < 0;
    });

    if (invalidParams.length > 0) {
      setErrorModalData(`Some parameters have invalid or empty values. \n\nInvalid fields: ${invalidParams.map(p => p.name).join(', ')}`);
      return;
    }

    if (!testingPeriod.startDate || !testingPeriod.endDate) {
      setErrorModalData("Please provide both start and end dates for the testing period.");
      return;
    }

    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    setShowConfirmModal(false);
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await axios.put(`${API_URL}/api/tests/instances/${activeTask._id}/results`, {
        results: resultsData,
        testingPeriod: {
          startDate: testingPeriod.startDate || null,
          endDate: testingPeriod.endDate || null
        }
      });
      setTasks(prev => prev.filter(t => t._id !== activeTask._id));
      setSuccess(`Task ${formatJobCode(activeTask.testCode)} submitted for review!`);
      invalidateCache(CACHE_KEYS.MY_TASKS);
      closeTask();
      fetchTasks();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setErrorModalData(err.response?.data?.message || 'An error occurred while submitting the task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReassigned = (task) =>
    task.reviewHistory && task.reviewHistory.some(rh => rh.action === 'REASSIGN');

  const getLatestNote = (task) => {
    if (!task.reviewHistory) return null;
    const reassigns = task.reviewHistory.filter(rh => rh.action === 'REASSIGN');
    return reassigns.length > 0 ? reassigns[reassigns.length - 1] : null;
  };

  const inputStyle = {
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    width: '100%',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-main)'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Clock size={28} style={{ color: 'var(--color-primary)' }} /> Task Queue
      </h1>

      {success && (
        <div style={{ 
          position: 'fixed', top: '6rem', right: '2rem', zIndex: 1000,
          color: 'white', backgroundColor: 'var(--color-success)', 
          padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <Check size={20} />
          <span style={{ fontWeight: 500 }}>{success}</span>
        </div>
      )}

      {activeTask ? (
        <div className="card" style={{ marginBottom: '2rem', borderTop: `4px solid ${isReassigned(activeTask) ? 'var(--color-danger)' : 'var(--color-primary)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Job {formatJobCode(activeTask.testCode)}</h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-warning" style={{ fontSize: '0.9rem' }}>
                Target: {new Date(activeTask.deadline).toLocaleString()}
              </span>
            </div>
          </div>

          {(() => {
            const latestNote = getLatestNote(activeTask);
            if (!latestNote) return null;
            return (
              <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', backgroundColor: 'rgba(231, 76, 60, 0.08)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <AlertTriangle size={20} style={{ color: 'var(--color-danger)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-danger)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                    Reassigned by {latestNote.role} — please correct and resubmit
                  </div>
                  {latestNote.note && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-main)' }}>"{latestNote.note}"</div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
                    {new Date(latestNote.date).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })()}

          <form onSubmit={handlePreSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Testing Period</span>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--color-text-muted)' }}>
                    Start Date & Time <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="date" value={(testingPeriod.startDate || '').split('T')[0] || ''} onChange={e => handleDateChange('startDate', e.target.value)} required style={{ ...inputStyle, flex: 1 }} />
                    <input type="time" value={(testingPeriod.startDate || '').split('T')[1] || ''} onChange={e => handleTimeChange('startDate', e.target.value)} required style={{ ...inputStyle, width: '110px' }} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '250px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--color-text-muted)' }}>
                    End Date & Time <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="date" value={(testingPeriod.endDate || '').split('T')[0] || ''} min={(testingPeriod.startDate || '').split('T')[0] || ''} onChange={e => handleDateChange('endDate', e.target.value)} required style={{ ...inputStyle, flex: 1 }} />
                    <input type="time" value={(testingPeriod.endDate || '').split('T')[1] || ''} onChange={e => handleTimeChange('endDate', e.target.value)} required style={{ ...inputStyle, width: '110px' }} />
                  </div>
                </div>
              </div>
            </div>


            {/* Sample Description */}
            <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Sample Description</span>
                {sampleDescription && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>Auto-saved</span>
                )}
              </div>
              <textarea
                value={sampleDescription}
                onChange={e => handleDescriptionChange(e.target.value)}
                placeholder="Describe the sample (appearance, condition, any notable observations)…"
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: '1.5',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Test Parameters ({resultsData.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {resultsData.map((resItem, i) => {
                  const prevResult = activeTask.previousResults?.find(pr => pr.parameterId === resItem.parameterId);
                  const hasRetestOnly = activeTask.retestOnly && activeTask.retestOnly.length > 0;
                  const isRetestParam = !hasRetestOnly || activeTask.retestOnly.includes(resItem.parameterId);
                  const isApprovedParam = hasRetestOnly && !isRetestParam;

                  return (
                    <div key={resItem.parameterId} style={{ 
                      padding: '1rem 1.25rem', 
                      backgroundColor: isApprovedParam ? 'var(--color-surface)' : 'var(--color-surface-hover)', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--color-border)', 
                      borderLeft: isApprovedParam ? '4px solid var(--color-success)' : (resItem.isSaved ? '4px solid var(--color-success)' : '4px solid var(--color-warning)'),
                      transition: 'all 0.2s ease',
                      opacity: isApprovedParam ? 0.7 : 1
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: isApprovedParam ? '0' : '0.75rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-main)', fontSize: '0.95rem' }}>{i + 1}. {resItem.name}</div>
                          {prevResult?.value && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                              ⚠ Previous (rejected): {prevResult.value} {prevResult.unit}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                          {isApprovedParam ? (
                            <span style={{ 
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(46, 204, 113, 0.1)', color: 'var(--color-success)',
                              fontSize: '0.8rem', fontWeight: 600
                            }}>
                              <Check size={14}/> Approved
                            </span>
                          ) : (
                            <>
                              <button type="button" onClick={() => handleIndividualSave(i)} disabled={isSubmitting} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: resItem.isSaved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white', height: 'fit-content' }}>
                                {resItem.isSaved ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Check size={14}/> Saved</span> : (isSubmitting ? 'Saving...' : 'Save Parameter')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {!isApprovedParam && (
                        <>
                          <div className="grid-2">
                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>
                                Observed Result <span style={{ color: 'var(--color-danger)' }}>*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input 
                                  type="text" 
                                  value={resItem.value} 
                                  onChange={e => handleResultChange(i, 'value', e.target.value)} 
                                  placeholder="Enter value…" 
                                  style={{
                                    ...inputStyle,
                                    flex: 1,
                                    borderColor: (resItem.value && !isNaN(parseFloat(resItem.value)) && parseFloat(resItem.value) < 0) ? 'var(--color-danger)' : 'var(--color-border)'
                                  }} 
                                />
                                <UnitDropdown
                                  value={resItem.unit || ''}
                                  onChange={val => handleResultChange(i, 'unit', val)}
                                  units={units}
                                  onRefresh={fetchUnits}
                                  inputStyle={inputStyle}
                                />
                              </div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Test Method</label>
                              <TestMethodDropdown 
                                value={resItem.testMethod}
                                onChange={val => handleResultChange(i, 'testMethod', val)}
                                testMethods={testMethods}
                                onUpdate={handleUpdateTestMethod}
                                onDelete={handleDeleteTestMethod}
                                onCreate={handleAddTestMethod}
                                inputStyle={inputStyle}
                              />
                            </div>
                          </div>
                          <div style={{ marginTop: '0.75rem' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem', color: 'var(--color-text-muted)' }}>Specification</label>
                            <input
                              type="text"
                              value={resItem.specification || ''}
                              onChange={e => handleResultChange(i, 'specification', e.target.value)}
                              placeholder="e.g. Max 10000 CFU/g (optional)…"
                              style={inputStyle}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-row-responsive" style={{ marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-success" disabled={isSubmitting} style={{ flex: 2, justifyContent: 'center' }}>
                <Check size={18} style={{ marginRight: '0.5rem' }} /> {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveProgress} disabled={isSubmitting} style={{ flex: 1, justifyContent: 'center' }}>{isSubmitting ? 'Saving...' : 'Save Draft'}</button>
              <button type="button" className="btn" onClick={closeTask} style={{ flex: 1, justifyContent: 'center', backgroundColor: 'transparent', border: '1px solid var(--color-border)' }}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {loading ? (
            <div className="card" style={{ gridColumn: '1 / -1' }}><Spinner message="Loading your tasks..." /></div>
          ) : tasks.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>No pending tasks in your queue.</div>
          ) : (
            tasks.map(task => (
              <div key={task._id} className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: isReassigned(task) ? '4px solid var(--color-danger)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {isReassigned(task) ? <span className="badge" style={{ backgroundColor: 'rgba(231, 76, 60, 0.1)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><RotateCcw size={12} /> Reassigned</span> : <span className="badge badge-warning" style={{ backgroundColor: 'rgba(241, 196, 15, 0.1)', color: '#d35400' }}>Pending</span>}
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{new Date(task.deadline).toLocaleDateString('en-IN')}</span>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.3rem 0', color: 'var(--color-primary-dark)' }}>Job {formatJobCode(task.testCode)}</h3>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                  <button onClick={() => openTask(task)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    <Play size={16} /> {isReassigned(task) ? 'Revise & Resubmit' : 'Run Analysis'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}



      {/* ── CUSTOM CONFIRMATION MODAL ── */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem', animation: 'slideUp 0.3s ease', borderTop: '4px solid var(--color-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', color: 'var(--color-primary)' }}>
              <Check size={32} />
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Submit Analysis</h2>
            </div>
            
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--color-text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              Are you sure you want to submit the results for <strong>Test {formatJobCode(activeTask?.testCode)}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                className="btn" 
                onClick={() => setShowConfirmModal(false)}
                style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)', padding: '0.6rem 2rem', backgroundColor: 'transparent' }}
                disabled={isSubmitting}
              >
                Review Again
              </button>
              <button 
                type="button"
                className="btn btn-primary" 
                onClick={executeSubmit}
                title="Confirm Submission (Ctrl + Enter)"
                style={{ padding: '0.6rem 2rem' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Spinner size="sm" message="Submitting..." color="#fff" /> : 'Confirm Submission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM ERROR MODAL ── */}
      {errorModalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem', animation: 'slideUp 0.3s ease', borderTop: '4px solid var(--color-danger)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', color: 'var(--color-danger)' }}>
              <AlertTriangle size={32} />
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Validation Error</h2>
            </div>
            
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--color-text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {errorModalData}
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                className="btn" 
                onClick={() => setErrorModalData(null)}
                style={{ border: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '0.6rem 2rem', backgroundColor: 'transparent' }}
              >
                Go Back & Fix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom TestMethodDropdown Component
const TestMethodDropdown = ({ value, onChange, testMethods, onUpdate, onDelete, onCreate, inputStyle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState(value || '');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newMethodText, setNewMethodText] = useState('');
  const [isSavingNew, setIsSavingNew] = useState(false);

  // Keep filter synced with value if changed from outside
  useEffect(() => {
    setFilter(value || '');
  }, [value]);

  const filteredMethods = testMethods.filter(m => m.text.toLowerCase().includes(filter.toLowerCase()));

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  const handleKeyDown = (e) => {
    if (!isOpen || filteredMethods.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filteredMethods.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (editingId) return; // let the edit input handle enter if it wants to
      e.preventDefault();
      const methodToAdd = filteredMethods[activeIndex];
      if (methodToAdd) {
        onChange(methodToAdd.text);
        setFilter(methodToAdd.text);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={filter}
          onChange={e => {
            setFilter(e.target.value);
            onChange(e.target.value); // update the actual form state
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Select or type method..."
          style={inputStyle}
        />
        {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderTop: 'none', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
          maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {filteredMethods.map((m, index) => (
            <div 
              key={m._id} 
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
              {editingId === m._id ? (
                <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                  <input
                    type="text" value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onUpdate(m._id, editText);
                        setEditingId(null);
                      }
                    }}
                    style={{ flex: 1, padding: '0.2rem', fontSize: '0.8rem', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-sm)' }}
                    autoFocus
                  />
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); onUpdate(m._id, editText); setEditingId(null); }} style={{ background: 'none', border: 'none', color: 'var(--color-success)', cursor: 'pointer' }}><Check size={14} /></button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); setEditingId(null); }} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, wordBreak: 'break-word' }} onMouseDown={(e) => { e.preventDefault(); onChange(m.text); setFilter(m.text); setIsOpen(false); }}>
                    {m.text}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); setEditingId(m._id); setEditText(m.text); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><Edit size={14} /></button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); onDelete(m._id); }} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filter && filteredMethods.length === 0 && (
            <div style={{
              padding: '0.75rem', textAlign: 'center',
              color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic'
            }}>
              No matching methods found
            </div>
          )}
        </div>
      )}
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} onClick={() => setIsOpen(false)} />
      )}
      </div>
      
      {!isCreatingNew && (
        <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-start' }}>
          <button type="button" onClick={() => setIsCreatingNew(true)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Plus size={14} /> Create New Method
          </button>
        </div>
      )}
      {isCreatingNew && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-sm)', alignItems: 'center', border: '1px solid var(--color-border)' }}>
          <input
            type="text"
            placeholder="New method name..."
            value={newMethodText}
            onChange={e => setNewMethodText(e.target.value)}
            style={{ ...inputStyle, flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
            autoFocus
          />
          <button type="button" onClick={async () => {
            if (!newMethodText.trim() || isSavingNew) return;
            setIsSavingNew(true);
            const created = await onCreate(newMethodText);
            if (created) {
              onChange(created.text);
              setFilter(created.text);
              setIsCreatingNew(false);
              setNewMethodText('');
            }
            setIsSavingNew(false);
          }} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', minWidth: '70px', justifyContent: 'center' }} disabled={!newMethodText.trim() || isSavingNew}>
            {isSavingNew ? <Spinner size="sm" color="#fff" /> : 'Save'}
          </button>
          <button type="button" onClick={() => { setIsCreatingNew(false); setNewMethodText(''); }} disabled={isSavingNew} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid var(--color-border)' }}>Cancel</button>
        </div>
      )}
    </div>
  );
};

// UnitDropdown Component — DB-backed unit picker with add/delete
const UnitDropdown = ({ value, onChange, units, onRefresh, inputStyle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState(value || '');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newUnitText, setNewUnitText] = useState('');
  const [isSavingNew, setIsSavingNew] = useState(false);

  useEffect(() => {
    setFilter(value || '');
  }, [value]);

  const filteredUnits = units.filter(u => u.text.toLowerCase().includes(filter.toLowerCase()));

  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  const handleKeyDown = (e) => {
    if (!isOpen || filteredUnits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filteredUnits.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const u = filteredUnits[activeIndex];
      if (u) { onChange(u.text); setFilter(u.text); setIsOpen(false); }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleDeleteUnit = async (id) => {
    if (!window.confirm('Delete this unit from the shared list?')) return;
    try {
      await axios.delete(`${API_URL}/api/units/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting unit');
    }
  };

  const handleCreateUnit = async () => {
    if (!newUnitText.trim() || isSavingNew) return;
    setIsSavingNew(true);
    try {
      const res = await axios.post(`${API_URL}/api/units`, { text: newUnitText }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      onChange(res.data.text);
      setFilter(res.data.text);
      setIsCreatingNew(false);
      setNewUnitText('');
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating unit');
    }
    setIsSavingNew(false);
  };

  return (
    <div style={{ position: 'relative', minWidth: '100px' }}>
      <input
        type="text"
        value={filter}
        onChange={e => { setFilter(e.target.value); onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Unit…"
        style={{
          ...inputStyle,
          width: '100%',
          padding: '0.5rem',
          fontSize: '0.82rem',
          color: 'var(--color-text-main)'
        }}
      />
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderTop: 'none', borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
          maxHeight: '220px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {/* Add Unit — pinned at top */}
          {!isCreatingNew ? (
            <div
              onMouseDown={(e) => { e.preventDefault(); setIsCreatingNew(true); }}
              style={{
                padding: '0.45rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                color: 'var(--color-primary)', fontWeight: 600,
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)', flexShrink: 0
              }}
            >
              <Plus size={12} /> Add New Unit
            </div>
          ) : (
            <div
              onMouseDown={(e) => e.preventDefault()}
              style={{
                padding: '0.45rem', display: 'flex', gap: '0.3rem', alignItems: 'center',
                borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', flexShrink: 0
              }}
            >
              <input
                type="text"
                placeholder="New unit…"
                value={newUnitText}
                onChange={e => setNewUnitText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateUnit(); } }}
                style={{ ...inputStyle, flex: 1, padding: '0.3rem', fontSize: '0.78rem' }}
                autoFocus
              />
              <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCreateUnit(); }} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', minWidth: '40px', justifyContent: 'center' }} disabled={!newUnitText.trim() || isSavingNew}>
                {isSavingNew ? '...' : 'Add'}
              </button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setIsCreatingNew(false); setNewUnitText(''); }} disabled={isSavingNew} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px' }}>
                <X size={12} />
              </button>
            </div>
          )}
          {/* Scrollable unit list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredUnits.map((u, index) => (
              <div
                key={u._id}
                onMouseEnter={() => setActiveIndex(index)}
                style={{
                  padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: activeIndex === index ? 'var(--color-surface-hover)' : 'transparent',
                  borderLeft: activeIndex === index ? '3px solid var(--color-primary)' : '3px solid transparent',
                  transition: 'background-color 0.1s'
                }}
              >
                <div
                  style={{ flex: 1, wordBreak: 'break-word' }}
                  onMouseDown={(e) => { e.preventDefault(); onChange(u.text); setFilter(u.text); setIsOpen(false); }}
                >
                  {u.text}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleDeleteUnit(u._id); }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {filter && filteredUnits.length === 0 && (
              <div style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                No matching units
              </div>
            )}
          </div>
        </div>
      )}
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }} onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

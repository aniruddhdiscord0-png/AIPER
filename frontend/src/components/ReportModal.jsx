import React, { useState, useEffect, useContext, useRef } from 'react';
import { X, Download, UploadCloud, RotateCcw, FileText, AlertCircle, CheckCircle, User, Clock } from 'lucide-react';
import axios from 'axios';
import API_URL from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import ReportPreview from './ReportPreview';
import Spinner from './Spinner';

export default function ReportModal({ job, onClose }) {
  const { user } = useContext(AuthContext);
  // Initialize reportType synchronously based on job data to prevent double-fetching
  const initialType = job.sample?.nabl_type === 'Nabl' ? 'nabl' : 'non_nabl';
  const [reportType, setReportType] = useState(initialType);
  const [blob, setBlob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isHybrid = job.sample?.nabl_type === 'Hybrid';

  useEffect(() => {
    // If the modal is kept open but job changes, update the type
    if (job.sample?.nabl_type === 'Nabl') setReportType('nabl');
    else if (job.sample?.nabl_type === 'Non Nabl') setReportType('non_nabl');
  }, [job._id]);

  const loadReport = React.useCallback(async () => {
    setLoading(true);
    setBlob(null);
    try {
      const token = localStorage.getItem('token');
      // 1. Fetch Status
      const statusRes = await axios.get(`${API_URL}/api/export/report/${job._id}/status?type=${reportType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(statusRes.data);

      // 2. Fetch Blob
      const blobRes = await axios.get(`${API_URL}/api/export/report/${job._id}?type=${reportType}&_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      setBlob(blobRes.data);
    } catch (err) {
      console.error('Failed to load report', err);
    } finally {
      setLoading(false);
    }
  }, [job._id, reportType]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDownload = () => {
    if (!blob) return;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = status?.isCustom ? `Custom_Report_${job.jobCode}_${reportType}.docx` : `Report_${job.jobCode}_${reportType}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.docx')) {
      alert('Only .docx files are allowed.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('reportDoc', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/export/report/${job._id}/upload?type=${reportType}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      loadReport(); // Reload to fetch custom report
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleRevert = async () => {
    if (!window.confirm('Are you sure you want to revert to the auto-generated report? This will permanently delete the custom uploaded report.')) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/export/report/${job._id}/revert?type=${reportType}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadReport(); // Reload to fetch auto report
    } catch (err) {
      console.error('Revert failed', err);
      alert('Failed to revert: ' + (err.response?.data?.message || err.message));
      setLoading(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      
      {/* Hidden File Input */}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} />

      {/* Top Bar */}
      <div style={{ backgroundColor: 'white', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', flexWrap: 'wrap', gap: '1rem' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onClose} style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} style={{ color: 'var(--color-primary)' }} />
              Report: {job.jobCode}
            </h2>
          </div>
        </div>

        {/* Hybrid Toggles */}
        {isHybrid && (
          <div style={{ display: 'flex', backgroundColor: 'var(--color-surface-hover)', borderRadius: '8px', padding: '0.25rem', border: '1px solid var(--color-border)' }}>
            <button onClick={() => setReportType('non_nabl')} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: reportType === 'non_nabl' ? 'white' : 'transparent', color: reportType === 'non_nabl' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: reportType === 'non_nabl' ? 600 : 400, boxShadow: reportType === 'non_nabl' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
              Non-NABL Report
            </button>
            <button onClick={() => setReportType('nabl')} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: reportType === 'nabl' ? 'white' : 'transparent', color: reportType === 'nabl' ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: reportType === 'nabl' ? 600 : 400, boxShadow: reportType === 'nabl' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
              NABL Report
            </button>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={handleDownload} disabled={!blob} style={{ padding: '0.6rem 1rem', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: blob ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, opacity: blob ? 1 : 0.6 }}>
            <Download size={16} /> Download DOCX
          </button>
          
          <button onClick={handleUploadClick} disabled={uploading} style={{ padding: '0.6rem 1rem', background: 'white', color: 'var(--color-text-main)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <UploadCloud size={16} /> {uploading ? 'Uploading...' : 'Upload Custom'}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {status && !loading && (
        <div style={{ backgroundColor: status.isCustom ? '#FFFBEB' : '#F0FDF4', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${status.isCustom ? '#FEF3C7' : '#DCFCE7'}`, flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {status.isCustom ? <AlertCircle size={20} color="#D97706" /> : <CheckCircle size={20} color="#059669" />}
            <div>
              <div style={{ fontWeight: 600, color: status.isCustom ? '#92400E' : '#065F46' }}>
                {status.isCustom ? 'Custom Report (Overrides Auto-Generated)' : 'Auto-Generated Report (Live System Data)'}
              </div>
              {status.isCustom && status.uploadedBy && (
                <div style={{ fontSize: '0.8rem', color: '#B45309', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <User size={12} /> {status.uploadedBy.name} ({status.uploadedBy.role})
                  <Clock size={12} style={{ marginLeft: '0.5rem' }} /> {formatDate(status.uploadedAt)}
                </div>
              )}
            </div>
          </div>
          
          {status.isCustom && (
            <button onClick={handleRevert} style={{ padding: '0.4rem 0.8rem', background: 'white', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
              <RotateCcw size={14} /> Revert to Original
            </button>
          )}
        </div>
      )}

      {/* Document Preview Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        {loading ? (
          <div style={{ marginTop: '10vh' }}>
            <Spinner message="Generating Document Preview..." />
          </div>
        ) : blob ? (
          <div style={{ width: '100%', maxWidth: '900px', backgroundColor: 'transparent' }}>
            <ReportPreview blob={blob} />
          </div>
        ) : (
          <div style={{ color: 'white' }}>Failed to generate report preview.</div>
        )}
      </div>

    </div>
  );
}

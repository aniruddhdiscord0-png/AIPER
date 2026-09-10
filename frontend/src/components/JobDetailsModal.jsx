import React from 'react';
import { X, FileText, ClipboardList, Info, ShieldCheck } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

export default function JobDetailsModal({ job, onClose }) {
  if (!job) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
        backgroundColor: 'var(--color-surface)', padding: '2rem', position: 'relative'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1.5rem', right: '1.5rem',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-muted)'
        }}>
          <X size={24} />
        </button>

        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={24} color="var(--color-primary)" />
          Job Details: {job.jobCode}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          {/* Customer Info */}
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
              <Info size={18} /> Customer Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
              <div><strong>Name:</strong><br/>{job.customer?.customer_name || 'N/A'}</div>
              <div><strong>Contact Person:</strong><br/>{job.customer?.contact_person || 'N/A'}</div>
              <div><strong>Email:</strong><br/>{job.customer?.email || 'N/A'}</div>
              <div><strong>Mobile:</strong><br/>{job.customer?.mobile_number || 'N/A'}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong><br/>{job.customer?.customer_address || 'N/A'}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Reference No:</strong><br/>{job.customer?.customer_reference_no || 'N/A'}</div>
            </div>
          </div>

          {/* Sample Info */}
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
              <ClipboardList size={18} /> Sample Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
              <div><strong>Sample Name:</strong><br/>{job.sample?.sample_name || 'N/A'}</div>
              <div><strong>Sample ID (Internal):</strong><br/>{job.sample?.sample_id || 'N/A'}</div>
              <div><strong>Quantity:</strong><br/>{job.sample?.sample_quantity || 'N/A'} ({job.sample?.sample_count} count)</div>
              <div><strong>Job Type:</strong><br/>{job.sample?.nabl_type || 'N/A'}</div>
              {job.sample?.ulr_no && <div style={{ gridColumn: '1 / -1' }}><strong>ULR No:</strong><br/>{job.sample?.ulr_no}</div>}
              <div style={{ gridColumn: '1 / -1' }}><strong>Description:</strong><br/>{job.sample?.sample_description || 'N/A'}</div>
              <div><strong>Received Date:</strong><br/>{job.sample?.received_date ? formatDate(job.sample.received_date) : 'N/A'}</div>
              <div><strong>Received Mode:</strong><br/>{job.sample?.received_mode || 'N/A'}</div>
              <div><strong>Condition:</strong><br/>{job.sample?.condition_on_receipt || 'N/A'}</div>
              <div><strong>Packing Details:</strong><br/>{job.sample?.packing_details || 'N/A'}</div>
              <div><strong>Marking/Seal:</strong><br/>{job.sample?.marking_seal || 'N/A'}</div>
              <div><strong>Source:</strong><br/>{job.sample?.sample_source || 'N/A'}</div>
            </div>
          </div>

          {/* Compliance Info */}
          <div style={{ gridColumn: '1 / -1', padding: '1.5rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
              <ShieldCheck size={18} /> Compliance & Notes
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
              <div><strong>Statement of Conformity:</strong><br/>{job.compliance?.statement_of_conformity || 'N/A'}</div>
              <div><strong>Decision Rule:</strong><br/>{job.compliance?.decision_rule || 'N/A'}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Accreditation Scope:</strong><br/>{job.compliance?.accreditation_scope || 'N/A'}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Special Handling:</strong><br/>{job.compliance?.special_handling_instructions || 'N/A'}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Disclaimer/Notes:</strong><br/>{job.compliance?.disclaimer_notes || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
          <button onClick={onClose} className="btn btn-secondary">Close Details</button>
        </div>
      </div>
    </div>
  );
}

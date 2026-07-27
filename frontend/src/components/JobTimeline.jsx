import React, { useContext } from 'react';
import { User, Calendar, CheckCircle, Clock, AlertTriangle, RotateCcw, ArrowRightLeft } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

export default function JobTimeline({ job, allJobs = [], onReopen }) {
  const { user } = useContext(AuthContext);

  const childJobs = allJobs?.filter(j => j.parentJobId === job._id).sort((a, b) => a.retestNumber - b.retestNumber) || [];
  const timelineSequence = [job, ...childJobs];

  const formatDate = (d) => new Date(d).toLocaleString();

  const formatJobCode = (code) => {
    if (!code) return '';
    return code.replace(/-N[12]([a-z]?)(?:-v\d+)?$/g, '-N$1').replace(/-[12][a-z]?(?:-v\d+)?$/g, '');
  };

  const JobCycle = ({ cycleJob, isRetest }) => {
    const instances = cycleJob.testInstances || [];

    const pickInstanceByDept = (deptName) => {
      const deptInstances = instances.filter(i => {
        const d = i.createdBy?.department?.toLowerCase();
        if (deptName === 'micro' && d === 'micro') return true;
        if (deptName === 'chemical' && (d === 'chemical' || d === 'chemical')) return true;
        return false;
      });
      const active = deptInstances.filter(i => i.status !== 'REOPENED').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (active.length > 0) return active[0];
      return deptInstances.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    };

    const microInstance = pickInstanceByDept('micro');
    const chemicalInstance = pickInstanceByDept('chemical');

    // Enrich instances with parent job data for report generation
    const enrichInstance = (inst) => inst ? { ...inst, _job: cycleJob } : null;
    const richMicro = enrichInstance(microInstance);
    const richChemical = enrichInstance(chemicalInstance);

    const microDone = microInstance?.status === 'COMPLETED';
    const chemicalDone = chemicalInstance?.status === 'COMPLETED';

    const microRequired = !!cycleJob.distribution?.micro?.required;
    const chemicalRequired = !!cycleJob.distribution?.chemical?.required;
    const bothRequired = microRequired && chemicalRequired;

    const totalRequired = (microRequired ? 1 : 0) + (chemicalRequired ? 1 : 0);
    const totalCompleted = (microRequired && microDone ? 1 : 0) + (chemicalRequired && chemicalDone ? 1 : 0);
    const progress = totalRequired === 0 ? 0 : Math.round((totalCompleted / totalRequired) * 100);
    
    // allDone should be true if progress is 100% AND at least one thing was required
    const allDone = progress === 100 && totalRequired > 0;
    const bothDone = microRequired && chemicalRequired && microDone && chemicalDone;

    const PipelineTrack = ({ title, distData, instance, deptColor, richInstance }) => {
      if (!distData?.required) return null;

      const getReview = (role, action = 'APPROVE') => {
        if (!instance?.reviewHistory) return null;
        return [...instance.reviewHistory].reverse().find(r => r.role === role && r.action === action);
      };

      const headApproval = getReview('HEAD');
      const adminOfficerApproval = getReview('ADMIN_OFFICER');
      const latestReassign = [...(instance?.reviewHistory || [])].reverse().find(r => r.action === 'REASSIGN');

      const s1_status = 'completed';
      const dStatus = distData?.status || 'PENDING';
      
      const s2_status = (dStatus !== 'PENDING' || instance) ? 'completed' : 'active';

      let s3_status = 'pending', s3_date = null;
      let s4_status = 'pending';
      
      // Use department-level status for accurate aggregation across multiple analysts
      if (dStatus === 'ASSIGNED_TO_ASSISTANT') {
        s3_status = 'active';
      } else if (dStatus === 'RETURNED') {
        s3_status = 'warning';
      } else if (dStatus === 'PENDING_REVIEW' || dStatus === 'REVIEW_APPROVED' || dStatus === 'COMPLETED') {
        s3_status = 'completed';
        s3_date = headApproval ? headApproval.date : instance?.updatedAt;
      } else if (dStatus === 'PENDING' && instance) {
        // Fallback if department status is missing or out of sync
        if (instance.status === 'PENDING') {
          s3_status = latestReassign ? 'warning' : 'active';
        } else {
          s3_status = 'completed';
          s3_date = headApproval ? headApproval.date : instance.updatedAt;
        }
      }

      if (dStatus === 'PENDING_REVIEW') {
        s4_status = 'active';
      } else if (dStatus === 'REVIEW_APPROVED' || dStatus === 'COMPLETED') {
        s4_status = 'completed';
      } else if (dStatus === 'PENDING' && instance && instance.status !== 'PENDING') {
        // Fallback old logic
        if (instance.status === 'PENDING_HEAD_REVIEW') s4_status = 'active';
        else if (headApproval || instance.status === 'COMPLETED') s4_status = 'completed';
      }
      
      const isReopened = instance?.status === 'REOPENED';
      if (isReopened) s4_status = 'reopened';

      const isDeptCompleted = s4_status === 'completed';

      const steps = [
        { id: 1, title: isRetest ? 'Retest Allocation' : 'Job Allocation', desc: 'Allocated by Admin Officer', status: s1_status, date: cycleJob.createdAt, user: `${cycleJob.createdBy?.name || 'Admin Officer'} (Admin Officer)` },
        { id: 2, title: 'Analyst Dispatch', desc: instance ? `Code: ${formatJobCode(instance.testCode)}` : 'Awaiting Dept Head Dispatch', status: s2_status, date: instance?.createdAt, user: instance ? `${instance.createdBy?.name} (${title.split(' ')[0]} Head)` : (distData?.assignedHead?.name ? `${distData.assignedHead.name} (Pending)` : 'Pending Dept Head') },
        { id: 3, title: 'Test Execution', desc: s3_status === 'completed' ? 'Results Submitted' : s3_status === 'warning' ? 'Reassigned – Corrections Needed' : 'Analysis in Progress', status: s3_status, date: s3_date, user: instance ? `${instance.assignedTo?.name} (Analyst)` : 'Pending Analyst' },
        { id: 4, title: 'Dept Head Review', desc: isDeptCompleted ? 'Report Generated' : isReopened ? 'Archived (Reopened)' : s4_status === 'active' ? 'Awaiting Dept Head Approval' : 'Pending Submission', status: s4_status, date: instance?.completedAt || headApproval?.date, user: instance ? `${instance.createdBy?.name} (${title.split(' ')[0]} Head)` : (distData?.assignedHead?.name ? `${distData.assignedHead.name} (Pending)` : 'Pending Dept Head') }
      ];

      return (
        <div className="timeline-card" style={{ flex: '1 1 300px', backgroundColor: 'white', border: `1px solid ${isDeptCompleted ? deptColor + '55' : 'var(--color-border)'}`, borderTop: `3px solid ${deptColor}`, borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', boxSizing: 'border-box', maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)', fontSize: '1rem', fontWeight: 600 }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isDeptCompleted ? '#10B981' : deptColor }}></div>
              {title}
            </h4>
            {/* Per-department action buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              {isDeptCompleted && onReopen && (
                <button
                  onClick={() => onReopen(cycleJob)}
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', border: '1px solid #F59E0B', color: '#B45309', backgroundColor: '#FFFBEB', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}
                >
                  <RotateCcw size={12} /> Reopen
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {steps.map((step, idx) => {
              const isActive = step.status === 'active' || step.status === 'warning';
              const isDone = step.status === 'completed' || step.status === 'reopened';
              return (
                <div key={step.id} className="timeline-step-row" style={{ display: 'flex', gap: '1rem', opacity: (isDone || isActive) ? 1 : 0.45 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="timeline-icon" style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isDone ? '#DEF7EC' : step.status === 'reopened' ? '#FEF3C7' : isActive ? '#E1EFFE' : '#F3F4F6', color: isDone ? '#10B981' : step.status === 'reopened' ? '#D97706' : step.status === 'warning' ? '#F59E0B' : isActive ? '#3B82F6' : '#9CA3AF' }}>
                      {step.status === 'reopened' ? <RotateCcw size={13} /> : isDone ? <CheckCircle size={13} /> : step.status === 'warning' ? <AlertTriangle size={13} color="#F59E0B" /> : isActive ? <Clock size={13} /> : <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#9CA3AF' }} />}
                    </div>
                    {idx < steps.length - 1 && (
                      <div className="timeline-connector" style={{ width: '2px', flex: 1, minHeight: '28px', backgroundColor: isDone ? '#10B981' : step.status === 'reopened' ? '#FBBF24' : '#E5E7EB', marginTop: '4px', marginBottom: '4px' }} />
                    )}
                  </div>
                  <div className="timeline-step-content" style={{ paddingBottom: idx < steps.length - 1 ? '1.25rem' : '0', flex: 1, marginTop: '2px' }}>
                    <div className="timeline-step-title" style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text-main)' }}>{step.title}</div>
                    <div className="timeline-step-desc" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.3rem' }}>{step.desc}</div>
                    {(isDone || isActive) && (
                      <div className="timeline-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {step.user && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', backgroundColor: '#F9FAFB', padding: '0.2rem 0.45rem', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
                            <User size={11} /> {step.user}
                          </div>
                        )}
                        {step.date && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', backgroundColor: '#F9FAFB', padding: '0.2rem 0.45rem', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
                            <Calendar size={11} /> {formatDate(step.date)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submission Details Summary */}
          {instance && (instance.testingPeriod?.startDate || instance.results?.some(r => r.testMethod)) && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.6rem', color: 'var(--color-text-main)', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.4rem' }}>Submission Details</div>
              {instance.testingPeriod?.startDate && (
                <div className="telemetry-text" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                  <strong>Testing Period:</strong> {new Date(instance.testingPeriod.startDate).toLocaleDateString('en-IN')} – {new Date(instance.testingPeriod.endDate).toLocaleDateString('en-IN')}
                </div>
              )}
              {instance.results?.some(r => r.testMethod) && (
                <div className="telemetry-text" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  <strong>Methods Used:</strong> {Array.from(new Set(instance.results.map(r => r.testMethod).filter(Boolean))).join(', ') || 'Standard Methods'}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', backgroundColor: isRetest ? 'white' : 'transparent', padding: isRetest ? '1.25rem 1.5rem' : '0', borderRadius: isRetest ? '12px' : '0', border: isRetest ? '1px dashed #F59E0B' : 'none' }}>
          <div>
            <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.2rem', color: isRetest ? '#B45309' : 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isRetest && <RotateCcw size={20} />}
              Job {formatJobCode(cycleJob.jobCode)}
            </h3>
            {isRetest && (
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Retest Cycle #{cycleJob.retestNumber}
              </p>
            )}
          </div>

        </div>

        {/* Pipeline tracks — scrollable on mobile */}
        <div className="pipeline-scroll">
        <div className="pipeline-container" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
          {cycleJob.sampleFlow?.firstDepartment === 'chemical' ? (
            <>
              {(user?.role !== 'HEAD' || user?.department?.toLowerCase() === 'chemical' || user?.department?.toLowerCase() === 'chemical') && (
                <PipelineTrack title="CHEMICAL Department" distData={cycleJob.distribution?.chemical} instance={chemicalInstance} deptColor="#3B82F6" richInstance={richChemical} />
              )}
              {user?.role !== 'HEAD' && bothRequired && cycleJob.sampleTransfers && cycleJob.sampleTransfers.length > 0 && (
                <div className="timeline-transfer" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, minWidth: '150px', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.25rem 1rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: '12px', border: '1px dashed var(--color-border)', width: '100%', height: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
                    <ArrowRightLeft size={28} style={{ color: cycleJob.sampleTransfers[0].status === 'RECEIVED' ? 'var(--color-success)' : 'var(--color-warning)' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                      Sample Transfer
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                      {cycleJob.sampleTransfers[0].status === 'RECEIVED' 
                        ? `Received by ${cycleJob.sampleTransfers[0].receivedBy?.name?.split(' ')[0] || 'Dept'}` 
                        : `In Transit`}
                    </div>
                    {cycleJob.sampleTransfers[0].sentAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', textAlign: 'center' }}>
                        Sent: {new Date(cycleJob.sampleTransfers[0].sentAt).toLocaleString('en-IN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}
                      </div>
                    )}
                    {cycleJob.sampleTransfers[0].receivedAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                        Received: {new Date(cycleJob.sampleTransfers[0].receivedAt).toLocaleString('en-IN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(user?.role !== 'HEAD' || user?.department?.toLowerCase() === 'micro') && (
                <PipelineTrack title="MICRO Department" distData={cycleJob.distribution?.micro} instance={microInstance} deptColor="#10B981" richInstance={richMicro} />
              )}
            </>
          ) : (
            <>
              {(user?.role !== 'HEAD' || user?.department?.toLowerCase() === 'micro') && (
                <PipelineTrack title="MICRO Department" distData={cycleJob.distribution?.micro} instance={microInstance} deptColor="#10B981" richInstance={richMicro} />
              )}
              {user?.role !== 'HEAD' && bothRequired && cycleJob.sampleTransfers && cycleJob.sampleTransfers.length > 0 && (
                <div className="timeline-transfer" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, minWidth: '150px', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.25rem 1rem', backgroundColor: 'var(--color-surface-hover)', borderRadius: '12px', border: '1px dashed var(--color-border)', width: '100%', height: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
                    <ArrowRightLeft size={28} style={{ color: cycleJob.sampleTransfers[0].status === 'RECEIVED' ? 'var(--color-success)' : 'var(--color-warning)' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>
                      Sample Transfer
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                      {cycleJob.sampleTransfers[0].status === 'RECEIVED' 
                        ? `Received by ${cycleJob.sampleTransfers[0].receivedBy?.name?.split(' ')[0] || 'Dept'}` 
                        : `In Transit`}
                    </div>
                    {cycleJob.sampleTransfers[0].sentAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', textAlign: 'center' }}>
                        Sent: {new Date(cycleJob.sampleTransfers[0].sentAt).toLocaleString('en-IN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}
                      </div>
                    )}
                    {cycleJob.sampleTransfers[0].receivedAt && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                        Received: {new Date(cycleJob.sampleTransfers[0].receivedAt).toLocaleString('en-IN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(user?.role !== 'HEAD' || user?.department?.toLowerCase() === 'chemical' || user?.department?.toLowerCase() === 'chemical') && (
                <PipelineTrack title="CHEMICAL Department" distData={cycleJob.distribution?.chemical} instance={chemicalInstance} deptColor="#3B82F6" richInstance={richChemical} />
              )}
            </>
          )}
        </div>
        </div>{/* end pipeline-scroll */}

        {/* Bottom report bar — when all done */}
        {allDone && (
          <div style={{ marginTop: '1.25rem', padding: '1rem 1.5rem', backgroundColor: '#F0FDF4', borderRadius: '10px', border: '1px solid #D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckCircle size={20} color="#10B981" />
              <div>
                <div style={{ fontWeight: 600, color: '#065F46', fontSize: '0.9rem' }}>All analyses complete for {formatJobCode(cycleJob.jobCode)}</div>
                <div style={{ fontSize: '0.78rem', color: '#6EE7B7' }}>Report available in actions menu</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '1.5rem', backgroundColor: '#F9FAFB', borderRadius: '16px', border: '1px solid var(--color-border)' }}>

      {/* Timeline sequence */}
      {timelineSequence.map((cycleJob, idx) => (
        <React.Fragment key={cycleJob._id}>
          {idx > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2rem 0' }}>
              <div style={{ width: '4px', height: '28px', backgroundColor: '#FBBF24' }}></div>
              <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', color: '#B45309', padding: '0.6rem 1.25rem', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem', boxShadow: '0 2px 6px rgba(251,191,36,0.12)' }}>
                <RotateCcw size={15} /> Job Reopened: {cycleJob.reopenReason || 'Parameters altered for retest'}
              </div>
              <div style={{ width: '4px', height: '28px', backgroundColor: '#FBBF24' }}></div>
            </div>
          )}
          <JobCycle cycleJob={cycleJob} isRetest={idx > 0} />
        </React.Fragment>
      ))}
    </div>
  );
}

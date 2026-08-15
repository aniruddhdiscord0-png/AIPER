import React, { useState, useEffect } from "react";
import axios from "axios";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import JobLogTable from "../components/JobLogTable";
import Spinner from "../components/Spinner";
import { fetchWithCache, invalidateCache, CACHE_KEYS, isCached } from "../utils/cache";
import { cacheSet, cacheGet } from "../utils/cacheStorage";
import { API_URL } from "../config";
import { formatJobCode } from "../utils/serialUtils";
import { useSocket } from "../components/SocketProvider";

export default function ActivityLogsPage({
  title = "Activity Logs",
  fetchUrl = `${API_URL}/api/jobs`,
  showCompletedActivity = false,
  completedActivityScope = "all", // "all" or "department"
  enableSocketUpdates = false,
  onReopen = null,
  defaultExpandedId = null,
  user = null, // needed for 'department' scope
}) {
  const [instances, setInstances] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const [jobsCursor, setJobsCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [auditLoading, setAuditLoading] = useState(
    () => !isCached(CACHE_KEYS.JOBS) || (showCompletedActivity && !isCached(CACHE_KEYS.INSTANCES))
  );

  const socket = useSocket();
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      if (showCompletedActivity) {
        const cachedInst = await cacheGet(CACHE_KEYS.INSTANCES);
        if (cachedInst) {
          setInstances(filterInstances(cachedInst));
        }
      }
      
      const cachedJobs = await cacheGet(CACHE_KEYS.JOBS);
      if (cachedJobs) {
        const parsed = typeof cachedJobs === 'string' ? JSON.parse(cachedJobs) : cachedJobs;
        setJobs(parsed.jobs ? parsed.jobs : parsed);
      }

      const promises = [axios.get(fetchUrl)];
      if (showCompletedActivity) {
        promises.push(axios.get(`${API_URL}/api/tests/instances`));
      }

      const results = await Promise.all(promises);
      const resJobs = results[0];
      
      if (resJobs.data && resJobs.data.jobs) {
        setJobs(resJobs.data.jobs);
        setHasMoreJobs(resJobs.data.hasMore || false);
        setJobsCursor(resJobs.data.nextCursor || null);
      } else {
        setJobs(resJobs.data);
      }
      cacheSet(CACHE_KEYS.JOBS, resJobs.data);

      if (showCompletedActivity) {
        const resInst = results[1];
        cacheSet(CACHE_KEYS.INSTANCES, resInst.data);
        setInstances(filterInstances(resInst.data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  const filterInstances = (allInstances) => {
    const completed = allInstances.filter(i => i.status === 'COMPLETED');
    if (completedActivityScope === "department" && user?.department) {
      return completed.filter(
        i => i.createdBy?.department === user.department || i.assignedTo?.department === user.department
      );
    }
    return completed;
  };

  const loadMoreJobs = async () => {
    if (!jobsCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const separator = fetchUrl.includes('?') ? '&' : '?';
      const res = await axios.get(`${fetchUrl}${separator}cursor=${jobsCursor}`);
      setJobs((prev) => [...prev, ...(res.data.jobs || [])]);
      setHasMoreJobs(res.data.hasMore);
      setJobsCursor(res.data.nextCursor);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleServerSearch = async (term) => {
    if (!term) {
      fetchData();
      return;
    }
    setIsLoadingMore(true);
    try {
      const separator = fetchUrl.includes('?') ? '&' : '?';
      const res = await axios.get(`${fetchUrl}${separator}search=${encodeURIComponent(term)}&limit=100`);
      setJobs(res.data.jobs || []);
      setHasMoreJobs(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchUrl]);

  useEffect(() => {
    if (!socket || !enableSocketUpdates) return;
    const triggerUpdate = () => {
      invalidateCache(CACHE_KEYS.JOBS);
      fetchData();
    };

    const events = [
      "JOB_CREATED", "JOB_RETEST_INITIATED", "TRANSFER_INITIATED", 
      "TRANSFER_RECEIVED", "TEST_SUBMITTED", "TEST_REVIEWED", 
      "JOB_UPDATED", "JOB_RETURNED", "JOB_DELETED"
    ];

    events.forEach(e => socket.on(e, triggerUpdate));
    return () => {
      events.forEach(e => socket.off(e, triggerUpdate));
    };
  }, [socket, enableSocketUpdates]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={28} style={{ color: 'var(--color-primary)' }} /> {title}
        </h1>

        {auditLoading && jobs.length === 0 ? (
          <div className="card"><Spinner message="Loading logs..." /></div>
        ) : (
          <JobLogTable 
            jobs={jobs} 
            title="Lifecycle Tracker" 
            hasMoreData={hasMoreJobs}
            isLoadingMoreData={isLoadingMore}
            onLoadMoreData={loadMoreJobs}
            onServerSearch={handleServerSearch}
            defaultExpandedId={defaultExpandedId}
            onReopen={onReopen}
          />
        )}
      </div>

      {showCompletedActivity && (
        <div>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Completed Activity
          </h2>
          <div className="card glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-scroll">
              <table>
                <thead style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                  <tr>
                    <th>Test Code</th>
                    <th>Client Name</th>
                    <th>Analyst</th>
                    <th>Date Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading && instances.length === 0 ? (
                    <tr><td colSpan="4"><Spinner message="Loading completed tests..." /></td></tr>
                  ) : instances.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>No completed tests yet.</td></tr>
                  ) : (
                    instances.map(inst => (
                      <tr key={inst._id}>
                        <td style={{ fontFamily: 'monospace' }}>{formatJobCode(inst.testCode)}</td>
                        <td style={{ fontWeight: 500 }}>{inst.clientName}</td>
                        <td>{inst.assignedTo?.name}</td>
                        <td>{new Date(inst.completedAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

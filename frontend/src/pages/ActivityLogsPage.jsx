import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FileText } from "lucide-react";
import JobLogTable from "../components/JobLogTable";
import Spinner from "../components/Spinner";
import { fetchWithCache, invalidateCache, CACHE_KEYS, isCached } from "../utils/cache";
import API_URL from "../utils/api";
import { useSocket } from "../context/SocketContext";

export default function ActivityLogsPage({
  title = "Activity Logs",
  fetchUrl = `${API_URL}/api/jobs`,
  enableSocketUpdates = false,
  onReopen = null,
  defaultExpandedId = null,
  user = null,
  cacheKey = CACHE_KEYS.JOBS,
}) {
  const [jobs, setJobs] = useState([]);
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const [jobsCursor, setJobsCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [auditLoading, setAuditLoading] = useState(
    () => cacheKey && !isCached(cacheKey)
  );

  const socket = useSocket();

  const fetchData = useCallback(async () => {
    try {
      const resJobs = await fetchWithCache(fetchUrl, cacheKey, (raw) => {
        if (raw && raw.jobs) {
          setJobs(raw.jobs);
          setHasMoreJobs(raw.hasMore || false);
          setJobsCursor(raw.nextCursor || null);
        } else if (Array.isArray(raw)) {
          setJobs(raw);
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  }, [fetchUrl, cacheKey]);

  const loadMoreJobs = useCallback(async () => {
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
  }, [fetchUrl, jobsCursor, isLoadingMore]);

  const handleServerSearch = useCallback(async (term) => {
    if (!term) {
      fetchData();
      return;
    }
    // Clear immediately so the local filter doesn't run against stale jobs
    // and show a false "No jobs match your filter" while the request is in-flight
    setJobs([]);
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
  }, [fetchUrl, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket || !enableSocketUpdates) return;
    const triggerUpdate = () => {
      if (cacheKey) invalidateCache(cacheKey);
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
  }, [socket, enableSocketUpdates, fetchData, cacheKey]);

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
    </div>
  );
}

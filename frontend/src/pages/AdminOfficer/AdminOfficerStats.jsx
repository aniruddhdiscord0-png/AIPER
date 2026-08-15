import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWithCache, invalidateCache, CACHE_KEYS, isCached } from "../../utils/cache";
import { cacheGet, cacheSet } from "../../utils/cacheStorage";
import API_URL from "../../utils/api";
import Spinner from "../../components/Spinner";

import { Play, Check, Users, Activity, Clock, FileText, ChevronRight } from "lucide-react";
import { formatJobCode } from "../../utils/serialUtils";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    ongoingJobs: 0,
    completedJobs: 0,
    activeAnalysts: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [statsLoading, setStatsLoading] = useState(
    () =>
      !isCached(CACHE_KEYS.JOBS) ||
      !isCached(CACHE_KEYS.INSTANCES),
  );

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let statsData, instancesData, usersData;

        // Use cache for initial render, then fetch fresh data in background
        const cachedStats = await cacheGet(CACHE_KEYS.STATS);
        const cachedInstances = await cacheGet(CACHE_KEYS.INSTANCES);
        const cachedUsers = await cacheGet(CACHE_KEYS.USERS);

        const computeStats = (statsObj, instances, users) => {
          if (!statsObj) statsObj = { ongoingJobs: 0, completedJobs: 0 };
          if (!Array.isArray(instances)) instances = [];
          if (!Array.isArray(users)) users = [];
          
          const activeAnalysts = new Set(
            instances
              .filter((i) => i.status === "PENDING" && i.assignedTo)
              .map((i) => i.assignedTo._id || i.assignedTo),
          ).size;
          setStats({ 
            ongoingJobs: statsObj.ongoingJobs || 0, 
            completedJobs: statsObj.completedJobs || 0, 
            activeAnalysts 
          });
          setRecentActivity(
            [...instances]
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
              .slice(0, 5),
          );
        };

        // Instant render from cache
        if (cachedStats && cachedInstances && cachedUsers) {
          computeStats(
            cachedStats,
            cachedInstances,
            cachedUsers,
          );
        }

        // Fetch fresh in background
        const [statsRes, instancesRes, usersRes] = await Promise.all([
          axios.get(`${API_URL}/api/jobs/stats`),
          axios.get(`${API_URL}/api/tests/instances`),
          axios.get(`${API_URL}/api/users`),
        ]);
        cacheSet(CACHE_KEYS.STATS, statsRes.data);
        cacheSet(CACHE_KEYS.INSTANCES, instancesRes.data);
        cacheSet(CACHE_KEYS.USERS, usersRes.data);
        computeStats(statsRes.data, instancesRes.data, usersRes.data);
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  const StatCard = ({ icon: Icon, title, value, color, subtitle }) => (
    <div
      className="card"
      style={{
        flex: 1,
        minWidth: "220px",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        borderTop: `4px solid ${color}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            padding: "0.6rem",
            backgroundColor: `${color}15`,
            color: color,
            borderRadius: "var(--radius-md)",
          }}
        >
          <Icon size={20} />
        </div>
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "var(--color-text-main)",
          }}
        >
          {value}
        </div>
      </div>
      <div>
        <div
          style={{
            fontWeight: 600,
            color: "var(--color-text-main)",
            fontSize: "0.9rem",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
          {subtitle}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 style={{ marginBottom: "0.5rem", letterSpacing: "-0.025em" }}>
          Admin Officer Dashboard
        </h1>
      </div>

      <div className="stat-cards">
        <StatCard
          icon={Activity}
          title="Ongoing Jobs"
          value={stats.ongoingJobs}
          color="var(--color-primary)"
          subtitle="Currently in progress"
        />
        <StatCard
          icon={CheckCircle}
          title="Completed Jobs"
          value={stats.completedJobs}
          color="var(--color-success)"
          subtitle="Fully completed"
        />
        <StatCard
          icon={UsersIcon}
          title="Active Analysts"
          value={stats.activeAnalysts}
          color="#8B5CF6"
          subtitle="Currently working on jobs"
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "1.1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Activity size={18} /> Recent Activity
          </h3>
        </div>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: "var(--color-surface-hover)" }}>
              <tr>
                <th
                  style={{
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  ID / Code
                </th>
                <th
                  style={{
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Client
                </th>
                <th
                  style={{
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Analyst
                </th>
                <th
                  style={{
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {statsLoading ? (
                <tr>
                  <td colSpan="4">
                    <Spinner message="Fetching activity..." />
                  </td>
                </tr>
              ) : recentActivity.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    style={{
                      textAlign: "center",
                      padding: "2.5rem",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    No recent activity detected.
                  </td>
                </tr>
              ) : (
                recentActivity.map((inst) => (
                  <tr key={inst._id}>
                    <td
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {formatJobCode(inst.testCode)}
                    </td>
                    <td style={{ fontWeight: 500 }}>{inst.clientName}</td>
                    <td>
                      {inst.assignedTo?.name || (
                        <span style={{ color: "var(--color-text-muted)" }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${inst.status === "COMPLETED" ? "badge-success" : "badge-warning"}`}
                      >
                        {inst.status === "COMPLETED"
                          ? "Finished"
                          : "In Progress"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

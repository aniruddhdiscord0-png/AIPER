import React, { useState, useEffect, useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import {
  Trash2,
  Edit,
  Plus,
  Check,
  FileText,
  Activity,
  Users,
  Settings,
  Clock,
  CheckCircle,
  ClipboardCheck,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Send,
  PackageCheck,
  Lock,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";

import JobLogTable from "../components/JobLogTable";
import JobDetailsModal from "../components/JobDetailsModal";
import { fetchWithCache, invalidateCache, CACHE_KEYS } from "../utils/cache";
import Spinner from "../components/Spinner";
import { useSocket } from "../context/SocketContext";
import API_URL from "../utils/api";
import DataSettings from "./DataSettings";
const formatJobCode = (code) => {
  if (!code) return "";
  return code
    .replace(/-N[12]([a-z]?)(?:-v\d+)?$/g, "-N$1")
    .replace(/-[12][a-z]?(?:-v\d+)?$/g, "");
};

function Dashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    ongoingJobs: 0,
    completedJobs: 0,
    activeAnalysts: 0,
    pendingTransfers: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [statsLoading, setStatsLoading] = useState(
    () =>
      !sessionStorage.getItem(CACHE_KEYS.JOBS) ||
      !sessionStorage.getItem(CACHE_KEYS.INSTANCES),
  );

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use cache for initial render
        const cachedJobs = sessionStorage.getItem(CACHE_KEYS.JOBS);
        const cachedInstances = sessionStorage.getItem(CACHE_KEYS.INSTANCES);
        // Note: sample-transfers aren't globally cached yet, so we'll just skip them in the 0ms render or use 0

        const computeStats = (jobs, instances, pendingIn, pendingOut) => {
          if (!Array.isArray(jobs)) jobs = [];
          if (!Array.isArray(instances)) instances = [];
          const ongoingJobs = jobs.filter((j) => {
            const microDone =
              !j.distribution?.micro?.required ||
              j.distribution.micro.status === "COMPLETED";
            const chemicalDone =
              !j.distribution?.chemical?.required ||
              j.distribution.chemical.status === "COMPLETED";
            return !(microDone && chemicalDone);
          }).length;
          const completedJobs = jobs.filter((j) => {
            const microDone =
              !j.distribution?.micro?.required ||
              j.distribution.micro.status === "COMPLETED";
            const chemicalDone =
              !j.distribution?.chemical?.required ||
              j.distribution.chemical.status === "COMPLETED";
            return microDone && chemicalDone;
          }).length;
          const activeAnalysts = new Set(
            instances
              .filter((i) => i.status === "PENDING" && i.assignedTo)
              .map((i) => i.assignedTo._id || i.assignedTo),
          ).size;

          const pendingTransfers = pendingIn + pendingOut;

          setStats({
            ongoingJobs,
            completedJobs,
            activeAnalysts,
            pendingTransfers,
          });

          // Get latest 5 activities in this department
          const sortedInstances = [...instances]
            .filter(
              (i) =>
                i.createdBy?.department === user.department ||
                i.assignedTo?.department === user.department,
            )
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 5);

          setRecentActivity(sortedInstances);
        };

        if (cachedJobs && cachedInstances) {
          computeStats(
            JSON.parse(cachedJobs),
            JSON.parse(cachedInstances),
            0,
            0,
          );
        }

        const [
          jobsRes,
          instancesRes,
          usersRes,
          inTransfersRes,
          outTransfersRes,
        ] = await Promise.all([
          axios.get(`${API_URL}/api/jobs`),
          axios.get(`${API_URL}/api/tests/instances`),
          axios.get(`${API_URL}/api/users`),
          axios.get(`${API_URL}/api/sample-transfers/incoming`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }),
          axios.get(`${API_URL}/api/sample-transfers/outgoing`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }),
        ]);

        computeStats(
          jobsRes.data,
          instancesRes.data,
          inTransfersRes.data.length,
          outTransfersRes.data.length,
        );

        sessionStorage.setItem(CACHE_KEYS.JOBS, JSON.stringify(jobsRes.data));
        sessionStorage.setItem(
          CACHE_KEYS.INSTANCES,
          JSON.stringify(instancesRes.data),
        );
        sessionStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(usersRes.data));
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
          Head Dashboard
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
          icon={Users}
          title="Active Analysts"
          value={stats.activeAnalysts}
          color="#8B5CF6"
          subtitle="Currently working on jobs"
        />
        <StatCard
          icon={ArrowRightLeft}
          title="Pending Transfers"
          value={stats.pendingTransfers}
          color="#F59E0B"
          subtitle="Awaiting hand-over or receipt"
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

function Assistants() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const { user } = useContext(AuthContext); // to get department/branch
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [usersLoading, setUsersLoading] = useState(
    () => !sessionStorage.getItem(CACHE_KEYS.USERS),
  );

  const fetchUsers = async () => {
    try {
      await fetchWithCache(`${API_URL}/api/users`, CACHE_KEYS.USERS, setUsers);
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleNameChange = (e) => {
    const newName = e.target.value;
    const firstName = newName
      .split(" ")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    setFormData((prev) => ({
      ...prev,
      name: newName,
      password: editUserId ? prev.password : firstName ? `${firstName}123` : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{10,15}$/;

    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!phoneRegex.test(formData.phone)) {
      setError("Please enter a valid phone number (10-15 digits).");
      return;
    }
    try {
      if (editUserId) {
        await axios.put(`${API_URL}/api/users/${editUserId}`, formData);
        setSuccess("Assistant updated successfully.");
      } else {
        const res = await axios.post(`${API_URL}/api/users`, {
          ...formData,
          role: "ASSISTANT",
          department: user.department,
          branch: user.branch,
        });
        setSuccess(
          `Assistant created successfully. Password: ${res.data.temporaryPassword}`,
        );
      }
      setFormData({ name: "", email: "", phone: "", password: "" });
      setEditUserId(null);
      setShowForm(false);
      invalidateCache(CACHE_KEYS.USERS);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Operation failed");
    }
  };

  const handleEdit = (u) => {
    setFormData({ name: u.name, email: u.email, phone: u.phone, password: "" });
    setEditUserId(u._id);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const confirmDelete = (u) => setUserToDelete(u);

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await axios.delete(`${API_URL}/api/users/${userToDelete._id}`);
      setUserToDelete(null);
      invalidateCache(CACHE_KEYS.USERS);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete");
      setUserToDelete(null);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <h1>Assistants Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) setEditUserId(null);
          }}
        >
          {showForm ? "Close Form" : "+ Create Assistant"}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            color: "var(--color-danger)",
            backgroundColor: "var(--color-danger-light)",
            padding: "1rem",
            borderRadius: "var(--radius-md)",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            marginBottom: "1rem",
            color: "var(--color-success)",
            backgroundColor: "var(--color-success-light)",
            padding: "1rem",
            borderRadius: "var(--radius-md)",
          }}
        >
          {success}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>
            {editUserId ? "Edit Assistant" : "Create Assistant"}
          </h3>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.9rem",
                    marginBottom: "0.4rem",
                    fontWeight: 500,
                  }}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleNameChange}
                  required
                  placeholder="Jane Doe"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.9rem",
                    marginBottom: "0.4rem",
                    fontWeight: 500,
                  }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  placeholder="jane@foodlab.com"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.9rem",
                    marginBottom: "0.4rem",
                    fontWeight: 500,
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  required
                />
              </div>
              {!editUserId && (
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.9rem",
                      marginBottom: "0.4rem",
                      fontWeight: 500,
                    }}
                  >
                    Password (Auto-generated)
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                  />
                </div>
              )}
            </div>
            <div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: "0.5rem" }}
              >
                {editUserId ? "Update Assistant" : "Submit & Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <table>
            <thead style={{ backgroundColor: "var(--color-surface-hover)" }}>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading && users.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <Spinner message="Loading assistants..." />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    style={{ textAlign: "center", padding: "2rem" }}
                  >
                    No assistants found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-success">{u.role}</span>
                    </td>
                    <td>
                      {userToDelete && userToDelete._id === u._id ? (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--color-danger)",
                            }}
                          >
                            Sure?
                          </span>
                          <button
                            onClick={handleDelete}
                            className="btn-danger"
                            style={{
                              padding: "0.2rem 0.6rem",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setUserToDelete(null)}
                            style={{
                              padding: "0.2rem 0.6rem",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              border: "1px solid var(--color-border)",
                              cursor: "pointer",
                            }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(u)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--color-primary)",
                              cursor: "pointer",
                              marginRight: "1rem",
                            }}
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => confirmDelete(u)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--color-danger)",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
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

// Blueprints section removed per requirement: Admin Officer adds parameters directly.

function Dispatcher() {
  const [assistants, setAssistants] = useState([]);
  const [jobs, setJobs] = useState([]);
  const { user } = useContext(AuthContext);

  const [expandedJobId, setExpandedJobId] = useState(null);
  const [deadlineDates, setDeadlineDates] = useState({}); // jobId -> date string
  const [deadlineTimes, setDeadlineTimes] = useState({}); // jobId -> time string
  const [assignments, setAssignments] = useState({}); // `${jobId}-${paramId}` -> assistantId
  const [success, setSuccess] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(
    () => !sessionStorage.getItem(CACHE_KEYS.JOBS),
  );
  const [submittingJobId, setSubmittingJobId] = useState(null);

  // Return Job State
  const [returnModalData, setReturnModalData] = useState(null); // { jobId: string, dept: string }
  const [returnNote, setReturnNote] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [detailsJob, setDetailsJob] = useState(null);

  // Sample transfer state
  const [incomingTransfers, setIncomingTransfers] = useState([]);
  const [outgoingJobs, setOutgoingJobs] = useState([]);
  const [transferListLoading, setTransferListLoading] = useState(
    () =>
      !sessionStorage.getItem(CACHE_KEYS.TRANSFERS_IN) ||
      !sessionStorage.getItem(CACHE_KEYS.TRANSFERS_OUT),
  );
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferConfirmData, setTransferConfirmData] = useState(null); // { type: 'send' | 'receive', id: string, title, message }

  const fetchJobs = () => {
    const dept = user?.department ? user.department.toLowerCase() : "";
    fetchWithCache(`${API_URL}/api/jobs`, CACHE_KEYS.JOBS, (data) =>
      setJobs(
        data.filter((j) => {
          const dKey = dept === "chemical" ? "chemical" : dept;
          const dist = j.distribution[dKey];
          const headId = dist?.assignedHead?._id || dist?.assignedHead;
          return (
            ["PENDING", "PENDING_REVIEW", "REVIEW_APPROVED"].includes(
              dist?.status,
            ) &&
            (!headId || headId === user._id)
          );
        }),
      ),
    )
      .catch(console.error)
      .finally(() => setDispatchLoading(false));
  };

  useEffect(() => {
    const dept = user?.department ? user.department.toLowerCase() : "";
    fetchWithCache(`${API_URL}/api/users`, CACHE_KEYS.USERS, (data) =>
      setAssistants(
        data.filter(
          (u) => u.role === "ASSISTANT" && u.department === user.department,
        ),
      ),
    ).catch(console.error);

    fetchJobs();
    fetchTransfers();
  }, [user]);

  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const updateJobs = () => {
      invalidateCache(CACHE_KEYS.JOBS);
      fetchJobs();
    };
    const updateTransfers = () => {
      invalidateCache(CACHE_KEYS.TRANSFERS_IN, CACHE_KEYS.TRANSFERS_OUT);
      fetchTransfers();
    };
    const updateBoth = () => {
      updateJobs();
      updateTransfers();
    };

    socket.on("JOB_CREATED", updateBoth);
    socket.on("JOB_UPDATED", updateBoth);
    socket.on("JOB_DELETED", updateBoth);
    socket.on("JOB_RETEST_INITIATED", updateBoth);
    socket.on("TRANSFER_INITIATED", updateTransfers);
    socket.on("TRANSFER_RECEIVED", updateBoth);

    return () => {
      socket.off("JOB_CREATED", updateBoth);
      socket.off("JOB_UPDATED", updateBoth);
      socket.off("JOB_DELETED", updateBoth);
      socket.off("JOB_RETEST_INITIATED", updateBoth);
      socket.off("TRANSFER_INITIATED", updateTransfers);
      socket.off("TRANSFER_RECEIVED", updateBoth);
    };
  }, [socket, user]);

  const fetchTransfers = async () => {
    try {
      const p1 = fetchWithCache(
        `${API_URL}/api/sample-transfers/incoming`,
        CACHE_KEYS.TRANSFERS_IN,
        setIncomingTransfers,
        { Authorization: `Bearer ${localStorage.getItem("token")}` },
      );
      const p2 = fetchWithCache(
        `${API_URL}/api/sample-transfers/outgoing`,
        CACHE_KEYS.TRANSFERS_OUT,
        setOutgoingJobs,
        { Authorization: `Bearer ${localStorage.getItem("token")}` },
      );
      await Promise.all([p1, p2]);
    } catch (err) {
      console.error("Error fetching transfers:", err);
    } finally {
      setTransferListLoading(false);
    }
  };

  const getDeptParams = (job) => {
    const params =
      job?.parameters?.filter((p) => {
        if (!p || !p.parameterId) return false;
        const d = user?.department ? user.department.toLowerCase() : "";
        const pt = p.type ? p.type.toLowerCase() : "";
        if ((d === "chemical" || d === "chemical") && pt === "chemical")
          return true;
        if (d === "micro" && pt === "micro") return true;
        return false;
      }) || [];

    // Inject virtual parameters for Food Pesticide Panels (only for Chemical department)
    if (
      user?.department?.toLowerCase() === "chemical" &&
      job?.pesticidePanel?.enabled &&
      job?.pesticidePanel?.panelType === "food"
    ) {
      params.push({
        parameterId: { _id: "panel-gcmsms" },
        name: "Pesticide Panel (GCMSMS)",
        type: "Chemical",
        unit: "mg/kg",
        isPanel: true,
        panelName: "GCMSMS",
      });
      params.push({
        parameterId: { _id: "panel-lcmsms" },
        name: "Pesticide Panel (LCMSMS)",
        type: "Chemical",
        unit: "mg/kg",
        isPanel: true,
        panelName: "LCMSMS",
      });
    }

    return params;
  };

  const handleAssign = (jobId, paramId, assistantId) => {
    setAssignments((prev) => ({
      ...prev,
      [`${jobId}-${paramId}`]: assistantId,
    }));
  };

  const handleAssignAll = (jobId, assistantId, deptParams) => {
    if (!assistantId) return;
    const newAssignments = { ...assignments };
    deptParams.forEach((p) => {
      newAssignments[`${jobId}-${p.parameterId._id}`] = assistantId;
    });
    setAssignments(newAssignments);
  };

  const handleSubmit = async (job) => {
    const deptParams = getDeptParams(job);
    const dDate = deadlineDates[job._id];
    const dTime = deadlineTimes[job._id];
    const deadline = dDate && dTime ? `${dDate}T${dTime}` : null;

    // Validate all params assigned
    const allAssigned = deptParams.every(
      (p) => assignments[`${job._id}-${p.parameterId._id}`],
    );
    if (!allAssigned) return alert("Please assign all parameters to analysts");
    if (!deadline) return alert("Please set a submission deadline");

    setSubmittingJobId(job._id);
    try {
      const assignmentList = deptParams.map((p) => ({
        parameterId: p.parameterId._id,
        name: p.name,
        type: p.type,
        unit: p.unit,
        specification: p.specification || '',
        isPanel: p.isPanel,
        panelName: p.panelName,
        assignedTo: assignments[`${job._id}-${p.parameterId._id}`],
      }));

      await axios.post(`${API_URL}/api/tests/instances`, {
        jobId: job._id,
        deadline,
        assignments: assignmentList,
      });

      // Immediately remove from UI for snappy experience
      setJobs((prev) => prev.filter((j) => j._id !== job._id));

      setSuccess(`Job ${formatJobCode(job.jobCode)} dispatched successfully!`);
      setExpandedJobId(null);
      setTimeout(() => setSuccess(""), 4000);

      // Refresh jobs list
      invalidateCache(CACHE_KEYS.JOBS);
      fetchJobs();
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingJobId(null);
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    if (!returnModalData || !returnNote.trim()) return;

    setIsReturning(true);
    try {
      await axios.post(`${API_URL}/api/jobs/${returnModalData.jobId}/return`, {
        department: returnModalData.dept,
        note: returnNote,
      });

      setJobs((prev) => prev.filter((j) => j._id !== returnModalData.jobId));
      setSuccess(`Job returned to Admin Officer successfully.`);
      setReturnModalData(null);
      setReturnNote("");
      setTimeout(() => setSuccess(""), 4000);

      invalidateCache(CACHE_KEYS.JOBS);
      fetchJobs();
    } catch (err) {
      console.error(err);
      alert(
        "Error returning job: " + (err.response?.data?.message || err.message),
      );
    } finally {
      setIsReturning(false);
    }
  };

  const toggleExpand = (jobId) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  };

  const handleSendTransferClick = (jobId) => {
    setTransferConfirmData({
      type: "send",
      id: jobId,
      title: "Hand Over Sample",
      message:
        "You are handing over this sample to the other department. This action will be recorded and cannot be undone.",
    });
  };

  const handleReceiveTransferClick = (transferId) => {
    setTransferConfirmData({
      type: "receive",
      id: transferId,
      title: "Confirm Receipt",
      message:
        "You are confirming receipt of this sample. The job will become available in your dispatcher.",
    });
  };

  const executeTransfer = async () => {
    if (!transferConfirmData || transferLoading) return;
    const { type, id } = transferConfirmData;
    setTransferLoading(true);

    try {
      if (type === "send") {
        await axios.post(
          `${API_URL}/api/sample-transfers`,
          { jobId: id },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );
        setSuccess(
          "Sample hand-over recorded! The other department has been notified.",
        );
        setOutgoingJobs((prev) => prev.filter((j) => j._id !== id));
      } else if (type === "receive") {
        await axios.put(
          `${API_URL}/api/sample-transfers/${id}/receive`,
          {},
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        // Immediately remove from UI for snappy experience
        setIncomingTransfers((prev) => prev.filter((t) => t._id !== id));

        setSuccess(
          "Sample receipt confirmed! The job is now available in your dispatcher.",
        );
        invalidateCache(CACHE_KEYS.JOBS);
      }
      setTimeout(() => setSuccess(""), 4000);
      fetchTransfers();
      setTransferConfirmData(null);
    } catch (err) {
      alert(
        err.response?.data?.message ||
        `Error ${type === "send" ? "sending" : "receiving"} transfer`,
      );
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem" }}>Job Dispatcher</h1>
      {success && (
        <div
          style={{
            marginBottom: "1rem",
            color: "var(--color-success)",
            backgroundColor: "var(--color-success-light)",
            padding: "1rem",
            borderRadius: "var(--radius-md)",
            fontWeight: 500,
          }}
        >
          {success}
        </div>
      )}

      {/* ── Sample Transfers Section ── */}
      {(incomingTransfers.length > 0 || outgoingJobs.length > 0) && (
        <div
          style={{
            marginBottom: "2.5rem",
            paddingBottom: "2rem",
            borderBottom: "2px dashed var(--color-border)",
          }}
        >
          <h1
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--color-text-main)",
            }}
          >
            <ArrowRightLeft size={24} /> Sample Transfer Management
          </h1>

          {/* ── Incoming Transfers ── */}
          {transferListLoading &&
            incomingTransfers.length === 0 &&
            outgoingJobs.length === 0 ? (
            <Spinner message="Loading transfers..." />
          ) : (
            incomingTransfers.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h2
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    marginBottom: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "var(--color-warning)",
                  }}
                >
                  <PackageCheck size={20} /> Incoming Samples — Action Required
                </h2>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  {incomingTransfers.map((transfer) => (
                    <div
                      key={transfer._id}
                      className="card"
                      style={{
                        padding: "1.25rem 1.5rem",
                        border: "2px solid var(--color-warning)",
                        backgroundColor: "rgba(241, 196, 15, 0.05)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "1rem",
                            marginBottom: "0.3rem",
                          }}
                        >
                          📦 Sample from{" "}
                          {transfer.fromDepartment === "micro"
                            ? "Micro"
                            : "Chemical"}{" "}
                          Department
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          Sample Serial:{" "}
                          <strong>#{transfer.sampleSerial}</strong>
                          {transfer.jobId?.clientName && ` · ${transfer.jobId.clientName}`}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--color-text-muted)",
                            marginTop: "0.2rem",
                          }}
                        >
                          Sent by: {transfer.sentBy?.name || "Unknown"} ·{" "}
                          {new Date(transfer.sentAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleReceiveTransferClick(transfer._id)}
                        disabled={transferLoading}
                        className="btn btn-primary"
                        style={{
                          padding: "0.6rem 1.2rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <Check size={16} />{" "}
                        {transferLoading ? "Processing..." : "Confirm Receipt"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* ── Outgoing Transfers (Hand Over) ── */}
          {outgoingJobs.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h2
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  marginBottom: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "var(--color-primary)",
                }}
              >
                <Send size={20} /> Samples Ready for Hand-Over
              </h2>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {outgoingJobs.map((job) => {
                  const secondDept =
                    user?.department?.toLowerCase() === "micro"
                      ? "Chemical"
                      : "Micro";
                  return (
                    <div
                      key={job._id}
                      className="card"
                      style={{
                        padding: "1.25rem 1.5rem",
                        border: "2px solid var(--color-primary)",
                        backgroundColor: "rgba(52, 152, 219, 0.05)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "1rem",
                            marginBottom: "0.3rem",
                          }}
                        >
                          🔄 Hand Over to {secondDept} Department
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          Sample Serial: <strong>#{job.sampleSerial}</strong>{" "}
                          {job.clientName ? `— ${job.clientName}` : ""}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--color-text-muted)",
                            marginTop: "0.2rem",
                          }}
                        >
                          Please hand over the sample to the {secondDept}{" "}
                          department once you have taken your required portion.
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendTransferClick(job._id)}
                        disabled={transferLoading}
                        className="btn"
                        style={{
                          padding: "0.6rem 1.2rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          backgroundColor: "var(--color-primary)",
                          color: "white",
                        }}
                      >
                        <ArrowRightLeft size={16} />{" "}
                        {transferLoading ? "Processing..." : "Hand Over Sample"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── End Sample Transfers Section ── */}

      {dispatchLoading ? (
        <Spinner message="Loading pending jobs..." />
      ) : jobs.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--color-text-muted)",
          }}
        >
          <CheckCircle
            size={40}
            style={{ marginBottom: "1rem", opacity: 0.4 }}
          />
          <p style={{ fontSize: "1.1rem", fontWeight: 500 }}>
            No pending jobs to dispatch
          </p>
          <p style={{ fontSize: "0.85rem" }}>
            All jobs have been assigned. Check back later.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {jobs.map((job) => {
            const deptParams = getDeptParams(job);
            const isExpanded = expandedJobId === job._id;
            const microCount = deptParams.filter(
              (p) => p.type?.toLowerCase() === "micro",
            ).length;
            const chemCount = deptParams.filter(
              (p) => p.type?.toLowerCase() === "chemical",
            ).length;

            const isMultiDept =
              job.distribution?.micro?.required &&
              job.distribution?.chemical?.required;
            const myDept = user?.department
              ? user.department.toLowerCase()
              : "";
            const iAmChemical = myDept === "chemical";
            const transferState = job.sampleTransferState;

            let canChemicalDispatch = true;
            if (iAmChemical && isMultiDept) {
              if (
                ["PENDING_APPROVAL", "PENDING_TRANSFER", "IN_TRANSIT"].includes(
                  transferState,
                )
              ) {
                canChemicalDispatch = false;
              }
            }

            return (
              <div
                key={job._id}
                className="card"
                style={{
                  padding: 0,
                  overflow: "hidden",
                  border: isExpanded
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                  transition: "border-color 0.2s",
                }}
              >
                {/* Card Header — always visible */}
                <div
                  onClick={() => toggleExpand(job._id)}
                  style={{
                    padding: "1.25rem 1.5rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: isExpanded
                      ? "var(--color-surface-hover)"
                      : "var(--color-surface)",
                    transition: "background-color 0.2s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <div
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "var(--color-primary)15",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <ClipboardCheck size={22} color="var(--color-primary)" />
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "1rem",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {formatJobCode(job.jobCode)}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--color-text-muted)",
                          marginTop: "0.15rem",
                        }}
                      >
                        {job.clientName}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.5rem",
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailsJob(job);
                      }}
                      className="btn btn-secondary"
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.8rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                      title="View all customer, sample, and compliance details"
                    >
                      <ClipboardCheck size={14} /> View Details
                    </button>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {new Date(job.createdAt).toLocaleDateString("en-IN")}
                      </div>
                      <div style={{ fontSize: "0.8rem", marginTop: "0.15rem" }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--color-primary)",
                          }}
                        >
                          {deptParams.length}
                        </span>
                        <span style={{ color: "var(--color-text-muted)" }}>
                          {" "}
                          parameter{deptParams.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={20} color="var(--color-primary)" />
                    ) : (
                      <ChevronRight size={20} color="var(--color-text-muted)" />
                    )}
                  </div>
                </div>

                {/* Expanded Dispatch Form */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "1.5rem",
                      borderTop: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                    }}
                  >
                    {deptParams.length === 0 ? (
                      <p
                        style={{
                          color: "var(--color-text-muted)",
                          textAlign: "center",
                          padding: "1rem",
                        }}
                      >
                        No parameters for your department in this job.
                      </p>
                    ) : (
                      (() => {
                        const dept = user?.department
                          ? user.department.toLowerCase()
                          : "";
                        const dKey = dept === "chemical" ? "chemical" : dept;
                        const otherKey =
                          dKey === "chemical" ? "micro" : "chemical";
                        const distStatus = job.distribution[dKey].status;
                        const isMultiDept =
                          job.distribution.micro.required &&
                          job.distribution.chemical.required;

                        const isReviewing = distStatus === "PENDING_REVIEW";
                        const isApproved = distStatus === "REVIEW_APPROVED";
                        const isPending = distStatus === "PENDING";

                        return (
                          <>
                            {/* Parameter rows (Always visible) */}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                                marginBottom: "1.5rem",
                              }}
                            >
                              {deptParams.map((p) => (
                                <div
                                  key={p.parameterId._id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    backgroundColor:
                                      "var(--color-surface-hover)",
                                    padding: "0.6rem 1rem",
                                    borderRadius: "var(--radius-md)",
                                    gap: "1rem",
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: 600 }}>
                                      {p.name}
                                    </span>{" "}
                                    <span
                                      style={{
                                        fontSize: "0.8rem",
                                        color: "var(--color-text-muted)",
                                      }}
                                    >
                                      ({p.unit})
                                    </span>
                                  </div>

                                  {isPending && (
                                    <select
                                      value={
                                        assignments[
                                        `${job._id}-${p.parameterId._id}`
                                        ] || ""
                                      }
                                      onChange={(e) =>
                                        handleAssign(
                                          job._id,
                                          p.parameterId._id,
                                          e.target.value,
                                        )
                                      }
                                      required
                                      disabled={
                                        iAmChemical && !canChemicalDispatch
                                      }
                                      style={{
                                        minWidth: "180px",
                                        opacity:
                                          iAmChemical && !canChemicalDispatch
                                            ? 0.6
                                            : 1,
                                      }}
                                    >
                                      <option value="" disabled>
                                        Select Analyst...
                                      </option>
                                      {assistants.map((ast) => (
                                        <option key={ast._id} value={ast._id}>
                                          {ast.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Action Blocks based on Status */}
                            {isReviewing && (
                              <div
                                style={{
                                  textAlign: "center",
                                  padding: "1.5rem",
                                  borderTop: "1px solid var(--color-border)",
                                }}
                              >
                                <h3
                                  style={{
                                    color: "var(--color-warning)",
                                    marginBottom: "0.5rem",
                                    fontSize: "1.2rem",
                                  }}
                                >
                                  Approval Required
                                </h3>
                                <p
                                  style={{
                                    color: "var(--color-text-muted)",
                                    fontSize: "0.9rem",
                                    marginBottom: "1.5rem",
                                  }}
                                >
                                  Please review the job details and parameters
                                  above before approving. You must approve the
                                  job before analysts can be assigned.
                                </p>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "1rem",
                                    justifyContent: "center",
                                  }}
                                >
                                  <button
                                    onClick={async () => {
                                      try {
                                        await axios.put(
                                          `${API_URL}/api/jobs/${job._id}/approve-review`,
                                          {},
                                          {
                                            headers: {
                                              Authorization: `Bearer ${localStorage.getItem("token")}`,
                                            },
                                          },
                                        );
                                        invalidateCache(CACHE_KEYS.JOBS);
                                        fetchJobs();
                                      } catch (err) {
                                        alert(
                                          err.response?.data?.message ||
                                          "Error approving job",
                                        );
                                      }
                                    }}
                                    className="btn btn-success"
                                    style={{
                                      padding: "0.6rem 1.5rem",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                    }}
                                  >
                                    <ClipboardCheck size={18} /> Approve Job
                                  </button>
                                  <button
                                    onClick={() => {
                                      setReturnModalData({
                                        jobId: job._id,
                                        dept: dKey,
                                      });
                                      setReturnNote("");
                                    }}
                                    className="btn btn-secondary"
                                    style={{
                                      padding: "0.6rem 1.5rem",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                      color: "#B45309",
                                      border: "1px solid #F59E0B",
                                      backgroundColor: "#FFFBEB",
                                    }}
                                  >
                                    <RotateCcw size={18} /> Return Job
                                  </button>
                                </div>
                              </div>
                            )}

                            {isApproved && (
                              <div
                                style={{
                                  textAlign: "center",
                                  padding: "1.5rem",
                                  borderTop: "1px solid var(--color-border)",
                                }}
                              >
                                <h3
                                  style={{
                                    color: "var(--color-success)",
                                    marginBottom: "0.5rem",
                                    fontSize: "1.2rem",
                                  }}
                                >
                                  Approved by{" "}
                                  {dKey === "micro" ? "Micro" : "Chemical"}
                                </h3>
                                <p
                                  style={{
                                    color: "var(--color-text-muted)",
                                    fontSize: "0.9rem",
                                    marginBottom: "1.5rem",
                                  }}
                                >
                                  Waiting for the{" "}
                                  {otherKey === "micro" ? "Micro" : "Chemical"}{" "}
                                  department to approve their details before the
                                  job unlocks.
                                </p>
                                <button
                                  onClick={() => {
                                    setReturnModalData({
                                      jobId: job._id,
                                      dept: dKey,
                                    });
                                    setReturnNote("");
                                  }}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: "0.6rem 1.5rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    color: "#B45309",
                                    border: "1px solid #F59E0B",
                                    backgroundColor: "#FFFBEB",
                                    margin: "0 auto",
                                  }}
                                >
                                  <RotateCcw size={18} /> Return Job
                                </button>
                              </div>
                            )}

                            {isPending && (
                              <>
                                {iAmChemical && !canChemicalDispatch ? (
                                  (() => {
                                    // Determine if this job is the non-anchor sibling (should redirect to sibling for transfer)
                                    const siblingIsMultiDept =
                                      job.siblingJobId &&
                                      job.siblingJobId.distribution?.micro
                                        ?.required &&
                                      job.siblingJobId.distribution?.chemical
                                        ?.required;
                                    const isNonAnchor =
                                      job.sample?.nabl_type === "Non Nabl" &&
                                      siblingIsMultiDept;

                                    return (
                                      <div
                                        style={{
                                          textAlign: "center",
                                          padding: "1.5rem",
                                          borderTop:
                                            "1px solid var(--color-border)",
                                          backgroundColor:
                                            "var(--color-surface-hover)",
                                        }}
                                      >
                                        <h3
                                          style={{
                                            color: "var(--color-warning)",
                                            marginBottom: "0.5rem",
                                            fontSize: "1.1rem",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: "0.5rem",
                                          }}
                                        >
                                          <Lock size={18} /> Dispatch Locked
                                        </h3>
                                        {transferState ===
                                          "PENDING_APPROVAL" && (
                                            <p
                                              style={{
                                                color: "var(--color-text-muted)",
                                                fontSize: "0.9rem",
                                                marginBottom: 0,
                                              }}
                                            >
                                              Waiting for sibling job to be
                                              approved before transfer can begin.
                                            </p>
                                          )}
                                        {transferState ===
                                          "PENDING_TRANSFER" && (
                                            <p
                                              style={{
                                                color: "var(--color-text-muted)",
                                                fontSize: "0.9rem",
                                                marginBottom: 0,
                                              }}
                                            >
                                              {isNonAnchor
                                                ? `Please accept the sample transfer in the NABL sibling job (${job.siblingJobId?.jobCode || "sibling"}) first.`
                                                : "Waiting for Micro department to transfer the sample."}
                                            </p>
                                          )}
                                        {transferState === "IN_TRANSIT" && (
                                          <p
                                            style={{
                                              color: "var(--color-text-muted)",
                                              fontSize: "0.9rem",
                                              marginBottom: 0,
                                            }}
                                          >
                                            {isNonAnchor
                                              ? `Please accept the sample transfer in the NABL sibling job (${job.siblingJobId?.jobCode || "sibling"}) first.`
                                              : "Sample is in transit. Please confirm receipt from your dashboard above."}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <>
                                    {/* Bulk assign */}
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "1rem",
                                        borderTop:
                                          "1px solid var(--color-border)",
                                        paddingTop: "1.5rem",
                                      }}
                                    >
                                      <div></div>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "0.5rem",
                                        }}
                                      >
                                        <label
                                          style={{
                                            fontSize: "0.85rem",
                                            color: "var(--color-text-muted)",
                                          }}
                                        >
                                          Bulk assign all to:
                                        </label>
                                        <select
                                          onChange={(e) => {
                                            handleAssignAll(
                                              job._id,
                                              e.target.value,
                                              deptParams,
                                            );
                                            e.target.value = "";
                                          }}
                                          defaultValue=""
                                          style={{ minWidth: "150px" }}
                                        >
                                          <option value="" disabled>
                                            Select analyst...
                                          </option>
                                          {assistants.map((ast) => (
                                            <option
                                              key={ast._id}
                                              value={ast._id}
                                            >
                                              {ast.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    {/* Deadline + Submit */}
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "1rem",
                                        alignItems: "flex-end",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <div style={{ flex: "1 1 180px" }}>
                                        <label
                                          style={{
                                            display: "block",
                                            fontSize: "0.82rem",
                                            marginBottom: "0.4rem",
                                            fontWeight: 500,
                                            color: "var(--color-text-muted)",
                                          }}
                                        >
                                          Deadline Date{" "}
                                          <span
                                            style={{
                                              color: "var(--color-danger)",
                                            }}
                                          >
                                            *
                                          </span>
                                        </label>
                                        <input
                                          type="date"
                                          value={deadlineDates[job._id] || ""}
                                          onChange={(e) => {
                                            setDeadlineDates((prev) => ({
                                              ...prev,
                                              [job._id]: e.target.value,
                                            }));
                                            setDeadlineTimes((prev) => {
                                              if (
                                                !prev[job._id] &&
                                                e.target.value
                                              ) {
                                                return {
                                                  ...prev,
                                                  [job._id]: "17:00",
                                                };
                                              }
                                              return prev;
                                            });
                                          }}
                                          required
                                          style={{ width: "100%" }}
                                        />
                                      </div>
                                      <div style={{ flex: "1 1 130px" }}>
                                        <label
                                          style={{
                                            display: "block",
                                            fontSize: "0.82rem",
                                            marginBottom: "0.4rem",
                                            fontWeight: 500,
                                            color: "var(--color-text-muted)",
                                          }}
                                        >
                                          Due Time{" "}
                                          <span
                                            style={{
                                              color: "var(--color-danger)",
                                            }}
                                          >
                                            *
                                          </span>
                                        </label>
                                        <input
                                          type="time"
                                          value={deadlineTimes[job._id] || ""}
                                          onChange={(e) =>
                                            setDeadlineTimes((prev) => ({
                                              ...prev,
                                              [job._id]: e.target.value,
                                            }))
                                          }
                                          required
                                          style={{ width: "100%" }}
                                        />
                                      </div>
                                      <div
                                        style={{
                                          flex: "0 0 auto",
                                          display: "flex",
                                          gap: "0.5rem",
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => handleSubmit(job)}
                                          className="btn btn-primary"
                                          disabled={submittingJobId === job._id}
                                          style={{
                                            padding: "0.6rem 1.5rem",
                                            justifyContent: "center",
                                          }}
                                        >
                                          {submittingJobId === job._id ? (
                                            <Spinner
                                              size="sm"
                                              message="Dispatching..."
                                              color="#fff"
                                            />
                                          ) : (
                                            "Dispatch Job"
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CUSTOM CONFIRMATION MODAL ── */}
      {transferConfirmData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "450px",
              padding: "2rem",
              animation: "slideUp 0.3s ease",
              borderTop: "4px solid var(--color-primary)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1.5rem",
                color: "var(--color-primary)",
              }}
            >
              {transferConfirmData.type === "send" ? (
                <Send size={32} />
              ) : (
                <PackageCheck size={32} />
              )}
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
                {transferConfirmData.title}
              </h2>
            </div>

            <p
              style={{
                margin: "0 0 1.5rem 0",
                color: "var(--color-text-main)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {transferConfirmData.message}
            </p>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn"
                onClick={() => setTransferConfirmData(null)}
                style={{
                  border: "1px solid var(--color-primary)",
                  color: "var(--color-primary)",
                  padding: "0.6rem 2rem",
                  backgroundColor: "transparent",
                }}
                disabled={transferLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => executeTransfer()}
                style={{ padding: "0.6rem 2rem" }}
                disabled={transferLoading}
              >
                {transferLoading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Officer Modal */}
      {returnModalData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "2rem",
              animation: "slideUp 0.3s ease",
              borderTop: "4px solid #EF4444",
            }}
          >
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "#B45309",
                margin: "0 0 1rem 0",
                fontSize: "1.25rem",
              }}
            >
              <RotateCcw size={20} /> Return Job to Admin Officer
            </h2>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--color-text-muted)",
                marginBottom: "1.5rem",
                lineHeight: 1.5,
              }}
            >
              Please provide a clear reason for returning this job. The Admin
              Officer will see this note.
            </p>
            <form onSubmit={handleReturn}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    fontSize: "0.9rem",
                  }}
                >
                  Reason for Return{" "}
                  <span style={{ color: "var(--color-danger)" }}>*</span>
                </label>
                <textarea
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="e.g. Missing required test parameter, incorrect volume stated, etc."
                  rows="4"
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    resize: "vertical",
                  }}
                ></textarea>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "flex-end",
                  marginTop: "1.5rem",
                }}
              >
                <button
                  type="button"
                  className="btn"
                  style={{
                    border: "1px solid var(--color-border)",
                    padding: "0.6rem 1.5rem",
                  }}
                  onClick={() => setReturnModalData(null)}
                  disabled={isReturning}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    backgroundColor: "#EF4444",
                    border: "none",
                    padding: "0.6rem 1.5rem",
                  }}
                  disabled={isReturning || !returnNote.trim()}
                >
                  {isReturning ? (
                    <Spinner size="sm" color="#fff" />
                  ) : (
                    "Return Job"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Job Details Modal */}
      {detailsJob && (
        <JobDetailsModal job={detailsJob} onClose={() => setDetailsJob(null)} />
      )}
    </div>
  );
}

function ReviewQueue() {
  const { user } = useContext(AuthContext);
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [reassignNote, setReassignNote] = useState("");
  const [showReassignForm, setShowReassignForm] = useState(null); // instance._id when reassign mode is active
  const [success, setSuccess] = useState("");
  const [reviewLoading, setReviewLoading] = useState(
    () => !sessionStorage.getItem(CACHE_KEYS.INSTANCES),
  );
  const [assistants, setAssistants] = useState([]);
  const [submittingReviewId, setSubmittingReviewId] = useState(null);

  // Selective reassignment state: { [parameterId]: { selected: bool, assignedTo: userId } }
  const [paramSelections, setParamSelections] = useState({});

  const fetchReviewItems = async () => {
    try {
      await fetchWithCache(
        `${API_URL}/api/tests/instances`,
        CACHE_KEYS.INSTANCES,
        (data) =>
          setInstances(data.filter((i) => i.status === "PENDING_HEAD_REVIEW")),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setReviewLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewItems();
    // Fetch assistants in this department for the analyst dropdown
    fetchWithCache(`${API_URL}/api/users`, CACHE_KEYS.USERS, (data) =>
      setAssistants(
        data.filter(
          (u) => u.role === "ASSISTANT" && u.department === user.department,
        ),
      ),
    ).catch(console.error);
  }, []);

  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      invalidateCache(CACHE_KEYS.INSTANCES);
      fetchReviewItems();
    };

    socket.on("TEST_SUBMITTED", refresh);
    socket.on("TEST_REVIEWED", refresh);

    return () => {
      socket.off("TEST_SUBMITTED", refresh);
      socket.off("TEST_REVIEWED", refresh);
    };
  }, [socket]);

  const handleApprove = async (id) => {
    setSubmittingReviewId(id);
    try {
      await axios.put(`${API_URL}/api/tests/instances/${id}/review`, {
        action: "APPROVE",
      });
      setSuccess("Approved and Completed. Report Generated.");
      invalidateCache(CACHE_KEYS.INSTANCES);
      fetchReviewItems();
      setSelectedInstance(null);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReviewId(null);
    }
  };

  const enterReassignMode = (inst) => {
    setShowReassignForm(inst._id);
    const selections = {};
    inst.results.forEach((r) => {
      if (r.isPanel && r.panelName) {
        const pKey = `panel-${r.panelName.toLowerCase()}`;
        if (!selections[pKey]) {
          selections[pKey] = {
            selected: false,
            assignedTo:
              r.assignedTo || inst.assignedTo?._id || inst.assignedTo || "",
          };
        }
      } else {
        selections[r.parameterId] = {
          selected: false,
          assignedTo:
            r.assignedTo || inst.assignedTo?._id || inst.assignedTo || "",
        };
      }
    });
    setParamSelections(selections);
    setReassignNote("");
  };

  const exitReassignMode = () => {
    setShowReassignForm(null);
    setParamSelections({});
    setReassignNote("");
  };

  const toggleParamSelection = (parameterId) => {
    setParamSelections((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        selected: !prev[parameterId]?.selected,
      },
    }));
  };

  const changeParamAnalyst = (parameterId, analystId) => {
    setParamSelections((prev) => ({
      ...prev,
      [parameterId]: {
        ...prev[parameterId],
        assignedTo: analystId,
      },
    }));
  };

  const handleReassign = async (id) => {
    const inst = instances.find((j) => j._id === id);
    if (!inst) return;

    const selected = [];
    Object.entries(paramSelections).forEach(([key, v]) => {
      if (v.selected) {
        if (key.startsWith("panel-")) {
          const panelName = key.replace("panel-", "").toUpperCase();
          inst.results.forEach((r) => {
            if (r.isPanel && r.panelName === panelName) {
              selected.push({
                parameterId: r.parameterId,
                assignedTo: v.assignedTo,
              });
            }
          });
        } else {
          selected.push({ parameterId: key, assignedTo: v.assignedTo });
        }
      }
    });

    if (selected.length === 0) {
      return alert("Please select at least one parameter to reassign.");
    }

    setSubmittingReviewId(id);
    try {
      await axios.put(`${API_URL}/api/tests/instances/${id}/review`, {
        action: "REASSIGN",
        note: reassignNote,
        selectedParams: selected,
      });
      setSuccess(`Sent ${selected.length} parameter(s) for retest.`);
      exitReassignMode();
      invalidateCache(CACHE_KEYS.INSTANCES);
      fetchReviewItems();
      setSelectedInstance(null);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReviewId(null);
    }
  };

  const selectedCount = Object.values(paramSelections).filter(
    (v) => v.selected,
  ).length;

  return (
    <div>
      <h1
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <ClipboardCheck size={28} style={{ color: "var(--color-primary)" }} />{" "}
        Review Queue
      </h1>

      {success && (
        <div
          style={{
            position: "fixed",
            top: "6rem",
            right: "2rem",
            zIndex: 1000,
            color: "white",
            backgroundColor: "var(--color-success)",
            padding: "1rem 1.5rem",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <CheckCircle size={20} />
          <span style={{ fontWeight: 500 }}>{success}</span>
        </div>
      )}

      {reviewLoading && instances.length === 0 ? (
        <div className="card">
          <Spinner message="Loading review queue..." />
        </div>
      ) : instances.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--color-text-muted)",
          }}
        >
          No submissions awaiting your review.
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          {instances.map((inst) => {
            const isReassignMode = showReassignForm === inst._id;

            return (
              <div
                key={inst._id}
                className="card"
                style={{
                  borderLeft: `4px solid ${isReassignMode ? "var(--color-danger)" : "var(--color-warning)"}`,
                  padding: 0,
                  overflow: "hidden",
                  transition: "border-color 0.2s",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: "1.25rem 1.5rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--color-border)",
                    cursor: "pointer",
                    backgroundColor:
                      selectedInstance === inst._id
                        ? "var(--color-surface-hover)"
                        : "transparent",
                  }}
                  onClick={() =>
                    setSelectedInstance(
                      selectedInstance === inst._id ? null : inst._id,
                    )
                  }
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontFamily: "monospace", color: "var(--color-primary-dark)" }}>
                        {formatJobCode(inst.testCode)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--color-text-muted)",
                        marginTop: "0.3rem",
                      }}
                    >
                      Analyst: {inst.assignedTo?.name} · Client: {inst.clientName}
                    </div>
                  </div>
                  <span className="badge badge-warning">Awaiting Review</span>
                </div>

                {/* Expanded detail */}
                {selectedInstance === inst._id && (
                  <div style={{ padding: "1.5rem" }}>
                    {/* Review history */}
                    {inst.reviewHistory && inst.reviewHistory.length > 0 && (
                      <div
                        style={{
                          marginBottom: "1.5rem",
                          padding: "1rem",
                          backgroundColor: "rgba(241, 196, 15, 0.05)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-warning)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            marginBottom: "0.5rem",
                            fontSize: "0.85rem",
                            color: "var(--color-warning)",
                          }}
                        >
                          Previous Review History
                        </div>
                        {inst.reviewHistory.map((rh, i) => (
                          <div
                            key={i}
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--color-text-muted)",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <strong>{rh.role}</strong> {rh.action}{" "}
                            {rh.note && `("${rh.note}")`}{" "}
                            {new Date(rh.date).toLocaleString()}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sample Description (read-only) */}
                    {inst.sampleDescription && (
                      <div style={{
                        marginBottom: '1rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--color-surface-hover)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.875rem'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Sample Description
                        </div>
                        <div style={{ color: 'var(--color-text-main)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {inst.sampleDescription}
                        </div>
                      </div>
                    )}

                    {/* Testing Period */}
                    {inst.testingPeriod && inst.testingPeriod.startDate && (
                      <div
                        style={{
                          marginBottom: "1rem",
                          padding: "0.75rem",
                          backgroundColor: "var(--color-surface-hover)",
                          borderRadius: "var(--radius-md)",
                          fontSize: "0.85rem",
                        }}
                      >
                        <strong>Testing Period:</strong>{" "}
                        {new Date(
                          inst.testingPeriod.startDate,
                        ).toLocaleDateString("en-IN")}{" "}
                        to{" "}
                        {new Date(
                          inst.testingPeriod.endDate,
                        ).toLocaleDateString("en-IN")}
                      </div>
                    )}

                    {/* Reassign mode info banner */}
                    {isReassignMode && (
                      <div
                        style={{
                          marginBottom: "1rem",
                          padding: "0.75rem 1rem",
                          backgroundColor: "rgba(231, 76, 60, 0.06)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-danger)",
                          fontSize: "0.85rem",
                          color: "var(--color-danger)",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <RotateCcw size={16} />
                        Select the parameters that need retesting. You can
                        assign each to a different analyst.
                        {selectedCount > 0 && (
                          <span style={{ marginLeft: "auto", fontWeight: 700 }}>
                            {selectedCount} selected
                          </span>
                        )}
                      </div>
                    )}

                    {/* Results table */}
                    <h4 style={{ marginBottom: "0.75rem" }}>
                      Submitted Results
                    </h4>
                    <div className="table-scroll">
                      <table style={{ marginBottom: "1.5rem" }}>
                        <thead
                          style={{
                            backgroundColor: "var(--color-surface-hover)",
                          }}
                        >
                          <tr>
                            {isReassignMode && (
                              <th
                                style={{ width: "40px", textAlign: "center" }}
                              ></th>
                            )}
                            <th>Parameter</th>
                            <th>Value</th>
                            <th>Unit</th>
                            <th>Test Method</th>
                            <th>Specification</th>
                            {isReassignMode && <th>Assign To</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const displayResults = [];
                            const panelGroups = {};
                            inst.results.forEach((r) => {
                              if (r.isPanel && r.panelName) {
                                if (!panelGroups[r.panelName]) {
                                  panelGroups[r.panelName] = {
                                    parameterId: `panel-${r.panelName.toLowerCase()}`,
                                    name: `Pesticide Panel (${r.panelName})`,
                                    value: "Multiple",
                                    unit: "mg/kg",
                                    testMethod: "N/A",
                                    specification: "",
                                    isPanelGroup: true,
                                  };
                                  displayResults.push(panelGroups[r.panelName]);
                                }
                              } else {
                                displayResults.push(r);
                              }
                            });
                            return displayResults.map((r) => {
                              const sel = paramSelections[r.parameterId];
                              const isSelected = sel?.selected;

                              return (
                                <tr
                                  key={r.parameterId}
                                  onClick={
                                    isReassignMode
                                      ? () =>
                                        toggleParamSelection(r.parameterId)
                                      : undefined
                                  }
                                  style={{
                                    cursor: isReassignMode
                                      ? "pointer"
                                      : "default",
                                    backgroundColor: isSelected
                                      ? "rgba(231, 76, 60, 0.06)"
                                      : "transparent",
                                    transition: "background-color 0.15s",
                                  }}
                                >
                                  {isReassignMode && (
                                    <td style={{ textAlign: "center" }}>
                                      <input
                                        type="checkbox"
                                        checked={!!isSelected}
                                        onChange={() =>
                                          toggleParamSelection(r.parameterId)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          width: "16px",
                                          height: "16px",
                                          accentColor: "var(--color-danger)",
                                          cursor: "pointer",
                                        }}
                                      />
                                    </td>
                                  )}
                                  <td style={{ fontWeight: 500 }}>
                                    {r.name}
                                    {r.isPanelGroup && (
                                      <span
                                        style={{
                                          marginLeft: "0.5rem",
                                          fontSize: "0.7rem",
                                          padding: "0.1rem 0.3rem",
                                          backgroundColor: "#e0e7ff",
                                          color: "#3730a3",
                                          borderRadius: "4px",
                                        }}
                                      >
                                        PANEL
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    style={{
                                      fontFamily: "monospace",
                                      fontWeight: 600,
                                      color: isSelected
                                        ? "var(--color-danger)"
                                        : "var(--color-primary)",
                                    }}
                                  >
                                    {r.value || "—"}
                                  </td>
                                  <td>{r.unit}</td>
                                  <td style={{ fontSize: "0.85rem" }}>
                                    {r.testMethod || "N/A"}
                                  </td>
                                  <td style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
                                    {r.isPanelGroup ? "" : (r.specification || "")}
                                  </td>
                                  {isReassignMode && (
                                    <td onClick={(e) => e.stopPropagation()}>
                                      {isSelected ? (
                                        <select
                                          value={sel?.assignedTo || ""}
                                          onChange={(e) =>
                                            changeParamAnalyst(
                                              r.parameterId,
                                              e.target.value,
                                            )
                                          }
                                          style={{
                                            minWidth: "140px",
                                            fontSize: "0.85rem",
                                          }}
                                        >
                                          <option value="" disabled>
                                            Select Analyst...
                                          </option>
                                          {assistants.map((a) => (
                                            <option key={a._id} value={a._id}>
                                              {a.name}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: "0.8rem",
                                            color: "var(--color-text-muted)",
                                          }}
                                        >
                                          —
                                        </span>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Actions */}
                    {isReassignMode ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontWeight: 500,
                              marginBottom: "0.4rem",
                              fontSize: "0.9rem",
                            }}
                          >
                            Reason for Reassignment
                          </label>
                          <textarea
                            value={reassignNote}
                            onChange={(e) => setReassignNote(e.target.value)}
                            placeholder="Describe what needs to be corrected..."
                            style={{
                              width: "100%",
                              minHeight: "80px",
                              padding: "0.75rem",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-md)",
                              resize: "vertical",
                              fontFamily: "inherit",
                            }}
                          />
                        </div>
                        <div className="flex-row-responsive">
                          <button
                            onClick={() => handleReassign(inst._id)}
                            className="btn"
                            disabled={
                              selectedCount === 0 ||
                              submittingReviewId === inst._id
                            }
                            style={{
                              backgroundColor:
                                selectedCount > 0
                                  ? "var(--color-danger)"
                                  : "var(--color-border)",
                              color: "white",
                              border: "none",
                              opacity:
                                selectedCount === 0 ||
                                  submittingReviewId === inst._id
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            {submittingReviewId === inst._id ? (
                              <Spinner
                                size="sm"
                                message="Reassigning..."
                                color="#fff"
                              />
                            ) : (
                              <>
                                <RotateCcw
                                  size={16}
                                  style={{ marginRight: "0.5rem" }}
                                />{" "}
                                Reassign {selectedCount} Parameter
                                {selectedCount !== 1 ? "s" : ""}
                              </>
                            )}
                          </button>
                          <button
                            onClick={exitReassignMode}
                            className="btn"
                            style={{
                              border: "1px solid var(--color-border)",
                              backgroundColor: "transparent",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "1rem" }}>
                        <button
                          onClick={() => handleApprove(inst._id)}
                          disabled={submittingReviewId === inst._id}
                          className="btn btn-success"
                          style={{ flex: 1, justifyContent: "center" }}
                        >
                          {submittingReviewId === inst._id ? (
                            <Spinner
                              size="sm"
                              message="Processing..."
                              color="#fff"
                            />
                          ) : (
                            <>
                              <CheckCircle
                                size={16}
                                style={{ marginRight: "0.5rem" }}
                              />{" "}
                              Approve & Complete
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => enterReassignMode(inst)}
                          className="btn"
                          style={{
                            flex: 1,
                            justifyContent: "center",
                            backgroundColor: "var(--color-warning)",
                            color: "white",
                            border: "none",
                          }}
                        >
                          <RotateCcw
                            size={16}
                            style={{ marginRight: "0.5rem" }}
                          />{" "}
                          Reassign to Analyst
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HeadDashboard() {
  const { user } = useContext(AuthContext);

  // Robust secondary route guard
  if (!user || user.role !== "HEAD") {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/assistants" element={<Assistants />} />
      <Route path="/dispatcher" element={<Dispatcher />} />
      <Route path="/review" element={<ReviewQueue />} />
      <Route path="/audit" element={<Audit />} />
      <Route path="/data-settings" element={<DataSettings />} />
    </Routes>
  );
}

function Audit() {
  const [instances, setInstances] = useState([]);
  const [jobs, setJobs] = useState([]);
  const location = useLocation();
  const [auditLoading, setAuditLoading] = useState(
    () =>
      !sessionStorage.getItem(CACHE_KEYS.INSTANCES) ||
      !sessionStorage.getItem(CACHE_KEYS.JOBS),
  );

  const fetchData = async () => {
    try {
      const cachedInst = sessionStorage.getItem(CACHE_KEYS.INSTANCES);
      const cachedJobs = sessionStorage.getItem(CACHE_KEYS.JOBS);

      const processData = (allInstances, allJobs) => {
        const isJobFullyCompleted = (job) => {
          const microOk =
            !job.distribution?.micro?.required ||
            job.distribution.micro.status === "COMPLETED";
          const chemicalOk =
            !job.distribution?.chemical?.required ||
            job.distribution.chemical.status === "COMPLETED";
          return microOk && chemicalOk;
        };
        const fullyCompletedJobIds = new Set(
          allJobs.filter((j) => isJobFullyCompleted(j)).map((j) => j._id),
        );
        setInstances(
          allInstances.filter(
            (i) =>
              i.status === "COMPLETED" && fullyCompletedJobIds.has(i.jobId),
          ),
        );
        setJobs(allJobs);
      };

      if (cachedInst && cachedJobs) {
        processData(JSON.parse(cachedInst), JSON.parse(cachedJobs));
      }

      const [resInst, resJobs] = await Promise.all([
        axios.get(`${API_URL}/api/tests/instances`),
        axios.get(`${API_URL}/api/jobs`),
      ]);
      sessionStorage.setItem(
        CACHE_KEYS.INSTANCES,
        JSON.stringify(resInst.data),
      );
      sessionStorage.setItem(CACHE_KEYS.JOBS, JSON.stringify(resJobs.data));
      processData(resInst.data, resJobs.data);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h1
          style={{
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <FileText size={28} style={{ color: "var(--color-primary)" }} />{" "}
          Department Job Logs
        </h1>

        {auditLoading && jobs.length === 0 ? (
          <div className="card">
            <Spinner message="Loading logs..." />
          </div>
        ) : (
          <JobLogTable
            jobs={jobs}
            title="Lifecycle Tracker"
            defaultExpandedId={location.state?.expandJobId}
          />
        )}
      </div>

      <div>
        <h2
          style={{
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          Completed Activity
        </h2>
        <div
          className="card glass-panel"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <div className="table-scroll">
            <table>
              <thead style={{ backgroundColor: "var(--color-surface-hover)" }}>
                <tr>
                  <th>Test Code</th>
                  <th>Client Name</th>

                  <th>Analyst</th>
                  <th>Date Completed</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading && instances.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <Spinner message="Loading completed tests..." />
                    </td>
                  </tr>
                ) : instances.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{
                        textAlign: "center",
                        padding: "2rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      No completed tests in your department yet.
                    </td>
                  </tr>
                ) : (
                  instances.map((inst) => (
                    <tr key={inst._id}>
                      <td style={{ fontFamily: "monospace" }}>
                        {formatJobCode(inst.testCode)}
                      </td>
                      <td style={{ fontWeight: 500 }}>{inst.clientName}</td>

                      <td>{inst.assignedTo?.name}</td>
                      <td>
                        {new Date(inst.completedAt).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

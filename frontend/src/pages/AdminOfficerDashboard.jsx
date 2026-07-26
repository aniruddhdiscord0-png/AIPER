import React, { useState, useEffect, useContext } from "react";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import axios from "axios";
import {
  Trash2,
  Edit,
  Activity,
  Users as UsersIcon,
  Clock,
  CheckCircle,
  FileText,
  ClipboardCheck,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  X,
  Calendar,
  ArrowRightLeft,
  AlertTriangle,
  Repeat2,
} from "lucide-react";
import JobLogTable from "../components/JobLogTable";
import CascadingParameterSelector from "../components/CascadingParameterSelector";
import DataSettings from "./DataSettings";
import { AuthContext } from "../context/AuthContext";
import { fetchWithCache, invalidateCache, CACHE_KEYS } from "../utils/cache";
import Spinner from "../components/Spinner";
import { useSocket } from "../context/SocketContext";
import API_URL from "../utils/api";

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
        let jobsData, instancesData, usersData;

        // Use cache for initial render, then fetch fresh data in background
        const cachedJobs = sessionStorage.getItem(CACHE_KEYS.JOBS);
        const cachedInstances = sessionStorage.getItem(CACHE_KEYS.INSTANCES);
        const cachedUsers = sessionStorage.getItem(CACHE_KEYS.USERS);

        const computeStats = (jobs, instances, users) => {
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
          setStats({ ongoingJobs, completedJobs, activeAnalysts });
          setRecentActivity(
            [...instances]
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
              .slice(0, 5),
          );
        };

        // Instant render from cache
        if (cachedJobs && cachedInstances && cachedUsers) {
          computeStats(
            JSON.parse(cachedJobs),
            JSON.parse(cachedInstances),
            JSON.parse(cachedUsers),
          );
        }

        // Fetch fresh in background
        const [jobsRes, instancesRes, usersRes] = await Promise.all([
          axios.get(`${API_URL}/api/jobs`),
          axios.get(`${API_URL}/api/tests/instances`),
          axios.get(`${API_URL}/api/users`),
        ]);
        sessionStorage.setItem(CACHE_KEYS.JOBS, JSON.stringify(jobsRes.data));
        sessionStorage.setItem(
          CACHE_KEYS.INSTANCES,
          JSON.stringify(instancesRes.data),
        );
        sessionStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(usersRes.data));
        computeStats(jobsRes.data, instancesRes.data, usersRes.data);
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

function UserSection({
  title,
  users,
  isLoading,
  onEdit,
  onDelete,
  userToDelete,
  setUserToDelete,
  onConfirmDelete,
}) {
  return (
    <div style={{ marginBottom: "2.5rem" }}>
      <h3
        style={{
          marginBottom: "1rem",
          color: "var(--color-text-main)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <div
          style={{
            width: "4px",
            height: "1.5rem",
            backgroundColor: "var(--color-primary)",
            borderRadius: "var(--radius-full)",
          }}
        ></div>
        {title}
        <span
          className="badge badge-secondary"
          style={{ fontSize: "0.8rem", marginLeft: "0.5rem" }}
        >
          {users.length}
        </span>
      </h3>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading && users.length === 0 ? (
          <Spinner message={`Loading ${title.toLowerCase()}...`} />
        ) : users.length === 0 ? (
          <div
            style={{
              padding: "2.5rem",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No {title.toLowerCase()} currently registered in the system.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead style={{ backgroundColor: "var(--color-surface-hover)" }}>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span
                        className={`badge ${u.role === "HEAD" ? "badge-warning" : "badge-success"}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td>{u.department || "N/A"}</td>
                    <td>
                      {userToDelete && userToDelete._id === u._id ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--color-danger)",
                            }}
                          >
                            Sure?
                          </span>
                          <button
                            onClick={async () => {
                              await onConfirmDelete(u._id);
                              setUserToDelete(null);
                            }}
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
                            onClick={() => onEdit(u)}
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
                            onClick={() => setUserToDelete(u)}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "HEAD",
    department: "Micro",
    branch: "Main Branch",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [usersLoading, setUsersLoading] = useState(
    () => !sessionStorage.getItem(CACHE_KEYS.USERS),
  );

  const fetchUsers = async () => {
    try {
      await fetchWithCache(`${API_URL}/api/users`, CACHE_KEYS.USERS, (data) =>
        setUsers(
          data.filter((u) => u.role !== "ADMIN" && u.role !== "ADMIN_OFFICER"),
        ),
      );
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
        setSuccess("User updated successfully.");
      } else {
        const res = await axios.post(`${API_URL}/api/users`, formData);
        setSuccess(
          `User created successfully. Temporary password is: ${res.data.temporaryPassword}`,
        );
      }
      setFormData({
        name: "",
        email: "",
        phone: "",
        role: "HEAD",
        department: "Micro",
        branch: "Main Branch",
        password: "",
      });
      setEditUserId(null);
      setShowForm(false);
      invalidateCache(CACHE_KEYS.USERS);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Operation failed");
    }
  };

  const handleEdit = (u) => {
    setFormData({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      department: u.department,
      branch: u.branch,
      password: "",
    });
    setEditUserId(u._id);
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const confirmDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/users/${id}`);
      invalidateCache(CACHE_KEYS.USERS);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setError("Failed to delete user");
    }
  };

  const headUsers = users.filter((u) => u.role === "HEAD");
  const assistantUsers = users.filter((u) => u.role === "ASSISTANT");

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
        <h1>User Management</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) setEditUserId(null);
          }}
        >
          {showForm ? "Close Form" : "+ Create User"}
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

      {showForm && (
        <div className="card" style={{ marginBottom: "2.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>
            {editUserId ? "Edit User" : "Create User"}
          </h3>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div className="flex-row-responsive">
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
                />
              </div>
            </div>
            <div className="flex-row-responsive">
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
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.9rem",
                    marginBottom: "0.4rem",
                    fontWeight: 500,
                  }}
                >
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  required
                >
                  <option value="HEAD">Department Head</option>
                  <option value="ASSISTANT">Lab Assistant</option>
                </select>
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
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  required
                >
                  <option value="Micro">Micro</option>
                  <option value="Chemical">Chemical</option>
                </select>
              </div>
            </div>
            {!editUserId && (
              <div className="flex-row-responsive">
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
              </div>
            )}
            <div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: "0.5rem" }}
              >
                {editUserId ? "Update User" : "Submit & Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      <UserSection
        title="Department Heads"
        users={headUsers}
        isLoading={usersLoading}
        onEdit={handleEdit}
        onConfirmDelete={confirmDelete}
        userToDelete={userToDelete}
        setUserToDelete={setUserToDelete}
      />

      <UserSection
        title="Lab Assistants"
        users={assistantUsers}
        isLoading={usersLoading}
        onEdit={handleEdit}
        onConfirmDelete={confirmDelete}
        userToDelete={userToDelete}
        setUserToDelete={setUserToDelete}
      />
    </div>
  );
}

const BLANK_FORM = {
  // Customer
  customer_name: "",
  customer_address: "",
  contact_person: "",
  mobile_number: "",
  email: "",
  customer_reference_no: "",
  batch_no: "",
  dom: "",
  brand_name: "",
  any_other_info: "",
  batch_size: "",
  doe: "",
  // Sample
  sample_name: "",
  sample_id: "",
  sample_quantity: "",
  sample_quantity_unit: "ml",
  sample_count: 1,

  condition_on_receipt: "",
  packing_details: "",
  marking_seal: "",
  sample_source: "",
  received_date_dd: "",
  received_date_mm: "",
  received_date_yyyy: "",
  received_mode: "Select",
  nabl_mode: "non_nabl",
  // Compliance
  statement_of_conformity: "",
  decision_rule: "",
  accreditation_scope: "",
  disclaimer_notes: "",
  special_handling_instructions: "",
};

// Helper: same format as backend buildJobCode — YYMMDD + 4-digit padded serial
// Accepts an optional YYYY-MM-DD date string to override the date prefix.
function buildJobCodePreview(serial, dateStr) {
  if (!serial) return "…";
  const nn = String(serial).slice(-4).padStart(4, "0");
  if (dateStr) {
    const [yyyy, mm, dd] = dateStr.split("-");
    const yy = String(yyyy).slice(2);
    return `${yy}${mm}${dd}${nn}`;
  }
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}${nn}`;
}

// Returns today's date as YYYY-MM-DD in IST (UTC+5:30)
function getISTDateString() {
  const now = new Date();
  // Offset IST = UTC + 5h30m = 330 minutes
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Standard unit options for each department type
const MICRO_UNITS = [
  "CFU/g",
  "CFU/ml",
  "Present per g",
  "Present per 5 g",
  "Present per 10 g",
  "Present per 25 g",
  "Present per ml",
  "Present per 5 ml",
  "Present per 10 ml",
  "Present per 25 ml",
  "Present per 100 ml",
  "Present per 250 ml",
  "Absent per g",
  "Absent per 5 g",
  "Absent per 10 g",
  "Absent per 25 g",
  "Absent per ml",
  "Absent per 5 ml",
  "Absent per 10 ml",
  "Absent per 25 ml",
  "Absent per 100 ml",
  "Absent per 250 ml",
];

const CHEMICAL_UNITS = [
  "%",
  "mg/L",
  "mg/kg",
  "mg/100g",
  "g/100g",
  "µg/kg",
  "µg/100g",
  "mg KOH/g",
  "mEq O₂/kg",
  "g I₂/100g",
  "kcal/100g",
  "pH units",
  "Aw",
  "°Bx",
  "ppm",
];

function Jobs() {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_FORM");
    return saved ? JSON.parse(saved) : { ...BLANK_FORM, reopenReason: "" };
  });
  const [customCreationDate, setCustomCreationDate] = useState(getISTDateString);
  const [sections, setSections] = useState({
    customer: true,
    sample: false,
    compliance: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextSerial, setNextSerial] = useState(null);
  const [reopenParentId, setReopenParentId] = useState(null);
  const [editingJobId, setEditingJobId] = useState(null);
  const [isEditingReturnedJob, setIsEditingReturnedJob] = useState(false);
  const [isJobFullyComplete, setIsJobFullyComplete] = useState(false);
  const [originalEditParams, setOriginalEditParams] = useState(null); // snapshot for param diff
  const [isFormClosing, setIsFormClosing] = useState(false);
  const [retainForm, setRetainForm] = useState(false);
  const [selectorResetKey, setSelectorResetKey] = useState(0);

  // Parameter State - Cascading Selector
  const [selectedParams, setSelectedParams] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_SELECTED_PARAMS");
    return saved ? JSON.parse(saved) : [];
  });
  const [showSpecifications, setShowSpecifications] = useState(false);
  const [groupMetadata, setGroupMetadata] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_METADATA");
    return saved ? JSON.parse(saved) : null;
  });
  const [pesticidePanel, setPesticidePanel] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_PESTICIDE");
    return saved ? JSON.parse(saved) : { enabled: false, panelType: null };
  });

  const [nablParams, setNablParams] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_NABL_PARAMS");
    return saved ? JSON.parse(saved) : [];
  });
  const [nablShowSpecifications, setNablShowSpecifications] = useState(false);
  const [nablGroupMetadata, setNablGroupMetadata] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_NABL_METADATA");
    return saved ? JSON.parse(saved) : null;
  });
  const [nablPesticidePanel, setNablPesticidePanel] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_NABL_PESTICIDE");
    return saved ? JSON.parse(saved) : { enabled: false, panelType: null };
  });

  const [nonNablParams, setNonNablParams] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_NON_NABL_PARAMS");
    return saved ? JSON.parse(saved) : [];
  });
  const [nonNablShowSpecifications, setNonNablShowSpecifications] =
    useState(false);
  const [nonNablGroupMetadata, setNonNablGroupMetadata] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_NON_NABL_METADATA");
    return saved ? JSON.parse(saved) : null;
  });
  const [nonNablPesticidePanel, setNonNablPesticidePanel] = useState(() => {
    const saved = sessionStorage.getItem("DRAFT_JOB_NON_NABL_PESTICIDE");
    return saved ? JSON.parse(saved) : { enabled: false, panelType: null };
  });
  const [ulrPreview, setUlrPreview] = useState("");

  // Fix 2: Shared group data — fetched once, passed to all CascadingParameterSelector instances
  const [allGroupData, setAllGroupData] = useState(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteConfirmJobId, setDeleteConfirmJobId] = useState(null);
  const [heads, setHeads] = useState([]);
  const [assignedMicroHead, setAssignedMicroHead] = useState("");
  const [assignedChemicalHead, setAssignedChemicalHead] = useState("");

  const toggleSection = (s) =>
    setSections((prev) => ({ ...prev, [s]: !prev[s] }));
  const setField = (key, val) =>
    setFormData((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    if (!showForm && !editingJobId) return;
    sessionStorage.setItem("DRAFT_JOB_FORM", JSON.stringify(formData));
    sessionStorage.setItem(
      "DRAFT_JOB_SELECTED_PARAMS",
      JSON.stringify(selectedParams),
    );
    sessionStorage.setItem("DRAFT_JOB_METADATA", JSON.stringify(groupMetadata));
    sessionStorage.setItem(
      "DRAFT_JOB_PESTICIDE",
      JSON.stringify(pesticidePanel),
    );
    sessionStorage.setItem("DRAFT_JOB_NABL_PARAMS", JSON.stringify(nablParams));
    sessionStorage.setItem(
      "DRAFT_JOB_NABL_METADATA",
      JSON.stringify(nablGroupMetadata),
    );
    sessionStorage.setItem(
      "DRAFT_JOB_NABL_PESTICIDE",
      JSON.stringify(nablPesticidePanel),
    );
    sessionStorage.setItem(
      "DRAFT_JOB_NON_NABL_PARAMS",
      JSON.stringify(nonNablParams),
    );
    sessionStorage.setItem(
      "DRAFT_JOB_NON_NABL_METADATA",
      JSON.stringify(nonNablGroupMetadata),
    );
    sessionStorage.setItem(
      "DRAFT_JOB_NON_NABL_PESTICIDE",
      JSON.stringify(nonNablPesticidePanel),
    );
  }, [
    formData,
    selectedParams,
    groupMetadata,
    pesticidePanel,
    nablParams,
    nablGroupMetadata,
    nablPesticidePanel,
    nonNablParams,
    nonNablGroupMetadata,
    nonNablPesticidePanel,
    showForm,
    editingJobId,
  ]);

  const clearDraft = () => {
    if (
      window.confirm("Are you sure you want to completely clear this draft?")
    ) {
      sessionStorage.removeItem("DRAFT_JOB_FORM");
      sessionStorage.removeItem("DRAFT_JOB_SELECTED_PARAMS");
      sessionStorage.removeItem("DRAFT_JOB_METADATA");
      sessionStorage.removeItem("DRAFT_JOB_PESTICIDE");
      sessionStorage.removeItem("DRAFT_JOB_NABL_PARAMS");
      sessionStorage.removeItem("DRAFT_JOB_NABL_METADATA");
      sessionStorage.removeItem("DRAFT_JOB_NABL_PESTICIDE");
      sessionStorage.removeItem("DRAFT_JOB_NON_NABL_PARAMS");
      sessionStorage.removeItem("DRAFT_JOB_NON_NABL_METADATA");
      sessionStorage.removeItem("DRAFT_JOB_NON_NABL_PESTICIDE");
      setFormData({ ...BLANK_FORM, reopenReason: "" });
      setSelectedParams([]);
      setGroupMetadata(null);
      setPesticidePanel({ enabled: false, panelType: null });
      setNablParams([]);
      setNablGroupMetadata(null);
      setNablPesticidePanel({ enabled: false, panelType: null });
      setNonNablParams([]);
      setNonNablGroupMetadata(null);
      setNonNablPesticidePanel({ enabled: false, panelType: null });
      setSelectorResetKey(k => k + 1);
    }
  };

  const fetchJobs = async () => {
    try {
      await fetchWithCache(`${API_URL}/api/jobs?includeCancelled=true`, CACHE_KEYS.JOBS, setJobs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHeads = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users`);
      const allHeads = res.data.filter((u) => u.role === "HEAD");
      setHeads(allHeads);

      // Auto-select defaults
      const micro = allHeads.filter((h) => h.department === "Micro");
      if (micro.length > 0) setAssignedMicroHead(micro[0]._id);
      const chemical = allHeads.filter((h) => h.department === "Chemical");
      if (chemical.length > 0) setAssignedChemicalHead(chemical[0]._id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNextSerial = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/jobs/next-sample-id`);
      setNextSerial(res.data);
      if (!reopenParentId) {
        setFormData((prev) => ({ ...prev, sample_id: res.data.padded }));
      }
    } catch (err) {
      console.error("Could not fetch next sample ID", err);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const triggerUpdate = () => {
      invalidateCache(CACHE_KEYS.JOBS);
      invalidateCache(CACHE_KEYS.INSTANCES);
      fetchJobs();
      // fetchStats is defined in another useEffect but it has its own dependency array...
      // Actually, since invalidateCache forces a fresh fetch, window.location.reload() might be safest or we just call fetchJobs.
      // Wait, we can't call fetchStats from here if it's trapped in a closure.
      // Let's just do a fetchJobs() and that updates the table.
    };

    socket.on("JOB_CREATED", triggerUpdate);
    socket.on("JOB_RETEST_INITIATED", triggerUpdate);
    socket.on("TRANSFER_INITIATED", triggerUpdate);
    socket.on("TRANSFER_RECEIVED", triggerUpdate);
    socket.on("TEST_SUBMITTED", triggerUpdate);
    socket.on("TEST_REVIEWED", triggerUpdate);
    socket.on("JOB_UPDATED", triggerUpdate);
    socket.on("JOB_RETURNED", triggerUpdate);
    socket.on("JOB_DELETED", triggerUpdate);

    return () => {
      socket.off("JOB_CREATED", triggerUpdate);
      socket.off("JOB_RETEST_INITIATED", triggerUpdate);
      socket.off("TRANSFER_INITIATED", triggerUpdate);
      socket.off("TRANSFER_RECEIVED", triggerUpdate);
      socket.off("TEST_SUBMITTED", triggerUpdate);
      socket.off("TEST_REVIEWED", triggerUpdate);
      socket.off("JOB_UPDATED", triggerUpdate);
      socket.off("JOB_RETURNED", triggerUpdate);
      socket.off("JOB_DELETED", triggerUpdate);
    };
  }, [socket]);

  useEffect(() => {
    fetchJobs();
    fetchNextSerial();
    fetchHeads();
    // Fetch group data once for all CascadingParameterSelector instances
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_URL}/api/parameter-groups/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAllGroupData(res.data || []);
      } catch (err) {
        console.error("Failed to fetch group data", err);
      }
    })();
  }, []);

  const fetchUlrPreview = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/jobs/next-ulr`);
      setUlrPreview(res.data.nextUlr);
    } catch (err) {
      console.error("Could not fetch next ULR", err);
    }
  };

  useEffect(() => {
    if (formData.nabl_mode === "nabl" || formData.nabl_mode === "hybrid") {
      fetchUlrPreview();
    }
  }, [formData.nabl_mode]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowConfirmModal(false);
        setDeleteConfirmJobId(null);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (showConfirmModal) {
          executeSubmit();
          return;
        }
        if (deleteConfirmJobId) {
          executeDelete();
          return;
        }

        const activeForm = document.querySelector("form:focus-within");
        if (activeForm) {
          const submitEvent = new Event("submit", {
            cancelable: true,
            bubbles: true,
          });
          activeForm.dispatchEvent(submitEvent);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmModal, deleteConfirmJobId]);

  // Handle incoming Reopen request from JobLogTable
  useEffect(() => {
    if (location.state?.reopenJob) {
      const j = location.state.reopenJob;
      populateFormFromJob(j);
      setReopenParentId(j._id);
      window.history.replaceState({}, document.title);
      // Scroll both window and the layout container (overflow-y: auto)
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.querySelector(".layout-content")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.state]);

  const populateFormFromJob = (j) => {
    setFormData({
      ...BLANK_FORM,
      customer_name: j.clientName || "",
      customer_address: j.customer?.customer_address || "",
      contact_person: j.customer?.contact_person || "",
      mobile_number: j.customer?.mobile_number || "",
      email: j.customer?.email || "",
      customer_reference_no: j.customer?.customer_reference_no || "",
      batch_no: j.customer?.batch_no || "",
      dom: j.customer?.dom || "",
      brand_name: j.customer?.brand_name || "",
      any_other_info: j.customer?.any_other_info || "",
      batch_size: j.customer?.batch_size || "",
      doe: j.customer?.doe || "",
      sample_name: j.sample?.sample_name || "",
      sample_id: j.sample?.sample_id || "",
      sample_quantity: j.sample?.sample_quantity?.split(" ")[0] || "",
      sample_quantity_unit: j.sample?.sample_quantity?.split(" ")[1] || "ml",
      sample_count: j.sample?.sample_count || 1,

      condition_on_receipt: j.sample?.condition_on_receipt || "",
      packing_details: j.sample?.packing_details || "",
      marking_seal: j.sample?.marking_seal || "",
      sample_source: j.sample?.sample_source || "",
      received_date_dd: j.sample?.received_date
        ? new Date(j.sample.received_date).getDate().toString().padStart(2, "0")
        : "",
      received_date_mm: j.sample?.received_date
        ? (new Date(j.sample.received_date).getMonth() + 1)
            .toString()
            .padStart(2, "0")
        : "",
      received_date_yyyy: j.sample?.received_date
        ? new Date(j.sample.received_date).getFullYear().toString()
        : "",
      received_mode: j.sample?.received_mode || "Select",
      nabl_mode: j.sample?.nabl_type === "Nabl" ? "nabl" : "non_nabl",
      nabl_type: j.sample?.nabl_type || "",
      ulr_no: j.sample?.ulr_no || "",
      test_parameters: j.sample?.test_parameters || [],
      statement_of_conformity: j.compliance?.statement_of_conformity || "",
      decision_rule: j.compliance?.decision_rule || "",
      accreditation_scope: j.compliance?.accreditation_scope || "",
      disclaimer_notes: j.compliance?.disclaimer_notes || "",
      special_handling_instructions:
        j.compliance?.special_handling_instructions || "",
      reopenReason: "",
    });
    // Restore the job's original creation date.
    // Priority: customCreationDate field → date parsed from jobCode → today
    let restoredDate = getISTDateString();
    if (j.customCreationDate) {
      restoredDate = new Date(j.customCreationDate).toISOString().split('T')[0];
    } else if (j.jobCode && j.jobCode.length >= 6) {
      // Parse YYMMDD from the start of the job code (e.g. "2607211660" → 2026-07-21)
      const yy = j.jobCode.slice(0, 2);
      const mm = j.jobCode.slice(2, 4);
      const dd = j.jobCode.slice(4, 6);
      restoredDate = `20${yy}-${mm}-${dd}`;
    }
    setCustomCreationDate(restoredDate);

    const mapParams = (params) => {
      if (!params) return [];
      return params.map((p) => {
        // If populated, parameterId is an object. Extract it cleanly.
        const id =
          p.parameterId && p.parameterId._id
            ? p.parameterId._id
            : p.parameterId;
        return {
          _id: id,
          parameterId: id,
          name: p.name,
          unit: p.unit,
          type: p.type,
        };
      });
    };

    // Set standard parameter states
    setSelectedParams(mapParams(j.parameters));
    setShowSpecifications(!!j.showSpecifications);
    setGroupMetadata(j.groupMetadata || null);
    setPesticidePanel(j.pesticidePanel || { enabled: false, panelType: null });

    setNablParams(mapParams(j.nablParameters || j.parameters)); // Fallback to parameters for hybrid editing logic
    setNablShowSpecifications(
      !!j.nablShowSpecifications || !!j.showSpecifications,
    );
    setNablGroupMetadata(j.nablGroupMetadata || j.groupMetadata || null);
    setNablPesticidePanel(
      j.nablPesticidePanel ||
        j.pesticidePanel || { enabled: false, panelType: null },
    );

    setNonNablParams(mapParams(j.nonNablParameters || j.parameters)); // Fallback
    setNonNablShowSpecifications(
      !!j.nonNablShowSpecifications || !!j.showSpecifications,
    );
    setNonNablGroupMetadata(j.nonNablGroupMetadata || j.groupMetadata || null);
    setNonNablPesticidePanel(
      j.nonNablPesticidePanel ||
        j.pesticidePanel || { enabled: false, panelType: null },
    );

    setShowForm(true);
    setSections({ customer: true, sample: true, compliance: true });
  };

  const handleEditJob = (job) => {
    populateFormFromJob(job);
    setEditingJobId(job._id);

    const isReturned =
      job.distribution?.micro?.status === "RETURNED" ||
      job.distribution?.chemical?.status === "RETURNED";
    setIsEditingReturnedJob(isReturned);

    // Check if the entire job is fully complete (both depts done = immutable)
    const isMicroDone = !job.distribution?.micro?.required || job.distribution?.micro?.status === 'COMPLETED';
    const isChemDone = !job.distribution?.chemical?.required || job.distribution?.chemical?.status === 'COMPLETED';
    setIsJobFullyComplete(isMicroDone && isChemDone);

    // Snapshot current params for diff detection in the confirmation modal
    setOriginalEditParams(
      (job.parameters || []).map(p => (p._id || p.parameterId)?.toString()).filter(Boolean)
    );

    setReopenParentId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector(".layout-content")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Closes the form with an exit animation before unmounting
  const closeForm = (callback) => {
    setIsFormClosing(true);
    // Duration matches the formCollapse animation (280ms)
    setTimeout(() => {
      setShowForm(false);
      setIsFormClosing(false);
      if (callback) callback();
    }, 280);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    if (formData.nabl_mode === "hybrid") {
      if (nablParams.length === 0 && !nablPesticidePanel?.enabled) {
        alert(
          "NABL job must have at least one Test Parameter or a Pesticide Panel.",
        );
        return;
      }
      if (nonNablParams.length === 0 && !nonNablPesticidePanel?.enabled) {
        alert(
          "Non-NABL job must have at least one Test Parameter or a Pesticide Panel.",
        );
        return;
      }
      const missingNablUnit = nablParams.find((p) => !p.unit || !p.unit.trim());
      if (missingNablUnit) {
        alert(
          `Please select a unit for NABL parameter "${missingNablUnit.name}"`,
        );
        return;
      }
      const missingNonNablUnit = nonNablParams.find(
        (p) => !p.unit || !p.unit.trim(),
      );
      if (missingNonNablUnit) {
        alert(
          `Please select a unit for Non-NABL parameter "${missingNonNablUnit.name}"`,
        );
        return;
      }
    } else {
      if (selectedParams.length === 0 && !pesticidePanel?.enabled) {
        alert(
          "Please add at least one Test Parameter or a Pesticide Panel before submitting.",
        );
        return;
      }
      const missingUnit = selectedParams.find((p) => !p.unit || !p.unit.trim());
      if (missingUnit) {
        alert(`Please select a unit for parameter "${missingUnit.name}"`);
        return;
      }
    }

    if (reopenParentId && !formData.reopenReason?.trim()) {
      alert("Reason for reopening is required");
      return;
    }

    const { received_date_dd, received_date_mm, received_date_yyyy } = formData;
    const dInt = parseInt(received_date_dd, 10);
    const mInt = parseInt(received_date_mm, 10);
    const yInt = parseInt(received_date_yyyy, 10);
    const dateObj = new Date(yInt, mInt - 1, dInt);
    if (
      dateObj.getFullYear() !== yInt ||
      dateObj.getMonth() !== mInt - 1 ||
      dateObj.getDate() !== dInt
    ) {
      alert("Please enter a strictly valid Received Date.");
      return;
    }

    // If all valid, show confirmation modal
    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const { received_date_dd, received_date_mm, received_date_yyyy } =
        formData;
      const yInt = parseInt(received_date_yyyy, 10);
      const mInt = parseInt(received_date_mm, 10);
      const dInt = parseInt(received_date_dd, 10);
      const parsedDate = `${yInt}-${String(mInt).padStart(2, "0")}-${String(dInt).padStart(2, "0")}`;

      const parameters = selectedParams.map((p) => ({
        parameterId: p._id || p.parameterId,
        name: p.name,
        type: p.type,
        unit: p.unit,
        specification: p.specification || "",
      }));
      const nablParametersData = nablParams.map((p) => ({
        parameterId: p._id || p.parameterId,
        name: p.name,
        type: p.type,
        unit: p.unit,
        specification: p.specification || "",
      }));
      const nonNablParametersData = nonNablParams.map((p) => ({
        parameterId: p._id || p.parameterId,
        name: p.name,
        type: p.type,
        unit: p.unit,
        specification: p.specification || "",
      }));

      const payload = {
        nablMode: formData.nabl_mode,
        customer: {
          customer_name: formData.customer_name,
          customer_address: formData.customer_address,
          contact_person: formData.contact_person,
          mobile_number: formData.mobile_number,
          email: formData.email,
          customer_reference_no: formData.customer_reference_no,
          batch_no: formData.batch_no,
          dom: formData.dom,
          brand_name: formData.brand_name,
          any_other_info: formData.any_other_info,
          batch_size: formData.batch_size,
          doe: formData.doe,
        },
        sample: {
          sample_name: formData.sample_name,
          sample_id: formData.sample_id,
          sample_quantity:
            `${formData.sample_quantity} ${formData.sample_quantity_unit}`.trim(),
          sample_count: parseInt(formData.sample_count) || 1,

          condition_on_receipt: formData.condition_on_receipt,
          packing_details: formData.packing_details,
          marking_seal: formData.marking_seal,
          sample_source: formData.sample_source,
          received_date: parsedDate,
          received_mode:
            formData.received_mode === "Select"
              ? undefined
              : formData.received_mode,
        },
        compliance: {
          statement_of_conformity: formData.statement_of_conformity,
          decision_rule: formData.decision_rule,
          accreditation_scope: formData.accreditation_scope,
          disclaimer_notes: formData.disclaimer_notes,
          special_handling_instructions: formData.special_handling_instructions,
        },
        parameters,
        nablParameters: nablParametersData,
        nonNablParameters: nonNablParametersData,
        groupMetadata,
        pesticidePanel,
        nablGroupMetadata,
        nablPesticidePanel,
        nonNablGroupMetadata,
        nonNablPesticidePanel,
        assignedMicroHead,
        assignedChemicalHead,
        showSpecifications,
        nablShowSpecifications,
        nonNablShowSpecifications,
        sampleFlow: {},
        customCreationDate: customCreationDate || undefined,
      };

      if (editingJobId) {
        // Editing existing job
        await axios.put(`${API_URL}/api/jobs/${editingJobId}`, payload);
      } else if (reopenParentId) {
        // Reopening / retesting
        payload.reopenReason = formData.reopenReason;
        await axios.post(
          `${API_URL}/api/jobs/${reopenParentId}/retest`,
          payload,
        );
      } else {
        // Creating new job
        await axios.post(`${API_URL}/api/jobs`, payload);
      }

      if (retainForm && !editingJobId && !reopenParentId) {
        // Keep form populated, just reset job-specific state and refresh sample ID
        setEditingJobId(null);
        setReopenParentId(null);
        setIsEditingReturnedJob(false);
        setAssignedMicroHead("");
        setAssignedChemicalHead("");
        // Re-select default heads
        const micro = heads.filter((h) => h.department === "Micro");
        if (micro.length > 0) setAssignedMicroHead(micro[0]._id);
        const chemical = heads.filter((h) => h.department === "Chemical");
        if (chemical.length > 0) setAssignedChemicalHead(chemical[0]._id);
        // Note: customCreationDate is intentionally kept so batch backdated jobs
        // don't require the user to re-select the date on every submission.
      } else {
        setShowForm(false);
        setFormData({ ...BLANK_FORM, reopenReason: "" });
        setCustomCreationDate(getISTDateString());
        setReopenParentId(null);
        setEditingJobId(null);
        setIsEditingReturnedJob(false);
        setIsJobFullyComplete(false);
        setOriginalEditParams(null);
        setSelectedParams([]);
        setShowSpecifications(false);
        setGroupMetadata(null);
        setPesticidePanel({ enabled: false, panelType: null });
        setNablParams([]);
        setNablShowSpecifications(false);
        setNablGroupMetadata(null);
        setNablPesticidePanel({ enabled: false, panelType: null });
        setNonNablParams([]);
        setNonNablShowSpecifications(false);
        setNonNablGroupMetadata(null);
        setNonNablPesticidePanel({ enabled: false, panelType: null });
        setAssignedMicroHead("");
        setAssignedChemicalHead("");
      }
      invalidateCache(CACHE_KEYS.JOBS);
      fetchJobs();
      fetchNextSerial();
    } catch (err) {
      console.error(err);
      alert(
        "Error saving job: " + (err.response?.data?.message || err.message),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteJob = (jobId) => {
    setDeleteConfirmJobId(jobId);
  };

  const executeCancelJob = async () => {
    if (!deleteConfirmJobId) return;
    try {
      await axios.put(
        `${API_URL}/api/jobs/${deleteConfirmJobId}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      invalidateCache(CACHE_KEYS.JOBS);
      fetchJobs();
      setDeleteConfirmJobId(null);
    } catch (err) {
      console.error(err);
      alert(
        "Error cancelling job: " + (err.response?.data?.message || err.message),
      );
    }
  };

  const allParamsForFlow =
    formData.nabl_mode === "hybrid"
      ? [...nablParams, ...nonNablParams]
      : selectedParams;
  const needsMicro = allParamsForFlow.some((p) => p.type === "Micro");
  const needsChemical = allParamsForFlow.some((p) => p.type === "Chemical");

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
        <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Activity size={28} style={{ color: "var(--color-primary)" }} />
          {editingJobId
            ? "Edit Job"
            : reopenParentId
              ? "Retest / Reopen Job"
              : "Job Distributor"}
        </h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (showForm) {
                // Close with animation
                closeForm(() => {
                  setReopenParentId(null);
                  setEditingJobId(null);
                  setIsEditingReturnedJob(false);
                  setIsJobFullyComplete(false);
                  setOriginalEditParams(null);
                  setAssignedMicroHead("");
                  setAssignedChemicalHead("");
                });
              } else {
                // Open — pre-select first heads
                const micro = heads.filter((h) => h.department === "Micro");
                if (micro.length > 0) setAssignedMicroHead(micro[0]._id);
                const chemical = heads.filter((h) => h.department === "Chemical");
                if (chemical.length > 0) setAssignedChemicalHead(chemical[0]._id);
                setShowForm(true);
              }
            }}
          >
            {showForm ? "Close" : "+ New Client Sample Job"}
          </button>
        </div>
      </div>

      {showForm &&
        (() => {
          const editingJob = editingJobId
            ? jobs.find((j) => j._id === editingJobId)
            : null;
          let returnNote = null;
          if (editingJob) {
            const isReturned =
              editingJob.distribution?.micro?.status === "RETURNED" ||
              editingJob.distribution?.chemical?.status === "RETURNED";
            if (isReturned && editingJob.history) {
              const returnEvent = editingJob.history
                .slice()
                .reverse()
                .find((e) => e.action === "RETURNED_TO_OFFICER");
              if (returnEvent) returnNote = returnEvent.note;
            }
          }
          
          const isCancelled = editingJob?.status === "CANCELLED";

          return (
            <div
              className="card"
              style={{
                marginBottom: "2rem",
                overflow: "visible",
                border: reopenParentId
                  ? "2px solid var(--color-warning)"
                  : "none",
                maxWidth: "100%",
                boxSizing: "border-box",
                animation: isFormClosing
                  ? "formCollapse 0.28s cubic-bezier(0.4, 0, 1, 1) both"
                  : "formReveal 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            >
              {returnNote && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #F87171",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "1.5rem",
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ color: "#EF4444", marginTop: "0.1rem" }}>
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 0.25rem 0", color: "#B91C1C" }}>
                      Job Returned by Head
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.9rem",
                        color: "#991B1B",
                      }}
                    >
                      <strong>Reason:</strong> {returnNote}
                    </p>
                    <p
                      style={{
                        margin: "0.5rem 0 0 0",
                        fontSize: "0.8rem",
                        color: "#B91C1C",
                        fontStyle: "italic",
                      }}
                    >
                      Please correct the details below and resubmit the job.
                    </p>
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    color: reopenParentId ? "var(--color-warning)" : "inherit",
                  }}
                >
                  {reopenParentId
                    ? "Log Sample Retest"
                    : "Log New Sample & Distribute"}
                </h3>
                {reopenParentId && (
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: "#fffbeb",
                      border: "1px solid #fcd34d",
                      borderRadius: "var(--radius-md)",
                      marginBottom: "1rem",
                      width: "100%",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        color: "#b45309",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Reason for Reopening / Retest{" "}
                      <span style={{ color: "red" }}>*</span>
                    </label>
                    <textarea
                      value={formData.reopenReason}
                      onChange={(e) => setField("reopenReason", e.target.value)}
                      required
                      placeholder="Explain why this job is being retested..."
                      style={{
                        width: "100%",
                        resize: "vertical",
                        minHeight: "60px",
                        borderColor: "#fcd34d",
                      }}
                    />
                  </div>
                )}
                {!reopenParentId && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "0.2rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {editingJobId ? "Job Code" : "Next Job Code"}
                    </span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        color: "var(--color-primary)",
                        backgroundColor: "var(--color-surface-hover)",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {editingJobId && editingJob
                        ? editingJob.jobCode
                        : nextSerial
                          ? buildJobCodePreview(nextSerial.serial, customCreationDate)
                          : "—"}
                    </span>
                  </div>
                )}
              </div>
              <form
                onSubmit={handleSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.tagName !== "TEXTAREA")
                    e.preventDefault();
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  position: "relative",
                }}
              >
                {/* Overlay for cancelled jobs */}
                {isCancelled && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(255, 255, 255, 0.6)",
                      zIndex: 100,
                      cursor: "not-allowed",
                      borderRadius: "var(--radius-md)",
                    }}
                  />
                )}
                {/* ── CUSTOMER INFORMATION ── */}
                <div
                  className="card"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <div
                    onClick={() => toggleSection("customer")}
                    style={{
                      padding: "1rem 1.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      backgroundColor: sections.customer
                        ? "var(--color-surface-hover)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {sections.customer ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                      <span style={{ fontWeight: 600 }}>
                        Customer Information
                      </span>
                    </div>
                  </div>
                  {sections.customer && (
                    <div
                      className="grid-2 mobile-form-grid"
                      style={{ borderTop: "1px solid var(--color-border)" }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Customer Name{" "}
                          <span style={{ color: "var(--color-danger)" }}>
                            *
                          </span>
                        </label>
                        <input
                          value={formData.customer_name}
                          onChange={(e) =>
                            setField("customer_name", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Mobile Number
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          pattern="[0-9]{10}"
                          title="Enter exactly 10 digits"
                          value={formData.mobile_number}
                          onChange={(e) =>
                            setField(
                              "mobile_number",
                              e.target.value
                                .replace(/[^0-9]/g, "")
                                .slice(0, 10),
                            )
                          }
                        />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Customer Address
                        </label>
                        <input
                          type="text"
                          value={formData.customer_address}
                          onChange={(e) =>
                            setField("customer_address", e.target.value)
                          }
                          style={{ width: "100%" }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Contact Person
                        </label>
                        <input
                          value={formData.contact_person}
                          onChange={(e) =>
                            setField("contact_person", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Email
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setField("email", e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Customer Reference No.
                        </label>
                        <input
                          type="text"
                          value={formData.customer_reference_no}
                          onChange={(e) =>
                            setField("customer_reference_no", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Batch No.
                        </label>
                        <input
                          type="text"
                          value={formData.batch_no}
                          onChange={(e) => setField("batch_no", e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          DOM
                        </label>
                        <input
                          type="text"
                          value={formData.dom}
                          onChange={(e) => setField("dom", e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Brand Name
                        </label>
                        <input
                          type="text"
                          value={formData.brand_name}
                          onChange={(e) => setField("brand_name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Any other information
                        </label>
                        <input
                          type="text"
                          value={formData.any_other_info}
                          onChange={(e) =>
                            setField("any_other_info", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Batch Size
                        </label>
                        <input
                          type="text"
                          value={formData.batch_size}
                          onChange={(e) => setField("batch_size", e.target.value)}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          DOE
                        </label>
                        <input
                          type="text"
                          value={formData.doe}
                          onChange={(e) => setField("doe", e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SAMPLE INFORMATION ── */}
                <div
                  className="card"
                  style={{ padding: 0, overflow: "visible" }}
                >
                  <div
                    onClick={() => toggleSection("sample")}
                    style={{
                      padding: "1rem 1.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      backgroundColor: sections.sample
                        ? "var(--color-surface-hover)"
                        : "transparent",
                      borderTopLeftRadius: "inherit",
                      borderTopRightRadius: "inherit",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {sections.sample ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                      <span style={{ fontWeight: 600 }}>
                        Sample Information
                      </span>
                    </div>
                  </div>
                  {sections.sample && (
                    <div
                      className="grid-2 mobile-form-grid"
                      style={{ borderTop: "1px solid var(--color-border)" }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Sample Name{" "}
                          <span style={{ color: "var(--color-danger)" }}>
                            *
                          </span>
                        </label>
                        <input
                          value={formData.sample_name}
                          onChange={(e) =>
                            setField("sample_name", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Sample ID{" "}
                          <span
                            style={{
                              color: "var(--color-text-muted)",
                              fontSize: "0.8rem",
                            }}
                          >
                            (auto-assigned)
                          </span>
                        </label>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <input
                            value={
                              formData.sample_id ||
                              (nextSerial ? nextSerial.padded : "")
                            }
                            readOnly
                            style={{
                              flex: 1,
                              backgroundColor: "var(--color-surface-hover)",
                              cursor: "not-allowed",
                              fontFamily: "monospace",
                              fontWeight: 600,
                              letterSpacing: "0.1em",
                              color: "var(--color-primary)",
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Sample Quantity{" "}
                          <span style={{ color: "var(--color-danger)" }}>
                            *
                          </span>
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.sample_quantity}
                            onChange={(e) =>
                              setField("sample_quantity", e.target.value)
                            }
                            required
                            style={{ flex: 1 }}
                          />
                          <input
                            type="text"
                            placeholder="Unit"
                            value={formData.sample_quantity_unit}
                            onChange={(e) =>
                              setField("sample_quantity_unit", e.target.value)
                            }
                            required
                            style={{ width: "90px" }}
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Sample Count{" "}
                          <span style={{ color: "var(--color-danger)" }}>
                            *
                          </span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={formData.sample_count}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "" || parseInt(v) >= 1)
                              setField("sample_count", v);
                          }}
                          required
                          style={{ width: "100%" }}
                          placeholder="No. of samples received"
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Received Date{" "}
                          <span style={{ color: "var(--color-danger)" }}>
                            *
                          </span>
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="text"
                            placeholder="DD"
                            maxLength="2"
                            pattern="(0?[1-9]|[12][0-9]|3[01])"
                            value={formData.received_date_dd}
                            onChange={(e) =>
                              setField(
                                "received_date_dd",
                                e.target.value.replace(/\D/g, ""),
                              )
                            }
                            required
                            style={{ width: "3.5rem", textAlign: "center" }}
                          />
                          <span
                            style={{
                              fontWeight: 500,
                              color: "var(--color-text-muted)",
                            }}
                          >
                            /
                          </span>
                          <input
                            type="text"
                            placeholder="MM"
                            maxLength="2"
                            pattern="(0?[1-9]|1[012])"
                            value={formData.received_date_mm}
                            onChange={(e) =>
                              setField(
                                "received_date_mm",
                                e.target.value.replace(/\D/g, ""),
                              )
                            }
                            required
                            style={{ width: "3.5rem", textAlign: "center" }}
                          />
                          <span
                            style={{
                              fontWeight: 500,
                              color: "var(--color-text-muted)",
                            }}
                          >
                            /
                          </span>
                          <input
                            type="text"
                            placeholder="YYYY"
                            maxLength="4"
                            pattern="\d{4}"
                            value={formData.received_date_yyyy}
                            onChange={(e) =>
                              setField(
                                "received_date_yyyy",
                                e.target.value.replace(/\D/g, ""),
                              )
                            }
                            required
                            style={{ width: "4.5rem", textAlign: "center" }}
                          />
                          <div
                            className="calendar-hint-pulse"
                            title="Pick from calendar"
                            style={{
                              position: "relative",
                              width: "2.8rem",
                              height: "2.4rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "var(--color-surface-hover)",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-md)",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                          >
                            <Calendar size={20} color="var(--color-primary)" />
                            <input
                              type="date"
                              onClick={(e) => {
                                if (e.target.showPicker) e.target.showPicker();
                              }}
                              onChange={(e) => {
                                if (!e.target.value) return;
                                const [y, m, d] = e.target.value.split("-");
                                setField("received_date_dd", d);
                                setField("received_date_mm", m);
                                setField("received_date_yyyy", y);
                              }}
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                opacity: 0,
                                cursor: "pointer",
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* ── Job Date ── */}
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Job Date
                          <span
                            style={{
                              marginLeft: "0.4rem",
                              fontSize: "0.75rem",
                              fontWeight: 400,
                              color: "var(--color-text-muted)",
                            }}
                          >
                            (sets the date in the job code)
                          </span>
                        </label>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="date"
                            value={customCreationDate}
                            onChange={(e) => setCustomCreationDate(e.target.value)}
                            style={{
                              padding: "0.4rem 0.6rem",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-md)",
                              fontSize: "0.9rem",
                              cursor: "pointer",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setCustomCreationDate(getISTDateString())}
                            style={{
                              padding: "0.4rem 0.75rem",
                              fontSize: "0.8rem",
                              border: "1px solid var(--color-border)",
                              borderRadius: "var(--radius-md)",
                              backgroundColor: "var(--color-surface-hover)",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Reset to today
                          </button>
                        </div>
                        {customCreationDate !== getISTDateString() && (
                          <div
                            style={{
                              marginTop: "0.35rem",
                              fontSize: "0.78rem",
                              color: "#d97706",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.3rem",
                            }}
                          >
                            📅 Job code will use date{" "}
                            <strong>{customCreationDate}</strong> instead of today.
                          </div>
                        )}
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Condition on Receipt{" "}
                          <span style={{ color: "var(--color-danger)" }}>
                            *
                          </span>
                        </label>
                        <select
                          value={formData.condition_on_receipt}
                          onChange={(e) =>
                            setField("condition_on_receipt", e.target.value)
                          }
                          required
                          style={{ width: "100%" }}
                        >
                          <option value="">Select...</option>
                          <option value="Satisfactory">Satisfactory</option>
                          <option value="Unsatisfactory">Unsatisfactory</option>
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Packing Details
                        </label>
                        <input
                          value={formData.packing_details}
                          onChange={(e) =>
                            setField("packing_details", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Marking / Seal
                        </label>
                        <input
                          value={formData.marking_seal}
                          onChange={(e) =>
                            setField("marking_seal", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Sample Source
                        </label>
                        <input
                          value={formData.sample_source}
                          onChange={(e) =>
                            setField("sample_source", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Received Mode
                        </label>
                        <select
                          value={formData.received_mode}
                          onChange={(e) =>
                            setField("received_mode", e.target.value)
                          }
                        >
                          <option value="Select">Select...</option>
                          <option>Courier</option>
                          <option>Hand Delivery</option>
                          <option>Post</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          marginTop: "1rem",
                          paddingTop: "1rem",
                          borderTop: "1px solid var(--color-border)",
                        }}
                      >
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.8rem",
                            fontWeight: 600,
                            fontSize: "0.95rem",
                          }}
                        >
                          Job Type{" "}
                          <span style={{ color: "var(--color-danger)" }}>
                            *
                          </span>
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.75rem",
                            flexWrap: "wrap",
                            marginBottom: "1.5rem",
                          }}
                        >
                          {[
                            {
                              id: "non_nabl",
                              label: "Non-NABL",
                              desc: "Standard lab report",
                            },
                            {
                              id: "nabl",
                              label: "NABL",
                              desc: "Auto-generates ULR number",
                            },
                            {
                              id: "hybrid",
                              label: "Hybrid",
                              desc: "Creates both NABL & Non-NABL jobs",
                            },
                          ].map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() =>
                                !editingJobId && setField("nabl_mode", mode.id)
                              }
                              style={{
                                flex: "1 1 200px",
                                padding: "0.75rem 1rem",
                                borderRadius: "var(--radius-md)",
                                textAlign: "left",
                                cursor: editingJobId
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: editingJobId ? 0.6 : 1,
                                border:
                                  formData.nabl_mode === mode.id
                                    ? "2px solid var(--color-primary)"
                                    : "1px solid var(--color-border)",
                                backgroundColor:
                                  formData.nabl_mode === mode.id
                                    ? "var(--color-primary)10"
                                    : "var(--color-surface)",
                                transition: "all 0.15s",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight:
                                    formData.nabl_mode === mode.id ? 700 : 500,
                                  color:
                                    formData.nabl_mode === mode.id
                                      ? "var(--color-primary)"
                                      : "var(--color-text)",
                                }}
                              >
                                {mode.label}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--color-text-muted)",
                                  marginTop: "0.2rem",
                                }}
                              >
                                {mode.desc}
                              </div>
                            </button>
                          ))}
                        </div>

                        {(formData.nabl_mode === "nabl" ||
                          formData.nabl_mode === "hybrid") && (
                          <div
                            style={{
                              marginBottom: "1.5rem",
                              backgroundColor: "#eff6ff",
                              padding: "1rem",
                              borderRadius: "var(--radius-md)",
                              border: "1px solid #bfdbfe",
                            }}
                          >
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.4rem",
                                fontWeight: 600,
                                fontSize: "0.9rem",
                                color: "#1e3a8a",
                              }}
                            >
                              ULR Number {editingJobId ? '' : '(Auto-assigned)'}{" "}
                              <span style={{ color: "var(--color-danger)" }}>
                                *
                              </span>
                            </label>
                            <input
                              value={editingJobId ? (formData.ulr_no || 'N/A') : ulrPreview}
                              readOnly
                              style={{
                                width: "100%",
                                backgroundColor: "transparent",
                                border: "1px solid #93c5fd",
                                color: "#1e40af",
                                fontWeight: 700,
                                letterSpacing: "0.05em",
                              }}
                            />
                            {!editingJobId && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#3b82f6",
                                marginTop: "0.4rem",
                              }}
                            >
                              This ULR will be officially assigned when the job
                              is submitted.
                            </div>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "1.5rem",
                            width: "100%",
                          }}
                        >
                          {formData.nabl_mode === "hybrid" ? (
                            <>
                              <CascadingParameterSelector
                                key={`nabl-${selectorResetKey}`}
                                label="NABL Job Parameters"
                                modeClass="nabl-card"
                                allGroupData={allGroupData}
                                initialSelectedParams={nablParams}
                                initialGroupMetadata={nablGroupMetadata}
                                initialPesticidePanel={nablPesticidePanel}
                                initialShowSpecifications={
                                  nablShowSpecifications
                                }
                                externalSync={nonNablGroupMetadata}
                                immutable={
                                  !!editingJobId && isJobFullyComplete
                                }
                                onDataChange={(data) => {
                                  setNablParams(data.parameters);
                                  setNablGroupMetadata(data.groupMetadata);
                                  setNablPesticidePanel(data.pesticidePanel);
                                  if (data.showSpecifications !== undefined)
                                    setNablShowSpecifications(
                                      data.showSpecifications,
                                    );
                                }}
                              />
                              <CascadingParameterSelector
                                key={`nonnabl-${selectorResetKey}`}
                                label="Non-NABL Job Parameters"
                                modeClass="non-nabl-card"
                                allGroupData={allGroupData}
                                initialSelectedParams={nonNablParams}
                                initialGroupMetadata={nonNablGroupMetadata}
                                initialPesticidePanel={nonNablPesticidePanel}
                                initialShowSpecifications={
                                  nonNablShowSpecifications
                                }
                                externalSync={nablGroupMetadata}
                                immutable={
                                  !!editingJobId && isJobFullyComplete
                                }
                                onDataChange={(data) => {
                                  setNonNablParams(data.parameters);
                                  setNonNablGroupMetadata(data.groupMetadata);
                                  setNonNablPesticidePanel(data.pesticidePanel);
                                  if (data.showSpecifications !== undefined)
                                    setNonNablShowSpecifications(
                                      data.showSpecifications,
                                    );
                                }}
                              />
                            </>
                          ) : (
                            <CascadingParameterSelector
                              key={`standard-${selectorResetKey}`}
                              label="Test Parameters"
                              allGroupData={allGroupData}
                              initialSelectedParams={selectedParams}
                              initialGroupMetadata={groupMetadata}
                              initialPesticidePanel={pesticidePanel}
                              initialShowSpecifications={showSpecifications}
                              immutable={
                                !!editingJobId && isJobFullyComplete
                              }
                              onDataChange={(data) => {
                                setSelectedParams(data.parameters);
                                setGroupMetadata(data.groupMetadata);
                                setPesticidePanel(data.pesticidePanel);
                                if (data.showSpecifications !== undefined)
                                  setShowSpecifications(
                                    data.showSpecifications,
                                  );
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── COMPLIANCE & LEGAL ── */}
                <div
                  className="card"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <div
                    onClick={() => toggleSection("compliance")}
                    style={{
                      padding: "1rem 1.5rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      backgroundColor: sections.compliance
                        ? "var(--color-surface-hover)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {sections.compliance ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                      <span style={{ fontWeight: 600 }}>
                        Compliance & Legal Information
                      </span>
                    </div>
                  </div>
                  {sections.compliance && (
                    <div
                      className="mobile-form-grid"
                      style={{
                        borderTop: "1px solid var(--color-border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Statement of Conformity
                        </label>
                        <textarea
                          rows={2}
                          value={formData.statement_of_conformity}
                          onChange={(e) =>
                            setField("statement_of_conformity", e.target.value)
                          }
                          style={{ width: "100%", resize: "vertical" }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Accreditation Scope
                        </label>
                        <input
                          value={formData.accreditation_scope}
                          onChange={(e) =>
                            setField("accreditation_scope", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Disclaimer Notes
                        </label>
                        <textarea
                          rows={2}
                          value={formData.disclaimer_notes}
                          onChange={(e) =>
                            setField("disclaimer_notes", e.target.value)
                          }
                          style={{ width: "100%", resize: "vertical" }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Decision Rule
                        </label>
                        <input
                          value={formData.decision_rule}
                          onChange={(e) =>
                            setField("decision_rule", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.4rem",
                            fontWeight: 500,
                            fontSize: "0.9rem",
                          }}
                        >
                          Special Handling Instructions
                        </label>
                        <textarea
                          rows={2}
                          value={formData.special_handling_instructions}
                          onChange={(e) =>
                            setField(
                              "special_handling_instructions",
                              e.target.value,
                            )
                          }
                          style={{ width: "100%", resize: "vertical" }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Head Assignment ── */}
                {(needsMicro || needsChemical) && (
                  <div
                    className="card"
                    style={{
                      position: "relative",
                      padding: 0,
                      overflow: "hidden",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-lg)",
                    }}
                  >
                    <div
                      style={{
                        padding: "1rem 1.5rem",
                        backgroundColor: "var(--color-surface-hover)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                        Department Head Assignment
                      </div>
                    </div>
                    <div
                      className="mobile-form-grid"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1.25rem",
                      }}
                    >
                      <div className="grid-2">
                        {needsMicro && (
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.4rem",
                                fontWeight: 600,
                                fontSize: "0.9rem",
                              }}
                            >
                              Microbiology Head{" "}
                              <span style={{ color: "var(--color-danger)" }}>
                                *
                              </span>
                            </label>
                            <select
                              value={assignedMicroHead}
                              onChange={(e) =>
                                setAssignedMicroHead(e.target.value)
                              }
                              required
                              style={{ width: "100%" }}
                            >
                              {heads
                                .filter((h) => h.department === "Micro")
                                .map((h) => (
                                  <option key={h._id} value={h._id}>
                                    {h.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                        {needsChemical && (
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: "0.4rem",
                                fontWeight: 600,
                                fontSize: "0.9rem",
                              }}
                            >
                              Chemical Analysis Head{" "}
                              <span style={{ color: "var(--color-danger)" }}>
                                *
                              </span>
                            </label>
                            <select
                              value={assignedChemicalHead}
                              onChange={(e) =>
                                setAssignedChemicalHead(e.target.value)
                              }
                              required
                              style={{ width: "100%" }}
                            >
                              {heads
                                .filter((h) => h.department === "Chemical")
                                .map((h) => (
                                  <option key={h._id} value={h._id}>
                                    {h.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                      {editingJobId && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            backgroundColor: "rgba(255,255,255,0.6)",
                            cursor: "not-allowed",
                            zIndex: 10,
                          }}
                        ></div>
                      )}
                    </div>
                  </div>
                )}

                <div
                  style={{ display: "flex", gap: "1rem", alignItems: "center" }}
                >
                  <button
                    type="submit"
                    className="btn btn-primary"
                    title="Save/Dispatch Job (Ctrl + Enter)"
                    style={{ padding: "0.8rem 2rem", ...(isCancelled ? { backgroundColor: "var(--color-border)", borderColor: "var(--color-border)", color: "var(--color-text-muted)" } : {}) }}
                    disabled={isSubmitting || isCancelled}
                  >
                    {isSubmitting
                      ? "Processing..."
                      : isCancelled
                        ? "Job Cancelled"
                        : editingJobId
                          ? "Save Changes"
                          : reopenParentId
                            ? "Save Retest Job"
                            : "Create Job & Dispatch"}
                  </button>
                  {!editingJobId && !reopenParentId && (
                    <button
                      type="button"
                      onClick={clearDraft}
                      className="btn"
                      style={{
                        padding: "0.8rem 2rem",
                        border: "1px solid var(--color-danger)",
                        color: "var(--color-danger)",
                        backgroundColor: "transparent",
                      }}
                    >
                      Clear Draft
                    </button>
                  )}
                  {!editingJobId && !reopenParentId && (
                    <button
                      type="button"
                      onClick={() => setRetainForm(!retainForm)}
                      className="btn"
                      style={{
                        padding: "0.6rem 1.4rem",
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        border: "none",
                        borderRadius: "999px",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: retainForm ? "#fff" : "var(--color-text-muted)",
                        background: retainForm
                          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                          : "var(--color-surface-elevated, #f1f5f9)",
                        boxShadow: retainForm
                          ? "0 2px 12px rgba(99, 102, 241, 0.35)"
                          : "inset 0 1px 3px rgba(0,0,0,0.06)",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        transform: retainForm ? "scale(1.02)" : "scale(1)",
                      }}
                    >
                      <Repeat2
                        size={15}
                        style={{
                          transition: "transform 0.4s ease",
                          transform: retainForm ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                      {retainForm ? "Retaining" : "Retain Form"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          );
        })()}

      <div style={{ marginTop: "2rem" }}>
        <JobLogTable
          jobs={jobs}
          title="All Client Sample Jobs"
          onDeleteJob={handleDeleteJob}
          onEditJob={handleEditJob}
          editingJobId={editingJobId}
          onReopen={(job) =>
            navigate("/admin-officer/jobs", { state: { reopenJob: job } })
          }
          defaultExpandedId={location.state?.expandJobId}
        />
      </div>

      {/* ── CUSTOM CONFIRMATION MODAL (SUBMIT) ── */}
      {showConfirmModal && (
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
              borderTop: editingJobId && originalEditParams && (() => {
                const currentIds = new Set(selectedParams.map(p => (p._id || p.parameterId)?.toString()).filter(Boolean));
                const originalIds = new Set(originalEditParams);
                return [...currentIds].some(id => !originalIds.has(id)) || [...originalIds].some(id => !currentIds.has(id));
              })() ? "4px solid var(--color-warning)" : "4px solid var(--color-primary)",
            }}
          >
            {/* Compute param diff for modal display */}
            {(() => {
              let addedParams = [];
              let removedParams = [];
              let hasParamChanges = false;

              if (editingJobId && originalEditParams) {
                const currentIds = new Set(selectedParams.map(p => (p._id || p.parameterId)?.toString()).filter(Boolean));
                const originalIds = new Set(originalEditParams);
                addedParams = selectedParams.filter(p => {
                  const id = (p._id || p.parameterId)?.toString();
                  return id && !originalIds.has(id);
                });
                const currentParamMap = Object.fromEntries(
                  selectedParams.map(p => [(p._id || p.parameterId)?.toString(), p])
                );
                removedParams = originalEditParams
                  .filter(id => !currentIds.has(id))
                  .map(id => {
                    const editingJob = jobs.find(j => j._id === editingJobId);
                    const orig = editingJob?.parameters?.find(p => (p._id || p.parameterId)?.toString() === id);
                    return orig || { name: 'Unknown parameter', parameterId: id };
                  });
                hasParamChanges = addedParams.length > 0 || removedParams.length > 0;
              }

              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "1.5rem",
                      color: hasParamChanges ? "var(--color-warning)" : "var(--color-primary)",
                    }}
                  >
                    {hasParamChanges ? <AlertTriangle size={32} /> : <Activity size={32} />}
                    <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
                      {hasParamChanges ? "Parameter Modification" : editingJobId ? "Confirm Changes" : "Confirm Job Creation"}
                    </h2>
                  </div>

                  <p
                    style={{
                      margin: "0 0 1rem 0",
                      color: "var(--color-text-main)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {editingJobId
                      ? `You are about to save changes to the sample job for ${formData.customer_name}.`
                      : `You are about to log and distribute a new sample job for ${formData.customer_name}.\n\nThis will generate job codes and notify the relevant department heads immediately.`}
                  </p>

                  {hasParamChanges && (
                    <div
                      style={{
                        marginBottom: "1.5rem",
                        padding: "1rem",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--color-warning)", marginBottom: "0.6rem" }}>
                        ⚠ The following parameters will be modified:
                      </div>
                      {addedParams.length > 0 && (
                        <div style={{ marginBottom: "0.4rem", fontSize: "0.85rem" }}>
                          <span style={{ color: "#16a34a", fontWeight: 600 }}>+ Added: </span>
                          {addedParams.map(p => p.name).join(", ")}
                        </div>
                      )}
                      {removedParams.length > 0 && (
                        <div style={{ marginBottom: "0.4rem", fontSize: "0.85rem" }}>
                          <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>− Removed: </span>
                          {removedParams.map(p => p.name).join(", ")}
                        </div>
                      )}
                      <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginTop: "0.6rem", lineHeight: 1.5 }}>
                        This will update active test assignments. Completed work by analysts will be rolled back for review.
                        {removedParams.length > 0 && " Any custom reports will be auto-reverted."}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  border: "1px solid var(--color-primary)",
                  color: "var(--color-primary)",
                  padding: "0.6rem 2rem",
                  backgroundColor: "transparent",
                }}
              >
                Review Form
              </button>
              <button
                className="btn btn-primary"
                onClick={executeSubmit}
                title="Confirm & Dispatch (Ctrl + Enter)"
                style={{ padding: "0.6rem 2rem" }}
              >
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM CONFIRMATION MODAL (CANCEL JOB) ── */}
      {deleteConfirmJobId && (
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
              borderTop: "4px solid var(--color-warning)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1.5rem",
                color: "var(--color-warning)",
              }}
            >
              <AlertTriangle size={32} />
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
                Confirm Cancellation
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
              Are you sure you want to cancel this job?
              <br />
              <br />
              <strong style={{ color: "var(--color-warning)" }}>
                The job code will be permanently bound to this cancelled job and
                the serial number sequence will be maintained.
              </strong>
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
                onClick={() => setDeleteConfirmJobId(null)}
                style={{
                  border: "1px solid var(--color-warning)",
                  color: "var(--color-warning)",
                  padding: "0.6rem 2rem",
                  backgroundColor: "transparent",
                }}
              >
                No, Keep it
              </button>
              <button
                className="btn"
                onClick={executeCancelJob}
                style={{
                  padding: "0.6rem 2rem",
                  backgroundColor: "var(--color-warning)",
                  color: "white",
                  border: "none",
                }}
              >
                Cancel Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Audit() {
  const [jobs, setJobs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(
    () => !sessionStorage.getItem(CACHE_KEYS.JOBS),
  );
  const navigate = useNavigate();
  const socket = useSocket();

  const fetchData = async () => {
    try {
      await fetchWithCache(`${API_URL}/api/jobs`, CACHE_KEYS.JOBS, setJobs);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const triggerUpdate = () => {
      invalidateCache(CACHE_KEYS.JOBS);
      fetchData();
    };

    socket.on("JOB_CREATED", triggerUpdate);
    socket.on("JOB_RETEST_INITIATED", triggerUpdate);
    socket.on("TRANSFER_INITIATED", triggerUpdate);
    socket.on("TRANSFER_RECEIVED", triggerUpdate);
    socket.on("TEST_SUBMITTED", triggerUpdate);
    socket.on("TEST_REVIEWED", triggerUpdate);
    socket.on("JOB_UPDATED", triggerUpdate);
    socket.on("JOB_RETURNED", triggerUpdate);
    socket.on("JOB_DELETED", triggerUpdate);

    return () => {
      socket.off("JOB_CREATED", triggerUpdate);
      socket.off("JOB_RETEST_INITIATED", triggerUpdate);
      socket.off("TRANSFER_INITIATED", triggerUpdate);
      socket.off("TRANSFER_RECEIVED", triggerUpdate);
      socket.off("TEST_SUBMITTED", triggerUpdate);
      socket.off("TEST_REVIEWED", triggerUpdate);
      socket.off("JOB_UPDATED", triggerUpdate);
      socket.off("JOB_RETURNED", triggerUpdate);
      socket.off("JOB_DELETED", triggerUpdate);
    };
  }, [socket]);

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
          Global Job Logs & Reports
        </h1>

        {auditLoading && jobs.length === 0 ? (
          <div className="card">
            <Spinner message="Loading logs..." />
          </div>
        ) : (
          <JobLogTable
            jobs={jobs}
            title="Lifecycle Tracker"
            onReopen={(job) =>
              navigate("/admin-officer/jobs", { state: { reopenJob: job } })
            }
          />
        )}
      </div>
    </div>
  );
}

export default function AdminOfficerDashboard() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/jobs" element={<Jobs />} />

      <Route path="/audit" element={<Audit />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/data-settings" element={<DataSettings />} />
      <Route path="/settings" element={<div>System Settings Page</div>} />
    </Routes>
  );
}

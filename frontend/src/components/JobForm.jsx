import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWithCache, invalidateCache, CACHE_KEYS, isCached } from "../../utils/cache";
import { cacheGet, cacheSet } from "../../utils/cacheStorage";
import API_URL from "../../utils/api";
import Spinner from "../../components/Spinner";

import { 
  Play, Plus, Check, Clock, Edit, FileText, XCircle, Search, LogOut, ChevronDown, 
  ChevronRight, ArrowLeft, Download, Eye, LayoutDashboard, Users, Activity as ActivityIcon, RefreshCw, X, Shield,
  AlertTriangle, Calendar } from "lucide-react";
import JobLogTable from "../../components/JobLogTable";
import { useSocket } from "../../context/SocketContext";

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

function getISTDateString() {
  const now = new Date();
  // Offset IST = UTC + 5h30m = 330 minutes
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, "0");
  const dd = String(ist.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function JobForm({ jobs, heads, editingJobId, reopenParentId, onClose, onSaveSuccess }) {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();
  
  
  
  
  
  
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

  const handleJobsData = (data) => {
    if (data && data.jobs) {
      setJobs(data.jobs);
      setHasMoreJobs(data.hasMore);
      setJobsCursor(data.nextCursor);
    } else if (Array.isArray(data)) {
      setJobs(data);
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

    return (

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
}

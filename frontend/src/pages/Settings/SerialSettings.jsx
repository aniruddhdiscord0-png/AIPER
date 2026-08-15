import React, { useState, useEffect } from "react";
import axios from "axios";
import { AlertCircle, Activity } from "lucide-react";
import API_URL from "../../utils/api";
import { validateJobCode } from "../../utils/serialUtils";

export default function SerialSettings() {
  const [serialPreview, setSerialPreview] = useState("");
  const [nextSerialPreview, setNextSerialPreview] = useState("");
  const [serialOffset, setSerialOffset] = useState("");
  const [serialOffsetError, setSerialOffsetError] = useState("");
  const [isUpdatingSerialOffset, setIsUpdatingSerialOffset] = useState(false);
  const [confirmSerialModal, setConfirmSerialModal] = useState(false);
  const [statusModal, setStatusModal] = useState({ show: false, type: "", title: "", message: "" });

  const fetchSerialData = async () => {
    try {
      const serialRes = await axios.get(`${API_URL}/api/jobs/next-sample-id`);
      setSerialPreview(serialRes.data.currentJobCode || serialRes.data.currentValue || "");
      setNextSerialPreview(serialRes.data.nextJobCode || serialRes.data.nextValue || "");
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSerialData();
  }, []);

  const executeSerialUpdate = async () => {
    setIsUpdatingSerialOffset(true);
    setConfirmSerialModal(false);
    try {
      await axios.put(`${API_URL}/api/jobs/sample-serial-offset`, {
        offset: serialOffset,
      });
      setSerialOffset("");
      fetchSerialData();
      setStatusModal({
        show: true,
        type: "success",
        title: "Success",
        message: "Sample Serial updated successfully.",
      });
    } catch (err) {
      console.error(err);
      setStatusModal({
        show: true,
        type: "error",
        title: "Error",
        message:
          "Failed to update Sample Serial: " +
          (err.response?.data?.message || err.message),
      });
    } finally {
      setIsUpdatingSerialOffset(false);
    }
  };

  const handleUpdateSerialOffset = () => {
    if (!serialOffset || !!serialOffsetError || serialOffset.length !== 10) return;
    setConfirmSerialModal(true);
  };

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div className="card" style={{ borderTop: "4px solid var(--color-primary)" }}>
        <h3
          style={{
            margin: "0 0 1.5rem 0",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "#166534",
            fontSize: "1.1rem",
          }}
        >
          <Activity size={18} /> Sample Serial (Job Code) Settings
        </h3>
        <div className="grid-2" style={{ gap: "2rem", alignItems: "flex-start" }}>
          <div style={{ backgroundColor: "var(--color-surface-hover)", padding: "1.5rem", borderRadius: "var(--radius-lg)" }}>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                Current Serial Number:
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "monospace", color: "var(--color-text-main)" }}>
                {serialPreview || "Loading..."}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                Preview Next Serial Number:
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, fontFamily: "monospace", color: "var(--color-primary)" }}>
                {nextSerialPreview || "Loading..."}
              </div>
            </div>
          </div>
          <div>
            <div className="form-group">
              <label>
                Update Serial Number:
                <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginLeft: "0.5rem", fontWeight: "normal" }}>
                  (e.g., 20240321-M-0001)
                </span>
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="YYYYMMDD-D-XXXX"
                  value={serialOffset}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setSerialOffset(val);
                    if (val) {
                        const parts = val.split("-");
                        if (parts.length !== 3 || parts[0].length !== 8 || (parts[1] !== "M" && parts[1] !== "C") || parts[2].length !== 4) {
                            setSerialOffsetError("Format must be YYYYMMDD-M-XXXX or YYYYMMDD-C-XXXX");
                        } else {
                            setSerialOffsetError("");
                        }
                    } else {
                        setSerialOffsetError("");
                    }
                  }}
                  className={serialOffsetError ? "input-error" : ""}
                  style={{ fontFamily: "monospace", textTransform: "uppercase" }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleUpdateSerialOffset}
                  disabled={isUpdatingSerialOffset || !serialOffset || !!serialOffsetError || serialOffset.length !== 10}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {isUpdatingSerialOffset ? "Updating..." : "Update Serial"}
                </button>
              </div>
              {serialOffsetError && <span className="error-text" style={{ display: "block", marginTop: "0.5rem" }}>{serialOffsetError}</span>}
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: "1rem", lineHeight: 1.5 }}>
                <AlertCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.25rem" }} />
                Use this to sync the system serial with a manually created physical job, or to reset the sequence at the start of a new day. Only update if absolutely necessary.
              </p>
            </div>
          </div>
        </div>
      </div>

      {confirmSerialModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <h3 style={{ margin: "0 0 1rem 0", color: "var(--color-danger)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlertCircle size={20} /> Confirm Serial Update
            </h3>
            <p>
              Are you sure you want to set the current Job Serial Number to{" "}
              <strong style={{ fontFamily: "monospace" }}>{serialOffset}</strong>?
            </p>
            <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
              The very next job created will be <strong>{serialOffset}</strong>. This cannot be undone and may cause sequence gaps if used incorrectly.
            </p>
            <div className="form-actions" style={{ marginTop: "2rem" }}>
              <button className="btn btn-secondary" onClick={() => setConfirmSerialModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={executeSerialUpdate} disabled={isUpdatingSerialOffset}>
                {isUpdatingSerialOffset ? "Updating..." : "Yes, Update Serial"}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusModal.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px", textAlign: "center" }}>
            <h3 style={{ color: statusModal.type === "error" ? "var(--color-danger)" : "var(--color-primary)", marginBottom: "1rem" }}>
              {statusModal.title}
            </h3>
            <p style={{ marginBottom: "1.5rem" }}>{statusModal.message}</p>
            <button className="btn btn-primary" onClick={() => setStatusModal({ show: false, type: "", title: "", message: "" })}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

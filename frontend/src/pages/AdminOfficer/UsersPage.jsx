import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWithCache, invalidateCache, CACHE_KEYS, isCached } from "../../utils/cache";
import { cacheGet, cacheSet } from "../../utils/cacheStorage";
import API_URL from "../../utils/api";
import Spinner from "../../components/Spinner";

import { Play, User, Check, X, Search, Shield, Activity, Edit, Trash2 } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";


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

export default function UsersPage() {
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
    () => !isCached(CACHE_KEYS.USERS),
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

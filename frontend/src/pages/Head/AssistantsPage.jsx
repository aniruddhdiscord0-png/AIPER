import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWithCache, invalidateCache, CACHE_KEYS, isCached } from "../../utils/cache";
import { cacheGet, cacheSet } from "../../utils/cacheStorage";
import API_URL from "../../utils/api";
import Spinner from "../../components/Spinner";

import { Play, Users, Check, X, Search, Shield, Activity } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";

export default function Assistants() {
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
    () => !isCached(CACHE_KEYS.USERS),
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

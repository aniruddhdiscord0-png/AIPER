import React from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import DataSettings from "./DataSettings";
import ActivityLogsPage from './ActivityLogsPage';

import Dashboard from "./AdminOfficer/AdminOfficerStats";
import Jobs from "./AdminOfficer/JobsPage";
import UsersPage from "./AdminOfficer/UsersPage";
import API_URL from "../utils/api";

function Audit() {
  const navigate = useNavigate();
  return (
    <ActivityLogsPage
      title="Global Job Logs & Reports"
      fetchUrl={`${API_URL}/api/jobs`}
      enableSocketUpdates={true}
      onReopen={(job) => navigate("/admin-officer/jobs", { state: { reopenJob: job } })}
    />
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

import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import DataSettings from "./DataSettings";
import ActivityLogsPage from './ActivityLogsPage';

import Dashboard from "./Head/HeadStats";
import Assistants from "./Head/AssistantsPage";
import Dispatcher from "./Head/DispatcherPage";
import ReviewQueue from "./Head/ReviewQueuePage";
import API_URL from "../utils/api";
import { AuthContext } from "../context/AuthContext";

function Audit() {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  return (
    <ActivityLogsPage
      title="Department Job Logs"
      fetchUrl={`${API_URL}/api/jobs`}
      showCompletedActivity={true}
      completedActivityScope="department"
      enableSocketUpdates={false}
      defaultExpandedId={location.state?.expandJobId}
      user={user}
    />
  );
}

export default function HeadDashboard() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/jobs" element={<Dispatcher />} />
      <Route path="/review" element={<ReviewQueue />} />
      <Route path="/assistants" element={<Assistants />} />

      <Route path="/audit" element={<Audit />} />
      <Route path="/data-settings" element={<DataSettings />} />
    </Routes>
  );
}

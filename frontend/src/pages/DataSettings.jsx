import React, { useState } from "react";
import { Database, Settings, Hash } from "lucide-react";
import GroupSettings from "./Settings/GroupSettings";
import SerialSettings from "./Settings/SerialSettings";

export default function DataSettings() {
  const [activeTab, setActiveTab] = useState("groups");

  return (
    <div style={{ paddingBottom: "3rem" }}>
      <h1
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Database size={28} style={{ color: "var(--color-primary)" }} /> Data Settings
      </h1>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "2rem",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "0.5rem",
        }}
      >
        <button
          className={`btn ${activeTab === "groups" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("groups")}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <Settings size={18} /> Parameter Groups
        </button>
        <button
          className={`btn ${activeTab === "serial" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("serial")}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <Hash size={18} /> Sample Serial (Job Code)
        </button>
      </div>

      {activeTab === "groups" && <GroupSettings />}
      {activeTab === "serial" && <SerialSettings />}
    </div>
  );
}

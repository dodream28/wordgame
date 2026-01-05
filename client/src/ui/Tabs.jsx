import React from "react";
export default function Tabs({ tabs, active, onChange }){
  return (
    <div style={{ display:"flex", gap: 8, flexWrap:"wrap" }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "8px 10px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: active === t.key ? "rgba(110,231,255,.18)" : "rgba(255,255,255,.05)",
            color: active === t.key ? "var(--text)" : "var(--muted)",
            cursor: "pointer"
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

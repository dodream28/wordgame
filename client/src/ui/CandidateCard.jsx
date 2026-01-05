import React, { useState } from "react";
import Card from "./Card";

export default function CandidateCard({ label, kind, summary, detail, selected, onSelect, disabled=false }){
  const [open, setOpen] = useState(false);

  return (
    <Card
      title={`${kind} · ${label}`}
      right={
        <div style={{ display:"flex", gap: 8, alignItems:"center" }}>
          <button
            onClick={() => setOpen(v => !v)}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,.05)",
              color: "var(--muted)",
              cursor: "pointer"
            }}
          >
            {open ? "접기" : "펼치기"}
          </button>
          {onSelect && (
            <label style={{ display:"flex", gap:8, alignItems:"center", color: disabled ? "var(--muted)" : "var(--text)" }}>
              <input type="radio" checked={selected} onChange={onSelect} disabled={disabled} />
              선택
            </label>
          )}
        </div>
      }
    >
      <div className="small">{summary}</div>
      {open && <div style={{ marginTop: 10 }}>{detail}</div>}
    </Card>
  );
}

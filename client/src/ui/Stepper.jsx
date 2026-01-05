import React from "react";
const steps = ["SEED", "MUTATION", "WRITING", "VOTING", "RESULT"];
export default function Stepper({ phase }){
  return (
    <div style={{ display:"flex", gap: 10, flexWrap:"wrap" }}>
      {steps.map(s => {
        const active = s === phase;
        const done = steps.indexOf(s) < steps.indexOf(phase);
        return (
          <span
            key={s}
            className="badge"
            style={{
              borderColor: active ? "rgba(110,231,255,.45)" : "var(--border)",
              background: active ? "rgba(110,231,255,.16)" : "rgba(255,255,255,.04)",
              color: active ? "var(--text)" : done ? "rgba(134,239,172,.9)" : "var(--muted)"
            }}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

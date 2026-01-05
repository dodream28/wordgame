import React from "react";
export default function Button({ children, onClick, variant="primary", disabled=false }){
  const bg = variant === "primary" ? "rgba(110,231,255,.20)" : "rgba(255,255,255,.06)";
  const bd = variant === "primary" ? "rgba(110,231,255,.45)" : "var(--border)";
  const color = variant === "primary" ? "var(--text)" : "var(--muted)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${bd}`,
        background: bg,
        color,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? .55 : 1
      }}
    >
      {children}
    </button>
  );
}

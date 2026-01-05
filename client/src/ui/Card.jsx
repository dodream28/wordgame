import React from "react";
export default function Card({ title, right, children }){
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r)",
      padding: 16,
      boxShadow: "var(--shadow)"
    }}>
      {(title || right) && (
        <div className="row" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
          <div>{right}</div>
        </div>
      )}
      {children}
    </div>
  );
}

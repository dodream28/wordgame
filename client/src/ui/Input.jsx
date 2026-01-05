import React from "react";
export default function Input(props){
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "rgba(0,0,0,.18)",
        color: "var(--text)",
        outline: "none"
      }}
    />
  );
}

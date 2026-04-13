import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      color:"var(--color)",
    }}>
      <h1>404</h1>
      <p>Page not found</p>
      <Link className="GoHomeLink" to="/">Go Home</Link>
    </div>
  );
}

const styles = {
 GoHomeLink: {
    
 }
};

import { useEffect } from "react";
import exoress from 'express';

useEffect(() => {
  fetch("http://localhost:5000/api/spaces")
    .then(res => {
      console.log("🌐 RESPONSE STATUS:", res.status);
      return res.json();
    })
    .then(data => {
      console.log("📦 DATA FROM API:", data);
    })
    .catch(err => {
      console.error("❌ FETCH ERROR:", err);
    });
}, []);

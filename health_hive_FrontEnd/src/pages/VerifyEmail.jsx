import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyEmail } from "../api/authapi";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying...");

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;

    verifyEmail(token).then((res) => {
      setMessage(res.message || "Email verified");

      if (res.next === "role-verification") {
        navigate("/verify-credentials");
      } else {
        navigate("/dashboard");
      }
    });
  }, []);

  return <h3>{message}</h3>;
}

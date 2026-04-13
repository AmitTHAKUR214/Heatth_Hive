import { Outlet, useLocation } from "react-router-dom";
import { Suspense } from "react";
import Home from "../pages/home.jsx";
import Answers from "../pages/Answers.jsx";

export default function HomeLayout() {
  const location  = useLocation();
  const isOverlay = location.pathname.startsWith("/post/");
  const isAnswers = location.pathname.startsWith("/QA/answer");

  return (
    <>
      <div style={{ display: isAnswers ? "none" : "block", visibility: isOverlay ? "hidden" : "visible" }}>
        <Home />
      </div>

      <div style={{ display: isAnswers ? "block" : "none" }}>
        <Answers />
      </div>

      {isOverlay && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "var(--bg-color)",
          overflowY: "auto",
        }}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </div>
      )}
    </>
  );
}
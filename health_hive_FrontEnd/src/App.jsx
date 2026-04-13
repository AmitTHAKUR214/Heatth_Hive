import { Routes, Route } from "react-router-dom";
import { useEffect, lazy, Suspense,useState } from "react";
import { usePresence } from "./hooks/usePresence.js";
import HomeLayout from "./layouts/HomeLayout.jsx";
import { useNavigate } from "react-router-dom";
import { getSocket } from "./utils/socket.js";

/* ── Eager ── */
import Login         from "./pages/Login.jsx";
import VerifyEmail   from "./pages/VerifyEmail.jsx";
import SearchResults from "./pages/searchResults.jsx";
import Answers       from "./pages/Answers.jsx";
import 'leaflet/dist/leaflet.css';
import MessengerWidget from "./components/MessengerWidget.jsx";

/* ── Lazy ── */
const AskPost            = lazy(() => import("./QA/AskPost.jsx"));
const QuestionsList      = lazy(() => import("./QA/QuestionsList.jsx"));
const ViewPost           = lazy(() => import("./pages/ViewPost.jsx"));
const Spaces             = lazy(() => import("./pages/Space/Spages/Spaces.jsx"));
const CreateSpace        = lazy(() => import("./pages/Space/Spages/CreatreSpace.jsx"));
const SpacePage          = lazy(() => import("./pages/Space/Spages/SpacePage.jsx"));
const SpaceSettings      = lazy(() => import("./pages/Space/Spages/SpaceSettings.jsx"));
const SpaceDashboard     = lazy(() => import("./pages/Space/Spages/Spacedashboard.jsx"));
const MapPage            = lazy(() => import("./pages/MapPage.jsx"));
const Register           = lazy(() => import("./pages/Register.jsx"));
const ProfilePage        = lazy(() => import("./pages/profile/Profilepage.jsx"));
const NotFound           = lazy(() => import("./components/NotFound.jsx"));
const PharmacistInventoy = lazy(() => import("./pages/pharmaCorner/P_inventory_manager.jsx"));
const PharmacistHomePage = lazy(() => import("./pages/pharmaCorner/P_dashboard.jsx"));
const P_editShop         = lazy(() => import("./pages/pharmaCorner/P_editShop.jsx"));
const P_shopSettings     = lazy(() => import("./pages/pharmaCorner/P_shopSettings.jsx"));
const P_shopVerification = lazy(() => import("./pages/pharmaCorner/P_shopVerification.jsx"));
const PharmacistDetails  = lazy(() => import("./pages/pharmaCorner/PharmacistDetails.jsx"));
const AdminDashboard     = lazy(() => import("./pages/Admin/AdminDashboard.jsx"));
const AdminLogin         = lazy(() => import("./pages/Admin/AdminLogin.jsx"));
const DoctorVerification = lazy(() => import("./pages/Doctors/DoctorVerification.jsx"));
const DoctorDashboard    = lazy(() => import("./pages/Doctors/DoctorDashboard.jsx"));
const MyConsultations    = lazy(() => import("./pages/consultations/MyConsultations.jsx"));
const ConsultationChat   = lazy(() => import("./pages/consultations/ConsultationChat.jsx"));
const OnlineMembers      = lazy(() => import("./pages/online/OnlineMembers.jsx"));
const MessageInbox       = lazy(() => import("./pages/messages/MessageInbox.jsx"));
const MessageChat        = lazy(() => import("./pages/messages/MessageChat.jsx"));

const PharmacyFinder        = lazy(() => import("./pages/pharmacies/PharmacyFinder.jsx"));
const PharmacyInventoryPage = lazy(() => import("./pages/pharmacies/PharmacyInventoryPage.jsx"));

import PharmacistInventoryGuard from "./pages/pharmaCorner/P_inventoryguard";
import P_verificationGuard      from "./pages/pharmaCorner/P_verificationguard.jsx";

function App() {
  const isAdmin = window.location.pathname.startsWith("/admin");
  usePresence();
  const [widgetOpen, setWidgetOpen] = useState(false);

  useEffect(() => {
    const handler = () => setWidgetOpen(s => !s);
    window.addEventListener("toggle-messenger", handler);
    return () => window.removeEventListener("toggle-messenger", handler);
  }, []);

  useEffect(() => {
    const theme = localStorage.getItem("theme");
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ conversationId }) => {
      navigate(`/messages/${conversationId}`);
    };
    socket.on("consultation:accepted", handler);
    return () => socket.off("consultation:accepted", handler);
  }, []);

  return (
    <Suspense fallback={<div className="page-loader">Loading…</div>}>
      {!isAdmin && <MessengerWidget open={widgetOpen} onClose={() => setWidgetOpen(false)} />}
      <Routes>

        {/* ── Home layout — keeps feed mounted, ViewPost as overlay ── */}
        <Route element={<HomeLayout />}>
          <Route path="/"            element={null} />
          <Route path="/QA/answer"   element={null} />
          <Route path="/post/:id"    element={<ViewPost />} />
        </Route>

        {/* ── All other routes ── */}
        <Route path="/login"        element={<Login />} />
        <Route path="/register"     element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/QA"           element={<QuestionsList />} />
        <Route path="/QA/ask"       element={<AskPost />} />
        <Route path="/search"       element={<SearchResults />} />
        <Route path="/profile/:username"     element={<ProfilePage />} />
        <Route path="/spaces"                element={<Spaces />} />
        <Route path="/create-space"          element={<CreateSpace />} />
        <Route path="/space/:slug"           element={<SpacePage />} />
        <Route path="/space/:slug/settings"  element={<SpaceSettings />} />
        <Route path="/space/:slug/dashboard" element={<SpaceDashboard />} />
        <Route path="/mappage"               element={<MapPage />} />
        <Route path="/my-p-inventory" element={
          <PharmacistInventoryGuard><PharmacistInventoy /></PharmacistInventoryGuard>
        } />
        <Route path="/p-dashboard"                   element={<PharmacistHomePage />} />
        <Route path="/p-dashboard/shop/edit"         element={<P_editShop />} />
        <Route path="/p-dashboard/shop/shopSettings" element={<P_shopSettings />} />
        <Route path="/p-dashboard/shop/verification" element={
          <P_verificationGuard><P_shopVerification /></P_verificationGuard>
        } />
        <Route path="/admin/pharmacist/:id" element={<PharmacistDetails />} />
        <Route path="/admin"       element={<AdminDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/doctor/verify"    element={<DoctorVerification />} />
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/my-consultations" element={<MyConsultations />} />
        <Route path="/consultation/:id" element={<ConsultationChat />} />
        <Route path="/online"     element={<OnlineMembers />} />
        <Route path="/messages"          element={<MessageInbox />} />
        <Route path="/messages/:conversationId" element={<MessageChat />} />
        <Route path="*"           element={<NotFound />} />

        <Route path="/pharmacies"     element={<PharmacyFinder />} />
        <Route path="/pharmacies/:id" element={<PharmacyInventoryPage />} />
      </Routes>
    </Suspense>
  );
}

export default App;
import { useState, useEffect, useRef } from "react";
import { avatarSrc } from "../../utils/avatarsrc.js";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navbar from "../../components/Navbar";
import { getPUser } from "../../api/authapi";
import { getMessages, sendMessage } from "../../api/consultationApi";
import "./ConsultationChat.css";

const BASE = import.meta.env.VITE_API_BASE_URL;

export default function ConsultationChat() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const currentUser  = getPUser();

  const [messages,    setMessages]    = useState([]);
  const [request,     setRequest]     = useState(null);
  const [text,        setText]        = useState("");
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState("");
  const bottomRef  = useRef(null);
  const pollRef    = useRef(null);
  const lastCount  = useRef(0);

  const load = async (silent = false) => {
    try {
      const res = await getMessages(id);
      setRequest(res.data.request);
      setMessages(res.data.messages || []);
      if (!silent) setLoading(false);
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || "Failed to load chat");
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    load();
    // poll every 4s for new messages
    pollRef.current = setInterval(() => load(true), 4000);
    return () => clearInterval(pollRef.current);
  }, [id]);

  // scroll to bottom when messages change
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      lastCount.current = messages.length;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await sendMessage(id, text.trim());
      setMessages(prev => [...prev, res.data.message]);
      setText("");
    } catch (err) {
      // silent — keep text so they can retry
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!currentUser) { navigate("/login"); return null; }

  const isClosed = request?.status === "closed" || request?.status === "declined";
  const other    = currentUser.role === "doctor" ? request?.patient : request?.doctor;
  const otherLabel = currentUser.role === "doctor" ? "" : "Dr. ";

  return (
    <>
      <Navbar />
      <div className="cc-page">

        {/* Header */}
        <div className="cc-header">
          <button className="cc-back" onClick={() => navigate(-1)}>← Back</button>
          {request && (
            <div className="cc-header-info">
              <Link to={`/profile/${other?.username}`} className="cc-other-name">
                {otherLabel}{other?.name}
              </Link>
              <span className={`cc-status-pill cc-status-${request.status}`}>
                {request.status}
              </span>
            </div>
          )}
        </div>

        {loading && <div className="cc-loading">Loading conversation…</div>}
        {error   && <div className="cc-error">{error}</div>}

        {/* Initial message context */}
        {request && !loading && (
          <div className="cc-context">
            <span className="cc-context-label">Initial request</span>
            <p className="cc-context-text">{request.message}</p>
            {request.doctorNote && (
              <p className="cc-context-note">
                <strong>Doctor's note:</strong> {request.doctorNote}
              </p>
            )}
          </div>
        )}

        {/* Messages */}
        {!loading && !error && (
          <div className="cc-messages">
            {messages.length === 0 && !isClosed && (
              <p className="cc-empty-msg">No messages yet. Start the conversation.</p>
            )}

            {messages.map(m => {
              const isMe = m.sender?._id === currentUser.id || m.sender?._id === currentUser._id;
              return (
                <div key={m._id} className={`cc-bubble-row ${isMe ? "me" : "them"}`}>
                  {!isMe && (
                    <div className="cc-avatar">
                      {m.sender?.avatar
                        ? <img src={avatarSrc(m.sender.avatar)} alt={m.sender.name} />
                        : <span>{m.sender?.name?.[0]?.toUpperCase()}</span>}
                    </div>
                  )}
                  <div className={`cc-bubble ${isMe ? "me" : "them"}`}>
                    <p>{m.text}</p>
                    <span className="cc-time">
                      {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        {!loading && !error && (
          isClosed ? (
            <div className="cc-closed">This consultation is {request?.status}. No new messages can be sent.</div>
          ) : (
            <div className="cc-input-row">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                rows={2}
                className="cc-input"
                maxLength={2000}
              />
              <button onClick={handleSend} disabled={sending || !text.trim()} className="cc-send-btn">
                {sending ? "…" : "Send"}
              </button>
            </div>
          )
        )}
      </div>
    </>
  );
}
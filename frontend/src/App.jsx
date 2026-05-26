import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = "https://deskflow-4xrj.onrender.com";
const STATUSES = ["open", "in_progress", "resolved", "closed"];
const STATUS_LABELS = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };
const PRIORITY_COLORS = { low: "#6c757d", medium: "#ffc107", high: "#fd7e14", urgent: "#dc3545" };
const FORWARD = { open: "in_progress", in_progress: "resolved", resolved: "closed" };
const BACK = { in_progress: "open", resolved: "in_progress", closed: "resolved" };

function formatAge(mins) {
  if (mins < 60) return mins + "m";
  return Math.floor(mins / 60) + "h " + (mins % 60) + "m";
}

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [filterPriority, setFilterPriority] = useState("");
  const [filterBreached, setFilterBreached] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", customerEmail: "", priority: "medium" });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchTickets = useCallback(async () => {
    const params = {};
    if (filterPriority) params.priority = filterPriority;
    if (filterBreached) params.breached = "true";
    const res = await axios.get(API + "/tickets", { params });
    setTickets(res.data);
  }, [filterPriority, filterBreached]);

  const fetchStats = async () => {
    const res = await axios.get(API + "/tickets/stats");
    setStats(res.data);
  };

  useEffect(() => { fetchTickets(); fetchStats(); }, [fetchTickets]);

  const moveTicket = async (id, newStatus) => {
    try {
      await axios.patch(API + "/tickets/" + id, { status: newStatus });
      fetchTickets(); fetchStats();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const submitTicket = async () => {
    const errors = {};
    if (!form.subject.trim()) errors.subject = "Required";
    if (!form.description.trim()) errors.description = "Required";
    if (!form.customerEmail.match(/^\S+@\S+\.\S+$/)) errors.customerEmail = "Valid email required";
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setLoading(true);
    try {
      await axios.post(API + "/tickets", form);
      setForm({ subject: "", description: "", customerEmail: "", priority: "medium" });
      setFormErrors({});
      setShowForm(false);
      fetchTickets(); fetchStats();
    } catch (err) { setFormErrors({ api: err.response?.data?.error || "Error" }); }
    setLoading(false);
  };

  const deleteTicket = async (id) => {
    if (!confirm("Delete?")) return;
    await axios.delete(API + "/tickets/" + id);
    fetchTickets(); fetchStats();
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1>DeskFlow</h1>
      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {STATUSES.map(s => (
            <div key={s} style={{ background: "#f0f4ff", borderRadius: 8, padding: "8px 16px", fontSize: 14 }}>
              <strong>{STATUS_LABELS[s]}:</strong> {stats.byStatus[s]}
            </div>
          ))}
          <div style={{ background: "#fff0f0", borderRadius: 8, padding: "8px 16px", fontSize: 14, color: "#dc3545" }}>
            <strong>SLA Breached:</strong> {stats.slaBreached}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc" }}>
          <option value="">All Priorities</option>
          {["low","medium","high","urgent"].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={filterBreached} onChange={e => setFilterBreached(e.target.checked)} />
          SLA Breached Only
        </label>
        <button onClick={() => setShowForm(true)} style={{ marginLeft: "auto", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer" }}>+ New Ticket</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {STATUSES.map(status => (
          <div key={status} style={{ background: "#f8f9fa", borderRadius: 10, padding: 12, minHeight: 200 }}>
            <h3 style={{ marginTop: 0, borderBottom: "2px solid #dee2e6", paddingBottom: 8 }}>
              {STATUS_LABELS[status]}
            </h3>
            {tickets.filter(t => t.status === status).map(ticket => (
              <div key={ticket._id} style={{ background: "#fff", borderRadius: 8, padding: 12, marginBottom: 10, border: ticket.slaBreached ? "2px solid #dc3545" : "1px solid #e9ecef" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{ticket.subject}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <span style={{ background: PRIORITY_COLORS[ticket.priority], color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>{ticket.priority.toUpperCase()}</span>
                  {ticket.slaBreached && <span style={{ background: "#dc3545", color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>SLA</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6c757d", marginBottom: 8 }}>{formatAge(ticket.ageMinutes)}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {BACK[status] && <button onClick={() => moveTicket(ticket._id, BACK[status])} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>Back</button>}
                  {FORWARD[status] && <button onClick={() => moveTicket(ticket._id, FORWARD[status])} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "none", background: "#4f46e5", color: "#fff", cursor: "pointer" }}>Next</button>}
                  <button onClick={() => deleteTicket(ticket._id)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "none", background: "#dc3545", color: "#fff", cursor: "pointer" }}>Del</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: "90%", maxWidth: 480 }}>
            <h2 style={{ marginTop: 0 }}>Create Ticket</h2>
            {formErrors.api && <div style={{ color: "red" }}>{formErrors.api}</div>}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Subject</label>
              <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} style={{ width: "100%", padding: "8px", borderRadius: 6, border: formErrors.subject ? "1px solid red" : "1px solid #ccc", boxSizing: "border-box" }} />
              {formErrors.subject && <div style={{ color: "red", fontSize: 12 }}>{formErrors.subject}</div>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Email</label>
              <input value={form.customerEmail} onChange={e => setForm({...form, customerEmail: e.target.value})} style={{ width: "100%", padding: "8px", borderRadius: 6, border: formErrors.customerEmail ? "1px solid red" : "1px solid #ccc", boxSizing: "border-box" }} />
              {formErrors.customerEmail && <div style={{ color: "red", fontSize: 12 }}>{formErrors.customerEmail}</div>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Description</label>
              <textarea value={form.description} rows={3} onChange={e => setForm({...form, description: e.target.value})} style={{ width: "100%", padding: "8px", borderRadius: 6, border: formErrors.description ? "1px solid red" : "1px solid #ccc", boxSizing: "border-box" }} />
              {formErrors.description && <div style={{ color: "red", fontSize: 12 }}>{formErrors.description}</div>}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} style={{ width: "100%", padding: "8px", borderRadius: 6, border: "1px solid #ccc" }}>
                {["low","medium","high","urgent"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={submitTicket} disabled={loading} style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", flex: 1 }}>{loading ? "Creating..." : "Create Ticket"}</button>
              <button onClick={() => setShowForm(false)} style={{ background: "#f8f9fa", border: "1px solid #ccc", borderRadius: 8, padding: "10px 20px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/patient/appointments');
    setAppointments(data.appointments);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id) => {
    if (!confirm('Cancel this appointment?')) return;
    setError('');
    try {
      await api.delete(`/appointments/${id}`, { data: { reason: 'Cancelled by patient' } });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel');
    }
  };

  if (loading) return <div className="container"><p className="muted">Loading…</p></div>;

  return (
    <div className="container">
      <h2>My appointments</h2>
      {error && <div className="error-msg">{error}</div>}
      {appointments.length === 0 && <p className="muted">No appointments yet. <Link to="/patient/doctors">Find a doctor</Link></p>}
      {appointments.map((a) => (
        <div key={a._id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px' }}>Dr. {a.doctor?.name} — {a.doctorProfile?.specialization}</h3>
              <p className="muted" style={{ margin: 0 }}>{a.date} at {a.startTime}</p>
            </div>
            <span className={`badge status-${a.status}`}>{a.status}</span>
          </div>
          {a.preVisitSummary?.urgency && (
            <p style={{ marginTop: 10 }}>
              AI urgency read: <span className={`badge ${a.preVisitSummary.urgency}`}>{a.preVisitSummary.urgency}</span>
            </p>
          )}
          {a.postVisitSummary?.summaryText && (
            <div style={{ marginTop: 10, background: '#f4f7f6', padding: 12, borderRadius: 8 }}>
              <strong>Visit summary:</strong>
              <p style={{ margin: '6px 0' }}>{a.postVisitSummary.summaryText}</p>
              <p style={{ margin: '6px 0' }}><strong>Medication:</strong> {a.postVisitSummary.medicationSchedule}</p>
              <p style={{ margin: '6px 0 0' }}><strong>Follow-up:</strong> {a.postVisitSummary.followUpSteps}</p>
            </div>
          )}
          {['held', 'confirmed'].includes(a.status) && (
            <button className="btn danger" style={{ marginTop: 12 }} onClick={() => handleCancel(a._id)}>Cancel</button>
          )}
        </div>
      ))}
    </div>
  );
}

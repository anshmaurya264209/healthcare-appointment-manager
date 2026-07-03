import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('confirmed');
  const [loading, setLoading] = useState(true);

  const load = async (status) => {
    setLoading(true);
    const { data } = await api.get('/doctor/appointments', { params: status ? { status } : {} });
    setAppointments(data.appointments);
    setLoading(false);
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  return (
    <div className="container">
      <h2>My appointments</h2>
      <div className="card">
        <label className="muted">Filter by status:&nbsp;</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 200, display: 'inline-block' }}>
          <option value="">All</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="leave-cancelled">Leave-cancelled</option>
        </select>
      </div>

      {loading ? <p className="muted">Loading…</p> : appointments.length === 0 ? (
        <p className="muted">No appointments in this view.</p>
      ) : (
        appointments.map((a) => (
          <div key={a._id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 4px' }}>{a.patient?.name}</h3>
                <p className="muted" style={{ margin: 0 }}>{a.date} at {a.startTime} · {a.patient?.phone}</p>
              </div>
              <span className={`badge status-${a.status}`}>{a.status}</span>
            </div>

            {a.preVisitSummary?.chiefComplaint && (
              <div style={{ marginTop: 10, background: '#f4f7f6', padding: 12, borderRadius: 8 }}>
                <span className={`badge ${a.preVisitSummary.urgency}`}>{a.preVisitSummary.urgency} urgency</span>
                <p style={{ margin: '8px 0 4px' }}><strong>Chief complaint:</strong> {a.preVisitSummary.chiefComplaint}</p>
                {a.preVisitSummary.suggestedQuestions?.length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {a.preVisitSummary.suggestedQuestions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                )}
                {a.preVisitSummary.failed && <p className="muted">⚠️ AI summary generation failed — showing raw symptoms only.</p>}
              </div>
            )}

            {a.status === 'confirmed' && (
              <Link to={`/doctor/appointments/${a._id}/complete`}>
                <button className="btn" style={{ marginTop: 12 }}>Complete visit</button>
              </Link>
            )}
          </div>
        ))
      )}
    </div>
  );
}

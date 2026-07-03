import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [leaveDate, setLeaveDate] = useState({}); // profileId -> date input
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await api.get('/admin/doctors');
    setDoctors(data.doctors);
  };

  useEffect(() => { load(); }, []);

  const addLeave = async (profileId) => {
    const date = leaveDate[profileId];
    if (!date) return;
    setError(''); setMessage('');
    try {
      const { data } = await api.post(`/admin/doctors/${profileId}/leave`, { date });
      setMessage(data.message);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add leave day');
    }
  };

  const removeLeave = async (profileId, date) => {
    await api.delete(`/admin/doctors/${profileId}/leave/${date}`);
    load();
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Doctors</h2>
        <Link to="/admin/doctors/new"><button className="btn">+ Add doctor</button></Link>
      </div>
      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      {doctors.map((d) => (
        <div key={d._id} className="card">
          <h3 style={{ margin: '0 0 4px' }}>Dr. {d.user?.name} — {d.specialization}</h3>
          <p className="muted" style={{ margin: '0 0 10px' }}>{d.user?.email} · {d.slotDurationMinutes} min slots</p>

          <div>
            <strong>Leave days:</strong>{' '}
            {d.leaveDays.length === 0 ? <span className="muted">None</span> : d.leaveDays.map((ld) => {
              const iso = new Date(ld).toISOString().slice(0, 10);
              return (
                <span key={iso} className="badge status-cancelled" style={{ marginRight: 6 }}>
                  {iso} <button onClick={() => removeLeave(d._id, iso)} style={{ marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
                </span>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <input type="date" style={{ width: 180 }} onChange={(e) => setLeaveDate({ ...leaveDate, [d._id]: e.target.value })} />
            <button className="btn secondary" onClick={() => addLeave(d._id)}>Mark on leave</button>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            Marking a leave day auto-cancels existing confirmed bookings on that date and emails affected patients.
          </p>
        </div>
      ))}
    </div>
  );
}

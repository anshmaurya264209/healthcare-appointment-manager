import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CreateDoctor() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', specialization: '', bio: '',
    slotDurationMinutes: 30, consultationFee: 0,
  });
  const [workingDays, setWorkingDays] = useState({}); // day -> {start, end, enabled}
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleDay = (day) => {
    setWorkingDays((wd) => ({
      ...wd,
      [day]: wd[day]?.enabled ? { ...wd[day], enabled: false } : { start: '09:00', end: '17:00', enabled: true },
    }));
  };

  const updateDayTime = (day, field, value) => {
    setWorkingDays((wd) => ({ ...wd, [day]: { ...wd[day], [field]: value } }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const workingHours = Object.entries(workingDays)
      .filter(([, v]) => v.enabled)
      .map(([day, v]) => ({ day, start: v.start, end: v.end }));

    try {
      await api.post('/admin/doctors', { ...form, workingHours });
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create doctor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="card">
        <h2>Add doctor</h2>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label>Full name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Specialization</label>
              <input required value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Temp password</label>
              <input type="text" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Slot duration (min)</label>
              <input type="number" min={5} value={form.slotDurationMinutes} onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-group">
            <label>Bio</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>

          <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--muted)' }}>Working hours</label>
          {DAYS.map((day) => (
            <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
              <label style={{ width: 90, marginBottom: 0 }}>
                <input type="checkbox" checked={!!workingDays[day]?.enabled} onChange={() => toggleDay(day)} /> {day}
              </label>
              {workingDays[day]?.enabled && (
                <>
                  <input type="time" style={{ width: 120 }} value={workingDays[day].start} onChange={(e) => updateDayTime(day, 'start', e.target.value)} />
                  <span>to</span>
                  <input type="time" style={{ width: 120 }} value={workingDays[day].end} onChange={(e) => updateDayTime(day, 'end', e.target.value)} />
                </>
              )}
            </div>
          ))}

          <button className="btn" type="submit" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? 'Creating…' : 'Create doctor'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookAppointment() {
  const { profileId } = useParams();
  const navigate = useNavigate();

  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [held, setHeld] = useState(null); // held appointment object
  const [holdDeadline, setHoldDeadline] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  const loadSlots = async (d) => {
    setError('');
    setSelectedSlot(null);
    const { data } = await api.get(`/patient/doctors/${profileId}/slots`, { params: { date: d } });
    setSlots(data.slots);
  };

  useEffect(() => { loadSlots(date); /* eslint-disable-next-line */ }, [date]);

  const handleHold = async () => {
    if (!selectedSlot) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/appointments/hold', {
        doctorProfileId: profileId,
        date,
        startTime: selectedSlot,
      });
      setHeld(data.appointment);
      setHoldDeadline(Date.now() + data.holdExpiresInMinutes * 60 * 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not hold this slot');
      loadSlots(date);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(`/appointments/${held._id}/confirm`, { symptoms });
      setConfirmed(data.appointment);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not confirm booking');
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card">
          <h2>✅ Appointment confirmed</h2>
          <p>Your appointment is booked for <strong>{confirmed.date} at {confirmed.startTime}</strong>.</p>
          <p className="muted">A confirmation email has been sent, and it's been added to your Google Calendar if connected.</p>
          <button className="btn" onClick={() => navigate('/patient/appointments')}>View my appointments</button>
        </div>
      </div>
    );
  }

  if (held) {
    const minutesLeft = Math.max(0, Math.round((holdDeadline - Date.now()) / 60000));
    return (
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card">
          <h2>Tell us your symptoms</h2>
          <p className="muted">Slot held: {held.date} at {held.startTime} — please confirm within ~{minutesLeft} min or it will be released.</p>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleConfirm}>
            <div className="form-group">
              <label>Describe your symptoms</label>
              <textarea required value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. fever for 2 days, sore throat, mild headache..." />
            </div>
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Confirming…' : 'Confirm appointment'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="card">
        <h2>Pick a slot</h2>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label>Date</label>
          <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {slots.length === 0 ? (
          <p className="muted">No available slots for this date. Try another date.</p>
        ) : (
          <div className="slot-grid">
            {slots.map((s) => (
              <button
                key={s.startTime}
                className={`slot-btn ${selectedSlot === s.startTime ? 'selected' : ''}`}
                onClick={() => setSelectedSlot(s.startTime)}
              >
                {s.startTime}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn" disabled={!selectedSlot || loading} onClick={handleHold}>
            {loading ? 'Holding slot…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

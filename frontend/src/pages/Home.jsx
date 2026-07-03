import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const connectCalendar = async () => {
    const { data } = await api.get('/calendar/oauth/connect');
    window.location.href = data.url;
  };

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card">
          <h1>City Health Clinic</h1>
          <p>Book appointments, get AI-assisted pre-visit summaries for your doctor, and receive
            patient-friendly post-visit summaries — all synced to your email and Google Calendar.</p>
          <button className="btn" onClick={() => navigate('/login')}>Log in</button>{' '}
          <button className="btn secondary" onClick={() => navigate('/register')}>Register</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="card">
        <h1>Welcome, {user.name}</h1>
        <p className="muted">
          {user.googleCalendarConnected ? '✅ Google Calendar connected' : 'Connect Google Calendar so appointments sync automatically.'}
        </p>
        {!user.googleCalendarConnected && (
          <button className="btn secondary" onClick={connectCalendar}>Connect Google Calendar</button>
        )}
        <div style={{ marginTop: 16 }}>
          {user.role === 'patient' && <button className="btn" onClick={() => navigate('/patient/doctors')}>Find a doctor</button>}
          {user.role === 'doctor' && <button className="btn" onClick={() => navigate('/doctor/appointments')}>My appointments</button>}
          {user.role === 'admin' && <button className="btn" onClick={() => navigate('/admin')}>Admin dashboard</button>}
        </div>
      </div>
    </div>
  );
}

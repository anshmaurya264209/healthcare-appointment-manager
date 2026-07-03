import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

export default function DoctorSearch() {
  const [doctors, setDoctors] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async (specialization = '') => {
    setLoading(true);
    const { data } = await api.get('/patient/doctors', { params: specialization ? { specialization } : {} });
    setDoctors(data.doctors);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="container">
      <h2>Find a doctor</h2>
      <div className="card">
        <div style={{ display: 'flex', gap: 10 }}>
          <input placeholder="Search by specialization (e.g. Cardiology)" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" onClick={() => load(q)}>Search</button>
        </div>
      </div>

      {loading ? <p className="muted">Loading…</p> : doctors.length === 0 ? (
        <p className="muted">No doctors found.</p>
      ) : (
        doctors.map((d) => (
          <div key={d._id} className="card doctor-card">
            <div>
              <h3 style={{ margin: '0 0 4px' }}>Dr. {d.user.name}</h3>
              <p className="muted" style={{ margin: 0 }}>{d.specialization} · {d.slotDurationMinutes} min slots</p>
              {d.bio && <p style={{ margin: '6px 0 0' }}>{d.bio}</p>}
            </div>
            <button className="btn" onClick={() => navigate(`/patient/book/${d._id}`)}>Book</button>
          </div>
        ))
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const emptyItem = () => ({ medicine: '', dosage: '', frequency: '', durationDays: 5, instructions: '' });

export default function CompleteVisit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState([emptyItem()]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get(`/doctor/appointments/${id}`).then(({ data }) => setAppt(data.appointment));
  }, [id]);

  const updateItem = (idx, field, value) => {
    setPrescription((p) => p.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const addItem = () => setPrescription((p) => [...p, emptyItem()]);
  const removeItem = (idx) => setPrescription((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(`/doctor/appointments/${id}/complete`, {
        notes,
        prescription: prescription.filter((p) => p.medicine.trim()),
      });
      setResult(data.appointment);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not complete visit');
    } finally {
      setLoading(false);
    }
  };

  if (!appt) return <div className="container"><p className="muted">Loading…</p></div>;

  if (result) {
    return (
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card">
          <h2>✅ Visit completed</h2>
          <p className="muted">Patient-friendly summary generated and emailed to {appt.patient?.name}.</p>
          <div style={{ background: '#f4f7f6', padding: 12, borderRadius: 8 }}>
            <p><strong>Summary:</strong> {result.postVisitSummary.summaryText}</p>
            <p><strong>Medication schedule:</strong> {result.postVisitSummary.medicationSchedule}</p>
            <p><strong>Follow-up:</strong> {result.postVisitSummary.followUpSteps}</p>
            {result.postVisitSummary.failed && <p className="muted">⚠️ AI generation failed; fallback text was used.</p>}
          </div>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => navigate('/doctor/appointments')}>Back to appointments</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="card">
        <h2>Complete visit — {appt.patient?.name}</h2>
        <p className="muted">{appt.date} at {appt.startTime}</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Clinical notes</label>
            <textarea required value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Diagnosis, observations, advice..." />
          </div>

          <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--muted)' }}>Prescription</label>
          {prescription.map((item, idx) => (
            <div key={idx} className="card" style={{ marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Medicine</label>
                  <input value={item.medicine} onChange={(e) => updateItem(idx, 'medicine', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Dosage</label>
                  <input value={item.dosage} onChange={(e) => updateItem(idx, 'dosage', e.target.value)} placeholder="e.g. 500mg" />
                </div>
                <div className="form-group">
                  <label>Frequency</label>
                  <input value={item.frequency} onChange={(e) => updateItem(idx, 'frequency', e.target.value)} placeholder="e.g. 2x/day" />
                </div>
                <div className="form-group">
                  <label>Duration (days)</label>
                  <input type="number" min={1} value={item.durationDays} onChange={(e) => updateItem(idx, 'durationDays', Number(e.target.value))} />
                </div>
              </div>
              <div className="form-group">
                <label>Instructions</label>
                <input value={item.instructions} onChange={(e) => updateItem(idx, 'instructions', e.target.value)} placeholder="e.g. after food" />
              </div>
              {prescription.length > 1 && (
                <button type="button" className="btn secondary" onClick={() => removeItem(idx)}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={addItem}>+ Add medicine</button>

          <div style={{ marginTop: 18 }}>
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Generating summary…' : 'Complete visit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useSearchParams, Link } from 'react-router-dom';

export default function CalendarConnected() {
  const [params] = useSearchParams();
  const status = params.get('status');

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card">
        {status === 'success' ? (
          <>
            <h2>✅ Google Calendar connected</h2>
            <p className="muted">Your appointments will now sync automatically.</p>
          </>
        ) : (
          <>
            <h2>⚠️ Connection failed</h2>
            <p className="muted">We couldn't connect your Google Calendar. Please try again.</p>
          </>
        )}
        <Link to="/"><button className="btn">Back to home</button></Link>
      </div>
    </div>
  );
}

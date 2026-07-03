import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">🏥 City Health Clinic</Link>
      <div className="nav-links">
        {!user && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
        {user?.role === 'patient' && (
          <>
            <Link to="/patient/doctors">Find a Doctor</Link>
            <Link to="/patient/appointments">My Appointments</Link>
          </>
        )}
        {user?.role === 'doctor' && <Link to="/doctor/appointments">My Appointments</Link>}
        {user?.role === 'admin' && (
          <>
            <Link to="/admin">Dashboard</Link>
            <Link to="/admin/doctors/new">Add Doctor</Link>
          </>
        )}
        {user && (
          <span className="user-chip">
            {user.name} ({user.role}) <button onClick={handleLogout}>Logout</button>
          </span>
        )}
      </div>
    </nav>
  );
}

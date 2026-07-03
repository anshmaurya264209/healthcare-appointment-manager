import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CalendarConnected from './pages/CalendarConnected';

import DoctorSearch from './pages/patient/DoctorSearch';
import BookAppointment from './pages/patient/BookAppointment';
import MyAppointments from './pages/patient/MyAppointments';

import DoctorAppointments from './pages/doctor/DoctorAppointments';
import CompleteVisit from './pages/doctor/CompleteVisit';

import AdminDashboard from './pages/admin/AdminDashboard';
import CreateDoctor from './pages/admin/CreateDoctor';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/calendar-connected" element={<CalendarConnected />} />

        <Route path="/patient/doctors" element={<ProtectedRoute roles={['patient']}><DoctorSearch /></ProtectedRoute>} />
        <Route path="/patient/book/:profileId" element={<ProtectedRoute roles={['patient']}><BookAppointment /></ProtectedRoute>} />
        <Route path="/patient/appointments" element={<ProtectedRoute roles={['patient']}><MyAppointments /></ProtectedRoute>} />

        <Route path="/doctor/appointments" element={<ProtectedRoute roles={['doctor']}><DoctorAppointments /></ProtectedRoute>} />
        <Route path="/doctor/appointments/:id/complete" element={<ProtectedRoute roles={['doctor']}><CompleteVisit /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/doctors/new" element={<ProtectedRoute roles={['admin']}><CreateDoctor /></ProtectedRoute>} />

        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}

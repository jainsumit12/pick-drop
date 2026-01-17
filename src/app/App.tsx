import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login, logout } from '../store/slices/authSlice';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set Mapbox access token globally
mapboxgl.accessToken = "pk.eyJ1Ijoic2lkaHVkaGlsbG9udGVhbSIsImEiOiJjbTVwMm1mYXYwZ2k4MmtzMWhnbjQ1Z2E0In0.gK3s6yddFXNErt-IbgZ26g";

interface User {
  username: string;
  role: string;
}

export default function App() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const handleLogin = (userData: User) => {
    dispatch(login(userData));
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/dashboard/going" replace /> : <Login onLogin={handleLogin} />
          }
        />

        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <Dashboard user={user!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/dashboard/going" : "/login"} replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Alert } from '@mui/material';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** UI guard only: the API enforces the role on every request regardless of what the interface shows. */
export function RequireAdmin() {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== 'admin') return <Alert severity="warning">This page is for administrators.</Alert>;
  return <Outlet />;
}

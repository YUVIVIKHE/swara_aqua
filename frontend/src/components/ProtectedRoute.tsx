import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, Role } from '../context/AuthContext';
import Spinner from './Spinner';

interface Props {
  children: React.ReactNode;
  allowedRole: Role;
}

const ProtectedRoute = ({ children, allowedRole }: Props) => {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== allowedRole) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;

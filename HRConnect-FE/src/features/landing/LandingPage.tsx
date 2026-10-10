import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { HomePage } from './HomePage';

const WORKSPACE_BY_ROLE: Partial<Record<UserRole, string>> = {
  [UserRole.CANDIDATE]: '/candidate/dashboard',
  [UserRole.AFFILIATE]: '/affiliate/dashboard',
  [UserRole.CLIENT]: '/client/dashboard',
  [UserRole.INTERNAL_HR]: '/hr/dashboard',
  [UserRole.ADMIN]: '/admin/dashboard',
};

export const LandingPage: React.FC = () => {
  const { isAuthenticated, role } = useAuthStore();
  const workspace = WORKSPACE_BY_ROLE[role];

  if (isAuthenticated && workspace) {
    return <Navigate to={workspace} replace />;
  }

  return <HomePage />;
};

export { HomePage };
export default LandingPage;

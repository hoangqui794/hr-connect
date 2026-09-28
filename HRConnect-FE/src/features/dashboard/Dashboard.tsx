import React, { useEffect } from 'react';
import { Card, Typography, Button, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { getDashboardRouteForRole } from '@/routes/AppRoutes';

const { Title, Text } = Typography;

export const Dashboard: React.FC = () => {
  const { role, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && role && role !== UserRole.GUEST) {
      const target = getDashboardRouteForRole(role);
      if (target && target !== '/dashboard') {
        navigate(target, { replace: true });
      }
    }
  }, [role, isAuthenticated, navigate]);

  if (!isAuthenticated || role === UserRole.GUEST) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="b2b-card p-8 max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-2xl flex items-center justify-center mx-auto">
            🔐
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Vui lòng đăng nhập
          </h2>
          <p className="text-xs text-slate-400">
            Chọn tài khoản phù hợp với vai trò của bạn để truy cập không gian làm việc.
          </p>
          <Button
            type="primary"
            onClick={() => navigate('/login')}
            className="h-10 px-6 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 border-none"
          >
            Đăng nhập ngay
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <Spin size="large" />
      <span className="text-xs text-slate-400 font-medium">
        Đang đồng bộ không gian làm việc {user?.name || ''}...
      </span>
    </div>
  );
};

export default Dashboard;

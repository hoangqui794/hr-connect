import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import {
  candidateService,
  CandidateProfileData,
  UpdateCandidateProfileCommand,
} from '@/services/candidateService';

export const CANDIDATE_PROFILE_UPDATED_EVENT = 'hrconnect:candidate-profile-updated';

export const useCandidateProfile = () => {
  const { user, role, isAuthenticated, updateUser } = useAuthStore();
  const [profile, setProfile] = useState<CandidateProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    // Only fetch if authenticated as candidate or has active token
    const token =
      localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }

    // Role check: If role is explicitly another non-candidate role (e.g. ADMIN/CLIENT), don't force candidate profile unless needed
    if (role && role !== UserRole.CANDIDATE && role !== UserRole.GUEST) {
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await candidateService.getProfile();
      if (res.success && res.data) {
        setProfile(res.data);

        // Sync basic info back into authStore if not yet synced
        if (updateUser) {
          const updates: any = {};
          if (res.data.fullName && res.data.fullName !== user?.name) {
            updates.name = res.data.fullName;
          }
          if (res.data.email && res.data.email !== user?.email) {
            updates.email = res.data.email;
          }
          if (res.data.avatarUrl && res.data.avatarUrl !== user?.avatar) {
            updates.avatar = res.data.avatarUrl;
          }
          if (Object.keys(updates).length > 0) {
            updateUser(updates);
          }
        }

        return res.data;
      }
    } catch (err: any) {
      // Gracefully handle unauthenticated/network error without throwing
      const message = err?.response?.data?.message || err?.message || 'Không thể tải thông tin hồ sơ';
      setError(message);
    } finally {
      setLoading(false);
    }
    return null;
  }, [role, user?.name, user?.email, user?.avatar, updateUser]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, fetchProfile]);

  // Listen for global profile update events
  useEffect(() => {
    const handleProfileUpdated = () => {
      fetchProfile();
    };
    window.addEventListener(CANDIDATE_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => {
      window.removeEventListener(CANDIDATE_PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
  }, [fetchProfile]);

  const updateProfile = useCallback(
    async (command: UpdateCandidateProfileCommand) => {
      try {
        setLoading(true);
        const res = await candidateService.updateProfile(command);
        if (res.success && res.data) {
          setProfile(res.data);
          if (updateUser && res.data.fullName) {
            updateUser({ name: res.data.fullName });
          }
          window.dispatchEvent(new CustomEvent(CANDIDATE_PROFILE_UPDATED_EVENT));
          return res.data;
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || 'Không thể cập nhật hồ sơ';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
      return null;
    },
    [updateUser]
  );

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile,
  };
};

export default useCandidateProfile;

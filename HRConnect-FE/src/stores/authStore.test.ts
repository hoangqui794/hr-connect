import { beforeEach, describe, expect, it } from 'vitest';
import { authTokenStorage } from '@/services/authTokenStorage';
import { UserRole } from '@/types/roles';
import { useAuthStore } from './authStore';

describe('auth store claims', () => {
  beforeEach(() => {
    authTokenStorage.clear();
    useAuthStore.setState({ role: UserRole.GUEST, user: null, isAuthenticated: false });
  });

  it('keeps every role, permission and verification field returned by the API', () => {
    useAuthStore.getState().setAuthSession(
      {
        userId: 'user-1',
        email: 'candidate@example.com',
        displayName: 'Candidate One',
        status: 'ACTIVE',
        emailVerified: true,
        roles: ['CANDIDATE', 'AFFILIATE_RECRUITER'],
        permissions: ['submission.create', 'submission.view_own'],
      },
      'access-token',
      'refresh-token'
    );

    const state = useAuthStore.getState();
    expect(state.user).toMatchObject({
      roles: ['CANDIDATE', 'AFFILIATE_RECRUITER'],
      permissions: ['submission.create', 'submission.view_own'],
      status: 'ACTIVE',
      emailVerified: true,
    });
    expect(state.hasAnyRole([UserRole.CANDIDATE])).toBe(true);
    expect(state.hasAnyRole([UserRole.AFFILIATE])).toBe(true);
    expect(state.hasPermission('submission.create')).toBe(true);
  });

  it('replaces the stored refresh token when the backend rotates it', () => {
    authTokenStorage.save({ accessToken: 'access-1', refreshToken: 'refresh-old' });
    authTokenStorage.save({ accessToken: 'access-2', refreshToken: 'refresh-new' });

    expect(authTokenStorage.getAccessToken()).toBe('access-2');
    expect(authTokenStorage.getRefreshToken()).toBe('refresh-new');
  });
});

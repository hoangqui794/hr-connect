import { beforeEach, describe, expect, it } from 'vitest';
import { authTokenStorage } from '@/services/authTokenStorage';
import { UserRole } from '@/types/roles';
import { followSessionChangeFromOtherTab, useAuthStore } from './authStore';

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

describe('auth store across tabs', () => {
  beforeEach(() => {
    authTokenStorage.clear();
    localStorage.removeItem('hr-connect-auth');
    useAuthStore.setState({ role: UserRole.GUEST, user: null, isAuthenticated: false });
  });

  const persistedSession = (role: UserRole, email: string) =>
    JSON.stringify({ state: { role, user: { id: email, name: email, email, role }, isAuthenticated: true }, version: 0 });

  it('switches to the account another tab signed in with', async () => {
    useAuthStore.setState({
      role: UserRole.CLIENT,
      user: { id: 'c', name: 'Client', email: 'client@example.com', role: UserRole.CLIENT },
      isAuthenticated: true,
    });
    // Another tab logs out the client and signs in as an admin.
    authTokenStorage.save({ accessToken: 'admin-token' });
    localStorage.setItem('hr-connect-auth', persistedSession(UserRole.ADMIN, 'admin@example.com'));

    await followSessionChangeFromOtherTab(new StorageEvent('storage', { key: 'hr-connect-auth' }));

    expect(useAuthStore.getState().role).toBe(UserRole.ADMIN);
    expect(useAuthStore.getState().user?.email).toBe('admin@example.com');
  });

  it('logs this tab out when another tab logged out', async () => {
    useAuthStore.setState({
      role: UserRole.CLIENT,
      user: { id: 'c', name: 'Client', email: 'client@example.com', role: UserRole.CLIENT },
      isAuthenticated: true,
    });
    localStorage.setItem('hr-connect-auth', persistedSession(UserRole.CLIENT, 'client@example.com'));
    // Tokens removed by the other tab's logout.

    await followSessionChangeFromOtherTab(new StorageEvent('storage', { key: 'access_token' }));

    expect(useAuthStore.getState().role).toBe(UserRole.GUEST);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('ignores unrelated storage keys', async () => {
    expect(await followSessionChangeFromOtherTab(new StorageEvent('storage', { key: 'saved_jobs' }))).toBe(false);
  });
});

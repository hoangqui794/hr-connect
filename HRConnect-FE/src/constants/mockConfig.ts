/**
 * @file mockConfig.ts
 * @description Safe Mock Data configuration & centralized store reset utility.
 */

export const isMockEnabled = (): boolean => {
  return (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_USE_MOCK === 'true';
};

export const resetAllAppStores = () => {
  try {
    localStorage.removeItem('hr-connect-auth');
    localStorage.removeItem('hr-connect-candidate-data');
    localStorage.removeItem('hr-connect-job-draft');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
    sessionStorage.clear();
  } catch (err) {
    console.error('Error resetting storage:', err);
  }
};

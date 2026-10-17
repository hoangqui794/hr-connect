/**
 * @file accountService.ts
 * @description Persistent account management service for HR Connect.
 * Uses hrconnect_users in localStorage as the Single Source of Truth.
 */

import { UserRole } from '@/types/roles';

export interface RegisteredAccount {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  companyName?: string;
  companySize?: string;
  createdAt: string;
}

export const REGISTERED_ACCOUNTS_KEY = 'hrconnect_users';

export const getRegisteredAccounts = (): RegisteredAccount[] => {
  try {
    const raw = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const findRegisteredAccountByEmail = (email: string): RegisteredAccount | undefined => {
  const norm = email.trim().toLowerCase();
  return getRegisteredAccounts().find((u) => u.email.toLowerCase() === norm);
};

export const saveRegisteredAccount = (
  account: Omit<RegisteredAccount, 'id' | 'createdAt'> & { id?: string }
): RegisteredAccount => {
  const users = getRegisteredAccounts();
  const existingIndex = users.findIndex(
    (u) => u.email.toLowerCase() === account.email.toLowerCase()
  );
  const now = new Date().toISOString();
  let saved: RegisteredAccount;
  if (existingIndex >= 0) {
    saved = { ...users[existingIndex], ...account };
    users[existingIndex] = saved;
  } else {
    saved = {
      ...account,
      id: account.id || `usr-${Date.now()}`,
      createdAt: now,
    };
    users.push(saved);
  }
  try {
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
  return saved;
};

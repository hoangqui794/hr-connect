/**
 * @file accountService.ts
 * @description Persistent account management service for HR Connect.
 * Stores registered accounts in localStorage to preserve Role and user profile identity
 * across Register and Login flows.
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

const REGISTERED_ACCOUNTS_KEY = 'hr-connect-registered-accounts';

// Pre-seeded demo accounts
const SEED_ACCOUNTS: RegisteredAccount[] = [
  {
    id: 'usr-client-001',
    email: 'client@demo.com',
    password: 'demoPassword123',
    role: UserRole.CLIENT,
    fullName: 'Sarah Chen',
    phone: '0901234567',
    companyName: 'TechCorp Việt Nam',
    companySize: '51-200',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-client-002',
    email: 'sarah.chen@techcorp.vn',
    password: 'demoPassword123',
    role: UserRole.CLIENT,
    fullName: 'Sarah Chen',
    phone: '0901234567',
    companyName: 'TechCorp Việt Nam',
    companySize: '51-200',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-affiliate-001',
    email: 'affiliate@demo.com',
    password: 'demoPassword123',
    role: UserRole.AFFILIATE,
    fullName: 'David Tran',
    phone: '0912345678',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-affiliate-002',
    email: 'david.tran@recruitpro.vn',
    password: 'demoPassword123',
    role: UserRole.AFFILIATE,
    fullName: 'David Tran',
    phone: '0912345678',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-candidate-001',
    email: 'candidate@demo.com',
    password: 'demoPassword123',
    role: UserRole.CANDIDATE,
    fullName: 'Nguyễn Văn A',
    phone: '0923456789',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-candidate-002',
    email: 'minh.nguyen@gmail.com',
    password: 'demoPassword123',
    role: UserRole.CANDIDATE,
    fullName: 'Nguyễn Văn Minh',
    phone: '0923456789',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-hr-001',
    email: 'hr@demo.com',
    password: 'demoPassword123',
    role: UserRole.INTERNAL_HR,
    fullName: 'Lisa Pham',
    phone: '0934567890',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-hr-002',
    email: 'lisa.pham@hrconnect.io',
    password: 'demoPassword123',
    role: UserRole.INTERNAL_HR,
    fullName: 'Lisa Pham',
    phone: '0934567890',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-admin-001',
    email: 'admin@demo.com',
    password: 'demoPassword123',
    role: UserRole.ADMIN,
    fullName: 'Platform Admin',
    phone: '0945678901',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-admin-002',
    email: 'alex@hrconnect.io',
    password: 'demoPassword123',
    role: UserRole.ADMIN,
    fullName: 'Alex Admin',
    phone: '0945678901',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const getRegisteredAccounts = (): RegisteredAccount[] => {
  try {
    const raw = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
    if (!raw) {
      // Initialize with seed accounts
      localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(SEED_ACCOUNTS));
      return SEED_ACCOUNTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED_ACCOUNTS;
    // Ensure all SEED_ACCOUNTS are present if not overridden by user
    const existingEmails = new Set(parsed.map((a: RegisteredAccount) => a.email.toLowerCase()));
    const missingSeeds = SEED_ACCOUNTS.filter((s) => !existingEmails.has(s.email.toLowerCase()));
    return [...parsed, ...missingSeeds];
  } catch (err) {
    console.error('Failed to parse registered accounts:', err);
    return SEED_ACCOUNTS;
  }
};

export const findRegisteredAccountByEmail = (email: string): RegisteredAccount | undefined => {
  if (!email) return undefined;
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = getRegisteredAccounts();
  return accounts.find((a) => a.email.trim().toLowerCase() === normalizedEmail);
};

export const saveRegisteredAccount = (
  account: Omit<RegisteredAccount, 'id' | 'createdAt'> & { id?: string }
): RegisteredAccount => {
  const accounts = getRegisteredAccounts();
  const normalizedEmail = account.email.trim().toLowerCase();
  const normalizedRole = (account.role || UserRole.CANDIDATE).toUpperCase() as UserRole;

  const existingIndex = accounts.findIndex((a) => a.email.trim().toLowerCase() === normalizedEmail);
  const newAccount: RegisteredAccount = {
    id: account.id || `usr-${normalizedRole.toLowerCase()}-${Date.now()}`,
    email: normalizedEmail,
    password: account.password || 'password123',
    role: normalizedRole,
    fullName: account.fullName.trim(),
    phone: account.phone?.trim(),
    companyName: normalizedRole === UserRole.CLIENT ? account.companyName?.trim() : undefined,
    companySize: normalizedRole === UserRole.CLIENT ? account.companySize : undefined,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = {
      ...accounts[existingIndex],
      ...newAccount,
    };
  } else {
    accounts.push(newAccount);
  }

  try {
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save registered account:', err);
  }

  return newAccount;
};

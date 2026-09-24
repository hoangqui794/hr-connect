/**
 * @file accountService.ts
 * @description Persistent account management service for HR Connect.
 * Uses hrconnect_users in localStorage as the Single Source of Truth.
 */

import { UserRole } from '@/types/roles';
import {
  getHRConnectUsers,
  saveHRConnectUser,
  findHRConnectUserByEmail as findHRUser,
  HRConnectUser,
  STORAGE_KEYS,
  PRESEEDED_TEST_ACCOUNTS,
} from '@/services/localStorageService';

export interface RegisteredAccount extends HRConnectUser {}

export const REGISTERED_ACCOUNTS_KEY = STORAGE_KEYS.USERS;

export const SEED_ACCOUNTS: RegisteredAccount[] = PRESEEDED_TEST_ACCOUNTS;

export const getRegisteredAccounts = (): RegisteredAccount[] => {
  return getHRConnectUsers();
};

export const findRegisteredAccountByEmail = (email: string): RegisteredAccount | undefined => {
  return findHRUser(email);
};

export const saveRegisteredAccount = (
  account: Omit<RegisteredAccount, 'id' | 'createdAt'> & { id?: string }
): RegisteredAccount => {
  return saveHRConnectUser(account);
};

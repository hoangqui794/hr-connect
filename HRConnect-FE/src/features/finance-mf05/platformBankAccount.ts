/**
 * HR Connect's receiving bank account and the transfer notes Admin matches payments by. Shared by every place
 * that asks a Client to transfer money (posting fee / deposit modal, Công nợ page) so they never disagree.
 */
export const PLATFORM_BANK_ACCOUNT = {
  bankName: 'MB Bank (TMCP Quân Đội)',
  vietQrBankCode: 'MB',
  accountNumber: '0988776655',
  accountHolder: 'CONG TY CO PHAN HR CONNECT',
} as const;

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export const transferNote = (jobId: string) => `HRC ${shortId(jobId)}`;
export const depositTransferNote = (jobId: string) => `COC ${shortId(jobId)}`;
export const serviceFeeTransferNote = (serviceFeeId: string) => `PHI ${shortId(serviceFeeId)}`;

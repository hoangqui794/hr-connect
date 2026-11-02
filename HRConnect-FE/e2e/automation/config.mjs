export const CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'https://hr-connect-iota.vercel.app',
  defaultPassword: process.env.TEST_PASSWORD || '111111Aa@',
  headless: process.env.HEADLESS === 'true' ? true : false,
  slowMo: Number(process.env.SLOW_MO || 600),
  accounts: {
    admin: { email: 'admin@gmail.com', role: 'Platform Admin' },
    hr: { email: 'internalhr@gmail.com', role: 'Internal HR' },
    client: { email: 'client@gmail.com', role: 'Client' },
    affiliate: { email: 'affiliate@gmail.com', role: 'Affiliate' },
    candidate: { email: 'candidate@gmail.com', role: 'Candidate' }
  }
};

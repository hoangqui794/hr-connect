// Load test for the job search path (topic form, Work Package 6 and NFR "job search returns fast").
// Read-only: it only calls GET /api/v1/public/jobs, so it is safe to point at staging or production.
//
// Run (no install, through Docker):
//   docker run --rm -i -e BASE_URL=https://<backend-host> grafana/k6:0.54.0 run - < tests/load/job-search.k6.js
// Or with k6 installed:  k6 run -e BASE_URL=http://localhost:5000 tests/load/job-search.k6.js
//
// Pass mark (thresholds below): p95 latency under 1 s and under 1% failed requests at 50 virtual users.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const PEAK_USERS = Number(__ENV.PEAK_USERS || 50);

export const options = {
  scenarios: {
    search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(PEAK_USERS / 2) },
        { duration: '1m', target: PEAK_USERS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    'http_req_duration{kind:keyword}': ['p(95)<1000'],
    'http_req_duration{kind:filters}': ['p(95)<1000'],
  },
};

// The searches a visitor really makes on /jobs: plain list, keyword, and the filter panel.
const KEYWORDS = ['developer', 'kế toán', 'sales', 'marketing', 'java', '.net', 'nhân sự', 'designer'];
const LOCATIONS = ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export default function () {
  const roll = Math.random();
  let query;
  let kind;
  if (roll < 0.3) {
    kind = 'list';
    query = 'page=1&pageSize=20';
  } else if (roll < 0.7) {
    kind = 'keyword';
    query = `search=${encodeURIComponent(pick(KEYWORDS))}&page=1&pageSize=20`;
  } else {
    kind = 'filters';
    const years = Math.floor(Math.random() * 6);
    query =
      `location=${encodeURIComponent(pick(LOCATIONS))}&salaryMin=10000000&experienceYears=${years}` +
      `&sortBy=SALARY&sortDirection=DESC&page=1&pageSize=20`;
  }

  const res = http.get(`${BASE_URL}/api/v1/public/jobs?${query}`, { tags: { kind } });
  check(res, {
    'status 200': (r) => r.status === 200,
    'has items': (r) => {
      try {
        return Array.isArray(r.json('items'));
      } catch {
        return false;
      }
    },
  });
  sleep(1 + Math.random());
}

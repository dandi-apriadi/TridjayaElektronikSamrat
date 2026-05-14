const API_BASE_URL = (process.env.SMOKE_API_BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || '123';
const STRICT = process.argv.includes('--strict');

const PASS = 'PASS';
const FAIL = 'FAIL';
const WARN = 'WARN';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function log(status, label, detail = '') {
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`[${status}] ${label}${suffix}`);
}

function assertStatus(result, expected, label) {
  if (result.status !== expected) {
    throw new Error(`${label} expected ${expected}, got ${result.status}`);
  }
  log(PASS, label, `status ${result.status}`);
}

function assertNotServerError(result, label) {
  if (result.status >= 500) {
    throw new Error(`${label} returned server error ${result.status}`);
  }
}

async function loginAdmin() {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  assertStatus(result, 200, 'Admin login');
  const token = result.body?.data?.access_token;
  if (!token) {
    throw new Error('Admin login did not return access_token');
  }
  return token;
}

async function runPublicChecks() {
  const publicEndpoints = [
    ['/health', 200],
    ['/api/catalogs', 200],
    ['/api/partners', 200],
    ['/api/jobs', 200],
    ['/api/articles', 200],
  ];

  for (const [path, expected] of publicEndpoints) {
    const result = await apiRequest(path);
    assertStatus(result, expected, `Public ${path}`);
  }
}

async function runAuthBoundaryChecks() {
  const protectedChecks = [
    ['/api/users', { method: 'GET' }],
    ['/api/admin/catalogs/match?names=Smoke', { method: 'GET' }],
    [
      '/api/admin/catalogs/bulk',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: [] }),
      },
    ],
    ['/api/wa/campaigns', { method: 'GET' }],
    ['/api/reward-tiers', { method: 'GET' }],
    ['/api/leaderboard', { method: 'GET' }],
    [
      '/api/wa/send',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: 'baseline-account',
          target_phone: '+6281234567890',
          message: 'baseline',
        }),
      },
    ],
    ['/api/v1/wa/sessions', { method: 'GET' }],
  ];

  for (const [path, options] of protectedChecks) {
    const result = await apiRequest(path, options);
    assertNotServerError(result, `Protected ${path}`);
    if (![401, 403].includes(result.status)) {
      throw new Error(`Protected ${path} expected 401/403, got ${result.status}`);
    }
    log(PASS, `Protected ${path}`, `status ${result.status}`);
  }

  const badLogin = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'missing@example.com', password: 'WrongPassword123!' }),
  });
  assertNotServerError(badLogin, 'Bad login');
  if (badLogin.status !== 401) {
    throw new Error(`Bad login expected 401, got ${badLogin.status}`);
  }
  log(PASS, 'Bad login rejects credentials', 'status 401');
}

async function runAdminReadChecks(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const checks = [
    ['/api/admin/catalogs/match?names=__baseline_unmatched__', 200],
    ['/api/wa/campaigns', 200],
    ['/api/v1/wa/health', 200],
    ['/api/reward-tiers', 200],
    ['/api/leaderboard', 200],
  ];

  for (const [path, expected] of checks) {
    const result = await apiRequest(path, { headers });
    assertNotServerError(result, `Admin ${path}`);
    assertStatus(result, expected, `Admin ${path}`);
  }
}

async function run() {
  await runPublicChecks();
  await runAuthBoundaryChecks();
  const token = await loginAdmin();
  await runAdminReadChecks(token);
  console.log('');
  console.log(`Baseline monitor selesai${STRICT ? ' dalam mode strict' : ''}: semua request baseline lulus.`);
}

run().catch((error) => {
  log(STRICT ? FAIL : WARN, 'Baseline monitor', error instanceof Error ? error.message : String(error));
  process.exitCode = STRICT ? 1 : 0;
});

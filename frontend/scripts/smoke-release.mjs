const API_BASE_URL = (process.env.SMOKE_API_BASE_URL || 'http://localhost:8081').replace(/\/$/, '');

const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'admin@tridjaya.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'Admin123!';
const AGENT_EMAIL = process.env.SMOKE_AGENT_EMAIL || 'agent@tridjaya.com';
const AGENT_PASSWORD = process.env.SMOKE_AGENT_PASSWORD || 'Agent123!';

const PASS = 'PASS';
const FAIL = 'FAIL';

/** @typedef {{ status: number, body: any }} ApiResult */

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(status, label, details = '') {
  const suffix = details ? ` - ${details}` : '';
  console.log(`[${status}] ${label}${suffix}`);
}

async function login(email, password) {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  assertCondition(result.status === 200, `Login gagal untuk ${email} (status ${result.status})`);
  assertCondition(!!result.body?.data?.access_token, `Token tidak ditemukan untuk ${email}`);

  return {
    token: result.body.data.access_token,
    user: result.body.data.user,
  };
}

async function run() {
  const createdClaims = [];

  const health = await apiRequest('/health');
  assertCondition(health.status === 200, `Health check gagal (status ${health.status})`);
  logStep(PASS, 'Health check', `${API_BASE_URL}/health`);

  const adminAuth = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  logStep(PASS, 'Admin login', adminAuth.user?.email || ADMIN_EMAIL);

  const agentAuth = await login(AGENT_EMAIL, AGENT_PASSWORD);
  logStep(PASS, 'Agent login', agentAuth.user?.email || AGENT_EMAIL);

  const adminDashboardData = await apiRequest('/api/admin/agent-registrations', {
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  assertCondition(
    adminDashboardData.status === 200,
    `Dashboard admin data gagal diakses (status ${adminDashboardData.status})`,
  );
  logStep(PASS, 'Admin dashboard data', '/api/admin/agent-registrations');

  const telemetry = await apiRequest('/api/admin/telemetry-stats', {
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  assertCondition(telemetry.status === 200, `Telemetry stats gagal (status ${telemetry.status})`);
  logStep(PASS, 'Admin telemetry', '/api/admin/telemetry-stats');

  const agentStats = await apiRequest('/api/agent/stats', {
    headers: { Authorization: `Bearer ${agentAuth.token}` },
  });
  assertCondition(agentStats.status === 200, `Agent stats gagal (status ${agentStats.status})`);
  logStep(PASS, 'Agent dashboard stats', '/api/agent/stats');

  const rewardSuffix = new Date().toISOString();
  const createClaim = await apiRequest('/api/agent/claims', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${agentAuth.token}`,
    },
    body: JSON.stringify({
      tierId: 'silver',
      rewardName: `SMOKE Claim ${rewardSuffix}`,
    }),
  });
  assertCondition(createClaim.status === 200, `Create claim gagal (status ${createClaim.status})`);

  const claimId = createClaim.body?.data?.item?.id;
  assertCondition(!!claimId, 'Claim ID tidak ditemukan setelah create claim');
  createdClaims.push(claimId);
  logStep(PASS, 'Agent create claim', claimId);

  const adminClaims = await apiRequest('/api/admin/claims', {
    headers: { Authorization: `Bearer ${adminAuth.token}` },
  });
  assertCondition(adminClaims.status === 200, `Admin claims gagal (status ${adminClaims.status})`);

  const hasClaim = (adminClaims.body?.data?.items || []).some((item) => item.id === claimId);
  assertCondition(hasClaim, `Claim ${claimId} tidak muncul di /api/admin/claims`);
  logStep(PASS, 'Admin claims visibility', claimId);

  console.log('');
  console.log('Smoke release checks selesai: semua alur kritikal lulus.');
  console.log(`Claim test dibuat: ${createdClaims.join(', ')}`);
}

run().catch((error) => {
  logStep(FAIL, 'Smoke release checks', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

#!/usr/bin/env node

/**
 * End-to-end backend API checker that follows the frontend usage flow:
 * public visitor, authenticated roles, dashboards, WhatsApp blast, pixel tools,
 * and negative auth/validation checks.
 *
 * Usage:
 *   npm run test:api:backend
 *
 * Env:
 *   API_TEST_BASE_URL=http://127.0.0.1:8081
 *   API_TEST_MUTATE=true
 *   API_TEST_ALLOW_PRODUCTION=false
 *   API_TEST_ADMIN_EMAIL=admin@gmail.com
 *   API_TEST_ADMIN_PASSWORD=123
 *   API_TEST_OPERATOR_EMAIL=operator@gmail.com
 *   API_TEST_OPERATOR_PASSWORD=123
 *   API_TEST_SALES_EMAIL=sales@gmail.com
 *   API_TEST_SALES_PASSWORD=123
 *   API_TEST_AGENT_EMAIL=agent@gmail.com
 *   API_TEST_AGENT_PASSWORD=123
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8081";
const BASE_URL = stripTrailingSlash(
  process.env.API_TEST_BASE_URL ||
    process.env.SMOKE_API_BASE_URL ||
    DEFAULT_BASE_URL,
);
const MUTATE = parseBoolean(process.env.API_TEST_MUTATE, true);
const ALLOW_PRODUCTION = parseBoolean(
  process.env.API_TEST_ALLOW_PRODUCTION,
  false,
);
const REQUEST_TIMEOUT_MS = Number(process.env.API_TEST_TIMEOUT_MS || 30000);
const RUN_ID = `api-e2e-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const CREDENTIALS = {
  admin: {
    email: process.env.API_TEST_ADMIN_EMAIL || "admin@gmail.com",
    password: process.env.API_TEST_ADMIN_PASSWORD || "123",
  },
  operator: {
    email: process.env.API_TEST_OPERATOR_EMAIL || "operator@gmail.com",
    password: process.env.API_TEST_OPERATOR_PASSWORD || "123",
  },
  sales: {
    email: process.env.API_TEST_SALES_EMAIL || "sales@gmail.com",
    password: process.env.API_TEST_SALES_PASSWORD || "123",
  },
  agent: {
    email: process.env.API_TEST_AGENT_EMAIL || "agent@gmail.com",
    password: process.env.API_TEST_AGENT_PASSWORD || "123",
  },
};

const sessions = {};
const requestRows = [];
const scenarioRows = [];
const cleanupStack = [];
const created = {
  catalogId: null,
  promoId: null,
  jobId: null,
  articleId: null,
  userId: null,
  leadId: null,
  claimId: null,
  supportTicketId: null,
  waAccountId: null,
  waCampaignId: null,
  blastContactId: null,
  gatewayContactId: null,
  gatewayTemplateId: null,
  gatewayWebhookId: null,
  pixelId: null,
  pixelCampaignId: null,
  customConversionId: null,
  landingSlideId: null,
  partnerId: null,
};

class SkipScenario extends Error {
  constructor(message) {
    super(message);
    this.name = "SkipScenario";
  }
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(value).toLowerCase());
}

function isProductionLikeUrl(url) {
  return /(^|\.)tridjaya\.com$/i.test(new URL(url).hostname);
}

function toUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function authHeader(roleOrToken) {
  if (!roleOrToken) return {};
  const token = sessions[roleOrToken]?.accessToken || roleOrToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  return raw ? [raw] : [];
}

function mergeCookies(existing, setCookieHeaders) {
  const jar = new Map();
  if (existing) {
    for (const cookie of existing.split(";")) {
      const [name, ...rest] = cookie.trim().split("=");
      if (name && rest.length) jar.set(name, rest.join("="));
    }
  }

  for (const header of setCookieHeaders) {
    const [cookie] = header.split(";");
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length) jar.set(name, rest.join("="));
  }

  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(name, path, options = {}) {
  const method = options.method || (options.body == null ? "GET" : "POST");
  const expected = Array.isArray(options.expected)
    ? options.expected
    : [options.expected || 200];
  const role = options.role;
  const session = role ? sessions[role] : null;
  const headers = {
    Accept: "application/json, text/plain, */*",
    ...authHeader(role || options.token),
    ...(session?.cookie ? { Cookie: session.cookie } : {}),
    ...(options.headers || {}),
  };

  let body;
  if (options.form != null) {
    const form = new FormData();
    for (const [key, value] of Object.entries(options.form)) {
      if (value != null) form.append(key, String(value));
    }
    body = form;
  } else if (options.body != null) {
    body = JSON.stringify(options.body);
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const start = performance.now();
  let row = {
    scenario: options.scenario || "",
    name,
    method,
    path,
    status: "ERR",
    ms: 0,
    result: "FAIL",
    detail: "",
  };

  try {
    const res = await fetch(toUrl(path), {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";
    const setCookies = getSetCookie(res.headers);
    if (session && setCookies.length) {
      session.cookie = mergeCookies(session.cookie, setCookies);
    }

    let json = null;
    if (text && contentType.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    const elapsed = Math.round(performance.now() - start);
    const passed = expected.includes(res.status);
    row = {
      ...row,
      status: res.status,
      ms: elapsed,
      result: passed ? "PASS" : "FAIL",
      detail: passed
        ? summarizePayload(json, text)
        : summarizeError(json, text, expected),
    };
    requestRows.push(row);

    return {
      name,
      path,
      method,
      status: res.status,
      headers: res.headers,
      json,
      text,
      ok: passed,
      expected,
      ms: elapsed,
      setCookies,
    };
  } catch (error) {
    const elapsed = Math.round(performance.now() - start);
    row = {
      ...row,
      ms: elapsed,
      detail:
        error?.name === "AbortError"
          ? `timeout after ${REQUEST_TIMEOUT_MS}ms`
          : error?.message || String(error),
    };
    requestRows.push(row);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function summarizePayload(json, text) {
  if (json?.message) return json.message;
  if (json?.data?.items && Array.isArray(json.data.items)) {
    return `items=${json.data.items.length}`;
  }
  if (json?.data?.data && Array.isArray(json.data.data)) {
    return `data=${json.data.data.length}`;
  }
  if (text && text.length < 80) return text;
  return "ok";
}

function summarizeError(json, text, expected) {
  const message =
    json?.message ||
    json?.detail ||
    (Array.isArray(json?.errors) ? json.errors.join("; ") : "") ||
    text?.slice(0, 160) ||
    "unexpected response";
  return `expected ${expected.join("/")}: ${message}`;
}

function expect(response, message) {
  if (!response.ok) {
    throw new Error(
      `${message || response.name} failed: ${response.status} ${response.text}`,
    );
  }
  return response;
}

function expectSuccess(response, message) {
  expect(response, message);
  if (response.json && response.json.success === false) {
    throw new Error(
      `${message || response.name} returned success=false: ${response.json.message}`,
    );
  }
  return response;
}

function dataOf(response) {
  return response.json?.data ?? response.json ?? {};
}

function itemId(response) {
  const data = dataOf(response);
  return (
    data?.item?.id ||
    data?.id ||
    data?.data?.id ||
    response.json?.id ||
    null
  );
}

function itemsOf(response) {
  const data = dataOf(response);
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.slides)) return data.slides;
  return [];
}

function firstId(response) {
  return itemsOf(response)[0]?.id || null;
}

function requireMutationEnabled() {
  if (!MUTATE) {
    throw new SkipScenario("API_TEST_MUTATE=false, mutation scenario skipped");
  }
}

function addCleanup(label, fn) {
  cleanupStack.push({ label, fn });
}

async function runScenario(name, fn) {
  const started = performance.now();
  try {
    await fn(name);
    scenarioRows.push({
      scenario: name,
      result: "PASS",
      ms: Math.round(performance.now() - started),
      detail: "",
    });
  } catch (error) {
    scenarioRows.push({
      scenario: name,
      result: error instanceof SkipScenario ? "SKIP" : "FAIL",
      ms: Math.round(performance.now() - started),
      detail: error?.message || String(error),
    });
  }
}

async function cleanup() {
  if (!cleanupStack.length) return;
  console.log("\nCleanup resources...");
  while (cleanupStack.length) {
    const item = cleanupStack.pop();
    try {
      await item.fn();
      console.log(`[CLEAN] ${item.label}`);
    } catch (error) {
      console.log(`[WARN ] cleanup ${item.label}: ${error?.message || error}`);
    }
  }
}

function uniqueEmail(prefix) {
  return `${prefix}.${RUN_ID}@example.test`;
}

function nowIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function dayOffsetIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function publicReadScenario(scenario) {
  expectSuccess(await request("health", "/health", { scenario }));
  expectSuccess(await request("landing home", "/api/landing/home", { scenario }));
  expectSuccess(await request("partners", "/api/partners", { scenario }));
  expectSuccess(
    await request("catalog list", "/api/catalogs?page=1&limit=8", {
      scenario,
    }),
  );
  expectSuccess(
    await request("product categories", "/api/product-categories", {
      scenario,
    }),
  );
  expectSuccess(await request("promotions", "/api/promotions", { scenario }));
  expectSuccess(await request("articles", "/api/articles", { scenario }));
  expectSuccess(await request("jobs", "/api/jobs", { scenario }));
}

async function publicTelemetryScenario(scenario) {
  const sessionId = `frontend-${RUN_ID}`;
  const basePayload = {
    path: "/",
    source: "direct",
    sessionId,
    contentType: "landing",
    contentKey: "home",
    contentTitle: "Landing Home",
    userAgent: "api-backend-e2e/frontend-simulator",
  };

  expectSuccess(
    await request("page view telemetry", "/api/telemetry/page-view", {
      scenario,
      method: "POST",
      body: basePayload,
    }),
  );
  expectSuccess(
    await request("click telemetry", "/api/telemetry/click", {
      scenario,
      method: "POST",
      body: {
        ...basePayload,
        path: "/produk",
        element: "hero-cta",
        contentKey: "hero-catalog-cta",
      },
    }),
  );
  expectSuccess(
    await request("whatsapp click telemetry", "/api/telemetry/whatsapp-click", {
      scenario,
      method: "POST",
      body: {
        ...basePayload,
        path: "/produk/saige-polaris",
        productSlug: "saige-polaris",
        phone: "6281234567890",
      },
    }),
  );
  expectSuccess(
    await request("pixel telemetry", "/api/telemetry/pixel-event", {
      scenario,
      method: "POST",
      body: {
        ...basePayload,
        eventType: "ViewContent",
        value: 12700000,
        currency: "IDR",
      },
    }),
  );
}

async function authScenario(scenario) {
  for (const [role, credential] of Object.entries(CREDENTIALS)) {
    const response = expectSuccess(
      await request(`login ${role}`, "/api/auth/login", {
        scenario,
        method: "POST",
        body: { ...credential, remember: false },
      }),
    );
    const auth = dataOf(response);
    sessions[role] = {
      accessToken: auth.accessToken || auth.access_token,
      refreshToken: auth.refreshToken || auth.refresh_token,
      user: auth.user,
      cookie: mergeCookies("", response.setCookies),
    };
    if (!sessions[role].accessToken) {
      throw new Error(`Login ${role} did not return access token`);
    }
  }

  expectSuccess(
    await request("refresh token", "/api/auth/refresh", {
      scenario,
      method: "POST",
      role: "admin",
      body: { refresh_token: sessions.admin.refreshToken || "" },
    }),
  );
  expectSuccess(
    await request("notifications", "/api/notifications", {
      scenario,
      role: "admin",
    }),
  );
  expectSuccess(
    await request("notification unread count", "/api/notifications/unread-count", {
      scenario,
      role: "admin",
    }),
  );
}

async function authNegativeScenario(scenario) {
  expect(
    await request("admin endpoint without token", "/api/admin/telemetry-stats", {
      scenario,
      expected: [401],
    }),
  );
  expect(
    await request("agent denied user list", "/api/users", {
      scenario,
      role: "agent",
      expected: [403],
    }),
  );
  expect(
    await request("invalid login", "/api/auth/login", {
      scenario,
      method: "POST",
      expected: [401],
      body: {
        email: `missing-${RUN_ID}@example.test`,
        password: "wrong-password",
      },
    }),
  );
}

async function adminDashboardReadScenario(scenario) {
  const adminEndpoints = [
    ["users", "/api/users"],
    ["admin catalogs", "/api/admin/catalogs/paginated?page=1&limit=10"],
    ["catalog match", "/api/admin/catalogs/match?names=Saige%20Polaris"],
    ["price markups", "/api/admin/catalogs/price-markups"],
    ["admin partners", "/api/admin/partners"],
    ["admin landing slides", "/api/admin/landing/slides"],
    ["agent registrations", "/api/admin/agent-registrations"],
    ["admin claims", "/api/admin/claims"],
    ["admin support tickets", "/api/admin/support-tickets"],
    ["admin telemetry", "/api/admin/telemetry-stats"],
    ["admin agents", "/api/admin/agents"],
    ["admin leads", "/api/admin/leads"],
    ["pixel list", "/api/pixels"],
    ["campaign list", "/api/campaigns"],
    [
      "pixel admin analytics",
      `/api/pixel-analytics/admin?period_type=daily&start_date=${dayOffsetIso(
        -7,
      )}&end_date=${nowIsoDate()}`,
    ],
    ["pixel audit logs", "/api/pixel-analytics/audit-logs"],
  ];

  for (const [name, path] of adminEndpoints) {
    expectSuccess(await request(name, path, { scenario, role: "admin" }));
  }
}

async function userCrudScenario(scenario) {
  requireMutationEnabled();
  const create = expectSuccess(
    await request("create test user", "/api/users", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        email: uniqueEmail("operator"),
        name: `API E2E Operator ${RUN_ID}`,
        role: "operator",
        password: "Test12345!",
        isActive: true,
      },
    }),
  );
  created.userId = itemId(create);
  if (!created.userId) throw new Error("create user did not return id");
  addCleanup("test user", () =>
    request("cleanup user", `/api/users/${created.userId}`, {
      scenario: "cleanup",
      method: "DELETE",
      role: "admin",
      expected: [200, 204, 404],
    }),
  );

  expectSuccess(
    await request("get test user", `/api/users/${created.userId}`, {
      scenario,
      role: "admin",
    }),
  );
  expectSuccess(
    await request("update test user", `/api/users/${created.userId}`, {
      scenario,
      method: "PATCH",
      role: "admin",
      body: { name: `API E2E Operator Updated ${RUN_ID}` },
    }),
  );
  expectSuccess(
    await request("reset test user password", `/api/users/${created.userId}/reset-password`, {
      scenario,
      method: "POST",
      role: "admin",
      body: { password: "Test12345!Updated" },
    }),
  );
}

async function catalogContentCrudScenario(scenario) {
  requireMutationEnabled();

  const catalog = expectSuccess(
    await request("create catalog", "/api/catalogs", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        id: `catalog-${RUN_ID}`,
        slug: `catalog-${RUN_ID}`,
        name: `Catalog API E2E ${RUN_ID}`,
        category: "Sepeda Listrik",
        subcategory: "Testing",
        price: 12300000,
        image: "/uploads/test/catalog-api-e2e.webp",
        images: ["/uploads/test/catalog-api-e2e.webp"],
        badge: "TEST",
        shortDesc: "Produk simulasi dari frontend API test",
        description: "Data ini dibuat otomatis oleh api-backend-e2e.",
        specs: [{ label: "Motor", value: "800W" }],
        stock: "available",
        stockQuantity: 9,
        colors: ["blue", "white"],
        rating: 4.8,
        review: "Simulasi",
      },
    }),
  );
  created.catalogId = itemId(catalog) || `catalog-${RUN_ID}`;
  addCleanup("catalog", () =>
    request("cleanup catalog", `/api/catalogs/${created.catalogId}`, {
      scenario: "cleanup",
      method: "DELETE",
      role: "admin",
      expected: [200, 204, 404],
    }),
  );

  expectSuccess(
    await request("update catalog", `/api/catalogs/${created.catalogId}`, {
      scenario,
      method: "PATCH",
      role: "admin",
      body: { stock: "limited", stockQuantity: 7 },
    }),
  );
  expectSuccess(
    await request("get catalog", `/api/catalogs/${created.catalogId}`, {
      scenario,
    }),
  );

  const promo = expectSuccess(
    await request("create promotion", "/api/promotions", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        id: `promo-${RUN_ID}`,
        title: `Promo API E2E ${RUN_ID}`,
        subtitle: "Frontend simulation",
        description: "Promo test otomatis",
        discount: 10,
        originalPrice: 1000000,
        promoPrice: 900000,
        image: "/uploads/test/promo-api-e2e.webp",
        badge: "TEST",
        validUntil: dayOffsetIso(14),
        category: "Sepeda Listrik",
        variant: "blue",
        productIds: [created.catalogId],
      },
    }),
  );
  created.promoId = itemId(promo) || `promo-${RUN_ID}`;
  addCleanup("promotion", () =>
    request("cleanup promotion", `/api/promotions/${created.promoId}`, {
      scenario: "cleanup",
      method: "DELETE",
      role: "admin",
      expected: [200, 204, 404],
    }),
  );
  expectSuccess(
    await request("update promotion", `/api/promotions/${created.promoId}`, {
      scenario,
      method: "PATCH",
      role: "admin",
      body: { subtitle: "Frontend simulation updated" },
    }),
  );
}

async function contentCmsCrudScenario(scenario) {
  requireMutationEnabled();

  const job = expectSuccess(
    await request("create job", "/api/jobs", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        id: `job-${RUN_ID}`,
        title: `API E2E Staff ${RUN_ID}`,
        department: "QA",
        location: "Manado",
        type: "Full-time",
        level: "Junior",
        description: "Lowongan simulasi untuk test API.",
        requirements: ["Teliti", "Komunikatif"],
        benefits: ["Lingkungan kerja baik"],
        postedAt: nowIsoDate(),
        isActive: true,
        deadline: dayOffsetIso(30),
      },
    }),
  );
  created.jobId = itemId(job) || `job-${RUN_ID}`;
  addCleanup("job", () =>
    request("cleanup job", `/api/jobs/${created.jobId}`, {
      scenario: "cleanup",
      method: "DELETE",
      role: "admin",
      expected: [200, 204, 404],
    }),
  );

  expectSuccess(
    await request("apply job", "/api/job-applications", {
      scenario,
      method: "POST",
      body: {
        jobId: created.jobId,
        jobTitle: `API E2E Staff ${RUN_ID}`,
        fullName: `Pelamar API ${RUN_ID}`,
        email: uniqueEmail("pelamar"),
        phone: "081234567890",
        address: "Manado",
        education: "S1",
        major: "Informatika",
        experience: "1 tahun",
        coverLetter: "Simulasi dari frontend.",
      },
    }),
  );
  expectSuccess(
    await request("job applications", "/api/job-applications", {
      scenario,
      role: "admin",
    }),
  );

  const article = expectSuccess(
    await request("create article", "/api/articles", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        id: `article-${RUN_ID}`,
        slug: `article-${RUN_ID}`,
        title: `Artikel API E2E ${RUN_ID}`,
        excerpt: "Artikel simulasi frontend.",
        content: "Konten test otomatis.",
        author: "QA API",
        authorRole: "Tester",
        heroImage: "/uploads/test/article-api-e2e.webp",
        category: "News",
        tags: ["api", "e2e"],
        publishedAt: nowIsoDate(),
        readTime: 2,
        featured: false,
      },
    }),
  );
  created.articleId = itemId(article) || `article-${RUN_ID}`;
  addCleanup("article", () =>
    request("cleanup article", `/api/articles/${created.articleId}`, {
      scenario: "cleanup",
      method: "DELETE",
      role: "admin",
      expected: [200, 204, 404],
    }),
  );
  expectSuccess(
    await request("update article", `/api/articles/${created.articleId}`, {
      scenario,
      method: "PATCH",
      role: "admin",
      body: { featured: true },
    }),
  );
}

async function landingPartnerScenario(scenario) {
  requireMutationEnabled();

  const slide = expectSuccess(
    await request("create landing slide", "/api/admin/landing/slides", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        eyebrow: "API TEST",
        title: `Hero API E2E ${RUN_ID}`,
        accent: "Frontend simulation",
        copy: "Slide sementara untuk memastikan kontrak landing CMS berjalan.",
        href: "/produk",
        cta: "Lihat Produk",
        bgImageUrl: "/uploads/landing/test-bg.webp",
        productImageUrl: "/uploads/landing/test-product.webp",
        productAlt: "Produk API E2E",
        iconKey: "bike",
        price: "Rp 1.000.000",
        oldPrice: "Rp 1.200.000",
        detailLine: "Simulasi testing",
        metrics: [{ label: "Test", value: "OK" }],
        specs: [{ label: "API", value: "200" }],
        sortOrder: 999,
        isActive: false,
      },
    }),
  );
  created.landingSlideId = itemId(slide);
  if (created.landingSlideId) {
    addCleanup("landing slide", () =>
      request("cleanup landing slide", `/api/admin/landing/slides/${created.landingSlideId}`, {
        scenario: "cleanup",
        method: "DELETE",
        role: "admin",
        expected: [200, 204, 404],
      }),
    );
    expectSuccess(
      await request("update landing slide", `/api/admin/landing/slides/${created.landingSlideId}`, {
        scenario,
        method: "PATCH",
        role: "admin",
        body: { copy: "Slide update dari api-backend-e2e." },
      }),
    );
  }

  const partner = expectSuccess(
    await request("create partner", "/api/admin/partners", {
      scenario,
      method: "POST",
      role: "admin",
      form: {
        name: `Partner API E2E ${RUN_ID}`,
        logoUrl: "/uploads/landing/partner-api-e2e.webp",
        websiteUrl: "https://example.test",
        sortOrder: 999,
        isActive: false,
      },
    }),
  );
  created.partnerId = itemId(partner);
  if (created.partnerId) {
    addCleanup("partner", () =>
      request("cleanup partner", `/api/admin/partners/${created.partnerId}`, {
        scenario: "cleanup",
        method: "DELETE",
        role: "admin",
        expected: [200, 204, 404],
      }),
    );
    expectSuccess(
      await request("update partner", `/api/admin/partners/${created.partnerId}`, {
        scenario,
        method: "PATCH",
        role: "admin",
        form: { name: `Partner API E2E Updated ${RUN_ID}` },
      }),
    );
  }
}

async function agentSalesScenario(scenario) {
  expectSuccess(
    await request("agent stats", "/api/agent/stats", {
      scenario,
      role: "agent",
    }),
  );
  expectSuccess(
    await request("agent claims", "/api/agent/claims", {
      scenario,
      role: "agent",
    }),
  );
  expectSuccess(
    await request("agent support tickets", "/api/agent/support-tickets", {
      scenario,
      role: "agent",
    }),
  );
  expectSuccess(
    await request("reward tiers", "/api/reward-tiers", {
      scenario,
      role: "agent",
    }),
  );
  expectSuccess(
    await request("leaderboard", "/api/leaderboard", {
      scenario,
      role: "agent",
    }),
  );
  expectSuccess(
    await request("sales delivery schedules", "/api/sales/delivery-schedules", {
      scenario,
      role: "sales",
    }),
  );

  if (!MUTATE) return;

  const lead = expectSuccess(
    await request("create agent lead", "/api/leads", {
      scenario,
      method: "POST",
      role: "agent",
      body: {
        customerName: `Customer API ${RUN_ID}`,
        phoneNumber: "081234567890",
        interestedProduct: "Saige Polaris",
        notes: "Lead simulasi frontend",
      },
    }),
  );
  created.leadId = itemId(lead);
  if (created.leadId) {
    expectSuccess(
      await request("update lead status", `/api/leads/${created.leadId}/status`, {
        scenario,
        method: "PATCH",
        role: "admin",
        body: { status: "Negosiasi", notes: "Validated by API test" },
      }),
    );
  }

  const claim = expectSuccess(
    await request("create reward claim", "/api/agent/claims", {
      scenario,
      method: "POST",
      role: "agent",
      body: {
        tierId: "silver",
        rewardName: `Claim API E2E ${RUN_ID}`,
      },
    }),
  );
  created.claimId = itemId(claim);
  if (created.claimId) {
    expectSuccess(
      await request("update claim status", `/api/admin/claims/${created.claimId}/status`, {
        scenario,
        method: "PATCH",
        role: "admin",
        body: { status: "processing" },
      }),
    );
  }

  const ticket = expectSuccess(
    await request("create support ticket", "/api/agent/support-tickets", {
      scenario,
      method: "POST",
      role: "agent",
      body: {
        subject: `Support API E2E ${RUN_ID}`,
        message: "Ticket simulasi dari frontend.",
        priority: "low",
      },
    }),
  );
  created.supportTicketId = itemId(ticket);
  if (created.supportTicketId) {
    expectSuccess(
      await request(
        "update support ticket status",
        `/api/admin/support-tickets/${created.supportTicketId}/status`,
        {
          scenario,
          method: "PATCH",
          role: "admin",
          body: { status: "closed" },
        },
      ),
    );
  }
}

async function waBlastScenario(scenario) {
  expectSuccess(
    await request("wa accounts", "/api/wa/accounts", {
      scenario,
      role: "admin",
    }),
  );
  expectSuccess(
    await request("wa campaigns", "/api/wa/campaigns", {
      scenario,
      role: "admin",
    }),
  );
  expectSuccess(
    await request("wa blast contacts", "/api/wa/blast-contacts", {
      scenario,
      role: "admin",
    }),
  );
  expect(
    await request("wa recipients csv template", "/api/wa/recipients/template", {
      scenario,
      role: "admin",
      expected: [200],
    }),
  );

  requireMutationEnabled();

  const account = expectSuccess(
    await request("create wa account", "/api/wa/accounts", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        name: `WA API E2E ${RUN_ID}`,
        gatewayConfig: { mode: "test", runId: RUN_ID },
        enabled: false,
      },
    }),
  );
  created.waAccountId = itemId(account);
  if (created.waAccountId) {
    addCleanup("wa account", () =>
      request("cleanup wa account", `/api/wa/accounts/${created.waAccountId}`, {
        scenario: "cleanup",
        method: "DELETE",
        role: "admin",
        expected: [200, 204, 404],
      }),
    );
    expectSuccess(
      await request("update wa account", `/api/wa/accounts/${created.waAccountId}`, {
        scenario,
        method: "PATCH",
        role: "admin",
        body: { enabled: false, name: `WA API E2E Updated ${RUN_ID}` },
      }),
    );
  }

  const campaign = expectSuccess(
    await request("create wa campaign", "/api/wa/campaigns", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        name: `WA Campaign API E2E ${RUN_ID}`,
        config: {
          messageTemplate: "Halo {{name}}, ini test API. Abaikan pesan ini.",
          dedupeDays: 1,
          rateLimitSeconds: 6,
          accountId: created.waAccountId,
        },
      },
    }),
  );
  created.waCampaignId = itemId(campaign);
  if (!created.waCampaignId) throw new Error("WA campaign did not return id");
  addCleanup("wa campaign", () =>
    request("cleanup wa campaign", `/api/wa/campaigns/${created.waCampaignId}`, {
      scenario: "cleanup",
      method: "DELETE",
      role: "admin",
      expected: [200, 204, 404],
    }),
  );

  expectSuccess(
    await request("add wa recipients", `/api/wa/campaigns/${created.waCampaignId}/recipients`, {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        recipients: [
          {
            phone: "081234567890",
            variables: { name: "Customer API" },
          },
        ],
      },
    }),
  );
  expectSuccess(
    await request("get wa campaign", `/api/wa/campaigns/${created.waCampaignId}`, {
      scenario,
      role: "admin",
    }),
  );
  expectSuccess(
    await request("wa campaign status", `/api/wa/campaigns/${created.waCampaignId}/status`, {
      scenario,
      role: "admin",
    }),
  );
  expectSuccess(
    await request("wa campaign metrics", `/api/wa/campaigns/${created.waCampaignId}/metrics`, {
      scenario,
      role: "admin",
    }),
  );
  expect(
    await request("pause wa campaign", `/api/wa/campaigns/${created.waCampaignId}/pause`, {
      scenario,
      method: "POST",
      role: "admin",
      expected: [200, 400],
    }),
  );
  expectSuccess(
    await request("reset wa campaign", `/api/wa/campaigns/${created.waCampaignId}/reset`, {
      scenario,
      method: "POST",
      role: "admin",
    }),
  );

  const blastContact = expectSuccess(
    await request("create blast contact", "/api/wa/blast-contacts", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        phone: "081234567891",
        name: `Blast Contact ${RUN_ID}`,
        labels: "test,api",
        notes: "Created by api-backend-e2e",
      },
    }),
  );
  created.blastContactId = itemId(blastContact);
  if (created.blastContactId) {
    addCleanup("blast contact", () =>
      request("cleanup blast contact", `/api/wa/blast-contacts/${created.blastContactId}`, {
        scenario: "cleanup",
        method: "DELETE",
        role: "admin",
        expected: [200, 204, 404],
      }),
    );
    expectSuccess(
      await request("update blast contact", `/api/wa/blast-contacts/${created.blastContactId}`, {
        scenario,
        method: "PATCH",
        role: "admin",
        body: {
          phone: "081234567890",
          name: "Blast Contact API Updated",
          notes: "Updated by api-backend-e2e",
        },
      }),
    );
  }
}

async function waGatewayScenario(scenario) {
  const readEndpoints = [
    ["gateway health", "/api/v1/wa/health"],
    ["gateway dashboard", "/api/v1/wa/dashboard"],
    ["gateway stats", "/api/v1/wa/stats/summary"],
    ["gateway messages", "/api/v1/wa/messages?page=1&per_page=5"],
    ["gateway contacts", "/api/v1/wa/contacts?page=1&per_page=5"],
    ["gateway templates", "/api/v1/wa/templates?page=1&per_page=5"],
    ["gateway sessions", "/api/v1/wa/sessions"],
    ["gateway webhooks", "/api/v1/wa/webhooks"],
  ];
  for (const [name, path] of readEndpoints) {
    expectSuccess(await request(name, path, { scenario, role: "admin" }));
  }

  requireMutationEnabled();

  const contact = expectSuccess(
    await request("gateway create contact", "/api/v1/wa/contacts", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        phone: "081234567892",
        name: `Gateway Contact ${RUN_ID}`,
        labels: ["api", "e2e"],
      },
      expected: [200, 201],
    }),
  );
  created.gatewayContactId = itemId(contact);
  if (created.gatewayContactId) {
    addCleanup("gateway contact", () =>
      request("cleanup gateway contact", `/api/v1/wa/contacts/${created.gatewayContactId}`, {
        scenario: "cleanup",
        method: "DELETE",
        role: "admin",
        expected: [200, 204, 404],
      }),
    );
    expectSuccess(
      await request("gateway update contact", `/api/v1/wa/contacts/${created.gatewayContactId}`, {
        scenario,
        method: "PATCH",
        role: "admin",
        body: {
          phone: "081234567892",
          name: `Gateway Contact Updated ${RUN_ID}`,
          labels: ["api", "updated"],
        },
      }),
    );
  }

  const template = expectSuccess(
    await request("gateway create template", "/api/v1/wa/templates", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        name: `Template API E2E ${RUN_ID}`,
        category: "utility",
        content: "Halo {{name}}, ini pesan test.",
        variables: ["name"],
      },
      expected: [200, 201],
    }),
  );
  created.gatewayTemplateId = itemId(template);
  if (created.gatewayTemplateId) {
    addCleanup("gateway template", () =>
      request("cleanup gateway template", `/api/v1/wa/templates/${created.gatewayTemplateId}`, {
        scenario: "cleanup",
        method: "DELETE",
        role: "admin",
        expected: [200, 204, 404],
      }),
    );
    expectSuccess(
      await request(
        "gateway update template",
        `/api/v1/wa/templates/${created.gatewayTemplateId}`,
        {
          scenario,
          method: "PATCH",
          role: "admin",
          body: {
            name: `Template API E2E Updated ${RUN_ID}`,
            category: "utility",
            content: "Halo {{name}}, ini pesan test update.",
            variables: ["name"],
          },
        },
      ),
    );
  }

  const webhook = expectSuccess(
    await request("gateway create webhook", "/api/v1/wa/webhooks", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        name: `Webhook API E2E ${RUN_ID}`,
        url: "https://example.test/webhook",
        secret: "test-secret",
        events: ["message.sent"],
        headers: { "X-Test": RUN_ID },
        retryCount: 1,
        timeoutSeconds: 5,
      },
      expected: [200, 201],
    }),
  );
  created.gatewayWebhookId = itemId(webhook);
  if (created.gatewayWebhookId) {
    addCleanup("gateway webhook", () =>
      request("cleanup gateway webhook", `/api/v1/wa/webhooks/${created.gatewayWebhookId}`, {
        scenario: "cleanup",
        method: "DELETE",
        role: "admin",
        expected: [200, 204, 404],
      }),
    );
    expectSuccess(
      await request("gateway get webhook", `/api/v1/wa/webhooks/${created.gatewayWebhookId}`, {
        scenario,
        role: "admin",
      }),
    );
  }
}

async function pixelScenario(scenario) {
  requireMutationEnabled();

  const pixel = expectSuccess(
    await request("create pixel", "/api/pixels", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        pixel_id: `pixel-${RUN_ID}`,
        name: `Pixel API E2E ${RUN_ID}`,
        business_manager_id: "bm-test",
        access_token: `test-token-${RUN_ID}`,
        config: { mode: "test" },
      },
    }),
  );
  created.pixelId = itemId(pixel);
  if (!created.pixelId) throw new Error("pixel did not return id");
  addCleanup("pixel", () =>
    request("cleanup pixel", `/api/pixels/${created.pixelId}`, {
      scenario: "cleanup",
      method: "DELETE",
      role: "admin",
      expected: [200, 204, 404],
    }),
  );

  expectSuccess(
    await request("assign pixel admin", `/api/pixels/${created.pixelId}/admins`, {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        user_id: sessions.admin.user?.id,
        permissions: ["read", "write", "analytics"],
      },
    }),
  );
  expectSuccess(
    await request("pixel admins", `/api/pixels/${created.pixelId}/admins`, {
      scenario,
      role: "admin",
    }),
  );
  expectSuccess(
    await request("get pixel", `/api/pixels/${created.pixelId}`, {
      scenario,
      role: "admin",
    }),
  );

  const campaign = expectSuccess(
    await request("create pixel campaign", "/api/campaigns", {
      scenario,
      method: "POST",
      role: "admin",
      body: {
        pixel_id: created.pixelId,
        name: `Pixel Campaign API E2E ${RUN_ID}`,
        utm_source: "api-e2e",
        utm_medium: "test",
        utm_campaign: RUN_ID,
        config: { mode: "test" },
      },
    }),
  );
  created.pixelCampaignId = itemId(campaign);
  if (created.pixelCampaignId) {
    addCleanup("pixel campaign", () =>
      request("cleanup pixel campaign", `/api/campaigns/${created.pixelCampaignId}`, {
        scenario: "cleanup",
        method: "DELETE",
        role: "admin",
        expected: [200, 204, 404],
      }),
    );
    expectSuccess(
      await request("campaign analytics", `/api/pixel-analytics/campaigns/${created.pixelCampaignId}`, {
        scenario,
        role: "admin",
        expected: [200, 404],
      }),
    );

    const conversion = expectSuccess(
      await request(
        "create custom conversion",
        `/api/campaigns/${created.pixelCampaignId}/conversions`,
        {
          scenario,
          method: "POST",
          role: "admin",
          body: {
            name: `Conversion API E2E ${RUN_ID}`,
            event_type: "Lead",
            rules: { url_filter: { contains: "/produk" } },
            conversion_value: 100000,
            currency: "IDR",
          },
        },
      ),
    );
    created.customConversionId = itemId(conversion);
    if (created.customConversionId) {
      addCleanup("custom conversion", () =>
        request(
          "cleanup custom conversion",
          `/api/campaigns/${created.pixelCampaignId}/conversions/${created.customConversionId}`,
          {
            scenario: "cleanup",
            method: "DELETE",
            role: "admin",
            expected: [200, 204, 404],
          },
        ),
      );
    }
  }

  expectSuccess(
    await request("receive pixel event", "/api/pixel-events", {
      scenario,
      method: "POST",
      body: {
        pixel_id: `pixel-${RUN_ID}`,
        event_type: "ViewContent",
        event_source_url: `${BASE_URL}/produk/catalog-${RUN_ID}`,
        user_agent: "api-backend-e2e/frontend-simulator",
        custom_data: {
          content_name: `Catalog API E2E ${RUN_ID}`,
          value: 12300000,
          currency: "IDR",
        },
      },
      expected: [200, 201],
    }),
  );
  expectSuccess(
    await request("pixel analytics", `/api/pixel-analytics/pixels/${created.pixelId}`, {
      scenario,
      role: "admin",
    }),
  );
}

async function n8nApiScenario(scenario) {
  expect(
    await request("n8n wa send without api token", "/api/wa/send", {
      scenario,
      method: "POST",
      expected: [401],
      body: {
        account_id: "missing",
        target_phone: "+6281234567890",
        message: "Test API token guard",
      },
    }),
  );
  expect(
    await request("n8n wa bomber without api token", "/api/wa/bomber", {
      scenario,
      method: "POST",
      expected: [401],
      body: {
        account_id: "missing",
        target_phone: "+6281234567890",
        message: "Test bomber token guard",
        repeat_count: 1,
        interval_seconds: 10,
      },
    }),
  );
}

async function main() {
  if (MUTATE && isProductionLikeUrl(BASE_URL) && !ALLOW_PRODUCTION) {
    throw new Error(
      `Refusing to run mutation tests against production-like URL: ${BASE_URL}. Set API_TEST_ALLOW_PRODUCTION=true only if you really intend this.`,
    );
  }

  console.log(`Backend API E2E: ${BASE_URL}`);
  console.log(`Run id: ${RUN_ID}`);
  console.log(`Mutation scenarios: ${MUTATE ? "enabled" : "disabled"}`);

  await runScenario("public frontend reads", publicReadScenario);
  await runScenario("public telemetry", publicTelemetryScenario);
  await runScenario("auth all roles", authScenario);
  await runScenario("auth negative checks", authNegativeScenario);
  await runScenario("admin dashboard reads", adminDashboardReadScenario);
  await runScenario("admin user crud", userCrudScenario);
  await runScenario("catalog and promo crud", catalogContentCrudScenario);
  await runScenario("cms content crud", contentCmsCrudScenario);
  await runScenario("landing and partner cms", landingPartnerScenario);
  await runScenario("agent and sales flows", agentSalesScenario);
  await runScenario("whatsapp blast flows", waBlastScenario);
  await runScenario("wa gateway flows", waGatewayScenario);
  await runScenario("pixel and analytics flows", pixelScenario);
  await runScenario("n8n api token guard", n8nApiScenario);

  await cleanup();

  console.log("\nScenario results");
  console.table(scenarioRows);

  console.log("\nRequest results");
  console.table(requestRows);

  const failedScenarios = scenarioRows.filter((row) => row.result === "FAIL");
  const failedRequests = requestRows.filter((row) => row.result === "FAIL");
  const skippedScenarios = scenarioRows.filter((row) => row.result === "SKIP");

  console.log("\nSummary");
  console.log(`Scenarios: ${scenarioRows.length}`);
  console.log(`Passed: ${scenarioRows.length - failedScenarios.length - skippedScenarios.length}`);
  console.log(`Skipped: ${skippedScenarios.length}`);
  console.log(`Failed scenarios: ${failedScenarios.length}`);
  console.log(`Failed requests: ${failedRequests.length}`);

  if (failedScenarios.length || failedRequests.length) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  await cleanup();
  console.error("\n[FATAL]", error?.stack || error?.message || error);
  process.exitCode = 1;
});

import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_ASSETS_DIR = path.resolve(__dirname, '../dist/assets');
const REPORT_DIR = path.resolve(__dirname, '../reports');
const REPORT_PATH = path.join(REPORT_DIR, 'baseline-latest.json');

const API_BASE_URL = (process.env.SMOKE_API_BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const BASELINE_STRICT = process.env.BASELINE_STRICT === '1' || process.argv.includes('--strict');

const MAX_LARGEST_JS_KB = Number(process.env.BASELINE_MAX_LARGEST_JS_KB || 900);
const MAX_TOTAL_JS_KB = Number(process.env.BASELINE_MAX_TOTAL_JS_KB || 2400);
const MAX_HEALTH_LATENCY_MS = Number(process.env.BASELINE_MAX_HEALTH_LATENCY_MS || 300);

const bytesToKb = (bytes) => Number((bytes / 1024).toFixed(2));

async function collectFilesRecursively(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFilesRecursively(target);
      }
      return [target];
    }),
  );
  return files.flat();
}

async function summarizeAssets() {
  const files = await collectFilesRecursively(DIST_ASSETS_DIR);
  const sizes = await Promise.all(
    files.map(async (file) => ({
      file,
      size: (await stat(file)).size,
    })),
  );

  const jsFiles = sizes.filter((item) => item.file.endsWith('.js'));
  const cssFiles = sizes.filter((item) => item.file.endsWith('.css'));

  const largestJs = jsFiles.sort((a, b) => b.size - a.size)[0] || null;
  const totalJs = jsFiles.reduce((sum, item) => sum + item.size, 0);
  const totalCss = cssFiles.reduce((sum, item) => sum + item.size, 0);

  return {
    fileCount: sizes.length,
    jsCount: jsFiles.length,
    cssCount: cssFiles.length,
    largestJs: largestJs
      ? {
          file: path.relative(path.resolve(__dirname, '..'), largestJs.file).replace(/\\/g, '/'),
          bytes: largestJs.size,
          kb: bytesToKb(largestJs.size),
        }
      : null,
    totalJs: {
      bytes: totalJs,
      kb: bytesToKb(totalJs),
    },
    totalCss: {
      bytes: totalCss,
      kb: bytesToKb(totalCss),
    },
  };
}

async function measureHealthLatency() {
  const startedAt = Date.now();
  const response = await fetch(`${API_BASE_URL}/health`);
  const latencyMs = Date.now() - startedAt;
  return {
    status: response.status,
    latencyMs,
    ok: response.ok,
  };
}

function evaluateChecks(assetSummary, health) {
  const checks = [
    {
      key: 'largest_js',
      label: 'Largest JS chunk size',
      value: assetSummary.largestJs?.kb ?? 0,
      unit: 'KB',
      threshold: MAX_LARGEST_JS_KB,
      passed: (assetSummary.largestJs?.kb ?? 0) <= MAX_LARGEST_JS_KB,
    },
    {
      key: 'total_js',
      label: 'Total JS size',
      value: assetSummary.totalJs.kb,
      unit: 'KB',
      threshold: MAX_TOTAL_JS_KB,
      passed: assetSummary.totalJs.kb <= MAX_TOTAL_JS_KB,
    },
    {
      key: 'health_latency',
      label: 'Health endpoint latency',
      value: health.latencyMs,
      unit: 'ms',
      threshold: MAX_HEALTH_LATENCY_MS,
      passed: health.ok && health.latencyMs <= MAX_HEALTH_LATENCY_MS,
    },
  ];

  return {
    checks,
    passed: checks.every((item) => item.passed),
  };
}

async function run() {
  const assetSummary = await summarizeAssets();
  const health = await measureHealthLatency();
  const gate = evaluateChecks(assetSummary, health);

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: {
      maxLargestJsKb: MAX_LARGEST_JS_KB,
      maxTotalJsKb: MAX_TOTAL_JS_KB,
      maxHealthLatencyMs: MAX_HEALTH_LATENCY_MS,
      strictMode: BASELINE_STRICT,
    },
    assetSummary,
    health,
    gate,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log('[BASELINE] Report generated:', REPORT_PATH);
  for (const check of gate.checks) {
    const status = check.passed ? 'PASS' : 'WARN';
    console.log(`[${status}] ${check.label}: ${check.value}${check.unit} (threshold ${check.threshold}${check.unit})`);
  }

  if (!gate.passed && BASELINE_STRICT) {
    process.exitCode = 1;
    console.error('[BASELINE] Gate failed in strict mode.');
  }
}

run().catch((error) => {
  console.error('[BASELINE] Failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

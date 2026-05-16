import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src");
const allowedRawEnvFile = "src/utils/apiClient.ts";
const extensions = new Set([".ts", ".tsx"]);

const violations = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (!extensions.has(path.extname(entry.name))) continue;

    const relative = path.relative(process.cwd(), fullPath);
    const normalized = relative.split(path.sep).join(path.posix.sep);
    const content = await readFile(fullPath, "utf8");

    if (
      normalized !== allowedRawEnvFile &&
      content.includes("import.meta.env.VITE_API_BASE_URL")
    ) {
      violations.push(
        `${normalized}: use API_BASE_URL/apiFetch from src/utils/apiClient.ts instead of reading VITE_API_BASE_URL directly.`,
      );
    }

    const rawApiFetchPattern = /fetch\s*\(\s*`?\$\{API_BASE_URL\}\//;
    if (rawApiFetchPattern.test(content)) {
      violations.push(
        `${normalized}: avoid fetch(\`\${API_BASE_URL}/...\`); use apiFetch('/api/...') so the /api prefix is guaranteed.`,
      );
    }
  }
}

await walk(root);

if (violations.length > 0) {
  console.error("API prefix guard failed:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("API prefix guard passed.");

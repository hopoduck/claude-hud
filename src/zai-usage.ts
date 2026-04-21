import * as fs from 'node:fs';
import * as https from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import type { UsageData, ZaiApiEnvelope, ZaiUsageApiResponse, ZaiQuotaLimit } from './types.js';
import { getHudPluginDir } from './claude-config-dir.js';

type ZaiPlatform = 'zai' | 'zhipu';

const CACHE_FILE = 'zai-usage-cache.json';
const CACHE_TTL_MS = 60_000;       // 60s success
const CACHE_FAIL_TTL_MS = 15_000;  // 15s failure
const REQUEST_TIMEOUT_MS = 5_000;

interface CacheEntry {
  data: UsageData | null;
  fetchedAt: number;
  ok: boolean;
}

/** Detect z.ai or ZHIPU platform from ANTHROPIC_BASE_URL. Returns null for Anthropic. */
export function detectZaiPlatform(env: NodeJS.ProcessEnv = process.env): ZaiPlatform | null {
  const baseUrl = (env.ANTHROPIC_BASE_URL ?? env.ANTHROPIC_API_BASE_URL ?? '').trim();
  if (!baseUrl) return null;
  if (baseUrl.includes('api.z.ai')) return 'zai';
  if (baseUrl.includes('open.bigmodel.cn') || baseUrl.includes('dev.bigmodel.cn')) return 'zhipu';
  return null;
}

function getCachePath(): string {
  return path.join(getHudPluginDir(os.homedir()), CACHE_FILE);
}

function readCache(now: number): CacheEntry | null {
  try {
    const raw = fs.readFileSync(getCachePath(), 'utf8');
    const entry = JSON.parse(raw) as CacheEntry;
    const ttl = entry.ok ? CACHE_TTL_MS : CACHE_FAIL_TTL_MS;
    if (now - entry.fetchedAt < ttl) return entry;
  } catch {
    // cache miss
  }
  return null;
}

function writeCache(entry: CacheEntry): void {
  try {
    const dir = path.dirname(getCachePath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getCachePath(), JSON.stringify(entry), 'utf8');
  } catch {
    // ignore write errors
  }
}

function mapResponse(response: ZaiUsageApiResponse): UsageData {
  const tokensLimit = response.limits?.find(
    (l: ZaiQuotaLimit) => l.type === 'TOKENS_LIMIT',
  );

  const fiveHour = tokensLimit
    ? Math.min(100, Math.max(0, Math.round(tokensLimit.percentage)))
    : null;

  const fiveHourResetAt =
    tokensLimit?.nextResetTime != null
      ? new Date(tokensLimit.nextResetTime)
      : null;

  return {
    fiveHour,
    sevenDay: null,
    fiveHourResetAt: fiveHourResetAt?.getTime() ? fiveHourResetAt : null,
    sevenDayResetAt: null,
  };
}

function fetchApi(baseUrl: string, token: string): Promise<ZaiUsageApiResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/monitor/usage/quota/limit', baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'GET',
      headers: { Authorization: token },
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          // Unwrap envelope: { code, success, data: {...} }
          const envelope = parsed as ZaiApiEnvelope;
          resolve(envelope.data ?? parsed as ZaiUsageApiResponse);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

/** Fetch z.ai/ZHIPU usage data with file-based caching. Returns null if unavailable. */
export async function getZaiUsage(
  env: NodeJS.ProcessEnv = process.env,
): Promise<UsageData | null> {
  const platform = detectZaiPlatform(env);
  if (!platform) return null;

  const baseUrl = (env.ANTHROPIC_BASE_URL ?? env.ANTHROPIC_API_BASE_URL ?? '').trim();
  const token = (env.ANTHROPIC_AUTH_TOKEN ?? '').trim();
  if (!baseUrl || !token) return null;

  const now = Date.now();
  const cached = readCache(now);
  if (cached) return cached.data;

  try {
    const response = await fetchApi(baseUrl, token);
    const data = mapResponse(response);
    writeCache({ data, fetchedAt: now, ok: true });
    return data;
  } catch {
    writeCache({ data: null, fetchedAt: now, ok: false });
    return null;
  }
}

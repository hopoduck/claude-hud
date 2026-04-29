import type { UsageData } from './types.js';
type ZaiPlatform = 'zai' | 'zhipu';
/** Detect z.ai or ZHIPU platform from ANTHROPIC_BASE_URL. Returns null for Anthropic. */
export declare function detectZaiPlatform(env?: NodeJS.ProcessEnv): ZaiPlatform | null;
/** Fetch z.ai/ZHIPU usage data with file-based caching. Returns null if unavailable. */
export declare function getZaiUsage(env?: NodeJS.ProcessEnv): Promise<UsageData | null>;
export {};
//# sourceMappingURL=zai-usage.d.ts.map
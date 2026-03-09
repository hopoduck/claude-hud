import type { RenderContext } from '../../types.js';
import { isLimitReached } from '../../types.js';
import { getProviderLabel } from '../../stdin.js';
import { red, yellow, green, dim, getContextColor, quotaBar, RESET } from '../colors.js';

const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAY_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_ELAPSED_MS = 10 * 60 * 1000;

function calculatePace(usagePercent: number, resetAt: Date | null, totalWindowMs: number): number | null {
  if (resetAt === null || usagePercent <= 0) return null;
  const now = new Date();
  const remainingMs = resetAt.getTime() - now.getTime();
  if (remainingMs <= 0) return null;
  const elapsedMs = totalWindowMs - remainingMs;
  if (elapsedMs < MIN_ELAPSED_MS) return null;
  const elapsedPercent = (elapsedMs / totalWindowMs) * 100;
  return usagePercent / elapsedPercent;
}

function formatPace(pace: number | null): string {
  if (pace === null) return '';
  const display = pace.toFixed(1);
  if (pace <= 1.0) return green(`↓${display}x`);
  if (pace <= 2.0) return yellow(`↑${display}x`);
  return red(`↑${display}x`);
}

export function renderUsageLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;

  if (display?.showUsage === false) {
    return null;
  }

  if (!ctx.usageData?.planName) {
    return null;
  }

  if (getProviderLabel(ctx.stdin)) {
    return null;
  }

  const label = dim('Usage');

  if (ctx.usageData.apiUnavailable) {
    const errorHint = formatUsageError(ctx.usageData.apiError);
    return `${label} ${yellow(`⚠${errorHint}`)}`;
  }

  if (isLimitReached(ctx.usageData)) {
    const resetTime = ctx.usageData.fiveHour === 100
      ? formatResetTime(ctx.usageData.fiveHourResetAt)
      : formatResetTime(ctx.usageData.sevenDayResetAt);
    return `${label} ${red(`⚠ Limit reached${resetTime ? ` (resets ${resetTime})` : ''}`)}`;
  }

  const threshold = display?.usageThreshold ?? 0;
  const fiveHour = ctx.usageData.fiveHour;
  const sevenDay = ctx.usageData.sevenDay;

  const effectiveUsage = Math.max(fiveHour ?? 0, sevenDay ?? 0);
  if (effectiveUsage < threshold) {
    return null;
  }

  const fiveHourDisplay = formatUsagePercent(ctx.usageData.fiveHour);
  const fiveHourReset = formatResetTime(ctx.usageData.fiveHourResetAt);

  const usageBarEnabled = display?.usageBarEnabled ?? true;
  const pace = calculatePace(fiveHour ?? 0, ctx.usageData.fiveHourResetAt, FIVE_HOUR_MS);
  const paceStr = formatPace(pace);

  let fiveHourSuffix = '';
  if (fiveHourReset) {
    fiveHourSuffix = paceStr
      ? ` (${paceStr} ${fiveHourReset})`
      : ` (${fiveHourReset} / 5h)`;
  }

  const fiveHourPart = usageBarEnabled
    ? `${quotaBar(fiveHour ?? 0, 5)} ${fiveHourDisplay}${fiveHourSuffix}`
    : `5h: ${fiveHourDisplay}${fiveHourSuffix}`;

  const sevenDayThreshold = display?.sevenDayThreshold ?? 80;
  if (sevenDay !== null && sevenDay >= sevenDayThreshold) {
    const sevenDayDisplay = formatUsagePercent(sevenDay);
    const sevenDayReset = formatResetTime(ctx.usageData.sevenDayResetAt);
    const sevenDayPace = calculatePace(sevenDay, ctx.usageData.sevenDayResetAt, SEVEN_DAY_MS);
    const sevenDayPaceStr = formatPace(sevenDayPace);

    let sevenDaySuffix = '';
    if (sevenDayReset) {
      sevenDaySuffix = sevenDayPaceStr
        ? ` (${sevenDayPaceStr} ${sevenDayReset})`
        : ` (${sevenDayReset} / 7d)`;
    }

    const sevenDayPart = usageBarEnabled
      ? `${quotaBar(sevenDay, 5)} ${sevenDayDisplay}${sevenDaySuffix}`
      : `7d: ${sevenDayDisplay}${sevenDaySuffix}`;
    return `${label} ${fiveHourPart} | ${sevenDayPart}`;
  }

  return `${label} ${fiveHourPart}`;
}

function formatUsagePercent(percent: number | null): string {
  if (percent === null) {
    return dim('--');
  }
  const color = getContextColor(percent);
  return `${color}${percent}%${RESET}`;
}

function formatUsageError(error?: string): string {
  if (!error) return '';
  if (error.startsWith('http-')) {
    return ` (${error.slice(5)})`;
  }
  return ` (${error})`;
}

function formatResetTime(resetAt: Date | null): string {
  if (!resetAt) return '';
  const now = new Date();
  const diffMs = resetAt.getTime() - now.getTime();
  if (diffMs <= 0) return '';

  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    if (remHours > 0) return `${days}d ${remHours}h`;
    return `${days}d`;
  }

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

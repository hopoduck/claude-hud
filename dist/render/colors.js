export const RESET = '\x1b[0m';
const DIM = '\x1b[38;2;160;160;170m';
const RED = '\x1b[38;2;255;140;140m';
const GREEN = '\x1b[38;2;180;230;180m';
const YELLOW = '\x1b[38;2;255;210;170m';
const MAGENTA = '\x1b[38;2;255;180;200m';
const CYAN = '\x1b[38;2;170;220;230m';
const BRIGHT_BLUE = '\x1b[38;2;150;200;255m';
const BRIGHT_MAGENTA = '\x1b[38;2;200;170;255m';
export function green(text) {
    return `${GREEN}${text}${RESET}`;
}
export function yellow(text) {
    return `${YELLOW}${text}${RESET}`;
}
export function red(text) {
    return `${RED}${text}${RESET}`;
}
export function cyan(text) {
    return `${CYAN}${text}${RESET}`;
}
export function magenta(text) {
    return `${MAGENTA}${text}${RESET}`;
}
export function brightMagenta(text) {
    return `${BRIGHT_MAGENTA}${text}${RESET}`;
}
export function dim(text) {
    return `${DIM}${text}${RESET}`;
}
export function getContextColor(percent) {
    if (percent >= 85)
        return RED;
    if (percent >= 70)
        return YELLOW;
    return GREEN;
}
export function getQuotaColor(percent) {
    if (percent >= 90)
        return RED;
    if (percent >= 75)
        return BRIGHT_MAGENTA;
    return BRIGHT_BLUE;
}
export function quotaBar(percent, width = 10) {
    const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
    const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
    const filled = Math.round((safePercent / 100) * safeWidth);
    const empty = safeWidth - filled;
    const color = getQuotaColor(safePercent);
    return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}
export function coloredBar(percent, width = 10) {
    const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
    const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
    const filled = Math.round((safePercent / 100) * safeWidth);
    const empty = safeWidth - filled;
    const color = getContextColor(safePercent);
    return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}
//# sourceMappingURL=colors.js.map
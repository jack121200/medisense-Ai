/**
 * A translucent version of a colour, for backgrounds, borders and glows.
 *
 * Tints used to be written as `${color}18` — a hex alpha suffix. That only
 * works for a hex colour: once the palette moved to CSS variables,
 * `var(--accent-primary)18` became invalid CSS and the browser silently
 * dropped every such background and border. A hex colour still takes the
 * suffix; anything else is mixed with transparent instead.
 */
export function tint(color: string, alphaHex: string): string {
    if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${alphaHex}`;
    const percent = Math.round((parseInt(alphaHex, 16) / 255) * 100);
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

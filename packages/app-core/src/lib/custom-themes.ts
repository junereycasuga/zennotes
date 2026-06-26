/**
 * Renderer side of custom themes + snippets.
 *
 * A custom theme is a folder of raw CSS (see `@shared/custom-themes`). We inject
 * only the *active* theme's `theme.css` — so an inactive theme's arbitrary or
 * global CSS is never present in the document — into a managed
 * `<style id="zen-active-theme">`, swapping its contents on theme switch.
 * Enabled snippets are concatenated into `<style id="zen-snippets">`, kept last
 * in <head> so they win the cascade over both built-in and custom themes.
 *
 * Light/dark is driven by `data-theme-mode` on <html> (set in App.tsx), so the
 * injected CSS reacts to mode flips without re-injection.
 */
import {
  customThemeSlugFromId,
  isCustomThemeId,
  type CustomTheme,
  type CustomThemeMode
} from '@shared/custom-themes'
import { isSnippetEnabled, type Snippet } from '@shared/snippets'

export { isCustomThemeId, customThemeSlugFromId }

const ACTIVE_THEME_STYLE_ID = 'zen-active-theme'
const SNIPPETS_STYLE_ID = 'zen-snippets'

/**
 * Create/update/remove a managed `<style>` by id. Empty `css` removes it.
 * Returns the element (or null when removed / no DOM).
 */
function applyManagedStyle(id: string, css: string): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null
  let style = document.getElementById(id) as HTMLStyleElement | null
  if (!css) {
    style?.remove()
    return null
  }
  if (!style) {
    style = document.createElement('style')
    style.id = id
    document.head.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
  return style
}

/** Move the snippets <style> to the end of <head> so it stays after the active
 *  theme and the bundled stylesheet (later source order → snippets win ties). */
function ensureSnippetsLast(): void {
  if (typeof document === 'undefined') return
  const snippets = document.getElementById(SNIPPETS_STYLE_ID)
  if (snippets) document.head.appendChild(snippets)
}

/** Inject (or clear) the active custom theme's raw CSS. Built-in themes — or a
 *  custom id with no matching/erroring theme — clear the managed style. */
export function injectActiveTheme(themeId: string, themes: CustomTheme[]): void {
  const slug = customThemeSlugFromId(themeId)
  const theme = slug ? themes.find((t) => t.slug === slug && !t.error) : undefined
  applyManagedStyle(ACTIVE_THEME_STYLE_ID, theme?.css ?? '')
  ensureSnippetsLast()
}

/** Inject the enabled snippets (filename order) after the active theme. */
export function injectSnippets(
  snippets: Snippet[],
  enabled: Record<string, string> | undefined
): void {
  const css = snippets
    .filter((s) => !s.error && isSnippetEnabled(enabled, s.name))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => `/* @snippet ${s.name} */\n${s.css.trim()}`)
    .join('\n\n')
  applyManagedStyle(SNIPPETS_STYLE_ID, css)
  ensureSnippetsLast()
}

/**
 * Resolve which mode a custom theme should render in. A single-mode theme pins
 * its one mode; a `both` theme follows the requested light/dark preference
 * (used for "auto" and to clamp an explicit choice the theme doesn't support).
 */
export function resolveCustomThemeMode(
  theme: Pick<CustomTheme, 'modes'> | undefined,
  prefersDark: boolean
): CustomThemeMode {
  if (theme) {
    if (theme.modes === 'light') return 'light'
    if (theme.modes === 'dark') return 'dark'
  }
  return prefersDark ? 'dark' : 'light'
}

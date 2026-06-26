/**
 * CSS snippets — small user-authored `.css` files in
 * `~/.config/zennotes/snippets/` that the user toggles on/off and that layer on
 * top of *whichever* theme is active (built-in or custom). The enabled set is
 * persisted as a portable config map (`[snippets]` in config.toml).
 *
 * To override a theme token from a snippet, target `:root[data-theme] { … }` —
 * snippets are injected last, so that selector wins over both a built-in's
 * `:root[data-theme="…"]` block and a custom theme's `:root {}`.
 */

export interface Snippet {
  /** Filename including `.css`, e.g. `punchy-accent.css`. Stable id. */
  name: string
  /** Raw CSS text, injected verbatim when enabled. */
  css: string
  /** Set when the file couldn't be read; surfaced in the UI. */
  error?: string
}

/**
 * Whether a snippet is enabled, per the persisted `[snippets]` map. Only enabled
 * snippets are stored (`"name.css" = "on"`); a missing key means off. Tolerant
 * of a hand-edited config that wrote an explicit off-ish value.
 */
export function isSnippetEnabled(
  enabled: Record<string, string> | undefined,
  name: string
): boolean {
  const v = enabled?.[name]
  return v !== undefined && v !== 'off' && v !== 'false' && v !== '0' && v !== ''
}

/**
 * Loads user CSS snippets from `~/.config/zennotes/snippets/*.css`.
 *
 * A snippet is a raw `.css` file the user toggles on/off; enabled snippets are
 * injected by the renderer on top of whichever theme is active. We just read
 * the files here and hand them over IPC; the enabled set lives in the portable
 * config (`[snippets]` in config.toml), not here. The directory is watched so
 * edits show up live. Mirrors `custom-themes.ts`.
 */
import { promises as fs } from 'node:fs'
import * as fsSync from 'node:fs'
import path from 'node:path'
import chokidar from 'chokidar'
import type { Snippet } from '@shared/snippets'
import { getConfigDir } from './app-config'

export function getSnippetsDir(): string {
  return path.join(getConfigDir(), 'snippets')
}

/** A bare `.css` filename resolving to a direct child of the snippets dir. */
function isSafeName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    !!name &&
    !/[/\\]/.test(name) &&
    !name.includes('..') &&
    name.toLowerCase().endsWith('.css')
  )
}

const EXAMPLE = `/* Example snippet — toggle it on in Settings → Appearance → Snippets.
 *
 * Snippets layer on top of whichever theme is active. To override a theme
 * token, target :root[data-theme] so it wins over both a built-in theme's
 * :root[data-theme="…"] block and a custom theme's :root {}. Tokens are
 * space-separated RGB triplets.
 */
:root[data-theme] {
  /* A punchier accent — uncomment to try it. */
  /* --z-accent: 255 59 48; */
}
`

const README = `# ZenNotes snippets

Drop a \`.css\` file here and toggle it on under
**Settings → Appearance → Snippets**. Enabled snippets are injected on top of
whichever theme is active (built-in or custom), in filename order, so they win
the cascade.

## Override a theme color

Target \`:root[data-theme]\` so your rule beats both a built-in theme's
\`:root[data-theme="…"]\` block and a custom theme's \`:root {}\`:

\`\`\`css
:root[data-theme] {
  --z-accent: 255 59 48;   /* space-separated RGB */
}
\`\`\`

You can also write any other CSS to tweak the UI. Remote URLs are not loaded.
`

/** Create the snippets dir on first run, seeding an example + README. */
export async function ensureSnippetsDir(): Promise<string> {
  const dir = getSnippetsDir()
  let existed = true
  try {
    await fs.access(dir)
  } catch {
    existed = false
  }
  await fs.mkdir(dir, { recursive: true })
  if (!existed) {
    await Promise.all([
      fs.writeFile(path.join(dir, 'example.css'), EXAMPLE).catch(() => {}),
      fs.writeFile(path.join(dir, 'README.md'), README).catch(() => {})
    ])
  }
  return dir
}

/** Read every `*.css` in the snippets dir into a Snippet (raw text). */
export async function listSnippets(): Promise<Snippet[]> {
  const dir = getSnippetsDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  const snippets: Snippet[] = []
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.css')) continue
    try {
      const css = await fs.readFile(path.join(dir, entry), 'utf8')
      snippets.push({ name: entry, css })
    } catch (err) {
      snippets.push({
        name: entry,
        css: '',
        error: err instanceof Error ? err.message : 'Could not read this snippet.'
      })
    }
  }
  snippets.sort((a, b) => a.name.localeCompare(b.name))
  return snippets
}

let watcher: ReturnType<typeof chokidar.watch> | null = null

/** Watch the snippets dir and call `onChange` (debounced) with the fresh list. */
export function startWatchingSnippets(onChange: (snippets: Snippet[]) => void): void {
  const dir = getSnippetsDir()
  void watcher?.close()
  let timer: ReturnType<typeof setTimeout> | null = null
  const fire = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void listSnippets().then(onChange)
    }, 200)
  }
  const w = chokidar.watch(dir, {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  })
  watcher = w
  w.on('add', fire).on('change', fire).on('unlink', fire)
}

/** Reveal a specific snippet file when the name is valid and exists, otherwise
 *  the snippets dir. */
export async function snippetRevealTarget(name?: string): Promise<string> {
  const dir = await ensureSnippetsDir()
  if (isSafeName(name)) {
    const file = path.join(dir, name)
    if (path.dirname(path.resolve(file)) === path.resolve(dir) && fsSync.existsSync(file)) {
      return file
    }
  }
  return dir
}

/** Delete a snippet file. Refuses anything that isn't a bare `.css` name
 *  resolving to a direct child of the snippets dir (no path traversal). */
export async function deleteSnippet(name: string): Promise<void> {
  if (!isSafeName(name)) return
  const dir = getSnippetsDir()
  const file = path.join(dir, name)
  if (path.dirname(path.resolve(file)) !== path.resolve(dir)) return
  await fs.rm(file, { force: true }).catch(() => {})
}

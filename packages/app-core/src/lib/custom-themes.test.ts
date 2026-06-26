// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { injectActiveTheme, injectSnippets, resolveCustomThemeMode } from './custom-themes'
import type { CustomTheme } from '@shared/custom-themes'
import type { Snippet } from '@shared/snippets'

const theme = (slug: string, css: string, extra: Partial<CustomTheme> = {}): CustomTheme => ({
  slug,
  name: slug,
  modes: 'both',
  css,
  ...extra
})

beforeEach(() => {
  document.head.innerHTML = ''
})

describe('injectActiveTheme', () => {
  it('injects the active theme css and clears it for built-ins', () => {
    const themes = [theme('soft-paper', ':root{--z-bg: 1 2 3}')]
    injectActiveTheme('custom-soft-paper', themes)
    expect(document.getElementById('zen-active-theme')?.textContent).toContain('--z-bg: 1 2 3')
    injectActiveTheme('dark-hard', themes) // built-in id → no managed style
    expect(document.getElementById('zen-active-theme')).toBeNull()
  })

  it('skips a theme flagged with an error', () => {
    injectActiveTheme('custom-broken', [theme('broken', 'x', { error: 'bad' })])
    expect(document.getElementById('zen-active-theme')).toBeNull()
  })
})

describe('injectSnippets', () => {
  it('injects only enabled snippets, in filename order, after the theme', () => {
    injectActiveTheme('custom-x', [theme('x', ':root{}')])
    const snippets: Snippet[] = [
      { name: 'b.css', css: '.b{}' },
      { name: 'a.css', css: '.a{}' },
      { name: 'off.css', css: '.off{}' }
    ]
    injectSnippets(snippets, { 'a.css': 'on', 'b.css': 'on' })
    const text = document.getElementById('zen-snippets')!.textContent!
    expect(text.indexOf('.a{}')).toBeLessThan(text.indexOf('.b{}')) // sorted
    expect(text).not.toContain('.off{}') // disabled excluded
    const ids = Array.from(document.head.children).map((c) => c.id)
    expect(ids.indexOf('zen-snippets')).toBeGreaterThan(ids.indexOf('zen-active-theme'))
  })

  it('removes the snippets style when nothing is enabled', () => {
    injectSnippets([{ name: 'a.css', css: '.a{}' }], {})
    expect(document.getElementById('zen-snippets')).toBeNull()
  })
})

describe('resolveCustomThemeMode', () => {
  it('pins single-mode themes and follows preference for both', () => {
    expect(resolveCustomThemeMode({ modes: 'dark' }, false)).toBe('dark')
    expect(resolveCustomThemeMode({ modes: 'light' }, true)).toBe('light')
    expect(resolveCustomThemeMode({ modes: 'both' }, true)).toBe('dark')
    expect(resolveCustomThemeMode({ modes: 'both' }, false)).toBe('light')
    expect(resolveCustomThemeMode(undefined, true)).toBe('dark')
  })
})

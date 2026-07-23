// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { vim } from '@replit/codemirror-vim'
import {
  autoPairBackspaceTransaction,
  autoPairExtension,
  autoPairInputTransaction
} from './cm-auto-pairs'
import { vimAwareDefaultKeymap, vimAwareMarkdownKeymap } from './cm-vim-default-keymap'

function state(doc: string, anchor = doc.length, head = anchor): EditorState {
  return EditorState.create({ doc, selection: EditorSelection.range(anchor, head) })
}

describe('autoPairInputTransaction', () => {
  it.each([
    ['(', ')'],
    ['{', '}']
  ])('inserts %s with its matching closer', (open, close) => {
    const next = state('').update(autoPairInputTransaction(state(''), 0, 0, open)!).state

    expect(next.doc.toString()).toBe(open + close)
    expect(next.selection.main.head).toBe(1)
  })

  it('wraps the selected text', () => {
    const current = state('note', 0, 4)
    const next = current.update(autoPairInputTransaction(current, 0, 4, '{')!).state

    expect(next.doc.toString()).toBe('{note}')
    expect(next.selection.main.from).toBe(1)
    expect(next.selection.main.to).toBe(5)
  })

  it('moves over an existing closer instead of inserting another', () => {
    const current = state('()', 1)
    const next = current.update(autoPairInputTransaction(current, 1, 1, ')')!).state

    expect(next.doc.toString()).toBe('()')
    expect(next.selection.main.head).toBe(2)
  })

  it('does not handle unrelated or multi-character input', () => {
    const current = state('')
    expect(autoPairInputTransaction(current, 0, 0, 'x')).toBeNull()
    expect(autoPairInputTransaction(current, 0, 0, '()')).toBeNull()
  })
})

describe('autoPairBackspaceTransaction', () => {
  it('removes an empty pair around the cursor', () => {
    const current = state('{}', 1)
    const next = current.update(autoPairBackspaceTransaction(current)!).state

    expect(next.doc.toString()).toBe('')
    expect(next.selection.main.head).toBe(0)
  })

  it('leaves non-empty pairs to normal backspace behavior', () => {
    expect(autoPairBackspaceTransaction(state('{x}', 1))).toBeNull()
  })
})

describe('disabled auto pairs', () => {
  const views: EditorView[] = []
  afterEach(() => views.splice(0).forEach((view) => view.destroy()))

  function mount(withDisabledAutoPairs: boolean): EditorView {
    const view = new EditorView({
      state: EditorState.create({
        doc: '{',
        selection: { anchor: 1 },
        extensions: [
          vim(),
          markdown({ base: markdownLanguage, addKeymap: false }),
          vimAwareMarkdownKeymap,
          ...(withDisabledAutoPairs ? [autoPairExtension({ shouldHandle: () => false })] : []),
          keymap.of([...vimAwareDefaultKeymap(true)])
        ]
      }),
      parent: document.body
    })
    views.push(view)
    view.focus()
    view.contentDOM.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'i', keyCode: 73, bubbles: true, cancelable: true })
    )
    return view
  }

  function pressEnter(view: EditorView): void {
    view.contentDOM.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true })
    )
  }

  it('leaves Enter behavior unchanged from the editor without the extension', () => {
    const baseline = mount(false)
    const disabled = mount(true)

    pressEnter(baseline)
    pressEnter(disabled)

    expect(baseline.state.doc.toString()).toBe('{\n')
    expect(disabled.state.doc.toString()).toBe(baseline.state.doc.toString())
    expect(disabled.state.selection.main.head).toBe(baseline.state.selection.main.head)
  })
})

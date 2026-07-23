import { EditorSelection, type EditorState, type Extension, type TransactionSpec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

const PAIRS: Readonly<Record<string, string>> = {
  '(': ')',
  '{': '}'
}

const CLOSERS = new Set(Object.values(PAIRS))

export interface AutoPairExtensionConfig {
  shouldHandle?: (view: EditorView) => boolean
}

/**
 * Builds the editor transaction for paired delimiters. Kept separate from the
 * DOM extension so the edge cases can be tested without a mounted editor.
 */
export function autoPairInputTransaction(
  state: EditorState,
  from: number,
  to: number,
  text: string
): TransactionSpec | null {
  if (text.length !== 1) return null

  const close = PAIRS[text]
  if (close) {
    const selected = state.sliceDoc(from, to)
    return {
      changes: { from, to, insert: text + selected + close },
      selection: EditorSelection.range(from + 1, to + 1)
    }
  }

  if (from === to && CLOSERS.has(text) && state.sliceDoc(from, from + 1) === text) {
    return { selection: EditorSelection.cursor(from + 1) }
  }

  return null
}

export function autoPairBackspaceTransaction(state: EditorState): TransactionSpec | null {
  const selection = state.selection.main
  if (!selection.empty || selection.head === 0) return null

  const from = selection.head - 1
  const open = state.sliceDoc(from, selection.head)
  const close = PAIRS[open]
  if (!close || state.sliceDoc(selection.head, selection.head + 1) !== close) return null

  return {
    changes: { from, to: selection.head + 1, insert: '' },
    selection: EditorSelection.cursor(from)
  }
}

/**
 * Standard paired-delimiter editing, optionally restricted by the caller
 * (ZenNotes uses that to allow it only outside Vim normal/visual modes).
 */
export function autoPairExtension(config: AutoPairExtensionConfig = {}): Extension {
  const shouldHandle = (view: EditorView): boolean => !config.shouldHandle || config.shouldHandle(view)

  return [
    EditorView.inputHandler.of((view, from, to, text) => {
      if (!shouldHandle(view)) return false
      const transaction = autoPairInputTransaction(view.state, from, to, text)
      if (!transaction) return false
      view.dispatch(transaction)
      return true
    }),
    keymap.of([
      {
        key: 'Backspace',
        run: (view): boolean => {
          if (!shouldHandle(view)) return false
          const transaction = autoPairBackspaceTransaction(view.state)
          if (!transaction) return false
          view.dispatch(transaction)
          return true
        }
      }
    ])
  ]
}

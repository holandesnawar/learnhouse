import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface HLItem {
  id: number
  from: number
  to: number
  color: string
  hasNote: boolean
}

export const lessonHighlightPluginKey = new PluginKey('nawarLessonHighlights')

const COLOR_BG: Record<string, string> = {
  yellow: '#FEF3C7',
  pink: '#FBD5E0',
  blue: '#D6E4FF',
  green: '#D5F0DD',
}

// Small note icon (lucide "sticky-note") as inline SVG for the margin widget.
const NOTE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>'

function buildDecos(doc: any, items: HLItem[]): DecorationSet {
  const decos: Decoration[] = []
  const docSize = doc.content.size
  for (const it of items) {
    const from = Math.max(1, Math.min(it.from, docSize))
    const to = Math.max(1, Math.min(it.to, docSize))
    if (from >= to) continue
    decos.push(
      Decoration.inline(from, to, {
        class: `nawar-hl nawar-hl-${it.color}`,
        style: `background-color:${COLOR_BG[it.color] || COLOR_BG.yellow};border-radius:3px;padding:0 1px;cursor:pointer;`,
        'data-hl-id': String(it.id),
      })
    )
    if (it.hasNote) {
      // Place the note icon at the start of the textblock containing the
      // highlight, so it sits at the beginning of the line (like a margin mark).
      let iconPos = from
      try {
        iconPos = doc.resolve(from).start()
      } catch {
        iconPos = from
      }
      decos.push(
        Decoration.widget(
          iconPos,
          () => {
            const el = document.createElement('button')
            el.type = 'button'
            el.className = 'nawar-hl-note-icon'
            el.setAttribute('data-hl-id', String(it.id))
            el.setAttribute('contenteditable', 'false')
            el.setAttribute('title', 'Ver tu nota')
            el.innerHTML = NOTE_ICON_SVG
            return el
          },
          { side: -1, key: `note-${it.id}` }
        )
      )
    }
  }
  return DecorationSet.create(doc, decos)
}

/** Push the current highlight items into the editor's decoration plugin. */
export function setLessonHighlights(editor: any, items: HLItem[]) {
  if (!editor || !editor.view) return
  const { tr } = editor.state
  tr.setMeta(lessonHighlightPluginKey, { items })
  editor.view.dispatch(tr)
}

const LessonHighlightExtension = Extension.create({
  name: 'nawarLessonHighlights',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: lessonHighlightPluginKey,
        state: {
          init() {
            return { items: [] as HLItem[], decos: DecorationSet.empty }
          },
          apply(tr, value: { items: HLItem[]; decos: DecorationSet }, _old, newState) {
            const meta = tr.getMeta(lessonHighlightPluginKey)
            if (meta && Array.isArray(meta.items)) {
              return { items: meta.items, decos: buildDecos(newState.doc, meta.items) }
            }
            if (tr.docChanged) {
              return { items: value.items, decos: value.decos.map(tr.mapping, newState.doc) }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            return (lessonHighlightPluginKey.getState(state) as any)?.decos
          },
        },
      }),
    ]
  },
})

export default LessonHighlightExtension

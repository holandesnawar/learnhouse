import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import AccordionComponent from './AccordionComponent'

/**
 * Acordeón / FAQ desplegable: una pregunta (summary) que al pulsarla despliega
 * la respuesta debajo. Tres nodos: wrapper + summary (inline) + content (bloques).
 *
 * Abierto/cerrado NO se guarda en el documento (en la vista del alumno el
 * editor bloquea cualquier cambio del documento) ni en el estado de React (la
 * vista del nodo se recrea en cada transacción y se cerraba sola). Vive en el
 * estado de este plugin, indexado por POSICIÓN del bloque y remapeado en cada
 * edición: así dos tarjetas duplicadas se abren y cierran por separado. El
 * plugin pinta una decoración con la clase `lh-acc-open` / `lh-acc-shut` y el
 * CSS hace el resto.
 */

export const accordionStateKey = new PluginKey('accordionOpenState')

/** pos del bloque → abierto (true) / cerrado (false) elegido por el usuario. */
type OpenMap = Map<number, boolean>

export const AccordionSummary = Node.create({
  name: 'accordionSummary',
  content: 'inline*',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="accordion-summary"]' }, { tag: 'summary' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'accordion-summary',
        class: 'lh-acc-summary',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      // Enter en la pregunta no la parte en dos: salta a la respuesta.
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection
        if ($from.parent.type.name !== this.name) return false
        return editor
          .chain()
          .focus()
          .setTextSelection($from.after() + 1)
          .run()
      },
      // Retroceso al principio de una tarjeta vacía: se borra entera (si no,
      // quedaba un bloque a medias imposible de quitar con el teclado).
      Backspace: ({ editor }) => {
        const { state } = editor
        const { $from, empty } = state.selection
        if (!empty) return false
        if ($from.parent.type.name !== this.name) return false
        if ($from.parentOffset !== 0) return false

        const accPos = $from.before($from.depth - 1)
        const acc = state.doc.nodeAt(accPos)
        if (!acc || acc.type.name !== 'accordion') return false
        if (acc.textContent.trim() !== '') return false

        return editor
          .chain()
          .focus()
          .deleteRange({ from: accPos, to: accPos + acc.nodeSize })
          .run()
      },
    }
  },
})

export const AccordionContent = Node.create({
  name: 'accordionContent',
  content: 'block+',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="accordion-content"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'accordion-content',
        class: 'lh-acc-content',
      }),
      0,
    ]
  },
})

const Accordion = Node.create({
  name: 'accordion',
  group: 'block',
  content: 'accordionSummary accordionContent',
  draggable: true,
  defining: true,

  addAttributes() {
    return {
      uid: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-uid'),
        renderHTML: (attrs) => (attrs.uid ? { 'data-uid': attrs.uid } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="accordion"]' }, { tag: 'details' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'accordion', class: 'lh-accordion' }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AccordionComponent)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: accordionStateKey,
        state: {
          init: (): OpenMap => new Map(),
          apply(tr, value: OpenMap): OpenMap {
            let next = value

            // Al editar el documento, las posiciones se mueven: se remapean
            // para no perder qué tarjeta estaba abierta.
            if (tr.docChanged && value.size) {
              const mapped: OpenMap = new Map()
              value.forEach((open, pos) => {
                const res = tr.mapping.mapResult(pos)
                if (!res.deleted) mapped.set(res.pos, open)
              })
              next = mapped
            }

            const meta = tr.getMeta(accordionStateKey)
            if (meta && typeof meta.pos === 'number') {
              next = new Map(next)
              next.set(meta.pos, Boolean(meta.open))
            }

            return next
          },
        },
        props: {
          decorations(state) {
            const map = accordionStateKey.getState(state) as OpenMap | undefined
            if (!map || map.size === 0) return DecorationSet.empty

            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'accordion') return true
              if (map.has(pos)) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: map.get(pos) ? 'lh-acc-open' : 'lh-acc-shut',
                  })
                )
              }
              return false
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

/** Contenido de una tarjeta nueva, lista para escribir encima. */
export function newAccordionNode() {
  return {
    type: 'accordion',
    attrs: { uid: `acc-${Math.random().toString(36).slice(2, 10)}` },
    content: [
      {
        type: 'accordionSummary',
        content: [{ type: 'text', text: 'Escribe aquí la pregunta' }],
      },
      {
        type: 'accordionContent',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Y aquí la respuesta que se despliega.' }],
          },
        ],
      },
    ],
  }
}

export default Accordion

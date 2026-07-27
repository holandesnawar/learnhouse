import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import AccordionComponent from './AccordionComponent'

/**
 * Acordeón / FAQ desplegable: una pregunta (summary) que al pulsarla despliega
 * la respuesta debajo. Tres nodos: wrapper + summary (inline) + content (bloques).
 * En el editor nace abierto para poder redactar; en la vista del alumno nace
 * cerrado y se abre al pulsar la pregunta. El estado abierto/cerrado es local
 * (no se guarda en el documento).
 */

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
      // Identificador estable del bloque: permite recordar si el alumno lo
      // dejó abierto aunque ProseMirror recree la vista del nodo.
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
})

export default Accordion

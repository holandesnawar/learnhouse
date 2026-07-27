'use client'
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { CaretDown } from '@phosphor-icons/react'
import React, { useState } from 'react'

/**
 * NodeView del acordeón. La pregunta y la respuesta son contenido ProseMirror
 * (NodeViewContent); aquí solo se controla abierto/cerrado con una clase CSS
 * (`.lh-acc-closed` oculta la respuesta, ver globals.css).
 *
 * Ojo: al ser un nodo CON contenido, ProseMirror puede destruir y recrear esta
 * vista en cualquier transacción (una selección, el resaltado del alumno…), y
 * con un `useState` normal el bloque se volvía a cerrar solo justo después de
 * abrirlo. Por eso el estado vive en este mapa de módulo, fuera de React.
 */
const openStates = new Map<string, boolean>()

function keyFor(node: any): string {
  // uid del bloque si lo tiene; si no, el texto de la pregunta (único en un FAQ).
  return node?.attrs?.uid || node?.firstChild?.textContent?.slice(0, 120) || ''
}

function AccordionComponent(props: any) {
  const editorState = useEditorProvider() as any
  // En el editor de admin el provider da isEditable=true; en la vista del
  // alumno, false.
  const isEditable = editorState?.isEditable ?? false
  const stateKey = keyFor(props.node)

  // Redactando nace abierto (hay que poder editar la respuesta); el alumno lo
  // ve cerrado. Si ya se tocó antes, se respeta lo que eligió.
  const [open, setOpen] = useState<boolean>(() => {
    if (stateKey && openStates.has(stateKey)) return openStates.get(stateKey) as boolean
    return isEditable
  })

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      if (stateKey) openStates.set(stateKey, next)
      return next
    })
  }

  // Un solo manejador (mousedown) para no encadenar dos toggles con el click.
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const onChevron = Boolean(target.closest('[data-acc-toggle]'))
    const onSummary = Boolean(target.closest('[data-type="accordion-summary"]'))

    // Redactando, la pregunta se edita con normalidad: solo el chevron pliega.
    if (!onChevron && (isEditable || !onSummary)) return

    e.preventDefault()
    e.stopPropagation()
    toggle()
  }

  return (
    <NodeViewWrapper>
      <div
        className={`lh-acc my-3 rounded-xl border border-[#DDE6F5] bg-white overflow-hidden ${
          open ? 'shadow-sm' : 'lh-acc-closed'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`relative ${isEditable ? '' : 'cursor-pointer'}`}>
          <button
            type="button"
            data-acc-toggle="true"
            contentEditable={false}
            aria-label={open ? 'Cerrar' : 'Abrir'}
            aria-expanded={open}
            className="absolute right-3 top-3.5 z-10 flex items-center justify-center w-7 h-7 rounded-lg text-[#025dc7] hover:bg-[#F0F5FF] transition-colors cursor-pointer"
          >
            <CaretDown
              size={16}
              weight="bold"
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
          <NodeViewContent className="lh-acc-inner" />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default AccordionComponent

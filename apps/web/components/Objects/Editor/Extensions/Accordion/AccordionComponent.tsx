'use client'
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { CaretDown } from '@phosphor-icons/react'
import React, { useState } from 'react'

/**
 * NodeView del acordeón. Los hijos (pregunta y respuesta) los pinta ProseMirror
 * dentro de NodeViewContent; aquí solo controlamos abierto/cerrado con una clase
 * CSS (`.lh-acc-closed` oculta la respuesta, ver globals.css) y el chevron.
 */
function AccordionComponent(props: any) {
  const editorState = useEditorProvider() as any
  // En el editor de admin no hay provider con isEditable=false → editable.
  const isEditable = editorState?.isEditable ?? props.editor?.isEditable ?? false
  // Redactando nace abierto; el alumno lo ve cerrado hasta que pulsa.
  const [open, setOpen] = useState<boolean>(isEditable)

  const toggle = () => setOpen((v) => !v)

  const handleWrapperClick = (e: React.MouseEvent) => {
    if (isEditable) return
    const target = e.target as HTMLElement
    if (target.closest('[data-type="accordion-summary"]')) toggle()
  }

  return (
    <NodeViewWrapper>
      <div
        className={`lh-acc my-3 rounded-xl border border-[#DDE6F5] bg-white overflow-hidden transition-shadow ${
          open ? 'shadow-sm' : ''
        } ${open ? '' : 'lh-acc-closed'} ${isEditable ? '' : 'cursor-pointer'}`}
        onClick={handleWrapperClick}
      >
        <div className="relative">
          <button
            type="button"
            contentEditable={false}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggle()
            }}
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

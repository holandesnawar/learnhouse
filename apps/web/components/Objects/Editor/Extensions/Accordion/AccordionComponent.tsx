'use client'
import { useEditorProvider } from '@components/Contexts/Editor/EditorContext'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { CaretDown, Copy, Plus, Trash } from '@phosphor-icons/react'
import React from 'react'
import { accordionStateKey, newAccordionNode } from './Accordion'

/**
 * Vista del acordeón. Sin estado de React a propósito: ProseMirror recrea esta
 * vista en cualquier transacción, así que abierto/cerrado vive en el plugin
 * (ver Accordion.ts) y se pinta con clases CSS. Aquí solo se despacha el
 * cambio y se ofrecen los botones de la tarjeta al redactar.
 */
function AccordionComponent(props: any) {
  const editorState = useEditorProvider() as any
  const isEditable = editorState?.isEditable ?? false

  const getPos = (): number | null => {
    const pos = typeof props.getPos === 'function' ? props.getPos() : null
    return typeof pos === 'number' ? pos : null
  }

  const toggle = () => {
    const pos = getPos()
    if (pos === null) return
    const { state, view } = props.editor
    const map = accordionStateKey.getState(state) as Map<number, boolean> | undefined
    const stored = map?.get(pos)
    const isOpenNow = stored === undefined ? isEditable : stored
    const tr = state.tr.setMeta(accordionStateKey, { pos, open: !isOpenNow })
    tr.setMeta('addToHistory', false)
    view.dispatch(tr)
  }

  const addBelow = () => {
    const pos = getPos()
    if (pos === null) return
    props.editor
      .chain()
      .focus()
      .insertContentAt(pos + props.node.nodeSize, newAccordionNode())
      .run()
  }

  const duplicate = () => {
    const pos = getPos()
    if (pos === null) return
    const copy = props.node.toJSON()
    // uid nuevo: dos tarjetas no deben compartir identidad.
    copy.attrs = { ...(copy.attrs || {}), uid: `acc-${Math.random().toString(36).slice(2, 10)}` }
    props.editor
      .chain()
      .focus()
      .insertContentAt(pos + props.node.nodeSize, copy)
      .run()
  }

  const remove = () => {
    const pos = getPos()
    if (pos === null) return
    props.editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + props.node.nodeSize })
      .run()
  }

  // Un solo manejador (mousedown) para no encadenar dos toggles con el click.
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-acc-action]')) return // botones de edición
    const onChevron = Boolean(target.closest('[data-acc-toggle]'))
    const onSummary = Boolean(target.closest('[data-type="accordion-summary"]'))

    // Redactando, la pregunta se edita con normalidad: solo el chevron pliega.
    if (!onChevron && (isEditable || !onSummary)) return

    e.preventDefault()
    e.stopPropagation()
    toggle()
  }

  const actionBtn =
    'flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-[#025dc7] hover:bg-[#F0F5FF] transition-colors cursor-pointer'

  return (
    <NodeViewWrapper>
      <div
        className={`lh-acc my-3 rounded-xl border border-[#DDE6F5] bg-white overflow-hidden ${
          isEditable ? 'lh-acc-default-open lh-acc-edit' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className={`relative ${isEditable ? '' : 'cursor-pointer'}`}>
          <div
            contentEditable={false}
            className="absolute right-2.5 top-2.5 z-10 flex items-center gap-0.5"
          >
            {isEditable && (
              <>
                <button
                  type="button"
                  data-acc-action="add"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    addBelow()
                  }}
                  className={actionBtn}
                  title="Añadir otra pregunta debajo"
                  aria-label="Añadir otra pregunta debajo"
                >
                  <Plus size={15} weight="bold" />
                </button>
                <button
                  type="button"
                  data-acc-action="duplicate"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    duplicate()
                  }}
                  className={actionBtn}
                  title="Duplicar esta pregunta"
                  aria-label="Duplicar esta pregunta"
                >
                  <Copy size={15} />
                </button>
                <button
                  type="button"
                  data-acc-action="delete"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    remove()
                  }}
                  className={`${actionBtn} hover:text-red-600 hover:bg-red-50`}
                  title="Eliminar esta pregunta"
                  aria-label="Eliminar esta pregunta"
                >
                  <Trash size={15} />
                </button>
              </>
            )}
            <button
              type="button"
              data-acc-toggle="true"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-[#025dc7] hover:bg-[#F0F5FF] transition-colors cursor-pointer"
              title="Abrir / cerrar"
              aria-label="Abrir o cerrar"
            >
              <CaretDown size={16} weight="bold" className="lh-acc-chevron" />
            </button>
          </div>
          <NodeViewContent className="lh-acc-inner" />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default AccordionComponent

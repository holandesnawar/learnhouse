'use client'
/**
 * La descripción de una tarjeta de producción (19/11/2026): el editor de la
 * escuela (Tiptap) con su barra, como en Nextcloud: deshacer, títulos,
 * negrita, cursiva, subrayado, tachado, listas, cita, tabla y enlaces.
 *
 * Guarda lo que da el editor (JSON). Lee también HTML (lo que viene de
 * Nextcloud y la plantilla del curso). Nada se pinta como HTML suelto: todo
 * pasa por el editor, que tira lo que no conoce.
 */
import React, { useEffect, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import {
  ArrowArcLeft,
  ArrowArcRight,
  ListBullets,
  ListNumbers,
  LinkSimple,
  Quotes,
  Table as IconoTabla,
  TextB,
  TextHOne,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
} from '@phosphor-icons/react'
import { getLinkExtension } from '@components/Objects/Editor/EditorConf'

export function contenidoInicial(texto: string): any {
  const t = (texto || '').trim()
  if (!t) return ''
  if (t.startsWith('{')) {
    try {
      return JSON.parse(t)
    } catch {
      return ''
    }
  }
  return t
}

function Boton({ activo, onClick, titulo, children, deshabilitado }: { activo?: boolean; onClick: () => void; titulo: string; children: React.ReactNode; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={deshabilitado}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-8 h-8 shrink-0 rounded-md flex items-center justify-center transition-colors disabled:opacity-30 ${
        activo ? 'bg-[#E8EEFC] text-[#0b2da0]' : 'text-[#4A5272] hover:bg-[#F1F4FA] hover:text-[#0B1033]'
      }`}
    >
      {children}
    </button>
  )
}

function Barra({ editor }: { editor: Editor }) {
  const enlace = () => {
    const antes = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Dirección del enlace (déjala vacía para quitarlo)', antes || 'https://')
    if (url === null) return
    if (!url.trim() || url.trim() === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    const limpia = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`
    if (editor.state.selection.empty && !antes) {
      editor.chain().focus().insertContent(`<a href="${limpia.replace(/"/g, '&quot;')}">${limpia.replace(/</g, '&lt;')}</a> `).run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: limpia }).run()
    }
  }
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1.5 border-b border-[#E9EDF5] -mx-1 px-1">
      <Boton titulo="Deshacer" onClick={() => editor.chain().focus().undo().run()} deshabilitado={!editor.can().undo()}>
        <ArrowArcLeft size={17} />
      </Boton>
      <Boton titulo="Rehacer" onClick={() => editor.chain().focus().redo().run()} deshabilitado={!editor.can().redo()}>
        <ArrowArcRight size={17} />
      </Boton>
      <span className="w-px h-5 bg-[#E2E7F0] mx-1 shrink-0" />
      <Boton titulo="Título" activo={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <TextHOne size={17} />
      </Boton>
      <Boton titulo="Subtítulo" activo={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <TextHTwo size={17} />
      </Boton>
      <Boton titulo="Negrita" activo={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <TextB size={17} weight="bold" />
      </Boton>
      <Boton titulo="Cursiva" activo={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <TextItalic size={17} />
      </Boton>
      <Boton titulo="Subrayado" activo={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <TextUnderline size={17} />
      </Boton>
      <Boton titulo="Tachado" activo={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <TextStrikethrough size={17} />
      </Boton>
      <span className="w-px h-5 bg-[#E2E7F0] mx-1 shrink-0" />
      <Boton titulo="Lista" activo={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <ListBullets size={17} />
      </Boton>
      <Boton titulo="Lista numerada" activo={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListNumbers size={17} />
      </Boton>
      <Boton titulo="Cita" activo={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quotes size={17} />
      </Boton>
      <Boton titulo="Tabla" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <IconoTabla size={17} />
      </Boton>
      <Boton titulo="Enlace" activo={editor.isActive('link')} onClick={enlace}>
        <LinkSimple size={17} />
      </Boton>
    </div>
  )
}

export default function EditorDescripcion({
  id,
  inicial,
  onCambio,
  soloLeer,
}: {
  /** Cambia al abrir otra tarjeta: el editor empieza de nuevo. */
  id: number
  inicial: string
  onCambio: (json: string) => void
  soloLeer?: boolean
}) {
  const cambio = useRef(onCambio)
  cambio.current = onCambio
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !soloLeer,
      extensions: [
        StarterKit.configure({ codeBlock: false, link: false }),
        getLinkExtension(),
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({ placeholder: 'Escribe aquí: de qué va, los objetivos, dónde están los entregables…' }),
      ],
      content: contenidoInicial(inicial),
      editorProps: { attributes: { class: 'prod-descripcion outline-none min-h-[180px] py-3 text-[15px] leading-relaxed text-[#1A2040]' } },
      onUpdate: ({ editor: e }) => cambio.current(JSON.stringify(e.getJSON())),
    },
    [id]
  )
  useEffect(() => {
    editor?.setEditable(!soloLeer)
  }, [editor, soloLeer])

  if (!editor) return <div className="min-h-[220px] rounded-lg bg-[#F6F8FC] animate-pulse" />
  return (
    <div>
      {!soloLeer ? <Barra editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  )
}

'use client'
import React, { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { mergeAttributes, Node } from '@tiptap/core'
import { getLinkExtension } from '@components/Objects/Editor/EditorConf'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { broadcastNotification } from '@services/notifications/broadcast'
import toast from 'react-hot-toast'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Quote,
  Send,
  Loader2,
  Mail,
  Eye,
} from 'lucide-react'

/**
 * Redactor de avisos con formato.
 *
 * Es el hermano mayor de la casilla "avisar por email" del chat: aquí se
 * escribe un correo de novedades de verdad (títulos, negritas, listas,
 * imágenes y un botón) y se manda a todos los alumnos. El cuerpo viaja como
 * HTML y el servidor lo limpia y le mete los estilos en línea, porque los
 * clientes de correo ignoran las hojas de estilo.
 */

/** Imagen simple para el correo. Se define aquí para no meter una dependencia
 *  nueva solo por esto: el correo solo necesita un <img> con su dirección. */
const ImagenCorreo = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'img[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },
})

const PLANTILLA = `<h2>Novedades de esta semana</h2>
<p>Esto es lo que ha cambiado en la formación:</p>
<ul>
<li><strong>Nuevo módulo disponible</strong> — ya puedes entrar a Módulo 3.</li>
<li><strong>Clase semanal</strong> — el jueves a las 19:00, con enlace en Eventos.</li>
<li><strong>Fallos arreglados</strong> — el progreso ya se guarda al instante.</li>
</ul>
<p>Nos vemos dentro.</p>`

export default function AvisosComposer() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  const [subject, setSubject] = useState('Novedades de esta semana')
  const [ctaLabel, setCtaLabel] = useState('Ver los detalles')
  const [ctaUrl, setCtaUrl] = useState('https://academia.holandesnawar.nl')
  const [testOnly, setTestOnly] = useState(true)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false, link: false }),
      getLinkExtension(),
      ImagenCorreo,
    ],
    content: PLANTILLA,
    editorProps: {
      attributes: {
        class: 'avisos-body outline-none min-h-[320px] px-5 py-4',
      },
    },
  })

  const btn = (active: boolean) =>
    `w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
      active ? 'bg-[#025dc7] text-white' : 'text-gray-500 hover:bg-[#F0F5FF] hover:text-[#025dc7]'
    }`

  const addLink = () => {
    const url = window.prompt('Dirección del enlace (empezando por https://)')
    if (!url) return
    editor?.chain().focus().setLink({ href: url, target: '_blank' }).run()
  }

  const addImage = () => {
    const url = window.prompt('Dirección de la imagen (https://…)')
    if (!url) return
    editor?.chain().focus().insertContent({ type: 'image', attrs: { src: url } }).run()
  }

  const send = async () => {
    const html = editor?.getHTML() || ''
    if (!subject.trim()) {
      toast.error('Ponle un asunto al aviso')
      return
    }
    if (!html.replace(/<[^>]*>/g, '').trim()) {
      toast.error('El aviso está vacío')
      return
    }
    if (!testOnly) {
      const ok = window.confirm(
        `Se va a enviar "${subject}" a TODOS los alumnos.\n\n¿Seguro que quieres mandarlo?`
      )
      if (!ok) return
    }

    setSending(true)
    const res = await broadcastNotification(
      {
        org_id: org?.id,
        kind: 'news',
        title: subject.trim(),
        body_html: html,
        cta_label: ctaLabel.trim(),
        cta_url: ctaUrl.trim(),
        test_only: testOnly,
      },
      accessToken
    )
    setSending(false)

    if (!res) {
      toast.error('No se pudo enviar el aviso')
      return
    }
    toast.success(
      testOnly
        ? 'Prueba enviada solo a tu correo. Míralo antes de mandarlo a todos.'
        : `Aviso enviado a ${res.queued} alumnos.`
    )
  }

  return (
    <div className="h-full w-full bg-[#f8f8f8] px-4 sm:px-9 py-9">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Mail size={20} className="text-[#025dc7]" />
          <h1 className="text-xl font-bold text-gray-900">Avisos</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Escribe un correo de novedades y mándalo a todos los alumnos. Empieza
          siempre con el envío de prueba: te llega solo a ti y ves cómo queda de
          verdad en la bandeja antes de que lo reciba nadie más.
        </p>

        {/* Asunto */}
        <label className="block text-[13px] font-semibold text-[#0a1656] mb-1.5">
          Asunto del correo
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full mb-5 bg-white rounded-lg px-4 py-2.5 text-[15px] border border-[#DDE6F5] outline-none focus:border-[#4da3ff]"
        />

        {/* Cuerpo */}
        <label className="block text-[13px] font-semibold text-[#0a1656] mb-1.5">
          Contenido
        </label>
        <div className="bg-white border border-[#DDE6F5] rounded-xl overflow-hidden mb-5">
          <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-[#EEF2FB] bg-[#FBFCFF]">
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={btn(!!editor?.isActive('heading', { level: 2 }))} title="Título">
              <Heading2 size={17} />
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              className={btn(!!editor?.isActive('heading', { level: 3 }))} title="Subtítulo">
              <Heading3 size={17} />
            </button>
            <span className="w-px h-5 bg-[#DDE6F5] mx-1" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}
              className={btn(!!editor?.isActive('bold'))} title="Negrita">
              <Bold size={17} />
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={btn(!!editor?.isActive('italic'))} title="Cursiva">
              <Italic size={17} />
            </button>
            <span className="w-px h-5 bg-[#DDE6F5] mx-1" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={btn(!!editor?.isActive('bulletList'))} title="Lista">
              <List size={17} />
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={btn(!!editor?.isActive('orderedList'))} title="Lista numerada">
              <ListOrdered size={17} />
            </button>
            <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className={btn(!!editor?.isActive('blockquote'))} title="Cita">
              <Quote size={17} />
            </button>
            <span className="w-px h-5 bg-[#DDE6F5] mx-1" />
            <button type="button" onClick={addLink} className={btn(!!editor?.isActive('link'))} title="Enlace">
              <LinkIcon size={17} />
            </button>
            <button type="button" onClick={addImage} className={btn(false)} title="Imagen por dirección">
              <ImageIcon size={17} />
            </button>
            <button type="button" onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              className={btn(false)} title="Separador">
              <Minus size={17} />
            </button>
            <button type="button" onClick={() => setPreview((v) => !v)}
              className={`${btn(preview)} ml-auto`} title="Ver cómo queda">
              <Eye size={17} />
            </button>
          </div>

          {preview ? (
            <div className="px-5 py-5 bg-[#f5f5f5]">
              <div className="max-w-[480px] mx-auto bg-white rounded-2xl border border-[#e5e5e5] px-8 py-8">
                <p className="text-[22px] font-black text-black leading-tight mb-3">{subject}</p>
                <p className="text-[14px] text-black/70 mb-4">Hola María,</p>
                <div
                  className="avisos-body avisos-preview"
                  dangerouslySetInnerHTML={{ __html: editor?.getHTML() || '' }}
                />
                {ctaLabel.trim() && ctaUrl.trim() && (
                  <div className="mt-6">
                    <span className="inline-block bg-[#4da3ff] text-[#0a1656] font-bold text-[14px] px-8 py-3.5 rounded-[10px]">
                      {ctaLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>

        {/* Botón del correo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-[13px] font-semibold text-[#0a1656] mb-1.5">
              Texto del botón <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Entrar a la formación"
              className="w-full bg-white rounded-lg px-4 py-2.5 text-[14px] border border-[#DDE6F5] outline-none focus:border-[#4da3ff]"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#0a1656] mb-1.5">
              Adónde lleva
            </label>
            <input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-white rounded-lg px-4 py-2.5 text-[14px] border border-[#DDE6F5] outline-none focus:border-[#4da3ff]"
            />
          </div>
        </div>

        {/* Destinatarios */}
        <div className="bg-white border border-[#DDE6F5] rounded-xl p-4 mb-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={testOnly}
              onChange={(e) => setTestOnly(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#025dc7] cursor-pointer"
            />
            <span>
              <span className="block text-[14px] font-semibold text-gray-900">
                Enviar solo a mí (prueba)
              </span>
              <span className="block text-[13px] text-gray-500 leading-relaxed">
                Te llega únicamente a tu correo. Quita la marca cuando lo tengas
                listo para mandarlo a todos los alumnos.
              </span>
            </span>
          </label>
        </div>

        <button
          onClick={send}
          disabled={sending}
          className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-lg font-bold text-[15px] transition-colors ${
            testOnly
              ? 'bg-[#4da3ff] text-[#0a1656] hover:bg-[#6cb5ff]'
              : 'bg-[#025dc7] text-white hover:bg-[#0b6df0]'
          } ${sending ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          {testOnly ? 'Enviarme la prueba' : 'Enviar a todos los alumnos'}
        </button>
      </div>

      <style jsx global>{`
        .avisos-body h2 { font-size: 17px; font-weight: 800; color: #1D0084; margin: 22px 0 8px; }
        .avisos-body h3 { font-size: 15px; font-weight: 700; color: #1D0084; margin: 18px 0 6px; }
        .avisos-body p { font-size: 14px; color: rgba(0,0,0,.78); line-height: 1.7; margin: 0 0 14px; }
        .avisos-body ul { list-style: disc; padding-left: 20px; margin: 0 0 14px; }
        .avisos-body ol { list-style: decimal; padding-left: 20px; margin: 0 0 14px; }
        .avisos-body li { font-size: 14px; color: rgba(0,0,0,.78); line-height: 1.7; margin-bottom: 6px; }
        .avisos-body strong { font-weight: 800; color: #0a1656; }
        .avisos-body a { color: #025dc7; text-decoration: underline; font-weight: 700; }
        .avisos-body img { max-width: 100%; height: auto; border-radius: 12px; margin: 4px 0 16px; }
        .avisos-body hr { margin: 22px 0; border: none; border-top: 1px solid #f0f0f0; }
        .avisos-body blockquote { border-left: 3px solid #4da3ff; padding-left: 14px; color: rgba(0,0,0,.7); margin: 0 0 16px; }
      `}</style>
    </div>
  )
}

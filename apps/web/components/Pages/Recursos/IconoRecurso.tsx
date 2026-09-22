'use client'
import React from 'react'
import { FileText, Image as ImageIcon, Link2, Music, Paperclip, Play, HardDrive } from 'lucide-react'
import { tipoDe, type RecursoItem } from '@services/recursos/recursos'

/** El icono de cada recurso, por lo que es. Azul de marca; nada de naranja. */
export default function IconoRecurso({ item, size = 18 }: { item: RecursoItem; size?: number }) {
  const t = tipoDe(item)
  const cls = 'text-[#025dc7]'
  if (t === 'drive') return <HardDrive size={size} className={cls} />
  if (t === 'youtube') return <Play size={size} className={cls} />
  if (t === 'pdf') return <FileText size={size} className={cls} />
  if (t === 'imagen') return <ImageIcon size={size} className={cls} />
  if (t === 'audio') return <Music size={size} className={cls} />
  if (t === 'enlace') return <Link2 size={size} className={cls} />
  return <Paperclip size={size} className={cls} />
}

'use client'

/**
 * El icono de cada canal (10/11/2026). Usuario: "quitar emojis Apple o
 * dejarlos, pero ahora está como mix; yo dejaría solo los nuestros". El emoji
 * que lleve el nombre del canal ya no se pinta en ningún sitio: sale un icono
 * de la escuela según de qué va el canal. Lo usan la barra, la lista de
 * canales, las tarjetas del Inicio y la cabecera de cada canal.
 */

import React from 'react'
import {
  BookOpen,
  ChatsCircle,
  FolderSimple,
  Hash,
  Megaphone,
  Microphone,
  Question,
  Star,
  UserCircle,
} from '@phosphor-icons/react'

export function IconoCanal({ nombre, size = 20, className }: { nombre: string; size?: number; className?: string }) {
  const n = (nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const p = { size, weight: 'fill' as const, className }
  if (/presenta/.test(n)) return <UserCircle {...p} />
  if (/victori|logro/.test(n)) return <Star {...p} />
  if (/noticia|anuncio|novedad/.test(n)) return <Megaphone {...p} />
  if (/esencial|norma|bienvenid|empieza/.test(n)) return <BookOpen {...p} />
  if (/spreek|spreken|convers|habla|pronunci/.test(n)) return <Microphone {...p} />
  if (/pregunt|duda|consult/.test(n)) return <Question {...p} />
  if (/recurs|material/.test(n)) return <FolderSimple {...p} />
  if (/general|charla|chat|comunidad/.test(n)) return <ChatsCircle {...p} />
  return <Hash size={size - 2} weight="bold" className={className} />
}

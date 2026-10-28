'use client'
import React, { useEffect, useState } from 'react'
import AvisosComposer from './AvisosComposer'
import EmailCatalog from './EmailCatalog'
import SeedCommunity from './SeedCommunity'
import RecordatorioAuto from './RecordatorioAuto'
import CorreoReserva from './CorreoReserva'
import EbookBlackFriday from './EbookBlackFriday'
import { Mail, PenLine, Inbox, Sparkles, BellRing, CalendarCheck, BookOpen } from 'lucide-react'

/**
 * La pantalla de Avisos tiene tres caras:
 *  - Escribir un aviso: el correo que redacta el equipo y sale cuando se pulsa.
 *  - Correos automáticos: los que la escuela manda sola, para verlos por dentro.
 *  - 1 semana sin entrar: el recordatorio que sale solo (con su interruptor,
 *    apagado de serie) y su texto, que se edita aquí.
 *  - Al reservar: el correo de Rida a quien reserva su llamada en Calendly.
 *  - Ebook Black Friday: el ebook a 1 €, su PDF y su campaña de correos.
 *  - Arranque: sembrar la comunidad antes de que entren los primeros alumnos.
 */
export default function AvisosTabs() {
  const [tab, setTab] = useState<'escribir' | 'automaticos' | 'semana' | 'reserva' | 'ebook' | 'arranque'>('escribir')
  // Se puede entrar directo a una pestaña con ?tab= (tras pintar, para que el
  // servidor y el navegador empiecen igual).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'ebook' || t === 'reserva' || t === 'semana' || t === 'automaticos') setTab(t)
  }, [])

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] font-semibold transition-colors ${
      active
        ? 'bg-white text-[#0a1656] shadow-sm border border-[#DDE6F5]'
        : 'text-gray-500 hover:text-[#025dc7] border border-transparent'
    }`

  return (
    <div className="h-full w-full bg-[#f8f8f8] px-4 sm:px-9 py-9">
      <div className="flex items-center gap-2.5 mb-1.5">
        <Mail size={20} className="text-[#025dc7]" />
        <h1 className="text-xl font-bold text-gray-900">Avisos</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5 leading-relaxed max-w-3xl">
        Todo lo que la escuela le manda por correo a los alumnos, en un sitio.
      </p>

      <div className="inline-flex flex-wrap items-center gap-1 bg-[#EFF1F6] rounded-xl p-1 mb-7 max-w-full">
        <button className={tabClass(tab === 'escribir')} onClick={() => setTab('escribir')}>
          <PenLine size={16} />
          Escribir un aviso
        </button>
        <button className={tabClass(tab === 'automaticos')} onClick={() => setTab('automaticos')}>
          <Inbox size={16} />
          Correos automáticos
        </button>
        <button className={tabClass(tab === 'semana')} onClick={() => setTab('semana')}>
          <BellRing size={16} />
          1 semana sin entrar
        </button>
        <button className={tabClass(tab === 'reserva')} onClick={() => setTab('reserva')}>
          <CalendarCheck size={16} />
          Al reservar
        </button>
        <button className={tabClass(tab === 'ebook')} onClick={() => setTab('ebook')}>
          <BookOpen size={16} />
          Ebook Black Friday
        </button>
        <button className={tabClass(tab === 'arranque')} onClick={() => setTab('arranque')}>
          <Sparkles size={16} />
          Arranque
        </button>
      </div>

      {tab === 'escribir' ? (
        <AvisosComposer />
      ) : tab === 'automaticos' ? (
        <EmailCatalog />
      ) : tab === 'semana' ? (
        <RecordatorioAuto />
      ) : tab === 'reserva' ? (
        <CorreoReserva />
      ) : tab === 'ebook' ? (
        <EbookBlackFriday />
      ) : (
        <SeedCommunity />
      )}
    </div>
  )
}

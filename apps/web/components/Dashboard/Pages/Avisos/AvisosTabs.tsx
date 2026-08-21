'use client'
import React, { useState } from 'react'
import AvisosComposer from './AvisosComposer'
import EmailCatalog from './EmailCatalog'
import SeedCommunity from './SeedCommunity'
import { Mail, PenLine, Inbox, Sparkles } from 'lucide-react'

/**
 * La pantalla de Avisos tiene tres caras:
 *  - Escribir un aviso: el correo que redacta el equipo y sale cuando se pulsa.
 *  - Correos automáticos: los que la escuela manda sola, para verlos por dentro.
 *  - Arranque: sembrar la comunidad antes de que entren los primeros alumnos.
 */
export default function AvisosTabs() {
  const [tab, setTab] = useState<'escribir' | 'automaticos' | 'arranque'>('escribir')

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

      <div className="inline-flex items-center gap-1 bg-[#EFF1F6] rounded-xl p-1 mb-7">
        <button className={tabClass(tab === 'escribir')} onClick={() => setTab('escribir')}>
          <PenLine size={16} />
          Escribir un aviso
        </button>
        <button className={tabClass(tab === 'automaticos')} onClick={() => setTab('automaticos')}>
          <Inbox size={16} />
          Correos automáticos
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
      ) : (
        <SeedCommunity />
      )}
    </div>
  )
}

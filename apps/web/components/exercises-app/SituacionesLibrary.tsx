'use client'
import Link from 'next/link'
import { ArrowLeft, Clapperboard } from 'lucide-react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getUriWithOrg } from '@services/config/config'
import { getSituaciones } from '@/lib/exercises-app/situaciones'
import SituacionCard from './SituacionCard'

// Library of "situaciones reales": real-life video clips (news, interviews,
// everyday situations) with dynamic listening-comprehension exercises.
export default function SituacionesLibrary({ orgslug }: { orgslug: string }) {
  const situaciones = getSituaciones()

  return (
    <GeneralWrapperStyled>
      <Link
        href={getUriWithOrg(orgslug, '/ejercicios')}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#025dc7] hover:text-[#1D0084] transition-colors"
      >
        <ArrowLeft size={15} strokeWidth={2.5} />
        Centro de ejercicios
      </Link>

      <div className="flex items-center gap-2 pt-3">
        <Clapperboard size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Echt Nederlands</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-xl">
        Holandés de verdad: vídeos reales —noticias, entrevistas y situaciones del día a día— con
        ejercicios para entrenar el oído y sentirte cómodo escuchando.
      </p>

      {situaciones.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#DDE6F5] bg-[#F0F5FF] py-16 text-center text-sm text-gray-500">
          Pronto añadiremos vídeos aquí.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {situaciones.map((s) => (
            <SituacionCard key={s.id} situacion={s} orgslug={orgslug} />
          ))}
        </div>
      )}
    </GeneralWrapperStyled>
  )
}

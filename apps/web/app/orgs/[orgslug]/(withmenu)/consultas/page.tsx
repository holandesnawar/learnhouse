import ConsultasBoard from '@components/Pages/Consultas/ConsultasBoard'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { MessageCircleQuestion } from 'lucide-react'

// Native Consultas — the Q&A board, rebuilt inside LearnHouse. It reads and
// writes the same Supabase `consultas` data the old external app used, so it
// works end-to-end (no iframe, which was blocked by 403 / CSP).
export default function ConsultasPage() {
  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pt-2">
        <MessageCircleQuestion size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Consultas</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-xl">
        Resuelve tus dudas sobre el idioma o la formación. Publica tu consulta y
        te avisaremos por email cuando la respondamos.
      </p>

      <ConsultasBoard />
    </GeneralWrapperStyled>
  )
}

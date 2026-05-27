import ConsultasFaq from '@components/Pages/Consultas/ConsultasFaq'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { HelpCircle } from 'lucide-react'

// Native Consultas page: an admin-editable FAQ. The old external embed
// (https://consultas-tau.vercel.app) was removed — it was blocked from framing
// (403 / CSP) and showed as a boxed iframe with a nested scroll. This is now a
// regular native page with the same margins as the rest of the app.
export default function ConsultasPage() {
  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pt-2">
        <HelpCircle size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Consultas</h1>
      </div>
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-lg">
        Resuelve tus dudas más habituales. Si no encuentras tu respuesta, escríbenos
        en la comunidad y te ayudamos.
      </p>

      <ConsultasFaq />
    </GeneralWrapperStyled>
  )
}

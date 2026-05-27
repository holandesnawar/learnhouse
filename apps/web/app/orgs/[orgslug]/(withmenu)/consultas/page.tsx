import ConsultasFaq from '@components/Pages/Consultas/ConsultasFaq'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { HelpCircle } from 'lucide-react'

// Native FAQ (admin-editable) on top, with the external Consultas app
// (https://consultas-tau.vercel.app) embedded below. If the iframe shows blank,
// the Consultas app must allow framing via
// `Content-Security-Policy: frame-ancestors https://academia.holandesnawar.nl`.
export default function ConsultasPage() {
  return (
    <GeneralWrapperStyled>
      <div className="flex items-center gap-2 pt-2 pb-4">
        <HelpCircle size={24} className="text-[#025dc7]" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Consultas</h1>
      </div>

      <div className="space-y-5 pb-6">
        <ConsultasFaq />

        <div className="rounded-2xl overflow-hidden border border-[#DDE6F5] bg-white nice-shadow">
          <iframe
            src="https://consultas-tau.vercel.app/"
            title="Consultas"
            className="w-full h-[80vh] border-0"
            allow="clipboard-write; fullscreen; camera; microphone"
          />
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}

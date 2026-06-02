import ConsultasBoard from '@components/Pages/Consultas/ConsultasBoard'
import ConsultasFaq from '@components/Pages/Consultas/ConsultasFaq'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { MessageCircleQuestion } from 'lucide-react'

// Native Consultas — the Q&A board, rebuilt inside LearnHouse. It reads and
// writes the same Supabase `consultas` data the old external app used, so it
// works end-to-end (no iframe, which was blocked by 403 / CSP).
//
// Query params honoured (deep-link from the lesson search bar):
//   ?q=...    → pre-fills the search box and filters the feed
//   ?id=...   → opens the detail modal for that consulta on mount
//   ?new=1    → opens the "Nueva consulta" modal on mount (and uses
//                ?q= as the pre-filled title if also present)
export default async function ConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; id?: string; new?: string }>
}) {
  const params = await searchParams
  const initialQuery = (params.q || '').trim()
  const initialOpenId = (params.id || '').trim()
  const startNew = params.new === '1'

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

      {/* Two-column on desktop, stacked on mobile. The board is the main
          content; "Consultas frecuentes" sits on the right rail as a quick
          reference (admin-editable from the same component).

          DOM order intentionally puts the FAQ first so on mobile (the grid
          collapses to one column) it appears BEFORE the long feed instead
          of buried at the bottom. On desktop we re-route them with
          col-start so the FAQ ends up in the right column despite being
          first in source. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6 self-start">
          <ConsultasFaq />
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ConsultasBoard
            initialQuery={initialQuery}
            initialOpenId={initialOpenId}
            startNew={startNew}
          />
        </div>
      </div>
    </GeneralWrapperStyled>
  )
}

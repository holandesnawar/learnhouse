// Admin dashboard section that embeds the external Consultas admin panel
// (https://consultas-tau.vercel.app/admin.html). Includes an "open in new tab"
// fallback because the panel uses Supabase auth, whose session can be blocked
// inside cross-origin iframes by some browsers.
const CONSULTAS_ADMIN_URL = 'https://consultas-tau.vercel.app/admin.html'

export default function ConsultasDashPage() {
  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-gray-200 shrink-0">
        <div>
          <h1 className="font-bold text-gray-900 leading-tight">Consultas</h1>
          <p className="text-xs text-gray-500 leading-tight">Panel de gestión de consultas</p>
        </div>
        <a
          href={CONSULTAS_ADMIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-[#025dc7] hover:bg-[#0b6df0] px-3 py-2 rounded-lg transition-colors shrink-0"
        >
          Abrir en pestaña nueva ↗
        </a>
      </div>
      <iframe
        src={CONSULTAS_ADMIN_URL}
        title="Panel de Consultas"
        className="w-full flex-1 border-0"
        allow="clipboard-write; fullscreen"
      />
    </div>
  )
}

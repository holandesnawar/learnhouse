import ConsultasFaq from '@components/Pages/Consultas/ConsultasFaq'

// Frequently-asked questions (native, editable by admins) on top, with the
// external Consultas app (https://consultas-tau.vercel.app) embedded below.
// If the iframe shows blank, the Consultas app must allow framing via
// `Content-Security-Policy: frame-ancestors https://academia.holandesnawar.nl`.
export default function ConsultasPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
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
  )
}

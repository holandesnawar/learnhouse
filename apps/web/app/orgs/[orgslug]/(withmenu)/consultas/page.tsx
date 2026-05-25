// Embeds the external Consultas app (https://consultas-tau.vercel.app) inside
// LearnHouse, wrapped by the org sidebar so it feels like a native section.
// If the iframe shows blank, the Consultas app must allow framing via
// `Content-Security-Policy: frame-ancestors https://academia.holandesnawar.nl`.
export default function ConsultasPage() {
  return (
    <div className="w-full h-[calc(100dvh-3.5rem)] md:h-screen bg-white">
      <iframe
        src="https://consultas-tau.vercel.app/"
        title="Consultas"
        className="w-full h-full border-0"
        allow="clipboard-write; fullscreen; camera; microphone"
      />
    </div>
  )
}

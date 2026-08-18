import Link from 'next/link'
import { ArrowRight, HelpCircle } from 'lucide-react'

// En single-tenancy el middleware reescribe las rutas raíz a la org, así que
// `/consultas` (raíz) es la URL que funciona — la misma que ve el alumno.
// La variante /orgs/{slug}/consultas a veces 404aba (el botón "no hacía nada").
export default function NotFound() {
  const consultasHref = '/consultas'

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-16 text-white"
      style={{
        backgroundColor: '#1D0084',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
          'radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
          'radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
        backgroundSize: '28px 28px, auto, auto',
        backgroundRepeat: 'repeat, no-repeat, no-repeat',
      }}
    >
      <div className="relative z-0 w-full max-w-xl text-center">
        <p
          aria-hidden
          className="font-bold leading-none text-white/10 select-none"
          style={{
            fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")',
            fontSize: 'clamp(120px, 22vw, 220px)',
          }}
        >
          404
        </p>

        <h1
          className="-mt-4 sm:-mt-8 text-3xl sm:text-4xl font-bold leading-tight"
          style={{ fontFamily: 'var(--font-poppins), system-ui, sans-serif, "Apple Color Emoji", var(--font-emoji, "Segoe UI Emoji")' }}
        >
          Esta página <span className="text-[#4da3ff]">no existe.</span>
        </h1>

        <p className="mt-4 text-white/70 text-base sm:text-lg leading-relaxed max-w-md mx-auto">
          Puede que hayas escrito mal la URL o que el contenido se haya movido.
          Vuelve al inicio y sigue explorando.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#4da3ff] hover:bg-[#6cb5ff] text-[#1D0084] font-bold transition-colors w-full sm:w-auto"
          >
            Volver al inicio
            <ArrowRight size={18} />
          </Link>
          <Link
            href={consultasHref}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold transition-colors w-full sm:w-auto"
          >
            <HelpCircle size={18} />
            Abrir consulta
          </Link>
        </div>
      </div>
    </div>
  )
}

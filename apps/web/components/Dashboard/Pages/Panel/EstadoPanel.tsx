'use client'

/**
 * Estado de la escuela (10/11/2026): enterarse de los fallos antes que los
 * alumnos, y ver qué va lento. Pedido del usuario: "menos caídas, mejor
 * software… más rápido, más seguro y estable".
 *
 * La escuela apunta sola lo que falla (peticiones que acaban en error,
 * pantallas que se rompen en el navegador de alguien), lo que tarda y cada
 * reinicio. Aquí se lee en cristiano; el detalle técnico va plegado, con
 * «Copiar», para pasárselo a quien lo vaya a arreglar.
 *
 * Solo administradores. Todo sale de `GET /estado/org/{id}`
 * (apps/api/src/services/estado/estado.py).
 */

import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Activity, Copy, Gauge, KeyRound, Loader2, MonitorX, RefreshCcw, RotateCw, ServerCrash } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { haceCuanto } from '@/lib/nawar/haceCuanto'
import { aQuien, accionConVerbo, haceTanto, paginaDe, tiempo, veces } from '@/lib/nawar/estadoEnCristiano'
import { getEstado, type ErrorApi, type EstadoDatos, type Lenta, type PantallaRota, type RutaTiempos } from '@services/estado/estado'
import { BOTON, Estado, META, Plegable, TARJETA, filtro } from './ui'

const COLOR = { verde: '#16A34A', ambar: '#D97706', rojo: '#DC2626' } as const
const POPPINS = { fontFamily: 'var(--font-poppins), system-ui, sans-serif' }

async function copiar(texto: string, que = 'Copiado') {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(que)
  } catch {
    toast.error('No se pudo copiar')
  }
}

function navegadores(lista: { nombre: string; veces: number }[]) {
  return lista.map((n) => `${n.nombre} (${n.veces})`).join(', ')
}

function textoError(e: ErrorApi) {
  return [
    `[error de la API] ${e.metodo} ${e.ruta} → ${e.status}`,
    e.mensaje,
    `${veces(e.veces)} en 7 días (${e.hoy} hoy) · ${e.personas} personas con sesión · última: ${e.ultima}Z`,
    e.pagina ? `Desde la pantalla: ${e.pagina}` : '',
    e.navegadores.length ? `Navegadores: ${navegadores(e.navegadores)}` : '',
    e.versiones.length ? `Versión desplegada: ${e.versiones.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function textoPantalla(p: PantallaRota) {
  return [
    `[pantalla rota en el navegador] ${p.pagina}`,
    p.mensaje,
    `${veces(p.veces)} en 7 días (${p.hoy} hoy) · ${p.personas} personas con sesión · última: ${p.ultima}Z`,
    `Con la página traducida: ${p.traducida} · como app instalada: ${p.app} · solo un trozo de la pantalla: ${p.trozo}`,
    p.navegadores.length ? `Navegadores: ${navegadores(p.navegadores)}` : '',
    p.versiones.length ? `Versión desplegada: ${p.versiones.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function textoLenta(l: Lenta) {
  return `[lenta] ${l.metodo} ${l.ruta} · ${veces(l.veces)} por encima del umbral (${l.hoy} hoy) · la peor: ${tiempo(l.peor_ms)} · última: ${l.ultima}Z`
}

function textoRuta(r: RutaTiempos) {
  return `[tiempos] ${r.metodo} ${r.ruta} · ${r.peticiones} peticiones · mediana ${tiempo(r.mediana_ms)} · p95 ${tiempo(r.p95_ms)} · la peor ${tiempo(r.peor_ms)}`
}

function textoTodo(d: EstadoDatos) {
  const v = d.vivo
  return [
    `ESTADO DE LA ESCUELA · ${new Date().toISOString()}`,
    d.semaforo.frase,
    `Versión: ${v.version || '(sin dato)'} · arrancada hace ${haceTanto(v.arrancado_hace_s)} · reinicios hoy: ${d.resumen.hoy.arranques}`,
    ...v.comprobaciones.map((c) => `- ${c.nombre}: ${c.ok ? 'bien' : 'FALLA'} (${c.ms} ms) ${c.detalle}`),
    '',
    '— Errores —',
    ...d.resumen.errores.map(textoError),
    '',
    '— Pantallas rotas —',
    ...d.resumen.pantallas.map(textoPantalla),
    '',
    '— Peticiones lentas —',
    ...d.resumen.lentas.map(textoLenta),
    '',
    '— Tiempos por ruta (las más lentas) —',
    ...d.resumen.rutas.slice(0, 15).map(textoRuta),
  ].join('\n')
}

/** El detalle técnico, plegado, con «Copiar». */
function Detalle({ texto }: { texto: string }) {
  return (
    <details className="mt-2 group">
      <summary className="cursor-pointer select-none text-[12.5px] font-medium text-[#025dc7] hover:underline list-none">Detalle técnico</summary>
      <div className="mt-2 rounded-lg border border-[#E2E8F4] bg-[#F8FAFE] p-3">
        <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[#374151] font-mono">{texto}</pre>
        <button onClick={() => copiar(texto, 'Copiado: pégaselo a quien lo vaya a arreglar')} className={`${BOTON} mt-2`}>
          <Copy size={13} /> Copiar
        </button>
      </div>
    </details>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[13px] text-[#6B7280]">{children}</p>
}

function Fila({ titulo, linea, hoy, children }: { titulo: string; linea: React.ReactNode; hoy: number; children?: React.ReactNode }) {
  return (
    <li className="py-3 border-b border-[#EEF2F9] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#111827] break-words">{titulo}</p>
          <p className={`${META} mt-0.5`}>{linea}</p>
        </div>
        {hoy > 0 ? <Estado tono="rojo" className="shrink-0 mt-0.5">{hoy} hoy</Estado> : <Estado tono="gris" className="shrink-0 mt-0.5">hoy no</Estado>}
      </div>
      {children}
    </li>
  )
}

export default function EstadoPanel() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const token: string = session?.data?.tokens?.access_token || ''
  const [datos, setDatos] = useState<EstadoDatos | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [soloHoy, setSoloHoy] = useState(false)

  const cargar = useCallback(async () => {
    if (!org?.id || !token) return
    setCargando(true)
    try {
      setDatos(await getEstado(org.id, token))
      setError('')
    } catch (e: any) {
      setError(e?.message || 'No se pudo leer el estado de la escuela')
    } finally {
      setCargando(false)
    }
  }, [org?.id, token])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (error && !datos) {
    return (
      <div className={`${TARJETA} p-5`}>
        <p className="text-[14px] text-red-600">{error}</p>
        <button onClick={cargar} className={`${BOTON} mt-3`}>
          <RefreshCcw size={13} /> Reintentar
        </button>
      </div>
    )
  }
  if (!datos) {
    return (
      <div className="flex items-center gap-2 py-10 text-[13px] text-[#6B7280]">
        <Loader2 size={16} className="animate-spin" /> Comprobando la escuela…
      </div>
    )
  }

  const { vivo, resumen, semaforo } = datos
  const errores = soloHoy ? resumen.errores.filter((e) => e.hoy > 0) : resumen.errores
  const pantallas = soloHoy ? resumen.pantallas.filter((p) => p.hoy > 0) : resumen.pantallas
  const clavesQueFaltan = vivo.claves.filter((c) => !c.puesta)

  return (
    <div className="space-y-4">
      {/* El semáforo: una frase. */}
      <div className={`${TARJETA} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLOR[semaforo.color] }} />
            <p className="text-[17px] sm:text-[19px] font-bold text-[#0a1656] leading-snug" style={POPPINS}>
              {semaforo.frase}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => copiar(textoTodo(datos), 'Copiado todo el estado')} className={BOTON}>
              <Copy size={13} /> Copiar todo
            </button>
            <button onClick={cargar} disabled={cargando} className={BOTON}>
              {cargando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Actualizar
            </button>
          </div>
        </div>
        <p className={`${META} mt-2`}>
          En los últimos 7 días: {resumen.semana.errores} errores, {resumen.semana.pantallas} pantallas rotas y {resumen.semana.lentas} peticiones lentas (más de{' '}
          {tiempo(vivo.umbral_lenta_ms)}).
        </p>
        {!vivo.apuntando ? (
          <p className="mt-2 text-[13px] text-[#8A6A2A]">La escuela no está apuntando nada ahora mismo (está apagado con LEARNHOUSE_ESTADO=off).</p>
        ) : null}
        {datos.aviso ? <p className="mt-2 text-[13px] text-[#8A6A2A]">{datos.aviso}</p> : null}
        {vivo.sin_guardar.tiradas_por_tope > 0 ? (
          <p className="mt-2 text-[13px] text-[#8A6A2A]">
            Hubo tantos fallos seguidos que {vivo.sin_guardar.tiradas_por_tope} no se guardaron (hay un tope por minuto para no llenar la base de datos).
          </p>
        ) : null}
      </div>

      {/* Ahora mismo. */}
      <div className={`${TARJETA} p-4 sm:p-5`}>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-[#025dc7]" />
          <h2 className="text-[15px] font-bold text-[#0a1656]" style={POPPINS}>
            Ahora mismo
          </h2>
        </div>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {vivo.comprobaciones.map((c) => (
            <li key={c.nombre} className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <Estado tono={c.ok ? 'verde' : 'rojo'} className="!text-[13.5px] !text-[#111827] font-medium">
                {c.nombre}
              </Estado>
              <span className={`${META} text-right`}>
                {c.ok ? 'responde' : 'NO responde'}
                {c.ms ? ` · ${c.ms} ms` : ''}
                {c.detalle ? ` · ${c.detalle}` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className={`${META} mt-3`}>
          La escuela lleva arrancada {haceTanto(vivo.arrancado_hace_s)}
          {vivo.version ? ` · versión ${vivo.version}` : ''}
          {resumen.hoy.arranques > 1 ? ` · hoy ha arrancado ${resumen.hoy.arranques} veces` : ''}
        </p>
        {clavesQueFaltan.length ? (
          <p className="mt-2 text-[13px] text-[#8A6A2A]">
            <KeyRound size={13} className="inline -mt-0.5 mr-1" />
            Sin clave puesta en Railway: {clavesQueFaltan.map((c) => c.nombre).join(', ')}. Lo que dependa de ellas no funcionará.
          </p>
        ) : (
          <p className={`${META} mt-2`}>
            <KeyRound size={13} className="inline -mt-0.5 mr-1" />
            Todas las claves están puestas ({vivo.claves.length}). Aquí solo se mira si están, nunca su valor.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setSoloHoy(false)} className={filtro(!soloHoy)}>
          Últimos 7 días
        </button>
        <button onClick={() => setSoloHoy(true)} className={filtro(soloHoy)}>
          Solo hoy
        </button>
      </div>

      <Plegable
        titulo="Lo que ha fallado"
        icono={<ServerCrash size={16} />}
        cifra={errores.length || undefined}
        resumen={errores.length ? `${accionConVerbo(errores[0].metodo, errores[0].ruta)} · ${veces(errores[0].veces)}` : 'Nada'}
        recordarComo="estado-errores"
        abiertoDeSerie
        color="#DC2626"
        aviso={resumen.hoy.errores > 0}
      >
        {errores.length ? (
          <ul>
            {errores.map((e, i) => (
              <Fila
                key={i}
                titulo={accionConVerbo(e.metodo, e.ruta)}
                hoy={e.hoy}
                linea={
                  <>
                    Ha fallado {veces(e.veces)}
                    {aQuien(e.personas, e.anonimas) ? `, ${aQuien(e.personas, e.anonimas)}` : ''} · la última, {haceCuanto(e.ultima)}
                    {e.pagina ? ` · desde «${paginaDe(e.pagina)}»` : ''}
                  </>
                }
              >
                <Detalle texto={textoError(e)} />
              </Fila>
            ))}
          </ul>
        ) : (
          <Vacio>Ninguna petición ha acabado en error{soloHoy ? ' hoy' : ' en los últimos 7 días'}.</Vacio>
        )}
      </Plegable>

      <Plegable
        titulo="Pantallas rotas en el navegador"
        icono={<MonitorX size={16} />}
        cifra={pantallas.length || undefined}
        resumen={pantallas.length ? `${paginaDe(pantallas[0].pagina)} · ${veces(pantallas[0].veces)}` : 'Ninguna'}
        recordarComo="estado-pantallas"
        abiertoDeSerie
        color="#B45309"
        aviso={resumen.hoy.pantallas > 0}
      >
        {pantallas.length ? (
          <ul>
            {pantallas.map((p, i) => (
              <Fila
                key={i}
                titulo={paginaDe(p.pagina)}
                hoy={p.hoy}
                linea={
                  <>
                    Se ha roto {veces(p.veces)}
                    {aQuien(p.personas, p.anonimas) ? `, ${aQuien(p.personas, p.anonimas)}` : ''} · la última, {haceCuanto(p.ultima)}
                    {p.navegadores.length ? ` · ${p.navegadores[0].nombre}` : ''}
                  </>
                }
              >
                {p.traducida > 0 ? (
                  <p className="mt-1.5 text-[13px] text-[#8A6A2A]">
                    {p.traducida === p.veces ? 'Siempre' : `${p.traducida} de ${p.veces} veces`} con la página pasada por un traductor: lo más probable es que sea eso
                    (el traductor del navegador rompe la escuela). Que esa persona lo desactive.
                  </p>
                ) : null}
                {p.trozo > 0 && p.trozo === p.veces ? <p className={`${META} mt-1.5`}>Solo se rompió un trozo de la pantalla; el resto siguió funcionando.</p> : null}
                <Detalle texto={textoPantalla(p)} />
              </Fila>
            ))}
          </ul>
        ) : (
          <Vacio>Ningún navegador ha avisado de una pantalla rota{soloHoy ? ' hoy' : ' en los últimos 7 días'}.</Vacio>
        )}
      </Plegable>

      <Plegable
        titulo="Lo que va lento"
        icono={<Gauge size={16} />}
        cifra={resumen.lentas.length || undefined}
        resumen={resumen.rutas.length ? `Lo más lento: ${accionConVerbo(resumen.rutas[0].metodo, resumen.rutas[0].ruta)} (${tiempo(resumen.rutas[0].p95_ms)})` : 'Aún sin datos'}
        recordarComo="estado-lento"
        color="#025dc7"
      >
        <p className={`${META} mt-2 !whitespace-normal`}>
          «Normal» es lo que tarda la mitad de las veces; «en un mal momento», lo que tarda 1 de cada 20. Por debajo de medio segundo no se nota.
        </p>
        {resumen.rutas.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-[0.06em] text-[#6B7280]">
                  <th className="py-2 pr-3 font-semibold">Qué</th>
                  <th className="py-2 px-2 font-semibold text-right">Normal</th>
                  <th className="py-2 px-2 font-semibold text-right">En un mal momento</th>
                  <th className="py-2 px-2 font-semibold text-right">La peor</th>
                  <th className="py-2 pl-2 font-semibold text-right">Veces</th>
                </tr>
              </thead>
              <tbody>
                {resumen.rutas.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t border-[#EEF2F9]">
                    <td className="py-2 pr-3 min-w-[220px]">
                      <span className="font-medium text-[#111827]">{accionConVerbo(r.metodo, r.ruta)}</span>
                      <span className="block text-[11.5px] text-[#9CA3AF] font-mono break-all">
                        {r.metodo} {r.ruta.replace(/^\/api\/v1/, '')}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{tiempo(r.mediana_ms)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums font-semibold ${r.p95_ms >= vivo.umbral_lenta_ms ? 'text-red-600' : r.p95_ms >= 800 ? 'text-[#B45309]' : 'text-[#111827]'}`}>
                      {tiempo(r.p95_ms)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-[#6B7280]">{tiempo(r.peor_ms)}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-[#6B7280]">{r.peticiones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>Todavía no hay tiempos apuntados: salen a los cinco minutos de haber movimiento en la escuela.</Vacio>
        )}
        {resumen.lentas.length ? (
          <>
            <p className="mt-4 text-[13px] font-semibold text-[#0a1656]">Peticiones que pasaron de {tiempo(vivo.umbral_lenta_ms)}</p>
            <ul>
              {resumen.lentas.map((l, i) => (
                <Fila
                  key={i}
                  titulo={accionConVerbo(l.metodo, l.ruta)}
                  hoy={l.hoy}
                  linea={
                    <>
                      {veces(l.veces)} · la peor, {tiempo(l.peor_ms)} · la última, {haceCuanto(l.ultima)}
                    </>
                  }
                />
              ))}
            </ul>
          </>
        ) : null}
        {resumen.rutas.length || resumen.lentas.length ? (
          <button
            onClick={() => copiar([...resumen.rutas.slice(0, 20).map(textoRuta), ...resumen.lentas.map(textoLenta)].join('\n'), 'Copiado')}
            className={`${BOTON} mt-3`}
          >
            <Copy size={13} /> Copiar los tiempos
          </button>
        ) : null}
      </Plegable>

      <Plegable
        titulo="Reinicios"
        icono={<RotateCw size={16} />}
        cifra={resumen.arranques.length || undefined}
        resumen={resumen.arranques.length ? `El último, ${haceCuanto(resumen.arranques[0].cuando)}` : 'Ninguno apuntado'}
        recordarComo="estado-reinicios"
        color="#6B7280"
      >
        <p className={`${META} mt-2 !whitespace-normal`}>
          Cada vez que la escuela arranca: al publicar un cambio (normal) o porque se cayó y se levantó sola. Varios seguidos sin haber publicado nada es mala señal.
        </p>
        {resumen.arranques.length ? (
          <ul className="mt-2 space-y-1">
            {resumen.arranques.map((a, i) => (
              <li key={i} className="text-[13px] text-[#374151]">
                {new Date(`${a.cuando}Z`).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}
                {a.version ? <span className="text-[#9CA3AF]"> · versión {a.version}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Vacio>Aún no hay ninguno apuntado.</Vacio>
        )}
      </Plegable>

      <p className={`${META} !whitespace-normal`}>
        Además, un vigilante de fuera (GitHub, cada 10 minutos) comprueba que la escuela responde y manda un correo si se cae. Aquí no se guardan correos ni nombres: solo qué
        falló, cuántas veces y a cuántas personas. Lo de más de 30 días se borra solo.
      </p>
    </div>
  )
}

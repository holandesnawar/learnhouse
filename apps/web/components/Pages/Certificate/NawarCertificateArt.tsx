'use client'
import React, { useEffect, useRef, useState } from 'react'

/**
 * Certificado Holandés Nawar.
 *
 * El diseño (olas azules, logo, marca de agua, firmas y todo el texto en
 * neerlandés) vive en una imagen de fondo — `public/Certificado-fondo.png`, un
 * PNG de 4000×2828 hecho en Canva. Aquí encima solo se ponen las dos cosas que
 * cambian en cada alumno: **su nombre** y **la fecha** en que terminó.
 *
 * Por qué la imagen está en `public/` de la propia web y no en el CDN: el PDF
 * se genera en el navegador del alumno capturando este nodo, y el navegador se
 * niega a incluir imágenes de otro dominio en esa captura. Servida desde el
 * mismo sitio que la escuela, no hay nada que negociar. Además queda versionada
 * en git y entra en las copias de seguridad.
 */

// Proporción exacta del PNG (4000×2828 = A4 apaisado). El lienzo se declara a
// la mitad para que las medidas del encargo —nombre 105px, fecha 28px— sean
// literales, y el PDF se captura al doble, que devuelve los 4000px originales.
export const CERT_W = 2000
export const CERT_H = 1414

const FONDO_URL = '/Certificado-fondo.png'

/** Colores del degradado del nombre. */
const TINTA_CENTRO = '#120081'
const TINTA_BORDE = '#025dc7'

// Coordenadas medidas sobre el propio PNG, no a ojo:
//   subtítulo "Dit certificaat verklaart dat:"  acaba en y=410
//   línea divisoria con destellos               de y=687 a y=734
//   párrafo "De cursus…"                        de y=800 a y=892
//   firmas                                      a partir de y=958
const NOMBRE_TAM = 105          // Poppins bold
const NOMBRE_BASE_Y = 638       // dónde apoya el nombre, justo encima de la línea
const NOMBRE_ANCHO_MAX = 1500   // más allá se encoge, para que nunca toque los bordes
const FECHA_TAM = 28            // Inter bold
const FECHA_TOP_Y = 902         // debajo de "heeft afgerond op"

export interface NawarCertificateArtProps {
  studentName?: string
  /** Nombre de la formación (config.certification_name). */
  certificationName: string
  certificationDescription?: string
  certificateInstructor?: string
  certificateId?: string
  awardedDate?: string
  qrCodeLink?: string
  logoUrl?: string
  /** Ref al lienzo fijo — es lo que captura el PDF. */
  innerRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * Pinta el nombre en un `<canvas>`.
 *
 * Podría ser un `<div>` con `background-clip:text`, que es como se hace
 * normalmente un texto con degradado — pero html2canvas, que es quien genera
 * el PDF, no sabe recortar un fondo contra las letras: saldría un rectángulo
 * de color macizo tapando el nombre. Y en SVG el problema es otro: al
 * serializarlo se pierde la tipografía de la página y el nombre saldría en una
 * letra cualquiera.
 *
 * Un canvas no tiene ninguno de los dos problemas: html2canvas copia su mapa
 * de bits tal cual, así que lo que se ve en pantalla es exactamente lo que
 * acaba en el PDF, degradado incluido.
 */
function NombreEnCanvas({ nombre }: { nombre: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [listo, setListo] = useState(false)
  // Se vuelve a dibujar cuando las tipografías terminan de cargar: el primer
  // pintado puede caer en la letra de reserva y se quedaría así para siempre.
  const [fuentesListas, setFuentesListas] = useState(false)
  useEffect(() => {
    let vivo = true
    document.fonts?.ready.then(() => vivo && setFuentesListas(true))
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !nombre) return

    const alto = Math.round(NOMBRE_TAM * 1.6)
    // Se dibuja al doble de resolución para que no se vea pixelado al ampliar
    // ni al imprimir; el tamaño en pantalla lo fija el CSS.
    const escala = 2
    canvas.width = CERT_W * escala
    canvas.height = alto * escala

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(escala, escala)

    // La familia real la pone next/font con un nombre generado, así que se lee
    // de la variable CSS en vez de escribir "Poppins" a pelo.
    const familia =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--font-poppins')
        .trim() || 'Poppins'

    let tam = NOMBRE_TAM
    ctx.font = `700 ${tam}px ${familia}, sans-serif`
    const ancho = ctx.measureText(nombre).width
    if (ancho > NOMBRE_ANCHO_MAX) {
      // Nombres muy largos: se encogen en vez de salirse del papel.
      tam = Math.floor(tam * (NOMBRE_ANCHO_MAX / ancho))
      ctx.font = `700 ${tam}px ${familia}, sans-serif`
    }

    const cx = CERT_W / 2
    const cy = alto * 0.62
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, CERT_W * 0.34)
    grad.addColorStop(0, TINTA_CENTRO)
    grad.addColorStop(0.5, TINTA_CENTRO)
    grad.addColorStop(1, TINTA_BORDE)

    ctx.clearRect(0, 0, CERT_W, alto)
    ctx.fillStyle = grad
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(nombre, cx, cy)
    setListo(true)
  }, [nombre, fuentesListas])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: `${NOMBRE_BASE_Y - NOMBRE_TAM}px`,
        width: `${CERT_W}px`,
        height: `${Math.round(NOMBRE_TAM * 1.6)}px`,
        opacity: listo ? 1 : 0,
        transition: 'opacity .15s',
      }}
    />
  )
}

const NawarCertificateArt: React.FC<NawarCertificateArtProps> = ({
  studentName,
  awardedDate,
  certificateId,
  innerRef,
}) => {
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const [escala, setEscala] = useState(1)

  // El lienzo es fijo (2000×1414) y se encoge con transform para caber en su
  // hueco. Así lo que se ve y lo que se captura son el mismo nodo, y no hay
  // dos diseños que mantener.
  useEffect(() => {
    const medir = () => {
      const ancho = contenedorRef.current?.clientWidth ?? CERT_W
      setEscala(Math.min(1, ancho / CERT_W))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  return (
    <div ref={contenedorRef} style={{ width: '100%', height: CERT_H * escala }}>
      <div
        ref={innerRef}
        style={{
          position: 'relative',
          width: `${CERT_W}px`,
          height: `${CERT_H}px`,
          transform: `scale(${escala})`,
          transformOrigin: 'top left',
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <img
          src={FONDO_URL}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {studentName ? <NombreEnCanvas nombre={studentName} /> : null}

        {awardedDate ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${FECHA_TOP_Y}px`,
              textAlign: 'center',
              fontFamily: 'var(--font-inter), Inter, sans-serif',
              fontWeight: 700,
              fontSize: `${FECHA_TAM}px`,
              color: '#111111',
            }}
          >
            {awardedDate}
          </div>
        ) : null}

        {/* El código de verificación, discreto y abajo: es lo que permite a un
            tercero comprobar que el certificado es auténtico, y el correo que
            avisa al alumno lo menciona. */}
        {certificateId ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '96px',
              textAlign: 'center',
              fontFamily: 'var(--font-inter), Inter, sans-serif',
              fontSize: '15px',
              letterSpacing: '0.04em',
              color: 'rgba(17,17,17,0.42)',
            }}
          >
            {certificateId}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default NawarCertificateArt

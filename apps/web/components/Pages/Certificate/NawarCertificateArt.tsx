'use client'
import React, { useEffect, useRef, useState } from 'react'

/**
 * Certificado Holandés Nawar — diseño único de la academia.
 *
 * Se dibuja SIEMPRE en un lienzo fijo de 1000×707 px (proporción A4 apaisado)
 * y se escala con transform para caber en su contenedor. Así lo que se ve en
 * pantalla y lo que sale en el PDF son exactamente lo mismo: el descargador
 * (`downloadCertificatePdf`) clona este mismo nodo.
 *
 * Estilos en línea a propósito: el PDF se genera con html2canvas y no debe
 * depender de las hojas de estilo de la app ni de Tailwind.
 */

export const CERT_W = 1000
export const CERT_H = 707

const NAVY = '#1D0084'
const ACCENT = '#4da3ff'
const INK = '#0a1656'

export interface NawarCertificateArtProps {
  /** Nombre del alumno. Sin él se muestra una línea de cortesía. */
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

function Corner({ style }: { style: React.CSSProperties }) {
  return <span style={{ position: 'absolute', width: 26, height: 26, ...style }} />
}

const NawarCertificateArt: React.FC<NawarCertificateArtProps> = ({
  studentName,
  certificationName,
  certificationDescription,
  certificateInstructor,
  certificateId,
  awardedDate,
  qrCodeLink,
  logoUrl,
  innerRef,
}) => {
  const [qr, setQr] = useState<string>('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  // El lienzo es fijo; se escala al ancho disponible.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setScale(Math.min(1, el.clientWidth / CERT_W))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!qrCodeLink) return
    let alive = true
    import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(qrCodeLink, {
          width: 220,
          margin: 0,
          color: { dark: NAVY, light: '#FFFFFF' },
          errorCorrectionLevel: 'M',
        })
      )
      .then((url) => alive && setQr(url))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [qrCodeLink])

  const verifyLabel = qrCodeLink
    ? qrCodeLink.replace(/^https?:\/\//, '')
    : ''

  return (
    <div ref={wrapRef} style={{ width: '100%', height: CERT_H * scale, overflow: 'hidden' }}>
      <div
        ref={innerRef}
        style={{
          width: CERT_W,
          height: CERT_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: '#ffffff',
          position: 'relative',
          fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif",
          color: INK,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Marco doble */}
        <div
          style={{
            position: 'absolute',
            inset: 14,
            border: `2px solid ${NAVY}`,
            borderRadius: 10,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 22,
            border: `1px solid rgba(29,0,132,0.25)`,
            borderRadius: 6,
          }}
        />
        {/* Esquinas */}
        <Corner style={{ top: 30, left: 30, borderTop: `3px solid ${ACCENT}`, borderLeft: `3px solid ${ACCENT}` }} />
        <Corner style={{ top: 30, right: 30, borderTop: `3px solid ${ACCENT}`, borderRight: `3px solid ${ACCENT}` }} />
        <Corner style={{ bottom: 30, left: 30, borderBottom: `3px solid ${ACCENT}`, borderLeft: `3px solid ${ACCENT}` }} />
        <Corner style={{ bottom: 30, right: 30, borderBottom: `3px solid ${ACCENT}`, borderRight: `3px solid ${ACCENT}` }} />

        {/* Banda superior de marca */}
        <div
          style={{
            position: 'absolute',
            top: 22,
            left: 22,
            right: 22,
            height: 96,
            background: NAVY,
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px), radial-gradient(circle 420px at 100% 0%, rgba(11,109,240,0.45) 0%, transparent 65%)',
            backgroundSize: '22px 22px, auto',
            borderRadius: '5px 5px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 34px',
            boxSizing: 'border-box',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Holandés Nawar" style={{ height: 42, objectFit: 'contain' }} crossOrigin="anonymous" />
          ) : (
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: '0.02em' }}>
              Holandés Nawar
            </span>
          )}
          <span
            style={{
              color: ACCENT,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
            }}
          >
            Certificado
          </span>
        </div>

        {/* Cuerpo */}
        <div
          style={{
            position: 'absolute',
            top: 118,
            left: 22,
            right: 22,
            bottom: 22,
            padding: '30px 60px 0',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.30em',
              color: '#025dc7',
              textTransform: 'uppercase',
            }}
          >
            Certificado de finalización
          </p>

          <p style={{ margin: '26px 0 0', fontSize: 13, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Se otorga a
          </p>

          <p
            style={{
              margin: '10px 0 0',
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: 'italic',
              fontSize: 46,
              lineHeight: 1.1,
              color: NAVY,
            }}
          >
            {studentName || '—'}
          </p>
          <div
            style={{
              width: 420,
              height: 1,
              background: 'rgba(29,0,132,0.28)',
              margin: '12px auto 0',
            }}
          />

          <p style={{ margin: '22px 0 0', fontSize: 14.5, color: '#4b5563', lineHeight: 1.6 }}>
            por haber completado con éxito
          </p>

          <p
            style={{
              margin: '8px 0 0',
              fontFamily: "var(--font-poppins), system-ui, sans-serif",
              fontSize: 27,
              fontWeight: 700,
              color: NAVY,
              lineHeight: 1.25,
            }}
          >
            {certificationName}
          </p>

          {certificationDescription ? (
            <p
              style={{
                margin: '12px auto 0',
                maxWidth: 640,
                fontSize: 13,
                color: '#6b7280',
                lineHeight: 1.6,
              }}
            >
              {certificationDescription}
            </p>
          ) : null}

          {/* Pie: firma · sello · verificación */}
          <div
            style={{
              position: 'absolute',
              left: 60,
              right: 60,
              bottom: 34,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ textAlign: 'left', width: 210 }}>
              <div style={{ height: 1, background: 'rgba(10,22,86,0.35)', marginBottom: 7 }} />
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: INK }}>
                {certificateInstructor || 'Holandés Nawar'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 10.5, color: '#9ca3af' }}>Dirección académica</p>
            </div>

            {/* Sello */}
            <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
              <span
                style={{
                  position: 'absolute',
                  inset: -6,
                  border: `1px dashed ${ACCENT}`,
                  borderRadius: '50%',
                }}
              />
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${ACCENT}, #0b6df0)`,
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1.15,
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em' }}>NIVEL</span>
                <span
                  style={{
                    fontFamily: "var(--font-poppins), system-ui, sans-serif",
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  A1
                </span>
                <span style={{ fontSize: 8.5, opacity: 0.85, letterSpacing: '0.08em' }}>NEERLANDÉS</span>
              </div>
            </div>

            <div style={{ textAlign: 'right', width: 230, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'right' }}>
                {awardedDate ? (
                  <>
                    <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Fecha
                    </p>
                    <p style={{ margin: '2px 0 8px', fontSize: 12.5, fontWeight: 600, color: INK }}>{awardedDate}</p>
                  </>
                ) : null}
                {certificateId ? (
                  <>
                    <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Nº de certificado
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 9.5, color: '#6b7280', wordBreak: 'break-all', maxWidth: 150 }}>
                      {certificateId}
                    </p>
                  </>
                ) : null}
              </div>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt="Código de verificación"
                  style={{ width: 68, height: 68, border: `1px solid ${'#DDE6F5'}`, borderRadius: 8, padding: 3, background: '#fff' }}
                />
              ) : null}
            </div>
          </div>

          {verifyLabel ? (
            <p
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 12,
                margin: 0,
                fontSize: 9.5,
                color: '#9ca3af',
              }}
            >
              Verifica la autenticidad de este certificado en {verifyLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default NawarCertificateArt

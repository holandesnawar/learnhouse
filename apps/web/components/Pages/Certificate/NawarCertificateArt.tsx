'use client'
import React, { useEffect, useRef, useState } from 'react'

/**
 * Certificado Holandés Nawar — recreación del diseño oficial de la escuela
 * (olas azules arriba y abajo, logo centrado, marca de agua y el nombre del
 * alumno en cian), con los añadidos que le faltaban al original: la fecha
 * (el modelo terminaba en "afgerond op" sin nada detrás), etiquetas bajo las
 * firmas, número de certificado y QR de verificación.
 *
 * Se dibuja SIEMPRE en un lienzo fijo con proporción A4 apaisado y se escala
 * con transform para caber en su contenedor: lo que se ve en pantalla y lo que
 * sale en el PDF son exactamente lo mismo, porque el descargador
 * (`downloadCertificatePdf`) clona este mismo nodo.
 *
 * Estilos en línea a propósito: el PDF se genera con html2canvas y no debe
 * depender de las hojas de estilo de la app ni de Tailwind.
 */

// A4 apaisado a 96 ppp — el modelo original era 16:9, pero en A4 el PDF se
// imprime a página completa sin franjas en blanco.
export const CERT_W = 1123
export const CERT_H = 794

/** Colores tomados del certificado oficial. */
const NAVY = '#0E1A95'
const NAVY_DEEP = '#0A1478'
const CYAN = '#0AB8EE'
const CYAN_SOFT = '#8FDCF7'

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

  const poppins = "var(--font-poppins), 'Poppins', system-ui, sans-serif"

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
          overflow: 'hidden',
          boxSizing: 'border-box',
          fontFamily: poppins,
        }}
      >
        {/* ── Olas superiores ─────────────────────────────────────────── */}
        <svg
          width={CERT_W}
          height={170}
          viewBox={`0 0 ${CERT_W} 170`}
          style={{ position: 'absolute', top: 0, left: 0 }}
          aria-hidden="true"
        >
          <path
            d={`M0,0 H${CERT_W} V58 C 960,120 806,44 596,86 C 386,128 200,74 0,116 Z`}
            fill={CYAN_SOFT}
            opacity="0.6"
          />
          <path
            d={`M0,0 H${CERT_W} V40 C 946,104 790,26 580,68 C 370,110 186,58 0,96 Z`}
            fill={NAVY}
          />
        </svg>

        {/* ── Olas inferiores ─────────────────────────────────────────── */}
        <svg
          width={CERT_W}
          height={215}
          viewBox={`0 0 ${CERT_W} 215`}
          style={{ position: 'absolute', bottom: 0, left: 0 }}
          aria-hidden="true"
        >
          <path
            d={`M${CERT_W},215 V38 C 950,20 806,72 596,100 C 400,126 200,112 0,146 V215 Z`}
            fill={CYAN_SOFT}
          />
          <path
            d={`M0,215 V96 C 220,58 452,120 668,152 C 820,175 986,168 ${CERT_W},142 V215 Z`}
            fill={NAVY}
          />
          <path
            d={`M0,215 V158 C 250,132 486,178 716,192 C 856,200 1008,196 ${CERT_W},186 V215 Z`}
            fill={NAVY_DEEP}
          />
        </svg>

        {/* ── Marca de agua ───────────────────────────────────────────── */}
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            aria-hidden="true"
            crossOrigin="anonymous"
            style={{
              position: 'absolute',
              top: '47%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '78%',
              opacity: 0.06,
              pointerEvents: 'none',
            }}
          />
        ) : null}

        {/* ── Contenido ───────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '112px 90px 0',
            boxSizing: 'border-box',
            textAlign: 'center',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Holandés Nawar"
              crossOrigin="anonymous"
              style={{ height: 80, objectFit: 'contain', marginBottom: 26 }}
            />
          ) : (
            <p style={{ margin: '0 0 30px', fontSize: 34, fontWeight: 800, color: NAVY }}>
              Holandés Nawar
            </p>
          )}

          <h1
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: '0.045em',
              color: NAVY,
              lineHeight: 1.15,
            }}
          >
            CERTIFICAAT VAN AFRONDING
          </h1>

          <p style={{ margin: '24px 0 0', fontSize: 20, color: NAVY, letterSpacing: '0.01em' }}>
            Dit is om te bevestigen dat
          </p>

          <p
            style={{
              margin: '18px 0 0',
              fontSize: 45,
              fontWeight: 800,
              color: CYAN,
              lineHeight: 1.1,
              textTransform: 'uppercase',
              letterSpacing: '0.01em',
              maxWidth: 900,
            }}
          >
            {studentName || '—'}
          </p>

          <p style={{ margin: '22px 0 0', fontSize: 20, color: NAVY, lineHeight: 1.55, maxWidth: 820 }}>
            de cursus <strong style={{ fontWeight: 700 }}>{certificationName}</strong>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 20, color: NAVY, lineHeight: 1.55 }}>
            succesvol heeft afgerond{awardedDate ? ' op' : ''}
            {awardedDate ? (
              <strong style={{ fontWeight: 700 }}> {awardedDate}</strong>
            ) : null}
          </p>

          {certificationDescription ? (
            <p
              style={{
                margin: '16px auto 0',
                maxWidth: 700,
                fontSize: 13.5,
                color: 'rgba(14,26,149,0.62)',
                lineHeight: 1.55,
              }}
            >
              {certificationDescription}
            </p>
          ) : null}
        </div>

        {/* ── Firmas · verificación ───────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            left: 104,
            right: 104,
            bottom: 222,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div style={{ width: 236, textAlign: 'center' }}>
            <div style={{ height: 2, background: NAVY, marginBottom: 9 }} />
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: NAVY }}>
              {certificateInstructor || 'Holandés Nawar'}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(14,26,149,0.60)' }}>
              Academisch directeur
            </p>
          </div>

          {/* Verificación: número + QR (el modelo original no lo llevaba) */}
          <div style={{ textAlign: 'center', paddingBottom: 2 }}>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="Verificatiecode"
                style={{
                  width: 66,
                  height: 66,
                  display: 'block',
                  margin: '0 auto 6px',
                  border: '1px solid rgba(14,26,149,0.18)',
                  borderRadius: 8,
                  padding: 4,
                  background: '#fff',
                }}
              />
            ) : null}
            {certificateId ? (
              <>
                <p
                  style={{
                    margin: 0,
                    fontSize: 8.5,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'rgba(14,26,149,0.50)',
                  }}
                >
                  Certificaatnummer
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 9.5, color: 'rgba(14,26,149,0.72)' }}>
                  {certificateId}
                </p>
              </>
            ) : null}
          </div>

          <div style={{ width: 236, textAlign: 'center' }}>
            <div style={{ height: 2, background: NAVY, marginBottom: 9 }} />
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: NAVY }}>Holandés Nawar</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(14,26,149,0.60)' }}>
              Namens de academie
            </p>
          </div>
        </div>

        {qrCodeLink ? (
          <p
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 198,
              margin: 0,
              fontSize: 9,
              color: 'rgba(14,26,149,0.42)',
              textAlign: 'center',
            }}
          >
            Verifieer dit certificaat op {qrCodeLink.replace(/^https?:\/\//, '')}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default NawarCertificateArt

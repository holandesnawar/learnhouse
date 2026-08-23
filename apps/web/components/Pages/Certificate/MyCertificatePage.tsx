'use client'
import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useOrg } from '@components/Contexts/OrgContext'
import { getCertificateByUuid } from '@services/courses/certifications'
import CertificatePreview from '@components/Dashboard/Pages/Course/EditCourseCertification/CertificatePreview'
import { downloadCertificatePdf, certificateFileName } from './downloadCertificatePdf'
import { getUriWithOrg } from '@services/config/config'
import { Download, ShieldCheck, Loader2 } from 'lucide-react'

/**
 * El certificado del alumno, en su sitio propio y en español.
 *
 * Es la página a la que lleva el correo de "tu certificado ya está listo": se
 * ve el certificado tal cual, se descarga en PDF con un botón, y debajo está el
 * código de verificación con su enlace público (el mismo del QR).
 */
export default function MyCertificatePage(props: { orgslug: string; uuid: string }) {
  const org = useOrg() as any
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const certRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!org?.id) return
    let alive = true
    getCertificateByUuid(props.uuid, org.id)
      .then((res: any) => {
        if (!alive) return
        setData(res?.success ? res.data : null)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [props.uuid, org?.id])

  const verifyUrl = getUriWithOrg(props.orgslug, `/certificates/${props.uuid}/verify`)

  const download = async () => {
    setDownloading(true)
    try {
      await downloadCertificatePdf(
        certRef.current,
        certificateFileName(data?.certification?.config?.certification_name)
      )
    } catch {
      toast.error('No se pudo generar el PDF. Inténtalo otra vez.')
    }
    setDownloading(false)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-500 gap-2">
        <Loader2 size={18} className="animate-spin" />
        Cargando tu certificado…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white border border-[#DDE6F5] rounded-2xl p-8">
          <h1 className="text-[20px] font-bold text-[#0a1656] mb-2">
            No encontramos este certificado
          </h1>
          <p className="text-[14px] text-gray-600 leading-relaxed">
            Puede que el enlace esté incompleto. Ábrelo desde el correo que te
            mandamos, o escríbenos y lo miramos.
          </p>
        </div>
      </div>
    )
  }

  const config = data.certification?.config || {}
  const studentName =
    [data.user?.first_name, data.user?.last_name].filter(Boolean).join(' ').trim() ||
    data.user?.username ||
    ''

  return (
    <div className="px-4 sm:px-8 py-8 max-w-4xl mx-auto">
      <p className="text-[12px] font-semibold text-[#4da3ff] tracking-wider uppercase">
        Holandés Nawar
      </p>
      <h1 className="text-[24px] sm:text-[30px] font-bold text-[#1D0084] leading-tight mt-1 mb-1">
        Tu certificado
      </h1>
      <p className="text-[14px] text-gray-600 mb-6">
        Enhorabuena{studentName ? `, ${studentName}` : ''}. Descárgalo en PDF y
        compártelo con quien quieras.
      </p>

      <div className="bg-white border border-[#DDE6F5] rounded-2xl p-4 sm:p-6">
        <CertificatePreview
          certificationName={config.certification_name}
          certificationDescription={config.certification_description}
          certificationType={config.certification_type}
          certificatePattern={config.certificate_pattern}
          certificateInstructor={config.certificate_instructor}
          certificateId={data.certificate_user?.user_certification_uuid}
          studentName={studentName}
          awardedDate={
            data.certificate_user?.created_at
              // En neerlandés: la frase del certificado acaba en "heeft
              // afgerond op", así que "12 juni 2026" y no "12 de junio de 2026".
              ? new Date(data.certificate_user.created_at).toLocaleDateString('nl-NL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : ''
          }
          qrCodeLink={verifyUrl}
          innerRef={certRef}
        />

        <button
          onClick={download}
          disabled={downloading}
          className={`mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#4da3ff] hover:bg-[#5eb4ff] text-[#0a1656] font-bold px-6 py-3.5 rounded-xl text-[15px] transition-colors ${
            downloading ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Descargar en PDF
        </button>
      </div>

      <div className="mt-5 bg-[#F0F5FF] rounded-xl px-4 py-4">
        <p className="flex items-center gap-2 text-[13px] font-bold text-[#0a1656]">
          <ShieldCheck size={16} className="text-[#4da3ff]" />
          Código de verificación
        </p>
        <p className="mt-1.5 text-[13px] text-[#0a1656]/80 leading-relaxed">
          Cada certificado lleva un código único. Sirve para que una empresa o
          una escuela compruebe que es de verdad: al abrir el enlace (o escanear
          el QR del propio certificado) sale una página con tu nombre y la fecha.
          Nadie puede fabricarse uno por su cuenta.
        </p>
        <code className="block mt-2 text-[12px] break-all text-[#025dc7]">
          {data.certificate_user?.user_certification_uuid}
        </code>
        <a
          href={verifyUrl}
          className="inline-block mt-2 text-[13px] font-bold text-[#025dc7] underline"
        >
          Abrir la página de verificación
        </a>
      </div>
    </div>
  )
}

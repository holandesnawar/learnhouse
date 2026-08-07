'use client'
import React from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import NawarCertificateArt from '@components/Pages/Certificate/NawarCertificateArt'

/**
 * Vista del certificado. Punto ÚNICO de diseño: lo usan la pantalla de fin de
 * curso, la página del certificado, la verificación pública y la vista previa
 * del panel de admin. El dibujo vive en NawarCertificateArt para que el PDF
 * capture exactamente lo mismo.
 *
 * Se conservan las props del componente original (los patrones de color y el
 * tipo de certificación de LearnHouse ya no pintan nada: la escuela tiene una
 * sola identidad) para no tocar las cuatro pantallas que lo llaman.
 */
interface CertificatePreviewProps {
  certificationName: string
  certificationDescription: string
  certificationType?: string
  certificatePattern?: string
  certificateInstructor?: string
  certificateId?: string
  awardedDate?: string
  qrCodeLink?: string
  /** Nombre del alumno que recibe el certificado. */
  studentName?: string
  /** Ref al lienzo real — lo usa la descarga en PDF. */
  innerRef?: React.RefObject<HTMLDivElement | null>
}

const CertificatePreview: React.FC<CertificatePreviewProps> = ({
  certificationName,
  certificationDescription,
  certificateInstructor,
  certificateId,
  awardedDate,
  qrCodeLink,
  studentName,
  innerRef,
}) => {
  const org = useOrg() as any

  const logoUrl =
    org?.org_uuid && org?.logo_image
      ? getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)
      : undefined

  return (
    <NawarCertificateArt
      studentName={studentName}
      certificationName={certificationName || 'Formación Holandés Nawar'}
      certificationDescription={certificationDescription}
      certificateInstructor={certificateInstructor}
      certificateId={certificateId}
      awardedDate={awardedDate}
      qrCodeLink={qrCodeLink}
      logoUrl={logoUrl}
      innerRef={innerRef}
    />
  )
}

export default CertificatePreview

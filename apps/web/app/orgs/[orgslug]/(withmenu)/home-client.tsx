'use client'
import React from 'react'
import { useOrg } from '@components/Contexts/OrgContext'
import LandingCustom from '@components/Landings/LandingCustom'
import StudentHome from '@components/Pages/Home/StudentHome'
import { JsonLd } from '@components/SEO/JsonLd'
import { getUriWithOrg } from '@services/config/config'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'

export default function HomeClient({ orgslug }: { orgslug: string }) {
  const org = useOrg() as any

  const landingConfig = org?.config?.config?.customization?.landing || org?.config?.config?.landing
  const hasCustomLanding = landingConfig?.enabled

  const orgJsonLd = org
    ? {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: org.name,
        description: org.description,
        url: getUriWithOrg(orgslug, '/'),
        ...(org.logo_image && {
          logo: getOrgLogoMediaDirectory(org.org_uuid, org.logo_image),
        }),
      }
    : null

  // Antes esta pantalla esperaba a que llegaran cursos y colecciones y
  // mientras tanto pintaba una rejilla de tarjetas de curso: la forma del
  // Inicio ANTIGUO. Al llegar los datos se sustituía de golpe por el Inicio
  // actual, y se veía como si la página cargara dos veces. Ahora solo se
  // espera a la organización (hace falta para saber qué portada toca) y el
  // hueco reservado tiene ya la forma del Inicio de verdad; cada sección
  // resuelve su propia carga por dentro.
  if (!org) {
    return (
      <GeneralWrapperStyled>
        <div className="animate-pulse pt-2">
          <div className="pb-6 space-y-2">
            <div className="h-8 bg-gray-200 rounded-lg w-56" />
            <div className="h-4 bg-gray-200 rounded w-72" />
          </div>
          <div className="h-[188px] bg-gray-200 rounded-2xl mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="h-[164px] bg-gray-200 rounded-2xl" />
            <div className="h-[164px] bg-gray-200 rounded-2xl" />
          </div>
          <div className="h-[168px] bg-gray-200 rounded-2xl" />
        </div>
      </GeneralWrapperStyled>
    )
  }

  return (
    <div className="w-full">
      {orgJsonLd && <JsonLd data={orgJsonLd} />}
      {hasCustomLanding ? (
        <LandingCustom landing={landingConfig} orgslug={orgslug} />
      ) : (
        <StudentHome orgslug={orgslug} />
      )}
    </div>
  )
}

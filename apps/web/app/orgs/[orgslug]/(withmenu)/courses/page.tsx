import React from 'react'
import { redirect } from 'next/navigation'
import { Metadata } from 'next'
import { RUTA_FORMACION } from '@/lib/nawar/cursos'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgThumbnailMediaDirectory, getOrgOgImageMediaDirectory } from '@services/media/media'
import { getOrgSeoConfig, buildPageTitle } from '@/lib/seo/utils'
import { getServerCanonicalUrl } from '@/lib/seo/utils.server'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })

  const seoConfig = getOrgSeoConfig(org)
  const ogImageUrl = seoConfig.default_og_image
    ? getOrgOgImageMediaDirectory(org?.org_uuid, seoConfig.default_og_image)
    : null
  const imageUrl = ogImageUrl || getOrgThumbnailMediaDirectory(org?.org_uuid, org?.thumbnail_image)
  const canonical = await getServerCanonicalUrl(params.orgslug, '/courses')
  const title = buildPageTitle('Courses', org.name, seoConfig)
  const description = org.description || seoConfig.default_meta_description || ''

  return {
    title,
    description,
    keywords: `${org.name}, ${org.description}, courses, learning, education, online learning, edu, online courses, ${org.name} courses`,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 600,
          alt: org.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      ...(seoConfig.twitter_handle && { site: seoConfig.twitter_handle }),
    },
  }
}

/**
 * El listado de cursos no se enseña: manda a la Formación.
 *
 * `/courses` es el índice genérico de LearnHouse y aquí enseña la Formación
 * junto a "Clases Nawar", que es material de apoyo, no un curso para elegir.
 * El alumno tiene UN camino, y ponerle delante un índice con dos fichas le hace
 * dudar de cuál es el suyo justo el primer día. La barra lateral ya lleva
 * directa a la Formación; esto cierra la puerta de atrás —el enlace viejo
 * guardado, la dirección escrita a mano— sin romper ninguna de las dos.
 *
 * Si algún día hay de verdad varios cursos que elegir (A1-A2), se quita este
 * redirect y vuelve el listado.
 *
 * El redirect es relativo a propósito: la escuela es single-tenancy y las
 * direcciones públicas no llevan el prefijo `/orgs/<slug>`.
 */
const CoursesPage = async () => {
  redirect(RUTA_FORMACION)
}

export default CoursesPage

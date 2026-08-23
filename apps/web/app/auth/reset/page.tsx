import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgSlug } from '@services/org/orgResolution'
import { getOrgLogoMediaDirectory, getOrgFaviconMediaDirectory } from '@services/media/media'
import ResetPasswordClient from './reset'
import { Metadata } from 'next'
import OrgNotFound from '@components/Objects/StyledElements/Error/OrgNotFound'
import OrgUnavailable from '@components/Objects/StyledElements/Error/OrgUnavailable'
import { getOrgWithRetry } from '@services/organizations/orgFetch'
import { Suspense } from 'react'
import PageLoading from '@components/Objects/Loaders/PageLoading'

export async function generateMetadata(): Promise<Metadata> {
  const orgslug = await getOrgSlug()

  if (!orgslug) {
    return { title: 'Restablecer contraseña' }
  }

  let org: any = null
  try {
    org = await getOrganizationContextInfo(orgslug, {
      revalidate: 60,
      tags: ['organizations'],
    })
  } catch {
    // Stale cookie or unknown org — fall back to generic title
  }

  // Match the platform favicon: configured favicon first, then the org logo.
  const faviconImage =
    org?.config?.config?.customization?.general?.favicon_image ||
    org?.config?.config?.general?.favicon_image
  const favicon = faviconImage
    ? getOrgFaviconMediaDirectory(org.org_uuid, faviconImage)
    : org?.logo_image
    ? getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)
    : undefined

  return {
    title: 'Restablecer contraseña' + ` — ${org?.name || 'Nawar'}`,
    ...(favicon && { icons: { icon: favicon } }),
    robots: { index: false, follow: false },
  }
}

const ResetPasswordPage = async () => {
  const orgslug = await getOrgSlug()

  if (!orgslug) {
    return <OrgNotFound />
  }

  // Con reintentos: la primera llamada tras un reinicio puede llegar antes
  // de que la API esté lista, y sin esto se enseñaba la pantalla equivocada.
  const org = await getOrgWithRetry(orgslug, {
      revalidate: 60,
      tags: ['organizations'],
    })

  if (!org) {
    return <OrgUnavailable />
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <ResetPasswordClient org={org} />
    </Suspense>
  )
}

export default ResetPasswordPage

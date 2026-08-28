import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgSlug } from '@services/org/orgResolution'
import ResetPasswordClient from './reset'
import { Metadata } from 'next'
import { BRAND_ICONS } from '@/lib/brand'
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


  return {
    title: 'Restablecer contraseña' + ` — ${org?.name || 'Nawar'}`,
    icons: BRAND_ICONS,
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

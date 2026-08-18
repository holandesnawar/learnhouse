import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgSlug } from '@services/org/orgResolution'
import SignUpClient from './signup'
import { Suspense } from 'react'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import OrgNotFound from '@components/Objects/StyledElements/Error/OrgNotFound'
import OrgUnavailable from '@components/Objects/StyledElements/Error/OrgUnavailable'
import { getOrgWithRetry } from '@services/organizations/orgFetch'

export async function generateMetadata(): Promise<Metadata> {
  const orgslug = await getOrgSlug()

  if (!orgslug) {
    return { title: 'Crear cuenta' }
  }

  let org: any = null
  try {
    org = await getOrganizationContextInfo(orgslug, null)
  } catch {
    // Stale cookie or unknown org — fall back to generic title
  }

  return {
    title: 'Crear cuenta' + ` — ${org?.name || 'Formación Nawar'}`,
    robots: { index: false, follow: false },
  }
}

const SignUp = async () => {
  const orgslug = await getOrgSlug()

  if (!orgslug) {
    return <OrgNotFound />
  }

  // Con reintentos: la primera llamada tras un reinicio puede llegar antes
  // de que la API esté lista, y sin esto se enseñaba la pantalla equivocada.
  const org = await getOrgWithRetry(orgslug, null)

  if (!org) {
    return <OrgUnavailable />
  }

  return (
    <>
      <Suspense fallback={<PageLoading />}>
        <SignUpClient org={org} />
      </Suspense>
    </>
  )
}

export default SignUp

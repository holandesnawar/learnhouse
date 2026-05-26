import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { getOrgSlug } from '@services/org/orgResolution'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import LoginClient from './login'
import { Metadata } from 'next'
import OrgNotFound from '@components/Objects/StyledElements/Error/OrgNotFound'

export async function generateMetadata(): Promise<Metadata> {
  const orgslug = await getOrgSlug()

  if (!orgslug) {
    return { title: 'Iniciar Sesión' }
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

  const favicon = org?.logo_image
    ? getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)
    : undefined

  return {
    title: 'Iniciar Sesión' + ` — ${org?.name || 'Nawar'}`,
    ...(favicon && { icons: { icon: favicon } }),
    robots: { index: false, follow: false },
  }
}

const Login = async () => {
  const orgslug = await getOrgSlug()

  if (!orgslug) {
    return <OrgNotFound />
  }

  let org: any = null
  try {
    org = await getOrganizationContextInfo(orgslug, {
      revalidate: 60,
      tags: ['organizations'],
    })
  } catch {
    return <OrgNotFound />
  }

  if (!org) {
    return <OrgNotFound />
  }

  return (
    <div>
      <LoginClient org={org}></LoginClient>
    </div>
  )
}

export default Login

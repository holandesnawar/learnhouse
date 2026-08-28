import { Metadata } from 'next'
import { OrgProvider } from '@components/Contexts/OrgContext'
import OrgLanguageSync from '@components/Contexts/OrgLanguageSync'
import NextTopLoader from 'nextjs-toploader'
import Toast from '@components/Objects/StyledElements/Toast/Toast'
import '@styles/globals.css'
import Footer from '@components/Footer/Footer'
import { BRAND_ICONS } from '@/lib/brand'

export async function generateMetadata(): Promise<Metadata> {
  // El icono es el mismo en toda la escuela y sale del repo (ver lib/brand.ts).
  return { icons: BRAND_ICONS }
}

export default async function RootLayout(props: {
  children: React.ReactNode
  params: Promise<{ orgslug: string }>
}) {
  const params = await props.params

  return (
    <div>
      <OrgProvider orgslug={params.orgslug}>
        <OrgLanguageSync />
        <NextTopLoader color="#2e2e2e" initialPosition={0.3} height={4} easing={'ease'} speed={500} showSpinner={false} />
        <Toast />
        {props.children}
        <Footer />
      </OrgProvider>
    </div>
  )
}

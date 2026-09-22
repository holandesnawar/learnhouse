import type { Metadata } from 'next'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import RecursosPage from '@components/Pages/Recursos/RecursosPage'

export const metadata: Metadata = {
  title: 'Recursos',
}

export default function RecursosRoute() {
  return (
    <GeneralWrapperStyled>
      <RecursosPage />
    </GeneralWrapperStyled>
  )
}

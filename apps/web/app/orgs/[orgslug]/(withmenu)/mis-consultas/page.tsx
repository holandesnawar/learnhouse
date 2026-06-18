import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import AccountConsultas from '@components/Objects/Account/subpages/AccountConsultas'

// Standalone "Mis consultas" — same content as the account subpage but on its
// own page (reached from the sidebar "Tu espacio"), without the profile/account
// nav around it.
export default async function MisConsultasPage() {
  return (
    <GeneralWrapperStyled>
      <AccountConsultas />
    </GeneralWrapperStyled>
  )
}

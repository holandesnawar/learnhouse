import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import MyNotesBoard from '@components/Pages/Notes/MyNotesBoard'

export default async function MisNotasPage({
  params,
}: {
  params: Promise<{ orgslug: string }>
}) {
  const { orgslug } = await params
  return (
    <GeneralWrapperStyled>
      <MyNotesBoard orgslug={orgslug} />
    </GeneralWrapperStyled>
  )
}

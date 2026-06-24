import MiProgreso from '@components/exercises-app/MiProgreso'

const ProgresoPage = async (props: { params: Promise<{ orgslug: string }> }) => {
  const { orgslug } = await props.params
  return <MiProgreso orgslug={orgslug} />
}

export default ProgresoPage

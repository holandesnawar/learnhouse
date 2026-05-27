import ExerciseCenter from '@components/exercises-app/ExerciseCenter'

const EjerciciosPage = async (props: { params: Promise<{ orgslug: string }> }) => {
  const { orgslug } = await props.params
  return <ExerciseCenter orgslug={orgslug} />
}

export default EjerciciosPage

import VocabularyPractice from '@components/Pages/Exercises/VocabularyPractice'

const EjerciciosPage = async (props: { params: Promise<{ orgslug: string }> }) => {
  const { orgslug } = await props.params
  return <VocabularyPractice orgslug={orgslug} />
}

export default EjerciciosPage

import CalendarView from '@components/Pages/Calendar/CalendarView'

const CalendarPage = async (props: { params: Promise<{ orgslug: string }> }) => {
  const { orgslug } = await props.params
  return <CalendarView orgslug={orgslug} />
}

export default CalendarPage

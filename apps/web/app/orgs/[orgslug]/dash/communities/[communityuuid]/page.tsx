import { redirect } from 'next/navigation'

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ orgslug: string; communityuuid: string }>
}) {
  const { communityuuid } = await params
  redirect(`/dash/communities/${communityuuid}/general`)
}

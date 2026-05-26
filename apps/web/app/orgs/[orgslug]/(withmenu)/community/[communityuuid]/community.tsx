'use client'

import React, { useState, useEffect } from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { CommunitySidebar } from '@components/Objects/Communities/CommunitySidebar'
import { MessageCircle, MessagesSquare, LayoutList } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { CommunityActionsMobile } from '@components/Objects/Communities/CommunityActionsMobile'
import { DiscussionList } from '@components/Objects/Communities/DiscussionList'
import { ChannelChat } from '@components/Objects/Communities/ChannelChat'
import { CreateDiscussionModal } from '@components/Objects/Modals/Communities/CreateDiscussionModal'
import { Community } from '@services/communities/communities'
import { DiscussionWithAuthor } from '@services/communities/discussions'
import { useMediaQuery } from 'usehooks-ts'

interface CommunityClientProps {
  community: Community
  initialDiscussions: DiscussionWithAuthor[]
  orgslug: string
  org_id: number
}

const CommunityClient = ({
  community,
  initialDiscussions,
  orgslug,
  org_id,
}: CommunityClientProps) => {
  const [isCreateDiscussionModalOpen, setIsCreateDiscussionModalOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const viewKey = `lh-community-view-${community.community_uuid}`
  const [view, setView] = useState<'chat' | 'forum'>('chat')
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(viewKey) : null
    if (saved === 'chat' || saved === 'forum') setView(saved)
  }, [viewKey])
  const changeView = (v: 'chat' | 'forum') => {
    setView(v)
    if (typeof window !== 'undefined') localStorage.setItem(viewKey, v)
  }

  return (
    <>
      <GeneralWrapperStyled>
        {/* Breadcrumbs */}
        <div className="pb-4">
          <Breadcrumbs items={[
            { label: 'Communities', href: getUriWithOrg(orgslug, '/communities'), icon: <MessageCircle size={14} /> },
            { label: community.name }
          ]} />
        </div>

        {/* Forum Layout - Sidebar Left, Content Right */}
        <div className="flex flex-col md:flex-row gap-6 pt-2">
          {/* Left Sidebar - Community Info (Desktop only) */}
          <div className="hidden md:block w-full md:w-72 lg:w-80 flex-shrink-0">
            <div className="sticky top-24">
              <CommunitySidebar
                community={community}
                discussionCount={initialDiscussions.length}
                orgslug={orgslug}
                onCreateDiscussion={() => setIsCreateDiscussionModalOpen(true)}
              />
            </div>
          </div>

          {/* Main Content - Discussions Feed */}
          <div className="flex-1 min-w-0">
            {/* Mobile only shows community name */}
            <div className="md:hidden mb-4">
              <h1 className="text-xl font-bold text-gray-900">{community.name}</h1>
              {community.description && (
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {community.description}
                </p>
              )}
            </div>

            {/* Chat / Forum toggle */}
            <div className="mb-4 inline-flex items-center gap-1 p-1 bg-white nice-shadow rounded-lg">
              <button
                onClick={() => changeView('chat')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'chat' ? 'bg-[#025dc7] text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MessagesSquare size={15} />
                Chat
              </button>
              <button
                onClick={() => changeView('forum')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'forum' ? 'bg-[#025dc7] text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LayoutList size={15} />
                Foro
              </button>
            </div>

            {/* Content */}
            <div className="bg-white nice-shadow rounded-lg overflow-hidden">
              {view === 'chat' ? (
                <ChannelChat
                  communityUuid={community.community_uuid}
                  channelName={community.name}
                />
              ) : (
                <DiscussionList
                  communityUuid={community.community_uuid}
                  orgslug={orgslug}
                  onCreateClick={() => setIsCreateDiscussionModalOpen(true)}
                  initialDiscussions={initialDiscussions}
                />
              )}
            </div>
          </div>
        </div>

        {/* Bottom padding for mobile action bar */}
        {isMobile && <div className="h-24" />}
      </GeneralWrapperStyled>

      {/* Mobile Actions Bar */}
      {isMobile && (
        <CommunityActionsMobile
          community={community}
          orgslug={orgslug}
          onCreateDiscussion={() => setIsCreateDiscussionModalOpen(true)}
        />
      )}

      {/* Modals */}
      <CreateDiscussionModal
        isOpen={isCreateDiscussionModalOpen}
        onClose={() => setIsCreateDiscussionModalOpen(false)}
        communityUuid={community.community_uuid}
        orgSlug={orgslug}
      />
    </>
  )
}

export default CommunityClient

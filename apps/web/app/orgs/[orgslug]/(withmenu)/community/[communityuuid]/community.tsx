'use client'

import React from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { ChannelChat } from '@components/Objects/Communities/ChannelChat'
import { getUriWithOrg } from '@services/config/config'
import { ArrowLeft, Hash } from 'lucide-react'
import Link from 'next/link'
import { Community } from '@services/communities/communities'
import { DiscussionWithAuthor } from '@services/communities/discussions'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'

interface CommunityClientProps {
  community: Community
  initialDiscussions: DiscussionWithAuthor[]
  orgslug: string
  org_id: number
}

// A community = a chat channel. Entering it drops you straight into the chat;
// the list of channels lives at /communities.
const CommunityClient = ({ community, orgslug }: CommunityClientProps) => {
  const { emoji, text } = splitChannelEmoji(community.name)
  return (
    <GeneralWrapperStyled>
      <Link
        href={getUriWithOrg(orgslug, '/communities')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A6480] hover:text-[#1D0084] transition-colors mb-3"
      >
        <ArrowLeft size={15} /> Canales
      </Link>

      {/* Channel header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
          {emoji ? (
            <span className="text-xl leading-none" aria-hidden>{emoji}</span>
          ) : (
            <Hash size={20} className="text-[#025dc7]" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{text}</h1>
          {community.description && (
            <p className="text-sm text-gray-500 mt-0.5">{community.description}</p>
          )}
        </div>
      </div>

      {/* Chat */}
      <div className="bg-white nice-shadow rounded-2xl overflow-hidden">
        <ChannelChat communityUuid={community.community_uuid} channelName={text} />
      </div>
    </GeneralWrapperStyled>
  )
}

export default CommunityClient

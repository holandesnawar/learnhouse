'use client'

import React from 'react'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { ChannelChat } from '@components/Objects/Communities/ChannelChat'
import ChannelPosts from '@components/Objects/Communities/ChannelPosts'
import PinnedFeed from '@components/Objects/Communities/PinnedFeed'
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

// Un canal puede ser de dos formas, y se elige al crearlo:
//   chat  → conversación seguida (lo de siempre)
//   posts → tablón: título, cuerpo, fotos y comentarios. Para las victorias o
//           las presentaciones, que en un chat se pierden a los dos días.
// La lista de canales vive en /communities.
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
        <div className="w-10 h-10 flex items-center justify-center shrink-0">
          {emoji ? (
            <span className="text-2xl leading-none" aria-hidden>{emoji}</span>
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

      {community.kind === 'posts' ? (
        /* Tablón: a todo el ancho, que las tarjetas se lean bien */
        <ChannelPosts
          communityUuid={community.community_uuid}
          channelName={text}
          orgslug={orgslug}
        />
      ) : (
        /* Chat + mensajes fijados al lado */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white nice-shadow rounded-2xl overflow-hidden">
            <ChannelChat communityUuid={community.community_uuid} channelName={text} />
          </div>
          <div className="lg:col-span-1">
            <PinnedFeed communityUuid={community.community_uuid} />
          </div>
        </div>
      )}
    </GeneralWrapperStyled>
  )
}

export default CommunityClient

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getCommunities, Community } from '@services/communities/communities'
import { getUriWithOrg } from '@services/config/config'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'
import { MessagesSquare, Hash, ChevronRight } from 'lucide-react'

const channelId = (uuid: string) => uuid.replace('community_', '')

interface Props {
  orgslug: string
  title?: string
  /** Stack the channels in a single vertical column (one row each) instead of
   *  the responsive 2-3 column grid. Used in the narrow right rail. */
  singleColumn?: boolean
}

// Quick-access cards for the community channels: pick one and go straight to its
// chat. Used on the home and at the bottom of a course page.
export default function CommunityChannelsCards({ orgslug, title = 'Comunidad', singleColumn = false }: Props) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const orgId = org?.id as number | undefined
  const [channels, setChannels] = useState<Community[]>([])

  useEffect(() => {
    if (!orgId) return
    let active = true
    getCommunities(orgId, 1, 100, null, session?.data?.tokens?.access_token)
      .then((res: any) => {
        if (active && Array.isArray(res)) setChannels(res)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [orgId, session?.data?.tokens?.access_token])

  if (!channels.length) return null

  return (
    <div className={singleColumn ? '' : 'mb-10'}>
      <div className="flex items-center gap-2 mb-4">
        <MessagesSquare size={20} className="text-[#025dc7]" />
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      <div className={singleColumn ? 'flex flex-col gap-3' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'}>
        {channels.map((c) => {
          const { emoji, text } = splitChannelEmoji(c.name)
          return (
            <Link
              key={c.community_uuid}
              href={getUriWithOrg(orgslug, `/community/${channelId(c.community_uuid)}`)}
              className="group flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-white/5 nice-shadow border border-transparent dark:border-white/10 hover:border-[#4da3ff]/40 transition-all"
            >
              <div className="w-11 h-11 flex items-center justify-center shrink-0">
                {emoji ? (
                  <span className="text-2xl leading-none" aria-hidden>{emoji}</span>
                ) : (
                  <Hash size={24} className="text-[#025dc7]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">{text}</p>
                {c.description && (
                  <p className="text-[13px] text-gray-500 leading-snug line-clamp-1">{c.description}</p>
                )}
              </div>
              <ChevronRight
                size={18}
                className="text-gray-300 group-hover:text-[#025dc7] group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { CreateCommunityModal } from '@components/Objects/Modals/Communities/CreateCommunityModal'
import ContentPlaceHolderIfUserIsNotAdmin from '@components/Objects/ContentPlaceHolder'
import { getUriWithOrg } from '@services/config/config'
import { Plus, Hash, ChevronRight, MessagesSquare } from 'lucide-react'
import Link from 'next/link'
import { Community } from '@services/communities/communities'
import FeatureGate from '@components/Dashboard/Shared/FeatureGate/FeatureGate'
import { splitChannelEmoji } from '@/lib/communities/channelEmoji'
import CommunityInfoPanel from '@components/Objects/Communities/CommunityInfoPanel'

interface CommunitiesClientProps {
  communities: Community[]
  orgslug: string
  org_id: number
}

const channelId = (uuid: string) => uuid.replace('community_', '')

const CommunitiesClient = ({ communities, orgslug, org_id }: CommunitiesClientProps) => {
  const { t } = useTranslation()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  return (
    <FeatureGate feature="communities" orgslug={orgslug} context="public">
      <GeneralWrapperStyled>
       <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="min-w-0">
        {/* Header + intro */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <MessagesSquare size={24} className="text-[#025dc7]" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Comunidad</h1>
            </div>
            <p className="text-sm text-gray-500 mt-1 max-w-lg">
              Estos son nuestros canales. Entra en uno para escribir y charlar con el resto
              de la comunidad.
            </p>
          </div>
          <AuthenticatedClientElement
            ressourceType="communities"
            action="create"
            checkMethod="roles"
            orgId={org_id}
          >
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4da3ff] text-[#0a1656] font-semibold text-sm hover:bg-[#6cb5ff] transition-colors"
            >
              <Plus size={16} />
              Nuevo canal
            </button>
          </AuthenticatedClientElement>
        </div>

        {/* Channel list */}
        {communities.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-12 px-4 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/30">
            <div className="p-4 bg-white rounded-full nice-shadow mb-4">
              <MessagesSquare className="w-8 h-8 text-gray-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-gray-600 mb-2">{t('communities.no_communities')}</h2>
            <p className="text-sm text-gray-400 text-center max-w-xs">
              <ContentPlaceHolderIfUserIsNotAdmin text={t('communities.no_communities_description')} />
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {communities.map((community) => {
              const { emoji, text } = splitChannelEmoji(community.name)
              return (
              <Link
                key={community.community_uuid}
                href={getUriWithOrg(orgslug, `/community/${channelId(community.community_uuid)}`)}
                className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white nice-shadow border border-transparent hover:border-[#4da3ff]/40 transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                  {emoji ? (
                    <span className="text-xl leading-none" aria-hidden>{emoji}</span>
                  ) : (
                    <Hash size={20} className="text-[#025dc7]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">
                    {text}
                  </p>
                  {community.description && (
                    <p className="text-[13px] text-gray-500 leading-snug line-clamp-1">
                      {community.description}
                    </p>
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
        )}
        </div>

        <CommunityInfoPanel org_id={org_id} />
       </div>
      </GeneralWrapperStyled>

      <CreateCommunityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        orgId={org_id}
        orgSlug={orgslug}
      />
    </FeatureGate>
  )
}

export default CommunitiesClient

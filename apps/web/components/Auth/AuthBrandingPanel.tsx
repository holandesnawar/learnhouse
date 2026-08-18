'use client'
import React from 'react'
import Link from 'next/link'
import { BRAND_LOGO_URL, BRAND_NAME } from '@/lib/brand'
import { getOrgLogoMediaDirectory, getOrgAuthBackgroundMediaDirectory } from '@services/media/media'
import { getUriWithOrg } from '@services/config/config'
import { cn } from '@/lib/utils'
import { isOSSMode } from '@services/config/config'

interface AuthBrandingPanelProps {
  org: any
  welcomeText?: string
}

export default function AuthBrandingPanel({ org, welcomeText }: AuthBrandingPanelProps) {
  const authBranding = org?.config?.config?.customization?.auth_branding || org?.config?.config?.general?.auth_branding || {}
  const {
    welcome_message = '',
    background_type = 'gradient',
    background_image = '',
    text_color = 'light',
    unsplash_photographer_name = '',
    unsplash_photographer_url = '',
    unsplash_photo_url = '',
  } = authBranding
  const UNSPLASH_UTM = '?utm_source=LearnHouse&utm_medium=referral'
  const withUtm = (url: string) => (url ? `${url}${UNSPLASH_UTM}` : '')

  const getBackgroundStyle = (): React.CSSProperties => {
    if (background_type === 'gradient' || !background_image) {
      // "Azul Nawar con fade": base #1D0084 + glows #0b6df0 + puntos blancos.
      return {
        backgroundColor: '#1D0084',
        backgroundImage:
          'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px), ' +
          'radial-gradient(circle 700px at 100% 0%, rgba(11,109,240,0.40) 0%, transparent 65%), ' +
          'radial-gradient(circle 600px at 0% 100%, rgba(11,109,240,0.18) 0%, transparent 65%)',
        backgroundSize: '28px 28px, auto, auto',
        backgroundRepeat: 'repeat, no-repeat, no-repeat',
      }
    }
    if (background_type === 'custom' && background_image) {
      return {
        backgroundImage: `url(${getOrgAuthBackgroundMediaDirectory(org?.org_uuid, background_image)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    if (background_type === 'unsplash' && background_image) {
      return {
        backgroundImage: `url(${background_image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    return {
      background: 'linear-gradient(041.61deg, #202020 7.15%, #000000 90.96%)',
    }
  }

  const displayMessage = welcome_message || welcomeText || ''
  const hasCustomBackground = background_type !== 'gradient' && background_image

  return (
    <div
      className="relative flex flex-col h-full w-full"
      style={getBackgroundStyle()}
    >
      {/* Overlay for custom backgrounds only */}
      {hasCustomBackground && (
        <div className="absolute inset-0 bg-black/30" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-10">
        {/* Content - vertically and horizontally centered */}
        <div className="flex-1 flex items-center justify-center">
          <div className={cn(
            "flex flex-col items-center text-center gap-6",
            text_color === 'light' ? "text-white" : "text-gray-900"
          )}>
            {/* Organization logo */}
            <Link prefetch href={getUriWithOrg(org?.slug, '/')}>
              <div className="w-24 h-24 rounded-2xl ring-1 ring-inset ring-white/10 bg-white flex items-center justify-center overflow-hidden">
                {/* Si los datos de la organización aún no han llegado, va
                    nuestro logo, no el de LearnHouse. */}
                <img
                  src={
                    org?.logo_image
                      ? getOrgLogoMediaDirectory(org.org_uuid, org.logo_image)
                      : BRAND_LOGO_URL
                  }
                  alt={org?.name || BRAND_NAME}
                  className="w-full h-full object-contain p-3"
                />
              </div>
            </Link>

            {/* Text content */}
            <div className="space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">{org?.name || BRAND_NAME}</h1>
              {displayMessage && (
                <p className={cn(
                  "text-lg max-w-sm leading-relaxed",
                  text_color === 'light' ? "text-white/70" : "text-gray-600"
                )}>
                  {displayMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom spacer for visual balance */}
        <div className="h-10" />

        {/* Unsplash attribution (required by Unsplash API guidelines) */}
        {background_type === 'unsplash' && background_image && unsplash_photographer_name && (
          <div className={cn(
            "absolute bottom-3 left-4 right-4 z-10 text-[11px] leading-tight",
            text_color === 'light' ? "text-white/70" : "text-gray-700"
          )}>
            Photo by{' '}
            <a
              href={withUtm(unsplash_photographer_url) || withUtm(unsplash_photo_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-100 opacity-90"
            >
              {unsplash_photographer_name}
            </a>
            {' '}on{' '}
            <a
              href={`https://unsplash.com/${UNSPLASH_UTM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-100 opacity-90"
            >
              Unsplash
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

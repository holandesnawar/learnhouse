'use client'
import React, { createContext, useContext, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ErrorUI from '@components/Objects/StyledElements/Error/Error'
import OrgUnavailable from '@components/Objects/StyledElements/Error/OrgUnavailable'

interface OrgContextValue {
  org: any
  isUserPartOfTheOrg: boolean
  orgslug: string
}

export const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  children,
  orgslug,
}: {
  children: React.ReactNode
  orgslug: string
}) {
  const session = useLHSession() as any
  const accessToken = session?.data?.tokens?.access_token

  // accessToken sits in the queryKey on purpose: when AuthContext refreshes a
  // stale token in the background (typical after the tab has been idle for >
  // 30 min), the new token flips the key and useQuery refetches with the
  // fresh auth instead of leaving the page stuck on the stale 401 error.
  const { data: org, error: orgError, isLoading, isFetching } = useQuery({
    queryKey: [...queryKeys.org.detail(orgslug), accessToken || 'anon'],
    queryFn: () => getOrganizationContextInfo(orgslug, {}, accessToken),
    staleTime: 5 * 60_000,
    enabled: !!orgslug && session.status !== 'loading',
    // Paciencia con la API dormida. Un contenedor que acaba de reiniciar
    // puede tardar 15-20 segundos en contestar la primera vez; con 2
    // reintentos de 1,5s nos rendíamos a los 3 segundos y el alumno veía la
    // pantalla de error aunque la escuela estuviera a punto de responder.
    // 5 intentos con espera creciente cubren ~25 segundos sin enseñar nada.
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
  })

  const isOrgActive = useMemo(() => (org?.config?.config?.active ?? org?.config?.config?.general?.enabled) !== false, [org])

  // Determine membership from session roles (available immediately, no extra API call).
  // Session roles contain ALL orgs the user belongs to — no pagination limit.
  const isUserPartOfTheOrg = useMemo(() => {
    if (session.status !== 'authenticated') return true
    if (!org?.id) return true // Don't show guest banner while org is loading

    // Check session roles
    const roles = session?.data?.roles
    if (roles && Array.isArray(roles)) {
      if (roles.some((r: any) => r.org?.id === org.id)) return true
    }

    // Superadmins are always part of every org
    if (session?.data?.user?.is_superadmin) return true

    return false
  }, [session?.data?.roles, session?.data?.user?.is_superadmin, org?.id, session.status])

  const contextValue = useMemo<OrgContextValue>(() => ({
    org,
    isUserPartOfTheOrg,
    orgslug,
  }), [org, isUserPartOfTheOrg, orgslug])

  // While a refetch is in flight (e.g. AuthContext just refreshed the token
  // and the new queryKey is fetching), don't blink the error UI — wait for
  // the refetch to settle.
  if (orgError && !isFetching && session.status !== 'loading') {
    // Aviso tranquilo y en nuestra marca: si la escuela no contesta casi
    // siempre es que está arrancando, no que algo se haya roto. Se recarga
    // sola (con tope, para no entrar en bucle).
    return <OrgUnavailable />
  }
  if (!isLoading && org && !isOrgActive) return <ErrorUI message='This organization is no longer active' />

  return <OrgContext.Provider value={contextValue}>{children}</OrgContext.Provider>
}

// Backward compatible hook - returns just the org object
export function useOrg() {
  const context = useContext(OrgContext)
  return context?.org ?? null
}

// New hook to get membership status
export function useOrgMembership() {
  const context = useContext(OrgContext)
  return {
    org: context?.org ?? null,
    isUserPartOfTheOrg: context?.isUserPartOfTheOrg ?? true,
    orgslug: context?.orgslug ?? '',
  }
}

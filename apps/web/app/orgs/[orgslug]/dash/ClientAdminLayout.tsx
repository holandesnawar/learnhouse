'use client';
import NawarSidebar from '@components/Dashboard/Menus/NawarSidebar';
import NawarMobileMenu from '@components/Dashboard/Menus/NawarMobileMenu';
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { SessionGate } from '@components/Contexts/LHSessionContext'
import { CommandPaletteProvider } from '@components/Dashboard/CommandPalette/CommandPaletteContext'
import React from 'react'
import { useMediaQuery } from 'usehooks-ts';

/**
 * El marco del panel.
 *
 * Fuera, a propósito: la barra de onboarding de LearnHouse (la lista de
 * "crea tu primer curso, invita a alguien…"), su modal de bienvenida, el
 * aviso de plan gratuito y la paleta de comandos. Eran de un producto para
 * quien monta cursos, no de una escuela en marcha, y daban al panel un aire
 * de "app de IA" que no es el nuestro. El provider de la paleta se queda
 * montado porque alguna pantalla lo usa como contexto; sin el disparador no
 * se ve.
 */
function ClientAdminLayout({
    children,
}: {
    children: React.ReactNode
    params: any
}) {
    const isMobile = useMediaQuery('(max-width: 1024px)')

    return (
        <SessionGate>
            <AdminAuthorization authorizationMode="page">
                <CommandPaletteProvider>
                    {isMobile && <NawarMobileMenu />}
                    <div className="flex flex-col lg:flex-row bg-[#F7F8FB] min-h-screen">
                        {!isMobile && <NawarSidebar />}
                        <div className="flex flex-col w-full relative isolate pb-24 lg:pb-0">
                            {children}
                        </div>
                    </div>
                </CommandPaletteProvider>
            </AdminAuthorization>
        </SessionGate>
    )
}

export default ClientAdminLayout

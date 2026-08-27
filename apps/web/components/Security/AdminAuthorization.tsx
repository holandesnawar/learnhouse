'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { useRouter } from 'next/navigation';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { getUriWithOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';

type AuthorizationProps = {
  children: React.ReactNode;
  authorizationMode: 'component' | 'page';
};

/**
 * El panel se protege ENTERO, no por lista de rutas.
 *
 * Antes había aquí una lista (`/dash/org`, `/dash/users`, `/dash/courses`) y
 * todo lo que no estuviera en ella entraba con solo estar identificado. O sea
 * que escribiendo `/dash/estadisticas` o `/dash/avisos` en la barra del
 * navegador se llegaba igual: esconder el enlace del menú no cierra la puerta.
 *
 * Ahora al panel entra quien puede entrar al panel y punto. Las secciones
 * nuevas nacen protegidas sin que nadie tenga que acordarse de apuntarlas.
 */

const AdminAuthorization: React.FC<AuthorizationProps> = ({ children, authorizationMode }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const router = useRouter();
  const { isAdmin, loading } = useAdminStatus() as any
  const [isAuthorized, setIsAuthorized] = useState(false);

  const isUserAuthenticated = useMemo(() => session.status === 'authenticated', [session.status]);

  const authorizeUser = useCallback(() => {
    if (loading) {
      return; // Wait until the admin status is determined
    }

    if (!isUserAuthenticated) {
      router.push(getUriWithOrg(org.slug, '/login'));
      return;
    }

    if (authorizationMode === 'page') {
      if (isAdmin) {
        setIsAuthorized(true);
      } else {
        // A la escuela, no a /dash: quien no puede entrar al panel tampoco
        // puede entrar a su portada, y mandarle ahí sería un bucle.
        setIsAuthorized(false);
        router.push(getUriWithOrg(org?.slug, '/'));
      }
    } else if (authorizationMode === 'component') {
      setIsAuthorized(isAdmin);
    }
  }, [loading, isUserAuthenticated, isAdmin, authorizationMode, router, org?.slug]);

  useEffect(() => {
    authorizeUser();
  }, [authorizeUser]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <PageLoading />
      </div>
    );
  }

  if (authorizationMode === 'page' && !isAuthorized) {
    return (
      <div className="flex justify-center items-center h-screen">
        <h1 className="text-2xl">You are not authorized to access this page</h1>
      </div>
    );
  }

  return <>{isAuthorized && children}</>;
};

export default AdminAuthorization;

'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { usePathname, useRouter } from 'next/navigation';
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
  const { isAdmin, isCloser, loading } = useAdminStatus() as any
  const pathname = usePathname() || ''
  // El closer entra al panel, pero SOLO a Estadísticas (Contactos y, si se
  // le abre, Números). Cualquier otra ruta del panel le manda allí. Es la
  // misma idea que "el panel se protege entero": la lista de lo que el
  // closer puede ver es de UNA ruta, y todo lo demás nace cerrado para él.
  const rutaDelCloser = pathname.includes('/dash/estadisticas')
  const [isAuthorized, setIsAuthorized] = useState(false);

  const isUserAuthenticated = useMemo(() => session.status === 'authenticated', [session.status]);
  // ⚠️ Esperar también a la escuela: `isAdmin` necesita su id, y si la
  // sesión llegaba antes que los datos de la escuela, se daba por hecho que
  // no eras administrador y te mandaba al inicio (pasaba con conexión lenta).
  const cargando = loading || (isUserAuthenticated && !org?.id)

  const authorizeUser = useCallback(() => {
    if (cargando) {
      return; // Wait until the admin status is determined
    }

    if (!isUserAuthenticated) {
      router.push(getUriWithOrg(org.slug, '/login'));
      return;
    }

    if (authorizationMode === 'page') {
      if (isAdmin || (isCloser && rutaDelCloser)) {
        setIsAuthorized(true);
      } else if (isCloser) {
        setIsAuthorized(false);
        router.push(getUriWithOrg(org?.slug, '/dash/estadisticas'));
      } else {
        // A la escuela, no a /dash: quien no puede entrar al panel tampoco
        // puede entrar a su portada, y mandarle ahí sería un bucle.
        setIsAuthorized(false);
        router.push(getUriWithOrg(org?.slug, '/'));
      }
    } else if (authorizationMode === 'component') {
      // Los menús del panel: el closer los ve (recortados a lo suyo).
      setIsAuthorized(isAdmin || isCloser);
    }
  }, [cargando, isUserAuthenticated, isAdmin, isCloser, rutaDelCloser, authorizationMode, router, org?.slug]);

  useEffect(() => {
    authorizeUser();
  }, [authorizeUser]);

  if (cargando) {
    return (
      <div className="flex justify-center items-center h-screen">
        <PageLoading />
      </div>
    );
  }

  if (authorizationMode === 'page' && !isAuthorized) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-[15px] text-gray-500">No tienes acceso a esta página.</p>
      </div>
    );
  }

  return <>{isAuthorized && children}</>;
};

export default AdminAuthorization;

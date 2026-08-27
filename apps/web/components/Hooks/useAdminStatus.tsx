import { useOrg } from '@components/Contexts/OrgContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useMemo } from 'react';

interface Role {
    org: { id: number; org_uuid: string };
    role: {
        id: number;
        role_uuid: string;
        rights?: {
            [key: string]: {
                [key: string]: boolean;
            };
        };
    };
}

interface Rights {
    courses: {
        action_create: boolean;
        action_read: boolean;
        action_read_own: boolean;
        action_update: boolean;
        action_update_own: boolean;
        action_delete: boolean;
        action_delete_own: boolean;
    };
    users: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    usergroups: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    collections: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    organizations: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    coursechapters: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    activities: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    roles: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    dashboard: {
        action_access: boolean;
    };
}

interface UseAdminStatusReturn {
    isAdmin: boolean | null;
    loading: boolean;
    userRoles: Role[];
    rights: Rights | null;
    /**
     * El rol de esta persona en la escuela (1 admin · 2 moderador ·
     * 3 instructor · 4 alumno · 5 profe). Null si aún no se sabe.
     */
    roleId: number | null;
    /**
     * Profe de Holandés Nawar. NO entra al panel de administración: trabaja
     * desde la plataforma normal, como un alumno más con permisos de moderar.
     */
    isProfe: boolean;
    /**
     * Quién atiende a los alumnos: administradores, moderadores y profes.
     *
     * Es distinto de `isAdmin`, y confundirlos es de donde salían los fallos:
     * `isAdmin` decide quién DIRIGE la escuela (panel, estadísticas, avisos,
     * usuarios, ajustes) y `isStaff` decide quién ATIENDE (moderar la
     * comunidad, la bandeja del equipo). Un profe es lo segundo y no lo
     * primero. Espejo de `STAFF_ROLE_IDS` en `src/security/rbac/constants.py`.
     */
    isStaff: boolean;
}

function extractRightsFromRoles(userRoles: Role[], orgId: number): Rights | null {
    if (!userRoles || userRoles.length === 0) return null;

    const orgRoles = userRoles.filter((role: Role) => role.org.id === orgId);
    if (orgRoles.length === 0) return null;

    const mergedRights: Rights = {
        courses: {
            action_create: false,
            action_read: false,
            action_read_own: false,
            action_update: false,
            action_update_own: false,
            action_delete: false,
            action_delete_own: false
        },
        users: {
            action_create: false,
            action_read: false,
            action_update: false,
            action_delete: false
        },
        usergroups: {
            action_create: false,
            action_read: false,
            action_update: false,
            action_delete: false
        },
        collections: {
            action_create: false,
            action_read: false,
            action_update: false,
            action_delete: false
        },
        organizations: {
            action_create: false,
            action_read: false,
            action_update: false,
            action_delete: false
        },
        coursechapters: {
            action_create: false,
            action_read: false,
            action_update: false,
            action_delete: false
        },
        activities: {
            action_create: false,
            action_read: false,
            action_update: false,
            action_delete: false
        },
        roles: {
            action_create: false,
            action_read: false,
            action_update: false,
            action_delete: false
        },
        dashboard: {
            action_access: false
        }
    };

    orgRoles.forEach((role: Role) => {
        if (role.role.rights) {
            Object.keys(role.role.rights).forEach((resourceType) => {
                if (mergedRights[resourceType as keyof Rights]) {
                    Object.keys(role.role.rights![resourceType]).forEach((action) => {
                        if (role.role.rights![resourceType][action] === true) {
                            (mergedRights[resourceType as keyof Rights] as any)[action] = true;
                        }
                    });
                }
            });
        }
    });

    return mergedRights;
}

/** El rol "Profe" de la escuela (ver `src/security/rbac/constants.py`). */
export const PROFE_ROLE_ID = 5;
/** Administrador (1) · Moderador (2) · Profe (5): los que atienden alumnos. */
const STAFF_ROLE_IDS = [1, 2, PROFE_ROLE_ID];

// Full-access rights object for superadmins
const SUPERADMIN_RIGHTS: Rights = {
    courses: { action_create: true, action_read: true, action_read_own: true, action_update: true, action_update_own: true, action_delete: true, action_delete_own: true },
    users: { action_create: true, action_read: true, action_update: true, action_delete: true },
    usergroups: { action_create: true, action_read: true, action_update: true, action_delete: true },
    collections: { action_create: true, action_read: true, action_update: true, action_delete: true },
    organizations: { action_create: true, action_read: true, action_update: true, action_delete: true },
    coursechapters: { action_create: true, action_read: true, action_update: true, action_delete: true },
    activities: { action_create: true, action_read: true, action_update: true, action_delete: true },
    roles: { action_create: true, action_read: true, action_update: true, action_delete: true },
    dashboard: { action_access: true },
};

function useAdminStatus(): UseAdminStatusReturn {
    const session = useLHSession() as any;
    const org = useOrg() as any;

    const roles = session.data?.roles;
    const userRoles: Role[] = useMemo(() => roles || [], [roles]);
    const orgId = org?.id;
    const isAuthenticated = session.status === 'authenticated';
    const isSuperadmin = session.data?.user?.is_superadmin === true;

    const rights = useMemo(
        () => {
            if (!isAuthenticated || !orgId) return null;
            // Superadmins get full access to all orgs without needing a role entry
            if (isSuperadmin) return SUPERADMIN_RIGHTS;
            return extractRightsFromRoles(userRoles, orgId);
        },
        [isAuthenticated, userRoles, orgId, isSuperadmin]
    );

    const roleId = useMemo(() => {
        if (!isAuthenticated || !orgId) return null;
        const mine = userRoles.find((role: Role) => role.org.id === orgId);
        return mine?.role?.id ?? null;
    }, [isAuthenticated, orgId, userRoles]);

    // Un superadministrador nunca es profe, aunque le metan en el grupo.
    const isProfe = useMemo(
        () => !isSuperadmin && roleId === PROFE_ROLE_ID,
        [isSuperadmin, roleId]
    );

    const isStaff = useMemo(
        () => isAuthenticated && !!orgId && (isSuperadmin || (roleId !== null && STAFF_ROLE_IDS.includes(roleId))),
        [isAuthenticated, orgId, isSuperadmin, roleId]
    );

    // El profe NO entra al panel.
    //
    // El rol se creó con `dashboard.action_access: true` pensando en "que entre
    // pero solo vea lo suyo", y eso no se sostuvo: cada sección nueva del panel
    // nacía visible para él salvo que alguien se acordara de esconderla, así que
    // acabó viendo estadísticas, avisos, automatizaciones y la lista de usuarios
    // con los roles dentro. Un profe no dirige la escuela: trabaja desde la
    // plataforma normal, donde tiene todo lo que necesita.
    //
    // Se corta aquí y no en el rol porque el rol ya existe creado en producción
    // y `setup.py` solo siembra los que faltan: cambiarlo allí no habría tenido
    // ningún efecto sobre la escuela que ya está en marcha.
    const isAdmin = useMemo(
        () => (isAuthenticated && orgId ? isSuperadmin || (rights?.dashboard?.action_access === true && !isProfe) : false),
        [isAuthenticated, orgId, isSuperadmin, rights, isProfe]
    );

    const loading = !isAuthenticated && session.status !== 'unauthenticated';

    return { isAdmin, loading, userRoles, rights, roleId, isProfe, isStaff };
}

export default useAdminStatus;


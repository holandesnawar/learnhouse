import {
  House,
  Lightning,
  BookOpen,
  ChartBar,
  Files,
  Users,
  CurrencyCircleDollar,
  Buildings,
  ChatsCircle,
  ChalkboardSimple,
  Cube,
  Kanban,
} from '@phosphor-icons/react'

export interface DashboardMenuItem {
  id: string
  href: string
  icon: typeof House
  labelKey: string
  /** Texto fijo, si no hay traducción para él (p. ej. «Matrículas»). */
  label?: string
  /** Feature key used for plan-based gating. If undefined, item is always shown. */
  featureKey?: string
  /** If true, the feature defaults to disabled (must be explicitly enabled). */
  defaultDisabled?: boolean
  /**
   * ¿Lo ve también un profe? Por defecto NO: el panel es de administradores y
   * el profe solo entra a lo suyo (alumnos y comunidad).
   */
  forProfe?: boolean
}

export const DASHBOARD_MENU_ITEMS: DashboardMenuItem[] = [
  {
    id: 'home',
    forProfe: true,
    href: '/dash',
    icon: House,
    labelKey: 'common.home',
  },
  {
    id: 'courses',
    href: '/dash/courses',
    icon: BookOpen,
    labelKey: 'courses.courses',
  },
  {
    id: 'assignments',
    href: '/dash/assignments',
    icon: Files,
    labelKey: 'common.assignments',
  },
  {
    id: 'communities',
    forProfe: true,
    href: '/dash/communities',
    icon: ChatsCircle,
    labelKey: 'communities.title',
    featureKey: 'communities',
  },
  {
    id: 'boards',
    href: '/dash/boards',
    icon: ChalkboardSimple,
    labelKey: 'common.boards',
    featureKey: 'boards',
    defaultDisabled: true,
  },
  {
    id: 'playgrounds',
    href: '/dash/playgrounds',
    icon: Cube,
    labelKey: 'common.playgrounds',
    featureKey: 'playgrounds',
    defaultDisabled: true,
  },
  {
    id: 'estadisticas',
    href: '/dash/estadisticas',
    icon: ChartBar,
    labelKey: 'common.statistics',
  },
  {
    id: 'workflows',
    href: '/dash/workflows',
    icon: Lightning,
    labelKey: 'common.automations',
  },
  {
    id: 'users',
    forProfe: true,
    href: '/dash/users/settings/users',
    icon: Users,
    labelKey: 'common.users',
  },
  {
    id: 'payments',
    href: '/dash/payments/overview',
    icon: CurrencyCircleDollar,
    labelKey: 'common.payments',
    featureKey: 'payments',
  },
  {
    id: 'organization',
    href: '/dash/org/settings/general',
    icon: Buildings,
    labelKey: 'common.organization',
  },
]

/**
 * Lo que sale en «Panel de control» de la barra de la ESCUELA (OrgSidebar) a
 * un administrador. Pedido del usuario (06/10/2026): "quítame tantas cosas que
 * no sirven, déjalo en estadísticas, matrículas, usuarios y cursos". El resto
 * sigue en el propio panel (su barra, `NawarSidebar`), no se ha quitado nada.
 */
export const PANEL_EN_LA_ESCUELA: DashboardMenuItem[] = [
  { id: 'estadisticas', href: '/dash/estadisticas', icon: ChartBar, labelKey: 'common.statistics' },
  { id: 'matriculas', href: '/dash/estadisticas?tab=matriculas', icon: Kanban, labelKey: '', label: 'Matrículas' },
  { id: 'users', href: '/dash/users/settings/users', icon: Users, labelKey: 'common.users' },
  { id: 'courses', href: '/dash/courses', icon: BookOpen, labelKey: 'courses.courses' },
]

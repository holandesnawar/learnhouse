/**
 * El color de cada columna del tablero de Matrículas, solo en el punto junto
 * al nombre y en tonos apagados (28/09/2026: las franjas de color "se veían
 * algo IA"). Lo usan el tablero (`KanbanPanel`) y el inicio del panel, para
 * que la misma columna lleve el mismo color en los dos sitios.
 */
export const COLOR_COLUMNA: Record<string, string> = {
  'por-asignar': '#64748B',
  nuevo: '#5B8DEF',
  llamar: '#E07AA8',
  'no-contesta': '#8FA03C',
  contactado: '#9B87F5',
  agendado: '#D4A24C',
  seguimiento: '#3E9BB0',
  'pendiente-pago': '#D9826A',
  'no-show': '#9A5296',
  descartado: '#B4413C',
  alumno: '#2BA67A',
}

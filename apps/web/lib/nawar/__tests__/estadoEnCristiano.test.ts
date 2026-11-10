import { describe, expect, test } from 'bun:test'
import { aQuien, accionConVerbo, accionDe, haceTanto, paginaDe, tiempo, veces } from '../estadoEnCristiano'

describe('Estado de la escuela, en cristiano', () => {
  test('cada ruta dice qué es', () => {
    expect(accionDe('/api/v1/student/insights')).toBe('El Inicio y «Mi progreso» del alumno')
    expect(accionDe('/api/v1/tareas/course/{course_uuid}/semanas')).toBe('Las semanas de una clase en directo')
    expect(accionDe('/api/v1/tareas/semana/{tarea_id}/lista')).toBe('Una semana de una clase en directo')
    expect(accionDe('/api/v1/community-engagement/notifications')).toBe('La campana de avisos')
    expect(accionDe('/api/v1/payments/webhook')).toBe('El aviso de Stripe de un pago')
    expect(accionDe('/api/v1/panel/org/{org_id}/tablero')).toBe('Panel: matrículas, alumnos y tareas')
  })

  test('una ruta que no se conoce sale tal cual, sin el prefijo', () => {
    expect(accionDe('/api/v1/algo/nuevo/{id}')).toBe('/algo/nuevo/{id}')
    expect(accionDe('')).toBe('(sin ruta)')
  })

  test('el verbo según lo que se hacía', () => {
    expect(accionConVerbo('GET', '/api/v1/salas/course/{course_uuid}')).toBe('Al abrir: Las salas en directo')
    expect(accionConVerbo('POST', '/api/v1/messages/send')).toBe('Al guardar o enviar: Mensajes con el equipo')
    expect(accionConVerbo('', '/api/v1/health')).toBe('La comprobación de salud')
  })

  test('las pantallas por su dirección, con o sin /orgs/<escuela>', () => {
    expect(paginaDe('/')).toBe('El Inicio')
    expect(paginaDe('/orgs/holandesrida')).toBe('El Inicio')
    expect(paginaDe('/course/{id}/activity/{id}')).toBe('Una lección o clase')
    expect(paginaDe('/orgs/holandesrida/course/{id}')).toBe('La página de un curso')
    expect(paginaDe('/dash/estadisticas')).toBe('El panel')
    expect(paginaDe('/auth/crear-cuenta')).toBe('Crear la contraseña tras pagar')
    expect(paginaDe('/algo-raro')).toBe('/algo-raro')
  })

  test('tiempos, veces y personas', () => {
    expect(tiempo(320)).toBe('320 ms')
    expect(tiempo(1840)).toBe('1,8 s')
    expect(tiempo(0)).toBe('0 ms')
    expect(veces(1)).toBe('1 vez')
    expect(veces(3)).toBe('3 veces')
    expect(aQuien(2, 0)).toBe('a 2 personas')
    expect(aQuien(1, 3)).toBe('a 1 persona y a gente sin sesión')
    expect(aQuien(0, 3)).toBe('a gente sin sesión')
    expect(aQuien(0, 0)).toBe('')
    expect(haceTanto(90061)).toBe('1 día y 1 h')
    expect(haceTanto(3700)).toBe('1 h y 1 min')
    expect(haceTanto(20)).toBe('1 min')
  })
})

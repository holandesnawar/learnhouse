import { describe, expect, test } from 'bun:test'
import { colocarTarjeta, pasosDeLaVisita, tipoDeClase, yaLaVio, VERSION_VISITA } from '../visitaGuiada'

describe('visita guiada', () => {
  test('cada alumno ve solo sus clases', () => {
    const beta = pasosDeLaVisita({ clases: [{ uuid: 'a', nombre: 'Clase semanal' }] })
    expect(beta.map((p) => p.id)).toEqual(['hola', 'empieza', 'formacion', 'clase-semanal', 'comunidad', 'ayuda', 'perfil', 'color'])
    expect(beta.find((p) => p.id === 'clase-semanal')!.titulo).toBe('Tu clase semanal')

    const nuevo = pasosDeLaVisita({
      clases: [
        { uuid: 's', nombre: 'Spreken Club' },
        { uuid: 'm', nombre: 'Masterclass' },
      ],
    })
    const ids = nuevo.map((p) => p.id)
    expect(ids).toContain('clase-masterclass')
    expect(ids).toContain('clase-conversacion')
    expect(ids).not.toContain('clase-semanal')
    // La masterclass va antes que la conversación, venga como venga.
    expect(ids.indexOf('clase-masterclass')).toBeLessThan(ids.indexOf('clase-conversacion'))
    expect(nuevo.find((p) => p.id === 'clase-conversacion')!.objetivo[0]).toBe('clase-s')
  })

  test('dos copias de la clase semanal: un solo paso', () => {
    const p = pasosDeLaVisita({ clases: [{ uuid: 'r', nombre: 'Clase semanal' }, { uuid: 'b', nombre: 'Clase semanal' }] })
    expect(p.filter((x) => x.id === 'clase-semanal')).toHaveLength(1)
  })

  test('sin clases no habla de clases', () => {
    expect(pasosDeLaVisita({}).some((p) => p.id.startsWith('clase-'))).toBe(false)
  })

  test('saludo con nombre, distinto para nuevos y de antes', () => {
    const a = pasosDeLaVisita({ nombre: 'Marta', nuevo: true })[0]
    const b = pasosDeLaVisita({ nombre: 'Marta' })[0]
    expect(a.titulo).toContain('Marta')
    expect(a.texto).not.toBe(b.texto)
    expect(b.texto).toContain('renovado')
  })

  test('tipos de clase', () => {
    expect(tipoDeClase('Spreekclub')).toBe('conversacion')
    expect(tipoDeClase('Masterclass Nawar')).toBe('masterclass')
    expect(tipoDeClase('Clase semanal')).toBe('semanal')
  })

  test('ya la vio', () => {
    expect(yaLaVio(null)).toBe(false)
    expect(yaLaVio({ welcomed: true })).toBe(false)
    expect(yaLaVio({ visita: VERSION_VISITA })).toBe(true)
  })

  test('la tarjeta nunca se sale de la pantalla', () => {
    const pantalla = { ancho: 1280, alto: 800 }
    const t = { ancho: 340, alto: 220 }
    // Junto a la barra lateral: a la derecha.
    const a = colocarTarjeta({ top: 300, left: 12, width: 236, height: 40 }, pantalla, t)
    expect(a.left).toBe(12 + 236 + 16)
    // El perfil, arriba a la derecha: debajo y dentro.
    const b = colocarTarjeta({ top: 10, left: 1220, width: 40, height: 36 }, pantalla, t)
    expect(b.top).toBe(10 + 36 + 16)
    expect(b.left + t.ancho).toBeLessThanOrEqual(pantalla.ancho - 16)
    // Abajo del todo: se sube para caber.
    const c = colocarTarjeta({ top: 780, left: 12, width: 236, height: 40 }, pantalla, t)
    expect(c.top + t.alto).toBeLessThanOrEqual(pantalla.alto - 16)
    // Sin nada que iluminar: en el centro.
    const d = colocarTarjeta(null, pantalla, t)
    expect(d.left).toBe((1280 - 340) / 2)
  })
})

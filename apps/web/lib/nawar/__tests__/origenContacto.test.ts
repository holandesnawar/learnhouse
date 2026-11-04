import { describe, expect, test } from 'bun:test'
import { campanaDe, iniciales, nombreCampana, origenDe } from '../origenContacto'

describe('origenDe', () => {
  test('un anuncio gana a todo', () => {
    expect(origenDe({ canal: { canal: 'ads', detalle: 'Meta · VSL A' } })).toEqual({ id: 'anuncios', detalle: 'Meta · VSL A' })
    expect(origenDe({ canal: { canal: 'ads', detalle: '' } }).detalle).toBe('Anuncio')
  })
  test('Instagram, setters y otras redes van juntos', () => {
    expect(origenDe({ canal: { canal: 'organico', detalle: 'Instagram · historias' } }).id).toBe('redes')
    expect(origenDe({ canal: { canal: 'organico', detalle: 'Setter · Laura' } }).id).toBe('redes')
    expect(origenDe({ canal: { canal: 'organico', detalle: 'TikTok' } }).id).toBe('redes')
    expect(origenDe({ canal: { canal: 'organico', detalle: '' }, primer_contacto: { kind: 'instagram' } }).id).toBe('redes')
  })
  test('guías, web, correo y lo demás', () => {
    expect(origenDe({ canal: { canal: 'organico', detalle: 'Guía' } }).id).toBe('guias')
    expect(origenDe({ canal: { canal: 'organico', detalle: '' }, pasos: ['guia-bases'] }).id).toBe('guias')
    expect(origenDe({ canal: { canal: 'organico', detalle: 'Web · inicio' } }).id).toBe('web')
    expect(origenDe({ canal: { canal: 'organico', detalle: 'Black Friday' } }).id).toBe('web')
    expect(origenDe({ canal: { canal: 'organico', detalle: 'Correo' } }).id).toBe('correo')
    expect(origenDe({ canal: { canal: 'organico', detalle: 'Google' } })).toEqual({ id: 'otros', detalle: 'Google' })
    expect(origenDe({})).toEqual({ id: 'otros', detalle: 'Sin saber' })
    // Bajó una guía viniendo de Google: manda Google.
    expect(origenDe({ canal: { canal: 'organico', detalle: 'Google' }, pasos: ['guia-bases'] }).id).toBe('otros')
  })
})

describe('campañas', () => {
  test('la de su enlace o Black Friday si pasó por sus páginas', () => {
    expect(campanaDe({ utm_campaign: 'VSL-Matricula-Oct26' })).toBe('vsl-matricula-oct26')
    expect(campanaDe({ utm_campaign: '{{campaign.name}}', pasos: ['bf-ebook'] })).toBe('black-friday')
    expect(campanaDe({})).toBe('')
  })
  test('el nombre se lee', () => {
    expect(nombreCampana('black-friday')).toBe('Black Friday')
    expect(nombreCampana('bases-sept')).toBe('Bases sept')
  })
})

test('iniciales', () => {
  expect(iniciales('Ana Ruiz López', 'a@x.com')).toBe('AR')
  expect(iniciales('Paloma', 'p@x.com')).toBe('PA')
  expect(iniciales('', 'zoe@x.com')).toBe('ZO')
})

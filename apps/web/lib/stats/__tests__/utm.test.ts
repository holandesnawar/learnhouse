import { describe, expect, it } from 'bun:test'
import { baseSinUtm, buildUtmUrl, euros } from '@services/stats/school'

describe('buildUtmUrl', () => {
  it('añade los parámetros a un enlace limpio', () => {
    expect(
      buildUtmUrl({
        url: 'https://www.holandesnawar.com/',
        source: 'email',
        medium: 'newsletter',
        campaign: 'lanzamiento',
        content: '',
      })
    ).toBe(
      'https://www.holandesnawar.com/?utm_source=email&utm_medium=newsletter&utm_campaign=lanzamiento'
    )
  })

  it('usa & cuando el enlace ya trae parámetros', () => {
    expect(
      buildUtmUrl({ url: 'https://x.com/p?ref=1', source: 'ig', medium: '', campaign: '', content: '' })
    ).toBe('https://x.com/p?ref=1&utm_source=ig')
  })

  it('deja el ancla al final, que si no deja de funcionar', () => {
    expect(
      buildUtmUrl({ url: 'https://x.com/p#precio', source: 'ig', medium: '', campaign: '', content: '' })
    ).toBe('https://x.com/p?utm_source=ig#precio')
  })

  it('escapa los espacios y acentos de la campaña', () => {
    expect(
      buildUtmUrl({ url: 'https://x.com/', source: '', medium: '', campaign: 'cohorte fundadora', content: '' })
    ).toBe('https://x.com/?utm_campaign=cohorte%20fundadora')
  })

  it('sin parámetros devuelve el enlace tal cual, y sin enlace no inventa nada', () => {
    expect(buildUtmUrl({ url: 'https://x.com/', source: '', medium: '', campaign: '', content: '' })).toBe(
      'https://x.com/'
    )
    expect(buildUtmUrl({ url: '  ', source: 'ig', medium: '', campaign: '', content: '' })).toBe('')
  })
})

describe('euros', () => {
  it('enseña los importes en euros', () => {
    expect(euros(39700).replace(/ /g, ' ')).toBe('397 €')
    expect(euros(39750).replace(/ /g, ' ')).toBe('397,50 €')
    expect(euros(0).replace(/ /g, ' ')).toBe('0 €')
    expect(euros(null).replace(/ /g, ' ')).toBe('0 €')
  })
})

describe('baseSinUtm — hace posible editar un enlace ya guardado', () => {
  it('quita los utm_ y deja los demás parámetros', () => {
    expect(
      baseSinUtm('https://x.com/p?ref=1&utm_source=email&utm_campaign=sept&otro=2')
    ).toBe('https://x.com/p?ref=1&otro=2')
  })

  it('si solo llevaba utm_, se queda la dirección pelada', () => {
    expect(baseSinUtm('https://x.com/p?utm_source=email&utm_medium=news')).toBe('https://x.com/p')
  })

  it('respeta el ancla', () => {
    expect(baseSinUtm('https://x.com/p?utm_source=ig#precio')).toBe('https://x.com/p#precio')
  })

  it('un enlace sin parámetros no se toca', () => {
    expect(baseSinUtm('https://x.com/p')).toBe('https://x.com/p')
  })

  it('editar dos veces NO acumula parámetros', () => {
    const uno = buildUtmUrl({
      url: 'https://x.com/p',
      source: 'email',
      medium: '',
      campaign: 'sept',
      content: '',
    })
    // Segunda vuelta: se edita partiendo del enlace ya montado.
    const dos = buildUtmUrl({
      url: uno,
      source: 'instagram',
      medium: '',
      campaign: 'sept',
      content: '',
    })
    expect(dos).toBe('https://x.com/p?utm_source=instagram&utm_campaign=sept')
  })
})

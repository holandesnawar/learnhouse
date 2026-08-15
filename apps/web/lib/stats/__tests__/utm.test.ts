import { describe, expect, it } from 'bun:test'
import { buildUtmUrl, euros } from '@services/stats/school'

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

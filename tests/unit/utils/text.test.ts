import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatGold,
  formatHpMp,
  formatPercent,
  formatElementName,
  formatStatName,
  truncate,
  padStart,
} from '../../../src/utils/text'

describe('formatNumber', () => {
  it('formats small numbers as-is', () => {
    expect(formatNumber(42)).toBe('42')
    expect(formatNumber(999)).toBe('999')
  })

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K')
    expect(formatNumber(2500)).toBe('2.5K')
  })

  it('formats millions with M suffix', () => {
    expect(formatNumber(1000000)).toBe('1.0M')
    expect(formatNumber(1500000)).toBe('1.5M')
  })
})

describe('formatGold', () => {
  it('appends G suffix', () => {
    expect(formatGold(100)).toBe('100G')
    expect(formatGold(2500)).toBe('2.5KG')
  })
})

describe('formatHpMp', () => {
  it('formats as current/max', () => {
    expect(formatHpMp(75, 100)).toBe('75/100')
    expect(formatHpMp(0, 50)).toBe('0/50')
  })
})

describe('formatPercent', () => {
  it('rounds and adds % symbol', () => {
    expect(formatPercent(75.6)).toBe('76%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(100)).toBe('100%')
  })
})

describe('formatElementName', () => {
  it('capitalizes first letter', () => {
    expect(formatElementName('fire')).toBe('Fire')
    expect(formatElementName('water')).toBe('Water')
    expect(formatElementName('neutral')).toBe('Neutral')
  })
})

describe('formatStatName', () => {
  it('maps stat keys to abbreviations', () => {
    expect(formatStatName('maxHp')).toBe('HP')
    expect(formatStatName('attack')).toBe('ATK')
    expect(formatStatName('defense')).toBe('DEF')
    expect(formatStatName('magicAttack')).toBe('M.ATK')
    expect(formatStatName('magicDefense')).toBe('M.DEF')
    expect(formatStatName('speed')).toBe('SPD')
    expect(formatStatName('luck')).toBe('LCK')
  })

  it('returns raw key for unknown stats', () => {
    expect(formatStatName('unknown')).toBe('unknown')
  })
})

describe('truncate', () => {
  it('returns short text unchanged', () => {
    expect(truncate('Hello', 10)).toBe('Hello')
  })

  it('truncates and adds ellipsis', () => {
    expect(truncate('Hello World!', 8)).toBe('Hello...')
  })

  it('handles exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello')
  })
})

describe('padStart', () => {
  it('pads strings to target length', () => {
    expect(padStart('5', 3, '0')).toBe('005')
    expect(padStart(5, 3, '0')).toBe('005')
  })

  it('does not truncate longer values', () => {
    expect(padStart('1234', 3, '0')).toBe('1234')
  })
})

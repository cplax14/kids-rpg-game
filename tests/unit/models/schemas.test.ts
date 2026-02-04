import { describe, it, expect } from 'vitest'
import {
  CharacterStatsSchema,
  MonsterSpeciesSchema,
  ItemSchema,
  EquipmentSchema,
  GameSettingsSchema,
  PositionSchema,
  AbilitySchema,
  MonsterElementSchema,
  MonsterRaritySchema,
} from '../../../src/models/schemas'

describe('PositionSchema', () => {
  it('accepts valid position', () => {
    const result = PositionSchema.safeParse({ x: 10, y: 20 })
    expect(result.success).toBe(true)
  })

  it('rejects missing fields', () => {
    const result = PositionSchema.safeParse({ x: 10 })
    expect(result.success).toBe(false)
  })
})

describe('MonsterElementSchema', () => {
  it('accepts valid elements', () => {
    const elements = ['fire', 'water', 'earth', 'wind', 'light', 'dark', 'neutral']
    elements.forEach((el) => {
      expect(MonsterElementSchema.safeParse(el).success).toBe(true)
    })
  })

  it('rejects invalid elements', () => {
    expect(MonsterElementSchema.safeParse('ice').success).toBe(false)
    expect(MonsterElementSchema.safeParse('').success).toBe(false)
  })
})

describe('MonsterRaritySchema', () => {
  it('accepts valid rarities', () => {
    const rarities = ['common', 'uncommon', 'rare', 'legendary']
    rarities.forEach((r) => {
      expect(MonsterRaritySchema.safeParse(r).success).toBe(true)
    })
  })

  it('rejects invalid rarities', () => {
    expect(MonsterRaritySchema.safeParse('epic').success).toBe(false)
  })
})

describe('CharacterStatsSchema', () => {
  const validStats = {
    maxHp: 100,
    currentHp: 80,
    maxMp: 50,
    currentMp: 30,
    attack: 25,
    defense: 20,
    magicAttack: 15,
    magicDefense: 18,
    speed: 12,
    luck: 8,
  }

  it('accepts valid stats', () => {
    const result = CharacterStatsSchema.safeParse(validStats)
    expect(result.success).toBe(true)
  })

  it('rejects negative HP', () => {
    const result = CharacterStatsSchema.safeParse({ ...validStats, maxHp: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer values', () => {
    const result = CharacterStatsSchema.safeParse({ ...validStats, attack: 25.5 })
    expect(result.success).toBe(false)
  })

  it('allows currentHp of 0', () => {
    const result = CharacterStatsSchema.safeParse({ ...validStats, currentHp: 0 })
    expect(result.success).toBe(true)
  })
})

describe('ItemSchema', () => {
  const validItem = {
    itemId: 'potion-01',
    name: 'Health Potion',
    description: 'Restores 50 HP',
    category: 'consumable',
    iconKey: 'icon-potion',
    stackable: true,
    maxStack: 99,
    useEffect: {
      type: 'heal_hp',
      magnitude: 50,
      targetType: 'single_ally',
    },
    buyPrice: 100,
    sellPrice: 50,
  }

  it('accepts valid item', () => {
    const result = ItemSchema.safeParse(validItem)
    expect(result.success).toBe(true)
  })

  it('accepts item with null useEffect', () => {
    const result = ItemSchema.safeParse({ ...validItem, useEffect: null })
    expect(result.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const result = ItemSchema.safeParse({ ...validItem, category: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = ItemSchema.safeParse({ ...validItem, name: '' })
    expect(result.success).toBe(false)
  })
})

describe('EquipmentSchema', () => {
  const validEquipment = {
    equipmentId: 'sword-01',
    name: 'Iron Sword',
    description: 'A basic iron sword',
    slot: 'weapon',
    statModifiers: { attack: 10 },
    levelRequirement: 1,
    iconKey: 'icon-sword',
    buyPrice: 200,
    sellPrice: 100,
    specialEffect: null,
  }

  it('accepts valid equipment', () => {
    const result = EquipmentSchema.safeParse(validEquipment)
    expect(result.success).toBe(true)
  })

  it('accepts partial stat modifiers', () => {
    const result = EquipmentSchema.safeParse({
      ...validEquipment,
      statModifiers: { attack: 5, speed: 3 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid slot', () => {
    const result = EquipmentSchema.safeParse({ ...validEquipment, slot: 'ring' })
    expect(result.success).toBe(false)
  })
})

describe('GameSettingsSchema', () => {
  it('accepts valid settings', () => {
    const result = GameSettingsSchema.safeParse({
      musicVolume: 0.8,
      sfxVolume: 0.6,
      textSpeed: 'normal',
      screenShake: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects volume out of range', () => {
    const result = GameSettingsSchema.safeParse({
      musicVolume: 1.5,
      sfxVolume: 0.6,
      textSpeed: 'normal',
      screenShake: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid text speed', () => {
    const result = GameSettingsSchema.safeParse({
      musicVolume: 0.5,
      sfxVolume: 0.5,
      textSpeed: 'instant',
      screenShake: true,
    })
    expect(result.success).toBe(false)
  })
})

describe('AbilitySchema', () => {
  const validAbility = {
    abilityId: 'fireball',
    name: 'Fireball',
    description: 'Hurls a ball of fire at the enemy',
    element: 'fire',
    type: 'magical',
    power: 65,
    accuracy: 90,
    mpCost: 8,
    targetType: 'single_enemy',
    statusEffect: null,
    animation: 'fireball-anim',
  }

  it('accepts valid ability', () => {
    const result = AbilitySchema.safeParse(validAbility)
    expect(result.success).toBe(true)
  })

  it('accepts ability with status effect', () => {
    const result = AbilitySchema.safeParse({
      ...validAbility,
      statusEffect: {
        id: 'burn',
        name: 'Burn',
        type: 'poison',
        duration: 3,
        magnitude: 10,
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects accuracy over 100', () => {
    const result = AbilitySchema.safeParse({ ...validAbility, accuracy: 150 })
    expect(result.success).toBe(false)
  })
})

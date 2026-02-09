# Monster Progression & Breeding Enhancement Plan

## Summary

Implement a comprehensive monster progression system where squad monsters gain XP from battles, and make breeding the primary path to creating powerful late-game monsters. This includes XP distribution, enhanced breeding bonuses, level-based evolution, and progressive disclosure of breeding benefits.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| XP Distribution | Even split among active squad + 10% to bench | Encourages smaller active teams for faster leveling, bench still progresses |
| Breeding Power | Significantly stronger than wild monsters | Makes breeding the endgame goal, not grinding |
| Evolution | Level-based only | Keep simple; breeding is the main power mechanism |
| Benefit Discovery | Progressive disclosure via NPC | Helps kids discover features naturally |

---

## Architecture Overview

```
Battle End
    └── CombatSystem.calculateBattleRewards()
            └── XP split among active squad (even distribution)
            └── 10% XP to all bench monsters
            └── MonsterSystem.addExperienceToMonster() for each

Breeding
    └── BreedingSystem.breed()
            └── Calculate generation tier (G1, G2, G3...)
            └── Inherit stats from parents (% of trained stats)
            └── Inherit/stack traits (more slots for bred)
            └── Check for legacy ability inheritance
            └── Roll for "perfect" offspring chance

Evolution
    └── MonsterSystem.checkEvolution()
            └── Level threshold check
            └── Trigger evolution if met
            └── Update species, recalculate stats
```

---

## Phase 1: XP Distribution System

### Goal
Make squad monsters gain experience from battles with meaningful distribution mechanics.

### Changes

#### 1.1 Update CombatSystem.ts
- Modify `calculateBattleRewards()` to return XP intended for monsters
- Add helper: `distributeMonsterXP(totalXP, activeSquad, benchMonsters)`

#### 1.2 Update WorldScene.ts
- Modify `applyBattleRewards()` to distribute XP to monsters
- Call `MonsterSystem.addExperienceToMonster()` for each monster

#### 1.3 XP Distribution Logic
```typescript
// Active squad: even split
const activeXP = Math.floor(totalXP / activeSquadSize)
activeSquad.forEach(monster => addExperienceToMonster(monster, activeXP))

// Bench monsters: 10% of total
const benchXP = Math.floor(totalXP * 0.1)
benchMonsters.forEach(monster => addExperienceToMonster(monster, benchXP))
```

#### 1.4 Add Level-Up Notification
- Create UI feedback when monsters level up after battle
- Show in BattleScene victory sequence or WorldScene post-battle

### Files to Modify
| File | Changes |
|------|---------|
| `src/systems/CombatSystem.ts` | Add monster XP distribution logic |
| `src/scenes/WorldScene.ts` | Apply XP to squad in `applyBattleRewards()` |
| `src/scenes/BattleScene.ts` | Show monster level-up notifications |
| `src/systems/MonsterSystem.ts` | Ensure `addExperienceToMonster` handles multiple level-ups |

### New Files
| File | Purpose |
|------|---------|
| `src/ui/components/LevelUpNotification.ts` | Visual feedback for monster level-ups |

---

## Phase 2: Enhanced Breeding - Stat Inheritance

### Goal
Bred monsters inherit a percentage of their parents' trained stats, making high-level parents valuable.

### Changes

#### 2.1 Add Inherited Stat Bonus
- Calculate "trained stats" = current stats - base stats at level 1
- Offspring inherits 20% of average parent trained stats
- This bonus is permanent and added to offspring's base

#### 2.2 Update BreedingSystem.ts
```typescript
function calculateInheritedStatBonus(parent1: MonsterInstance, parent2: MonsterInstance): Partial<CharacterStats> {
  const p1Trained = getTrainedStats(parent1)
  const p2Trained = getTrainedStats(parent2)
  const avgTrained = averageStats(p1Trained, p2Trained)
  return multiplyStats(avgTrained, 0.2) // 20% inheritance
}
```

#### 2.3 Store Inherited Bonus on MonsterInstance
- Add `inheritedStatBonus: Partial<CharacterStats>` to MonsterInstance type
- Apply bonus in `calculateMonsterStats()`

### Files to Modify
| File | Changes |
|------|---------|
| `src/systems/BreedingSystem.ts` | Add inherited stat calculation |
| `src/systems/MonsterSystem.ts` | Apply inherited bonus in stat calculation |
| `src/models/types.ts` | Add `inheritedStatBonus` to MonsterInstance |
| `src/models/schemas.ts` | Update schema for new field |

---

## Phase 3: Breeding Generation & Trait Slots

### Goal
Track breeding generation and give bred monsters more trait slots.

### Changes

#### 3.1 Add Generation Tracking
- Add `generation: number` to MonsterInstance (0 = wild-caught, 1+ = bred)
- Offspring generation = max(parent1.generation, parent2.generation) + 1

#### 3.2 Trait Slot System
| Generation | Max Traits |
|------------|------------|
| G0 (Wild) | 1 |
| G1 | 2 |
| G2+ | 3 |

#### 3.3 Update Breeding Logic
- Allow inheriting more traits based on generation
- Display generation in monster info UI

#### 3.4 Visual Indicator
- Show generation badge on monster portraits (G1, G2, G3...)
- Different colors for higher generations

### Files to Modify
| File | Changes |
|------|---------|
| `src/models/types.ts` | Add `generation` field |
| `src/models/schemas.ts` | Update schema |
| `src/systems/BreedingSystem.ts` | Calculate generation, respect trait limits |
| `src/systems/TraitSystem.ts` | Add `getMaxTraitSlots(generation)` |
| `src/ui/menus/MonsterInfoPanel.ts` | Display generation badge |
| `src/scenes/BattleScene.ts` | Show generation on battle sprites |

---

## Phase 4: Stat Ceiling Increase for Bred Monsters

### Goal
Bred monsters can exceed the normal max stats of wild monsters.

### Changes

#### 4.1 Stat Ceiling Bonus
- Wild monsters: 100% of species max stats
- G1 bred: 110% ceiling
- G2+ bred: 120% ceiling

#### 4.2 Implementation
```typescript
function getStatCeiling(species: MonsterSpecies, generation: number): CharacterStats {
  const baseMax = calculateMonsterStats(species, MAX_LEVEL)
  const multiplier = generation === 0 ? 1.0 : generation === 1 ? 1.1 : 1.2
  return multiplyStats(baseMax, multiplier)
}
```

#### 4.3 Apply in Stat Calculation
- Cap stats at ceiling during calculation
- Higher generations can grow beyond normal limits

### Files to Modify
| File | Changes |
|------|---------|
| `src/systems/MonsterSystem.ts` | Add ceiling calculation, apply in stat calc |
| `src/models/constants.ts` | Add `BRED_STAT_CEILING_MULTIPLIERS` |

---

## Phase 5: Legacy Ability Inheritance

### Goal
Parent abilities can be passed to offspring even if offspring species can't normally learn them.

### Changes

#### 5.1 Legacy Ability System
- When breeding, check parent abilities
- 25% chance per parent ability to be inherited as "legacy ability"
- Legacy abilities stored separately, always available

#### 5.2 Update Types
```typescript
interface MonsterInstance {
  // ... existing
  legacyAbilities: string[] // Ability IDs inherited from parents
}
```

#### 5.3 Ability Access
- Monster can use: species abilities (by level) + legacy abilities
- Legacy abilities shown with special indicator in UI

### Files to Modify
| File | Changes |
|------|---------|
| `src/models/types.ts` | Add `legacyAbilities` field |
| `src/systems/BreedingSystem.ts` | Roll for legacy ability inheritance |
| `src/systems/AbilitySystem.ts` | Include legacy abilities in available abilities |
| `src/ui/menus/MonsterInfoPanel.ts` | Show legacy abilities with indicator |

---

## Phase 6: Perfect Offspring System

### Goal
Rare chance for exceptional offspring with boosted everything.

### Changes

#### 6.1 Perfect Offspring Mechanics
- Base chance: 2%
- Boosted by: harmony-bell (+3%), high parent bond (+2% if both > 80 bond)
- Perfect offspring gets:
  - +15% all inherited stat bonuses
  - Guaranteed 2 traits (even at G1)
  - Special visual indicator (sparkle/glow)
  - Title prefix: "Perfect" (e.g., "Perfect Flamepup")

#### 6.2 Implementation
```typescript
interface MonsterInstance {
  // ... existing
  isPerfect: boolean
}

function rollForPerfect(parent1: MonsterInstance, parent2: MonsterInstance, items: string[]): boolean {
  let chance = 0.02
  if (items.includes('harmony-bell')) chance += 0.03
  if (parent1.bond > 80 && parent2.bond > 80) chance += 0.02
  return Math.random() < chance
}
```

### Files to Modify
| File | Changes |
|------|---------|
| `src/models/types.ts` | Add `isPerfect` field |
| `src/systems/BreedingSystem.ts` | Roll for perfect, apply bonuses |
| `src/ui/components/MonsterPortrait.ts` | Add sparkle effect for perfect |
| `src/scenes/BattleScene.ts` | Visual indicator for perfect monsters |

---

## Phase 7: Breeding-Exclusive Species

### Goal
Some monsters can ONLY be obtained through breeding.

### Changes

#### 7.1 Update Monster Data
- Add `obtainableVia: 'wild' | 'breeding' | 'both'` to species
- Breeding-exclusive species don't appear in wild encounters

#### 7.2 Exclusive Species List
| Species | Parents Required | Special |
|---------|-----------------|---------|
| Steampup | Flamepup + Bubblefin | Already exists as recipe |
| Emberbun | Flamepup + Mossbun | Already exists |
| Stormdrake | Tempestdrake + Serpentide | New - powerful late-game |
| Crystalwyrm | Volcanix + Crystalgolem | New - ultimate dragon |
| Shadowflame | Flamepup + Shadowpup | New - dual element |

#### 7.3 Update Encounter System
- Filter out breeding-exclusive species from wild spawns
- These species should have superior base stats

### Files to Modify
| File | Changes |
|------|---------|
| `public/assets/data/monsters.json` | Add `obtainableVia` field, new species |
| `src/systems/EncounterSystem.ts` | Filter breeding-exclusive from wild |
| `public/assets/data/breeding-recipes.json` | Add new exclusive recipes |

---

## Phase 8: Level-Based Evolution

### Goal
Implement simple level-based evolution for applicable species.

### Changes

#### 8.1 Evolution Check
- After XP gain, check if monster meets evolution criteria
- If level >= required and no item needed, prompt evolution

#### 8.2 Evolution Flow
```typescript
function checkAndEvolve(monster: MonsterInstance): MonsterInstance | null {
  const species = getSpeciesById(monster.speciesId)
  if (!species.evolutionChain) return null

  const { evolvesTo, levelRequired, itemRequired } = species.evolutionChain
  if (monster.level >= levelRequired && !itemRequired) {
    return evolveMonster(monster, evolvesTo)
  }
  return null
}
```

#### 8.3 Evolve Function
- Change speciesId to evolved form
- Recalculate stats with new species growth rates
- Preserve: level, XP, bond, traits, generation, legacy abilities
- Learn new abilities available at current level

#### 8.4 Evolution UI
- Show evolution animation/notification
- Display stat changes
- Optional: Let player cancel evolution (settings toggle)

### Files to Modify
| File | Changes |
|------|---------|
| `src/systems/MonsterSystem.ts` | Add `checkAndEvolve()`, `evolveMonster()` |
| `public/assets/data/monsters.json` | Fill in `evolutionChain` data |
| `src/scenes/WorldScene.ts` | Check evolution after battle |
| `src/ui/components/EvolutionNotification.ts` | New - evolution UI |

### Evolution Data Examples
```json
{
  "speciesId": "flamepup",
  "evolutionChain": {
    "evolvesTo": "blazefox",
    "levelRequired": 16,
    "itemRequired": null
  }
}
```

---

## Phase 9: Progressive Disclosure - Crystal Caves NPC

### Goal
Add an NPC in Crystal Caves that reminds players about breeding benefits.

### Changes

#### 9.1 Add Breeding Sage NPC
- Location: Crystal Caves entrance area
- Type: "sage" or "guide"
- Dialog explains breeding benefits:
  - "Bred monsters are stronger than wild ones"
  - "Higher generations can have more traits"
  - "Some rare monsters can only be bred"
  - "Visit the Monster Breeder back in the village!"

#### 9.2 Quest Hook (Optional)
- Side quest: "Breeding Mastery"
- Objective: Breed a G2 monster
- Reward: Mutation Catalyst + breeding tips

### Files to Modify
| File | Changes |
|------|---------|
| `public/assets/data/areas.json` | Add Breeding Sage NPC to crystal-caves |
| `public/assets/data/dialogs.json` | Add breeding education dialog |
| `public/assets/data/quests.json` | Optional breeding quest |

---

## Phase 10: UI Enhancements

### Goal
Make breeding benefits visible and understandable.

### Changes

#### 10.1 Monster Info Panel Updates
- Show generation badge (G0/G1/G2/G3)
- Show inherited stat bonus separately
- Show legacy abilities with special marker
- Show "Perfect" badge if applicable
- Show stat ceiling vs current stats

#### 10.2 Breeding Preview Panel
- Before breeding, show potential offspring:
  - Expected generation
  - Potential trait slots
  - Stat inheritance preview
  - Perfect chance percentage
  - Possible species outcomes

#### 10.3 Bestiary Updates
- Mark breeding-exclusive species
- Show "Obtained via Breeding" badge
- Track: "First bred", "Perfect bred" achievements

### Files to Modify
| File | Changes |
|------|---------|
| `src/ui/menus/MonsterInfoPanel.ts` | Add generation, inheritance display |
| `src/ui/menus/BreedingScene.ts` | Add breeding preview |
| `src/ui/menus/BestiaryPanel.ts` | Add breeding indicators |

---

## New Types Summary

```typescript
// Additions to MonsterInstance
interface MonsterInstance {
  // ... existing fields
  generation: number              // 0 = wild, 1+ = bred
  inheritedStatBonus: Partial<CharacterStats>  // From parents
  legacyAbilities: string[]       // Inherited abilities
  isPerfect: boolean              // Perfect offspring flag
}

// Additions to MonsterSpecies
interface MonsterSpecies {
  // ... existing fields
  obtainableVia: 'wild' | 'breeding' | 'both'
}
```

---

## New Constants

```typescript
// src/models/constants.ts additions
export const XP_BENCH_PERCENTAGE = 0.1           // 10% XP to bench
export const INHERITED_STAT_PERCENTAGE = 0.2    // 20% of trained stats
export const LEGACY_ABILITY_CHANCE = 0.25       // 25% per ability
export const PERFECT_BASE_CHANCE = 0.02         // 2% base
export const PERFECT_HARMONY_BONUS = 0.03       // +3% with harmony-bell
export const PERFECT_BOND_BONUS = 0.02          // +2% if both parents >80 bond
export const PERFECT_STAT_MULTIPLIER = 1.15     // +15% inherited stats

export const GENERATION_TRAIT_SLOTS: Record<number, number> = {
  0: 1,  // Wild
  1: 2,  // G1
  2: 3,  // G2+
}

export const GENERATION_STAT_CEILING: Record<number, number> = {
  0: 1.0,   // Wild: 100%
  1: 1.1,   // G1: 110%
  2: 1.2,   // G2+: 120%
}
```

---

## Implementation Order

| Phase | Priority | Dependencies |
|-------|----------|--------------|
| Phase 1: XP Distribution | HIGH | None - core functionality |
| Phase 2: Stat Inheritance | HIGH | Phase 1 |
| Phase 3: Generation & Traits | HIGH | Phase 2 |
| Phase 4: Stat Ceiling | MEDIUM | Phase 3 |
| Phase 5: Legacy Abilities | MEDIUM | Phase 3 |
| Phase 6: Perfect Offspring | MEDIUM | Phase 3 |
| Phase 7: Exclusive Species | MEDIUM | Phase 3 |
| Phase 8: Evolution | MEDIUM | Phase 1 |
| Phase 9: Crystal Caves NPC | LOW | Phase 7 |
| Phase 10: UI Enhancements | LOW | All above |

---

## Verification Checklist

### Unit Tests
```bash
npx vitest run tests/unit/systems/MonsterSystem.test.ts
npx vitest run tests/unit/systems/BreedingSystem.test.ts
npx vitest run tests/unit/systems/CombatSystem.test.ts
```

### Manual Testing
- [ ] Win battle → all active squad monsters gain equal XP
- [ ] Win battle → bench monsters gain 10% XP
- [ ] Monster levels up → notification shown
- [ ] Breed two monsters → offspring has correct generation
- [ ] G1 offspring → can have 2 traits
- [ ] G2+ offspring → can have 3 traits
- [ ] High-level parents → offspring has inherited stat bonus
- [ ] Breeding with harmony-bell → higher perfect chance
- [ ] Perfect offspring → has sparkle effect and title
- [ ] Breeding-exclusive species → doesn't appear in wild
- [ ] Monster reaches evolution level → evolves correctly
- [ ] Crystal Caves NPC → explains breeding benefits
- [ ] Monster info panel → shows all new fields

---

## Migration Notes

### Existing Save Compatibility
- Add default values for new fields:
  - `generation: 0` (treat all existing as wild)
  - `inheritedStatBonus: {}` (no bonus)
  - `legacyAbilities: []` (none)
  - `isPerfect: false`
- SaveSystem migration function to add fields to existing saves

---

## Rollback Plan

- Each phase is independent and can be disabled
- Feature flags for major systems:
  - `MONSTER_XP_ENABLED`
  - `BREEDING_ENHANCED_ENABLED`
  - `EVOLUTION_ENABLED`
- Existing breeding system remains functional without enhancements

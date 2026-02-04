import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import type { Battle, BattleCombatant, BattleAction, MonsterElement, ItemDrop } from '../models/types'
import {
  createBattle,
  executeAction,
  processStatusEffects,
  getEnemyAction,
  isSleeping,
  calculateBattleRewards,
  checkBattleEnd,
  calculateTurnOrder,
  getCurrentCombatant,
  type ActionResult,
} from '../systems/CombatSystem'
import { BattleHUD, type CommandChoice } from '../ui/hud/BattleHUD'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'
import { generateBattleLoot } from '../systems/LootSystem'
import { getGameState, setGameState, updateInventory } from '../systems/GameStateManager'
import { useItem, getConsumableItems } from '../systems/InventorySystem'
import { useItemOnCombatant } from '../systems/ItemEffectSystem'

interface BattleSceneData {
  readonly playerCombatants: ReadonlyArray<BattleCombatant>
  readonly enemyCombatants: ReadonlyArray<BattleCombatant>
  readonly backgroundKey?: string
  readonly enemySpeciesIds?: ReadonlyArray<string>
}

type BattlePhase = 'intro' | 'player_input' | 'executing' | 'enemy_turn' | 'victory' | 'defeat' | 'fled'

export class BattleScene extends Phaser.Scene {
  private battle!: Battle
  private hud!: BattleHUD
  private phase: BattlePhase = 'intro'
  private playerSprites: Phaser.GameObjects.Rectangle[] = []
  private enemySprites: Phaser.GameObjects.Rectangle[] = []
  private sceneData!: BattleSceneData
  private currentTurnIndex: number = 0

  constructor() {
    super({ key: SCENE_KEYS.BATTLE })
  }

  create(data: BattleSceneData): void {
    this.sceneData = data
    this.phase = 'intro'

    this.battle = createBattle(
      data.playerCombatants,
      data.enemyCombatants,
      data.backgroundKey,
    )

    this.createBackground()
    this.createCombatantSprites()

    this.hud = new BattleHUD(this)
    this.hud.setCommandCallback((choice, targetId, abilityId) => {
      this.handlePlayerCommand(choice, targetId, abilityId)
    })

    this.hud.updatePlayerStats(this.battle.playerSquad)
    this.hud.updateEnemyStats(this.battle.enemySquad)

    // Intro sequence
    this.cameras.main.fadeIn(300)
    this.time.delayedCall(500, () => {
      this.hud.showMessage('A wild monster appeared!').then(() => {
        this.startNextTurn()
      })
    })
  }

  private createBackground(): void {
    const bg = this.add.graphics()

    // Sky gradient
    bg.fillGradientStyle(0x87ceeb, 0x87ceeb, 0x228b22, 0x228b22)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Ground
    bg.fillStyle(0x4caf50, 1)
    bg.fillRect(0, GAME_HEIGHT * 0.6, GAME_WIDTH, GAME_HEIGHT * 0.4)

    // Battle platform for enemies
    bg.fillStyle(0x8d6e63, 0.6)
    bg.fillEllipse(GAME_WIDTH * 0.25, GAME_HEIGHT * 0.48, 350, 60)

    // Battle platform for player
    bg.fillStyle(0x8d6e63, 0.6)
    bg.fillEllipse(GAME_WIDTH * 0.72, GAME_HEIGHT * 0.68, 350, 60)

    bg.setDepth(DEPTH.GROUND)
  }

  private createCombatantSprites(): void {
    // Enemy sprites (left side)
    this.enemySprites = this.battle.enemySquad.map((enemy, index) => {
      const x = GAME_WIDTH * 0.18 + index * 120
      const y = GAME_HEIGHT * 0.38
      const color = this.getElementColor(this.guessEnemyElement(enemy))

      const sprite = this.add.rectangle(x, y, 64, 64, color)
      sprite.setDepth(DEPTH.PLAYER)
      sprite.setStrokeStyle(2, 0xffffff, 0.8)

      // Name label above
      const label = this.add.text(x, y - 45, enemy.name, {
        ...TEXT_STYLES.SMALL,
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      label.setOrigin(0.5)
      label.setDepth(DEPTH.PLAYER + 1)

      // Entry animation
      sprite.setAlpha(0)
      sprite.setScale(0.3)
      this.tweens.add({
        targets: sprite,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        delay: index * 150,
        ease: 'Back.easeOut',
      })

      return sprite
    })

    // Player sprites (right side)
    this.playerSprites = this.battle.playerSquad.map((player, index) => {
      const x = GAME_WIDTH * 0.65 + index * 100
      const y = GAME_HEIGHT * 0.58
      const color = player.isMonster ? COLORS.PRIMARY : COLORS.SECONDARY

      const sprite = this.add.rectangle(x, y, 56, 56, color)
      sprite.setDepth(DEPTH.PLAYER)
      sprite.setStrokeStyle(2, 0xffffff, 0.8)

      // Entry slide from right
      sprite.setX(GAME_WIDTH + 100)
      this.tweens.add({
        targets: sprite,
        x,
        duration: 500,
        delay: index * 100,
        ease: 'Power2',
      })

      return sprite
    })
  }

  private startNextTurn(): void {
    // Recalculate turn order each round
    if (this.currentTurnIndex === 0) {
      this.battle = {
        ...this.battle,
        turnOrder: calculateTurnOrder([...this.battle.playerSquad, ...this.battle.enemySquad]),
      }
    }

    // Check for battle end
    const endState = checkBattleEnd(this.battle)
    if (endState === 'victory') {
      this.handleVictory()
      return
    }
    if (endState === 'defeat') {
      this.handleDefeat()
      return
    }

    // Get current combatant
    const aliveTurnOrder = this.battle.turnOrder.filter((c) => c.stats.currentHp > 0)
    if (aliveTurnOrder.length === 0) return

    const current = aliveTurnOrder[this.currentTurnIndex % aliveTurnOrder.length]
    if (!current) return

    // Process status effects at start of turn
    this.battle = processStatusEffects(this.battle, current.combatantId)
    this.hud.updatePlayerStats(this.battle.playerSquad)
    this.hud.updateEnemyStats(this.battle.enemySquad)

    // Recheck after status effects (poison could KO)
    const postStatusEnd = checkBattleEnd(this.battle)
    if (postStatusEnd === 'victory') {
      this.handleVictory()
      return
    }
    if (postStatusEnd === 'defeat') {
      this.handleDefeat()
      return
    }

    // Check if sleeping
    const updatedCurrent = this.findCurrentCombatant(current.combatantId)
    if (updatedCurrent && isSleeping(updatedCurrent)) {
      this.hud.showMessage(`${updatedCurrent.name} is asleep!`).then(() => {
        this.currentTurnIndex++
        this.startNextTurn()
      })
      return
    }

    // Skip dead combatants
    if (updatedCurrent && updatedCurrent.stats.currentHp <= 0) {
      this.currentTurnIndex++
      this.startNextTurn()
      return
    }

    if (current.isPlayer) {
      this.phase = 'player_input'
      this.hud.showCommandMenu()
    } else {
      this.phase = 'enemy_turn'
      this.executeEnemyTurn(current)
    }
  }

  private handlePlayerCommand(choice: CommandChoice, targetId?: string, abilityId?: string): void {
    if (this.phase !== 'player_input') return
    this.phase = 'executing'
    this.hud.hideCommandMenu()

    const aliveTurnOrder = this.battle.turnOrder.filter((c) => c.stats.currentHp > 0)
    const current = aliveTurnOrder[this.currentTurnIndex % aliveTurnOrder.length]
    if (!current) return

    if (choice === 'ability' && !abilityId) {
      // Show ability submenu
      this.hud.showAbilityMenu(current.abilities, current.stats.currentMp)
      this.phase = 'player_input'
      return
    }

    if (choice === 'item' && !abilityId) {
      // Show item submenu (reuse abilityId param as itemId)
      try {
        const state = getGameState(this)
        const consumables = getConsumableItems(state.inventory)
        this.hud.showItemMenu(consumables)
      } catch {
        // No game state yet, show nothing
      }
      this.phase = 'player_input'
      return
    }

    // Handle item usage
    if (choice === 'item' && abilityId) {
      this.handleItemUse(current, abilityId)
      return
    }

    // Determine target - for attacks, pick first alive enemy
    const aliveEnemies = this.battle.enemySquad.filter((e) => e.stats.currentHp > 0)
    const defaultTarget = aliveEnemies[0]?.combatantId

    const action: BattleAction = {
      type: choice === 'ability' ? 'ability' : choice === 'attack' ? 'attack' : choice === 'flee' ? 'flee' : 'defend',
      actorId: current.combatantId,
      targetId: targetId ?? defaultTarget ?? null,
      abilityId: abilityId ?? null,
      itemId: null,
    }

    this.executeActionAndAnimate(action)
  }

  private handleItemUse(actor: BattleCombatant, itemId: string): void {
    try {
      const state = getGameState(this)
      const itemSlot = state.inventory.items.find((s) => s.item.itemId === itemId)
      if (!itemSlot) {
        this.phase = 'player_input'
        this.hud.showCommandMenu()
        return
      }

      // Apply item effect to player combatant
      const { combatant: updatedActor, result } = useItemOnCombatant(itemSlot.item, actor)

      if (result.success) {
        // Decrement inventory
        const newInventory = useItem(state.inventory, itemId)
        if (newInventory) {
          setGameState(this, updateInventory(state, newInventory))
        }

        // Update battle state with healed combatant
        const updateCombatant = (c: BattleCombatant): BattleCombatant =>
          c.combatantId === updatedActor.combatantId ? updatedActor : c

        this.battle = {
          ...this.battle,
          playerSquad: this.battle.playerSquad.map(updateCombatant),
          enemySquad: this.battle.enemySquad.map(updateCombatant),
          turnOrder: this.battle.turnOrder.map(updateCombatant),
        }
      }

      this.hud.showMessage(result.message).then(() => {
        this.hud.updatePlayerStats(this.battle.playerSquad)
        this.hud.updateEnemyStats(this.battle.enemySquad)

        this.currentTurnIndex++
        const aliveCount = [...this.battle.playerSquad, ...this.battle.enemySquad].filter(
          (c) => c.stats.currentHp > 0,
        ).length
        if (this.currentTurnIndex >= aliveCount) {
          this.currentTurnIndex = 0
        }
        this.startNextTurn()
      })
    } catch {
      this.phase = 'player_input'
      this.hud.showCommandMenu()
    }
  }

  private executeEnemyTurn(enemy: BattleCombatant): void {
    this.time.delayedCall(600, () => {
      const action = getEnemyAction(this.battle, enemy)
      this.executeActionAndAnimate(action)
    })
  }

  private executeActionAndAnimate(action: BattleAction): void {
    const result = executeAction(this.battle, action)
    this.battle = result.battle

    // Animate attack
    if (result.damage > 0 && action.targetId) {
      this.animateAttack(action.actorId, action.targetId, result)
    }

    // Show message
    this.hud.showMessage(result.message).then(() => {
      this.hud.updatePlayerStats(this.battle.playerSquad)
      this.hud.updateEnemyStats(this.battle.enemySquad)

      // Check flee
      if (this.battle.state === 'fled') {
        this.handleFlee()
        return
      }

      this.currentTurnIndex++

      // Reset turn index after all combatants have acted
      const aliveCount = [...this.battle.playerSquad, ...this.battle.enemySquad].filter(
        (c) => c.stats.currentHp > 0,
      ).length
      if (this.currentTurnIndex >= aliveCount) {
        this.currentTurnIndex = 0
      }

      this.startNextTurn()
    })
  }

  private animateAttack(attackerId: string, targetId: string, result: ActionResult): void {
    const targetSprite = this.findSprite(targetId)
    if (!targetSprite) return

    // Flash the target
    this.tweens.add({
      targets: targetSprite,
      alpha: 0.2,
      duration: 100,
      yoyo: true,
      repeat: 2,
    })

    // Shake the target
    const origX = targetSprite.x
    this.tweens.add({
      targets: targetSprite,
      x: origX + 8,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        targetSprite.setX(origX)
      },
    })

    // Show damage number
    if (result.damage > 0) {
      this.hud.showDamageNumber(targetSprite.x, targetSprite.y - 40, result.damage, result.isCritical)
    }

    // Check if target KO'd
    const target = this.findCurrentCombatant(targetId)
    if (target && target.stats.currentHp <= 0) {
      this.time.delayedCall(300, () => {
        this.tweens.add({
          targets: targetSprite,
          alpha: 0,
          scaleY: 0,
          duration: 500,
          ease: 'Power2',
        })
      })
    }
  }

  private handleVictory(): void {
    this.phase = 'victory'
    const rewards = calculateBattleRewards(this.battle)

    // Generate loot
    const speciesIds = this.sceneData.enemySpeciesIds ?? []
    const loot = generateBattleLoot(speciesIds)

    // Victory flash
    this.cameras.main.flash(300, 255, 255, 200)

    const lootMsg = loot.length > 0
      ? ` Found: ${loot.map((d) => `${d.itemId} x${d.quantity}`).join(', ')}`
      : ''

    this.hud.hideCommandMenu()
    this.hud.showMessage(`Victory! Gained ${rewards.experience} XP and ${rewards.gold} gold!${lootMsg}`).then(() => {
      this.time.delayedCall(1000, () => {
        EventBus.emit(GAME_EVENTS.BATTLE_VICTORY, { rewards })
        EventBus.emit(GAME_EVENTS.BATTLE_END, { result: 'victory' })

        this.cameras.main.fadeOut(500)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.cleanUp()
          this.scene.start(SCENE_KEYS.WORLD, {
            newGame: false,
            battleResult: 'victory',
            rewards,
            loot,
          })
        })
      })
    })
  }

  private handleDefeat(): void {
    this.phase = 'defeat'

    this.cameras.main.shake(500, 0.02)

    this.hud.hideCommandMenu()
    this.hud.showMessage('Your party was defeated...').then(() => {
      this.time.delayedCall(1500, () => {
        EventBus.emit(GAME_EVENTS.BATTLE_END, { result: 'defeat' })

        this.cameras.main.fadeOut(800, 0, 0, 0)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.cleanUp()
          this.scene.start(SCENE_KEYS.TITLE)
        })
      })
    })
  }

  private handleFlee(): void {
    this.phase = 'fled'

    this.hud.hideCommandMenu()
    this.hud.showMessage('Got away safely!').then(() => {
      this.time.delayedCall(500, () => {
        EventBus.emit(GAME_EVENTS.BATTLE_END, { result: 'fled' })

        this.cameras.main.fadeOut(300)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.cleanUp()
          this.scene.start(SCENE_KEYS.WORLD, { newGame: false, battleResult: 'fled' })
        })
      })
    })
  }

  private findSprite(combatantId: string): Phaser.GameObjects.Rectangle | undefined {
    const playerIndex = this.battle.playerSquad.findIndex((c) => c.combatantId === combatantId)
    if (playerIndex >= 0) return this.playerSprites[playerIndex]

    const enemyIndex = this.battle.enemySquad.findIndex((c) => c.combatantId === combatantId)
    if (enemyIndex >= 0) return this.enemySprites[enemyIndex]

    return undefined
  }

  private findCurrentCombatant(combatantId: string): BattleCombatant | undefined {
    return (
      this.battle.playerSquad.find((c) => c.combatantId === combatantId) ??
      this.battle.enemySquad.find((c) => c.combatantId === combatantId)
    )
  }

  private guessEnemyElement(enemy: BattleCombatant): MonsterElement {
    for (const ability of enemy.abilities) {
      if (ability.element !== 'neutral') return ability.element
    }
    return 'neutral'
  }

  private getElementColor(element: MonsterElement): number {
    const colors: Record<MonsterElement, number> = {
      fire: 0xef5350,
      water: 0x42a5f5,
      earth: 0x8d6e63,
      wind: 0x66bb6a,
      light: 0xffd54f,
      dark: 0x7e57c2,
      neutral: 0xbdbdbd,
    }
    return colors[element]
  }

  private cleanUp(): void {
    this.hud.destroy()
    this.playerSprites = []
    this.enemySprites = []
    this.currentTurnIndex = 0
  }
}

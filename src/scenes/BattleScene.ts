import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import type { Battle, BattleCombatant, BattleAction, MonsterElement, ItemDrop, MonsterInstance, BossDefinition } from '../models/types'
import { initAudioSystem, playMusic, crossfadeMusic, playSfx, stopMusic, MUSIC_KEYS, SFX_KEYS } from '../systems/AudioSystem'
import { checkAndShowTutorial } from '../systems/TutorialSystem'
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
import {
  getGameState,
  setGameState,
  updateInventory,
  updateSquad,
  updateMonsterStorage,
  updateDiscoveredSpecies,
  addDefeatedBoss,
  updateActiveQuests,
} from '../systems/GameStateManager'
import { trackDefeat, trackBossDefeat } from '../systems/QuestSystem'
import { useItem, getConsumableItems, getCaptureDevices, getItem } from '../systems/InventorySystem'
import { useItemOnCombatant } from '../systems/ItemEffectSystem'
import { getSpecies } from '../systems/MonsterSystem'
import {
  attemptCapture,
  calculateShakeCount,
  createCapturedMonster,
} from '../systems/CaptureSystem'
import { addToSquad, applyPostBattleBond, isSquadFull } from '../systems/SquadSystem'
import { discoverSpecies, discoverMultipleSpecies } from '../systems/BestiarySystem'
import { getSquadMonsterAction } from '../systems/SquadAI'
import { playCaptureAnimation } from '../ui/animations/CaptureAnimation'

interface BattleSceneData {
  readonly playerCombatants: ReadonlyArray<BattleCombatant>
  readonly enemyCombatants: ReadonlyArray<BattleCombatant>
  readonly backgroundKey?: string
  readonly enemySpeciesIds?: ReadonlyArray<string>
  readonly isBossBattle?: boolean
  readonly bossData?: BossDefinition
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
  private isBossBattle: boolean = false
  private bossData: BossDefinition | null = null

  constructor() {
    super({ key: SCENE_KEYS.BATTLE })
  }

  create(data: BattleSceneData): void {
    this.sceneData = data
    this.phase = 'intro'
    this.isBossBattle = data.isBossBattle ?? false
    this.bossData = data.bossData ?? null

    // Initialize audio system
    initAudioSystem(this)

    // Play battle music
    if (this.isBossBattle) {
      playMusic(MUSIC_KEYS.BATTLE_BOSS, { fadeIn: 500 })
    } else {
      playMusic(MUSIC_KEYS.BATTLE_NORMAL, { fadeIn: 500 })
    }

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
      const introMessage = this.isBossBattle && this.bossData
        ? `${this.bossData.name}, ${this.bossData.title}, appears!`
        : 'A wild monster appeared!'

      // Show first battle tutorial
      checkAndShowTutorial(this, 'first_battle')

      this.hud.showMessage(introMessage).then(() => {
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

    if (current.isPlayer && !current.isMonster) {
      // Human player's turn
      this.phase = 'player_input'
      this.hud.showCommandMenu()
    } else if (current.isPlayer && current.isMonster) {
      // Squad monster's turn - use AI
      this.phase = 'executing'
      this.executeSquadMonsterTurn(current)
    } else {
      // Enemy's turn
      this.phase = 'enemy_turn'
      this.executeEnemyTurn(current)
    }
  }

  private executeSquadMonsterTurn(monster: BattleCombatant): void {
    this.time.delayedCall(400, () => {
      const action = getSquadMonsterAction(this.battle, monster)
      this.executeActionAndAnimate(action)
    })
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

    // Handle capture device selection
    if (choice === 'capture' && !abilityId) {
      try {
        const state = getGameState(this)
        const devices = getCaptureDevices(state.inventory)
        this.hud.showCaptureDeviceMenu(devices)
      } catch {
        // No game state yet, show nothing
      }
      this.phase = 'player_input'
      return
    }

    // Handle capture attempt
    if (choice === 'capture' && abilityId) {
      this.handleCaptureAttempt(current, abilityId)
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

  private handleCaptureAttempt(actor: BattleCombatant, deviceItemId: string): void {
    try {
      const state = getGameState(this)
      const deviceSlot = state.inventory.items.find((s) => s.item.itemId === deviceItemId)
      if (!deviceSlot) {
        this.phase = 'player_input'
        this.hud.showCommandMenu()
        return
      }

      // Find the target enemy (first alive, capturable enemy)
      const aliveEnemies = this.battle.enemySquad.filter(
        (e) => e.stats.currentHp > 0 && e.capturable,
      )
      if (aliveEnemies.length === 0) {
        this.hud.showMessage('No capturable targets!').then(() => {
          this.phase = 'player_input'
          this.hud.showCommandMenu()
        })
        return
      }

      const target = aliveEnemies[0]

      // Get species difficulty
      const speciesId = this.sceneData.enemySpeciesIds?.[0] ?? ''
      const species = getSpecies(speciesId)
      const baseDifficulty = species?.captureBaseDifficulty ?? 0.5
      const enemyLevel = this.extractLevelFromName(target.name)

      // Decrement device from inventory
      const newInventory = useItem(state.inventory, deviceItemId)
      if (newInventory) {
        setGameState(this, updateInventory(state, newInventory))
      }

      // Perform capture attempt
      const captureAttempt = attemptCapture(
        target,
        deviceSlot.item,
        actor.stats.luck,
        baseDifficulty,
      )

      const shakeCount = calculateShakeCount(captureAttempt)

      // Emit capture attempt event
      EventBus.emit(GAME_EVENTS.CAPTURE_ATTEMPT, { attempt: captureAttempt, shakeCount })

      // Get sprite positions for animation
      const actorSprite = this.findSprite(actor.combatantId)
      const targetSprite = this.findSprite(target.combatantId)

      if (!actorSprite || !targetSprite) {
        this.finalizeCaptureAttempt(captureAttempt, shakeCount, target, speciesId, enemyLevel)
        return
      }

      // Play capture animation
      playSfx(SFX_KEYS.CAPTURE_THROW)
      this.hud.showMessage(`Throwing ${deviceSlot.item.name}...`).then(() => {
        playCaptureAnimation({
          scene: this,
          deviceX: actorSprite.x,
          deviceY: actorSprite.y,
          targetX: targetSprite.x,
          targetY: targetSprite.y,
          shakeCount,
          succeeded: captureAttempt.succeeded,
          deviceName: deviceSlot.item.name,
        }).then(() => {
          this.finalizeCaptureAttempt(captureAttempt, shakeCount, target, speciesId, enemyLevel)
        })
      })
    } catch {
      this.phase = 'player_input'
      this.hud.showCommandMenu()
    }
  }

  private finalizeCaptureAttempt(
    captureAttempt: ReturnType<typeof attemptCapture>,
    shakeCount: number,
    target: BattleCombatant,
    speciesId: string,
    enemyLevel: number,
  ): void {
    if (captureAttempt.succeeded) {
      // Play capture success SFX
      playSfx(SFX_KEYS.CAPTURE_SUCCESS)

      // Show first capture tutorial
      checkAndShowTutorial(this, 'first_capture')
      // Create captured monster
      const capturedMonster = createCapturedMonster(speciesId, enemyLevel)

      if (capturedMonster) {
        // Add to squad or storage
        const state = getGameState(this)
        const newSquad = addToSquad(state.squad, capturedMonster)

        if (newSquad) {
          setGameState(this, updateSquad(state, newSquad))
          EventBus.emit(GAME_EVENTS.SQUAD_MONSTER_ADDED, { monster: capturedMonster })
        } else {
          // Squad full, add to storage
          const newStorage = [...state.monsterStorage, capturedMonster]
          setGameState(this, updateMonsterStorage(state, newStorage))
        }

        // Discover species
        const updatedState = getGameState(this)
        const newDiscovered = discoverSpecies(updatedState.discoveredSpecies, speciesId)
        setGameState(this, updateDiscoveredSpecies(updatedState, newDiscovered))

        // Emit success events
        EventBus.emit(GAME_EVENTS.CAPTURE_SUCCESS, { monster: capturedMonster, attempt: captureAttempt })
        EventBus.emit(GAME_EVENTS.MONSTER_CAPTURED, { monster: capturedMonster })

        const species = getSpecies(speciesId)
        if (species) {
          EventBus.emit(GAME_EVENTS.SPECIES_DISCOVERED, { speciesId, speciesName: species.name })
        }

        // Remove target from battle
        this.battle = {
          ...this.battle,
          enemySquad: this.battle.enemySquad.filter(
            (e) => e.combatantId !== target.combatantId,
          ),
          turnOrder: this.battle.turnOrder.filter(
            (c) => c.combatantId !== target.combatantId,
          ),
        }

        // Hide the target sprite
        const targetSprite = this.findSprite(target.combatantId)
        if (targetSprite) {
          targetSprite.setVisible(false)
        }

        const locationText = newSquad ? 'squad' : 'storage'
        this.hud.showMessage(`Caught ${target.name}! Added to ${locationText}!`).then(() => {
          this.hud.updatePlayerStats(this.battle.playerSquad)
          this.hud.updateEnemyStats(this.battle.enemySquad)

          // Check if battle should end (no more enemies)
          if (this.battle.enemySquad.every((e) => e.stats.currentHp <= 0)) {
            this.handleVictory()
          } else {
            this.advanceToNextTurn()
          }
        })
      }
    } else {
      // Capture failed
      playSfx(SFX_KEYS.CAPTURE_FAIL)
      EventBus.emit(GAME_EVENTS.CAPTURE_FAIL, { attempt: captureAttempt, shakeCount })

      this.hud.showMessage(`${target.name} broke free!`).then(() => {
        this.advanceToNextTurn()
      })
    }
  }

  private advanceToNextTurn(): void {
    this.currentTurnIndex++

    const aliveCount = [...this.battle.playerSquad, ...this.battle.enemySquad].filter(
      (c) => c.stats.currentHp > 0,
    ).length
    if (this.currentTurnIndex >= aliveCount) {
      this.currentTurnIndex = 0
    }
    this.startNextTurn()
  }

  private extractLevelFromName(name: string): number {
    const match = name.match(/Lv\.(\d+)/)
    return match ? parseInt(match[1], 10) : 1
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

    // Play hit SFX
    playSfx(SFX_KEYS.ATTACK_HIT)

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

    // Play victory music
    playMusic(MUSIC_KEYS.VICTORY_FANFARE, { loop: false })

    // For boss battles, use boss rewards; otherwise calculate normal rewards
    const isBoss = this.isBossBattle && this.bossData
    const bossRewards = isBoss ? this.bossData!.rewards : null
    const normalRewards = calculateBattleRewards(this.battle)

    const rewards = bossRewards
      ? { experience: bossRewards.experience, gold: bossRewards.gold }
      : normalRewards

    // Generate loot (for non-boss battles)
    const speciesIds = this.sceneData.enemySpeciesIds ?? []
    const loot = isBoss ? bossRewards!.guaranteedItems : generateBattleLoot(speciesIds)

    // Apply bond increases to squad
    try {
      const state = getGameState(this)
      if (state.squad.length > 0) {
        const updatedSquad = applyPostBattleBond(state.squad, true)
        setGameState(this, updateSquad(state, updatedSquad))

        // Emit bond events
        for (let i = 0; i < updatedSquad.length; i++) {
          const monster = updatedSquad[i]
          const oldMonster = state.squad[i]
          if (monster.bondLevel !== oldMonster.bondLevel) {
            EventBus.emit(GAME_EVENTS.BOND_INCREASED, {
              monster,
              amount: monster.bondLevel - oldMonster.bondLevel,
              newLevel: monster.bondLevel,
            })
          }
        }
      }

      // Mark boss as defeated
      if (isBoss) {
        const updatedState = getGameState(this)
        setGameState(this, addDefeatedBoss(updatedState, this.bossData!.bossId))

        // Track boss defeat for quests
        const stateAfterBoss = getGameState(this)
        const questsAfterBoss = trackBossDefeat(stateAfterBoss.activeQuests, this.bossData!.bossId)
        if (questsAfterBoss !== stateAfterBoss.activeQuests) {
          setGameState(this, updateActiveQuests(stateAfterBoss, questsAfterBoss))
        }
      }

      // Track monster defeats for quests
      if (speciesIds.length > 0) {
        const stateForQuests = getGameState(this)
        let updatedQuests = stateForQuests.activeQuests
        for (const speciesId of speciesIds) {
          updatedQuests = trackDefeat(updatedQuests, speciesId)
        }
        if (updatedQuests !== stateForQuests.activeQuests) {
          setGameState(this, updateActiveQuests(stateForQuests, updatedQuests))
        }
      }

      // Discover encountered species
      if (speciesIds.length > 0) {
        const updatedState = getGameState(this)
        const newDiscovered = discoverMultipleSpecies(updatedState.discoveredSpecies, speciesIds)
        if (newDiscovered !== updatedState.discoveredSpecies) {
          setGameState(this, updateDiscoveredSpecies(updatedState, newDiscovered))
          EventBus.emit(GAME_EVENTS.BESTIARY_UPDATED, {
            discovered: newDiscovered,
            newCount: newDiscovered.length - updatedState.discoveredSpecies.length,
          })
        }
      }
    } catch {
      // No game state
    }

    // Victory flash
    this.cameras.main.flash(300, 255, 255, 200)

    const lootMsg = loot.length > 0
      ? ` Found: ${loot.map((d) => `${d.itemId} x${d.quantity}`).join(', ')}`
      : ''

    this.hud.hideCommandMenu()

    // For boss battles, show defeat dialog before victory message
    if (isBoss && this.bossData!.defeatDialog.length > 0) {
      this.showBossDefeatDialog()
    } else {
      this.showVictoryMessage(rewards, loot, lootMsg)
    }
  }

  private showBossDefeatDialog(): void {
    if (!this.bossData) return

    const bossRewards = this.bossData.rewards
    const rewards = { experience: bossRewards.experience, gold: bossRewards.gold }
    const loot = bossRewards.guaranteedItems

    // Show defeat dialog via dialog scene
    this.scene.launch(SCENE_KEYS.DIALOG, {
      dialogTreeId: null,
      messages: this.bossData.defeatDialog,
      npcName: this.bossData.name,
      npcType: 'quest',
    })

    this.scene.pause()

    this.events.once('resume', () => {
      const lootMsg = loot.length > 0
        ? ` Found: ${loot.map((d) => `${d.itemId} x${d.quantity}`).join(', ')}`
        : ''

      this.showVictoryMessage(rewards, loot, lootMsg)
    })
  }

  private showVictoryMessage(
    rewards: { experience: number; gold: number },
    loot: ReadonlyArray<ItemDrop>,
    lootMsg: string,
  ): void {
    const isBoss = this.isBossBattle && this.bossData
    const victoryMsg = isBoss
      ? `${this.bossData!.name} defeated! Gained ${rewards.experience} XP and ${rewards.gold} gold!${lootMsg}`
      : `Victory! Gained ${rewards.experience} XP and ${rewards.gold} gold!${lootMsg}`

    this.hud.showMessage(victoryMsg).then(() => {
      this.time.delayedCall(1000, () => {
        EventBus.emit(GAME_EVENTS.BATTLE_VICTORY, { rewards })
        EventBus.emit(GAME_EVENTS.BATTLE_END, { result: 'victory' })

        this.cameras.main.fadeOut(500)
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.cleanUp()

          // For boss battles, pass boss-specific data
          if (isBoss) {
            this.scene.start(SCENE_KEYS.WORLD, {
              newGame: false,
              battleResult: 'victory',
              rewards,
              loot,
              bossDefeated: this.bossData!.bossId,
              bossRewards: {
                experience: this.bossData!.rewards.experience,
                gold: this.bossData!.rewards.gold,
                items: this.bossData!.rewards.guaranteedItems,
                unlocksArea: this.bossData!.rewards.unlocksArea,
              },
            })
          } else {
            this.scene.start(SCENE_KEYS.WORLD, {
              newGame: false,
              battleResult: 'victory',
              rewards,
              loot,
            })
          }
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
    this.isBossBattle = false
    this.bossData = null
  }
}

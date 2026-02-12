import Phaser from 'phaser'
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS, DEPTH, TEXT_STYLES } from '../config'
import {
  getDialogTree,
  getStartNode,
  getDialogNode,
  isEndNode,
  type DialogNode,
  type DialogTree,
  type DialogChoice,
} from '../systems/DialogSystem'
import {
  getGameState,
  setGameState,
  updatePlayer,
  updateActiveQuests,
  updateCompletedQuests,
  updateInventory,
} from '../systems/GameStateManager'
import { fullHeal, updatePlayerGold, addExperience } from '../systems/CharacterSystem'
import {
  getQuest,
  acceptQuest,
  completeQuest,
  trackNpcTalk,
} from '../systems/QuestSystem'
import { addItem } from '../systems/InventorySystem'
import { getEquipment } from '../systems/EquipmentSystem'
import { EventBus } from '../events/EventBus'
import { GAME_EVENTS } from '../events/GameEvents'
import { playSfx, SFX_KEYS } from '../systems/AudioSystem'
import { QuestCelebration } from '../ui/overlays/QuestCelebration'
import type { FastTravelDestination } from '../systems/FastTravelSystem'

interface DialogSceneData {
  readonly dialogTreeId: string
  readonly npcName: string
  readonly npcType: string
  readonly npcId?: string
  readonly messages?: ReadonlyArray<string>
  readonly parentSceneKey?: string
  readonly unlockedDestinations?: ReadonlyArray<FastTravelDestination>
}

const TYPEWRITER_DELAY = 30

export class DialogScene extends Phaser.Scene {
  private dialogTree!: DialogTree
  private currentNode!: DialogNode
  private npcName!: string
  private npcType!: string
  private npcId: string = ''
  private parentSceneKey: string = SCENE_KEYS.WORLD
  private dialogBox!: Phaser.GameObjects.Container
  private speakerText!: Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text
  private choiceButtons: Phaser.GameObjects.Container[] = []
  private isTyping: boolean = false
  private fullText: string = ''
  private typewriterTimer: Phaser.Time.TimerEvent | null = null
  private pendingCelebration: { questId: string } | null = null
  private pendingFastTravel: string | null = null
  private unlockedDestinations: ReadonlyArray<FastTravelDestination> = []

  constructor() {
    super({ key: SCENE_KEYS.DIALOG })
  }

  create(data: DialogSceneData): void {
    this.npcName = data.npcName
    this.npcType = data.npcType
    this.npcId = data.npcId ?? ''
    this.parentSceneKey = data.parentSceneKey ?? SCENE_KEYS.WORLD
    this.pendingCelebration = null
    this.pendingFastTravel = null
    this.unlockedDestinations = data.unlockedDestinations ?? []

    // Track NPC talk for quest objectives
    if (this.npcId) {
      try {
        const state = getGameState(this)
        const updatedQuests = trackNpcTalk(state.activeQuests, this.npcId)
        if (updatedQuests !== state.activeQuests) {
          setGameState(this, updateActiveQuests(state, updatedQuests))
        }
      } catch {
        // No game state yet
      }
    }

    // Handle simple messages (for signs, boss dialogs, etc.)
    if (data.messages && data.messages.length > 0) {
      this.handleSimpleMessages(data)
      return
    }

    const tree = getDialogTree(data.dialogTreeId)
    if (!tree) {
      this.closeDialog()
      return
    }

    this.dialogTree = tree
    const startNode = getStartNode(tree)
    if (!startNode) {
      this.closeDialog()
      return
    }

    this.currentNode = startNode

    // Semi-transparent background
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.5)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.setDepth(DEPTH.OVERLAY)

    this.createDialogBox()
    this.showNode(this.currentNode)

    // Click/Space to advance
    this.input.on('pointerdown', () => this.handleAdvance())
    this.input.keyboard?.on('keydown-SPACE', () => this.handleAdvance())
    this.input.keyboard?.on('keydown-E', () => this.handleAdvance())
  }

  private createDialogBox(): void {
    const boxWidth = 750
    const boxHeight = 300  // Much taller for mobile-friendly buttons
    const boxX = (GAME_WIDTH - boxWidth) / 2
    const boxY = (GAME_HEIGHT - boxHeight) / 2  // Center vertically

    this.dialogBox = this.add.container(boxX, boxY)
    this.dialogBox.setDepth(DEPTH.OVERLAY + 1)

    // Background
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.95)
    bg.fillRoundedRect(0, 0, boxWidth, boxHeight, 14)
    bg.lineStyle(3, COLORS.PRIMARY)
    bg.strokeRoundedRect(0, 0, boxWidth, boxHeight, 14)
    this.dialogBox.add(bg)

    // Speaker name
    this.speakerText = this.add.text(24, 16, '', {
      ...TEXT_STYLES.BODY,
      fontSize: '22px',
      color: '#ffd54f',
      fontStyle: 'bold',
    })
    this.dialogBox.add(this.speakerText)

    // Message text
    this.messageText = this.add.text(24, 48, '', {
      ...TEXT_STYLES.BODY,
      fontSize: '20px',
      wordWrap: { width: boxWidth - 48 },
      lineSpacing: 6,
    })
    this.dialogBox.add(this.messageText)
  }

  private showNode(node: DialogNode): void {
    this.currentNode = node
    this.speakerText.setText(node.speaker)
    this.clearChoices()

    // Typewriter effect
    this.fullText = node.text
    this.messageText.setText('')
    this.isTyping = true

    let charIndex = 0
    this.typewriterTimer = this.time.addEvent({
      delay: TYPEWRITER_DELAY,
      callback: () => {
        charIndex++
        this.messageText.setText(this.fullText.substring(0, charIndex))
        if (charIndex >= this.fullText.length) {
          this.isTyping = false
          this.typewriterTimer?.remove()
          this.typewriterTimer = null
          this.showChoicesOrContinue()
        }
      },
      repeat: this.fullText.length - 1,
    })
  }

  private handleAdvance(): void {
    if (this.isTyping) {
      // Skip typewriter - show full text immediately
      this.typewriterTimer?.remove()
      this.typewriterTimer = null
      this.isTyping = false
      this.messageText.setText(this.fullText)
      this.showChoicesOrContinue()
      return
    }

    // If no choices and is end node, close dialog
    if (isEndNode(this.currentNode) && this.choiceButtons.length === 0) {
      this.closeDialog()
    }
  }

  private showChoicesOrContinue(): void {
    if (this.currentNode.choices.length === 0 || isEndNode(this.currentNode)) {
      // Show "tap to continue" hint
      const hint = this.add.text(726, 280, 'Tap to continue...', {
        ...TEXT_STYLES.SMALL,
        fontSize: '16px',
        color: '#b0bec5',
      })
      hint.setOrigin(1, 1)
      this.dialogBox.add(hint)
      return
    }

    // Filter choices based on quest completion status
    let filteredChoices = this.filterQuestChoices(this.currentNode.choices)

    // If we have unlocked destinations info, filter hub choices
    if (this.unlockedDestinations.length > 0) {
      filteredChoices = this.filterHubChoices(filteredChoices)

      // If no destinations available after filtering, show a message
      const hasFastTravelChoices = filteredChoices.some((c) => c.action === 'fast_travel')
      if (!hasFastTravelChoices && this.currentNode.choices.some((c) => c.action === 'fast_travel')) {
        // All fast travel options were filtered out - add a "no destinations" option
        filteredChoices = [
          {
            text: 'No destinations unlocked yet',
            nextNodeId: 'cancel',
            action: undefined,
            actionData: undefined,
          },
        ]
      }
    }

    this.showChoices(filteredChoices)
  }

  /**
   * Filter dialog choices to only show quests the player can actually interact with.
   * - complete_quest actions: Only show if quest is ready to turn in (status === 'completed')
   * - accept_quest actions: Only show if quest hasn't been accepted or completed yet
   * - Choices leading to quest offer nodes: Only show if that quest is available
   */
  private filterQuestChoices(choices: ReadonlyArray<DialogChoice>): ReadonlyArray<DialogChoice> {
    try {
      const state = getGameState(this)

      // Filter choices based on quest status
      const filtered = choices.filter((choice) => {
        // Handle explicit quest actions
        if (choice.action === 'complete_quest') {
          const questId = choice.actionData
          if (!questId) return false
          // Only show if quest is ready to turn in
          const progress = state.activeQuests.find((q) => q.questId === questId)
          return progress?.status === 'completed'
        }

        if (choice.action === 'accept_quest') {
          const questId = choice.actionData
          if (!questId) return false
          // Only show if quest hasn't been accepted or completed (unless repeatable)
          const quest = getQuest(questId)
          const isActive = state.activeQuests.some((q) => q.questId === questId)
          const isCompleted = state.completedQuestIds.includes(questId)
          // Allow if not active, and either not completed or is repeatable
          return !isActive && (!isCompleted || (quest?.isRepeatable ?? false))
        }

        // Check if this choice leads to a quest offer node
        if (choice.nextNodeId) {
          const nextNode = getDialogNode(this.dialogTree, choice.nextNodeId)
          if (nextNode) {
            // Look for accept_quest action in the next node's choices
            const acceptChoice = nextNode.choices.find((c) => c.action === 'accept_quest')
            if (acceptChoice?.actionData) {
              const questId = acceptChoice.actionData
              const quest = getQuest(questId)
              const isActive = state.activeQuests.some((q) => q.questId === questId)
              const isCompleted = state.completedQuestIds.includes(questId)
              // Filter out if quest is active or completed (unless repeatable)
              if (isActive || (isCompleted && !(quest?.isRepeatable ?? false))) {
                return false
              }
            }
          }
        }

        return true
      })

      // Check if this is a quest-related node
      const hasCompleteQuestChoices = choices.some((c) => c.action === 'complete_quest')
      const hasAcceptQuestChoices = choices.some((c) => c.action === 'accept_quest')
      const hasQuestOfferLinks = choices.some((c) => {
        if (!c.nextNodeId) return false
        const nextNode = getDialogNode(this.dialogTree, c.nextNodeId)
        return nextNode?.choices.some((nc) => nc.action === 'accept_quest') ?? false
      })

      // Handle empty quest turn-in list
      if (hasCompleteQuestChoices) {
        const completableQuests = filtered.filter((c) => c.action === 'complete_quest')
        if (completableQuests.length === 0) {
          // Find the "back" or "never mind" choice from original choices
          const backChoice = choices.find((c) =>
            c.action !== 'complete_quest' &&
            (c.text.toLowerCase().includes('back') ||
             c.text.toLowerCase().includes('never mind') ||
             c.nextNodeId === 'greeting' ||
             c.nextNodeId === 'quest-hub')
          )

          // Return only non-complete_quest choices plus a "no quests" message
          const nonCompleteChoices = filtered.filter((c) => c.action !== 'complete_quest')
          return [
            {
              text: 'No quests ready to turn in',
              nextNodeId: backChoice?.nextNodeId ?? null,
              action: undefined,
              actionData: undefined,
            },
            ...nonCompleteChoices,
          ]
        }
      }

      // Handle empty quest selection list (all quests completed)
      if (hasQuestOfferLinks && !hasAcceptQuestChoices && !hasCompleteQuestChoices) {
        // Count how many quest offer choices remain
        const questOfferChoices = filtered.filter((c) => {
          if (!c.nextNodeId) return false
          const nextNode = getDialogNode(this.dialogTree, c.nextNodeId)
          return nextNode?.choices.some((nc) => nc.action === 'accept_quest') ?? false
        })

        if (questOfferChoices.length === 0) {
          // Find the "back" choice
          const backChoice = filtered.find((c) =>
            c.text.toLowerCase().includes('back') ||
            c.text.toLowerCase().includes('never mind') ||
            c.nextNodeId === 'greeting' ||
            c.nextNodeId === 'quest-hub'
          )

          // Return message plus back option
          const nonQuestChoices = filtered.filter((c) => {
            if (!c.nextNodeId) return true
            const nextNode = getDialogNode(this.dialogTree, c.nextNodeId)
            return !(nextNode?.choices.some((nc) => nc.action === 'accept_quest') ?? false)
          })

          return [
            {
              text: 'All quests completed!',
              nextNodeId: backChoice?.nextNodeId ?? null,
              action: undefined,
              actionData: undefined,
            },
            ...nonQuestChoices.filter((c) => c !== backChoice),
            ...(backChoice ? [backChoice] : []),
          ]
        }
      }

      return filtered
    } catch {
      // No game state, return original choices
      return choices
    }
  }

  private showChoices(choices: ReadonlyArray<DialogChoice>): void {
    this.clearChoices()

    choices.forEach((choice, index) => {
      const btnWidth = 345
      const btnHeight = 60  // Much taller for easy mobile tapping
      const col = index % 2
      const row = Math.floor(index / 2)
      const btnX = 24 + col * (btnWidth + 16)
      const btnY = 140 + row * (btnHeight + 16)  // More vertical spacing

      const container = this.add.container(btnX, btnY)

      const bg = this.add.graphics()
      bg.fillStyle(COLORS.SECONDARY, 0.5)
      bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 12)
      bg.lineStyle(2, COLORS.PRIMARY, 0.6)
      bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 12)
      container.add(bg)

      const text = this.add.text(btnWidth / 2, btnHeight / 2, choice.text, {
        ...TEXT_STYLES.BODY,
        fontSize: '18px',
      })
      text.setOrigin(0.5)
      container.add(text)

      const hitArea = this.add.rectangle(btnWidth / 2, btnHeight / 2, btnWidth, btnHeight)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerover', () => {
        bg.clear()
        bg.fillStyle(COLORS.SECONDARY, 0.8)
        bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 12)
        bg.lineStyle(2, COLORS.PRIMARY, 0.9)
        bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 12)
      })
      hitArea.on('pointerout', () => {
        bg.clear()
        bg.fillStyle(COLORS.SECONDARY, 0.5)
        bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 12)
        bg.lineStyle(2, COLORS.PRIMARY, 0.6)
        bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 12)
      })
      hitArea.on('pointerdown', () => this.handleChoice(choice))
      container.add(hitArea)

      this.dialogBox.add(container)
      this.choiceButtons.push(container)
    })
  }

  private handleChoice(choice: DialogChoice): void {
    // Execute action if present
    if (choice.action) {
      this.executeAction(choice.action, choice.actionData)
    }

    // Navigate to next node or close
    if (choice.nextNodeId) {
      const nextNode = getDialogNode(this.dialogTree, choice.nextNodeId)
      if (nextNode) {
        this.showNode(nextNode)
        return
      }
    }

    this.closeDialog()
  }

  private executeAction(action: string, data?: string): void {
    switch (action) {
      case 'open_shop':
        this.closeDialog()
        this.scene.launch(SCENE_KEYS.SHOP, { shopId: 'village-shop', mode: data ?? 'buy' })
        return
      case 'open_breeding':
        this.closeDialog()
        this.scene.launch(SCENE_KEYS.BREEDING)
        return
      case 'heal_party': {
        const state = getGameState(this)
        const healed = fullHeal(state.player)
        setGameState(this, updatePlayer(state, healed))
        break
      }
      case 'accept_quest': {
        if (!data) break
        this.handleAcceptQuest(data)
        break
      }
      case 'complete_quest': {
        if (!data) break
        this.handleCompleteQuest(data)
        break
      }
      case 'fast_travel': {
        if (!data) break
        this.pendingFastTravel = data
        break
      }
    }
  }

  private handleAcceptQuest(questId: string): void {
    const quest = getQuest(questId)
    if (!quest) return

    try {
      const state = getGameState(this)
      const newActiveQuests = acceptQuest(quest, state.activeQuests)

      setGameState(this, updateActiveQuests(state, newActiveQuests))

      // Play SFX
      playSfx(SFX_KEYS.QUEST_ACCEPT)

      // Emit event
      const newProgress = newActiveQuests.find((q) => q.questId === questId)
      if (newProgress) {
        EventBus.emit(GAME_EVENTS.QUEST_ACCEPTED, { quest, progress: newProgress })
      }
    } catch {
      // No game state yet
    }
  }

  private handleCompleteQuest(questId: string): void {
    const quest = getQuest(questId)
    if (!quest) return

    try {
      const state = getGameState(this)

      // Find the quest progress
      const progress = state.activeQuests.find((q) => q.questId === questId)
      if (!progress || progress.status !== 'completed') return

      // Complete the quest
      const result = completeQuest(state.activeQuests, state.completedQuestIds, questId)

      // Apply rewards
      let updatedPlayer = addExperience(state.player, quest.rewards.experience)
      updatedPlayer = updatePlayerGold(updatedPlayer, quest.rewards.gold)

      // Add item rewards
      let inventory = state.inventory
      for (const reward of quest.rewards.items) {
        const newInv = addItem(inventory, reward.itemId, reward.quantity)
        if (newInv) inventory = newInv
      }

      // Add equipment reward as a key item (equipment grants are handled separately)
      // The equipmentId would be granted via EquipmentSystem when implementing equipment grants

      // Update state
      let newState = updateActiveQuests(state, result.activeQuests)
      newState = updateCompletedQuests(newState, result.completedIds)
      newState = updatePlayer(newState, updatedPlayer)
      newState = updateInventory(newState, inventory)

      setGameState(this, newState)

      // Play SFX
      playSfx(SFX_KEYS.QUEST_COMPLETE)

      // Emit event
      EventBus.emit(GAME_EVENTS.QUEST_COMPLETED, { quest, rewards: quest.rewards })

      // Set pending celebration (will be shown after dialog closes)
      this.pendingCelebration = { questId }
    } catch {
      // No game state yet
    }
  }

  private handleSimpleMessages(data: DialogSceneData): void {
    if (!data.messages || data.messages.length === 0) {
      this.closeDialog()
      return
    }

    // Semi-transparent background
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.5)
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    bg.setDepth(DEPTH.OVERLAY)

    this.createDialogBox()

    // Create simple nodes from messages
    const nodes: DialogNode[] = data.messages.map((msg, i) => ({
      nodeId: `msg-${i}`,
      speaker: data.npcName,
      text: msg,
      choices: [],
      isEnd: i === data.messages!.length - 1,
    }))

    // Create a synthetic dialog tree
    this.dialogTree = {
      treeId: 'simple-messages',
      startNodeId: 'msg-0',
      nodes,
    }

    this.currentNode = nodes[0]
    this.showNode(this.currentNode)

    // Override advance to go through messages
    let currentIndex = 0
    const advanceHandler = () => {
      if (this.isTyping) {
        this.typewriterTimer?.remove()
        this.typewriterTimer = null
        this.isTyping = false
        this.messageText.setText(this.fullText)
        return
      }

      currentIndex++
      if (currentIndex < nodes.length) {
        this.showNode(nodes[currentIndex])
      } else {
        this.closeDialog()
      }
    }

    this.input.off('pointerdown')
    this.input.keyboard?.off('keydown-SPACE')
    this.input.keyboard?.off('keydown-E')

    this.input.on('pointerdown', advanceHandler)
    this.input.keyboard?.on('keydown-SPACE', advanceHandler)
    this.input.keyboard?.on('keydown-E', advanceHandler)
  }

  private clearChoices(): void {
    for (const btn of this.choiceButtons) {
      btn.destroy()
    }
    this.choiceButtons = []
  }

  private closeDialog(): void {
    this.clearChoices()
    this.typewriterTimer?.remove()

    // Check if we need to show quest celebration
    if (this.pendingCelebration) {
      const quest = getQuest(this.pendingCelebration.questId)
      if (quest) {
        // Show celebration overlay, then resume parent scene when dismissed
        new QuestCelebration(this, quest, quest.rewards, () => {
          const parentScene = this.scene.get(this.parentSceneKey)
          if (parentScene) {
            this.scene.resume(this.parentSceneKey)
          }
          this.scene.stop()
        })
        this.pendingCelebration = null
        return
      }
    }

    // Check if fast travel was requested
    if (this.pendingFastTravel) {
      const targetAreaId = this.pendingFastTravel
      this.pendingFastTravel = null

      // Resume parent scene first
      const parentScene = this.scene.get(this.parentSceneKey)
      if (parentScene) {
        this.scene.resume(this.parentSceneKey)
      }

      // Emit fast travel event (WorldScene will handle the actual transition)
      EventBus.emit(GAME_EVENTS.FAST_TRAVEL_REQUESTED, { targetAreaId })

      this.scene.stop()
      return
    }

    // Resume the parent scene (WorldScene or BattleScene)
    const parentScene = this.scene.get(this.parentSceneKey)
    if (parentScene) {
      this.scene.resume(this.parentSceneKey)
    }

    this.scene.stop()
  }

  /**
   * Filter hub dialog choices to only show unlocked destinations
   */
  private filterHubChoices(choices: ReadonlyArray<DialogChoice>): ReadonlyArray<DialogChoice> {
    if (this.unlockedDestinations.length === 0) {
      return choices
    }

    const unlockedAreaIds = new Set(this.unlockedDestinations.map((d) => d.areaId))

    return choices.filter((choice) => {
      // If it's a fast_travel action, check if destination is unlocked
      if (choice.action === 'fast_travel' && choice.actionData) {
        return unlockedAreaIds.has(choice.actionData)
      }
      // Keep non-fast-travel choices (like "Stay here")
      return true
    })
  }
}

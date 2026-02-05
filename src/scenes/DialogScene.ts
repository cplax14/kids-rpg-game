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

interface DialogSceneData {
  readonly dialogTreeId: string
  readonly npcName: string
  readonly npcType: string
  readonly npcId?: string
  readonly messages?: ReadonlyArray<string>
}

const TYPEWRITER_DELAY = 30

export class DialogScene extends Phaser.Scene {
  private dialogTree!: DialogTree
  private currentNode!: DialogNode
  private npcName!: string
  private npcType!: string
  private npcId: string = ''
  private dialogBox!: Phaser.GameObjects.Container
  private speakerText!: Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text
  private choiceButtons: Phaser.GameObjects.Container[] = []
  private isTyping: boolean = false
  private fullText: string = ''
  private typewriterTimer: Phaser.Time.TimerEvent | null = null
  private pendingCelebration: { questId: string } | null = null

  constructor() {
    super({ key: SCENE_KEYS.DIALOG })
  }

  create(data: DialogSceneData): void {
    this.npcName = data.npcName
    this.npcType = data.npcType
    this.npcId = data.npcId ?? ''
    this.pendingCelebration = null

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
    const boxWidth = 700
    const boxHeight = 180
    const boxX = (GAME_WIDTH - boxWidth) / 2
    const boxY = GAME_HEIGHT - boxHeight - 40

    this.dialogBox = this.add.container(boxX, boxY)
    this.dialogBox.setDepth(DEPTH.OVERLAY + 1)

    // Background
    const bg = this.add.graphics()
    bg.fillStyle(COLORS.PANEL_BG, 0.95)
    bg.fillRoundedRect(0, 0, boxWidth, boxHeight, 12)
    bg.lineStyle(2, COLORS.PRIMARY)
    bg.strokeRoundedRect(0, 0, boxWidth, boxHeight, 12)
    this.dialogBox.add(bg)

    // Speaker name
    this.speakerText = this.add.text(20, 12, '', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      color: '#ffd54f',
      fontStyle: 'bold',
    })
    this.dialogBox.add(this.speakerText)

    // Message text
    this.messageText = this.add.text(20, 38, '', {
      ...TEXT_STYLES.BODY,
      fontSize: '16px',
      wordWrap: { width: boxWidth - 40 },
      lineSpacing: 4,
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
      // Show "click to continue" hint
      const hint = this.add.text(680, 160, 'Click to continue...', {
        ...TEXT_STYLES.SMALL,
        fontSize: '12px',
        color: '#b0bec5',
      })
      hint.setOrigin(1, 1)
      this.dialogBox.add(hint)
      return
    }

    this.showChoices(this.currentNode.choices)
  }

  private showChoices(choices: ReadonlyArray<DialogChoice>): void {
    this.clearChoices()

    choices.forEach((choice, index) => {
      const btnWidth = 320
      const btnHeight = 36
      const col = index % 2
      const row = Math.floor(index / 2)
      const btnX = 20 + col * (btnWidth + 20)
      const btnY = 100 + row * (btnHeight + 8)

      const container = this.add.container(btnX, btnY)

      const bg = this.add.graphics()
      bg.fillStyle(COLORS.SECONDARY, 0.4)
      bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 8)
      container.add(bg)

      const text = this.add.text(btnWidth / 2, btnHeight / 2, choice.text, {
        ...TEXT_STYLES.BODY,
        fontSize: '14px',
      })
      text.setOrigin(0.5)
      container.add(text)

      const hitArea = this.add.rectangle(btnWidth / 2, btnHeight / 2, btnWidth, btnHeight)
      hitArea.setInteractive({ useHandCursor: true })
      hitArea.on('pointerover', () => {
        bg.clear()
        bg.fillStyle(COLORS.SECONDARY, 0.7)
        bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 8)
      })
      hitArea.on('pointerout', () => {
        bg.clear()
        bg.fillStyle(COLORS.SECONDARY, 0.4)
        bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 8)
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

    // Resume the world scene
    const worldScene = this.scene.get(SCENE_KEYS.WORLD)
    if (worldScene) {
      this.scene.resume(SCENE_KEYS.WORLD)
    }

    this.scene.stop()
  }
}

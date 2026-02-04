import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadDialogData,
  getDialogTree,
  getDialogNode,
  getStartNode,
  getNextNode,
  hasChoices,
  isEndNode,
  type DialogTree,
  type DialogNode,
  type DialogChoice,
} from '../../../src/systems/DialogSystem'

// ── Fixtures ──

const greetingNode: DialogNode = {
  nodeId: 'greeting',
  speaker: 'Elder',
  text: 'Welcome, young adventurer!',
  choices: [
    { text: 'Tell me more', nextNodeId: 'info', action: undefined, actionData: undefined },
    { text: 'Goodbye', nextNodeId: 'farewell', action: undefined, actionData: undefined },
  ],
  isEnd: false,
}

const infoNode: DialogNode = {
  nodeId: 'info',
  speaker: 'Elder',
  text: 'The world is full of monsters to befriend.',
  choices: [
    { text: 'Thanks!', nextNodeId: 'farewell', action: undefined, actionData: undefined },
  ],
  isEnd: false,
}

const farewellNode: DialogNode = {
  nodeId: 'farewell',
  speaker: 'Elder',
  text: 'Safe travels!',
  choices: [],
  isEnd: true,
}

const testTree: DialogTree = {
  treeId: 'elder-greeting',
  startNodeId: 'greeting',
  nodes: [greetingNode, infoNode, farewellNode],
}

const shopTree: DialogTree = {
  treeId: 'shop-keeper',
  startNodeId: 'shop-hello',
  nodes: [
    {
      nodeId: 'shop-hello',
      speaker: 'Shopkeeper',
      text: 'What can I get for you?',
      choices: [{ text: 'Open shop', nextNodeId: null, action: 'open_shop', actionData: 'village-shop' }],
      isEnd: false,
    },
  ],
}

// ── loadDialogData ──

describe('loadDialogData', () => {
  beforeEach(() => {
    loadDialogData([])
  })

  it('should load dialog trees into the registry', () => {
    loadDialogData([testTree, shopTree])

    expect(getDialogTree('elder-greeting')).toBeDefined()
    expect(getDialogTree('shop-keeper')).toBeDefined()
  })

  it('should replace previously loaded data', () => {
    loadDialogData([testTree])
    expect(getDialogTree('elder-greeting')).toBeDefined()

    loadDialogData([shopTree])
    expect(getDialogTree('elder-greeting')).toBeUndefined()
    expect(getDialogTree('shop-keeper')).toBeDefined()
  })
})

// ── getDialogTree ──

describe('getDialogTree', () => {
  beforeEach(() => {
    loadDialogData([testTree, shopTree])
  })

  it('should return the correct dialog tree by ID', () => {
    const tree = getDialogTree('elder-greeting')

    expect(tree).toBeDefined()
    expect(tree!.treeId).toBe('elder-greeting')
    expect(tree!.nodes).toHaveLength(3)
  })

  it('should return undefined for a non-existent tree ID', () => {
    const tree = getDialogTree('non-existent')

    expect(tree).toBeUndefined()
  })
})

// ── getDialogNode ──

describe('getDialogNode', () => {
  it('should return the correct node by ID', () => {
    const node = getDialogNode(testTree, 'info')

    expect(node).toBeDefined()
    expect(node!.nodeId).toBe('info')
    expect(node!.speaker).toBe('Elder')
  })

  it('should return undefined for a non-existent node ID', () => {
    const node = getDialogNode(testTree, 'does-not-exist')

    expect(node).toBeUndefined()
  })
})

// ── getStartNode ──

describe('getStartNode', () => {
  it('should return the start node of the tree', () => {
    const node = getStartNode(testTree)

    expect(node).toBeDefined()
    expect(node!.nodeId).toBe('greeting')
    expect(node!.text).toBe('Welcome, young adventurer!')
  })

  it('should return undefined when the start node ID does not match any node', () => {
    const brokenTree: DialogTree = {
      treeId: 'broken',
      startNodeId: 'missing',
      nodes: [greetingNode],
    }

    const node = getStartNode(brokenTree)

    expect(node).toBeUndefined()
  })
})

// ── getNextNode ──

describe('getNextNode', () => {
  it('should return the next node based on the choice', () => {
    const choice: DialogChoice = { text: 'Tell me more', nextNodeId: 'info' }

    const next = getNextNode(testTree, choice)

    expect(next).toBeDefined()
    expect(next!.nodeId).toBe('info')
  })

  it('should return null when choice has no nextNodeId', () => {
    const choice: DialogChoice = { text: 'Open shop', nextNodeId: null, action: 'open_shop' }

    const next = getNextNode(testTree, choice)

    expect(next).toBeNull()
  })

  it('should return null when nextNodeId does not match any node', () => {
    const choice: DialogChoice = { text: 'Go away', nextNodeId: 'non-existent' }

    const next = getNextNode(testTree, choice)

    expect(next).toBeNull()
  })
})

// ── hasChoices ──

describe('hasChoices', () => {
  it('should return true when node has choices', () => {
    expect(hasChoices(greetingNode)).toBe(true)
  })

  it('should return false when node has no choices', () => {
    expect(hasChoices(farewellNode)).toBe(false)
  })
})

// ── isEndNode ──

describe('isEndNode', () => {
  it('should return true when isEnd flag is true', () => {
    expect(isEndNode(farewellNode)).toBe(true)
  })

  it('should return false when isEnd is false and node has choices', () => {
    expect(isEndNode(greetingNode)).toBe(false)
  })

  it('should return true when node has no choices even if isEnd is false', () => {
    const noChoicesNode: DialogNode = {
      nodeId: 'dead-end',
      speaker: 'NPC',
      text: 'Hmm...',
      choices: [],
      isEnd: false,
    }

    expect(isEndNode(noChoicesNode)).toBe(true)
  })
})

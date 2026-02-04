// ── Dialog Types ──

export interface DialogChoice {
  readonly text: string
  readonly nextNodeId: string | null
  readonly action?: string
  readonly actionData?: string
}

export interface DialogNode {
  readonly nodeId: string
  readonly speaker: string
  readonly text: string
  readonly choices: ReadonlyArray<DialogChoice>
  readonly isEnd: boolean
}

export interface DialogTree {
  readonly treeId: string
  readonly startNodeId: string
  readonly nodes: ReadonlyArray<DialogNode>
}

// ── Dialog Registry ──

let dialogRegistry: ReadonlyArray<DialogTree> = []

export function loadDialogData(dialogs: ReadonlyArray<DialogTree>): void {
  dialogRegistry = dialogs
}

export function getDialogTree(treeId: string): DialogTree | undefined {
  return dialogRegistry.find((d) => d.treeId === treeId)
}

export function getDialogNode(tree: DialogTree, nodeId: string): DialogNode | undefined {
  return tree.nodes.find((n) => n.nodeId === nodeId)
}

export function getStartNode(tree: DialogTree): DialogNode | undefined {
  return getDialogNode(tree, tree.startNodeId)
}

// ── Dialog Navigation ──

export function getNextNode(tree: DialogTree, choice: DialogChoice): DialogNode | null {
  if (!choice.nextNodeId) return null
  return getDialogNode(tree, choice.nextNodeId) ?? null
}

export function hasChoices(node: DialogNode): boolean {
  return node.choices.length > 0
}

export function isEndNode(node: DialogNode): boolean {
  return node.isEnd || (node.choices.length === 0)
}

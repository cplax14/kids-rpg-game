export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toString()
}

export function formatGold(amount: number): string {
  return `${formatNumber(amount)}G`
}

export function formatHpMp(current: number, max: number): string {
  return `${current}/${max}`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function formatElementName(element: string): string {
  return element.charAt(0).toUpperCase() + element.slice(1)
}

export function formatStatName(stat: string): string {
  const names: Record<string, string> = {
    maxHp: 'HP',
    currentHp: 'HP',
    maxMp: 'MP',
    currentMp: 'MP',
    attack: 'ATK',
    defense: 'DEF',
    magicAttack: 'M.ATK',
    magicDefense: 'M.DEF',
    speed: 'SPD',
    luck: 'LCK',
  }
  return names[stat] ?? stat
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength - 3)}...`
}

export function padStart(value: string | number, length: number, char: string = ' '): string {
  return String(value).padStart(length, char)
}

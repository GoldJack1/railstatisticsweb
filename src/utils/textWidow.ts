export function preventSingleWordWidow(text: string): string {
  const trimmed = text.trim()
  const lastSpaceIndex = trimmed.lastIndexOf(' ')

  if (lastSpaceIndex <= 0) return text

  return `${trimmed.slice(0, lastSpaceIndex)}\u00A0${trimmed.slice(lastSpaceIndex + 1)}`
}


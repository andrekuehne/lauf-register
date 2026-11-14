/** Text as people mean it: case, surrounding and doubled spaces don't make a difference. */
export function normalizedText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

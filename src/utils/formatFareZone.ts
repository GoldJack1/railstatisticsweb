/**
 * Format raw fare zone codes (e.g. tflz1, tflz12) for display.
 * Returns the original value if no mapping is defined.
 */
export function formatFareZoneDisplay(raw: string | null | undefined): string {
  if (raw == null || raw === '') return ''
  const key = raw.toLowerCase().trim()
  const known: Record<string, string> = {
    tflz1: 'TfL Zone 1',
    tflz12: 'TfL Zone 1/2',
    tflz2: 'TfL Zone 2',
    tflz23: 'TfL Zone 2/3',
    tflz3: 'TfL Zone 3',
    tflz34: 'TfL Zone 3/4',
    tflz4: 'TfL Zone 4',
    tflz45: 'TfL Zone 4/5',
    tflz5: 'TfL Zone 5',
    tflz56: 'TfL Zone 5/6',
    tflz6: 'TfL Zone 6',
    tflz7: 'TfL Zone 7',
    tflz8: 'TfL Zone 8',
    tflz9: 'TfL Zone 9',
  }
  return known[key] ?? raw
}

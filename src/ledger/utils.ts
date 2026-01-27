export function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return 'evt_' + timestamp + '_' + random;
}

export function generateWarningId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return 'warn_' + timestamp + '_' + random;
}

export function parseNorwegianDate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  const match = dateStr.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0');
  }
  
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  
  throw new Error('Ugyldig datoformat: ' + dateStr);
}

export function parseNorwegianNumber(numStr: string): number {
  let cleaned = numStr.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) throw new Error('Ugyldig tallformat: ' + numStr);
  return num;
}

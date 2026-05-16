export type CsvRow = Record<string, string | number | boolean | null | undefined>

export function rowsToCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return ''
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key))
    return set
  }, new Set<string>()))

  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => headers.map(header => escapeCsvCell(row[header])).join(',')),
  ].join('\n')
}

export function arrayToCsv(rows: string[][]): string {
  return rows.map(row => row.map(escapeCsvCell).join(',')).join('\n')
}

export function downloadCsv(rows: CsvRow[] | string[][], filename: string) {
  const csv = Array.isArray(rows[0])
    ? arrayToCsv(rows as string[][])
    : rowsToCsv(rows as CsvRow[])
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseCsv(text: string): Record<string, string>[] {
  const parsed = parseCsvRows(text)
  if (parsed.length === 0) return []
  const headers = parsed[0].map(header => header.trim())
  return parsed.slice(1).filter(row => row.some(cell => cell.trim() !== '')).map(row => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = row[index] ?? ''
    })
    return record
  })
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  rows.push(row)
  return rows
}

function escapeCsvCell(value: CsvRow[string] | string): string {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

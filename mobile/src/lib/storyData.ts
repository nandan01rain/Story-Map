// Ported directly from the PWA (index.html) -- BOOKS/BOOK_TARGETS are hardcoded
// project-wide constants, not stored data; statusColor's palette matches the PWA's
// CSS custom properties (--gray/--gold/--ember/--teal).
export const BOOKS = ['Book One', 'Book Two', 'Book Three', 'Book Four', 'Book Five'];

export const STATUS_COLORS: Record<string, string> = {
  idea: '#6b5d42',
  outline: '#c69a3a',
  drafted: '#b8542e',
  final: '#2f9d8a',
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.idea;
}

export function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Parse a month string in YYYY-MM format.
 * Returns the current month if no input is provided.
 * Throws if the format is invalid.
 */
export function parseMonth(month?: string): string {
  if (month === undefined || month === null) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }

  return month;
}

/**
 * Get ISO date boundaries for a given YYYY-MM month.
 * Returns start-of-month and end-of-month Date objects.
 */
export function getMonthBoundaries(month: string): {
  start: Date;
  end: Date;
} {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

/**
 * Current ISO timestamp string.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

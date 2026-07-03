export const ICON_GRID_MIN_COLUMN_WIDTH = 80;
export const ICON_GRID_GAP = 4;
export const ICON_GRID_ESTIMATED_ROW_HEIGHT = 82;

export function getIconGridColumnCount(
  width: number,
  minColumnWidth = ICON_GRID_MIN_COLUMN_WIDTH,
  gap = ICON_GRID_GAP,
) {
  if (width <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)));
}

export function getIconGridRowCount(itemCount: number, columnCount: number) {
  if (itemCount <= 0) {
    return 0;
  }

  return Math.ceil(itemCount / Math.max(1, columnCount));
}

export function getIconGridRowItems<T>(items: T[], rowIndex: number, columnCount: number): T[] {
  const normalizedColumnCount = Math.max(1, columnCount);
  const start = rowIndex * normalizedColumnCount;
  return items.slice(start, start + normalizedColumnCount);
}

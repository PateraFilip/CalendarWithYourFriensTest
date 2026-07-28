/**
 * Google Calendar–style column packing for overlapping timed events.
 * Events that don't overlap can share a column; concurrent ones sit side-by-side.
 */
export type TimedInterval = {
  start: Date;
  end: Date;
};

export type PackedLayout = {
  column: number;
  /** Columns in this overlap cluster (for width = 1/clusterColumns) */
  clusterColumns: number;
};

function overlaps(a: TimedInterval, b: TimedInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Assign each event a column index and the width divisor for its overlap cluster.
 */
export function packTimedEvents<T extends TimedInterval>(
  events: T[]
): Map<T, PackedLayout> {
  const result = new Map<T, PackedLayout>();
  if (!events.length) return result;

  const sorted = [...events].sort((a, b) => {
    const ds = a.start.getTime() - b.start.getTime();
    if (ds !== 0) return ds;
    return b.end.getTime() - a.end.getTime();
  });

  // Greedy columns
  const columns: T[][] = [];
  const colIndex = new Map<T, number>();

  for (const event of sorted) {
    let placed = false;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const last = col[col.length - 1];
      if (last.end <= event.start) {
        col.push(event);
        colIndex.set(event, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      colIndex.set(event, columns.length);
      columns.push([event]);
    }
  }

  // Clusters: connected components by overlap
  const parent = new Map<T, T>();
  const find = (x: T): T => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(x, p);
    return p;
  };
  const union = (a: T, b: T) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const e of sorted) parent.set(e, e);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].start >= sorted[i].end) break;
      if (overlaps(sorted[i], sorted[j])) union(sorted[i], sorted[j]);
    }
  }

  const clusterMembers = new Map<T, T[]>();
  for (const e of sorted) {
    const root = find(e);
    const list = clusterMembers.get(root) ?? [];
    list.push(e);
    clusterMembers.set(root, list);
  }

  const clusterWidth = new Map<T, number>();
  for (const [, members] of clusterMembers) {
    let maxCol = 0;
    for (const m of members) maxCol = Math.max(maxCol, colIndex.get(m) ?? 0);
    const width = maxCol + 1;
    for (const m of members) clusterWidth.set(m, width);
  }

  for (const e of sorted) {
    result.set(e, {
      column: colIndex.get(e) ?? 0,
      clusterColumns: clusterWidth.get(e) ?? 1,
    });
  }
  return result;
}

/** How many title lines fit in an event block without overflowing its height. */
export function eventBlockTitleLines(
  blockHeight: number,
  options?: {
    paddingY?: number;
    titleLineHeight?: number;
    reservedBelow?: number;
  }
): number {
  const paddingY = options?.paddingY ?? 4;
  const titleLineHeight = options?.titleLineHeight ?? 12;
  const reservedBelow = options?.reservedBelow ?? 0;
  const available = blockHeight - paddingY - reservedBelow;
  return Math.max(1, Math.floor(available / titleLineHeight));
}

/**
 * Split event-block height between wrapping title and wrapping meta (time · owner).
 * Meta can use up to 3 lines when there is room; title gets the rest.
 */
export function eventBlockLineSplit(
  blockHeight: number,
  options?: {
    paddingY?: number;
    titleLineHeight?: number;
    metaLineHeight?: number;
  }
): { titleLines: number; metaLines: number } {
  const paddingY = options?.paddingY ?? 4;
  const titleLh = options?.titleLineHeight ?? 12;
  const metaLh = options?.metaLineHeight ?? 11;
  const available = blockHeight - paddingY;

  if (available < titleLh + metaLh) {
    return {
      titleLines: Math.max(1, Math.floor(available / Math.max(titleLh, 1))),
      metaLines: 0,
    };
  }

  const metaCap =
    available >= titleLh + 3 * metaLh ? 3 : available >= titleLh + 2 * metaLh ? 2 : 1;
  const metaLines = metaCap;
  const titleLines = Math.max(
    1,
    Math.floor((available - metaLines * metaLh) / titleLh)
  );

  return { titleLines, metaLines };
}

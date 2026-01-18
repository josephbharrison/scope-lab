export function asNumber(v: string, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cloneContainer(v: unknown): unknown {
  if (Array.isArray(v)) return [...v];
  if (isRecord(v)) return { ...v };
  return {};
}

function getChild(parent: unknown, key: string): unknown {
  if (Array.isArray(parent)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length)
      return undefined;
    return parent[idx];
  }
  if (isRecord(parent)) return parent[key];
  return undefined;
}

function setChild(parent: unknown, key: string, value: unknown): void {
  if (Array.isArray(parent)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0) return;
    parent[idx] = value;
    return;
  }
  if (isRecord(parent)) {
    parent[key] = value;
  }
}

export function setIn<T extends object>(
  obj: T,
  path: string[],
  value: unknown
): T {
  if (path.length === 0) return obj;

  const root = cloneContainer(obj) as unknown;
  let cur: unknown = root;

  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const next = getChild(cur, k);
    const nextClone = cloneContainer(next);
    setChild(cur, k, nextClone);
    cur = nextClone;
  }

  setChild(cur, path[path.length - 1], value);
  return root as T;
}

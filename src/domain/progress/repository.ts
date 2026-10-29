import { ProgressSchema, emptyProgress, type Progress } from "./schema";

/**
 * Persistence boundary. Local mode stores progress in the browser; a
 * Supabase implementation can satisfy the same interface (see ARCHITECTURE.md).
 */
export interface ProgressRepository {
  load(): Progress;
  save(progress: Progress): void;
  clear(): void;
}

export const PROGRESS_STORAGE_KEY = "iea.progress.v1";

/** Minimal Storage subset so tests can supply an in-memory implementation. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class LocalProgressRepository implements ProgressRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key = PROGRESS_STORAGE_KEY,
  ) {}

  load(): Progress {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return emptyProgress();
    }
    if (!raw) return emptyProgress();
    try {
      const parsed = ProgressSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      /* corrupted JSON — fall through */
    }
    // Keep a copy of unreadable data rather than silently destroying it.
    try {
      this.storage.setItem(`${this.key}.corrupt.${Date.now()}`, raw);
    } catch {
      /* ignore */
    }
    return emptyProgress();
  }

  save(progress: Progress): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(ProgressSchema.parse(progress)));
    } catch (error) {
      console.warn("Progress could not be saved", error);
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()];
  }
}

class SafeStorage {
  private isAvailable: boolean;
  private memoryStore: Record<string, string> = {};

  constructor() {
    try {
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      this.isAvailable = true;
    } catch (e) {
      this.isAvailable = false;
    }
  }

  getItem(key: string): string | null {
    if (this.isAvailable) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return this.memoryStore[key] || null;
      }
    }
    return this.memoryStore[key] || null;
  }

  setItem(key: string, value: string): void {
    if (this.isAvailable) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch (e) {
        // Fallback to memory
      }
    }
    this.memoryStore[key] = String(value);
  }

  removeItem(key: string): void {
    if (this.isAvailable) {
      try {
        localStorage.removeItem(key);
        return;
      } catch (e) {
        // Fallback to memory
      }
    }
    delete this.memoryStore[key];
  }
}

export const safeStorage = new SafeStorage();

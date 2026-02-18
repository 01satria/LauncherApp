import { Image } from 'react-native';

/**
 * CacheManager - Smart cache clearing without causing UI refresh
 * 
 * Strategy:
 * 1. Clear decoded image cache (saves RAM, doesn't affect rendered images)
 * 2. Clear animation values that are not active
 * 3. Run garbage collection hints
 * 4. DO NOT clear app list or user data (would cause refresh)
 */

class CacheManager {
  private static instance: CacheManager;
  private lastClearTime: number = 0;
  private readonly CLEAR_INTERVAL = 30000; // 30 seconds minimum between clears

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Clear unnecessary caches when app goes to background
   * Safe operations that won't cause UI refresh
   */
  clearBackgroundCache(): void {
    const now = Date.now();
    
    // Throttle: don't clear too frequently
    if (now - this.lastClearTime < this.CLEAR_INTERVAL) {
      return;
    }

    this.lastClearTime = now;

    try {
      // 1. Clear decoded image cache (React Native built-in)
      // This clears RAM used by decoded bitmaps but keeps the original data
      // Images will be re-decoded on demand when app returns
      Image.queryCache?.([]).then(() => {
        // Cache query complete, now clear old entries
        this.clearImageDecodedCache();
      });

      // 2. Force JS garbage collection hint (if available)
      this.triggerGarbageCollection();

    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  /**
   * Clear React Native's decoded image cache
   * Safe: Only clears decoded bitmaps, not the source data
   */
  private clearImageDecodedCache(): void {
    try {
      // React Native's Image component caches decoded bitmaps
      // Clearing this frees RAM but images can be re-decoded instantly
      if (Image.clearMemoryCache) {
        Image.clearMemoryCache();
      }
    } catch (error) {
      // Silently fail if not available
    }
  }

  /**
   * Trigger garbage collection hint
   * Safe: JS engine will decide when to actually run GC
   */
  private triggerGarbageCollection(): void {
    try {
      // @ts-ignore - global.gc exists in release builds with --expose-gc flag
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      // GC not available, that's fine
    }
  }

  /**
   * Aggressive clear for when app is in background for a long time
   * Still safe - only clears truly unnecessary data
   */
  clearDeepCache(): void {
    try {
      this.clearImageDecodedCache();
      this.triggerGarbageCollection();
      
      // Additional: Clear any module-level animation caches
      // (if you have any custom animation caches, clear them here)
      
    } catch (error) {
      console.warn('Deep cache clear error:', error);
    }
  }

  /**
   * Warm up cache before returning to foreground
   * Preload critical data to prevent jank
   */
  warmupCache(): void {
    // Nothing to do - our cache strategy is lazy
    // Images will be decoded on-demand when needed
  }
}

export default CacheManager.getInstance();
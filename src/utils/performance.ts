/**
 * Performance utilities for the Rail Statistics application
 */

// Debounce function for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle function for scroll/resize events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Check if user prefers reduced motion
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Check if device is low-end (based on memory and hardware concurrency)
export function isLowEndDevice(): boolean {
  // @ts-ignore - navigator.deviceMemory may not be available in all browsers
  const memory = navigator.deviceMemory || 4
  const cores = navigator.hardwareConcurrency || 4
  
  return memory <= 4 || cores <= 4
}

// Optimize image loading based on device capabilities
export function getOptimalImageLoading(): 'eager' | 'lazy' {
  if (isLowEndDevice()) {
    return 'lazy'
  }
  return 'eager'
}

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private marks: Map<string, number> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  mark(name: string): void {
    this.marks.set(name, performance.now())
  }

  measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark)
    if (start === undefined) {
      console.warn(`Performance mark "${startMark}" not found`)
      return 0
    }
    
    const duration = performance.now() - start
    console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`)
    return duration
  }

  clear(): void {
    this.marks.clear()
  }
}

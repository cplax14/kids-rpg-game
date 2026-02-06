/**
 * Mobile device detection utilities
 */

/**
 * Detects if the current device supports touch input
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE-specific
    navigator.msMaxTouchPoints > 0
  )
}

/**
 * Detects if the device is likely a mobile phone or tablet
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent.toLowerCase()
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
  ]

  return mobileKeywords.some((keyword) => userAgent.includes(keyword))
}

/**
 * Returns true if touch controls should be shown
 * Shows on touch devices OR when explicitly enabled for testing
 */
export function shouldShowTouchControls(): boolean {
  if (typeof window === 'undefined') return false

  // Check for debug override in URL
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('touch') === 'true') {
    return true
  }
  if (urlParams.get('touch') === 'false') {
    return false
  }

  return isTouchDevice()
}

/**
 * Get the current device orientation
 */
export function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'landscape'

  if (window.screen?.orientation) {
    return window.screen.orientation.type.includes('portrait')
      ? 'portrait'
      : 'landscape'
  }

  // Fallback for older browsers
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
}

/**
 * Listen for orientation changes
 */
export function onOrientationChange(callback: (orientation: 'portrait' | 'landscape') => void): () => void {
  if (typeof window === 'undefined') {
    return () => { /* no-op */ }
  }

  const handler = () => {
    callback(getOrientation())
  }

  if (window.screen?.orientation) {
    window.screen.orientation.addEventListener('change', handler)
    return () => window.screen.orientation.removeEventListener('change', handler)
  }

  // Fallback
  window.addEventListener('orientationchange', handler)
  return () => window.removeEventListener('orientationchange', handler)
}

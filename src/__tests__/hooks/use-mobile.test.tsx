import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIsMobile } from '@/hooks/use-mobile'

describe('useIsMobile hook', { tags: ['db'] }, () => {
  let originalInnerWidth: number
  let matchMediaSpy: any

  beforeEach(() => {
    // Store original window.innerWidth
    originalInnerWidth = window.innerWidth
    
    // Mock matchMedia
    matchMediaSpy = vi.fn().mockImplementation((query) => ({
      matches: query.includes('max-width: 767px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaSpy,
    })
  })

  afterEach(() => {
    // Restore original window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: originalInnerWidth,
    })
    
    // Clear all mocks
    vi.clearAllMocks()
  })

  it('should return false for desktop screen width', () => {
    // Set desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())
    
    expect(result.current).toBe(false)
  })

  it('should return true for mobile screen width', () => {
    // Set mobile width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 375,
    })

    const { result } = renderHook(() => useIsMobile())
    
    expect(result.current).toBe(true)
  })

  it('should return true for tablet screen width (edge case)', () => {
    // Set tablet width (767px - edge case)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 767,
    })

    const { result } = renderHook(() => useIsMobile())
    
    expect(result.current).toBe(true)
  })

  it('should return false for tablet screen width (above breakpoint)', () => {
    // Set tablet width (768px - above breakpoint)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 768,
    })

    const { result } = renderHook(() => useIsMobile())
    
    expect(result.current).toBe(false)
  })

  it('should call matchMedia with correct query', () => {
    renderHook(() => useIsMobile())
    
    expect(matchMediaSpy).toHaveBeenCalledWith('(max-width: 767px)')
  })

  it('should handle window resize events', () => {
    // Start with desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    })

    const { result, rerender } = renderHook(() => useIsMobile())
    
    expect(result.current).toBe(false)

    // Simulate resize to mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 375,
    })

    // Trigger resize event
    window.dispatchEvent(new Event('resize'))
    
    // Re-render to get updated state
    rerender()
    
    expect(result.current).toBe(true)
  })

  it('should handle media query change events', () => {
    const mockMediaQueryList = {
      matches: false,
      media: '(max-width: 767px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }

    matchMediaSpy.mockReturnValue(mockMediaQueryList)

    const { result } = renderHook(() => useIsMobile())
    
    expect(result.current).toBe(false)
    expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('should cleanup event listeners on unmount', () => {
    const mockRemoveEventListener = vi.fn()
    const mockMediaQueryList = {
      matches: false,
      media: '(max-width: 767px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: vi.fn(),
    }

    matchMediaSpy.mockReturnValue(mockMediaQueryList)

    const { unmount } = renderHook(() => useIsMobile())
    
    unmount()
    
    expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('should handle edge case of very small screen', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 320, // Very small mobile screen
    })

    const { result } = renderHook(() => useIsMobile())
    
    expect(result.current).toBe(true)
  })

  it('should handle edge case of very large screen', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1920, // Large desktop screen
    })

    const { result } = renderHook(() => useIsMobile())
    
    expect(result.current).toBe(false)
  })

  it('should return boolean value', () => {
    const { result } = renderHook(() => useIsMobile())
    
    expect(typeof result.current).toBe('boolean')
  })
}) 
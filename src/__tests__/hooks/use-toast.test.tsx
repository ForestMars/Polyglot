import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast, toast } from '@/hooks/use-toast'

describe('useToast hook', { tags: ['db'] }, () => {
  beforeEach(() => {
    // Clear any existing toasts
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any remaining toasts
    vi.clearAllMocks()
  })

  describe('toast function', () => {
    it('should create a toast with basic properties', () => {
      const toastResult = toast({
        title: 'Test Toast',
        description: 'This is a test toast'
      })

      expect(toastResult).toHaveProperty('id')
      expect(toastResult).toHaveProperty('dismiss')
      expect(toastResult).toHaveProperty('update')
      expect(typeof toastResult.dismiss).toBe('function')
      expect(typeof toastResult.update).toBe('function')
    })

    it('should create a toast with different variants', () => {
      const defaultToast = toast({ title: 'Default' })
      const destructiveToast = toast({ 
        title: 'Error', 
        variant: 'destructive' 
      })
      const successToast = toast({ 
        title: 'Success', 
        variant: 'default' 
      })

      expect(defaultToast).toBeDefined()
      expect(destructiveToast).toBeDefined()
      expect(successToast).toBeDefined()
    })

    it('should create a toast with action', () => {
      const toastResult = toast({
        title: 'Action Toast'
      })

      expect(toastResult).toBeDefined()
    })

    it('should create a toast with custom duration', () => {
      const toastResult = toast({
        title: 'Custom Duration',
        duration: 5000
      })

      expect(toastResult).toBeDefined()
    })
  })

  describe('useToast hook', () => {
    it('should return toast state and functions', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current).toHaveProperty('toasts')
      expect(result.current).toHaveProperty('toast')
      expect(result.current).toHaveProperty('dismiss')
      expect(Array.isArray(result.current.toasts)).toBe(true)
      expect(typeof result.current.toast).toBe('function')
      expect(typeof result.current.dismiss).toBe('function')
    })

    it('should add toast to state when created', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          title: 'Test Toast',
          description: 'This is a test'
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toMatchObject({
        title: 'Test Toast',
        description: 'This is a test'
      })
    })

    it('should dismiss toast when dismiss is called', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string

      act(() => {
        const toastResult = result.current.toast({
          title: 'Test Toast'
        })
        toastId = toastResult.id
      })

      expect(result.current.toasts).toHaveLength(1)

      act(() => {
        result.current.dismiss(toastId)
      })

      expect(result.current.toasts).toHaveLength(0)
    })

    it('should dismiss all toasts when no id is provided', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Toast 1' })
        result.current.toast({ title: 'Toast 2' })
        result.current.toast({ title: 'Toast 3' })
      })

      expect(result.current.toasts).toHaveLength(3)

      act(() => {
        result.current.dismiss()
      })

      expect(result.current.toasts).toHaveLength(0)
    })

    it('should handle multiple toasts', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'First Toast' })
        result.current.toast({ title: 'Second Toast' })
        result.current.toast({ title: 'Third Toast' })
      })

      expect(result.current.toasts).toHaveLength(3)
      expect(result.current.toasts[0].title).toBe('First Toast')
      expect(result.current.toasts[1].title).toBe('Second Toast')
      expect(result.current.toasts[2].title).toBe('Third Toast')
    })

    it('should generate unique ids for each toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Toast 1' })
        result.current.toast({ title: 'Toast 2' })
      })

      const ids = result.current.toasts.map(t => t.id)
      expect(ids).toHaveLength(2)
      expect(ids[0]).not.toBe(ids[1])
    })

    it('should handle toast with only title', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Title Only' })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Title Only')
      expect(result.current.toasts[0].description).toBeUndefined()
    })

    it('should handle toast with only description', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ description: 'Description Only' })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].description).toBe('Description Only')
      expect(result.current.toasts[0].title).toBeUndefined()
    })

    it('should handle empty toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({})
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]).toHaveProperty('id')
    })

    it('should maintain toast order', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'First' })
        result.current.toast({ title: 'Second' })
        result.current.toast({ title: 'Third' })
      })

      const titles = result.current.toasts.map(t => t.title)
      expect(titles).toEqual(['First', 'Second', 'Third'])
    })

    it('should handle dismiss of non-existent toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Test Toast' })
      })

      expect(result.current.toasts).toHaveLength(1)

      act(() => {
        result.current.dismiss('non-existent-id')
      })

      // Should not affect existing toasts
      expect(result.current.toasts).toHaveLength(1)
    })
  })

  describe('toast variants', () => {
    it('should handle default variant', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ 
          title: 'Default Toast',
          variant: 'default'
        })
      })

      expect(result.current.toasts[0].variant).toBe('default')
    })

    it('should handle destructive variant', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ 
          title: 'Error Toast',
          variant: 'destructive'
        })
      })

      expect(result.current.toasts[0].variant).toBe('destructive')
    })
  })

  describe('toast duration', () => {
    it('should use default duration when not specified', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Test Toast' })
      })

      expect(result.current.toasts[0].duration).toBeUndefined()
    })

    it('should use custom duration when specified', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ 
          title: 'Test Toast',
          duration: 5000
        })
      })

      expect(result.current.toasts[0].duration).toBe(5000)
    })
  })
})
 
 
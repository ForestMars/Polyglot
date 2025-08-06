import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast, toast } from '@/hooks/use-toast'

describe('useToast hook', () => {
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
      expect(typeof toastResult.id).toBe('string')
      expect(typeof toastResult.dismiss).toBe('function')
      expect(typeof toastResult.update).toBe('function')
    })

    it('should create a toast with variant', () => {
      const toastResult = toast({
        title: 'Error Toast',
        description: 'Something went wrong',
        variant: 'destructive'
      })

      expect(toastResult).toHaveProperty('id')
      expect(toastResult).toHaveProperty('dismiss')
      expect(toastResult).toHaveProperty('update')
    })

    it('should create a toast with action', () => {
      const action = {
        altText: 'Undo',
        label: 'Undo'
      }

      const toastResult = toast({
        title: 'Action Toast',
        description: 'With action button',
        action
      })

      expect(toastResult).toHaveProperty('id')
      expect(toastResult).toHaveProperty('dismiss')
      expect(toastResult).toHaveProperty('update')
    })

    it('should generate unique IDs for different toasts', () => {
      const toast1 = toast({ title: 'First Toast' })
      const toast2 = toast({ title: 'Second Toast' })

      expect(toast1.id).not.toBe(toast2.id)
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
      expect(result.current.toasts[0]).toHaveProperty('title', 'Test Toast')
      expect(result.current.toasts[0]).toHaveProperty('description', 'This is a test')
    })

    it('should add multiple toasts to state', () => {
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

    it('should dismiss specific toast', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string

      act(() => {
        const toast = result.current.toast({ title: 'Test Toast' })
        toastId = toast.id
      })

      expect(result.current.toasts).toHaveLength(1)

      act(() => {
        result.current.dismiss(toastId)
      })

      expect(result.current.toasts).toHaveLength(0)
    })

    it('should dismiss all toasts when no ID provided', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'First Toast' })
        result.current.toast({ title: 'Second Toast' })
        result.current.toast({ title: 'Third Toast' })
      })

      expect(result.current.toasts).toHaveLength(3)

      act(() => {
        result.current.dismiss()
      })

      expect(result.current.toasts).toHaveLength(0)
    })

    it('should handle toast with all properties', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          title: 'Complete Toast',
          description: 'With all properties',
          variant: 'destructive',
          action: {
            altText: 'Undo',
            label: 'Undo'
          }
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      const toast = result.current.toasts[0]
      expect(toast.title).toBe('Complete Toast')
      expect(toast.description).toBe('With all properties')
      expect(toast.variant).toBe('destructive')
      expect(toast.action).toEqual({
        altText: 'Undo',
        label: 'Undo'
      })
    })

    it('should handle toast without description', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          title: 'Simple Toast'
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Simple Toast')
      expect(result.current.toasts[0].description).toBeUndefined()
    })

    it('should handle toast without title', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({
          description: 'Description only'
        })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].description).toBe('Description only')
      expect(result.current.toasts[0].title).toBeUndefined()
    })

    it('should handle dismiss with invalid ID', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'Test Toast' })
      })

      expect(result.current.toasts).toHaveLength(1)

      act(() => {
        result.current.dismiss('invalid-id')
      })

      // Should not affect existing toasts
      expect(result.current.toasts).toHaveLength(1)
    })

    it('should handle multiple dismiss operations', () => {
      const { result } = renderHook(() => useToast())

      let toast1Id: string
      let toast2Id: string

      act(() => {
        const toast1 = result.current.toast({ title: 'First Toast' })
        const toast2 = result.current.toast({ title: 'Second Toast' })
        toast1Id = toast1.id
        toast2Id = toast2.id
      })

      expect(result.current.toasts).toHaveLength(2)

      act(() => {
        result.current.dismiss(toast1Id)
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe('Second Toast')

      act(() => {
        result.current.dismiss(toast2Id)
      })

      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('toast dismiss function', () => {
    it('should dismiss toast when called', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string

      act(() => {
        const toast = result.current.toast({ title: 'Test Toast' })
        toastId = toast.id
      })

      expect(result.current.toasts).toHaveLength(1)

      act(() => {
        result.current.dismiss(toastId)
      })

      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('toast update function', () => {
    it('should update toast properties', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string

      act(() => {
        const toast = result.current.toast({
          title: 'Original Title',
          description: 'Original Description'
        })
        toastId = toast.id
      })

      expect(result.current.toasts[0].title).toBe('Original Title')

      act(() => {
        result.current.toasts[0].update({
          title: 'Updated Title',
          description: 'Updated Description'
        })
      })

      expect(result.current.toasts[0].title).toBe('Updated Title')
 
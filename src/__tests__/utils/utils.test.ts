import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('class1', 'class2', 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  it('should handle conditional classes', () => {
    const isActive = true
    const isDisabled = false
    
    const result = cn(
      'base-class',
      isActive && 'active-class',
      isDisabled && 'disabled-class'
    )
    
    expect(result).toBe('base-class active-class')
  })

  it('should handle undefined and null values', () => {
    const result = cn('base-class', undefined, null, 'valid-class')
    expect(result).toBe('base-class valid-class')
  })

  it('should handle empty strings', () => {
    const result = cn('base-class', '', 'valid-class', '')
    expect(result).toBe('base-class valid-class')
  })

  it('should handle arrays of classes', () => {
    const result = cn('base-class', ['array-class1', 'array-class2'], 'single-class')
    expect(result).toBe('base-class array-class1 array-class2 single-class')
  })

  it('should handle objects with conditional classes', () => {
    const result = cn('base-class', {
      'conditional-class': true,
      'false-class': false,
      'another-true': true
    })
    expect(result).toBe('base-class conditional-class another-true')
  })

  it('should handle mixed input types', () => {
    const result = cn(
      'base-class',
      ['array-class1', 'array-class2'],
      'single-class',
      {
        'conditional-class': true,
        'false-class': false
      },
      undefined,
      null,
      ''
    )
    expect(result).toBe('base-class array-class1 array-class2 single-class conditional-class')
  })

  it('should handle Tailwind class conflicts', () => {
    const result = cn('text-red-500', 'text-blue-500')
    // The last class should win in Tailwind's utility-first approach
    expect(result).toBe('text-red-500 text-blue-500')
  })

  it('should handle complex conditional logic', () => {
    const variant = 'primary'
    const size = 'large'
    const disabled = false
    
    const result = cn(
      'base-button',
      {
        'btn-primary': variant === 'primary',
        'btn-secondary': variant === 'secondary',
        'btn-small': size === 'small',
        'btn-large': size === 'large',
        'btn-disabled': disabled
      }
    )
    
    expect(result).toBe('base-button btn-primary btn-large')
  })

  it('should handle no arguments', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle single argument', () => {
    const result = cn('single-class')
    expect(result).toBe('single-class')
  })
}) 
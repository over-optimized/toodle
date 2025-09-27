import type { List, Item } from '../types'

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export class ValidationService {
  // List limits - as per spec requirements
  private static readonly MAX_LISTS_PER_USER = 10
  private static readonly MAX_ITEMS_PER_LIST = 100

  /**
   * Validates if a user can create a new list
   */
  static validateListCreation(existingLists: List[]): ValidationResult {
    const errors: ValidationError[] = []

    if (existingLists.length >= this.MAX_LISTS_PER_USER) {
      errors.push({
        field: 'lists',
        message: `You can only have up to ${this.MAX_LISTS_PER_USER} lists. Please delete some lists before creating new ones.`,
        code: 'MAX_LISTS_EXCEEDED'
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validates if an item can be added to a list
   */
  static validateItemCreation(existingItems: Item[]): ValidationResult {
    const errors: ValidationError[] = []

    if (existingItems.length >= this.MAX_ITEMS_PER_LIST) {
      errors.push({
        field: 'items',
        message: `Each list can only have up to ${this.MAX_ITEMS_PER_LIST} items. Please remove some items before adding new ones.`,
        code: 'MAX_ITEMS_EXCEEDED'
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validates list title
   */
  static validateListTitle(title: string): ValidationResult {
    const errors: ValidationError[] = []

    if (!title || title.trim().length === 0) {
      errors.push({
        field: 'title',
        message: 'List title is required',
        code: 'TITLE_REQUIRED'
      })
    }

    if (title.trim().length > 100) {
      errors.push({
        field: 'title',
        message: 'List title must be 100 characters or less',
        code: 'TITLE_TOO_LONG'
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validates item content
   */
  static validateItemContent(content: string): ValidationResult {
    const errors: ValidationError[] = []

    if (!content || content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Item content is required',
        code: 'CONTENT_REQUIRED'
      })
    }

    if (content.trim().length > 500) {
      errors.push({
        field: 'content',
        message: 'Item content must be 500 characters or less',
        code: 'CONTENT_TOO_LONG'
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validates target date for countdown items
   */
  static validateTargetDate(targetDate: string): ValidationResult {
    const errors: ValidationError[] = []

    try {
      const date = new Date(targetDate)
      const now = new Date()

      if (isNaN(date.getTime())) {
        errors.push({
          field: 'targetDate',
          message: 'Invalid date format',
          code: 'INVALID_DATE_FORMAT'
        })
      } else if (date <= now) {
        errors.push({
          field: 'targetDate',
          message: 'Target date must be in the future',
          code: 'PAST_DATE_NOT_ALLOWED'
        })
      } else if (date > new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000))) {
        errors.push({
          field: 'targetDate',
          message: 'Target date cannot be more than 1 year in the future',
          code: 'DATE_TOO_FAR_FUTURE'
        })
      }
    } catch (error) {
      errors.push({
        field: 'targetDate',
        message: 'Invalid date',
        code: 'INVALID_DATE'
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Get user-friendly error message for display
   */
  static getErrorMessage(errors: ValidationError[]): string {
    if (errors.length === 0) return ''

    // Return the first error message for simplicity
    return errors[0].message
  }

  /**
   * Check if validation error is about limits
   */
  static isLimitError(errors: ValidationError[]): boolean {
    return errors.some(error =>
      error.code === 'MAX_LISTS_EXCEEDED' ||
      error.code === 'MAX_ITEMS_EXCEEDED'
    )
  }

  /**
   * Get current usage stats
   */
  static getUsageStats(lists: List[], currentListItems?: Item[]) {
    return {
      lists: {
        current: lists.length,
        max: this.MAX_LISTS_PER_USER,
        percentage: Math.round((lists.length / this.MAX_LISTS_PER_USER) * 100)
      },
      items: currentListItems ? {
        current: currentListItems.length,
        max: this.MAX_ITEMS_PER_LIST,
        percentage: Math.round((currentListItems.length / this.MAX_ITEMS_PER_LIST) * 100)
      } : null
    }
  }
}
export * from './auth'
export * from './api'
export * from './list.service'
export * from './item.service'
export * from './share.service'
export * from './sync.service'
export * from './offline.service'
export * from './validation.service'
export * from './cleanup.service'
export * from './linking.service'

// Enhanced linking services (Phase 3.4+)
export { EnhancedLinkingService } from './enhanced-linking.service'
export { StatusPropagationService } from './status-propagation.service'
export { LinkValidationService } from './link-validation.service'

// Service instances
import { EnhancedLinkingService } from './enhanced-linking.service'
import { StatusPropagationService } from './status-propagation.service'
import { LinkValidationService } from './link-validation.service'

export const enhancedLinkingService = new EnhancedLinkingService()
export const statusPropagationService = new StatusPropagationService()
export const linkValidationService = new LinkValidationService()
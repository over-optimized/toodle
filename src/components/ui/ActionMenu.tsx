import { useState, useRef, useEffect } from 'react'

export interface ActionMenuItem {
  id: string
  label: string
  icon: string
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  className?: string
  triggerClassName?: string
  disabled?: boolean
}

export function ActionMenu({
  items,
  className = '',
  triggerClassName = '',
  disabled = false
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleItemClick = (item: ActionMenuItem) => {
    if (!item.disabled) {
      item.onClick()
      setIsOpen(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent, item: ActionMenuItem) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleItemClick(item)
    }
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded ${triggerClassName}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="More actions"
      >
        <span className="text-lg leading-none">⋯</span>
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-10 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Menu */}
          <div
            className="absolute right-0 top-8 z-20 min-w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 focus:outline-none"
            role="menu"
            aria-orientation="vertical"
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => handleKeyDown(e, item)}
                disabled={item.disabled}
                className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                  item.variant === 'destructive'
                    ? 'text-red-700 hover:bg-red-50 focus:bg-red-50'
                    : 'text-gray-700'
                }`}
                role="menuitem"
                tabIndex={isOpen ? 0 : -1}
                autoFocus={index === 0}
              >
                <span className="text-base" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
'use client'

import { Menu } from '@base-ui/react/menu'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export const navigationLinkClass =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type NavigationItem = {
  href: string
  icon: LucideIcon
  label: string
}

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function NavigationDropdown({
  icon: Icon,
  compactIcon: CompactIcon,
  items,
  label,
}: {
  icon: LucideIcon
  compactIcon?: LucideIcon
  items: NavigationItem[]
  label: string
}) {
  const pathname = usePathname()
  const activeItem = items.filter(({ href }) => isActivePath(pathname, href))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        title={label}
        className={cn(
          navigationLinkClass,
          activeItem ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {CompactIcon && <CompactIcon className="size-4 lg:hidden" aria-hidden="true" />}
        <Icon className={cn('size-4', CompactIcon && 'hidden lg:block')} aria-hidden="true" />
        <span className="hidden lg:inline">{label}</span>
        <ChevronDown className="hidden size-3 lg:block" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50 outline-none">
          <Menu.Popup className="min-w-56 origin-[var(--transform-origin)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {items.map(({ href, icon: ItemIcon, label: itemLabel }) => (
              <Menu.LinkItem
                key={href}
                closeOnClick
                render={<Link href={href} />}
                aria-current={activeItem?.href === href ? 'page' : undefined}
                className="flex cursor-default items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted data-highlighted:text-foreground"
              >
                <ItemIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                {itemLabel}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

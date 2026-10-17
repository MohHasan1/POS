import { Boxes, FileText, Settings, ShoppingCart } from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/localization'
import { cn } from '@/lib/utils'
import { getShopSettings } from '@/services/settings'

export default async function HomePage() {
  const [{ dictionary, locale }, settings] = await Promise.all([
    getDictionary(),
    getShopSettings(),
  ])
  const currentDate = new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-SA', {
    dateStyle: 'full',
    timeZone: 'Asia/Riyadh',
  }).format(new Date())
  const shopName = settings.sellerNameEnglish || 'Your Shop'

  const actions = [
    { href: '/checkout', title: dictionary.startSale, description: dictionary.checkout, icon: ShoppingCart, primary: true },
    { href: '/products', title: dictionary.manageProducts, description: dictionary.products, icon: Boxes },
    { href: '/invoices', title: dictionary.invoiceHistory, description: dictionary.invoices, icon: FileText },
    { href: '/settings', title: dictionary.shopSettings, description: dictionary.settings, icon: Settings },
  ]

  return (
    <div className="space-y-8">
      <section className="border-b pb-6">
        <p className="text-sm text-muted-foreground">{dictionary.welcome}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{shopName}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{dictionary.appName} POS</span>
          <span>{dictionary.today}: {currentDate}</span>
        </div>
      </section>

      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="mb-3 text-sm font-medium">{dictionary.quickActions}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(({ href, title, description, icon: Icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-h-28 flex-col justify-between rounded-lg border bg-background p-4 hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                primary && 'border-primary bg-primary text-primary-foreground hover:border-primary/80',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>
                <span className="block font-medium">{title}</span>
                <span className={cn('text-xs text-muted-foreground', primary && 'text-primary-foreground/75')}>
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <aside className="rounded-lg border bg-background p-4 text-sm">
        <p className="font-medium">{dictionary.localNotice}</p>
        <p className="mt-1 text-muted-foreground">{dictionary.localNoticeDetail}</p>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'link' }), 'mt-2 px-0')}>
          {dictionary.shopSettings}
        </Link>
      </aside>
    </div>
  )
}

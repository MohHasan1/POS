'use client'

import type { ComponentProps } from 'react'
import { ResponsiveContainer, Tooltip } from 'recharts'

import { cn } from '@/lib/utils'

function ChartContainer({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="chart"
      className={cn('aspect-auto h-72 w-full text-xs', className)}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  )
}

const ChartTooltip = Tooltip

export { ChartContainer, ChartTooltip }

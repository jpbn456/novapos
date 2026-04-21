import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary/14 text-primary [a&]:hover:bg-primary/18',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/92',
        success:
          'border-transparent bg-success/18 text-success-foreground [a&]:hover:bg-success/24',
        warning:
          'border-transparent bg-warning/24 text-warning-foreground [a&]:hover:bg-warning/30',
        info:
          'border-transparent bg-info/18 text-info-foreground [a&]:hover:bg-info/24',
        destructive:
          'border-transparent bg-destructive/16 text-destructive [a&]:hover:bg-destructive/22',
        outline:
          'border-border bg-background/80 text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

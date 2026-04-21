import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{description}</p>
      </div>
      {actions ? <div className="flex w-full flex-wrap items-stretch gap-2 md:w-auto md:items-center md:justify-end">{actions}</div> : null}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  helper?: string
  icon: LucideIcon
  iconClassName?: string
  valueClassName?: string
}

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  iconClassName,
  valueClassName,
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/70">
          <Icon className={cn("h-4 w-4 text-primary", iconClassName)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className={cn("text-2xl font-bold tracking-tight text-foreground", valueClassName)}>
          {value}
        </div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  )
}

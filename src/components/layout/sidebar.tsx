"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Menu,
  Store,
  Tags,
  Package,
  ShoppingCart,
  LogOut,
  BarChart3,
  Truck,
  FileText,
  Users,
} from "lucide-react"
import { logoutAction } from "@/app/actions/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Punto de Venta", href: "/pos", icon: ShoppingCart },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Sucursales", href: "/locations", icon: Store },
  { name: "Categorías", href: "/categories", icon: Tags },
  { name: "Proveedores", href: "/suppliers", icon: Truck },
  { name: "Órdenes de Compra", href: "/purchase-orders", icon: FileText },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
]

interface SidebarProps {
  userRole?: string
  userName?: string
}

export function Sidebar({ userRole = "ADMIN", userName = "Usuario" }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logoutAction()
  }

  const navigationContent = (
    <>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs"
                  : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}
        {userRole === "ADMIN" && (
          <Link
            href="/users"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
              pathname === "/users" || pathname.startsWith("/users/")
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-xs"
                : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Users className="h-5 w-5" />
            <span className="truncate">Usuarios</span>
          </Link>
        )}
      </nav>

      <div className="border-t border-sidebar-border/80 p-3">
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/70 px-3 py-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="text-xs text-sidebar-foreground/56 capitalize">{userRole.toLowerCase()}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
    </>
  )

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 border-b border-sidebar-border/80 bg-sidebar/96 text-sidebar-foreground backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary shadow-xs">
              <ShoppingCart className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-sidebar-foreground">RetailPOS</h1>
              <p className="truncate text-xs text-sidebar-foreground/65">Gestión tranquila para retail</p>
            </div>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir navegación</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[88vw] max-w-none border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-sm">
              <SheetHeader className="border-b border-sidebar-border/80 px-6 py-5 text-left">
                <SheetTitle className="flex items-center gap-3 text-sidebar-foreground">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary shadow-xs">
                    <ShoppingCart className="h-5 w-5 text-sidebar-primary-foreground" />
                  </div>
                  RetailPOS
                </SheetTitle>
                <SheetDescription className="text-sidebar-foreground/65">
                  Navegación principal adaptada para mobile y tablet.
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col">{navigationContent}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border/80 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary shadow-xs">
              <ShoppingCart className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-sidebar-foreground">RetailPOS</h1>
              <p className="text-xs text-sidebar-foreground/65">Gestión tranquila para retail</p>
            </div>
          </div>

          {navigationContent}
        </div>
      </aside>
    </>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"

import { createLocation, deleteLocation, getLocations, updateLocation } from "@/app/actions/locations"
import { PageHeader, StatCard } from "@/components/dashboard/page-primitives"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Loader2, MapPin, Pencil, Phone, Plus, Store, Trash2 } from "lucide-react"

interface Location {
  id: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  _count?: {
    inventory: number
    sales: number
  }
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const userRole = "ADMIN"

  useEffect(() => {
    loadLocations()
  }, [])

  async function loadLocations() {
    setLoading(true)
    const result = await getLocations()
    if (result.success && result.data) {
      setLocations(result.data as Location[])
    }
    setLoading(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const result = editingLocation
      ? await updateLocation(editingLocation.id, formData)
      : await createLocation(formData)

    if (result.success) {
      setOpen(false)
      setEditingLocation(null)
      loadLocations()
    } else {
      alert(result.error || "Error")
    }

    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteLocation(id, userRole)
    if (result.success) {
      loadLocations()
    } else {
      alert(result.error || "Error")
    }
  }

  const activeLocations = useMemo(() => locations.filter((location) => location.isActive).length, [locations])
  const inactiveLocations = locations.length - activeLocations
  const totalInventoryEntries = useMemo(
    () => locations.reduce((acc, location) => acc + (location._count?.inventory || 0), 0),
    [locations]
  )
  const totalSalesEntries = useMemo(
    () => locations.reduce((acc, location) => acc + (location._count?.sales || 0), 0),
    [locations]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sucursales"
        description="Vista más sobria y jerárquica para administrar puntos de operación sin perder las acciones de alta, edición y baja lógica."
        actions={
          <Button onClick={() => { setEditingLocation(null); setOpen(true) }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva sucursal
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Sucursales activas" value={activeLocations} helper={`${inactiveLocations} inactivas`} icon={Store} iconClassName="text-primary" />
        <StatCard label="Inventario asociado" value={totalInventoryEntries} helper="Registros vinculados a ubicaciones" icon={Building2} iconClassName="text-secondary-foreground" />
        <StatCard label="Ventas históricas" value={totalSalesEntries} helper="Movimientos comerciales vinculados" icon={MapPin} iconClassName="text-success-foreground" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de sucursales</CardTitle>
          <CardDescription>Diseño con tarjetas similar a ERPOS para priorizar nombre, estado y datos de contacto.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : locations.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-center">
              <MapPin className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No hay sucursales registradas.</p>
              <p className="text-sm text-muted-foreground">Creá la primera ubicación para empezar a operar.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {locations.map((location) => (
                <Card key={location.id} className={!location.isActive ? "opacity-75" : undefined}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                        <Store className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="space-y-2">
                        <CardTitle className="text-base">{location.name}</CardTitle>
                        <Badge variant={location.isActive ? "default" : "outline"}>
                          {location.isActive ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => {
                          setEditingLocation(location)
                          setOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon-sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar sucursal?</AlertDialogTitle>
                            <AlertDialogDescription>
                              La acción desactiva la sucursal y mantiene los datos históricos del sistema.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(location.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{location.address || "Sin dirección cargada"}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{location.phone || "Sin teléfono"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-4 text-sm">
                      <div className="rounded-xl bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Inventario</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{location._count?.inventory || 0}</p>
                      </div>
                      <div className="rounded-xl bg-muted/20 p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Ventas</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{location._count?.sales || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
            <DialogDescription>
              {editingLocation ? "Actualizá los datos operativos de la sucursal." : "Completá la información básica de la nueva ubicación."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" defaultValue={editingLocation?.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" name="address" defaultValue={editingLocation?.address || ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" name="phone" defaultValue={editingLocation?.phone || ""} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingLocation ? "Actualizar sucursal" : "Crear sucursal"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

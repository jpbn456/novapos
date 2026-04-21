"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getUsers, deactivateUser } from "@/app/actions/users"
import { PageHeader } from "@/components/dashboard/page-primitives"
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
import { Loader2, Plus, Trash2, Users, UserCog } from "lucide-react"

interface User {
  id: string
  name: string | null
  email: string | null
  role: string
  isActive: boolean
  createdAt: string
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const userRole = "ADMIN"

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const result = await getUsers()
    if (result.success && result.data) {
      setUsers(result.data as User[])
    }
    setLoading(false)
  }

  async function handleDeactivate(userId: string) {
    setDeactivatingId(userId)
    const result = await deactivateUser(userId)
    if (result.success) {
      loadUsers()
    } else {
      alert(result.error || "Error al desactivar usuario")
    }
    setDeactivatingId(null)
  }

  const activeUsers = users.filter((u) => u.isActive).length
  const inactiveUsers = users.length - activeUsers

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Administración de usuarios del sistema. Solo administradores pueden crear y desactivar cuentas."
        actions={
          <Button onClick={() => router.push("/users/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios activos</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios inactivos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveUsers}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de usuarios</CardTitle>
          <CardDescription>
            Todos los usuarios del sistema. Los usuarios inactivos no pueden iniciar sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No hay usuarios registrados.</p>
              <p className="text-sm text-muted-foreground">
                Creá el primer usuario para empezar a operar.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Rol
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Fecha de alta
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{user.name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {user.role === "ADMIN"
                            ? "Administrador"
                            : user.role === "MANAGER"
                              ? "Gerente"
                              : "Cajero"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {new Date(user.createdAt).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.isActive && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Desactivar
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Desactivar usuario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  El usuario <strong>{user.name || user.email}</strong> no podrá
                                  iniciar sesión en el sistema. Los datos se mantienen
                                  almacenados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeactivate(user.id)}
                                  disabled={deactivatingId === user.id}
                                >
                                  {deactivatingId === user.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Desactivar"
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

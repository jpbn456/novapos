"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ActionResult } from "@/types/auth"

const createUserSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER"]).default("CASHIER"),
})

export async function getUsers(): Promise<ActionResult<any[]>> {
  try {
    const session = await auth()
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return { success: false, error: "No tienes permisos para ver usuarios" }
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return { success: true, data: users }
  } catch (error) {
    console.error("Error fetching users:", error)
    return { success: false, error: "Error al obtener usuarios" }
  }
}

export async function createUser(formData: FormData): Promise<ActionResult<any>> {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Debes iniciar sesión" }
  }

  const userRole = (session.user as any).role
  if (userRole !== "ADMIN") {
    return { success: false, error: "Solo administradores pueden crear usuarios" }
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const role = formData.get("role") as string

  const result = createUserSchema.safeParse({ name, email, password, role })

  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().formErrors?.[0] || "Datos inválidos",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { success: false, error: "El email ya está en uso" }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: result.data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    revalidatePath("/users")
    return { success: true, data: user }
  } catch (error) {
    console.error("Error creating user:", error)
    return { success: false, error: "Error al crear usuario" }
  }
}

export async function deactivateUser(userId: string): Promise<ActionResult<void>> {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Debes iniciar sesión" }
  }

  const userRole = (session.user as any).role
  if (userRole !== "ADMIN") {
    return { success: false, error: "Solo administradores pueden desactivar usuarios" }
  }

  const currentUserId = session.user.id

  // Prevent self-deactivation
  if (userId === currentUserId) {
    return { success: false, error: "No puedes desactivarte a ti mismo" }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    })

    revalidatePath("/users")
    return { success: true }
  } catch (error) {
    console.error("Error deactivating user:", error)
    return { success: false, error: "Error al desactivar usuario" }
  }
}

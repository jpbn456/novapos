"use server"

import { signIn, signOut, auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

// Login schema
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
})

// Register schema
const registerSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["ADMIN", "MANAGER", "CASHIER"]).default("CASHIER"),
})

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  // Validate fields
  const result = loginSchema.safeParse({ email, password })
  
  if (!result.success) {
    return {
      success: false,
      error: result.error.flatten().fieldErrors.email?.[0] || 
             result.error.flatten().fieldErrors.password?.[0] ||
             "Datos inválidos",
    }
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    
    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "Credenciales inválidas" }
  }
}

export async function registerAction(formData: FormData) {
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

  const result = registerSchema.safeParse({
    name,
    email,
    password,
    role,
  })

  if (!result.success) {
    const errors = result.error.flatten()
    return {
      success: false,
      error: errors.formErrors?.[0] || "Datos inválidos",
      fieldErrors: errors.fieldErrors,
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { success: false, error: "El email ya está en uso" }
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: result.data.role,
      },
    })

    revalidatePath("/users")
    return { success: true }
  } catch (error) {
    console.error("Register error:", error)
    return { success: false, error: "Error al crear usuario" }
  }
}

export async function logoutAction() {
  await signOut({ redirect: false })
  revalidatePath("/login")
  redirect("/login")
}

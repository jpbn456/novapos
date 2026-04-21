import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const credentialsProvider = CredentialsProvider({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials: any) {
    if (!credentials?.email || !credentials?.password) {
      throw new Error("Email y contraseña son requeridos")
    }

    const user = await prisma.user.findUnique({
      where: { email: credentials.email as string },
    })

    if (!user || !user.password) {
      throw new Error("Credenciales inválidas")
    }

    if (!user.isActive) {
      throw new Error("Usuario inactivo")
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

    if (!isPasswordValid) {
      throw new Error("Credenciales inválidas")
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }
  },
})
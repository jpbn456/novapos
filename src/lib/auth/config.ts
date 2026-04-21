import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { credentialsProvider } from "./providers"
import { jwtCallbacks, sessionCallbacks } from "./callbacks"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  providers: [credentialsProvider],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt: jwtCallbacks as any,
    session: sessionCallbacks as any,
  },
  debug: process.env.NODE_ENV === "development",
})
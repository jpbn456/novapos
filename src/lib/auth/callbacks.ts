import { Session } from "next-auth"
import { JWT } from "next-auth/jwt"
import { SessionUser } from "@/types/auth"

export async function jwtCallbacks({ token, user }: { token: JWT; user?: any }) {
  if (user) {
    token.id = user.id
    token.role = user.role
    token.email = user.email
    token.name = user.name
  }
  return token
}

export async function sessionCallbacks({
  session,
  token,
}: {
  session: Session
  token: JWT
}): Promise<Session> {
  if (token && session.user) {
    session.user.id = token.id as string
    session.user.role = token.role as string
    session.user.email = token.email as string
    session.user.name = token.name as string
  }
  return session
}
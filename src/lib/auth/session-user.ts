import { prisma } from "@/lib/prisma"

type SessionLike = {
  user?: {
    id?: string
    email?: string | null
  } | null
} | null

export async function resolveSessionUserId(session: SessionLike) {
  const sessionUser = session?.user

  if (!sessionUser) {
    return null
  }

  if (sessionUser.id) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true },
    })

    if (user) {
      return user.id
    }
  }

  if (sessionUser.email) {
    const user = await prisma.user.findUnique({
      where: { email: sessionUser.email },
      select: { id: true },
    })

    if (user) {
      return user.id
    }
  }

  return null
}

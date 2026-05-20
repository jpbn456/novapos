import { PrismaClient, UserRole } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import bcrypt from "bcryptjs"
import { getPgPoolConfig } from "../src/lib/prisma-config"

const prisma = new PrismaClient({
  adapter: new PrismaPg(new pg.Pool(getPgPoolConfig(true))),
})

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? "Admin"

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required")
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      name,
      email,
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  console.log(`Admin user ready: ${admin.email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

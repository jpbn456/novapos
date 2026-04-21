import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const locationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
})

// GET /api/locations - List all locations
export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { inventory: true, sales: true },
        },
      },
    })
    return NextResponse.json(locations)
  } catch (error) {
    console.error("Error fetching locations:", error)
    return NextResponse.json({ error: "Error al obtener sucursales" }, { status: 500 })
  }
}

// POST /api/locations - Create new location
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const result = locationSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fieldErrors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const location = await prisma.location.create({
      data: result.data,
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    console.error("Error creating location:", error)
    return NextResponse.json({ error: "Error al crear sucursal" }, { status: 500 })
  }
}
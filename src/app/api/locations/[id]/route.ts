import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const locationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
})

// GET /api/locations/[id] - Get single location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        _count: {
          select: { inventory: true, sales: true },
        },
      },
    })

    if (!location) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
    }

    return NextResponse.json(location)
  } catch (error) {
    console.error("Error fetching location:", error)
    return NextResponse.json({ error: "Error al obtener sucursal" }, { status: 500 })
  }
}

// PUT /api/locations/[id] - Update location
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const result = locationSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: "Datos inválidos", fieldErrors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const location = await prisma.location.update({
      where: { id },
      data: result.data,
    })

    return NextResponse.json(location)
  } catch (error) {
    console.error("Error updating location:", error)
    return NextResponse.json({ error: "Error al actualizar sucursal" }, { status: 500 })
  }
}

// DELETE /api/locations/[id] - Soft delete location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { id } = await params

    await prisma.location.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting location:", error)
    return NextResponse.json({ error: "Error al eliminar sucursal" }, { status: 500 })
  }
}
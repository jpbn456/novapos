import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isSupabaseConfigured, uploadAttachment as uploadToSupabase } from '@/lib/supabase-storage'
import { z } from 'zod'

const MANAGER_ROLES = new Set(['ADMIN', 'MANAGER'])

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'purchase-orders')

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!MANAGER_ROLES.has(session.user.role || '')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null
    const type = formData.get('type') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!file.type || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
      return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 })
    }

    const uploadName = name || file.name
    const uuid = crypto.randomUUID()
    const fileExtension = '.pdf'
    const fileName = `${uuid}${fileExtension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    let fileUrl: string

    // Try Supabase Storage first, fall back to local filesystem
    if (isSupabaseConfigured()) {
      const result = await uploadToSupabase(buffer, fileName, file.type || 'application/pdf')
      if (result) {
        fileUrl = result.publicUrl
      } else {
        // Supabase configured but upload failed — fall through to local
        const localPath = path.join(UPLOAD_DIR, fileName)
        await writeFile(localPath, buffer)
        fileUrl = `/uploads/purchase-orders/${fileName}`
      }
    } else {
      // Local filesystem
      const localPath = path.join(UPLOAD_DIR, fileName)
      await writeFile(localPath, buffer)
      fileUrl = `/uploads/purchase-orders/${fileName}`
    }

    const attachment = await prisma.purchaseOrderAttachment.create({
      data: {
        purchaseOrderId: id,
        name: uploadName,
        fileUrl,
        type: (type as any) || 'OTHER',
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('Error uploading attachment:', error)
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    )
  }
}

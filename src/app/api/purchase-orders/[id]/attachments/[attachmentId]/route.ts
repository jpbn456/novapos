import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { deleteAttachment as deleteFromSupabase, extractFileName, isSupabaseConfigured } from '@/lib/supabase-storage'

const MANAGER_ROLES = new Set(['ADMIN', 'MANAGER'])

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!MANAGER_ROLES.has(session.user.role || '')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id, attachmentId } = await params

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const attachment = await prisma.purchaseOrderAttachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment || attachment.purchaseOrderId !== id) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Try Supabase Storage delete first, fall back to local filesystem
    if (isSupabaseConfigured()) {
      const fileName = extractFileName(attachment.fileUrl)
      await deleteFromSupabase(fileName)
    } else {
      // Delete file from local disk
      const filePath = path.join(process.cwd(), 'public', attachment.fileUrl)
      try {
        await unlink(filePath)
      } catch {
        // File might not exist on disk — that's OK, clean up the record
      }
    }

    await prisma.purchaseOrderAttachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ message: 'Attachment deleted successfully' })
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    )
  }
}

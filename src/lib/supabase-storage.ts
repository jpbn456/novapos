import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const BUCKET_NAME = "purchase-order-attachments"

function getClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

export async function uploadAttachment(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<{ publicUrl: string } | null> {
  const supabase = getClient()
  if (!supabase) return null

  const { error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, file, {
    contentType,
    upsert: false,
  })

  if (error) {
    console.error("Supabase storage upload error:", error.message)
    return null
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName)

  return { publicUrl: publicUrlData.publicUrl }
}

export async function deleteAttachment(fileName: string): Promise<boolean> {
  const supabase = getClient()
  if (!supabase) return false

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([fileName])

  if (error) {
    console.error("Supabase storage delete error:", error.message)
    return false
  }

  return true
}

export function extractFileName(fileUrl: string): string {
  // Handles both local (/uploads/...) and Supabase URLs
  return fileUrl.split("/").pop() || ""
}

export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseServiceKey
}

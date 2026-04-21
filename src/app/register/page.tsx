"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// This route is deprecated. Redirect to the new users management page.
export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/users")
  }, [router])

  return null
}
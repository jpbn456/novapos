"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { CartItem } from "@/types/auth"

const CART_STORAGE_KEY = "novapos-cart"

function loadCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return []

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

interface CartContextType {
  items: CartItem[]
  addItem: (product: { id: string; name: string; price: number; sku?: string | null; barcode?: string | null }) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setItems(loadCartFromStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Ignore localStorage failures silently
    }
  }, [items, hydrated])

  function addItem(product: { id: string; name: string; price: number; sku?: string | null; barcode?: string | null }) {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          subtotal: product.price,
          sku: product.sku,
          barcode: product.barcode,
        },
      ]
    })
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.productId !== productId))
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity, subtotal: quantity * item.price }
          : item
      )
    )
  }

  function clearCart() {
    setItems([])
  }

  function getTotal() {
    return items.reduce((sum, item) => sum + item.subtotal, 0)
  }

  function getItemCount() {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getTotal,
        getItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within a CartProvider")
  }
  return context
}

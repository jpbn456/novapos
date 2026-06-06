"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { CartItem } from "@/types/auth"
import { roundQuantity } from "@/lib/quantity"

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
  addItem: (product: { id: string; name: string; price: number; sku?: string | null; barcode?: string | null; unitOfMeasure?: CartItem["unitOfMeasure"]; customUnitName?: string | null }) => void
  addItems: (products: Array<{ productId: string; name: string; price: number; quantity: number; sku?: string | null; barcode?: string | null; unitOfMeasure?: CartItem["unitOfMeasure"]; customUnitName?: string | null }>) => void
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

  function mergeCartItems(
    previousItems: CartItem[],
    incomingItems: Array<{ productId: string; name: string; price: number; quantity: number; sku?: string | null; barcode?: string | null; unitOfMeasure?: CartItem["unitOfMeasure"]; customUnitName?: string | null }>
  ) {
    const nextItems = [...previousItems]

    for (const incomingItem of incomingItems) {
      const normalizedQuantity = roundQuantity(incomingItem.quantity)
      if (normalizedQuantity <= 0) continue

      const existingIndex = nextItems.findIndex((item) => item.productId === incomingItem.productId)

      if (existingIndex >= 0) {
        const updatedQuantity = roundQuantity(nextItems[existingIndex].quantity + normalizedQuantity)
        nextItems[existingIndex] = {
          ...nextItems[existingIndex],
          quantity: updatedQuantity,
          subtotal: roundQuantity(updatedQuantity * nextItems[existingIndex].price),
        }
        continue
      }

      nextItems.push({
        productId: incomingItem.productId,
        name: incomingItem.name,
        price: incomingItem.price,
        quantity: normalizedQuantity,
        subtotal: roundQuantity(normalizedQuantity * incomingItem.price),
        unitOfMeasure: incomingItem.unitOfMeasure,
        customUnitName: incomingItem.customUnitName || null,
        sku: incomingItem.sku,
        barcode: incomingItem.barcode,
      })
    }

    return nextItems
  }

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

  function addItem(product: { id: string; name: string; price: number; sku?: string | null; barcode?: string | null; unitOfMeasure?: CartItem["unitOfMeasure"]; customUnitName?: string | null }) {
    addItems([
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        unitOfMeasure: product.unitOfMeasure,
        customUnitName: product.customUnitName,
        sku: product.sku,
        barcode: product.barcode,
      },
    ])
  }

  function addItems(products: Array<{ productId: string; name: string; price: number; quantity: number; sku?: string | null; barcode?: string | null; unitOfMeasure?: CartItem["unitOfMeasure"]; customUnitName?: string | null }>) {
    setItems((prev) => mergeCartItems(prev, products))
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.productId !== productId))
  }

  function updateQuantity(productId: string, quantity: number) {
    const normalizedQuantity = roundQuantity(quantity)

    if (normalizedQuantity <= 0) {
      removeItem(productId)
      return
    }
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: normalizedQuantity, subtotal: normalizedQuantity * item.price }
          : item
      )
    )
  }

  function clearCart() {
    setItems([])
  }

  function getTotal() {
    return Math.round((items.reduce((sum, item) => sum + item.subtotal, 0) + Number.EPSILON) * 100) / 100
  }

  function getItemCount() {
    return roundQuantity(items.reduce((sum, item) => sum + item.quantity, 0))
  }

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        addItems,
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

"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { CartItem, ForcedPromotionSelection } from "@/types/auth"
import { roundQuantity } from "@/lib/quantity"

const CART_STORAGE_KEY = "novapos-cart"

type StoredCartState = {
  items: CartItem[]
  forcedPromotions: ForcedPromotionSelection[]
}

function buildPromotionRequirementMap(forcedPromotions: ForcedPromotionSelection[]) {
  return forcedPromotions.map((promotion) => {
    const requirements = new Map<string, number>()

    for (const group of promotion.groups) {
      for (const productId of group.optionProductIds) {
        requirements.set(productId, (requirements.get(productId) || 0) + 1)
      }
    }

    return {
      promotion,
      requirements,
    }
  })
}

function sanitizeForcedPromotions(items: CartItem[], forcedPromotions: ForcedPromotionSelection[]) {
  if (forcedPromotions.length === 0) return forcedPromotions

  const available = new Map<string, number>()
  for (const item of items) {
    available.set(item.productId, (available.get(item.productId) || 0) + item.quantity)
  }

  const kept: ForcedPromotionSelection[] = []

  for (const entry of buildPromotionRequirementMap(forcedPromotions)) {
    const canKeep = Array.from(entry.requirements.entries()).every(([productId, requiredQuantity]) =>
      (available.get(productId) || 0) >= requiredQuantity
    )

    if (!canKeep) continue

    kept.push(entry.promotion)
    for (const [productId, requiredQuantity] of entry.requirements.entries()) {
      available.set(productId, (available.get(productId) || 0) - requiredQuantity)
    }
  }

  return kept
}

function loadCartFromStorage(): StoredCartState {
  if (typeof window === "undefined") return { items: [], forcedPromotions: [] }

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) {
      return { items: [], forcedPromotions: [] }
    }

    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return { items: parsed, forcedPromotions: [] }
    }

    return {
      items: Array.isArray(parsed?.items) ? parsed.items : [],
      forcedPromotions: Array.isArray(parsed?.forcedPromotions) ? parsed.forcedPromotions : [],
    }
  } catch {
    return { items: [], forcedPromotions: [] }
  }
}

interface CartContextType {
  items: CartItem[]
  forcedPromotions: ForcedPromotionSelection[]
  addItem: (product: { id: string; name: string; price: number; sku?: string | null; barcode?: string | null; unitOfMeasure?: CartItem["unitOfMeasure"]; customUnitName?: string | null }) => void
  addItems: (products: Array<{ productId: string; name: string; price: number; quantity: number; sku?: string | null; barcode?: string | null; unitOfMeasure?: CartItem["unitOfMeasure"]; customUnitName?: string | null }>) => void
  addForcedPromotion: (promotion: ForcedPromotionSelection) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [forcedPromotions, setForcedPromotions] = useState<ForcedPromotionSelection[]>([])
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
    const stored = loadCartFromStorage()
    setItems(stored.items)
    setForcedPromotions(sanitizeForcedPromotions(stored.items, stored.forcedPromotions))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items, forcedPromotions }))
    } catch {
      // Ignore localStorage failures silently
    }
  }, [items, forcedPromotions, hydrated])

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

  function addForcedPromotion(promotion: ForcedPromotionSelection) {
    setForcedPromotions((prev) => [...prev, promotion])
  }

  function removeItem(productId: string) {
    setItems((prev) => {
      const nextItems = prev.filter((item) => item.productId !== productId)
      setForcedPromotions((current) => sanitizeForcedPromotions(nextItems, current))
      return nextItems
    })
  }

  function updateQuantity(productId: string, quantity: number) {
    const normalizedQuantity = roundQuantity(quantity)

    if (normalizedQuantity <= 0) {
      removeItem(productId)
      return
    }
    setItems((prev) =>
      {
        const nextItems = prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: normalizedQuantity, subtotal: normalizedQuantity * item.price }
          : item
      )
        setForcedPromotions((current) => sanitizeForcedPromotions(nextItems, current))
        return nextItems
      }
    )
  }

  function clearCart() {
    setItems([])
    setForcedPromotions([])
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
          forcedPromotions,
          addItem,
          addItems,
          addForcedPromotion,
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

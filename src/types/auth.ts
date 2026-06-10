// User role type for authorization
export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER'

// Session user from NextAuth
export interface SessionUser {
  id: string
  name: string | null
  email: string | null
  role: UserRole
}

// Cart item for POS
export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  subtotal: number
  unitOfMeasure?: 'UNIT' | 'ML' | 'G' | 'KG' | 'LT' | 'OTHER'
  customUnitName?: string | null
  sku?: string | null
  barcode?: string | null
}

export interface ForcedPromotionGroupSelection {
  groupId?: string
  optionProductIds: string[]
}

export interface ForcedPromotionSelection {
  id: string
  promotionId: string
  promotionName: string
  type: 'COMBO'
  groups: ForcedPromotionGroupSelection[]
}

// Generic action result type
export interface ActionResult<T> {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
}

// Location type for API responses
export interface LocationData {
  id: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Category type for API responses
export interface CategoryData {
  id: string
  name: string
  slug: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  children?: CategoryData[]
  _count?: {
    products: number
  }
}

// Product type for API responses
export interface ProductData {
  id: string
  productNumber: number
  name: string
  slug: string
  sku: string | null
  description: string | null
  price: number
  cost: number | null
  barcode: string | null
  image: string | null
  isActive: boolean
  lowStockThreshold: number
  unitOfMeasure: 'UNIT' | 'ML' | 'G' | 'KG' | 'LT' | 'OTHER'
  customUnitName: string | null
  categoryId: string | null
  category?: CategoryData | null
  createdAt: Date
  updatedAt: Date
}

// Sale types
export interface SaleItemData {
  id: string
  productId: string
  product?: ProductData
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface SaleData {
  id: string
  invoiceNumber: string
  userId: string
  locationId: string
  subtotal: number
  tax: number
  total: number
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
  notes: string | null
  createdAt: Date
  items: SaleItemData[]
}

// Dashboard metrics
export interface DashboardMetrics {
  todaySales: number
  todaySalesCount: number
  lowStockProducts: number
  pendingTransfers: number
  topProducts: Array<{
    name: string
    totalSold: number
  }>
}

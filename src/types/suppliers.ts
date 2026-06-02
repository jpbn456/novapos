// Supplier types
export interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  contact: string | null
  notes: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SupplierCreateInput {
  name: string
  email?: string
  phone?: string
  address?: string
  contact?: string
  notes?: string
}

export interface SupplierUpdateInput {
  name?: string
  email?: string
  phone?: string
  address?: string
  contact?: string
  notes?: string
  isActive?: boolean
}

// Purchase Order types
export type PurchaseOrderStatus = 'PENDING' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'

export interface PurchaseOrder {
  id: string
  orderNumber: string
  supplierId: string
  supplier?: Supplier
  locationId: string
  location?: { id: string; name: string }
  userId: string
  user?: { id: string; name: string }
  status: PurchaseOrderStatus
  subtotal: number
  tax: number
  total: number
  expectedDate: Date | null
  receivedDate: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  items: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  productId: string
  product?: { id: string; name: string; productNumber: number }
  quantity: number
  receivedQty: number
  unitCost: number
  subtotal: number
}

export interface PurchaseOrderCreateInput {
  supplierId: string
  locationId: string
  expectedDate?: Date
  notes?: string
  items: {
    productId: string
    quantity: number
    unitCost: number
  }[]
}

export interface PurchaseOrderUpdateInput {
  supplierId?: string
  locationId?: string
  status?: PurchaseOrderStatus
  expectedDate?: Date
  notes?: string
  items?: {
    productId: string
    quantity: number
    unitCost: number
  }[]
}

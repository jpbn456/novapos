// ============================================
// Report Types for RetailPOS
// ============================================

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  locationId?: string;
  productId?: string;
  supplierId?: string;
  status?: string;
}

// ============================================
// Sales Report Types
// ============================================

export interface SalesReportItem {
  id: string;
  product: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SalesReportGroup {
  invoiceNumber: string;
  date: string;
  location: string;
  cashier: string;
  paymentMethod: string;
  status: string;
  tax: number;
  total: number;
  items: SalesReportItem[];
}

export interface SalesReportSummary {
  totalSales: number;
  totalItems: number;
  totalTax: number;
  averageTicket: number;
  salesCount: number;
}

// ============================================
// Inventory Report Types
// ============================================

export interface InventoryReportRow {
  id: string;
  productNumber: number;
  product: string;
  category: string;
  location: string;
  quantity: number;
  cost: number;
  price: number;
  stockValue: number;
  isLowStock: boolean;
}

export interface InventoryReportSummary {
  totalProducts: number;
  totalLocations: number;
  totalStockValue: number;
  lowStockCount: number;
}

// ============================================
// Transfer Report Types
// ============================================

export interface TransferReportRow {
  id: string;
  reference: string;
  date: string;
  fromLocation: string;
  toLocation: string;
  user: string;
  status: string;
  product: string;
  quantity: number;
  notes?: string;
}

export interface TransferReportSummary {
  totalTransfers: number;
  totalItems: number;
  pendingCount: number;
  completedCount: number;
}

// ============================================
// Purchase Order Report Types
// ============================================

export interface PurchaseReportItem {
  id: string;
  product: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface PurchaseReportGroup {
  orderNumber: string;
  date: string;
  supplier: string;
  location: string;
  user: string;
  status: string;
  total: number;
  expectedDate?: string;
  receivedDate?: string;
  items: PurchaseReportItem[];
}

export interface PurchaseReportSummary {
  totalOrders: number;
  totalItems: number;
  totalValue: number;
  pendingCount: number;
  receivedCount: number;
}

// ============================================
// Chart Data Types
// ============================================

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalSold: number;
  revenue: number;
}

export interface ChartsData {
  salesByDay: ChartDataPoint[];
  topProducts: TopProduct[];
  paymentMethodBreakdown: {
    method: string;
    count: number;
    total: number;
  }[];
}

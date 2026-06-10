import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode } from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"

// ── Mock ALL Radix-based UI components (compose-refs loop in jsdom + React 19) ──

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, type, variant, size, className }: {
    children: ReactNode; onClick?: () => void; disabled?: boolean; type?: string;
    variant?: string; size?: string; className?: string;
  }) => (
    <button type={type === "submit" ? "submit" : "button"} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <select data-testid="select" value={value || ""} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="">Seleccionar</option>
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder || ""}</span>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <p data-testid="card-description">{children}</p>,
  CardHeader: ({ children }: { children: ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3 data-testid="card-title">{children}</h3>,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}))

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, className }: { children: ReactNode; className?: string }) => <td className={className}>{children}</td>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}))

// ── Mock server actions ──────────────────────────────────────────
const mockGetLocations = vi.fn()
const mockGetProducts = vi.fn()
const mockGetActivePromotions = vi.fn()
const mockGetCashSessions = vi.fn()
const mockCreateSale = vi.fn()

vi.mock("@/app/actions/locations", () => ({
  getLocations: (...args: unknown[]) => mockGetLocations(...args),
}))

vi.mock("@/app/actions/products", () => ({
  getProducts: (...args: unknown[]) => mockGetProducts(...args),
}))

vi.mock("@/app/actions/promotions", () => ({
  getActivePromotions: (...args: unknown[]) => mockGetActivePromotions(...args),
}))

vi.mock("@/app/actions/cash", () => ({
  getCashSessions: (...args: unknown[]) => mockGetCashSessions(...args),
}))

vi.mock("@/app/actions/sales", () => ({
  createSale: (...args: unknown[]) => mockCreateSale(...args),
}))

// Mock auth/prisma/server deps that actions import transitively
vi.mock("@/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/promotion-data", () => ({ getActivePromotionsData: vi.fn() }))

// ── Mock next/navigation ──────────────────────────────────────────
const stableSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => stableSearchParams,
}))

// ── Mock cart context ──────────────────────────────────────────────
let mockCartItems: Array<{ productId: string; name: string; price: number; quantity: number; subtotal: number; unitOfMeasure: string; customUnitName: string | null }> = []
let mockForcedPromotions: Array<{ id: string; promotionId: string; promotionName: string; type: "COMBO"; groups: Array<{ groupId?: string; optionProductIds: string[] }> }> = []
const mockAddItem = vi.fn()
const mockAddItems = vi.fn()
const mockAddForcedPromotion = vi.fn()
const mockRemoveItem = vi.fn()
const mockUpdateQuantity = vi.fn()
const mockClearCart = vi.fn()
const mockGetItemCount = vi.fn(() => mockCartItems.length)

vi.mock("@/contexts/cart-context", () => ({
  CartProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCart: () => ({
    items: mockCartItems,
    forcedPromotions: mockForcedPromotions,
    addItem: mockAddItem,
    addItems: mockAddItems,
    addForcedPromotion: mockAddForcedPromotion,
    removeItem: mockRemoveItem,
    updateQuantity: mockUpdateQuantity,
    clearCart: mockClearCart,
    getItemCount: mockGetItemCount,
  }),
}))

// ── Import after mocks ────────────────────────────────────────────
import POSPage from "../page"

const sampleProducts = [
  { id: "coffee", productNumber: 1, name: "Café", price: 500, sku: null, barcode: null, unitOfMeasure: "UNIT" as const, customUnitName: null },
  { id: "toast", productNumber: 2, name: "Tostado", price: 400, sku: null, barcode: null, unitOfMeasure: "UNIT" as const, customUnitName: null },
]

const samplePromotions = [
  {
    id: "promo-1",
    name: "Combo desayuno",
    description: "Café + tostado",
    type: "COMBO" as const,
    comboPrice: 800,
    discountPercent: null,
    discountAmount: null,
    comboItems: [],
    tiers: [],
    products: [{ id: "pp1", productId: "coffee", product: sampleProducts[0] }, { id: "pp2", productId: "toast", product: sampleProducts[1] }],
    groups: [
      {
        id: "g1",
        name: "Base",
        type: "OBLIGATORIO" as const,
        requiredQuantity: 2,
        sortOrder: 0,
        options: [
          { id: "o1", productId: "coffee", quantity: 1, sortOrder: 0, product: sampleProducts[0] },
          { id: "o2", productId: "toast", quantity: 1, sortOrder: 1, product: sampleProducts[1] },
        ],
      },
    ],
  },
  {
    id: "promo-2",
    name: "Combo con opciones",
    description: "Elegí tu bebida",
    type: "COMBO" as const,
    comboPrice: 600,
    discountPercent: null,
    discountAmount: null,
    comboItems: [],
    tiers: [],
    products: [{ id: "pp3", productId: "coffee", product: sampleProducts[0] }, { id: "pp4", productId: "juice", product: { id: "juice", productNumber: 3, name: "Jugo", price: 300, sku: null, barcode: null, unitOfMeasure: "UNIT" as const, customUnitName: null } }],
    groups: [
      {
        id: "g2",
        name: "Bebida",
        type: "ELEGIBLE" as const,
        requiredQuantity: 1,
        sortOrder: 0,
        options: [
          { id: "o3", productId: "coffee", quantity: 1, sortOrder: 0, product: sampleProducts[0] },
          { id: "o4", productId: "juice", quantity: 1, sortOrder: 1, product: { id: "juice", productNumber: 3, name: "Jugo", price: 300, sku: null, barcode: null, unitOfMeasure: "UNIT" as const, customUnitName: null } },
        ],
      },
    ],
  },
  {
    id: "promo-3",
    name: "Cafe por cantidad",
    description: "Descuento por llevar varias unidades",
    type: "SCALE" as const,
    comboPrice: null,
    discountPercent: null,
    discountAmount: null,
    comboItems: [],
    groups: [],
    tiers: [
      { id: "tier-1", minimumQuantity: 3, discountPercent: 10, discountAmount: null, productId: "coffee" },
    ],
    products: [{ id: "pp5", productId: "coffee", product: sampleProducts[0] }],
  },
]

async function waitForLoad() {
  await waitFor(() => {
    expect(screen.queryByText("Cargando...")).not.toBeInTheDocument()
  }, { timeout: 5000 })
}

describe("POS Page — Promotions UI", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockCartItems = []
    mockForcedPromotions = []

    mockGetLocations.mockResolvedValue({
      success: true,
      data: [{ id: "loc-1", name: "Sucursal Centro", isActive: true }],
    })

    mockGetProducts.mockResolvedValue({
      success: true,
      data: { products: sampleProducts },
    })

    mockGetActivePromotions.mockResolvedValue(samplePromotions)

    mockGetCashSessions.mockResolvedValue([
      { id: "cs-1", locationId: "loc-1", registerLabel: "Caja 1", shiftLabel: "MANANA", status: "OPEN" },
    ])

    mockCreateSale.mockResolvedValue({ success: true, data: { invoiceNumber: "001-0001", items: [], total: 0, location: { name: "Sucursal Centro" }, user: { name: "Test" } } })
  })

  test("shows empty state when no promotions are active", async () => {
    mockGetActivePromotions.mockResolvedValue([])

    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))

    expect(screen.getByText("No hay combos para elegir.")).toBeInTheDocument()
  })

  test("renders promotion cards when promotions are active", async () => {
    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))

    expect(screen.getByText("Combo desayuno")).toBeInTheDocument()
    expect(screen.getByText("Combo con opciones")).toBeInTheDocument()
    expect(screen.queryByText("Cafe por cantidad")).not.toBeInTheDocument()
    expect(screen.getByText(/Las promociones escaladas se activan cargando productos/i)).toBeInTheDocument()
  })

  test("shows combo-only empty state when only scale promotions exist", async () => {
    mockGetActivePromotions.mockResolvedValue([samplePromotions[2]])

    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))

    expect(screen.getByText("No hay combos para elegir.")).toBeInTheDocument()
    expect(screen.getByText(/Las promociones escaladas siguen funcionando/i)).toBeInTheDocument()
  })

  test("clicking mandatory-only promo adds items directly to cart without modal", async () => {
    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))
    await screen.findByText("Combo desayuno")

    await userEvent.click(screen.getByText("Combo desayuno"))

    expect(mockAddItems).toHaveBeenCalledTimes(1)
    expect(mockAddForcedPromotion).toHaveBeenCalledTimes(1)
    expect(mockAddItems).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ productId: "coffee" }),
        expect.objectContaining({ productId: "toast" }),
      ])
    )
  })

  test("clicking eligible-group promo opens selection dialog", async () => {
    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))
    await screen.findByText("Combo con opciones")

    await userEvent.click(screen.getByText("Combo con opciones"))

    expect(screen.getByTestId("dialog")).toBeInTheDocument()
    expect(within(screen.getByTestId("dialog-content")).getByText("Elegí tu bebida")).toBeInTheDocument()
  })

  test("modal confirm button is disabled when no selection made", async () => {
    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))
    await screen.findByText("Combo con opciones")
    await userEvent.click(screen.getByText("Combo con opciones"))

    const confirmButton = screen.getByRole("button", { name: /Agregar al carrito/i })
    expect(confirmButton).toBeDisabled()
  })

  test("selecting option enables the confirm button", async () => {
    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))
    await screen.findByText("Combo con opciones")
    await userEvent.click(screen.getByText("Combo con opciones"))

    const dialog = screen.getByTestId("dialog-content")
    const radios = within(dialog).getAllByRole("radio")
    await userEvent.click(radios[0])

    const confirmButton = within(dialog).getByRole("button", { name: /Agregar al carrito/i })
    expect(confirmButton).not.toBeDisabled()
  })

  test("confirming adds items to cart and closes dialog", async () => {
    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))
    await screen.findByText("Combo con opciones")
    await userEvent.click(screen.getByText("Combo con opciones"))

    const dialog = screen.getByTestId("dialog-content")
    const radios = within(dialog).getAllByRole("radio")
    await userEvent.click(radios[0])

    await userEvent.click(screen.getByRole("button", { name: /Agregar al carrito/i }))

    expect(mockAddItems).toHaveBeenCalledTimes(1)
    expect(mockAddForcedPromotion).toHaveBeenCalledTimes(1)
    expect(mockAddItems).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ productId: "coffee" }),
      ])
    )
  })

  test("cancelling dialog closes it without adding items", async () => {
    render(<POSPage />)
    await waitForLoad()

    await userEvent.click(screen.getByRole("button", { name: /Promociones/i }))
    await screen.findByText("Combo con opciones")
    await userEvent.click(screen.getByText("Combo con opciones"))

    const cancelButton = screen.getByRole("button", { name: /Cancelar/i })
    await userEvent.click(cancelButton)

    expect(mockAddItems).not.toHaveBeenCalled()
  })
})

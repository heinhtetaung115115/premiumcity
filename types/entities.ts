import type { ProductInputField } from './product';

export type ProductVariant = {
  id: string;
  productId: string;
  name: string;
  price: number;
  isDefault: boolean;
  isActive: boolean;
  position: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  categoryId: string;
  productType: 'INSTANT' | 'MANUAL';
  status: 'ACTIVE' | 'INACTIVE';
  isInStock: boolean;
  inputSchema: ProductInputField[] | null;
  deliveryNote: string | null;
  variants: ProductVariant[];
  category?: { id: string; name: string; slug: string } | null;
};

export type InventoryItem = {
  id: string;
  payload: Record<string, unknown> | null;
  assignedAt: string | null;
};

export type OrderItem = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  price: number;
  manualInput: Record<string, unknown> | null;
  deliveredData: Record<string, unknown> | null;
  deliveryStatus: 'PENDING_FULFILLMENT' | 'FULFILLED' | 'CANCELLED';
  product: Pick<Product, 'id' | 'name' | 'slug' | 'productType' | 'deliveryNote'>;
  variant: Pick<ProductVariant, 'id' | 'name'> | null;
  inventoryItems: InventoryItem[];
};

export type Order = {
  id: string;
  orderNumber: number;
  userId: string;
  total: number;
  status: 'PENDING_FULFILLMENT' | 'FULFILLED' | 'CANCELLED';
  paymentMethod: string;
  manualPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string | null; name: string | null } | null;
  orderItems: OrderItem[];
};

export type WalletTransaction = {
  id: string;
  type: 'TOPUP' | 'PURCHASE' | 'ADJUSTMENT' | 'REFUND';
  amount: number;
  balanceAfter: number;
  reference: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type TopupRequest = {
  id: string;
  userId: string;
  amount: number;
  bankName: string;
  referenceHint: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminComment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  accountNo: string;
  instructions: string | null;
  qrCodeUrl: string | null;
  isActive: boolean;
};

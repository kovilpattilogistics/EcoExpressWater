export enum UserRole {
  ADMIN = 'ADMIN',
  DELIVERY_PARTNER = 'DELIVERY_PARTNER',
  CUSTOMER = 'CUSTOMER',
  PUBLIC = 'PUBLIC'
}

export enum ProductType {
  BOTTLE_300ML = '300ml Bottle',
  BOTTLE_500ML = '500ml Bottle',
  BOTTLE_1L = '1L Bottle',
  BOTTLE_2L = '2L Bottle',
  CAN_20L = '20L Can'
}

export enum CanState {
  FILLED = 'Filled',
  EMPTY = 'Empty',
  NEW = 'New' // For admin purchase
}

export enum OrderStatus {
  PENDING = 'Order confirmation pending',
  CONFIRMED = 'Order Confirmed',
  DISPATCHED = 'Order Dispatched',
  DELIVERED = 'Delivered',
  COMPLETED = 'Empty cans picked' // Final state if applicable
}

export interface ProductDefinition {
  type: ProductType;
  itemsPerCase?: number; // Only for bottles
  retailPrice: number;
  normalPrice: number;
  costPrice: number; // For ROI calc
  refillCost?: number; // Only for cans
}

export interface InventoryItem {
  type: ProductType;
  canState?: CanState; // Only for cans
  quantity: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: 'REGULAR' | 'RETAIL' | 'PUBLIC';
  location: string;
  shopName?: string;
  pendingAmount: number;
  password?: string; // Mock auth
  email?: string; // Mock auth username
  outstandingCans: number;
}

export interface OrderItem {
  productType: ProductType;
  quantity: number; // Raw quantity (bottles or cans)
  calculatedCases?: number | null; // Helper for display
  pricePerUnit: number;
  totalPrice: number;
  originalQuantity?: number | null;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerType: 'REGULAR' | 'RETAIL' | 'PUBLIC';
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  deliveryLocation: string;
  deliveryDate: string;
  deliveryTime: string;
  createdAt: string;
  completedAt?: string;
  emptyCansReturned?: number;
  driverId?: string;
  paymentMode?: PaymentMode;
  paymentStatus?: PaymentStatus;
  amountReceived?: number;
  cashHandoverStatus?: 'PENDING' | 'COMPLETED';
}

export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID'
}

export interface Transaction {
  id: string;
  type: 'EXPENSE' | 'INCOME';
  amount: number;
  date: string;
  description: string;
  category: 'STOCK_PURCHASE' | 'ORDER_REVENUE';
}

export interface VehicleInventory {
  driverId: string;
  items: InventoryItem[];
}
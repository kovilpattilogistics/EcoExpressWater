import {
  InventoryItem,
  Order,
  Customer,
  ProductType,
  CanState,
  Transaction,
  VehicleInventory,
  OrderItem,
  OrderStatus
} from '../types';
import { PRODUCT_CONFIG } from '../constants';

// Keys for LocalStorage
const STORAGE_KEYS = {
  INVENTORY: 'eco_inventory',
  ORDERS: 'eco_orders',
  CUSTOMERS: 'eco_customers',
  TRANSACTIONS: 'eco_transactions',
  VEHICLE_INVENTORY: 'eco_vehicle_inventory'
};

// Initial Data Seed
const seedData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.INVENTORY)) {
    const initialInventory: InventoryItem[] = [
      { type: ProductType.CAN_20L, quantity: 100, canState: CanState.FILLED },
      { type: ProductType.CAN_20L, quantity: 20, canState: CanState.EMPTY },
      { type: ProductType.BOTTLE_300ML, quantity: 50 }, // Cases
      { type: ProductType.BOTTLE_500ML, quantity: 40 },
      { type: ProductType.BOTTLE_1L, quantity: 30 },
      { type: ProductType.BOTTLE_2L, quantity: 20 },
    ];
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(initialInventory));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    const initialCustomers: Customer[] = [
      {
        id: 'c1', name: 'Raja Stores', phone: '9876543210', type: 'RETAIL',
        location: 'Kovilpatti Main Rd', shopName: 'Raja General Store',
        pendingAmount: 450, email: 'raja@store.com', password: 'password', outstandingCans: 5
      }
    ];
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(initialCustomers));
  }
};

seedData();

// --- Helpers ---

export const getInventory = (): InventoryItem[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.INVENTORY) || '[]');
};

export const updateInventory = (newItem: InventoryItem, isAddition: boolean) => {
  const inventory = getInventory();
  const existingItemIndex = inventory.findIndex(
    i => i.type === newItem.type && i.canState === newItem.canState
  );

  if (existingItemIndex > -1) {
    if (isAddition) {
      inventory[existingItemIndex].quantity += newItem.quantity;
    } else {
      inventory[existingItemIndex].quantity = Math.max(0, inventory[existingItemIndex].quantity - newItem.quantity);
    }
  } else if (isAddition) {
    inventory.push(newItem);
  }

  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
};

export const getOrders = (): Order[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
};

export const saveOrder = (order: Order) => {
  const orders = getOrders();
  const index = orders.findIndex(o => o.id === order.id);
  if (index > -1) {
    orders[index] = order;
  } else {
    orders.push(order);
  }
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
};

export const deleteOrder = (orderId: string) => {
  const orders = getOrders();
  const updatedOrders = orders.filter(o => o.id !== orderId);
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));
};


export const getCustomers = (): Customer[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || '[]');
};

export const saveCustomer = (customer: Customer) => {
  const customers = getCustomers();
  const index = customers.findIndex(c => c.id === customer.id);
  if (index > -1) {
    customers[index] = customer;
  } else {
    customers.push(customer);
  }
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
};

export const findCustomerByPhone = (phone: string): Customer | undefined => {
  const customers = getCustomers();
  return customers.find(c => c.phone === phone);
};

export const getVehicleInventory = (driverId: string): InventoryItem[] => {
  const allVehicles = JSON.parse(localStorage.getItem(STORAGE_KEYS.VEHICLE_INVENTORY) || '{}');
  return allVehicles[driverId] || [];
};

export const updateVehicleInventory = (driverId: string, item: InventoryItem, isLoad: boolean) => {
  const allVehicles = JSON.parse(localStorage.getItem(STORAGE_KEYS.VEHICLE_INVENTORY) || '{}');
  const vehicleItems: InventoryItem[] = allVehicles[driverId] || [];

  const existingIndex = vehicleItems.findIndex(i => i.type === item.type && i.canState === item.canState);

  if (existingIndex > -1) {
    if (isLoad) {
      vehicleItems[existingIndex].quantity += item.quantity;
    } else {
      vehicleItems[existingIndex].quantity = Math.max(0, vehicleItems[existingIndex].quantity - item.quantity);
    }
  } else if (isLoad) {
    vehicleItems.push(item);
  }

  allVehicles[driverId] = vehicleItems;
  localStorage.setItem(STORAGE_KEYS.VEHICLE_INVENTORY, JSON.stringify(allVehicles));

  // Sync with main inventory (If loading, remove from warehouse. If unloading, add to warehouse)
  updateInventory(item, !isLoad);
};

export const addTransaction = (transaction: Transaction) => {
  const transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
  transactions.push(transaction);
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
};

export const getTransactions = (): Transaction[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) || '[]');
};

// Case Calculation Algorithm
export const calculateCases = (productType: ProductType, quantity: number): { cases: number, loose: number, display: string } => {
  const config = PRODUCT_CONFIG[productType];
  if (productType === ProductType.CAN_20L || !config.itemsPerCase) {
    return { cases: 0, loose: quantity, display: `${quantity} Cans` };
  }

  const itemsPerCase = config.itemsPerCase;
  const cases = Math.floor(quantity / itemsPerCase);
  const loose = quantity % itemsPerCase;

  // Logic: If > 1 case worth requested, treat as cases.
  // Prompt says: "If the requested quantity is more than one full case, the system should calculate the number of full cases plus remaining bottles"

  // Logic Fix based on prompt: "if customer asks 40 bottles... system should inform... 2 case" 
  // Wait, 40 bottles of 300ml (35/case) is 1 case + 5 bottles. 
  // The prompt says: "if quantity is more than 1 than case, it should consider new case". 
  // This implies rounding up for delivery preparation? 
  // Let's implement exact math but display "X Cases + Y Bottles".

  let display = "";
  if (cases > 0) {
    display = `${cases} Case${cases > 1 ? 's' : ''}`;
    if (loose > 0) display += ` + ${loose} Bottles`;
  } else {
    display = `${loose} Bottles`;
  }

  return { cases, loose, display };
};

import {
  InventoryItem,
  Order,
  Customer,
  ProductType,
  Transaction,
  OrderStatus
} from '../types';
import { PRODUCT_CONFIG } from '../constants';

// --- LocalStorage Keys ---
const STORAGE_KEYS = {
  ORDERS: 'eco_orders',
  CUSTOMERS: 'eco_customers',
  INVENTORY: 'eco_inventory',
  VEHICLE_INVENTORY: 'eco_vehicle_inventory',
  TRANSACTIONS: 'eco_transactions'
};

// --- Helpers ---

// Calculate Cases (Pure Function)
export const calculateCases = (productType: ProductType, quantity: number): { cases: number, loose: number, display: string } => {
  const config = PRODUCT_CONFIG[productType];
  if (productType === ProductType.CAN_20L || !config.itemsPerCase) {
    return { cases: 0, loose: quantity, display: `${quantity} Cans` };
  }

  const itemsPerCase = config.itemsPerCase;
  const cases = Math.floor(quantity / itemsPerCase);
  const loose = quantity % itemsPerCase;

  let display = "";
  if (cases > 0) {
    display = `${cases} Case${cases > 1 ? 's' : ''}`;
    if (loose > 0) display += ` + ${loose} Bottles`;
  } else {
    display = `${loose} Bottles`;
  }

  return { cases, loose, display };
};

export const calculateSmartRounding = (productType: ProductType, quantity: number): { roundedQty: number, isRounded: boolean, originalQty: number, extra: number } => {
  const config = PRODUCT_CONFIG[productType];
  if (!config.itemsPerCase || !productType.includes('Bottle')) {
    return { roundedQty: quantity, isRounded: false, originalQty: quantity, extra: 0 };
  }

  const itemsPerCase = config.itemsPerCase;
  if (quantity > itemsPerCase) {
    const cases = Math.ceil(quantity / itemsPerCase);
    const roundedQty = cases * itemsPerCase;
    if (roundedQty !== quantity) {
      return { roundedQty, isRounded: true, originalQty: quantity, extra: roundedQty - quantity };
    }
  }

  return { roundedQty: quantity, isRounded: false, originalQty: quantity, extra: 0 };
};

// --- LocalStorage Helper Functions ---

const getFromStorage = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading ${key} from localStorage`, error);
    return [];
  }
};

const saveToStorage = <T>(key: string, data: T[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage`, error);
  }
};

// --- Orders ---

export const subscribeOrders = (callback: (orders: Order[]) => void) => {
  // Initial load
  callback(getFromStorage<Order>(STORAGE_KEYS.ORDERS));

  // Poll for changes (simple way to mimic subscription)
  const interval = setInterval(() => {
    callback(getFromStorage<Order>(STORAGE_KEYS.ORDERS));
  }, 2000);

  return () => clearInterval(interval);
};

export const getOrders = async (): Promise<Order[]> => {
  return getFromStorage<Order>(STORAGE_KEYS.ORDERS);
};

export const saveOrder = async (order: Order) => {
  const orders = getFromStorage<Order>(STORAGE_KEYS.ORDERS);
  const existingIndex = orders.findIndex(o => o.id === order.id);

  if (existingIndex >= 0) {
    orders[existingIndex] = order;
  } else {
    orders.push(order);
  }

  saveToStorage(STORAGE_KEYS.ORDERS, orders);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate net latency
};

export const deleteOrder = async (orderId: string) => {
  const orders = getFromStorage<Order>(STORAGE_KEYS.ORDERS);
  const newOrders = orders.filter(o => o.id !== orderId);
  saveToStorage(STORAGE_KEYS.ORDERS, newOrders);
};

// --- Customers ---

export const subscribeCustomers = (callback: (customers: Customer[]) => void) => {
  callback(getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS));
  const interval = setInterval(() => {
    callback(getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS));
  }, 2000);
  return () => clearInterval(interval);
};

export const getCustomers = async (): Promise<Customer[]> => {
  return getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
};

export const saveCustomer = async (customer: Customer) => {
  const customers = getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
  const existingIndex = customers.findIndex(c => c.id === customer.id);

  if (existingIndex >= 0) {
    customers[existingIndex] = customer;
  } else {
    customers.push(customer);
  }

  saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
  await new Promise(resolve => setTimeout(resolve, 300));
};

export const deleteCustomer = async (customerId: string) => {
  const customers = getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
  const newCustomers = customers.filter(c => c.id !== customerId);
  saveToStorage(STORAGE_KEYS.CUSTOMERS, newCustomers);

  // Anonymize orders
  const orders = getFromStorage<Order>(STORAGE_KEYS.ORDERS);
  const updatedOrders = orders.map(o => {
    if (o.customerId === customerId) {
      return { ...o, customerName: 'Deleted Customer', customerId: 'deleted_user' };
    }
    return o;
  });
  saveToStorage(STORAGE_KEYS.ORDERS, updatedOrders);
};

export const findCustomerByPhone = async (phone: string): Promise<Customer | undefined> => {
  const customers = getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
  return customers.find(c => c.phone === phone);
};

// --- Inventory ---

export const subscribeInventory = (callback: (items: InventoryItem[]) => void) => {
  callback(getFromStorage<InventoryItem>(STORAGE_KEYS.INVENTORY));
  const interval = setInterval(() => {
    callback(getFromStorage<InventoryItem>(STORAGE_KEYS.INVENTORY));
  }, 2000);
  return () => clearInterval(interval);
};

export const updateInventory = async (item: InventoryItem, isAddition: boolean) => {
  const inventory = getFromStorage<InventoryItem>(STORAGE_KEYS.INVENTORY);
  const existingIndex = inventory.findIndex(i => i.type === item.type && i.canState === item.canState);

  if (existingIndex >= 0) {
    const currentQty = inventory[existingIndex].quantity || 0;
    inventory[existingIndex].quantity = isAddition
      ? currentQty + item.quantity
      : Math.max(0, currentQty - item.quantity);
  } else {
    // For subtraction on non-existent item, assume 0 start
    if (isAddition) {
      inventory.push(item);
    }
  }

  saveToStorage(STORAGE_KEYS.INVENTORY, inventory);
};

export const setInventoryQuantity = async (item: InventoryItem) => {
  const inventory = getFromStorage<InventoryItem>(STORAGE_KEYS.INVENTORY);
  const existingIndex = inventory.findIndex(i => i.type === item.type && i.canState === item.canState);

  if (existingIndex >= 0) {
    inventory[existingIndex] = item;
  } else {
    inventory.push(item);
  }

  saveToStorage(STORAGE_KEYS.INVENTORY, inventory);
};

// --- Vehicle Inventory ---

export const getVehicleInventory = async (driverId: string): Promise<InventoryItem[]> => {
  const allVehicleData = getFromStorage<any>(STORAGE_KEYS.VEHICLE_INVENTORY);
  const vehicleData = allVehicleData.find((v: any) => v.driverId === driverId);
  return vehicleData ? vehicleData.items : [];
};

export const updateVehicleInventory = async (driverId: string, item: InventoryItem, isLoad: boolean) => {
  const allVehicleData = getFromStorage<any>(STORAGE_KEYS.VEHICLE_INVENTORY);
  let vehicleIndex = allVehicleData.findIndex((v: any) => v.driverId === driverId);

  if (vehicleIndex === -1) {
    allVehicleData.push({ driverId, items: [] });
    vehicleIndex = allVehicleData.length - 1;
  }

  const currentItems = allVehicleData[vehicleIndex].items as InventoryItem[];
  const existingIndex = currentItems.findIndex(i => i.type === item.type && i.canState === item.canState);

  if (existingIndex > -1) {
    if (isLoad) {
      currentItems[existingIndex].quantity = item.quantity;
    } else {
      currentItems[existingIndex].quantity = (currentItems[existingIndex].quantity || 0) + item.quantity;
    }
  } else {
    if (isLoad) {
      currentItems.push(item);
    } else {
      // Assuming adding stock if not load? Logic follows original mock
      currentItems.push(item);
    }
  }

  allVehicleData[vehicleIndex].items = currentItems;
  saveToStorage(STORAGE_KEYS.VEHICLE_INVENTORY, allVehicleData);
};

// --- Transactions ---

export const addTransaction = async (transaction: Transaction) => {
  const transactions = getFromStorage<Transaction>(STORAGE_KEYS.TRANSACTIONS);
  transactions.push(transaction);
  saveToStorage(STORAGE_KEYS.TRANSACTIONS, transactions);
};

export const subscribeTransactions = (callback: (transactions: Transaction[]) => void) => {
  callback(getFromStorage<Transaction>(STORAGE_KEYS.TRANSACTIONS));
  const interval = setInterval(() => {
    callback(getFromStorage<Transaction>(STORAGE_KEYS.TRANSACTIONS));
  }, 2000);
  return () => clearInterval(interval);
};

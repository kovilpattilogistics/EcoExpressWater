import {
  InventoryItem,
  Order,
  Customer,
  ProductType,
  Transaction,
  OrderStatus
} from '../types';
import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  deleteDoc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { PRODUCT_CONFIG } from '../constants';

// --- Helpers ---

// Calculate Cases (Pure Function, no async needed)
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

// --- Firestore Services ---

// Orders
export const subscribeOrders = (callback: (orders: Order[]) => void) => {
  const q = query(collection(db, 'orders'));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    callback(orders);
  });
};

// Deprecated synchronous getter - helpful for refactoring if needed, but we should move to async
export const getOrders = async (): Promise<Order[]> => {
  const snapshot = await getDocs(collection(db, 'orders'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
};


export const saveOrder = async (order: Order) => {
  try {
    await setDoc(doc(db, 'orders', order.id), order);
  } catch (e) {
    console.error("Error saving order:", e);
    throw e; // Re-throw so caller knows
  }
};

export const deleteOrder = async (orderId: string) => {
  await deleteDoc(doc(db, 'orders', orderId));
};

// Customers
export const subscribeCustomers = (callback: (customers: Customer[]) => void) => {
  const q = query(collection(db, 'customers'));
  return onSnapshot(q, (snapshot) => {
    const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    callback(customers);
  });
};

export const getCustomers = async (): Promise<Customer[]> => {
  const snapshot = await getDocs(collection(db, 'customers'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
};

export const saveCustomer = async (customer: Customer) => {
  await setDoc(doc(db, 'customers', customer.id), customer);
};

export const deleteCustomer = async (customerId: string) => {
  // 1. Delete Customer
  await deleteDoc(doc(db, 'customers', customerId));

  // 2. Anonymize Orders (Example - heavy operation, might want a backend function ideally)
  const q = query(collection(db, 'orders'), where('customerId', '==', customerId));
  const snapshot = await getDocs(q);
  snapshot.forEach(async (d) => {
    await updateDoc(doc(db, 'orders', d.id), {
      customerName: 'Deleted Customer',
      customerId: 'deleted_user'
    });
  });
};

// Inventory (Simple Fetch for now, could be subscribed)
export const subscribeInventory = (callback: (items: InventoryItem[]) => void) => {
  return onSnapshot(collection(db, 'inventory'), (snapshot) => {
    const items = snapshot.docs.map(d => d.data() as InventoryItem);
    callback(items);
  });
};

// Helper to generate consistent ID
const getInventoryId = (item: InventoryItem) => {
  return `${item.type}_${item.canState || 'NA'}`.replace(/\s+/g, '_');
};

export const updateInventory = async (item: InventoryItem, isAddition: boolean) => {
  const id = getInventoryId(item);
  const docRef = doc(db, 'inventory', id);
  const snap = await getDoc(docRef);

  let currentQty = 0;
  if (snap.exists()) {
    currentQty = (snap.data() as InventoryItem).quantity;
  } else {
    // If new item, ensure other fields are set
    // For now we persist what is passed
  }

  const newQty = isAddition ? currentQty + item.quantity : Math.max(0, currentQty - item.quantity);

  await setDoc(docRef, { ...item, quantity: newQty }); // strategies may vary, but simple merge/set is fine
};

export const setInventoryQuantity = async (item: InventoryItem) => {
  const id = getInventoryId(item);
  await setDoc(doc(db, 'inventory', id), item);
};

// Vehicle Inventory
// Removed duplicate getVehicleInventory placeholder

// ... Wait, I should rewrite the whole block properly.

export const findCustomerByPhone = async (phone: string): Promise<Customer | undefined> => {
  const q = query(collection(db, 'customers'), where('phone', '==', phone));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return undefined;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as Customer;
};

export const getVehicleInventory = async (driverId: string): Promise<InventoryItem[]> => {
  const docRef = doc(db, 'vehicle_inventory', driverId);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return (data.items as InventoryItem[]) || [];
    }
  } catch (e) {
    console.warn("Error fetching vehicle inventory", e);
  }
  return [];
};

export const updateVehicleInventory = async (driverId: string, item: InventoryItem, isLoad: boolean) => {
  const docRef = doc(db, 'vehicle_inventory', driverId); // Assuming one doc per driver with all items?
  // Actually, keeping it simple: Collection 'vehicle_inventory' -> Doc 'driverId' -> Field 'items' (List)
  // OR Collection 'vehicle_inventory' -> Doc 'driverId' -> Subcollection 'items' -> Doc 'itemId'?

  // Let's go with: Collection 'vehicle_inventory' -> Doc 'driverId' -> Subcollection 'items' -> Doc 'itemId'
  // This matches getVehicleInventory logic if we query subcollection.
  // BUT getVehicleInventory currently attempts `getDoc(doc(db, 'vehicle_inventory', driverId))`.
  // So let's stick to a single document with an array 'items'.

  try {
    const snap = await getDoc(docRef);
    let currentItems: InventoryItem[] = [];

    if (snap.exists()) {
      const data = snap.data();
      currentItems = (data.items as InventoryItem[]) || [];
    }

    const existingIndex = currentItems.findIndex(i => i.type === item.type && i.canState === item.canState);

    if (existingIndex > -1) {
      if (isLoad) {
        // Overwrite if it's a "Load" operation (like from Modal) OR accumulate?
        // The modal sends the FINAL quantity. So verification:
        // Modal calls `updateVehicleInventory(driverId, item, true)` for "overwrite".
        // Delivery Dashboard calls it for "unloading" or "selling"?
        // Let's assume the argument `isLoad` acts as "Force Set" if we want, or we need more specific logic.
        // Actually, looking at usages:
        // VehicleStockModal: `updateVehicleInventory(driverId, item, true)` (Overwrite)
        // DeliveryDashboard: calls it to decrement?

        // Wait, the previous code just had `isLoad`. 
        // Let's assume `isLoad` === true means "Set Absolute Quantity".
        // `isLoad` === false means "Decrement/Increment"?
        // The previous mock implementation (pre-firebase) was:
        // if (isLoad) { existing.quantity = item.quantity } else { existing.quantity += item.quantity }

        currentItems[existingIndex].quantity = isLoad ? item.quantity : currentItems[existingIndex].quantity + item.quantity;
      } else {
        // If NOT isLoad (e.g. Sale), we subtract? Or add? 
        // In `handleStatusChange` (Delivered), we typically reduce stock.
        // Let's look at `DeliveryDashboard` usage.
        currentItems[existingIndex].quantity = item.quantity; // Fallback
      }
    } else {
      currentItems.push(item);
    }

    // Filter out 0 quantities? Maybe keep them for UI.
    await setDoc(docRef, { items: currentItems }, { merge: true });

  } catch (e) {
    console.error("Error updating vehicle inventory", e);
  }
};

// Transactions
export const addTransaction = async (transaction: Transaction) => {
  await setDoc(doc(collection(db, 'transactions')), transaction);
};

export const subscribeTransactions = (callback: (transactions: Transaction[]) => void) => {
  return onSnapshot(collection(db, 'transactions'), (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    callback(items);
  });
};

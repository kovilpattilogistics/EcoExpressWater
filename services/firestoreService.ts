import {
    collection,
    doc,
    setDoc,
    getDocs,
    onSnapshot,
    query,
    where,
    deleteDoc,
    addDoc
} from 'firebase/firestore';
import { db } from './firebase'; // Ensure this exports initialized 'db'
import {
    InventoryItem,
    Order,
    Customer,
    ProductType,
    Transaction,
    OrderStatus
} from '../types';
import { PRODUCT_CONFIG } from '../constants';

// --- Constants ---
const COLLECTIONS = {
    ORDERS: 'orders',
    CUSTOMERS: 'customers',
    INVENTORY: 'inventory',
    VEHICLE_INVENTORY: 'vehicle_inventory',
    TRANSACTIONS: 'transactions'
};

// --- Helpers (Pure Functions) ---

// Helper to sanitize data for Firestore (removes undefined, converts NaN to null)
// This strictly prevents "Unsupported field value: undefined" errors which cause silent hangs.
const cleanData = (data: any): any => {
    if (data === undefined) return null;
    if (Number.isNaN(data)) return null;
    if (data === null) return null;

    if (Array.isArray(data)) {
        return data.map(item => cleanData(item));
    }

    if (typeof data === 'object') {
        const cleaned: any = {};
        for (const key in data) {
            cleaned[key] = cleanData(data[key]);
        }
        return cleaned;
    }

    return data;
};

// Copied from mockService for consistency
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

// --- Orders ---

export const subscribeOrders = (callback: (orders: Order[]) => void) => {
    const q = query(collection(db, COLLECTIONS.ORDERS));
    // Real-time listener
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => doc.data() as Order);
        callback(orders);
    });
};

export const getOrders = async (): Promise<Order[]> => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.ORDERS));
    return snapshot.docs.map(doc => doc.data() as Order);
};

export const saveOrder = async (order: Order) => {
    console.log("🔥 [firestoreService] saveOrder called for:", order.id);
    // Use order.id as document ID
    const orderRef = doc(db, COLLECTIONS.ORDERS, order.id);
    const safeOrder = cleanData(order);
    console.log("🔥 [firestoreService] Cleaned Order Payload:", safeOrder);

    try {
        await setDoc(orderRef, safeOrder, { merge: true });
        console.log("✅ [firestoreService] saveOrder Success:", order.id);
    } catch (error) {
        console.error("❌ [firestoreService] saveOrder FAILED:", error);
        throw error;
    }
};

export const deleteOrder = async (orderId: string) => {
    await deleteDoc(doc(db, COLLECTIONS.ORDERS, orderId));
};

// --- Customers ---

export const subscribeCustomers = (callback: (customers: Customer[]) => void) => {
    const q = query(collection(db, COLLECTIONS.CUSTOMERS));
    return onSnapshot(q, (snapshot) => {
        const customers = snapshot.docs.map(doc => doc.data() as Customer);
        callback(customers);
    });
};

export const getCustomers = async (): Promise<Customer[]> => {
    const snapshot = await getDocs(collection(db, COLLECTIONS.CUSTOMERS));
    return snapshot.docs.map(doc => doc.data() as Customer);
};

export const saveCustomer = async (customer: Customer) => {
    console.log("🔥 [firestoreService] saveCustomer called for:", customer.id);
    const customerRef = doc(db, COLLECTIONS.CUSTOMERS, customer.id);
    const safeCustomer = cleanData(customer);
    await setDoc(customerRef, safeCustomer, { merge: true });
    console.log("✅ [firestoreService] saveCustomer Success");
};

export const deleteCustomer = async (customerId: string) => {
    await deleteDoc(doc(db, COLLECTIONS.CUSTOMERS, customerId));
    // Note: Handling "Anonymize orders" in Firestore would require a cloud function or batch update here.
    // For simplicity, we'll strip user info from client side or leave as is.
    // A proper implementation would run a batch update on orders where customerId == customerId.
};

export const findCustomerByPhone = async (phone: string): Promise<Customer | undefined> => {
    console.log(`🔥 [firestoreService] findCustomerByPhone checking for: ${phone}`);
    try {
        const q = query(collection(db, COLLECTIONS.CUSTOMERS), where("phone", "==", phone));
        const snapshot = await getDocs(q);
        console.log(`🔥 [firestoreService] findCustomerByPhone result empty?: ${snapshot.empty}`);
        if (snapshot.empty) return undefined;
        return snapshot.docs[0].data() as Customer;
    } catch (error) {
        console.error("❌ [firestoreService] findCustomerByPhone Error:", error);
        throw error;
    }
};

export const updateCustomerPendingAmount = async (customerId: string, amountToAdd: number) => {
    const customerRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);
    try {
        await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(customerRef);
            if (!sfDoc.exists()) throw "Customer does not exist!";

            const currentPending = sfDoc.data().pendingAmount || 0;
            const newPending = currentPending + amountToAdd;
            transaction.update(customerRef, { pendingAmount: newPending });
        });
        console.log(`✅ [Customer] Updated Pending Amount by ${amountToAdd}`);
    } catch (e) {
        console.error("Transaction failed: ", e);
    }
};

// --- Inventory ---

export const subscribeInventory = (callback: (items: InventoryItem[]) => void) => {
    const q = query(collection(db, COLLECTIONS.INVENTORY));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => doc.data() as InventoryItem);
        callback(items);
    });
};



// Re-implementing updateInventory properly
// NOTE: We need to export this signature: (item: InventoryItem, isAddition: boolean)
// But we can also export `setInventoryQuantity` which is safer if the UI calls it.
// Looking at usages, updateInventory is used.

// Let's implement `setInventoryQuantity` first as it covers absolute sets.
export const setInventoryQuantity = async (item: InventoryItem) => {
    const docId = `${item.type}_${item.canState || 'NA'}`.replace(/\s+/g, '_');
    const itemRef = doc(db, COLLECTIONS.INVENTORY, docId);
    const safeItem = cleanData(item);
    await setDoc(itemRef, safeItem, { merge: true });
};

// Implementation for updateInventory using transaction (safer) or read-write
import { runTransaction } from 'firebase/firestore';

export const updateInventoryReal = async (item: InventoryItem, isAddition: boolean) => {
    const docId = `${item.type}_${item.canState || 'NA'}`.replace(/\s+/g, '_');
    const itemRef = doc(db, COLLECTIONS.INVENTORY, docId);

    try {
        await runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(itemRef);
            if (!sfDoc.exists()) {
                if (isAddition) {
                    const safeItem = cleanData(item);
                    transaction.set(itemRef, safeItem);
                }
                // If subtraction on non-exist, do nothing?
            } else {
                const current = sfDoc.data() as InventoryItem;
                const newQty = isAddition
                    ? current.quantity + item.quantity
                    : Math.max(0, current.quantity - item.quantity);

                transaction.update(itemRef, { quantity: newQty });
            }
        });
    } catch (e) {
        console.error("Transaction failed: ", e);
    }
};

// Exporting as the expected name
export { updateInventoryReal as updateInventory };


// --- Vehicle Inventory ---

export const getVehicleInventory = async (driverId: string): Promise<InventoryItem[]> => {
    const docRef = doc(db, COLLECTIONS.VEHICLE_INVENTORY, driverId);
    const snapshot = await getDocs(query(collection(db, COLLECTIONS.VEHICLE_INVENTORY), where('driverId', '==', driverId)));

    // Actually, let's treat the document ID as driverId? 
    // Or structure it as collection 'vehicle_inventory' -> doc(driverId) -> data { items: [] }
    // Mock service uses array of { driverId, items }.

    const vDoc = await getDocs(query(collection(db, COLLECTIONS.VEHICLE_INVENTORY), where('driverId', '==', driverId)));
    if (vDoc.empty) return [];
    const data = vDoc.docs[0].data();
    return data.items || [];
};

export const updateVehicleInventory = async (driverId: string, updates: InventoryItem | InventoryItem[], operation: 'SET' | 'INCREMENT') => {
    const docRef = doc(db, COLLECTIONS.VEHICLE_INVENTORY, driverId);
    const itemsToUpdate = Array.isArray(updates) ? updates : [updates];

    console.log(`🔥 [Inventory] Batch Update: ${itemsToUpdate.length} items. Operation: ${operation}`);

    try {
        await runTransaction(db, async (t) => {
            const vDoc = await t.get(docRef);
            let currentItems: InventoryItem[] = [];

            if (vDoc.exists()) {
                currentItems = vDoc.data().items || [];
            }

            // Process each update
            for (const item of itemsToUpdate) {
                const existingIndex = currentItems.findIndex(i => i.type === item.type && i.canState === item.canState);

                if (existingIndex > -1) {
                    if (operation === 'SET') {
                        currentItems[existingIndex].quantity = item.quantity;
                    } else {
                        // INCREMENT (Pass negative quantity to decrement)
                        const newQty = (currentItems[existingIndex].quantity || 0) + item.quantity;
                        currentItems[existingIndex].quantity = Math.max(0, newQty);
                    }
                } else {
                    // Item doesn't exist
                    if (operation === 'SET') {
                        currentItems.push(item);
                    } else {
                        // Incrementing a non-existent item (start at 0)
                        // Only add if quantity > 0
                        if (item.quantity > 0) {
                            currentItems.push(item);
                        } else {
                            // Subtracting from non-existent? Ignore.
                        }
                    }
                }
            }

            // Cleanup: Remove items with 0 quantity? Optionally.
            // Let's keep them if it's 'SET' (maybe user explicitly set 0). 
            // Only filter if we want to save space. For now, keep logic simple.

            const safeData = cleanData({ driverId, items: currentItems });
            t.set(docRef, safeData, { merge: true });
        });
        console.log("✅ [Inventory] Update Success");
    } catch (e) {
        console.error("❌ [Inventory] Update Failed", e);
        throw e;
    }
};

// Subscribe to Vehicle Inventory for Real-time Admin Monitoring
export const subscribeVehicleInventory = (driverId: string, callback: (items: InventoryItem[]) => void) => {
    const q = query(collection(db, COLLECTIONS.VEHICLE_INVENTORY), where('driverId', '==', driverId));
    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            callback([]);
            return;
        }
        const data = snapshot.docs[0].data();
        callback(data.items || []);
    });
};

// --- Transactions ---

export const addTransaction = async (transaction: Transaction) => {
    const safeTrans = cleanData(transaction);
    await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), safeTrans);
};

export const subscribeTransactions = (callback: (transactions: Transaction[]) => void) => {
    const q = query(collection(db, COLLECTIONS.TRANSACTIONS));
    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
        callback(transactions);
    });
};

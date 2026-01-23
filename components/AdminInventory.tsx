import React, { useState, useEffect } from 'react';
import { Plus, History, Edit2, X, Truck } from 'lucide-react';
import { Card, Button, Input, Select, Modal, useToast } from './SharedComponents';
import { InventoryItem, ProductType, CanState, Transaction, Order, PaymentMode } from '../types';
import { subscribeInventory, updateInventory, addTransaction, subscribeTransactions, setInventoryQuantity, getVehicleInventory, updateVehicleInventory, calculateCases, subscribeOrders, saveOrder } from '../services/firestoreService';
import { PRODUCT_CONFIG, DRIVER_CREDENTIALS } from '../constants';

export const AdminInventory: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const toast = useToast();

  // Add Stock Form State
  const [selectedProduct, setSelectedProduct] = useState<ProductType>(ProductType.BOTTLE_300ML);
  const [canState, setCanState] = useState<CanState>(CanState.NEW);
  const [quantity, setQuantity] = useState<number>(0);

  // Edit Stock State
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);

  const loadData = () => {
    // Legacy loadData removed, using subscription
  };

  useEffect(() => {
    const unsubInv = subscribeInventory(setInventory);
    const unsubTrans = subscribeTransactions((allTrans) => {
      setTransactions(allTrans.filter(t => t.category === 'STOCK_PURCHASE'));
    });
    const unsubOrders = subscribeOrders((allOrders) => {
      setOrders(allOrders);
    });
    return () => {
      unsubInv();
      unsubTrans();
      unsubOrders();
    };
  }, []);

  const calculateCost = () => {
    const config = PRODUCT_CONFIG[selectedProduct];

    if (selectedProduct === ProductType.CAN_20L) {
      if (canState === CanState.FILLED || canState === CanState.EMPTY) return 0;
      if (canState === CanState.NEW) return quantity * 145;
      if (canState === 'REFILLED' as any) return quantity * 11;
      return 0;
    }

    // Input quantity is in Cases for bottles, but costPrice is usually per Unit or Case.
    // Assuming costPrice in constants is Per Case for bottles for simplicity in this context, 
    // or if it is per unit, we need to know. 
    // Looking at constants: "BOTTLE_300ML... costPrice: 130". itemsPerCase: 35. 
    // 130 is definitely Per Case cost (approx 3-4rs per bottle).
    // So if input `quantity` is Cases, we just multiply by costPrice.
    return quantity * config.costPrice;
  };

  const handleUpdateStock = () => {
    let effectiveState: CanState | undefined = undefined;
    let cost = 0;

    // Determine Quantity in UNITS for Inventory Update
    let quantityInUnits = quantity;
    const config = PRODUCT_CONFIG[selectedProduct];

    if (selectedProduct.includes('Bottle')) {
      const itemsPerCase = config.itemsPerCase || 1;
      quantityInUnits = quantity * itemsPerCase;
    }

    if (selectedProduct === ProductType.CAN_20L) {
      if (canState === CanState.NEW) {
        effectiveState = CanState.EMPTY;
        cost = 145 * quantity; // quantity for Cans is Units
      } else if (canState === 'REFILLED' as any) {
        effectiveState = CanState.FILLED;
        cost = 11 * quantity;

        // Auto-decrement Empty Cans as they are being filled
        updateInventory({
          type: ProductType.CAN_20L,
          quantity: quantity,
          canState: CanState.EMPTY
        }, false);

      } else {
        effectiveState = canState;
      }
    } else {
      // Bottles: Cost calculation (using Case quantity)
      cost = quantity * config.costPrice;
    }

    const newItem: InventoryItem = {
      type: selectedProduct,
      quantity: quantityInUnits, // Use calculated Units
      canState: effectiveState
    };

    updateInventory(newItem, true);

    if (cost > 0) {
      let desc = '';
      if (selectedProduct === ProductType.CAN_20L) {
        if (canState === CanState.NEW) desc = `Stock Purchase: New 20L Cans x ${quantity}`;
        else if (canState === 'REFILLED' as any) desc = `Service: Refill 20L Cans x ${quantity}`;
        else desc = `Adjustment: ${selectedProduct} x ${quantity}`;
      } else {
        // For Bottles, log in Cases
        desc = `Stock Purchase: ${selectedProduct} x ${quantity} Cases (${quantityInUnits} Bottles)`;
      }

      addTransaction({
        id: Date.now().toString(),
        type: 'EXPENSE',
        category: 'STOCK_PURCHASE',
        amount: cost,
        date: new Date().toISOString(),
        description: desc
      });
    }

    setShowAddModal(false);
  };

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item);
    setEditQuantity(item.quantity);
  };

  const handleSaveEdit = () => {
    if (editingItem) {
      let finalQuantity = editQuantity;

      // If it's a bottle, treat input as CASES and convert to UNITS
      if (editingItem.type.includes('Bottle')) {
        const config = PRODUCT_CONFIG[editingItem.type];
        const perCase = config?.itemsPerCase || 1;
        finalQuantity = editQuantity * perCase;
      }

      const updatedItem = { ...editingItem, quantity: finalQuantity };
      setInventoryQuantity(updatedItem);

      // Log the manual override
      addTransaction({
        id: Date.now().toString(),
        type: 'EXPENSE', // logging as expense/adjustment 
        category: 'STOCK_PURCHASE', // Using existing category for stock history
        amount: 0, // No cash flow for manual override
        date: new Date().toISOString(),
        description: `Manual Update: ${editingItem.type} set to ${editQuantity} ${editingItem.type.includes('Bottle') ? 'Cases' : 'Cans'} (${finalQuantity} Total ${editingItem.type.includes('Bottle') ? 'Bottles' : 'Cans'})`
      });

      setEditingItem(null);
      // loadData();
    }
  };

  // Unload Vehicle State
  const [showUnloadModal, setShowUnloadModal] = useState(false);
  const [vehicleStockToUnload, setVehicleStockToUnload] = useState<InventoryItem[]>([]);
  const [isUnloading, setIsUnloading] = useState(false);

  const handleOpenUnload = async () => {
    setShowUnloadModal(true);
    // Fetch driver stock (Hardcoded driver for now)
    const stock = await getVehicleInventory(DRIVER_CREDENTIALS.username);
    setVehicleStockToUnload(stock.filter(i => i.quantity > 0));
  };

  const handleConfirmUnload = async () => {
    setIsUnloading(true);
    try {
      // 1. Add to Main Inventory
      for (const item of vehicleStockToUnload) {
        await updateInventory(item, true);
      }

      // 2. Clear Vehicle Inventory
      // Create zeroed version of current items to reset them
      const resetItems = vehicleStockToUnload.map(i => ({ ...i, quantity: 0 }));
      await updateVehicleInventory(DRIVER_CREDENTIALS.username, resetItems, 'SET');

      // 3. Log Transaction (Optional but good for tracking)
      // Logic: If needed, but maybe just inventory movement is enough.

      toast.success("Vehicle Unloaded Successfully! Stock moved to Main Inventory.");
      setShowUnloadModal(false);
      setVehicleStockToUnload([]);
    } catch (e) {
      console.error("Unload failed", e);
      toast.error("Failed to unload vehicle.");
    } finally {
      setIsUnloading(false);
    }
  };

  // Cash Reconciliation State
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [cashOrdersToReconcile, setCashOrdersToReconcile] = useState<Order[]>([]);

  const handleOpenReconcile = () => {
    // Filter orders: Delivered, Paid via Cash, Pending Handover
    const pending = orders.filter(o =>
      (o.status === 'Delivered' || o.status === 'Empty cans picked') && // Check both just in case
      o.paymentMode === PaymentMode.CASH &&
      o.cashHandoverStatus === 'PENDING'
    );
    setCashOrdersToReconcile(pending);
    setShowReconcileModal(true);
  };

  const calculateTotalCashToReconcile = () => {
    return cashOrdersToReconcile.reduce((sum, o) => sum + (o.amountReceived || 0), 0);
  };

  const handleConfirmReconcile = async () => {
    const total = calculateTotalCashToReconcile();
    if (total === 0 && cashOrdersToReconcile.length === 0) return;

    try {
      // 1. Update Orders to COMPLETED handover
      for (const order of cashOrdersToReconcile) {
        await saveOrder({ ...order, cashHandoverStatus: 'COMPLETED' });
      }

      // 2. Log Transaction (Income)
      addTransaction({
        id: Date.now().toString(),
        type: 'INCOME',
        category: 'ORDER_REVENUE',
        amount: total,
        date: new Date().toISOString(),
        description: `Cash Handover Collected from Driver (${cashOrdersToReconcile.length} Orders)`
      });

      toast.success(`Successfully reconciled ₹${total}!`);
      setShowReconcileModal(false);
    } catch (e) {
      console.error("Reconciliation failed", e);
      toast.error("Failed to reconcile cash.");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inventory Management</h2>
        <div className="flex gap-2">
          <Button onClick={handleOpenReconcile} className="bg-green-600 hover:bg-green-700 text-white shadow-sm" icon={History}>Reconcile Cash</Button>
          <Button onClick={handleOpenUnload} variant="secondary" icon={Truck}>Unload Vehicle</Button>
          <Button onClick={() => setShowAddModal(true)} icon={Plus}>Add Stock</Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Total 20L Cans</h4>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {inventory.filter(i => i.type === ProductType.CAN_20L).reduce((sum, item) => sum + item.quantity, 0)}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Total Assets (Empty + Filled)</p>
        </div>
      </div>

      <Card title="Current Stock">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">State</th>
                <th className="p-3">Quantity</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-medium">{item.type}</td>
                  <td className="p-3">{item.canState || '-'}</td>
                  <td className="p-3 font-bold">
                    {item.type.includes('Bottle') ? (
                      (() => {
                        const { display } = calculateCases(item.type, item.quantity);
                        return (
                          <div>
                            <span className="block text-slate-800">{display}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({item.quantity} Bottles)</span>
                          </div>
                        );
                      })()
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleEditClick(item)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"
                      title="Override Stock"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Stock History" icon={History}>
        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Description</th>
                <th className="p-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-3">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="p-3">{t.description}</td>
                  <td className="p-3 text-red-600">-₹{t.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Stock Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Stock"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleUpdateStock}>Update Inventory</Button>
          </>
        }
      >
        <Select
          label="Product Type"
          options={Object.values(ProductType).map(t => ({ value: t, label: t }))}
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value as ProductType)}
        />

        {selectedProduct === ProductType.CAN_20L && (
          <Select
            label="Condition"
            options={[
              { value: CanState.NEW, label: 'New Can Purchase (Adds to Empty)' },
              { value: 'REFILLED', label: 'Refill Service (Adds to Filled)' },
              { value: CanState.EMPTY, label: 'Empty Return/Adjustment (Adds to Empty)' }
            ]}
            value={canState}
            onChange={(e) => setCanState(e.target.value as CanState)}
          />
        )}

        <div className="mb-4">
          <Input
            type="number"
            label={selectedProduct.includes('Bottle') ? "Quantity (Cases)" : "Quantity (Cans)"}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
          {selectedProduct.includes('Bottle') && quantity > 0 && (
            <p className="text-right text-xs text-blue-600 font-medium mt-1">
              {quantity} Cases = {quantity * (PRODUCT_CONFIG[selectedProduct].itemsPerCase || 1)} Bottles
            </p>
          )}
        </div>

        <div className="bg-slate-100 p-3 rounded mb-4">
          <span className="text-sm text-slate-600">Estimated Cost:</span>
          <span className="block text-lg font-bold">₹{calculateCost()}</span>
        </div>
      </Modal>

      {/* Unload Vehicle Modal */}
      <Modal
        isOpen={showUnloadModal}
        onClose={() => setShowUnloadModal(false)}
        title="Unload Vehicle"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUnloadModal(false)}>Cancel</Button>
            <Button onClick={handleConfirmUnload} isLoading={isUnloading} disabled={vehicleStockToUnload.length === 0}>
              Confirm Unload
            </Button>
          </>
        }
      >
        <div className="mb-4">
          <p className="text-sm text-slate-500 mb-2">Driver: {DRIVER_CREDENTIALS.username}</p>
          <div className="bg-slate-50 p-4 rounded-lg max-h-60 overflow-y-auto custom-scrollbar">
            {vehicleStockToUnload.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Vehicle is empty.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right py-2">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicleStockToUnload.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100 last:border-0">
                      <td className="py-2">
                        <span className="font-medium">{item.type}</span>
                        {item.canState && <span className="text-xs text-slate-400 ml-1">({item.canState})</span>}
                      </td>
                      <td className="text-right py-2 font-bold">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 border-l-4 border-yellow-400">
          Confirming will move all items above to Main Inventory and clear the Vehicle.
        </div>
      </Modal>

      {/* Edit/Override Stock Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Override Stock"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Override</Button>
          </>
        }
      >
        {editingItem && (
          <>
            <p className="text-xs text-slate-500 mb-4">{editingItem.type} {editingItem.canState ? `(${editingItem.canState})` : ''}</p>

            <div className="bg-orange-50 p-3 rounded border-l-4 border-orange-400 mb-4 text-sm text-orange-800">
              <span className="font-bold">Warning:</span> You are manually overriding the stock count. This will not record a purchase transaction.
            </div>

            <div className="mb-4">
              <Input
                label={editingItem.type.includes('Bottle') ? "New Quantity (Cases)" : "New Quantity (Cans)"}
                type="number"
                value={editQuantity}
                onChange={e => setEditQuantity(Number(e.target.value))}
              />
              {editingItem.type.includes('Bottle') && editQuantity > 0 && (
                <p className="text-right text-xs text-orange-600 font-medium mt-1">
                  {editQuantity} Cases = {editQuantity * (PRODUCT_CONFIG[editingItem.type]?.itemsPerCase || 1)} Bottles (Total)
                </p>
              )}
            </div>
          </>
        )}
      </Modal>
      {/* Cash Reconciliation Modal */}
      <Modal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        title="Reconcile Cash"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReconcileModal(false)}>Cancel</Button>
            <Button onClick={handleConfirmReconcile} disabled={cashOrdersToReconcile.length === 0}>Confirm Receipt</Button>
          </>
        }
      >
        <div className="bg-green-50 p-4 rounded-xl border border-green-100 mb-6 text-center">
          <p className="text-sm font-bold text-green-800 uppercase tracking-wide">Total Cash to Collect</p>
          <h2 className="text-4xl font-bold text-green-700 my-2">₹{calculateTotalCashToReconcile()}</h2>
          <p className="text-xs text-green-600">{cashOrdersToReconcile.length} Pending Orders</p>
        </div>

        <div className="max-h-60 overflow-y-auto mb-6 bg-slate-50 rounded-lg p-2 custom-scrollbar">
          {cashOrdersToReconcile.length === 0 ? (
            <p className="text-center text-slate-400 py-4">No pending cash handovers.</p>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="p-2">Order ID</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {cashOrdersToReconcile.map(o => (
                  <tr key={o.id} className="border-b last:border-0 border-slate-100">
                    <td className="p-2 font-mono">{o.id.slice(-6)}</td>
                    <td className="p-2">{o.customerName}</td>
                    <td className="p-2 text-right font-bold">₹{o.amountReceived}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
};
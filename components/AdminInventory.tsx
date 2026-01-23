import React, { useState, useEffect } from 'react';
import { Plus, History, Edit2, X, Truck } from 'lucide-react';
import { Card, Button, Input, Select } from './SharedComponents';
import { subscribeInventory, updateInventory, addTransaction, subscribeTransactions, setInventoryQuantity, getVehicleInventory, updateVehicleInventory, clearAllInventoryAndHistory } from '../services/firestoreService';
import { InventoryItem, ProductType, CanState, Transaction } from '../types';
import { PRODUCT_CONFIG, DRIVER_CREDENTIALS } from '../constants';

export const AdminInventory: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

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
    return () => {
      unsubInv();
      unsubTrans();
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

    return quantity * config.costPrice;
  };

  const handleUpdateStock = () => {
    let effectiveState: CanState | undefined = undefined;
    let cost = 0;

    if (selectedProduct === ProductType.CAN_20L) {
      if (canState === CanState.NEW) {
        effectiveState = CanState.EMPTY; // Fix: User clarified new cans are purchased as Empty (to be filled)
        cost = 145 * quantity;
      } else if (canState === 'REFILLED' as any) {
        effectiveState = CanState.FILLED;
        cost = 11 * quantity;

        // Auto-decrement Empty Cans as they are being filled
        updateInventory({
          type: ProductType.CAN_20L,
          quantity: quantity,
          canState: CanState.EMPTY
        }, false); // isAddition=false -> Subtract

      } else {
        effectiveState = canState;
      }
    }

    const newItem: InventoryItem = {
      type: selectedProduct,
      quantity: quantity,
      canState: effectiveState
    };

    updateInventory(newItem, true); // async

    if (cost > 0) {
      let desc = '';
      if (selectedProduct === ProductType.CAN_20L) {
        if (canState === CanState.NEW) desc = `Stock Purchase: New 20L Cans x ${quantity}`;
        else if (canState === 'REFILLED' as any) desc = `Service: Refill 20L Cans x ${quantity}`;
        else desc = `Adjustment: ${selectedProduct} x ${quantity}`;
      } else {
        desc = `Stock Purchase: ${selectedProduct} x ${quantity}`;
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
    // loadData(); // subscription updates UI
  };

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item);
    setEditQuantity(item.quantity);
  };

  const handleSaveEdit = () => {
    if (editingItem) {
      const updatedItem = { ...editingItem, quantity: editQuantity };
      setInventoryQuantity(updatedItem);

      // Optional: Add a log for manual override?
      // For now, just silent update as per "Override" request.

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

      alert("Vehicle Unloaded Successfully! Stock moved to Main Inventory.");
      setShowUnloadModal(false);
      setVehicleStockToUnload([]);
    } catch (e) {
      console.error("Unload failed", e);
      alert("Failed to unload vehicle.");
    } finally {
      setIsUnloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inventory Management</h2>
        <div className="flex gap-2">
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
                  <td className="p-3 font-bold">{item.quantity}</td>
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
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add New Stock</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-red-500"><X size={24} /></button>
            </div>

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

            <Input
              type="number"
              label={selectedProduct.includes('Bottle') ? "Quantity (Cases)" : "Quantity (Cans)"}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />

            <div className="bg-slate-100 p-3 rounded mb-4">
              <span className="text-sm text-slate-600">Estimated Cost:</span>
              <span className="block text-lg font-bold">₹{calculateCost()}</span>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button onClick={handleUpdateStock}>Update Inventory</Button>
            </div>
          </div>
        </div>
      )}

      {/* Unload Vehicle Modal */}
      {showUnloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold">Unload Vehicle</h3>
                <p className="text-sm text-slate-500">Driver: {DRIVER_CREDENTIALS.username}</p>
              </div>
              <button onClick={() => setShowUnloadModal(false)} className="text-slate-400 hover:text-red-500"><X size={24} /></button>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg mb-4 max-h-60 overflow-y-auto">
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

            <div className="bg-yellow-50 p-3 rounded mb-4 text-xs text-yellow-800 border-l-4 border-yellow-400">
              Confirming will move all items above to Main Inventory and clear the Vehicle.
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowUnloadModal(false)}>Cancel</Button>
              <Button onClick={handleConfirmUnload} isLoading={isUnloading} disabled={vehicleStockToUnload.length === 0}>
                Confirm Unload
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Override Stock Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold">Override Stock</h3>
                <p className="text-xs text-slate-500">{editingItem.type} {editingItem.canState ? `(${editingItem.canState})` : ''}</p>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-red-500"><X size={24} /></button>
            </div>

            <div className="bg-orange-50 p-3 rounded border-l-4 border-orange-400 mb-4 text-sm text-orange-800">
              <span className="font-bold">Warning:</span> You are manually overriding the stock count. This will not record a purchase transaction.
            </div>

            <Input
              label="New Current Quantity"
              type="number"
              value={editQuantity}
              onChange={e => setEditQuantity(Number(e.target.value))}
            />

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setEditingItem(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>Save Override</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
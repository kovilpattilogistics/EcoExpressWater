import React, { useState, useEffect } from 'react';
import { Card, Button, StatusBadge } from './SharedComponents';
import { subscribeOrders, saveOrder, getVehicleInventory, updateVehicleInventory } from '../services/firestoreService';
import { Order, OrderStatus, ProductType, CanState, InventoryItem } from '../types';
import { Map, Truck, PackageCheck, CheckCircle, Navigation, Wallet, Package, Clock, ShieldAlert, Edit2, Save, X, Plus, Calendar } from 'lucide-react';
import { DRIVER_CREDENTIALS, PRODUCT_CONFIG } from '../constants';
import { VehicleStockModal } from './VehicleStockModal';

export const DeliveryDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [vehicleStock, setVehicleStock] = useState<InventoryItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [showValidation, setShowValidation] = useState(false);

  // Date Filtering State
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Modification State
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editedItems, setEditedItems] = useState<Order['items']>([]);

  const [emptyCansInput, setEmptyCansInput] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // Mock Driver ID
  const driverId = DRIVER_CREDENTIALS.username;

  const loadData = async () => {
    // Orders are subscribed separately
    const stock = await getVehicleInventory(driverId);
    setVehicleStock(stock);
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeOrders((allOrders) => {
      const sorted = allOrders.sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());
      setOrders(sorted);

      // Auto-select first date if not set
      if (!selectedDate && sorted.length > 0) {
        const firstActive = sorted.find(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.COMPLETED);
        if (firstActive) setSelectedDate(firstActive.deliveryDate);
        else if (sorted.length > 0) setSelectedDate(sorted[0].deliveryDate);
      }
    });
    return () => unsub();
  }, []); // Run once on mount

  // Sync editing state
  useEffect(() => {
    if (selectedOrder) {
      setEditedItems(selectedOrder.items);
      setIsEditingOrder(false);
    }
  }, [selectedOrder]);

  // Derived Stats & Filtering
  const activeOrders = orders.filter(o =>
    o.status !== OrderStatus.DELIVERED &&
    o.status !== OrderStatus.COMPLETED &&
    (!selectedDate || o.deliveryDate === selectedDate) // Filter by Date
  );

  const availableDates = Array.from(new Set(orders
    .filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.COMPLETED)
    .map(o => o.deliveryDate)))
    .sort();

  const getDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === today.getTime()) return 'Today';

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const isSelectedDateToday = () => {
    if (!selectedDate) return false;
    const d = new Date(selectedDate);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const isToday = isSelectedDateToday();

  const toggleOrderSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedOrderIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedOrderIds(newSet);
  };

  const selectAllPending = () => {
    // Only select pending orders from the CURRENT filtered view
    const pendingOnDate = activeOrders
      .filter(o => o.status === OrderStatus.PENDING)
      .map(o => o.id);

    // Toggle: if all visible pending are selected, deselect them. Else select all of them.
    // Note: We check if `selectedOrderIds` contains ALL of `pendingOnDate`
    const allSelected = pendingOnDate.length > 0 && pendingOnDate.every(id => selectedOrderIds.has(id));

    const newSet = new Set(selectedOrderIds);
    if (allSelected) {
      pendingOnDate.forEach(id => newSet.delete(id));
    } else {
      pendingOnDate.forEach(id => newSet.add(id));
    }
    setSelectedOrderIds(newSet);
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus, emptyCansReturned?: number) => {
    const updatedOrder = { ...order, status: newStatus, emptyCansReturned };

    // Inventory Logic on Confirmation (Reserve Stock from Truck)
    if (newStatus === OrderStatus.CONFIRMED) {
      // Deduct from Vehicle Stock check
      let sufficient = true;
      order.items.forEach(item => {
        if (item.productType === ProductType.CAN_20L) {
          const stock = vehicleStock.find(s => s.type === ProductType.CAN_20L && s.canState === CanState.FILLED);
          if (!stock || stock.quantity < item.quantity) sufficient = false;
        } else {
          // Bottle logic
          const stock = vehicleStock.find(s => s.type === item.productType);
          if (!stock || stock.quantity < item.quantity) sufficient = false;
        }
      });

      if (!sufficient) {
        alert("Insufficient Vehicle Stock! Load inventory first.");
        return;
      }

      // Deduct (Reserve) from Truck
      const itemsToDeduct = order.items.map(item => ({
        type: item.productType,
        quantity: -item.quantity, // Negative to subtract
        canState: item.productType === ProductType.CAN_20L ? CanState.FILLED : undefined
      }));

      await updateVehicleInventory(driverId, itemsToDeduct, 'INCREMENT');
      // Refresh local view
      loadData();
    }

    // Logic on Delivered (Add Empty Cans to Vehicle Stock)
    if (newStatus === OrderStatus.DELIVERED && emptyCansReturned && emptyCansReturned > 0) {
      const emptyCanItem = {
        type: ProductType.CAN_20L,
        quantity: emptyCansReturned,
        canState: CanState.EMPTY
      };
      await updateVehicleInventory(driverId, emptyCanItem, 'INCREMENT');
      loadData();
    }

    await saveOrder(updatedOrder);

    // Update local state (Optimistic, though subscription will eventually override)
    setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
    setSelectedOrder(updatedOrder);
  };

  // --- Order Modification Logic ---
  const handleQuantityEdit = (idx: number, delta: number) => {
    const newItems = [...editedItems];
    const item = { ...newItems[idx] };
    const newQty = Math.max(0, item.quantity + delta);

    item.quantity = newQty;
    // Recalc Price
    item.totalPrice = newQty * item.pricePerUnit;

    newItems[idx] = item;
    setEditedItems(newItems);
  };

  const saveModifiedOrder = async () => {
    if (!selectedOrder) return;

    // 1. Calculate Differences for Stock
    let stockError = null;
    const inventoryUpdates: InventoryItem[] = [];

    const newTotalAmount = editedItems.reduce((sum, item) => sum + item.totalPrice, 0);

    for (let i = 0; i < editedItems.length; i++) {
      const newItem = editedItems[i];
      const oldItem = selectedOrder.items.find(x => x.productType === newItem.productType);

      const oldQty = oldItem ? oldItem.quantity : 0;
      const diff = oldQty - newItem.quantity; // positive = returned (add), negative = taken (sub)

      if (diff === 0) continue;

      const stockKey = { type: newItem.productType, canState: newItem.productType === ProductType.CAN_20L ? CanState.FILLED : undefined };

      if (diff < 0) {
        // Need MORE items (Take from Truck)
        const needed = Math.abs(diff);
        const stock = vehicleStock.find(s => s.type === stockKey.type && s.canState === stockKey.canState);
        if (!stock || stock.quantity < needed) {
          stockError = `Insufficient stock for ${newItem.productType}. Need ${needed} more.`;
          break;
        }
      }

      // Add update (diff works for sign: +2 adds, -2 subtracts)
      inventoryUpdates.push({ type: stockKey.type, quantity: diff, canState: stockKey.canState });
    }

    if (stockError) {
      alert(stockError);
      return;
    }

    // 2. Apply Stock Updates Batch
    if (inventoryUpdates.length > 0) {
      await updateVehicleInventory(driverId, inventoryUpdates, 'INCREMENT');
    }

    // 3. Update Order
    const updatedOrder = {
      ...selectedOrder,
      items: editedItems,
      totalAmount: newTotalAmount
    };

    await saveOrder(updatedOrder);
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setSelectedOrder(updatedOrder);
    setIsEditingOrder(false);
    loadData(); // Sync stock
    alert("Order Modified & Stock Updated");
  };

  const openMap = (location: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
  };

  // Derived Stats (Global for summary)
  const completedToday = orders.filter(o => o.status === OrderStatus.DELIVERED).length;
  // Calculate cash to collect (Total of active delivered orders or pending ones)
  // Logic: Driver collects cash on Delivery. 
  // Let's show "Pending Collection" for Dispatched orders.
  const cashToCollect = orders
    .filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.COMPLETED)
    .filter(o => o.status === OrderStatus.DISPATCHED)
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  // Validation Logic
  const getValidationData = () => {
    // Only validate SELECTED orders (which are from current day)
    const selectedOrdersList = orders.filter(o => selectedOrderIds.has(o.id));
    const requirements: Record<string, number> = {};

    selectedOrdersList.forEach(order => {
      order.items.forEach(item => {
        const key = item.productType;
        const qty = item.quantity; // Use Raw Quantity
        requirements[key] = (requirements[key] || 0) + qty;
      });
    });

    return Object.keys(requirements).map(type => {
      const isCan = type === ProductType.CAN_20L;
      const needed = requirements[type];
      const stockItem = isCan
        ? vehicleStock.find(s => s.type === type && s.canState === CanState.FILLED)
        : vehicleStock.find(s => s.type === type);

      const have = stockItem?.quantity || 0;
      return { type, needed, have, sufficient: have >= needed };
    });
  };

  const validationResults = getValidationData();
  const allSufficient = validationResults.every(r => r.sufficient);

  const confirmTrip = async () => {
    const selectedOrdersList = orders.filter(o => selectedOrderIds.has(o.id));
    const allUpdates: InventoryItem[] = [];

    // Collect all deductions
    selectedOrdersList.forEach(order => {
      order.items.forEach(item => {
        allUpdates.push({
          type: item.productType,
          quantity: -item.quantity, // Negative to subtract
          canState: item.productType === ProductType.CAN_20L ? CanState.FILLED : undefined
        });
      });
    });

    // Batch Apply
    if (allUpdates.length > 0) {
      await updateVehicleInventory(driverId, allUpdates, 'INCREMENT');
    }

    // Update Orders
    for (const order of selectedOrdersList) {
      await saveOrder({ ...order, status: OrderStatus.DISPATCHED });
    }

    loadData();
    setShowValidation(false);
    setSelectedOrderIds(new Set());
    alert("Trip Started! Inventory Reserved.");
  };

  return (
    <div className="pb-24 p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Truck className="text-[#4CAF50]" /> Delivery Partner</h1>
          <p className="text-slate-500 text-sm">Welcome back, Driver</p>
        </div>
        {/* Logout removed as per request */}
      </div>

      {!selectedOrder ? (
        <div className="space-y-6 animate-fadeIn">

          {/* Date Picker Strip */}
          <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scrollbar-hide no-scrollbar">
            {availableDates.length === 0 && <div className="text-sm text-slate-400 italic">No upcoming orders</div>}
            {availableDates.map(date => {
              const isSelected = date === selectedDate;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center justify-center min-w-[80px] p-3 rounded-xl border transition-all ${isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xl transform scale-105 ring-2 ring-blue-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}
                >
                  <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{getDateLabel(date)}</span>
                  <span className="text-xl font-bold">{new Date(date).getDate()}</span>
                </button>
              );
            })}
          </div>

          {/* Summary Stats (Global or Daily? Let's make activeOrders match daily) */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <Clock size={20} className="text-blue-500 mb-1" />
              <span className="text-xl font-bold text-slate-800">{activeOrders.length}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Pending Here</span>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <CheckCircle size={20} className="text-green-500 mb-1" />
              <span className="text-xl font-bold text-slate-800">{completedToday}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Done Total</span>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <Wallet size={20} className="text-orange-500 mb-1" />
              <span className="text-xl font-bold text-slate-800">₹{cashToCollect}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Collect</span>
            </div>
          </div>

          {/* Vehicle Inventory Widget */}
          <Card className="border-l-4 border-l-blue-500">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><Package size={18} /> Truck Inventory</h3>
              <button onClick={() => setShowStockModal(true)} className="text-xs text-blue-600 font-bold hover:underline">Manage</button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {vehicleStock.filter(i => i.quantity > 0).length === 0 ? (
                <p className="col-span-full text-sm text-slate-400 italic py-2">Truck is empty. Load stock to start.</p>
              ) : (
                vehicleStock.filter(i => i.quantity > 0).map((s, i) => (
                  <div key={i} className={`p-2 rounded-lg flex justify-between items-center text-xs border ${s.type === ProductType.CAN_20L ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                    <span className="font-semibold text-slate-600">
                      {s.type.replace(' Bottle', '').replace(' Can', '')}
                      {s.canState && <span className={`ml-1 text-[9px] px-1 rounded ${s.canState === CanState.FILLED ? 'bg-green-200 text-green-800' : 'bg-orange-200 text-orange-800'}`}>{s.canState}</span>}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{s.quantity}</span>
                  </div>
                ))
              )}
            </div>
            <Button variant="secondary" onClick={() => setShowStockModal(true)} className="w-full mt-4 text-sm h-10 border-dashed border-2">Manage Stock / Load Truck</Button>
          </Card>

          {/* Active Orders List */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-lg">Delivery Queue ({selectedDate ? getDateLabel(selectedDate) : 'All'})</h3>
              <div className="flex gap-2">
                {isToday && (
                  <>
                    <button onClick={selectAllPending} className="text-xs text-slate-500 font-bold underline">Select All Pending</button>
                    {selectedOrderIds.size > 0 && (
                      <Button onClick={() => setShowValidation(true)} className="h-8 text-xs bg-blue-600">
                        Validate Load ({selectedOrderIds.size})
                      </Button>
                    )}
                  </>
                )}
                {!isToday && <span className="text-xs text-amber-500 font-bold bg-amber-50 px-2 py-1 rounded">Read Only View</span>}
              </div>
            </div>
            <div className="space-y-3">
              {activeOrders.length === 0 && <div className="text-slate-400 text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">No active orders for this date.</div>}
              {activeOrders.map(order => {
                const isPending = order.status === OrderStatus.PENDING;
                const isDispatched = order.status === OrderStatus.DISPATCHED;
                const isDelivered = order.status === OrderStatus.DELIVERED;
                const isSelected = selectedOrderIds.has(order.id);

                let borderClass = 'border-slate-200';
                if (isPending) borderClass = 'border-l-4 border-l-yellow-400';
                if (isDispatched) borderClass = 'border-l-4 border-l-blue-500';
                if (isDelivered) borderClass = 'border-l-4 border-l-green-500 opacity-60';

                return (
                  <div
                    key={order.id}
                    onClick={() => { setSelectedOrder(order); setEmptyCansInput(0); }}
                    className={`bg-white p-4 rounded-xl shadow-sm border ${borderClass} cursor-pointer hover:shadow-md transition active:scale-95 relative overflow-hidden`}
                  >
                    {isPending && isToday && (
                      <div className="absolute top-0 right-0 p-3" onClick={(e) => toggleOrderSelection(order.id, e)}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white shadow-lg scale-110' : 'border-slate-300 bg-white hover:border-blue-400'}`}>
                          {isSelected && <CheckCircle size={14} />}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-2 pr-8">
                      <div>
                        <h4 className="font-bold text-slate-800">{order.customerName}</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <Map size={12} /> <span className="line-clamp-1">{order.deliveryLocation}</span>
                        </div>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg text-xs font-medium text-slate-600 mb-3">
                      {order.items.map(i => `${i.productType} x${i.quantity}`).join(', ')}
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">{order.deliveryDate} • {order.deliveryTime}</span>
                      <span className="font-bold text-slate-800 bg-green-50 px-2 py-1 rounded text-green-700">₹{order.totalAmount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Detailed Order View */
        <div className="space-y-6 animate-fadeIn">
          <button
            onClick={() => setSelectedOrder(null)}
            className="flex items-center gap-1 text-slate-500 font-bold hover:text-slate-800 mb-2"
          >
            ← Back to List
          </button>

          <Card title="Order Details" className="shadow-lg border-t-4 border-t-blue-500">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedOrder.customerName}</h2>
                <StatusBadge status={selectedOrder.status} className="mt-2 text-sm" />
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase font-bold">Order ID</p>
                <p className="font-mono text-slate-600">#{selectedOrder.id.slice(-6)}</p>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <div onClick={() => openMap(selectedOrder.deliveryLocation)} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition group">
                <div className="bg-blue-200 p-2 rounded-full text-blue-700 group-hover:bg-white group-hover:scale-110 transition"><Navigation size={20} /></div>
                <div className="flex-1">
                  <p className="text-xs text-blue-600 font-bold uppercase mb-1">Delivery Location</p>
                  <p className="text-sm font-semibold text-slate-800 leading-tight">{selectedOrder.deliveryLocation}</p>
                  <p className="text-[10px] text-blue-500 mt-1">Tap to Open Maps</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Items Ordered</h3>
                {selectedOrder.status === OrderStatus.DISPATCHED && !isEditingOrder && (
                  <button onClick={() => setIsEditingOrder(true)} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                    <Edit2 size={12} /> Modify
                  </button>
                )}
                {isEditingOrder && (
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditingOrder(false)} className="text-slate-400 text-xs font-bold hover:text-slate-600">Cancel</button>
                    <button onClick={saveModifiedOrder} className="text-green-600 text-xs font-bold flex items-center gap-1 hover:text-green-700">
                      <Save size={12} /> Save
                    </button>
                  </div>
                )}
              </div>

              {isEditingOrder ? (
                // Editing Mode
                <div className="space-y-4">
                  {editedItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded border border-slate-200">
                      <span className="text-slate-700 text-sm font-medium">{item.productType}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleQuantityEdit(idx, -1)} className="w-7 h-7 bg-slate-100 rounded hover:bg-slate-200 font-bold text-slate-600">-</button>
                        <span className="font-bold text-slate-900 w-6 text-center">{item.quantity}</span>
                        <button onClick={() => handleQuantityEdit(idx, 1)} className="w-7 h-7 bg-slate-100 rounded hover:bg-slate-200 font-bold text-slate-600">+</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 mt-2 border-t border-slate-200">
                    <span className="text-slate-500 font-bold">New Total</span>
                    <span className="font-bold text-xl text-blue-600">₹{editedItems.reduce((sum, i) => sum + i.totalPrice, 0)}</span>
                  </div>

                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => setShowAddModal(true)} className="w-full border-dashed text-blue-600 border-blue-200 hover:border-blue-500 hover:bg-blue-50" icon={Plus}>
                      Add Another Product
                    </Button>
                  </div>
                </div>
              ) : (
                // Read Only Mode
                <>
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between border-b border-slate-200 last:border-0 py-3 text-sm">
                      <span className="text-slate-700 font-medium">{item.productType}</span>
                      <span className="font-bold text-slate-900">x {item.quantity}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 mt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-bold">Total Amount</span>
                    <span className="font-bold text-xl text-[#4CAF50]">₹{selectedOrder.totalAmount}</span>
                  </div>
                </>
              )}
            </div>

            {/* Workflow Actions */}
            <div className="space-y-3 pt-2">
              {selectedOrder.status === OrderStatus.PENDING && (
                <>
                  {isToday ? (
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 mb-4">
                      <p className="text-xs text-yellow-800 mb-3 flex gap-2"><ShieldAlert size={14} /> Ensure you have sufficient stock before confirming.</p>
                      <Button className="w-full h-12 text-lg shadow-xl shadow-green-100" onClick={() => handleStatusChange(selectedOrder, OrderStatus.CONFIRMED)} icon={CheckCircle}>
                        Confirm & Load Stock
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 mb-4 text-center">
                      <Calendar className="mx-auto text-slate-400 mb-2" size={24} />
                      <p className="text-slate-600 font-bold">Scheduled for {getDateLabel(selectedOrder.deliveryDate)}</p>
                      <p className="text-xs text-slate-400 mt-1">Actions available on delivery day</p>
                    </div>
                  )}
                </>
              )}

              {selectedOrder.status === OrderStatus.CONFIRMED && (
                <div className="grid grid-cols-1 gap-3">
                  <Button className="w-full py-3 bg-blue-600 hover:bg-blue-700" onClick={() => openMap(selectedOrder.deliveryLocation)} icon={Navigation}>
                    Start Navigation
                  </Button>
                  <Button className="w-full py-3" onClick={() => handleStatusChange(selectedOrder, OrderStatus.DISPATCHED)} icon={Truck}>
                    Arrived / Dispatched
                  </Button>
                </div>
              )}

              {selectedOrder.status === OrderStatus.DISPATCHED && !isEditingOrder && (
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                  <p className="text-center font-bold text-green-800 mb-4 text-lg">Collect ₹{selectedOrder.totalAmount}</p>

                  <div className="mb-4 bg-white p-3 rounded border border-green-200 flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-500">Empty Cans Collected</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEmptyCansInput(Math.max(0, emptyCansInput - 1))} className="w-8 h-8 rounded bg-slate-100 font-bold hover:bg-slate-200">-</button>
                      <span className="font-bold text-lg w-6 text-center">{emptyCansInput}</span>
                      <button onClick={() => setEmptyCansInput(p => p + 1)} className="w-8 h-8 rounded bg-slate-100 font-bold hover:bg-slate-200">+</button>
                    </div>
                  </div>

                  <Button className="w-full py-4 text-lg shadow-xl shadow-green-200 bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange(selectedOrder, OrderStatus.DELIVERED, emptyCansInput)} icon={PackageCheck}>
                    Mark Delivered & Paid
                  </Button>
                </div>
              )}

              {selectedOrder.status === OrderStatus.DELIVERED && (
                <div className="text-center bg-slate-100 rounded-xl p-6 border border-slate-200">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle size={24} />
                  </div>
                  <h3 className="font-bold text-slate-800">Order Completed</h3>
                  <p className="text-xs text-slate-500">Cash collected and stock updated.</p>
                </div>
              )}
            </div>

            {(selectedOrder.status === OrderStatus.DISPATCHED || selectedOrder.status === OrderStatus.DELIVERED) && (
              <div className="mt-6 text-center">
                <button className="text-xs text-slate-400 underline hover:text-red-500">Report an Issue / Return Item</button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Validation Modal */}
      {showValidation && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><ShieldAlert className="text-blue-500" /> Validate Load for {selectedOrderIds.size} Orders</h3>
              <button onClick={() => setShowValidation(false)} className="text-slate-400 hover:text-red-500">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600">Ensure your vehicle has enough stock. <br /><span className="text-xs text-slate-400">Date: {getDateLabel(selectedDate || new Date().toISOString())}</span></p>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {validationResults.map(r => (
                  <div key={r.type} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="font-bold text-sm text-slate-700">{r.type}</p>
                      <p className="text-xs text-slate-500">Required: <strong>{r.needed}</strong></p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${r.sufficient ? 'text-green-600' : 'text-red-600'}`}>
                        Have: {r.have}
                      </p>
                      {r.sufficient ?
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Sufficient</span> :
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Low Stock</span>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {!allSufficient && (
                <div className="bg-orange-50 p-3 rounded text-xs text-orange-800 border border-orange-200 flex items-center gap-2">
                  <ShieldAlert size={16} /> Insufficient stock. Please load more items.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button variant="secondary" onClick={() => setShowStockModal(true)}>Manage Stock</Button>
                <Button onClick={confirmTrip} disabled={!allSufficient} className={!allSufficient ? 'opacity-50 cursor-not-allowed bg-slate-400' : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200'}>
                  Confirm & Start
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {showStockModal && (
        <VehicleStockModal
          driverId={driverId}
          onClose={() => setShowStockModal(false)}
          onUpdate={loadData}
        />
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Add Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-red-500">✕</button>
            </div>
            <div className="p-4 grid gap-3">
              {Object.values(PRODUCT_CONFIG).map((p) => {
                const isAdded = editedItems.some(i => i.productType === p.type);
                if (isAdded) return null; // Already in list

                return (
                  <button
                    key={p.type}
                    onClick={() => {
                      const newItem = {
                        productType: p.type,
                        quantity: 1,
                        pricePerUnit: p.normalPrice, // Default to Normal Price
                        totalPrice: p.normalPrice
                      };
                      setEditedItems([...editedItems, newItem]);
                      setShowAddModal(false);
                    }}
                    className="flex justify-between items-center p-3 rounded-lg border border-slate-200 hover:border-[#4CAF50] hover:bg-green-50 transition text-left"
                  >
                    <span className="font-medium text-slate-700">{p.type}</span>
                    <Plus size={18} className="text-[#4CAF50]" />
                  </button>
                );
              })}
              {Object.values(PRODUCT_CONFIG).every(p => editedItems.some(i => i.productType === p.type)) && (
                <p className="text-center text-slate-400 text-sm py-4">All products already added.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

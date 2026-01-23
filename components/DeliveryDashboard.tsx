import React, { useState, useEffect } from 'react';
import { Card, Button, StatusBadge, Modal, useToast, Input } from './SharedComponents';
import { subscribeOrders, saveOrder, getVehicleInventory, updateVehicleInventory, updateCustomerPendingAmount, getCustomers, saveCustomer } from '../services/firestoreService';
import { Order, OrderStatus, ProductType, CanState, InventoryItem, PaymentMode, PaymentStatus, Customer } from '../types';
import { Map, Truck, PackageCheck, CheckCircle, Navigation, Wallet, Package, Clock, ShieldAlert, Edit2, Save, X, Plus, Calendar, Coins, QrCode, ArrowLeft } from 'lucide-react';
import { DRIVER_CREDENTIALS, PRODUCT_CONFIG } from '../constants';
import { VehicleStockModal } from './VehicleStockModal';

export const DeliveryDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [vehicleStock, setVehicleStock] = useState<InventoryItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [showValidation, setShowValidation] = useState(false);
  const toast = useToast();

  // Date Filtering State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Modification State
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editedItems, setEditedItems] = useState<Order['items']>([]);

  const [emptyCansInput, setEmptyCansInput] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  // Empty Can Logging State
  const [showLogEmptyCansModal, setShowLogEmptyCansModal] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedCustomerForLog, setSelectedCustomerForLog] = useState<string>('');
  const [logCanCount, setLogCanCount] = useState(0);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Payment Workflow State
  const [showPaymentView, setShowPaymentView] = useState(false);
  const [showEmptyCanConfirmation, setShowEmptyCanConfirmation] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [amountCollected, setAmountCollected] = useState(0);

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
    });
    return () => unsub();
  }, []); // Run once on mount

  // Sync editing state
  useEffect(() => {
    if (selectedOrder) {
      setEditedItems(selectedOrder.items);
      setIsEditingOrder(false);
      // Reset payment flow on new order selection
      setShowPaymentView(false);
      setShowEmptyCanConfirmation(false);
      // Default empty cans input to 0 or whatever was previously saved if re-editing (though usually we start fresh)
      setEmptyCansInput(selectedOrder.emptyCansReturned || 0);
      setPaymentMode(PaymentMode.CASH);
      setAmountCollected(selectedOrder.totalAmount);
    }
  }, [selectedOrder]);

  // Filter customers effect
  useEffect(() => {
    // Only show customers who HAVE cans (outstandingCans > 0)
    const hasCans = allCustomers.filter(c => (c.outstandingCans || 0) > 0);

    if (!customerSearchTerm) {
      setFilteredCustomers(hasCans);
    } else {
      const lower = customerSearchTerm.toLowerCase();
      setFilteredCustomers(hasCans.filter(c =>
        c.name.toLowerCase().includes(lower) ||
        c.phone.includes(lower) ||
        (c.shopName && c.shopName.toLowerCase().includes(lower))
      ));
    }
  }, [customerSearchTerm, allCustomers]);

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
        toast.error("Insufficient Vehicle Stock! Load inventory first.");
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

    await saveOrder(updatedOrder);
    setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
    setSelectedOrder(updatedOrder);
  };

  // --- Payment & Delivery Workflow ---

  const initiateDeliveryCompletion = () => {
    if (emptyCansInput === 0) {
      setShowEmptyCanConfirmation(true);
    } else {
      setShowPaymentView(true);
    }
  };

  const handlePaymentCompletion = async () => {
    if (!selectedOrder) return;

    // 1. Update Inventory (Add Empty Cans)
    if (emptyCansInput > 0) {
      const emptyCanItem = {
        type: ProductType.CAN_20L,
        quantity: emptyCansInput,
        canState: CanState.EMPTY
      };
      await updateVehicleInventory(driverId, emptyCanItem, 'INCREMENT');
    }

    // 2. Handle Pending Payment Logic
    const pendingDifference = selectedOrder.totalAmount - amountCollected;
    if (pendingDifference > 0) {
      // Add to Customer's Pending Balance
      await updateCustomerPendingAmount(selectedOrder.customerId, pendingDifference);
    }

    // 3. Update Order
    const updatedOrder: Order = {
      ...selectedOrder,
      status: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PAID,
      paymentMode: paymentMode,
      amountReceived: amountCollected,
      emptyCansReturned: emptyCansInput,
      completedAt: new Date().toISOString(),
      cashHandoverStatus: paymentMode === PaymentMode.CASH ? 'PENDING' : undefined
    };

    await saveOrder(updatedOrder);
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setSelectedOrder(updatedOrder);

    // Reset Flow
    setShowPaymentView(false);
    loadData();
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

    // 1. Calculate Differences for Stock (in CASES for Bottles)
    let stockError = null;
    const inventoryUpdates: InventoryItem[] = [];

    const newTotalAmount = editedItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // Merge old and new items to ensure we cover all products
    const allProductTypes = new Set([
      ...selectedOrder.items.map(i => i.productType),
      ...editedItems.map(i => i.productType)
    ]);

    for (const type of Array.from(allProductTypes)) {
      const oldItem = selectedOrder.items.find(x => x.productType === type);
      const newItem = editedItems.find(x => x.productType === type);

      const oldQty = oldItem ? oldItem.quantity : 0;
      const newQty = newItem ? newItem.quantity : 0;

      if (oldQty === newQty) continue;

      const isCan = type === ProductType.CAN_20L;

      // Calculate CASES required for stock check
      let oldCases = oldQty;
      let newCases = newQty;

      if (!isCan) {
        const itemsPerCase = PRODUCT_CONFIG[type as ProductType]?.itemsPerCase || 1;
        oldCases = Math.ceil(oldQty / itemsPerCase);
        newCases = Math.ceil(newQty / itemsPerCase);
      }

      const diffCases = oldCases - newCases; // positive = returned to stock (add), negative = taken from stock (sub)

      if (diffCases === 0) continue; // No stock change needed (e.g. 5 bottles -> 6 bottles might still be 1 case)

      const stockKey = { type: type as ProductType, canState: isCan ? CanState.FILLED : undefined };

      if (diffCases < 0) {
        // Need MORE items (Take from Truck)
        const needed = Math.abs(diffCases);
        const stock = vehicleStock.find(s => s.type === stockKey.type && s.canState === stockKey.canState);

        // Allow if we have enough stock OR if we are just untracking items (diff > 0)
        // But here diff < 0 means we need stock.
        if (!stock || stock.quantity < needed) {
          stockError = `Insufficient stock for ${type}. Need ${needed} more ${isCan ? 'Cans' : 'Cases'}.`;
          break;
        }
      }

      // Add update (diff works for sign: + adds, - subtracts)
      inventoryUpdates.push({ type: stockKey.type, quantity: diffCases, canState: stockKey.canState });
    }

    if (stockError) {
      toast.error(stockError);
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
    toast.success("Order Modified & Stock Updated");
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
        const qty = item.quantity;
        requirements[key] = (requirements[key] || 0) + qty;
      });
    });

    return Object.keys(requirements).map(type => {
      const isCan = type === ProductType.CAN_20L;
      // Case Calculation
      let needed = requirements[type];
      if (!isCan) {
        const itemsPerCase = PRODUCT_CONFIG[type as ProductType]?.itemsPerCase || 1;
        needed = Math.ceil(needed / itemsPerCase);
      }

      const stockItem = isCan
        ? vehicleStock.find(s => s.type === type && s.canState === CanState.FILLED)
        : vehicleStock.find(s => s.type === type);

      const have = stockItem?.quantity || 0;
      return { type, needed, have, sufficient: have >= needed, isCase: !isCan };
    });
  };

  const validationResults = getValidationData();
  const allSufficient = validationResults.every(r => r.sufficient);

  // --- Empty Can Logging (Manual) ---
  // --- Empty Can Logging (Manual) ---
  const handleOpenLogEmptyCans = async () => {
    setShowLogEmptyCansModal(true);
    setLogCanCount(0);
    setSelectedCustomerForLog('');
    setCustomerSearchTerm('');

    // Fetch customers if not already loaded significantly? Or always refresh?
    // Better to refresh to get latest users.
    setIsLoadingCustomers(true);
    try {
      const customers = await getCustomers();
      setAllCustomers(customers);
      setFilteredCustomers(customers);
    } catch (e) {
      console.error("Failed to load customers", e);
      toast.error("Failed to load customer list. Please check connection.");
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleLogEmptyCansSubmit = async () => {
    if (!selectedCustomerForLog || logCanCount <= 0) {
      toast.error("Please select a customer and enter a valid count.");
      return;
    }

    const customer = allCustomers.find(c => c.id === selectedCustomerForLog);
    if (!customer) return;

    // 1. Update Vehicle Inventory
    const emptyCanItem = {
      type: ProductType.CAN_20L,
      quantity: logCanCount,
      canState: CanState.EMPTY
    };
    await updateVehicleInventory(driverId, emptyCanItem, 'INCREMENT');

    // 2. Update Customer Profile (Outstanding Cans)
    // Reduce outstanding cans (min 0? No, maybe they return more than they owe? Let's allow negative for now or stay at 0?)
    // Usually outstanding means "they owe us". If they return, outstanding decreases.
    const newOutstanding = (customer.outstandingCans || 0) - logCanCount;
    // We can allow negative to imply we owe them? Or just floor at 0?
    // Let's just do math. If it goes negative, it means they have deposit credit maybe.
    const updatedCustomer = { ...customer, outstandingCans: newOutstanding };
    await saveCustomer(updatedCustomer);

    // 3. Create Dummy Completed Order for History
    const logOrder: Order = {
      id: `log-${Date.now()}`,
      customerId: customer.id,
      customerName: customer.name,
      customerType: customer.type,
      items: [], // No products sold
      totalAmount: 0,
      status: OrderStatus.COMPLETED,
      deliveryLocation: customer.location,
      deliveryDate: new Date().toISOString().split('T')[0],
      deliveryTime: new Date().toLocaleTimeString(),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      emptyCansReturned: logCanCount,
      driverId: driverId,
      paymentStatus: PaymentStatus.PAID, // N/A
      paymentMode: PaymentMode.CASH, // N/A
      amountReceived: 0
    };
    await saveOrder(logOrder);

    toast.success(`Successfully logged ${logCanCount} empty cans from ${customer.name}`);
    setShowLogEmptyCansModal(false);
    loadData(); // Refresh inventory
  };

  const confirmTrip = async () => {
    const selectedOrdersList = orders.filter(o => selectedOrderIds.has(o.id));
    // Re-calculate REQUIREMENTS per type purely to get the Case Count for deduction
    const requirements: Record<string, number> = {};
    selectedOrdersList.forEach(order => {
      order.items.forEach(item => {
        requirements[item.productType] = (requirements[item.productType] || 0) + item.quantity;
      });
    });

    const allUpdates: InventoryItem[] = [];

    Object.keys(requirements).forEach(type => {
      const isCan = type === ProductType.CAN_20L;
      let qtyToDeduct = requirements[type];

      if (!isCan) {
        const itemsPerCase = PRODUCT_CONFIG[type as ProductType]?.itemsPerCase || 1;
        qtyToDeduct = Math.ceil(qtyToDeduct / itemsPerCase);
      }

      allUpdates.push({
        type: type as ProductType,
        quantity: -qtyToDeduct,
        canState: isCan ? CanState.FILLED : undefined
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
    toast.success("Trip Started! Inventory Reserved.");
  };

  // Render Payment View if active
  if (selectedOrder && showPaymentView) {
    const pendingBalance = selectedOrder.totalAmount - amountCollected;

    return (
      <div className="pb-24 p-4 md:p-6 bg-slate-50 min-h-screen animate-fadeIn">
        <button
          onClick={() => setShowPaymentView(false)}
          className="flex items-center gap-1 text-slate-500 font-bold hover:text-slate-800 mb-6"
        >
          <ArrowLeft size={16} /> Back to Order
        </button>

        <Card title="Payment Collection" className="shadow-lg border-t-4 border-t-green-500">
          <div className="text-center mb-6">
            <p className="text-slate-500 text-sm font-bold uppercase">Total to Collect</p>
            <h2 className="text-4xl font-bold text-slate-800 my-2">₹{selectedOrder.totalAmount}</h2>
          </div>

          <div className="bg-slate-50 p-1 rounded-lg flex mb-6 border border-slate-200">
            <button
              onClick={() => setPaymentMode(PaymentMode.CASH)}
              className={`flex-1 py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${paymentMode === PaymentMode.CASH ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Wallet size={16} /> Cash
            </button>
            <button
              onClick={() => setPaymentMode(PaymentMode.UPI)}
              className={`flex-1 py-3 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${paymentMode === PaymentMode.UPI ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <QrCode size={16} /> UPI / QR
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                {paymentMode === PaymentMode.CASH ? 'Amount Received' : 'Confirm Amount Received'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-3 rounded-lg border border-slate-200 font-bold text-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            {pendingBalance > 0 && (
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-800 font-bold flex justify-between">
                  <span>⚠️ Pending Payment Added:</span>
                  <span>₹{pendingBalance}</span>
                </p>
                <p className="text-[10px] text-orange-600 mt-1">This amount will be added to the customer's pending balance.</p>
              </div>
            )}
          </div>

          {paymentMode === PaymentMode.UPI && (
            <div className="text-center mb-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block shadow-sm">
                <img src="/qr-code.png" alt="UPI QR Code" className="w-48 h-48 object-contain mx-auto" />
              </div>
              <p className="text-sm text-slate-500 mt-2">Scan to pay <strong>₹{selectedOrder.totalAmount}</strong></p>
            </div>
          )}

          <Button
            className="w-full py-4 text-lg bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100"
            onClick={handlePaymentCompletion}
            icon={CheckCircle}
          >
            Close Order
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="pb-24 p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Truck className="text-[#4CAF50]" /> Delivery Partner</h1>
          <p className="text-slate-500 text-sm">Welcome back, Driver</p>
        </div>
        <Button onClick={handleOpenLogEmptyCans} className="bg-blue-600 shadow-md text-sm px-4 py-2">
          Log Empty Cans
        </Button>
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
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowStockModal(true)} className="w-full text-sm h-10 border-dashed border-2">Load Cans in Vehicle</Button>
            </div>
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
        </div >
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
                  <p className="text-sm text-slate-500">{selectedOrder.customerType}</p>
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

                  {/* ACTION TRIGGER */}
                  <Button className="w-full py-4 text-lg shadow-xl shadow-green-200 bg-green-600 hover:bg-green-700" onClick={initiateDeliveryCompletion} icon={PackageCheck}>
                    Move to Payment
                  </Button>
                </div>
              )}

              {selectedOrder.status === OrderStatus.DELIVERED && (
                <div className="text-center bg-slate-100 rounded-xl p-6 border border-slate-200">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle size={24} />
                  </div>
                  <h3 className="font-bold text-slate-800">Order Completed</h3>
                  <p className="text-xs text-slate-500">Paid: {selectedOrder.paymentMode} | Collected: {selectedOrder.emptyCansReturned} Cans</p>
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
      {
        showValidation && (
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
                        <p className="text-xs text-slate-500">Required: <strong>{r.needed} {r.isCase ? 'Cases' : ''}</strong></p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${r.sufficient ? 'text-green-600' : 'text-red-600'}`}>
                          Have: {r.have} {r.isCase ? 'Cases' : ''}
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
        )
      }

      {/* Empty Can Confirmation Modal */}
      {
        showEmptyCanConfirmation && (
          <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fadeIn">
              <div className="p-6 text-center">
                <ShieldAlert size={48} className="mx-auto text-orange-400 mb-4" />
                <h3 className="font-bold text-lg text-slate-800 mb-2">No Empty Cans Collected?</h3>
                <p className="text-sm text-slate-500 mb-6">Are you sure there are no empty cans to collect for this customer?</p>

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowEmptyCanConfirmation(false)} className="flex-1">No, I have cans</Button>
                  <Button onClick={() => { setShowEmptyCanConfirmation(false); setShowPaymentView(true); }} className="flex-1 bg-blue-600">Confirm (0 Cans)</Button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Stock Modal */}
      {
        showStockModal && (
          <VehicleStockModal
            driverId={driverId}
            onClose={() => setShowStockModal(false)}
            onUpdate={loadData}
            recommendedStock={validationResults.map(r => ({
              type: r.type as ProductType,
              quantity: r.needed,
              canState: r.type === ProductType.CAN_20L ? CanState.FILLED : undefined
            }))}
          />
        )
      }

      {/* Add Product Modal */}
      {/* Add Product Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Product"
      >
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
      </Modal>


      {/* Log Returns Modal (Optimized) */}
      {/* Log Returns Modal (Optimized) */}
      <Modal
        isOpen={showLogEmptyCansModal}
        onClose={() => setShowLogEmptyCansModal(false)}
        title="Log Returns"
        footer={
          <Button
            onClick={handleLogEmptyCansSubmit}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100"
            disabled={!selectedCustomerForLog || logCanCount <= 0}
            icon={Save}
          >
            Confirm Collection ({logCanCount})
          </Button>
        }
      >
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Customer Search & Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Select Customer</label>

            {isLoadingCustomers ? (
              <div className="p-4 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                Loading Customers...
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full p-2 text-sm rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />

                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50">
                  {filteredCustomers.length === 0 ? (
                    <p className="p-3 text-xs text-slate-400 text-center">No customers found.</p>
                  ) : (
                    filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCustomerForLog(c.id)}
                        className={`p-2 border-b border-slate-100 last:border-0 cursor-pointer text-sm flex justify-between items-center hover:bg-white transition ${selectedCustomerForLog === c.id ? 'bg-blue-50 border-blue-200' : ''}`}
                      >
                        <div>
                          <p className="font-bold text-slate-700">{c.name}</p>
                          <p className="text-[10px] text-slate-500">{c.shopName || c.phone} • <span className="text-blue-600 font-bold">{c.outstandingCans} Cans Pending</span></p>
                        </div>
                        {selectedCustomerForLog === c.id && <CheckCircle size={14} className="text-blue-600" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Count Input */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 mb-2 text-center">Empty Cans Collected</label>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setLogCanCount(Math.max(0, logCanCount - 1))}
                className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm font-bold text-xl hover:bg-slate-100 text-slate-600 active:scale-95 transition"
              >-</button>
              <span className="text-3xl font-black text-slate-800 w-16 text-center">{logCanCount}</span>
              <button
                onClick={() => {
                  const customer = allCustomers.find(c => c.id === selectedCustomerForLog);
                  const max = customer?.outstandingCans || 0;
                  if (logCanCount < max) {
                    setLogCanCount(logCanCount + 1);
                  } else {
                    toast.error(`Customer only has ${max} cans to return.`);
                  }
                }}
                className={`w-12 h-12 rounded-xl border shadow-lg font-bold text-xl active:scale-95 transition ${logCanCount >= (allCustomers.find(c => c.id === selectedCustomerForLog)?.outstandingCans || 0) ? 'bg-slate-100 border-slate-200 text-slate-300' : 'bg-green-500 border-green-600 shadow-green-200 text-white hover:bg-green-600'}`}
              >+</button>
            </div>
            {selectedCustomerForLog && (
              <p className="text-center text-xs text-slate-400 mt-2">
                Max Returnable: {allCustomers.find(c => c.id === selectedCustomerForLog)?.outstandingCans || 0}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div >
  );
};

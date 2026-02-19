import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, StatusBadge, useToast, Modal } from './SharedComponents';
import { ProductType, Order, OrderItem, OrderStatus, Customer } from '../types';
import { PRODUCT_CONFIG } from '../constants';
import { calculateCases, saveOrder, subscribeOrders, calculateSmartRounding } from '../services/firestoreService';
import { MapPin, Clock, ShoppingCart, Navigation, Printer, X } from 'lucide-react';
import { LocationPickerMap } from './LocationPickerMap';

interface CustomerDashboardProps {
  customer: Customer;
  onLogout: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ customer, onLogout }) => {
  const [view, setView] = useState<'ORDER' | 'HISTORY'>('ORDER');
  const [orders, setOrders] = useState<Order[]>([]);
  const toast = useToast();


  // Order Form State (Multi-Product)
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  // Location State
  const [gpsCoords, setGpsCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [location, setLocation] = useState(customer.location);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      // Set GPS coords but DO NOT overwrite the manual address text
      setGpsCoords({ lat: latitude, lng: longitude });
      setIsLocating(false);
    }, (error) => {
      console.error("Error", error); toast.error("Unable to get location"); setIsLocating(false);
    }, { enableHighAccuracy: true });
  };
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });

  const [emptyReturns, setEmptyReturns] = useState(0);
  const [hasEmptyReturns, setHasEmptyReturns] = useState(false);

  // Receipt Printing State
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  const handlePrintReceipt = (order: Order) => {
    setPrintingOrder(order);
    // Allow state to update then print
    setTimeout(() => {
      window.print();
      // Optional: clear after print? modifying state during print dialog behavior is tricky
      // better to let user close the modal manually or clear it after a delay
    }, 100);
  };

  useEffect(() => {
    const unsub = subscribeOrders((allOrders) => {
      setOrders(allOrders);
    });
    return () => unsub();
  }, []);

  const updateQuantity = (type: string, val: string) => {
    if (val.includes('-')) return;
    const num = parseInt(val);
    if (!isNaN(num) && num < 0) return;
    setQuantities(prev => ({ ...prev, [type]: val }));
  };

  const hasItems = Object.values(quantities).some(v => parseInt(v || "0") > 0);

  // Total Price Calculation
  const calculateTotal = () => {
    return Object.entries(quantities).reduce((sum, [typeStr, valStr]) => {
      const qty = parseInt(valStr || "0");
      if (qty === 0) return sum;
      const type = typeStr as ProductType;
      const config = PRODUCT_CONFIG[type];

      const { roundedQty } = calculateSmartRounding(type, qty);
      // Customer specific pricing
      const pricePerUnit = customer.type === 'RETAIL' ? config.retailPrice : config.normalPrice;

      const calc = calculateCases(type, roundedQty);
      let itemTotal = 0;

      if (type.includes('Bottle')) {
        const casesToCharge = calc.cases + (calc.loose > 0 ? 1 : 0);
        itemTotal = casesToCharge * pricePerUnit;
      } else {
        itemTotal = roundedQty * pricePerUnit;
      }
      return sum + itemTotal;
    }, 0);
  };

  const totalPrice = calculateTotal();

  const handlePlaceOrder = async () => {
    // Validation
    if (!date || !time) {
      toast.error("Please select a Delivery Date and Time.");
      return;
    }

    const now = new Date();
    const selectedDateTime = new Date(`${date}T${time}`);
    const timeDiff = selectedDateTime.getTime() - now.getTime();
    const oneHourMs = 60 * 60 * 1000;
    const thirtyMinsMs = 30 * 60 * 1000;

    let finalDate = date;
    let finalTime = time;

    // Append GPS to location if present
    let finalLocation = location;
    if (gpsCoords) {
      if (finalLocation) finalLocation += ` (GPS: ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)})`;
      else finalLocation = `GPS: ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}`;
    }

    // Auto-correction logic
    if (timeDiff < oneHourMs) {
      const newDeliveryTime = new Date(now.getTime() + thirtyMinsMs);
      finalDate = newDeliveryTime.toISOString().split('T')[0];

      const hh = String(newDeliveryTime.getHours()).padStart(2, '0');
      const min = String(newDeliveryTime.getMinutes()).padStart(2, '0');
      finalTime = `${hh}:${min}`;

      toast.success(`Delivery time updated to ${finalTime} (minimum 30 mins preparation time).`);

      setDate(finalDate);
      setTime(finalTime);
    }

    // Build Items Array
    const orderItems: OrderItem[] = Object.entries(quantities)
      .filter(([_, val]) => parseInt(val || "0") > 0)
      .map(([typeStr, valStr]) => {
        const type = typeStr as ProductType;
        const rawQty = parseInt(valStr || "0");
        const config = PRODUCT_CONFIG[type];

        const { roundedQty, isRounded, extra } = calculateSmartRounding(type, rawQty);
        const calc = calculateCases(type, roundedQty);

        const pricePerUnit = customer.type === 'RETAIL' ? config.retailPrice : config.normalPrice;
        let itemTotal = 0;
        if (type.includes('Bottle')) {
          const casesToCharge = calc.cases + (calc.loose > 0 ? 1 : 0);
          itemTotal = casesToCharge * pricePerUnit;
        } else {
          itemTotal = roundedQty * pricePerUnit;
        }

        return {
          productType: type,
          quantity: roundedQty,
          calculatedCases: type.includes('Bottle') ? calculateCases(type, roundedQty).cases : undefined,
          pricePerUnit,
          totalPrice: itemTotal,
          originalQuantity: isRounded ? rawQty : undefined
        };
      });

    const newOrder: Order = {
      id: Date.now().toString(),
      customerId: customer.id,
      customerName: customer.name,
      customerType: customer.type,
      items: orderItems,
      totalAmount: totalPrice,
      status: OrderStatus.PENDING,
      deliveryLocation: finalLocation,
      deliveryDate: finalDate,
      deliveryTime: finalTime,
      createdAt: new Date().toISOString(),
      emptyCansReturned: hasEmptyReturns ? emptyReturns : 0
    };

    await saveOrder(newOrder);



    toast.success('Order Placed Successfully!');
    setQuantities({});
    setEmptyReturns(0);
    setHasEmptyReturns(false);
    setView('HISTORY');
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 print:hidden">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Welcome, {customer.name}</h1>
          {customer.type === 'RETAIL' && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Retail Customer</span>}
        </div>
        <button onClick={onLogout} className="text-sm text-red-500">Logout</button>
      </div>

      {customer.pendingAmount > 0 && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex justify-between items-start gap-4 animate-pulse">
          <div className="flex-1">
            <p className="text-orange-800 font-bold text-sm">Pending Payment</p>
            <p className="text-xs text-orange-600 mt-1 leading-relaxed">Pending amount from previous order only, please pay with delivery partner.</p>
          </div>
          <span className="text-xl font-bold text-orange-700 shrink-0 mt-1">₹{customer.pendingAmount}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant={view === 'ORDER' ? 'primary' : 'secondary'} onClick={() => setView('ORDER')} className="flex-1">Place Order</Button>
        <Button variant={view === 'HISTORY' ? 'primary' : 'secondary'} onClick={() => setView('HISTORY')} className="flex-1">History</Button>
      </div>

      {view === 'ORDER' && (
        <Card title="New Order - Select Products">
          {/* Product List */}
          <div className="space-y-4 mb-6">
            {Object.values(ProductType).map(tKey => {
              const rawQtyStr = quantities[tKey] || "0";
              const rawQty = parseInt(rawQtyStr);
              const isSelected = rawQty > 0;
              const config = PRODUCT_CONFIG[tKey];
              const caseSize = config.itemsPerCase;
              const price = customer.type === 'RETAIL' ? config.retailPrice : config.normalPrice;

              const { roundedQty, extra } = calculateSmartRounding(tKey, rawQty);
              const hasRounding = extra > 0;
              const calc = calculateCases(tKey, roundedQty);
              const diff = roundedQty - rawQty;

              return (
                <div key={tKey} className={`flex flex-col p-4 rounded-xl border-2 transition-all duration-300 ${isSelected ? 'border-[#4CAF50] bg-green-50 shadow-md' : 'border-slate-100 bg-white'}`}>
                  <div className="flex items-start justify-between">
                    {/* Info */}
                    <div className="flex flex-col flex-1 pr-4">
                      <div className="font-bold text-slate-800 text-base">{tKey}</div>
                      <div className="text-[10px] text-slate-500 font-medium my-1">
                        {caseSize ? `${caseSize} items/case` : 'Standard Unit'}
                      </div>
                      <div className="font-bold text-slate-900">₹{price}<span className="text-[10px] font-normal text-slate-500"> {tKey.includes('Bottle') ? '/case' : '/unit'}</span></div>
                    </div>

                    {/* Input */}
                    <div className="flex items-center">
                      <div className={`flex items-center px-2 py-1 rounded-lg border-2 transition-all ${isSelected ? 'bg-white border-green-200' : 'bg-slate-100 border-transparent'}`}>
                        <ShoppingCart size={16} className={`mr-2 ${isSelected ? 'text-[#4CAF50]' : 'text-slate-400'}`} />
                        <input
                          type="number"
                          min="0"
                          onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                          value={rawQtyStr === "0" ? "" : rawQtyStr}
                          onChange={e => updateQuantity(tKey, e.target.value)}
                          placeholder="0"
                          className={`w-12 h-8 text-center text-xl font-bold outline-none bg-transparent ${isSelected ? 'text-[#4CAF50]' : 'text-slate-400 focus:text-slate-900'}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Feedback */}
                  {isSelected && (
                    <div className={`mt-2 p-2 rounded-lg text-xs transition-all ${hasRounding ? 'bg-[#4CAF50] text-white' : 'bg-white text-green-800 border border-green-100'}`}>
                      {tKey.includes('Bottle') ? (
                        <>
                          <div className="font-bold flex items-center gap-1">
                            {hasRounding ? '✨ Optimized for Cases' : '✓ Standard Pack'}
                          </div>
                          <div className="opacity-95 mt-0.5">
                            You get <b>{roundedQty}</b> bottles ({calc.display}).
                            {hasRounding && ` (Includes ${diff} extra)`}
                          </div>
                        </>
                      ) : (
                        <div className="font-bold">Total: {roundedQty} Cans</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Empty Cans section */}
          <div className="mb-4 pt-4 border-t border-slate-100">
            <label className="flex items-center space-x-2 mb-2">
              <input type="checkbox" checked={hasEmptyReturns} onChange={e => setHasEmptyReturns(e.target.checked)} className="rounded text-green-600 focus:ring-green-500" />
              <span className="text-sm font-semibold text-slate-700">I have Empty cans to return</span>
            </label>
            {hasEmptyReturns && (
              <Input
                type="number"
                placeholder="Count of empty cans"
                className="mt-2"
                value={emptyReturns}
                onChange={e => setEmptyReturns(Number(e.target.value))}
              />
            )}
          </div>

          {/* Delivery Details */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Delivery Details</h4>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 mb-1">
                <button onClick={handleGetCurrentLocation} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold shadow hover:bg-green-700 flex items-center justify-center gap-2">
                  <Navigation size={14} />
                  {isLocating ? 'Locating...' : 'Use GPS'}
                </button>
                <button onClick={() => setShowMap(true)} className="px-3 bg-white text-slate-600 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50">
                  Map
                </button>
              </div>

              {gpsCoords && (
                <div className="flex items-center gap-2 mb-1 bg-green-50 p-2 rounded border border-green-100">
                  <MapPin size={12} className="text-green-600" />
                  <span className="text-[10px] font-bold text-green-700">GPS Location Pinned ✓</span>
                  <button
                    onClick={() => setGpsCoords(null)}
                    className="ml-auto text-[10px] text-red-400 font-bold hover:text-red-600 border-l border-green-200 pl-2">
                    CLEAR
                  </button>
                </div>
              )}

              <Input label="Address (Optional if GPS used)" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Input type="date" label="Date" className="flex-1" value={date} onChange={e => setDate(e.target.value)} />
              <Input type="time" label="Time" className="flex-1" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-slate-600">Total Estimate</span>
              <span className="text-3xl font-bold text-[#4CAF50]">₹{totalPrice}</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-4 text-right">Payment due on delivery</p>
            <Button className="w-full h-12 text-lg shadow-lg shadow-green-100 bg-[#4CAF50] hover:bg-[#43a047]" onClick={handlePlaceOrder} disabled={(!hasItems && (!hasEmptyReturns || emptyReturns <= 0)) || !location || !date || !time}>
              {(!hasItems && hasEmptyReturns && emptyReturns > 0) ? 'Request Pick Up' : 'Place Order'}
            </Button>
          </div>
        </Card>
      )}

      {view === 'HISTORY' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800">Your Orders</h2>
          <h2 className="text-lg font-bold text-slate-800">Your Orders</h2>
          {orders.filter(o => o.customerId === customer.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(order => (
            <div key={order.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-slate-800">Order #{order.id.slice(-6)}</p>
                  <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="bg-slate-50 p-2 rounded text-sm text-slate-600 mb-2">
                {order.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between border-b border-slate-100 last:border-0 py-1">
                    <span>{i.productType} x {i.quantity}</span>
                    <span>₹{i.totalPrice}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-2 space-y-1">
                <div className="flex justify-between items-center font-bold text-slate-800">
                  <span>Total</span>
                  <span className="text-blue-600">₹{order.totalAmount}</span>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => handlePrintReceipt(order)}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 px-2 py-1 rounded"
                  >
                    <Printer size={12} /> Print Receipt
                  </button>
                </div>
                {(order.status === 'Delivered' || order.status === 'Empty cans picked') && (
                  <>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Paid</span>
                      <span className="font-bold text-green-600">₹{order.amountReceived || 0}</span>
                    </div>
                    {(order.totalAmount - (order.amountReceived || 0)) > 0 && (
                      <div className="flex justify-between text-xs font-bold text-red-500">
                        <span>Pending</span>
                        <span>₹{order.totalAmount - (order.amountReceived || 0)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {orders.filter(o => o.customerId === customer.id).length === 0 && (
            <p className="text-center text-slate-400 py-8">No order history found.</p>
          )}
        </div>
      )}
      {/* Map Modal */}
      {/* Map Modal */}
      <Modal
        isOpen={showMap}
        onClose={() => setShowMap(false)}
        title="Set Location"
        footer={
          <div className="w-full bg-green-600 text-white p-4 rounded-xl text-center font-bold shadow-xl shadow-green-200 cursor-pointer" onClick={() => setShowMap(false)}>
            Confirm Location
          </div>
        }
      >
        <div className="h-[60vh] relative">
          <LocationPickerMap
            onLocationSelect={(lat, lng) => {
              setGpsCoords({ lat, lng });
            }}
            initialLat={gpsCoords?.lat || 9.1726} initialLng={gpsCoords?.lng || 77.8808}
          />
        </div>
      </Modal>


      {/* Hidden Print Receipt Template */}
      {
        printingOrder && (
          <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-800 mb-1">EcoExpress Water</h1>
              <p className="text-xs text-slate-500">Fast & Reliable Water Delivery</p>
            </div>

            <div className="border-b-2 border-slate-800 pb-4 mb-4">
              <h2 className="text-xl font-bold uppercase tracking-wider mb-2">Receipt</h2>
              <div className="flex justify-between text-sm">
                <span className="font-bold">Order #{printingOrder.id.slice(-6)}</span>
                <span>{new Date(printingOrder.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="text-sm mt-1">
                <span className="text-slate-600">Customer: {printingOrder.customerName}</span>
              </div>
            </div>

            <div className="mb-6">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {printingOrder.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="py-2">{item.productType}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{item.pricePerUnit}</td>
                      <td className="py-2 text-right">₹{item.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end text-sm border-t border-slate-800 pt-3 mb-6">
              <div className="w-1/2 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{printingOrder.totalAmount}</span>
                </div>
                {/* Tax or Fees if any */}
                <div className="flex justify-between font-bold text-lg border-t border-slate-300 pt-1 mt-1">
                  <span>Total</span>
                  <span>₹{printingOrder.totalAmount}</span>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 mt-12">
              <p>Thank you for your business!</p>
              <p>Contact: +91 123-456-7890 | help@ecoexpress.com</p>
            </div>
          </div>
        )
      }
    </div >
  );
};

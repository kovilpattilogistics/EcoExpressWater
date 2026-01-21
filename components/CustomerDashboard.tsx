import React, { useState } from 'react';
import { Card, Button, Input, Select, StatusBadge } from './SharedComponents';
import { ProductType, Order, OrderItem, OrderStatus, Customer } from '../types';
import { PRODUCT_CONFIG } from '../constants';
import { calculateCases, saveOrder, subscribeOrders, calculateSmartRounding } from '../services/mockService';
import { MapPin, Clock } from 'lucide-react';

interface CustomerDashboardProps {
  customer: Customer;
  onLogout: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ customer, onLogout }) => {
  const [view, setView] = useState<'ORDER' | 'HISTORY'>('ORDER');
  const [orders, setOrders] = useState<Order[]>([]);

  // Order Form State
  const [productType, setProductType] = useState<ProductType>(ProductType.CAN_20L);
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState(customer.location);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [emptyReturns, setEmptyReturns] = useState(0);
  const [hasEmptyReturns, setHasEmptyReturns] = useState(false);

  useEffect(() => {
    const unsub = subscribeOrders((allOrders) => {
      setOrders(allOrders);
    });
    return () => unsub();
  }, []);

  // Pricing Logic
  const config = PRODUCT_CONFIG[productType];
  const pricePerUnit = customer.type === 'RETAIL' ? config.retailPrice : config.normalPrice;

  const calculation = calculateCases(productType, quantity);
  let totalPrice = 0;

  if (productType.includes('Bottle')) {
    const totalCasesToCharge = calculation.cases + (calculation.loose > 0 ? 1 : 0);
    totalPrice = totalCasesToCharge * pricePerUnit;
  } else {
    totalPrice = quantity * pricePerUnit;
  }

  // Smart Rounding calculation for display
  const smartRound = calculateSmartRounding(productType, quantity);

  const handlePlaceOrder = async () => {
    // Validation
    if (!date || !time) {
      alert("Please select a Delivery Date and Time.");
      return;
    }

    const now = new Date();
    const selectedDateTime = new Date(`${date}T${time}`);
    const timeDiff = selectedDateTime.getTime() - now.getTime();
    const oneHourMs = 60 * 60 * 1000;
    const thirtyMinsMs = 30 * 60 * 1000;

    let finalDate = date;
    let finalTime = time;

    // Auto-correction logic
    if (timeDiff < oneHourMs) {
      const newDeliveryTime = new Date(now.getTime() + thirtyMinsMs);
      finalDate = newDeliveryTime.toISOString().split('T')[0];

      const hh = String(newDeliveryTime.getHours()).padStart(2, '0');
      const min = String(newDeliveryTime.getMinutes()).padStart(2, '0');
      finalTime = `${hh}:${min}`;

      alert(`Delivery time updated to ${finalTime} (minimum 30 mins preparation time).`);

      setDate(finalDate);
      setTime(finalTime);
    }

    const newOrder: Order = {
      id: Date.now().toString(),
      customerId: customer.id,
      customerName: customer.name,
      customerType: customer.type,
      items: [{
        productType,
        quantity: smartRound.roundedQty, // Use rounded
        calculatedCases: productType.includes('Bottle') ? calculateCases(productType, smartRound.roundedQty).cases : undefined, // Simplify logic
        pricePerUnit,
        totalPrice: productType.includes('Bottle') ? calculateCases(productType, smartRound.roundedQty).cases * pricePerUnit : totalPrice
      }],
      totalAmount: productType.includes('Bottle') ? calculateCases(productType, smartRound.roundedQty).cases * pricePerUnit : totalPrice,
      status: OrderStatus.PENDING,
      deliveryLocation: location,
      deliveryDate: finalDate,
      deliveryTime: finalTime,
      createdAt: new Date().toISOString(),
      emptyCansReturned: hasEmptyReturns ? emptyReturns : 0
    };

    await saveOrder(newOrder);
    alert('Order Placed Successfully!');
    setView('HISTORY');
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Welcome, {customer.name}</h1>
          {customer.type === 'RETAIL' && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Retail Customer</span>}
        </div>
        <button onClick={onLogout} className="text-sm text-red-500">Logout</button>
      </div>

      <div className="flex gap-2">
        <Button variant={view === 'ORDER' ? 'primary' : 'secondary'} onClick={() => setView('ORDER')} className="flex-1">Place Order</Button>
        <Button variant={view === 'HISTORY' ? 'primary' : 'secondary'} onClick={() => setView('HISTORY')} className="flex-1">History</Button>
      </div>

      {view === 'ORDER' && (
        <Card title="New Order">
          <Select
            label="Product"
            options={Object.values(ProductType).map(t => ({ value: t, label: t }))}
            value={productType}
            onChange={e => setProductType(e.target.value as ProductType)}
          />

          {productType === ProductType.CAN_20L && (
            <div className="mb-4">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={hasEmptyReturns} onChange={e => setHasEmptyReturns(e.target.checked)} className="rounded text-blue-600" />
                <span className="text-sm">I have Empty cans to return</span>
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
          )}

          <div className="mb-4">
            <Input
              label={productType.includes('Bottle') ? "Quantity (Number of bottles)" : "Quantity (Cans)"}
              type="number"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
            />
            {productType.includes('Bottle') && (
              <div className="mt-1 text-xs">
                <p className="text-blue-600">
                  Conversion: {calculateCases(productType, smartRound.roundedQty).display}
                </p>
                {smartRound.isRounded && (
                  <p className="text-[#4CAF50] font-bold">
                    Optimized to {smartRound.roundedQty} bottles (Includes {smartRound.extra} extra).
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              <button className="mb-3 p-2 bg-slate-200 rounded hover:bg-slate-300" title="Pick from Map">
                <MapPin size={20} />
              </button>
            </div>
            <div className="flex gap-2">
              <Input type="date" label="Date" className="flex-1" value={date} onChange={e => setDate(e.target.value)} />
              <Input type="time" label="Time" className="flex-1" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold">Total Amount</span>
              <span className="text-xl font-bold text-blue-600">₹{totalPrice}</span>
            </div>
            <Button className="w-full" onClick={handlePlaceOrder} disabled={!quantity || !location || !date || !time}>
              Place Your Order
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
                  <div key={idx} className="flex justify-between">
                    <span>{i.productType} x {i.quantity}</span>
                    <span>₹{i.totalPrice}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center font-bold text-slate-800">
                <span>Total</span>
                <span className="text-blue-600">₹{order.totalAmount}</span>
              </div>
            </div>
          ))}
          {orders.filter(o => o.customerId === customer.id).length === 0 && (
            <p className="text-center text-slate-400 py-8">No order history found.</p>
          )}
        </div>
      )}
    </div>
  );
};

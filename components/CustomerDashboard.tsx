import React, { useState } from 'react';
import { Card, Button, Input, Select } from './SharedComponents';
import { ProductType, Order, OrderItem, OrderStatus, Customer } from '../types';
import { PRODUCT_CONFIG } from '../constants';
import { calculateCases, saveOrder } from '../services/mockService';
import { MapPin, Clock } from 'lucide-react';

interface CustomerDashboardProps {
  customer: Customer;
  onLogout: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ customer, onLogout }) => {
  const [view, setView] = useState<'ORDER' | 'HISTORY'>('ORDER');
  
  // Order Form State
  const [productType, setProductType] = useState<ProductType>(ProductType.CAN_20L);
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState(customer.location);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [emptyReturns, setEmptyReturns] = useState(0);
  const [hasEmptyReturns, setHasEmptyReturns] = useState(false);

  // Pricing Logic
  const config = PRODUCT_CONFIG[productType];
  const pricePerUnit = customer.type === 'RETAIL' ? config.retailPrice : config.normalPrice;
  // Calculate total price. Note: If bottles are sold by case, pricePerUnit is per case.
  // Quantity for bottles is "bottles", but price is "case".
  // Let's assume pricePerUnit for bottles is PER CASE.
  
  const calculation = calculateCases(productType, quantity);
  let totalPrice = 0;
  
  if (productType.includes('Bottle')) {
    // Basic logic: Cost is based on full cases. Loose bottles might be pro-rated or rounded up.
    // Simpler: Price * (cases + (loose > 0 ? 1 : 0))
    const totalCasesToCharge = calculation.cases + (calculation.loose > 0 ? 1 : 0);
    totalPrice = totalCasesToCharge * pricePerUnit;
  } else {
    // Cans are unit price
    totalPrice = quantity * pricePerUnit;
  }

  const handlePlaceOrder = () => {
    const newOrder: Order = {
      id: Date.now().toString(),
      customerId: customer.id,
      customerName: customer.name,
      customerType: customer.type,
      items: [{
        productType,
        quantity,
        calculatedCases: productType.includes('Bottle') ? calculation.cases + (calculation.loose > 0 ? 1 : 0) : undefined,
        pricePerUnit,
        totalPrice
      }],
      totalAmount: totalPrice,
      status: OrderStatus.PENDING,
      deliveryLocation: location,
      deliveryDate: date,
      deliveryTime: time,
      createdAt: new Date().toISOString(),
      emptyCansReturned: hasEmptyReturns ? emptyReturns : 0
    };

    saveOrder(newOrder);
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
              options={Object.values(ProductType).map(t => ({value: t, label: t}))}
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
               <p className="text-xs text-blue-600 mt-1">
                 Conversion: {calculation.display} (Est. {calculation.cases + (calculation.loose > 0 ? 1 : 0)} Cases)
               </p>
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
        <div className="space-y-3">
          {/* Typically fetch from service based on customer ID */}
          <div className="text-center text-slate-500 py-4">
            Recent Orders History
          </div>
          {/* Reusing Admin Order List logic conceptually */}
        </div>
      )}
    </div>
  );
};

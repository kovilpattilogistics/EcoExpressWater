import React, { useEffect, useState } from 'react';
import { Package, Users, BarChart3, TrendingUp, AlertTriangle, ShoppingCart, ClipboardList, Truck } from 'lucide-react';
import { Card, StatusBadge } from './SharedComponents';
import { subscribeInventory, subscribeOrders, subscribeCustomers, calculateCases } from '../services/firestoreService';
import { InventoryItem, Order, Customer, ProductType, CanState } from '../types';
import { LOW_STOCK_THRESHOLD_CANS, LOW_STOCK_THRESHOLD_BOTTLES } from '../constants';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const unsubInv = subscribeInventory(setInventory);
    const unsubOrd = subscribeOrders(setOrders);
    const unsubCust = subscribeCustomers(setCustomers);

    return () => {
      unsubInv();
      unsubOrd();
      unsubCust();
    };
  }, []);

  // Calc Logic
  const pendingAmount = customers.reduce((acc, curr) => acc + (curr.pendingAmount || 0), 0);
  const upcomingOrders = orders.filter(o => !o.status.includes('Delivered') && !o.status.includes('picked')).slice(0, 5);

  const lowStockItems = inventory.filter(item => {
    if (item.type === ProductType.CAN_20L && item.canState === CanState.FILLED) {
      return item.quantity < LOW_STOCK_THRESHOLD_CANS;
    }
    if (item.type !== ProductType.CAN_20L) {
      return item.quantity < LOW_STOCK_THRESHOLD_BOTTLES;
    }
    return false;
  });

  const Tile = ({ title, icon: Icon, onClick, colorClass }: any) => (
    <div
      onClick={onClick}
      className={`p-6 rounded-xl shadow-md cursor-pointer transform transition hover:scale-105 ${colorClass} text-white flex flex-col items-center justify-center gap-2`}
    >
      <Icon size={32} />
      <span className="font-bold text-lg">{title}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Tile title="Dashboard" icon={TrendingUp} colorClass="bg-blue-500" onClick={() => { }} />
        <Tile title="Customers" icon={Users} colorClass="bg-green-500" onClick={() => onNavigate('customers')} />
        <Tile title="Orders" icon={ClipboardList} colorClass="bg-indigo-500" onClick={() => onNavigate('orders')} />
        <Tile title="Inventory" icon={Package} colorClass="bg-orange-500" onClick={() => onNavigate('inventory')} />
        <Tile title="Revenue" icon={BarChart3} colorClass="bg-purple-500" onClick={() => onNavigate('revenue')} />
        <Tile title="Create Order" icon={ShoppingCart} colorClass="bg-teal-500" onClick={() => onNavigate('create-order')} />
        <Tile title="Live Delivery" icon={Truck} colorClass="bg-blue-600" onClick={() => onNavigate('delivery-status')} />
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div
          onClick={() => onNavigate('inventory')}
          className="bg-red-50 border-l-4 border-red-500 p-4 cursor-pointer hover:bg-red-100 transition"
        >
          <div className="flex items-center">
            <AlertTriangle className="text-red-500 mr-2" />
            <p className="font-bold text-red-700">Low Stock Alert!</p>
          </div>
          <p className="text-sm text-red-600 mt-1">
            {lowStockItems.map(i => `${i.type} (${i.canState || 'Cases'}): ${i.quantity}`).join(', ')} - Restock needed.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Orders */}
        <Card title="Upcoming Orders" className="h-full">
          {upcomingOrders.length === 0 ? (
            <p className="text-slate-500 text-sm">No pending orders.</p>
          ) : (
            <div className="space-y-3">
              {upcomingOrders.map(order => (
                <div key={order.id} className="flex justify-between items-start border-b border-slate-100 pb-2 last:border-0" onClick={() => onNavigate('orders')}>
                  <div>
                    <p className="font-semibold text-sm">{order.customerName}</p>
                    <p className="text-xs text-slate-500">{order.deliveryDate} @ {order.deliveryTime}</p>
                    <p className="text-xs text-slate-600">
                      {order.items.map(i => `${i.productType} x${i.quantity}`).join(', ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">₹{order.totalAmount}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Pending Amounts */}
        <Card title="Pending Payments" className="h-full">
          <div className="mb-4">
            <p className="text-3xl font-bold text-slate-800">₹{pendingAmount}</p>
            <p className="text-sm text-slate-500">Total Outstanding</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Top Debtors</h4>
            {customers
              .filter(c => c.pendingAmount > 0)
              .sort((a, b) => b.pendingAmount - a.pendingAmount)
              .slice(0, 3)
              .map(c => (
                <div key={c.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-sm font-bold text-red-500">₹{c.pendingAmount}</span>
                </div>
              ))
            }
          </div>
        </Card>
      </div>

      {/* Stock Overview Widget */}
      <Card title="Stock Overview">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {inventory.map((item, idx) => (
            <div key={idx} className={`p-3 rounded-lg border ${item.quantity < (item.type === ProductType.CAN_20L ? LOW_STOCK_THRESHOLD_CANS : LOW_STOCK_THRESHOLD_BOTTLES) ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-xs text-slate-500">{item.type}</p>
              {item.canState && <p className="text-[10px] uppercase font-bold text-slate-400">{item.canState}</p>}
              <p className={`text-xl font-bold ${item.quantity < 5 ? 'text-red-600' : 'text-slate-800'}`}>
                {item.type.includes('Bottle') ? calculateCases(item.type, item.quantity).display : `${item.quantity} Cans`}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

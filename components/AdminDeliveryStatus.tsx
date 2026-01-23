import React, { useEffect, useState } from 'react';
import { Truck, Package, MapPin, ArrowLeft } from 'lucide-react';
import { Card, StatusBadge } from './SharedComponents';
import { subscribeOrders, subscribeVehicleInventory } from '../services/firestoreService';
import { Order, InventoryItem, OrderStatus, ProductType, CanState } from '../types';
import { DRIVER_CREDENTIALS } from '../constants';

interface AdminDeliveryStatusProps {
    onBack: () => void;
}

export const AdminDeliveryStatus: React.FC<AdminDeliveryStatusProps> = ({ onBack }) => {
    const [activeOrders, setActiveOrders] = useState<Order[]>([]);
    const [vehicleInventory, setVehicleInventory] = useState<InventoryItem[]>([]);
    const driverId = DRIVER_CREDENTIALS.username; // Hardcoded for now per requirements

    useEffect(() => {
        // Subscribe to Orders -> Filter for DISPATCHED / DELIVERED (Active Trip)
        const unsubOrders = subscribeOrders((allOrders) => {
            const active = allOrders.filter(o =>
                o.status === OrderStatus.DISPATCHED ||
                (o.status === OrderStatus.DELIVERED && isRecent(o.completedAt)) // Option to show recently delivered? For now, stick to Live Dispatched
            ).filter(o => o.status === OrderStatus.DISPATCHED);

            setActiveOrders(active);
        });

        // Subscribe to Vehicle Inventory
        const unsubInv = subscribeVehicleInventory(driverId, (items) => {
            setVehicleInventory(items);
        });

        return () => {
            unsubOrders();
            unsubInv();
        };
    }, []);

    // Helper to check if delivery was recent (last 1 hour) - if we want to show recents
    const isRecent = (dateStr?: string) => {
        if (!dateStr) return false;
        const diff = new Date().getTime() - new Date(dateStr).getTime();
        return diff < 3600000;
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                    <ArrowLeft />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="text-blue-500" /> Live Delivery Status
                    </h1>
                    <p className="text-sm text-slate-500">Monitoring Driver: {driverId}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Col: Vehicle Inventory */}
                <div className="lg:col-span-1 space-y-4">
                    <Card title="Vehicle Payload (Live)" icon={Package} className="border-t-4 border-blue-500 h-full">
                        {vehicleInventory.length === 0 || vehicleInventory.every(i => i.quantity === 0) ? (
                            <div className="text-center py-8 text-slate-400 italic">
                                Truck is empty.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {vehicleInventory.filter(i => i.quantity > 0).map((item, idx) => (
                                    <div key={idx} className={`flex justify-between items-center p-3 rounded-lg border ${item.type === ProductType.CAN_20L ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                                        <div>
                                            <p className="font-bold text-slate-700 text-sm">{item.type}</p>
                                            {item.canState && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${item.canState === CanState.FILLED ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {item.canState}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-bold text-slate-800">{item.quantity}</p>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold">
                                                {item.type.includes('Bottle') ? 'Cases' : 'Units'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right Col: Active Orders */}
                <div className="lg:col-span-2 space-y-4">
                    <Card title={`Active Deliveries (${activeOrders.length})`} icon={MapPin} className="border-t-4 border-green-500 h-full">
                        {activeOrders.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                <p className="text-slate-400 font-medium">No active deliveries in progress.</p>
                                <p className="text-xs text-slate-400 mt-1">Driver is idle or all orders delivered.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {activeOrders.map(order => (
                                    <div key={order.id} className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm hover:shadow-md transition">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-lg text-slate-800">{order.customerName}</p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                    <MapPin size={12} /> {order.deliveryLocation}
                                                </p>
                                            </div>
                                            <StatusBadge status={order.status} />
                                        </div>

                                        <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 mb-2">
                                            {order.items.map(i => `${i.productType} x${i.quantity}`).join(', ')}
                                        </div>

                                        <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-100">
                                            <span>Time: {order.deliveryTime}</span>
                                            <span className="font-bold text-slate-700">Amount: ₹{order.totalAmount}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

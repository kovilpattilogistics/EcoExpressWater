import React, { useState, useEffect } from 'react';
import { Card, Input, Button, StatusBadge } from './SharedComponents';
import { subscribeOrders, deleteOrder } from '../services/firestoreService';
import { Order, OrderStatus } from '../types';
import { Search, Trash2, Filter, AlertTriangle } from 'lucide-react';

export const AdminOrders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        const unsubscribe = subscribeOrders((updatedOrders) => {
            setOrders(updatedOrders);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (orderId: string) => {
        if (confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
            await deleteOrder(orderId);
            // orders update automatically
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchesSearch =
            o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.id.includes(searchTerm);

        const matchesStatus = filterStatus === 'ALL' || o.status === filterStatus;

        return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Order Management</h2>
                    <p className="text-slate-500">View and manage all orders</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <div className="relative flex-grow md:w-80">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 z-10" size={18} />
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            placeholder="Search Order ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 h-[38px]"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="ALL">All Status</option>
                        {Object.values(OrderStatus).map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid gap-4">
                {filteredOrders.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 bg-white rounded-xl shadow-sm">
                        <Filter size={48} className="mx-auto mb-4 opacity-50" />
                        No orders found matching your criteria.
                    </div>
                ) : filteredOrders.map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-grow">
                            <div className="flex justify-between md:justify-start items-center gap-3 mb-1">
                                <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">#{order.id.slice(-6)}</span>
                                <span className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg">{order.customerName}</h3>
                            <p className="text-sm text-slate-600 mb-1">
                                {order.items.map(i => `${i.productType} (${i.quantity})`).join(', ')}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-semibold text-slate-700">₹{order.totalAmount}</span>
                                <span>•</span>
                                <span>{order.deliveryLocation}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                            <StatusBadge status={order.status} />

                            <button
                                onClick={() => handleDelete(order.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Order"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

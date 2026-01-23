import React, { useState, useEffect } from 'react';
import { Card, Input, Button, StatusBadge } from './SharedComponents';
import { subscribeOrders, deleteOrder, subscribeCustomers } from '../services/firestoreService';
import { Order, OrderStatus, Customer } from '../types';
import { Search, Trash2, Filter, AlertTriangle } from 'lucide-react';

export const AdminOrders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Record<string, Customer>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        const unsubOrders = subscribeOrders((updatedOrders) => {
            setOrders(updatedOrders);
        });
        const unsubCustomers = subscribeCustomers((custs) => {
            const map: Record<string, Customer> = {};
            custs.forEach(c => map[c.id] = c);
            setCustomers(map);
        });
        return () => {
            unsubOrders();
            unsubCustomers();
        };
    }, []);

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

    const handleDeleteClick = (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        setDeleteConfirmationId(orderId);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmationId) return;

        try {
            await deleteOrder(deleteConfirmationId);
            setDeleteConfirmationId(null);
            if (selectedOrder?.id === deleteConfirmationId) {
                setSelectedOrder(null);
            }
        } catch (error) {
            alert("Failed to delete order. Please try again.");
            console.error(error);
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
                ) : filteredOrders.map(order => {
                    const cust = customers[order.customerId];
                    const pendingAmt = cust?.pendingAmount || 0;

                    return (
                        <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer active:scale-[0.99] duration-200"
                        >
                            <div className="flex-grow">
                                <div className="flex justify-between md:justify-start items-center gap-3 mb-1">
                                    <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">#{order.id.slice(-6)}</span>
                                    <span className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                                    {pendingAmt > 0 && (
                                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            ⚠️ PENDING: ₹{pendingAmt}
                                        </span>
                                    )}
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
                                    onClick={(e) => handleDeleteClick(e, order.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                                    title="Delete Order"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">Order Details</h3>
                                <p className="text-xs text-slate-500">#{selectedOrder.id}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">

                            {/* Customer Info */}
                            <div className="flex items-start gap-4">
                                <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                                    <div className="font-bold text-xl">{selectedOrder.customerName.charAt(0)}</div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-lg">{selectedOrder.customerName}</h4>
                                    <p className="text-sm text-slate-500">{selectedOrder.customerType} Customer</p>
                                    <div className="mt-2 text-sm text-slate-600 space-y-1">
                                        <p className="flex items-center gap-2">📍 {selectedOrder.deliveryLocation}</p>
                                        <p className="flex items-center gap-2">📅 {selectedOrder.deliveryDate} at {selectedOrder.deliveryTime}</p>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Items List */}
                            <div>
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Order Items</h5>
                                <div className="space-y-3">
                                    {selectedOrder.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <div className="font-medium text-slate-700">{item.productType}</div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-slate-500">x{item.quantity}</span>
                                                <span className="font-bold text-slate-900">₹{item.totalPrice}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <span className="font-bold text-slate-600">Total Amount</span>
                                <span className="text-xl font-black text-[#4CAF50]">₹{selectedOrder.totalAmount}</span>
                            </div>
                            {(selectedOrder.status === 'Delivered' || selectedOrder.status === 'Empty cans picked') && (
                                <div className="mt-2 space-y-1 text-right text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Paid</span>
                                        <span className="font-bold text-green-600">₹{selectedOrder.amountReceived || 0}</span>
                                    </div>
                                    {(selectedOrder.totalAmount - (selectedOrder.amountReceived || 0)) > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-red-500 font-bold">Pending</span>
                                            <span className="font-bold text-red-600">₹{selectedOrder.totalAmount - (selectedOrder.amountReceived || 0)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex gap-3 text-yellow-800 text-sm">
                            <AlertTriangle size={20} className="shrink-0" />
                            <p>Payment is collected upon delivery. Ensure driver confirms payment.</p>
                        </div>

                    </div>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {deleteConfirmationId && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn" onClick={() => setDeleteConfirmationId(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-6" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
                                <Trash2 className="h-8 w-8 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Order?</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Are you sure you want to delete this order? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <Button variant="secondary" onClick={() => setDeleteConfirmationId(null)} className="flex-1">Cancel</Button>
                                <Button variant="danger" onClick={confirmDelete} className="flex-1">Yes, Delete</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

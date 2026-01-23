import React, { useState, useEffect } from 'react';
import { Card, Input, Button, StatusBadge, Select } from './SharedComponents';
import { subscribeCustomers, saveCustomer, subscribeOrders, deleteCustomer } from '../services/firestoreService';
import { Customer, Order } from '../types';
import { Search, MapPin, Phone, User, ShoppingBag, ToggleLeft, ToggleRight, Plus, History, Key, Edit2, X, Trash2 } from 'lucide-react';
import { LocationPickerMap } from './LocationPickerMap';

export const AdminCustomers: React.FC = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [orders, setOrders] = useState<Order[]>([]);

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Form States
    const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
        name: '', phone: '', location: '', shopName: '', type: 'REGULAR',
        email: '', password: '', outstandingCans: 0, pendingAmount: 0
    });
    // For Map in Modal
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [tempLocation, setTempLocation] = useState({ lat: 9.1726, lng: 77.8808 });

    useEffect(() => {
        const unsubCust = subscribeCustomers(setCustomers);
        const unsubOrd = subscribeOrders(setOrders);
        return () => {
            unsubCust();
            unsubOrd();
        };
    }, []);

    const toggleType = (customer: Customer, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newType = customer.type === 'RETAIL' ? 'REGULAR' : 'RETAIL';
        // @ts-ignore
        const updatedCustomer: Customer = { ...customer, type: newType };
        saveCustomer(updatedCustomer); // async

        // Update local state
        setCustomers(customers.map(c => c.id === customer.id ? updatedCustomer : c));
        if (selectedCustomer && selectedCustomer.id === customer.id) {
            setSelectedCustomer(updatedCustomer);
        }
    };

    const handleSaveNewCustomer = () => {
        if (!newCustomer.name || !newCustomer.phone || !newCustomer.password) {
            alert("Name, Phone, and Password are required.");
            return;
        }

        const customerToSave: Customer = {
            id: `cust_${Date.now()}`,
            name: newCustomer.name,
            phone: newCustomer.phone,
            location: newCustomer.location || 'Unknown Location',
            shopName: newCustomer.shopName,
            type: newCustomer.type as any || 'REGULAR',
            email: newCustomer.email || newCustomer.phone, // Username defaults to phone/email
            password: newCustomer.password,
            pendingAmount: 0,
            outstandingCans: 0
        };

        saveCustomer(customerToSave);
        // setCustomers([...customers, customerToSave]); // Subscription handles this
        setShowAddModal(false);
        setNewCustomer({ name: '', phone: '', location: '', shopName: '', type: 'REGULAR', email: '', password: '' });
    };

    const handleUpdateCustomer = () => {
        if (selectedCustomer) {
            saveCustomer(selectedCustomer);
            setIsEditing(false);
            alert("Customer updated successfully!");
        }
    };

    const handleDeleteCustomer = () => {
        if (!selectedCustomer) return;

        if (confirm(`Are you sure you want to PERMANENTLY delete customer "${selectedCustomer.name}"? This cannot be undone.`)) {
            deleteCustomer(selectedCustomer.id);
            // setCustomers(...) handled by subscription
            setSelectedCustomer(null);
            setIsEditing(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const customerOrders = selectedCustomer ? orders.filter(o => o.customerId === selectedCustomer.id) : [];

    return (
        <div className="space-y-6 animate-fadeIn pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Customer Management</h2>
                    <p className="text-slate-500">View, edit and create customers</p>
                </div>
                <div className="flex bg-white rounded-lg shadow-sm">
                    <div className="relative w-full md:w-64 border-r border-slate-100">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            className="pl-10 mb-0 border-0 focus:ring-0"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => setShowAddModal(true)} icon={Plus}>Add New</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCustomers.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-400">
                        <User size={48} className="mx-auto mb-4 opacity-50" />
                        No customers found.
                    </div>
                ) : filteredCustomers.map(customer => (
                    <Card
                        key={customer.id}
                        className="hover:shadow-lg transition-shadow cursor-pointer group hover:border-blue-300"
                        onClick={() => setSelectedCustomer(customer)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition">
                                    {customer.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{customer.name}</h3>
                                    <button
                                        onClick={(e) => toggleType(customer, e)}
                                        className={`mt-1 text-xs px-2 py-0.5 rounded-full uppercase tracking-wide font-bold border transition-colors flex items-center gap-1 ${customer.type === 'RETAIL'
                                            ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
                                            : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
                                            }`}
                                    >
                                        {customer.type} {customer.type === 'RETAIL' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                    </button>
                                </div>
                            </div>
                            {customer.pendingAmount > 0 ? (
                                <div className="text-right">
                                    <p className="text-xs text-slate-400">Pending</p>
                                    <p className="font-bold text-red-500">₹{customer.pendingAmount}</p>
                                </div>
                            ) : (
                                <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded">Settled</span>
                            )}
                        </div>

                        <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex items-start gap-2">
                                <MapPin size={16} className="mt-0.5 text-slate-400 shrink-0" />
                                <span className="break-words line-clamp-2">{customer.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone size={16} className="text-slate-400" />
                                <span>{customer.phone}</span>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
                        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Add New Customer</h3>
                            <button onClick={() => setShowAddModal(false)}><X className="text-slate-400 hover:text-red-500" /></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Full Name *" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                                <Input label="Phone Number *" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="Username / Email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="Optional (defaults to phone)" />
                                <Input label="Password *" value={newCustomer.password} onChange={e => setNewCustomer({ ...newCustomer, password: e.target.value })} />
                            </div>
                            <Input label="Shop Name (Optional)" value={newCustomer.shopName} onChange={e => setNewCustomer({ ...newCustomer, shopName: e.target.value })} />

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Customer Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="ctype" checked={newCustomer.type === 'REGULAR'} onChange={() => setNewCustomer({ ...newCustomer, type: 'REGULAR' })} />
                                        <span>Regular</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="ctype" checked={newCustomer.type === 'RETAIL'} onChange={() => setNewCustomer({ ...newCustomer, type: 'RETAIL' })} />
                                        <span>Retail</span>
                                    </label>
                                </div>
                            </div>

                            <div className="relative">
                                <Input label="Delivery Location" value={newCustomer.location} onChange={e => setNewCustomer({ ...newCustomer, location: e.target.value })} />
                                <button onClick={() => setShowMapPicker(true)} className="absolute right-0 top-0 text-sm text-blue-600 font-bold hover:underline">Pick on Map</button>
                            </div>

                            {/* Map Picker Inline/Modal */}
                            {showMapPicker && (
                                <div className="h-64 w-full rounded-lg overflow-hidden border border-slate-300 relative">
                                    <button onClick={() => setShowMapPicker(false)} className="absolute z-[400] top-2 right-2 bg-white px-2 rounded shadow text-xs font-bold">Use this location</button>
                                    <LocationPickerMap
                                        initialLat={tempLocation.lat} initialLng={tempLocation.lng}
                                        onLocationSelect={(lat, lng) => {
                                            setTempLocation({ lat, lng });
                                            setNewCustomer({ ...newCustomer, location: `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}` });
                                        }}
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
                                <Button onClick={handleSaveNewCustomer}>Create Customer</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View/Edit Customer Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-fadeIn">
                        <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl shrink-0">
                                    {selectedCustomer.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-lg text-slate-800 break-words line-clamp-1">{selectedCustomer.name}</h3>
                                    <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button variant="secondary" onClick={() => setIsEditing(!isEditing)} icon={Edit2} className="h-8 text-xs flex-1 sm:flex-none justify-center">
                                    {isEditing ? 'Cancel' : 'Edit'}
                                </Button>
                                <Button
                                    onClick={handleDeleteCustomer}
                                    className="h-8 text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 shadow-none px-3 flex-1 sm:flex-none justify-center"
                                    icon={Trash2}
                                >
                                    Delete
                                </Button>
                                <button onClick={() => { setSelectedCustomer(null); setIsEditing(false); }} className="ml-2 sm:block hidden"><X className="text-slate-400 hover:text-red-500" /></button>
                                <button onClick={() => { setSelectedCustomer(null); setIsEditing(false); }} className="absolute top-4 right-4 sm:hidden"><X className="text-slate-400 hover:text-red-500" /></button>
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-6">
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                                    <p className="text-xs text-slate-400 uppercase font-bold">Pending Amount</p>
                                    <p className={`text-xl font-bold ${selectedCustomer.pendingAmount > 0 ? 'text-red-500' : 'text-green-500'}`}>₹{selectedCustomer.pendingAmount}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                                    <p className="text-xs text-slate-400 uppercase font-bold">Cans w/ Cust.</p>
                                    <p className="text-xl font-bold text-slate-700">{selectedCustomer.outstandingCans}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                                    <p className="text-xs text-slate-400 uppercase font-bold">Total Orders</p>
                                    <p className="text-xl font-bold text-blue-600">{customerOrders.length}</p>
                                </div>
                            </div>

                            {/* Edit Form or Read View */}
                            {isEditing ? (
                                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 mb-6 space-y-4">
                                    <h4 className="font-bold text-blue-800 mb-2">Edit Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Name" value={selectedCustomer.name} onChange={e => setSelectedCustomer({ ...selectedCustomer, name: e.target.value })} />
                                        <Input label="Phone" value={selectedCustomer.phone} onChange={e => setSelectedCustomer({ ...selectedCustomer, phone: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Username" value={selectedCustomer.email || ''} onChange={e => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })} />
                                        <Input label="Password" value={selectedCustomer.password || ''} onChange={e => setSelectedCustomer({ ...selectedCustomer, password: e.target.value })} />
                                    </div>
                                    <Input label="Location" value={selectedCustomer.location} onChange={e => setSelectedCustomer({ ...selectedCustomer, location: e.target.value })} />
                                    <Button className="w-full" onClick={handleUpdateCustomer}>Save Changes</Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                                    <div>
                                        <p className="text-slate-400 mb-1">Credentials</p>
                                        <div className="flex items-center gap-2 mb-2"><User size={14} /> <span className="font-mono bg-slate-100 px-1 rounded">{selectedCustomer.email || 'N/A'}</span></div>
                                        <div className="flex items-center gap-2"><Key size={14} /> <span className="font-mono bg-slate-100 px-1 rounded">{selectedCustomer.password || '••••••'}</span></div>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 mb-1">Details</p>
                                        <div className="flex items-center gap-2 mb-2"><MapPin size={14} /> <span>{selectedCustomer.location}</span></div>
                                        <div className="flex items-center gap-2"><ShoppingBag size={14} /> <span>{selectedCustomer.shopName || 'N/A'}</span></div>
                                    </div>
                                </div>
                            )}

                            {/* Order History */}
                            <div>
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History size={18} /> Order History</h4>
                                <div className="space-y-3">
                                    {customerOrders.length === 0 ? <p className="text-slate-400 italic">No orders yet.</p> :
                                        customerOrders.sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime()).map(order => (
                                            <div key={order.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg hover:bg-slate-50">
                                                <div>
                                                    <p className="font-bold text-slate-700">#{order.id.slice(-6)} <span className="text-slate-400 font-normal">• {order.deliveryDate}</span></p>
                                                    <p className="text-xs text-slate-500">{order.items.map(i => `${i.productType} x${i.quantity}`).join(', ')}</p>
                                                </div>
                                                <div className="text-right">
                                                    <StatusBadge status={order.status} className="mb-1" />
                                                    <p className="text-sm font-bold">₹{order.totalAmount}</p>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

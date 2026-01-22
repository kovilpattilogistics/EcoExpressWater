import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Select } from './SharedComponents';
import { ProductType, OrderStatus, Customer } from '../types';
import { calculateCases, saveOrder, subscribeCustomers } from '../services/firestoreService';
import { PRODUCT_CONFIG } from '../constants';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LocationPickerMap } from './LocationPickerMap';

export const AdminCreateOrder: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');

    // Form State
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', location: '', lat: 9.1726, lng: 77.8808 });
    const [items, setItems] = useState<{ type: ProductType, quantity: number }[]>([
        { type: ProductType.CAN_20L, quantity: 1 }
    ]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('09:00');

    const [showMap, setShowMap] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const unsub = subscribeCustomers(setCustomers);
        return () => unsub();
    }, []);

    const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const custId = e.target.value;
        setSelectedCustomerId(custId);

        if (custId) {
            const cust = customers.find(c => c.id === custId);
            if (cust) {
                setCustomerInfo({
                    name: cust.name,
                    phone: cust.phone,
                    location: cust.location,
                    lat: 9.1726, // In real app, parse from location string or store separately
                    lng: 77.8808
                });
                // Try to parse basic lat/lng from location string if it matches format "Latitude, Longitude" or "GPS: lat, lng"
                // Only simplistic parsing for now
            }
        } else {
            setCustomerInfo({ name: '', phone: '', location: '', lat: 9.1726, lng: 77.8808 });
        }
    };

    // Item helpers
    const addItem = () => setItems([...items, { type: ProductType.CAN_20L, quantity: 1 }]);
    const removeItem = (index: number) => {
        if (items.length > 1) {
            const newItems = [...items];
            newItems.splice(index, 1);
            setItems(newItems);
        }
    };
    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        if (field === 'type') newItems[index].type = value;
        if (field === 'quantity') newItems[index].quantity = Number(value);
        setItems(newItems);
    };

    const handlePublish = async () => {
        if (!customerInfo.name || !customerInfo.phone) {
            alert("Please enter customer details");
            return;
        }

        if (items.length === 0 || items.some(i => i.quantity <= 0)) {
            alert("Please add at least one valid item");
            return;
        }

        const orderItems = items.map(item => {
            const config = PRODUCT_CONFIG[item.type];
            const calculation = calculateCases(item.type, item.quantity);

            // Dynamic Pricing Logic
            const customer = customers.find(c => c.id === selectedCustomerId);
            const isRetail = customer?.type === 'RETAIL';
            const pricePerUnit = isRetail ? config.retailPrice : config.normalPrice;

            let itemTotal = 0;
            if (item.type.includes('Bottle')) {
                itemTotal = (calculation.cases + (calculation.loose > 0 ? 1 : 0)) * pricePerUnit;
            } else {
                itemTotal = item.quantity * pricePerUnit;
            }

            return {
                productType: item.type,
                quantity: item.quantity,
                calculatedCases: item.type.includes('Bottle') ? calculation.cases + (calculation.loose > 0 ? 1 : 0) : null,
                pricePerUnit,
                totalPrice: itemTotal
            };
        });

        const grandTotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

        await saveOrder({
            id: `ord_${Date.now()}`,
            customerId: selectedCustomerId || `new_${Date.now()}`, // Link to existing if selected
            customerName: customerInfo.name,
            customerType: selectedCustomerId ? 'REGULAR' : 'PUBLIC', // Assume regular if selected from list
            items: orderItems,
            totalAmount: grandTotal,
            status: OrderStatus.PENDING,
            deliveryLocation: customerInfo.location,
            deliveryDate: date,
            deliveryTime: time,
            createdAt: new Date().toISOString()
        });

        setIsSuccess(true);
    };

    if (isSuccess) {
        return (
            <div className="text-center py-12 animate-fadeIn bg-white rounded-xl shadow-lg p-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-green-500 text-3xl">✓</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Order Published!</h2>
                <p className="text-slate-500 mb-6">The order has been created and is now visible to drivers.</p>
                <div className="flex gap-4 justify-center">
                    <Button onClick={onBack} variant="secondary">Back to Dashboard</Button>
                    <Button onClick={() => { setIsSuccess(false); setCustomerInfo({ name: '', phone: '', location: '', lat: 9.1726, lng: 77.8808 }); setSelectedCustomerId(''); }}>Create Another</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4 mb-2">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-800 font-bold">← Back</button>
                <h1 className="text-2xl font-bold text-slate-800">Create New Order</h1>
            </div>

            <Card title="Customer Details">
                <Select
                    label="Select Existing Customer"
                    options={[{ value: '', label: '-- Select Customer --' }, ...customers.map(c => ({ value: c.id, label: `${c.name} (${c.phone})` }))]}
                    value={selectedCustomerId}
                    onChange={handleCustomerSelect}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <Input label="Customer Name" value={customerInfo.name} onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })} />
                    <Input label="Phone Number" value={customerInfo.phone} onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })} />
                </div>

                <div className="relative">
                    <Input
                        label="Delivery Location"
                        value={customerInfo.location}
                        onChange={e => setCustomerInfo({ ...customerInfo, location: e.target.value })}
                        placeholder="Select from Map or type address"
                    />
                    <button
                        onClick={() => setShowMap(true)}
                        className="absolute right-2 top-8 text-[#4CAF50] hover:bg-green-50 p-1 px-3 rounded text-sm font-bold border border-green-200"
                    >
                        📍 Pick on Map
                    </button>
                </div>
            </Card>

            <Card title="Order Items">
                <div className="space-y-4 mb-4">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-end bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="flex-grow">
                                <Select
                                    label={idx === 0 ? "Product" : ""}
                                    options={Object.values(ProductType).map(t => ({ value: t, label: t }))}
                                    value={item.type}
                                    onChange={e => updateItem(idx, 'type', e.target.value)}
                                    className="mb-0"
                                />
                            </div>
                            <div className="w-24">
                                <Input
                                    label={idx === 0 ? "Qty" : ""}
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                    className="mb-0"
                                />
                            </div>
                            {items.length > 1 && (
                                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 pb-2">✕</button>
                            )}
                        </div>
                    ))}
                </div>
                <Button variant="secondary" onClick={addItem} className="w-full text-sm">+ Add Item</Button>

                <div className="grid grid-cols-2 gap-4 mt-6 border-t border-slate-100 pt-4">
                    <Input type="date" label="Delivery Date" value={date} onChange={e => setDate(e.target.value)} />
                    <Input type="time" label="Time" value={time} onChange={e => setTime(e.target.value)} />
                </div>
            </Card>

            <Button onClick={handlePublish} className="w-full py-4 text-lg shadow-xl shadow-green-100">Publish Order</Button>

            {/* Map Modal */}
            {showMap && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold">Select Location</h3>
                            <button onClick={() => setShowMap(false)}>✕</button>
                        </div>
                        <div className="flex-grow relative">
                            <LocationPickerMap
                                initialLat={customerInfo.lat}
                                initialLng={customerInfo.lng}
                                onLocationSelect={(lat, lng) => {
                                    setCustomerInfo({
                                        ...customerInfo,
                                        lat, lng,
                                        location: `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
                                    });
                                }}
                            />
                        </div>
                        <div className="p-4 border-t flex justify-end">
                            <Button onClick={() => setShowMap(false)}>Confirm</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

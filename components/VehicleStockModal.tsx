import React, { useState, useEffect } from 'react';
import { Button, Input } from './SharedComponents';
import { ProductType, InventoryItem, CanState } from '../types';
import { PRODUCT_CONFIG } from '../constants';
import { updateVehicleInventory, getVehicleInventory } from '../services/mockService';
import { Save, Plus, Minus, X } from 'lucide-react';

interface VehicleStockModalProps {
    driverId: string;
    onClose: () => void;
    onUpdate: () => void;
}

export const VehicleStockModal: React.FC<VehicleStockModalProps> = ({ driverId, onClose, onUpdate }) => {
    const [items, setItems] = useState<InventoryItem[]>([]);

    useEffect(() => {
        // Load current stock or initialize with 0 for all products
        const currentStock = getVehicleInventory(driverId);

        // Ensure all products are represented
        const allProducts: InventoryItem[] = [];

        // 1. Cans (Filled & Empty)
        const filledCan = currentStock.find(i => i.type === ProductType.CAN_20L && i.canState === CanState.FILLED);
        allProducts.push({ type: ProductType.CAN_20L, canState: CanState.FILLED, quantity: filledCan?.quantity || 0 });

        const emptyCan = currentStock.find(i => i.type === ProductType.CAN_20L && i.canState === CanState.EMPTY);
        allProducts.push({ type: ProductType.CAN_20L, canState: CanState.EMPTY, quantity: emptyCan?.quantity || 0 });

        // 2. Bottles
        Object.values(ProductType).forEach(type => {
            if (type !== ProductType.CAN_20L) {
                const stock = currentStock.find(i => i.type === type);
                allProducts.push({ type, quantity: stock?.quantity || 0 });
            }
        });

        setItems(allProducts);
    }, [driverId]);

    const handleQuantityChange = (index: number, delta: number) => {
        const newItems = [...items];
        const newQty = Math.max(0, newItems[index].quantity + delta);
        newItems[index].quantity = newQty;
        setItems(newItems);
    };

    const handleSave = () => {
        // Save each item
        items.forEach(item => {
            updateVehicleInventory(driverId, item, true); // true = overwrite/set exact value
        });
        onUpdate();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Manage Vehicle Inventory</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X /></button>
                </div>

                <div className="p-4 overflow-y-auto space-y-4">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div>
                                <p className="font-bold text-slate-700">{item.type}</p>
                                {item.canState && (
                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${item.canState === CanState.FILLED ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {item.canState}
                                    </span>
                                )}
                                {!item.canState && <span className="text-[10px] text-slate-400 uppercase font-bold">Cases</span>}
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleQuantityChange(idx, -1)}
                                    className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                                >
                                    <Minus size={16} />
                                </button>
                                <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                                <button
                                    onClick={() => handleQuantityChange(idx, 1)}
                                    className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-green-50 hover:text-green-500 hover:border-green-200"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <Button onClick={handleSave} className="w-full" icon={Save}>Save & Update Stock</Button>
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { Button } from './SharedComponents';
import { ProductType, InventoryItem, CanState } from '../types';
import { updateVehicleInventory, getVehicleInventory, updateInventory } from '../services/firestoreService'; // Added updateInventory
import { Save, X, ArrowDownCircle, ArrowUpCircle, RotateCcw } from 'lucide-react';

interface VehicleStockModalProps {
    driverId: string;
    onClose: () => void;
    onUpdate: () => void;
}

type ModalMode = 'MENU' | 'LOAD' | 'UNLOAD';

export const VehicleStockModal: React.FC<VehicleStockModalProps> = ({ driverId, onClose, onUpdate }) => {
    const [mode, setMode] = useState<ModalMode>('MENU');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Initialize blank items with 0 quantity for inputs
    useEffect(() => {
        const initItems = () => {
            const allProducts: InventoryItem[] = [];
            // 1. Cans
            allProducts.push({ type: ProductType.CAN_20L, canState: CanState.FILLED, quantity: 0 });
            allProducts.push({ type: ProductType.CAN_20L, canState: CanState.EMPTY, quantity: 0 });
            // 2. Bottles
            Object.values(ProductType).forEach(type => {
                if (type !== ProductType.CAN_20L) {
                    allProducts.push({ type, quantity: 0 });
                }
            });
            setItems(allProducts);
        };

        if (mode !== 'MENU') {
            initItems();
        }
    }, [mode]);

    const handleQuantityChange = (index: number, value: string) => {
        const newItems = [...items];
        let newQty = parseInt(value, 10);
        if (isNaN(newQty)) newQty = 0;
        newItems[index].quantity = Math.max(0, newQty);
        setItems(newItems);
    };

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            const itemsToProcess = items.filter(i => i.quantity > 0);

            if (itemsToProcess.length === 0) {
                alert("Please enter quantities.");
                setIsLoading(false);
                return;
            }

            if (mode === 'LOAD') {
                // LOAD: Take from Main Inv -> Add to Vehicle
                for (const item of itemsToProcess) {
                    // deduct from main (isAddition=false) - careful, updateInventory handles addition/subtraction? 
                    // updateInventory(item, true/false) -> true=add, false=subtract
                    await updateInventory(item, false);
                }
                // Add to Vehicle
                await updateVehicleInventory(driverId, itemsToProcess, 'INCREMENT');
            } else if (mode === 'UNLOAD') {
                // UNLOAD: Remove from Vehicle -> Add to Main Inv
                for (const item of itemsToProcess) {
                    await updateInventory(item, true); // Add back to main
                }
                // Remove from Vehicle (using negative increment effectively)
                // Actually updateVehicleInventory handles INCREMENT. We need DECREMENT or pass negative values.
                // Let's pass negative quantities to INCREMENT mode
                const negativeItems = itemsToProcess.map(i => ({ ...i, quantity: -i.quantity }));
                await updateVehicleInventory(driverId, negativeItems, 'INCREMENT');
            }

            onUpdate();
            onClose();
        } catch (e) {
            console.error("Operation failed", e);
            alert("Failed to update stock. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">
                        {mode === 'MENU' ? 'Manage Vehicle Inventory' :
                            mode === 'LOAD' ? 'Load Stock (From Warehouse)' : 'Unload Stock (To Warehouse)'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X /></button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {mode === 'MENU' ? (
                        <div className="space-y-4">
                            <button
                                onClick={() => setMode('LOAD')}
                                className="w-full flex items-center p-4 gap-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition shadow-sm group text-left"
                            >
                                <div className="bg-blue-500 text-white p-3 rounded-full group-hover:scale-110 transition">
                                    <ArrowDownCircle size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-900">Load Stock</h4>
                                    <p className="text-xs text-blue-600">Take stock from Warehouse to Truck</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setMode('UNLOAD')}
                                className="w-full flex items-center p-4 gap-4 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition shadow-sm group text-left"
                            >
                                <div className="bg-orange-500 text-white p-3 rounded-full group-hover:scale-110 transition">
                                    <ArrowUpCircle size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-orange-900">Unload Remaining</h4>
                                    <p className="text-xs text-orange-600">Return stock from Truck to Warehouse</p>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className={`text-xs p-2 rounded mb-4 ${mode === 'LOAD' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                                Enter quantities to {mode === 'LOAD' ? 'load onto' : 'unload from'} the vehicle.
                            </div>
                            {items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                                    <span className="text-sm font-medium text-slate-700">
                                        {item.type} {item.canState ? `(${item.canState})` : ''}
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        className="w-20 p-1 text-center border rounded outline-none focus:ring-2 focus:ring-blue-200 font-bold"
                                        value={item.quantity === 0 ? '' : item.quantity}
                                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
                    {mode !== 'MENU' && (
                        <Button variant="secondary" onClick={() => setMode('MENU')} icon={RotateCcw}>Back</Button>
                    )}
                    {mode === 'MENU' ? (
                        <Button variant="secondary" onClick={onClose} className="w-full">Close</Button>
                    ) : (
                        <Button onClick={handleConfirm} isLoading={isLoading} className="flex-1" icon={Save}>
                            Confirm {mode === 'LOAD' ? 'Load' : 'Unload'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

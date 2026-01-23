import React, { useState, useEffect } from 'react';
import { Button } from './SharedComponents';
import { ProductType, InventoryItem, CanState } from '../types';
import { updateVehicleInventory, getVehicleInventory, updateInventory, subscribeInventory } from '../services/firestoreService';
import { PRODUCT_CONFIG } from '../constants';
import { Save, X, ArrowDownCircle, ArrowUpCircle, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';

interface VehicleStockModalProps {
    driverId: string;
    onClose: () => void;
    onUpdate: () => void;
    recommendedStock?: InventoryItem[];
}

type ModalMode = 'MENU' | 'LOAD' | 'UNLOAD';

export const VehicleStockModal: React.FC<VehicleStockModalProps> = ({ driverId, onClose, onUpdate, recommendedStock = [] }) => {
    const [mode, setMode] = useState<ModalMode>('MENU');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [mainInventory, setMainInventory] = useState<InventoryItem[]>([]);
    const [currentVehicleStock, setCurrentVehicleStock] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to Main Inventory for Validation & Fetch Vehicle Stock for Unload
    useEffect(() => {
        const unsub = subscribeInventory(setMainInventory);

        // Fetch current vehicle stock for Unload suggestions
        getVehicleInventory(driverId).then(setCurrentVehicleStock);

        return () => unsub();
    }, [driverId]);

    // Initialize items based on Mode
    useEffect(() => {
        const initItems = () => {
            const allProducts: InventoryItem[] = [];
            const template = (type: ProductType, state?: CanState) => {
                // UNLOAD MODE: Pre-fill with current stock
                if (mode === 'UNLOAD') {
                    const existing = currentVehicleStock.find(i => i.type === type && i.canState === state);
                    // If bottle, convert Units -> Cases for display
                    let qty = existing?.quantity || 0;
                    if (type !== ProductType.CAN_20L) {
                        const config = PRODUCT_CONFIG[type];
                        const perCase = config?.itemsPerCase || 1;
                        qty = Math.floor(qty / perCase);
                    }
                    return { type, canState: state, quantity: qty };
                }
                return { type, canState: state, quantity: 0 };
            };

            // 1. Cans
            allProducts.push(template(ProductType.CAN_20L, CanState.FILLED));
            allProducts.push(template(ProductType.CAN_20L, CanState.EMPTY));
            // 2. Bottles
            Object.values(ProductType).forEach(type => {
                if (type !== ProductType.CAN_20L) {
                    allProducts.push(template(type));
                }
            });
            setItems(allProducts);
        };

        if (mode !== 'MENU') {
            initItems();
            setError(null);
        }
    }, [mode, currentVehicleStock]);

    const handleQuantityChange = (index: number, value: string) => {
        const newItems = [...items];
        let newQty = parseInt(value, 10);
        if (isNaN(newQty)) newQty = 0;
        newItems[index].quantity = Math.max(0, newQty);
        setItems(newItems);
        setError(null);
    };

    const handleFillRecommended = () => {
        // Auto-fill inputs from recommendedStock
        const newItems = items.map(item => {
            const rec = recommendedStock.find(r => r.type === item.type && r.canState === item.canState);
            let qty = rec?.quantity || 0;
            // Convert Units -> Cases for Bottles
            if (item.type !== ProductType.CAN_20L) {
                const perCase = PRODUCT_CONFIG[item.type]?.itemsPerCase || 1;
                qty = Math.ceil(qty / perCase); // Round up to nearest case to ensure full coverage
            }
            return { ...item, quantity: qty };
        });
        setItems(newItems);
    };

    const handleConfirm = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const inputsToProcess = items.filter(i => i.quantity > 0);

            if (inputsToProcess.length === 0) {
                setError("Please enter at least one quantity.");
                setIsLoading(false);
                return;
            }

            if (mode === 'LOAD') {
                // Ensure Inventory Loaded
                if (mainInventory.length === 0) {
                    alert("Inventory data is syncing. Please try again in a moment.");
                    setIsLoading(false);
                    return;
                }
            }

            // Prepare items with converted units (Case -> Units)
            const itemsToProcess = inputsToProcess.map(item => {
                const config = PRODUCT_CONFIG[item.type];
                const isBottle = item.type !== ProductType.CAN_20L;

                // If bottle, input is Cases. Convert to Units.
                // If Can (itemsPerCase=1), input is Units.
                const units = isBottle
                    ? item.quantity * (config?.itemsPerCase || 1)
                    : item.quantity;

                return {
                    ...item,
                    quantity: units,
                    originalInput: item.quantity // For error messaging
                };
            });

            if (mode === 'LOAD') {
                // VALIDATION: Check Main Inventory
                for (const item of itemsToProcess) {
                    const stockItem = mainInventory.find(i =>
                        i.type === item.type &&
                        (i.canState === item.canState || (!i.canState && !item.canState))
                    );
                    const available = stockItem?.quantity || 0;

                    if (item.quantity > available) {
                        const config = PRODUCT_CONFIG[item.type];
                        const unitLabel = item.type.includes('Bottle') ? 'Cases' : 'Cans';
                        const requested = item.originalInput;
                        const availableDisplay = item.type.includes('Bottle')
                            ? Math.floor(available / (config?.itemsPerCase || 1)) // Show available in Cases
                            : available;

                        setError(`Insufficient Stock for ${item.type}. Requested: ${requested} ${unitLabel}, Available: ${availableDisplay} ${unitLabel}.`);
                        setIsLoading(false);
                        return;
                    }
                }

                // EXECUTION: Load (Main -> Vehicle)
                for (const item of itemsToProcess) {
                    await updateInventory(item, false); // Subtract from Main
                }
                await updateVehicleInventory(driverId, itemsToProcess, 'INCREMENT');
            } else if (mode === 'UNLOAD') {
                // EXECUTION: Unload (Vehicle -> Main)
                for (const item of itemsToProcess) {
                    await updateInventory(item, true); // Add to Main Inv
                }
                // Decrement Vehicle Logic (Add negative quantities)
                const negativeItems = itemsToProcess.map(i => ({ ...i, quantity: -i.quantity }));
                await updateVehicleInventory(driverId, negativeItems, 'INCREMENT');
            }

            onUpdate();
            onClose();
        } catch (e) {
            console.error("Operation failed", e);
            setError("Failed to update stock. Please try again.");
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
                            mode === 'LOAD' ? 'Load Stock' : 'Unload Stock'}
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
                                    {recommendedStock.length > 0 && (
                                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                                            <CheckCircle size={10} /> Recommended avail.
                                        </div>
                                    )}
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
                            {/* Header / Info Section */}
                            {mode === 'LOAD' && recommendedStock.length > 0 && (
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs font-bold text-blue-800">Based on Selected Orders:</p>
                                        <button onClick={handleFillRecommended} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 font-bold shadow-sm">
                                            Auto-Fill
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {recommendedStock.map((rec, i) => {
                                            const unit = rec.type === ProductType.CAN_20L ? 'Cans' : 'Bottles'; // Raw units derived from Order
                                            return (
                                                <span key={i} className="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded">
                                                    {rec.type}: {rec.quantity} {unit}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {mode === 'UNLOAD' && (
                                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-2">
                                    <p className="text-xs font-bold text-orange-800 flex items-center gap-2">
                                        <AlertTriangle size={12} />
                                        Auto-filled with current Vehicle Stock.
                                    </p>
                                    <p className="text-[10px] text-orange-600 mt-1">Verify amounts before confirming unload.</p>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm mb-4 animate-shake">
                                    {error}
                                </div>
                            )}

                            {items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100 hover:border-blue-300 transition-colors">
                                    <span className="text-sm font-medium text-slate-700">
                                        {item.type} {item.canState ? `(${item.canState})` : ''}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right mr-2">
                                            {mode === 'LOAD' && (() => {
                                                const config = PRODUCT_CONFIG[item.type];
                                                if (!config) return null;

                                                const stockItem = mainInventory.find(i =>
                                                    i.type === item.type &&
                                                    (i.canState === item.canState || (!i.canState && !item.canState))
                                                );
                                                const rawAvailable = stockItem?.quantity || 0;
                                                const isBottle = item.type !== ProductType.CAN_20L;

                                                // itemsPerCase might be undefined for Cans, default to 1
                                                const perCase = config.itemsPerCase || 1;

                                                // Display in Cases for bottles, Units for cans
                                                const displayAvailable = isBottle
                                                    ? Math.floor(rawAvailable / perCase)
                                                    : rawAvailable;

                                                return (
                                                    <span className={`text-[10px] font-bold ${displayAvailable === 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                        Max: {displayAvailable}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className="w-20 p-2 text-center border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                                            value={item.quantity === 0 ? '' : item.quantity}
                                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                        />
                                        <span className="text-[10px] text-slate-400 uppercase font-bold w-8">
                                            {item.type.includes('Bottle') ? 'Cases' : 'Cans'}
                                        </span>
                                    </div>
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

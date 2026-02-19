import React, { useState, useEffect } from 'react';
import { Button } from './SharedComponents';
import { ProductType, Order, OrderStatus } from '../types';
import { calculateCases, saveOrder, findCustomerByPhone, saveCustomer, calculateSmartRounding } from '../services/firestoreService';
import { PRODUCT_CONFIG } from '../constants';

import { Navigation, Info, ShieldCheck, MapPin, ShoppingCart } from 'lucide-react';

import { LocationPickerMap } from './LocationPickerMap';

const PriceListModal: React.FC<{ onClose: () => void, t: any }> = ({ onClose, t }) => (
  <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg w-full max-w-sm overflow-hidden flex flex-col border border-white/50">
      <div className="p-4 border-b border-green-100 flex justify-between items-center bg-green-50/50">
        <h3 className="font-bold text-lg text-green-900">{t.priceListTitle || "Price List & Case Sizes"}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-red-500 text-2xl">×</button>
      </div>
      <div className="p-0 overflow-y-auto max-h-[60vh]">
        <table className="w-full text-sm text-left">
          <thead className="bg-green-50/30 text-green-700 font-medium">
            <tr>
              <th className="p-3">{t.product || "Product"}</th>
              <th className="p-3 text-right">{t.pricePerCase || "Per Case"}</th>
              <th className="p-3 text-right">{t.caseSize || "Case Size"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-green-50">
            {Object.values(PRODUCT_CONFIG).map((product) => (
              <tr key={product.type} className="">
                <td className="p-3 font-medium text-slate-800">{product.type.replace(' Bottle', '').replace(' Can', '')}</td>
                <td className="p-3 text-right font-bold text-green-700">₹{product.normalPrice}</td>
                <td className="p-3 text-right text-slate-500">{product.itemsPerCase} {t.unitsPerCase || "units/case"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export const PublicOrder: React.FC<{ t?: any }> = ({ t = {} }) => {
  useEffect(() => {
    console.log("🚀 APP VERSION: v12 (Address Separation + Pay on Delivery Msg) 🚀");
  }, []);

  const [isSuccess, setIsSuccess] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', shop: '', location: '' });
  // Store GPS coordinates independently
  const [gpsCoords, setGpsCoords] = useState<{ lat: number, lng: number } | null>(null);

  const [showMap, setShowMap] = useState(false);
  const [showPriceList, setShowPriceList] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Quantities state (Stores RAW user input)
  const [quantities, setQuantities] = useState<Record<string, string>>({
    [ProductType.CAN_20L]: "",
    [ProductType.BOTTLE_1L]: "",
    [ProductType.BOTTLE_300ML]: "",
    [ProductType.BOTTLE_500ML]: "",
    [ProductType.BOTTLE_2L]: "",
  });

  const updateQuantity = (type: string, val: string) => {
    // Prevent negative inputs
    if (val.includes('-')) return;
    const num = parseInt(val);
    if (!isNaN(num) && num < 0) return;

    setQuantities(prev => ({ ...prev, [type]: val }));
  };

  const hasItems = Object.values(quantities).some(v => parseInt(v || "0") > 0);

  // Initial Date/Time Defaults
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });

  const [networkStatus, setNetworkStatus] = useState<{ isOnline: boolean, firebaseConfigured: boolean } | null>(null);

  useEffect(() => {
    const hasKeys = !!import.meta.env.VITE_FIREBASE_API_KEY;
    const isOnline = navigator.onLine;
    setNetworkStatus({ isOnline, firebaseConfigured: hasKeys });
    const handleOnline = () => setNetworkStatus(prev => ({ ...prev!, isOnline: true }));
    const handleOffline = () => setNetworkStatus(prev => ({ ...prev!, isOnline: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      // Set GPS coords but DO NOT overwrite the manual address text
      setGpsCoords({ lat: latitude, lng: longitude });
      setIsLocating(false);
    }, (error) => {
      console.error("Error", error); alert("Unable to get location"); setIsLocating(false);
    }, { enableHighAccuracy: true });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handlePlaceOrder = async () => {
    if (!date || !time) { alert("Please select a Delivery Date and Time."); return; }
    if (!hasItems) { alert("Please select at least one product."); return; }

    // Validate: Either manual text OR GPS must be present (preferably manual text for clarity)
    if (!customerInfo.location && !gpsCoords) {
      alert(t.fillWarning || "Please fill in your Name, Phone and Location.");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const selectedDateTime = new Date(`${date}T${time}`);
      const oneHourMs = 60 * 60 * 1000;
      const thirtyMinsMs = 30 * 60 * 1000;
      let finalDate = date;
      let finalTime = time;
      if (selectedDateTime.getTime() - now.getTime() < oneHourMs) {
        const newDeliveryTime = new Date(now.getTime() + thirtyMinsMs);
        finalDate = newDeliveryTime.toISOString().split('T')[0];
        finalTime = `${String(newDeliveryTime.getHours()).padStart(2, '0')}:${String(newDeliveryTime.getMinutes()).padStart(2, '0')}`;
        setDate(finalDate); setTime(finalTime);
      }

      // Construct final location string
      let finalLocation = customerInfo.location;
      if (gpsCoords) {
        if (finalLocation) finalLocation += ` (GPS: ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)})`;
        else finalLocation = `GPS: ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}`;
      }

      let customerId = `pub_${Date.now()}`;
      let customerType: 'REGULAR' | 'RETAIL' | 'PUBLIC' = 'REGULAR';
      function withTimeout<T>(promise: Promise<T>, ms: number = 10000): Promise<T> {
        return Promise.race([promise, new Promise<T>((_, r) => setTimeout(() => r(new Error("Timeout")), ms))]);
      }
      const existingCustomer = await withTimeout(findCustomerByPhone(customerInfo.phone), 30000).catch(() => null);
      if (existingCustomer) {
        customerId = existingCustomer.id;
        customerType = existingCustomer.type;
      } else {
        await withTimeout(saveCustomer({
          id: customerId, name: customerInfo.name, phone: customerInfo.phone, type: 'REGULAR',
          location: finalLocation, shopName: customerInfo.shop, pendingAmount: 0, outstandingCans: 0,
          email: customerInfo.phone, password: customerInfo.phone
        }), 30000);
      }

      const orderItems = Object.entries(quantities)
        .filter(([_, val]) => parseInt(val || "0") > 0)
        .map(([typeStr, valStr]) => {
          const type = typeStr as ProductType;
          const rawQty = parseInt(valStr || "0");
          const config = PRODUCT_CONFIG[type];

          const { roundedQty, isRounded } = calculateSmartRounding(type, rawQty);
          const activeQty = roundedQty;

          const calculation = calculateCases(type, activeQty);
          const pricePerUnit = customerType === 'RETAIL' ? config.retailPrice : config.normalPrice;
          let itemTotal = type.includes('Bottle')
            ? (calculation.cases + (calculation.loose > 0 ? 1 : 0)) * pricePerUnit
            : activeQty * pricePerUnit;

          return {
            productType: type, quantity: activeQty,
            calculatedCases: type.includes('Bottle') ? calculation.cases + (calculation.loose > 0 ? 1 : 0) : null,
            pricePerUnit, totalPrice: itemTotal, originalQuantity: isRounded ? rawQty : null
          };
        });

      const grandTotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const newOrder: Order = {
        id: Date.now().toString(), customerId, customerName: customerInfo.name, customerType,
        items: orderItems, totalAmount: grandTotal, status: OrderStatus.PENDING,
        deliveryLocation: finalLocation, deliveryDate: finalDate, deliveryTime: finalTime,
        createdAt: new Date().toISOString()
      };
      await Promise.race([saveOrder(newOrder), new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 15000))]);



      setIsSuccess(true);
    } catch (error) { alert(`Failed: ${(error as Error).message}`); }
    finally { setIsSubmitting(false); }
  };

  const isValid = customerInfo.name && customerInfo.phone && (customerInfo.location || gpsCoords) && hasItems;

  return (
    <div className="min-h-screen bg-slate-50 relative pb-32 font-sans overflow-x-hidden">

      {/* Background Water Image - Fixed Position */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <img src="/water-bg.png" alt="" className="w-full h-full object-cover" />
      </div>

      {/* Content z-index wrapper */}
      <div className="relative z-10 w-full max-w-lg mx-auto">

        {/* 1. Header: Green Theme */}
        <div className="px-6 py-6 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#4CAF50] drop-shadow-sm">EcoExpress</h1>
            <p className="text-slate-500 text-sm font-medium">{t.quickOrder || "Quick Order"}</p>
          </div>

          {/* Trust Badges */}
          <div className="flex gap-2">
            <div className="flex items-center gap-1 px-1.5 py-1 bg-white/80 backdrop-blur rounded text-[9px] font-bold text-slate-500 uppercase border border-slate-200">
              <ShieldCheck size={10} className="text-[#4CAF50]" /> ISI
            </div>
            <div className="flex items-center gap-1 px-1.5 py-1 bg-white/80 backdrop-blur rounded text-[9px] font-bold text-slate-500 uppercase border border-slate-200">
              <ShieldCheck size={10} className="text-[#4CAF50]" /> FSSAI
            </div>
          </div>
        </div>

        {!isSuccess ? (
          <div className="px-4 space-y-6">

            {/* Connection Alert */}
            {networkStatus && !networkStatus.isOnline && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">⚠️ No Internet Connection</div>
            )}

            {/* 2. Customer Section: Glassmorphism Card */}
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#4CAF50] uppercase tracking-wider mb-1">{t.yourDetails || "Your Details"}</label>
                  <input
                    value={customerInfo.name}
                    onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    placeholder={t.name ? `${t.name}` : "Name / பெயர்"}
                    className="w-full text-lg border-b-2 border-slate-200 focus:border-[#4CAF50] py-2 outline-none bg-transparent placeholder-slate-400 transition-colors"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder={t.phone ? `${t.phone}` : "Mobile / அலைபேசி"}
                    maxLength={10}
                    className="w-full text-lg border-b-2 border-slate-200 focus:border-[#4CAF50] py-2 outline-none bg-transparent placeholder-slate-400 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-[#4CAF50] uppercase tracking-wider mb-2">{t.locationLabel || "Location"}</label>
                <div className="flex gap-2 mb-2">
                  <button onClick={handleGetCurrentLocation} className="flex-1 bg-[#4CAF50] text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-green-200 active:scale-95 transition-transform flex items-center justify-center gap-2">
                    <Navigation size={16} />
                    {isLocating ? '...' : (t.useGps || 'Use GPS')}
                  </button>
                  <button onClick={() => setShowMap(true)} className="px-4 bg-white text-slate-600 border border-slate-200 rounded-xl text-sm font-bold active:scale-95 transition-transform">
                    {t.mapButton || "Map"}
                  </button>
                </div>

                {/* GPS Status Badge */}
                {gpsCoords && (
                  <div className="flex items-center gap-2 mb-3 bg-green-50 p-2 rounded-lg border border-green-100">
                    <MapPin size={14} className="text-[#4CAF50]" />
                    <span className="text-xs font-bold text-green-700">{t.gpsSet || "GPS Location Pinned ✓"}</span>
                    <button
                      onClick={() => setGpsCoords(null)}
                      className="ml-auto text-[10px] text-red-400 font-bold hover:text-red-600 border-l border-green-200 pl-2">
                      CLEAR
                    </button>
                  </div>
                )}

                <input
                  value={customerInfo.location}
                  onChange={e => setCustomerInfo({ ...customerInfo, location: e.target.value })}
                  placeholder={t.addressPlaceholder || "Address (Optional if GPS used)"}
                  className="w-full text-sm text-slate-900 bg-slate-50/50 p-3 rounded-xl outline-none border border-transparent focus:bg-white focus:border-green-200"
                />
              </div>

              <div className="pt-2 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#4CAF50] uppercase tracking-wider mb-2">{t.deliveryDate || "Delivery Date"}</label>
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setDate(e.target.value)}
                    className="w-full text-sm text-slate-900 bg-slate-50/50 p-3 rounded-xl outline-none border border-transparent focus:bg-white focus:border-green-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4CAF50] uppercase tracking-wider mb-2">{t.deliveryTime || "Delivery Time"}</label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full text-sm text-slate-900 bg-slate-50/50 p-3 rounded-xl outline-none border border-transparent focus:bg-white focus:border-green-200"
                  />
                </div>
              </div>
            </div>

            {/* 3. MENU LIST - Green Theme */}
            <div className="space-y-4">
              <div className="flex justify-between items-end px-2">
                <label className="block text-xs font-bold text-[#4CAF50] uppercase tracking-wider">{t.selectProducts || "Select Products"}</label>
                <button onClick={() => setShowPriceList(true)} className="text-xs text-[#4CAF50] font-bold flex items-center gap-1 hover:underline">
                  <Info size={14} /> {t.priceList || "Price List"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {Object.values(ProductType).map(tKey => {
                  const rawQtyStr = quantities[tKey] || "0";
                  const rawQty = parseInt(rawQtyStr);
                  const isSelected = rawQty > 0;
                  const config = PRODUCT_CONFIG[tKey];
                  const caseSize = config.itemsPerCase;

                  const { roundedQty, extra } = calculateSmartRounding(tKey, rawQty);
                  const hasRounding = extra > 0;
                  const diff = roundedQty - rawQty;
                  const calc = calculateCases(tKey, roundedQty);

                  return (
                    <div key={tKey} className={`flex flex-col p-4 rounded-3xl border-2 transition-all duration-300 ${isSelected ? 'border-[#4CAF50] bg-green-50/90 shadow-lg shadow-green-100' : 'border-white bg-white/80 backdrop-blur-md shadow-sm'}`}>

                      <div className="flex items-start justify-between">
                        {/* Left: Product Info */}
                        <div className="flex flex-col flex-1 pr-4">
                          <div className="font-extrabold text-slate-900 text-lg leading-tight">{tKey}</div>
                          <div className="text-[10px] text-slate-500 font-medium mb-1 mt-1">
                            {tKey.includes('20L') ? '20லி கேன்'
                              : (tKey.includes('300ml') ? '300மி.லி' : 'பாட்டில்')}
                            <span className="mx-1">•</span>
                            <span className="font-bold text-[#4CAF50]">{caseSize} {t.itemsPerCase || "items/case"}</span>
                          </div>
                          <div className="font-bold text-slate-900 mt-1">₹{config.normalPrice}<span className="text-[10px] font-normal text-slate-500"> {t.perCaseSuffix || "/case"}</span></div>
                        </div>

                        {/* Right: Input with Car Icon */}
                        <div className="flex items-center">
                          <div className={`flex items-center px-3 py-2 rounded-2xl border-2 transition-all ${isSelected ? 'bg-white border-green-200 shadow-inner' : 'bg-slate-100 border-transparent'}`}>
                            <ShoppingCart size={20} className={`mr-2 ${isSelected ? 'text-[#4CAF50]' : 'text-slate-400'}`} />
                            <input
                              type="number"
                              min="0"
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e') e.preventDefault();
                              }}
                              value={rawQtyStr === "0" ? "" : rawQtyStr}
                              onChange={e => updateQuantity(tKey, e.target.value)}
                              placeholder="0"
                              className={`w-12 h-10 text-center text-2xl font-black outline-none bg-transparent ${isSelected ? 'text-[#4CAF50]' : 'text-slate-400 focus:text-slate-900'}`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* INFO: Feedback */}
                      {isSelected && (
                        <div className={`mt-3 p-3 rounded-xl text-xs leading-relaxed transition-all animate-fadeIn ${hasRounding ? 'bg-[#4CAF50] text-white' : 'bg-white text-green-800 border border-green-100'}`}>
                          {tKey.includes('Bottle') ? (
                            <>
                              <div className="font-bold flex items-center gap-1">
                                {hasRounding ? (t.roundedUp || '✨ Rounded Up') : (t.perfectFit || '✓ Perfect Fit')}
                              </div>
                              <div className="opacity-95 mt-0.5">
                                {t.youGet || "You get"} <b>{roundedQty}</b> {t.bottles || "bottles"} ({calc.display}).
                                {hasRounding && ` (${t.includes || "Includes"} ${diff} ${t.extra || "extra"})`}
                              </div>
                            </>
                          ) : (
                            <div className="font-bold">{t.total || "Total"}: {roundedQty} {t.cans || "Cans"}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Spacer */}
            <div className="h-4"></div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 flex items-center gap-4 z-50 safe-area-bottom pb-8 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-[10px] uppercase font-bold text-slate-400">{t.totalEstimate || "Total Estimate"}</div>
                <div className="text-3xl font-black text-[#4CAF50]">
                  ₹{Object.entries(quantities).reduce((sum, [typeStr, valStr]) => {
                    const qty = parseInt(valStr || "0");
                    if (qty === 0) return sum;
                    const type = typeStr as ProductType;
                    const config = PRODUCT_CONFIG[type];
                    const { roundedQty } = calculateSmartRounding(type, qty);
                    const calc = calculateCases(type, roundedQty);
                    const price = config.normalPrice;
                    let itemTotal = 0;
                    if (type.includes('Bottle')) {
                      const casesToCharge = calc.cases + (calc.loose > 0 ? 1 : 0);
                      itemTotal = casesToCharge * price;
                    } else {
                      itemTotal = roundedQty * price;
                    }
                    return sum + itemTotal;
                  }, 0)}
                </div>
                {/* Pay on Delivery Text */}
                <div className="text-[9px] text-slate-400 mt-1 max-w-[150px] leading-tight">
                  {t.payOnDelivery || "Total amount needs to be paid during delivery"}
                </div>
              </div>
              <Button
                onClick={handlePlaceOrder}
                className="bg-[#4CAF50] text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-green-200 active:scale-95 transition-transform flex-1 hover:bg-[#43A047]"
                disabled={!isValid || isSubmitting}
                isLoading={isSubmitting}
              >
                {isSubmitting ? '...' : (t?.placeOrderButton || 'ORDER NOW')}
              </Button>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[60vh] px-6 text-center animate-fadeIn relative z-10">
            <div className="w-20 h-20 bg-[#4CAF50] text-white rounded-full flex items-center justify-center text-4xl mb-6 shadow-xl shadow-green-200">✓</div>
            <h2 className="text-2xl font-bold mb-2 text-slate-800">{t.orderPlaced || "Order Placed!"}</h2>
            <p className="text-slate-500 mb-8 max-w-xs mx-auto">{t.thankYouMsg?.replace("{name}", customerInfo.name) || `Thank you, ${customerInfo.name}. We have received your order.`}</p>
            <button onClick={() => window.location.reload()} className="text-[#4CAF50] font-bold border-b-2 border-[#4CAF50] pb-1 hover:text-[#43A047]">
              {t.placeAnother || "Place New Order"}
            </button>
          </div>
        )}

      </div>

      {/* Map Modal */}
      {showMap && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fadeIn">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-bold text-slate-800">{t.setLocation || "Set Location"}</h3>
            <button onClick={() => setShowMap(false)} className="text-slate-400 hover:text-red-500">{t.close || "Close"}</button>
          </div>
          <div className="flex-grow relative">
            <LocationPickerMap
              onLocationSelect={(lat, lng) => {
                // Determine whether to set GPS or simply explore. Since it's a "Picker", we set GPS coords.
                // We do NOT set the address text to coordinates.
                setGpsCoords({ lat, lng });
              }}
              // Initialize Map with existing GPS coords or default
              initialLat={gpsCoords?.lat || 9.1726} initialLng={gpsCoords?.lng || 77.8808}
            />
            <div className="absolute bottom-8 left-4 right-4 bg-[#4CAF50] text-white p-4 rounded-xl text-center font-bold shadow-xl shadow-green-200" onClick={() => setShowMap(false)}>
              {t.confirmLocation || "Confirm Location"}
            </div>
          </div>
        </div>
      )}

      {/* Price List Modal */}
      {showPriceList && <PriceListModal onClose={() => setShowPriceList(false)} t={t} />}

    </div>
  );
};
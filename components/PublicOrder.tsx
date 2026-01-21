import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Select } from './SharedComponents';
import { ProductType, Order, OrderStatus } from '../types';
import { calculateCases, saveOrder, getCustomers, saveCustomer, findCustomerByPhone, calculateSmartRounding } from '../services/mockService';
import { PRODUCT_CONFIG } from '../constants';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Info } from 'lucide-react';

// Fix for default Leaflet marker icons in React
// Using a customer SVG div icon for better performance/look
const createMapIcon = () => {
  return L.divIcon({
    className: 'custom-map-icon',
    html: `<div style="background-color: #4CAF50; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

const LocationPickerMap: React.FC<{
  onLocationSelect: (lat: number, lng: number) => void,
  initialLat?: number,
  initialLng?: number
}> = ({ onLocationSelect, initialLat = 9.1726, initialLng = 77.8808 }) => {
  const [position, setPosition] = useState<L.LatLng | null>(initialLat ? new L.LatLng(initialLat, initialLng) : null);

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        setPosition(e.latlng);
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  };

  const RecenterAutomatically = ({ lat, lng }: { lat: number, lng: number }) => {
    const map = useMap();
    useEffect(() => {
      map.flyTo([lat, lng], map.getZoom());
    }, [lat, lng]);
    return null;
  }

  return (
    <MapContainer
      center={[initialLat, initialLng]}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {position && <Marker position={position} icon={createMapIcon()} />}
      <MapEvents />
      <RecenterAutomatically lat={initialLat} lng={initialLng} />
    </MapContainer>
  );
};

const PriceListModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <Info size={20} className="text-[#4CAF50]" />
          Product Price List
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-red-500 text-2xl">×</button>
      </div>

      <div className="p-0 overflow-y-auto max-h-[60vh]">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
            <tr>
              <th className="p-3 border-b">Product</th>
              <th className="p-3 border-b text-center">Packaging</th>
              <th className="p-3 border-b text-right">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Object.values(PRODUCT_CONFIG).map((product) => (
              <tr key={product.type} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-800">{product.type}</td>
                <td className="p-3 text-center text-slate-500">
                  {product.type.includes('Bottle') ? `${product.itemsPerCase} Bottles / Case` : 'Single Can'}
                </td>
                <td className="p-3 text-right font-bold text-[#4CAF50]">
                  ₹{product.normalPrice}
                  <span className="text-xs text-slate-400 font-normal ml-1">
                    /{product.type.includes('Bottle') ? 'Case' : 'Unit'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50 text-center">
        <Button onClick={onClose} className="w-full">Close</Button>
      </div>
    </div>
  </div>
);

// ... imports

export const PublicOrder: React.FC<{ t?: any }> = ({ t = {} }) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', shop: '', location: '', lat: 9.1726, lng: 77.8808 });
  const [showMap, setShowMap] = useState(false);
  const [showPriceList, setShowPriceList] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Multi-item state
  const [items, setItems] = useState<{ type: ProductType, quantity: number }[]>([
    { type: ProductType.CAN_20L, quantity: 1 }
  ]);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Helper to add new item row
  const addItem = () => {
    setItems([...items, { type: ProductType.CAN_20L, quantity: 1 }]);
  };

  // Helper to remove item row
  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  // Helper to update item
  const updateItem = (index: number, field: 'type' | 'quantity', value: any) => {
    const newItems = [...items];
    if (field === 'type') newItems[index].type = value;
    if (field === 'quantity') newItems[index].quantity = Number(value);
    setItems(newItems);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    setShowMap(true); // Open map so they can see result

    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      setCustomerInfo(prev => ({
        ...prev,
        lat: latitude,
        lng: longitude,
        location: `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      }));
      setIsLocating(false);
    }, (error) => {
      console.error("Error obtaining location", error);
      alert("Unable to retrieve your location");
      setIsLocating(false);
    }, { enableHighAccuracy: true });
  };

  const handlePlaceOrder = () => {
    // 0. Validation: Mandatory Fields
    if (!date || !time) {
      alert("Please select a Delivery Date and Time.");
      return;
    }

    // 0.1 Validation: Delivery Time > 30 mins
    const now = new Date();
    const selectedDateTime = new Date(`${date}T${time}`);
    const timeDiff = selectedDateTime.getTime() - now.getTime();
    const oneHourMs = 60 * 60 * 1000;
    const thirtyMinsMs = 30 * 60 * 1000;

    let finalDate = date;
    let finalTime = time;

    // Logic: If selected time is less than 1 hour from NOW (including past), set to Now + 30 mins
    if (timeDiff < oneHourMs) {
      const newDeliveryTime = new Date(now.getTime() + thirtyMinsMs);
      // Format to YYYY-MM-DD
      const yyyy = newDeliveryTime.getFullYear();
      const mm = String(newDeliveryTime.getMonth() + 1).padStart(2, '0');
      const dd = String(newDeliveryTime.getDate()).padStart(2, '0');
      finalDate = `${yyyy}-${mm}-${dd}`;

      // Format to HH:MM
      const hh = String(newDeliveryTime.getHours()).padStart(2, '0');
      const min = String(newDeliveryTime.getMinutes()).padStart(2, '0');
      finalTime = `${hh}:${min}`;

      // Alert user if we changed it? Or just Update State?
      // Prompt says "System should automatically set". Displaying a toast/alert is good UX.
      alert(`Delivery time updated to ${finalTime} (minimum 30 mins preparation time).`);

      // Update State so UI reflects it (optional, but good)
      setDate(finalDate);
      setTime(finalTime);
    }

    // 1. Check for Existing Customer or Create New
    let customerId = `pub_${Date.now()}`;
    let customerType: 'REGULAR' | 'RETAIL' | 'PUBLIC' = 'REGULAR'; // Default for new Quick Order users is Regular (can be promoted to Retail by Admin)

    // Check if phone exists
    const existingCustomer = findCustomerByPhone(customerInfo.phone);

    if (existingCustomer) {
      console.log("Found existing customer:", existingCustomer.name);
      customerId = existingCustomer.id;
      customerType = existingCustomer.type;
      // We don't overwrite name/location if they are existing, or maybe we update location?
      // Prompt says "order should go to the same customer". Let's assume we just link IDs.
    } else {
      // Create New Profile
      saveCustomer({
        id: customerId,
        name: customerInfo.name,
        phone: customerInfo.phone,
        type: 'REGULAR', // Auto-created are Regular by default
        location: customerInfo.location,
        shopName: customerInfo.shop,
        pendingAmount: 0,
        outstandingCans: 0,
        email: customerInfo.phone, // Default username is phone
        password: customerInfo.phone // Default password is phone (as per request)
      });
    }

    // 2. Prepare Order Items & Calculate Total
    const orderItems = items.map(item => {
      const config = PRODUCT_CONFIG[item.type];

      // Smart Rounding
      const { roundedQty, isRounded, extra } = calculateSmartRounding(item.type, item.quantity);
      const activeQty = roundedQty; // Use rounded quantity for billing

      const calculation = calculateCases(item.type, activeQty);

      // Dynamic Pricing based on Customer Type
      const pricePerUnit = customerType === 'RETAIL' ? config.retailPrice : config.normalPrice;

      let itemTotal = 0;
      if (item.type.includes('Bottle')) {
        // Price is per case
        itemTotal = (calculation.cases + (calculation.loose > 0 ? 1 : 0)) * pricePerUnit;
      } else {
        // Price is per unit
        itemTotal = activeQty * pricePerUnit;
      }

      return {
        productType: item.type,
        quantity: activeQty, // Save the ROUNDED quantity to the order
        calculatedCases: item.type.includes('Bottle') ? calculation.cases + (calculation.loose > 0 ? 1 : 0) : undefined,
        pricePerUnit,
        totalPrice: itemTotal,
        originalQuantity: isRounded ? item.quantity : undefined // Optional: Store original request if needed? Types doesn't have it, but for now we just save rounded.
      };
    });

    const grandTotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // 3. Create Order
    saveOrder({
      id: Date.now().toString(),
      customerId: customerId,
      customerName: customerInfo.name,
      customerType: customerType,
      items: orderItems,
      totalAmount: grandTotal,
      status: OrderStatus.PENDING,
      deliveryLocation: customerInfo.location,
      deliveryDate: finalDate, // Use validated/corrected date
      deliveryTime: finalTime, // Use validated/corrected time
      createdAt: new Date().toISOString()
    });

    setIsSuccess(true);
  };

  const isValid = customerInfo.name && customerInfo.phone && customerInfo.location;

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#4CAF50]">EcoExpress Logistics</h1>
          <p className="text-slate-500 mt-2">{t?.quickOrderTitle || "Quick Order Form"}</p>
        </div>

        {!isSuccess ? (
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Customer Details Section */}
            <Card title={t?.yourDetails || "Your Details"}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t?.name || "Name"} value={customerInfo.name} onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })} />
                <Input
                  label={t?.phone || "Phone"}
                  value={customerInfo.phone}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setCustomerInfo({ ...customerInfo, phone: val });
                  }}
                  maxLength={10}
                  placeholder="10-digit number"
                />
              </div>

              {/* Location with Map Selector */}
              <div className="relative">
                <Input
                  label={t?.locationLabel || "Location / Address"}
                  value={customerInfo.location}
                  onChange={e => setCustomerInfo({ ...customerInfo, location: e.target.value })}
                  placeholder={t?.locationPlaceholder || "Select from Map for accuracy"}
                  readOnly={false} // Allow manual edit if needed
                  className="pr-48" // Add padding for absolute buttons
                />
                <div className="absolute right-2 top-8 flex gap-2">
                  <button
                    onClick={handleGetCurrentLocation}
                    className={`p-1 px-2 rounded-md flex items-center gap-1 text-sm font-semibold transition-colors ${isLocating ? 'bg-slate-100 text-slate-500' : 'text-blue-600 hover:bg-blue-50'}`}
                    title="Use Current Location"
                  >
                    {isLocating ? '📡 Locating...' : `📡 ${t?.gps || "GPS"}`}
                  </button>
                  <button
                    onClick={() => setShowMap(true)}
                    className="text-[#4CAF50] hover:text-[#43a047] p-1 px-2 rounded-md hover:bg-green-50 flex items-center gap-1 text-sm font-semibold transition-colors"
                    title="Select from Map"
                  >
                    <span>📍</span> {t?.mapButton || "Map"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                * {t?.locationHint || "Use GPS or Map to ensure delivery within 10 meters accuracy."}
              </p>

              <Input label={t?.shopName || "Shop Name (Optional)"} value={customerInfo.shop} onChange={e => setCustomerInfo({ ...customerInfo, shop: e.target.value })} />
            </Card>

            {/* 2. Order Items Section */}
            <Card
              title={t?.orderItems || "Order Items"}
              action={<button onClick={() => setShowPriceList(true)} className="text-[#4CAF50] text-sm font-semibold hover:underline flex items-center gap-1"><Info size={16} /> {t?.viewPrices || "View Prices"}</button>}
            >
              <div className="space-y-4 mb-6">
                {items.map((item, index) => (
                  <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative transition-all">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 rounded-full p-1 shadow border border-slate-100 z-10"
                        title="Remove Item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-7">
                        <Select
                          label={index === 0 ? (t?.product || "Product") : ""}
                          options={Object.values(ProductType).map(t => ({ value: t, label: t }))}
                          value={item.type}
                          onChange={e => updateItem(index, 'type', e.target.value)}
                          className="mb-0"
                        />
                      </div>
                      <div className="md:col-span-5">
                        <Input
                          label={index === 0 ? (t?.quantity || "Quantity") : ""}
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', e.target.value)}
                          min={1}
                          className="mb-0"
                        />
                      </div>
                    </div>
                    {item.type.includes('Bottle') && (
                      <p className="text-xs text-[#4CAF50] mt-1 text-right">
                        {(() => {
                          const { roundedQty, isRounded, extra } = calculateSmartRounding(item.type, item.quantity);
                          const calc = calculateCases(item.type, roundedQty);
                          return (
                            <div>
                              <span className="font-bold">{calc.display}</span>
                              {isRounded && (
                                <span className="block text-[10px] text-blue-600">
                                  (Rounded up from {item.quantity}. Includes {extra} extra bottles.)
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <Button variant="secondary" onClick={addItem} className="w-full mb-6 border-dashed border-2 text-slate-500 hover:text-[#4CAF50] hover:border-[#4CAF50]">
                + {t?.addProduct || "Add Another Product"}
              </Button>

              <div className="border-t border-slate-100 pt-6">
                <h4 className="text-sm font-bold text-slate-700 mb-3">{t?.preferredTime || "Preferred Delivery Time"}</h4>
                <div className="flex gap-4">
                  <Input type="date" label="Date" className="flex-1 mb-0" value={date} onChange={e => setDate(e.target.value)} />
                  <Input type="time" label="Time" className="flex-1 mb-0" value={time} onChange={e => setTime(e.target.value)} />
                </div>
              </div>
            </Card>

            {/* Submit Action */}
            <Card className="sticky bottom-4 shadow-xl border-[#4CAF50]/20">
              <Button
                onClick={handlePlaceOrder}
                className="w-full py-4 text-lg"
                disabled={!isValid}
              >
                {t?.placeOrderButton || "Place Order Now"}
              </Button>
              {!isValid && (
                <p className="text-xs text-center text-red-400 mt-2">
                  {t?.fillWarning || "Please fill in your Name, Phone and Location."}
                </p>
              )}
            </Card>
          </div>
        ) : (
          <Card className="text-center py-12 animate-fadeIn">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-green-500 text-5xl">✓</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">{t?.orderPlaced || "Order Placed!"}</h2>
            <p className="text-slate-500 mb-8 max-w-xs mx-auto">
              {t?.thankYouMsg ? t.thankYouMsg.replace('{name}', customerInfo.name) : `Thank you, ${customerInfo.name}. We have received your order and will contact you shortly.`}
            </p>
            <Button className="w-full max-w-xs mx-auto" variant="secondary" onClick={() => window.location.reload()}>
              {t?.placeAnother || "Place Another Order"}
            </Button>
          </Card>
        )}

        {/* Map Selection Modal - REAL MAP */}
        {showMap && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[85vh]">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Pin/Select Delivery Location</h3>
                  <p className="text-xs text-slate-500">Drag map or click to set exact spot.</p>
                </div>
                <button onClick={() => setShowMap(false)} className="text-slate-400 hover:text-red-500 text-2xl">×</button>
              </div>

              <div className="flex-grow relative bg-slate-100">
                {/* Leaflet Map */}
                <LocationPickerMap
                  onLocationSelect={(lat, lng) => {
                    // In a real app, use Reverse Geocoding API here to get address string
                    // For now, we store precise coordinates as requested
                    setCustomerInfo(prev => ({
                      ...prev,
                      lat,
                      lng,
                      location: `Selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
                    }));
                  }}
                  initialLat={customerInfo.lat}
                  initialLng={customerInfo.lng}
                />

                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-full shadow-lg text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span>Selected:</span>
                  <span className="text-[#4CAF50]">{customerInfo.lat.toFixed(5)}, {customerInfo.lng.toFixed(5)}</span>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50">
                <Button onClick={() => setShowMap(false)}>Confirm Location</Button>
              </div>
            </div>
          </div>
        )}

        {/* Price List Modal */}
        {showPriceList && <PriceListModal onClose={() => setShowPriceList(false)} />}
      </div>
    </div>
  );
};
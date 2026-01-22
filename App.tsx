import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminInventory } from './components/AdminInventory';
import { AdminRevenue } from './components/AdminRevenue';
import { AdminOrders } from './components/AdminOrders';
import { AdminCustomers } from './components/AdminCustomers';
import { AdminCreateOrder } from './components/AdminCreateOrder';
import { DeliveryDashboard } from './components/DeliveryDashboard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { PublicOrder } from './components/PublicOrder';
import { Input, Button, Card } from './components/SharedComponents';
import { ADMIN_CREDENTIALS, DRIVER_CREDENTIALS } from './constants';
import { getCustomers } from './services/firestoreService';
import { UserRole, Customer } from './types';
import { Truck, Users, ShieldCheck, MapPin, Phone, LogIn, Globe, Clock, Star, CheckCircle, Zap, Recycle, Smartphone } from 'lucide-react';
import { TRANSLATIONS, Language } from './constants/translations';

const App: React.FC = () => {
  // Use pathname for top-level routing (Admin vs Customer vs Driver)
  const [pathname, setPathname] = useState(window.location.pathname.toLowerCase());
  // Use hash for internal routing within Admin dashboard (Dashboard vs Inventory)
  const [hash, setHash] = useState(window.location.hash);

  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Language State
  const [lang, setLang] = useState<Language>('en');

  // Login Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    // Handler for SPA navigation
    const handlePopState = () => {
      setPathname(window.location.pathname.toLowerCase());
      setHash(window.location.hash);
    };

    // Listen for hash changes for internal dashboard nav
    const handleHashChange = () => setHash(window.location.hash);

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'ta' : 'en');
  };

  const t = TRANSLATIONS[lang];

  // Determine which login screen to show based on URL
  let targetRole = UserRole.CUSTOMER; // Default
  if (pathname.startsWith('/admin')) targetRole = UserRole.ADMIN;
  else if (pathname.startsWith('/delivery-partner')) targetRole = UserRole.DELIVERY_PARTNER;
  else targetRole = UserRole.CUSTOMER; // Default fallback as requested

  const handleLogin = async () => {
    setIsLoading(true);
    // Simulate network delay for UX
    await new Promise(resolve => setTimeout(resolve, 800));

    if (targetRole === UserRole.ADMIN) {
      if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        setRole(UserRole.ADMIN);
        setIsLoading(false);
        return;
      }
    } else if (targetRole === UserRole.DELIVERY_PARTNER) {
      if (username === DRIVER_CREDENTIALS.username && password === DRIVER_CREDENTIALS.password) {
        setRole(UserRole.DELIVERY_PARTNER);
        setIsLoading(false);
        return;
      }
    } else {
      // Customer
      const customers = await getCustomers();
      const foundCustomer = customers.find(c => c.email === username && c.password === password);
      if (foundCustomer) {
        setRole(UserRole.CUSTOMER);
        setCurrentUser(foundCustomer);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(false);
    alert('Invalid Credentials. Please check your username and password.');
  };

  const logout = () => {
    setRole(null);
    setCurrentUser(null);
    setUsername('');
    setPassword('');
  };

  // --- RENDER LOGIC ---

  // 1. Authenticated Views
  if (role === UserRole.ADMIN) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header role="Admin" onLogout={logout} lang={lang} toggleLang={toggleLang} t={t} />
        <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
          {hash.includes('inventory') ? <AdminInventory /> :
            hash.includes('revenue') ? <AdminRevenue /> :
              hash.includes('customers') ? <AdminCustomers /> :
                hash.includes('orders') ? <AdminOrders /> :
                  hash.includes('create-order') ? <AdminCreateOrder onBack={() => window.location.hash = ''} /> :
                    <AdminDashboard onNavigate={(page) => window.location.hash = `#/${page}`} />}
        </main>
        <Footer t={t} />
      </div>
    );
  }

  if (role === UserRole.DELIVERY_PARTNER) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header role="Delivery Partner" onLogout={logout} lang={lang} toggleLang={toggleLang} t={t} />
        <main className="flex-grow p-4 md:p-6 w-full max-w-lg mx-auto">
          <DeliveryDashboard onLogout={logout} />
        </main>
        <Footer t={t} />
      </div>
    );
  }

  if (role === UserRole.CUSTOMER && currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header role="Customer" onLogout={logout} userName={currentUser.name} lang={lang} toggleLang={toggleLang} t={t} />
        <main className="flex-grow p-4 md:p-6 w-full max-w-2xl mx-auto">
          <CustomerDashboard customer={currentUser} onLogout={logout} />
        </main>
        <Footer t={t} />
      </div>
    );
  }

  // 2. Unauthenticated Login Views (Based on targetRole)

  // Quick Order route check
  if (hash.includes('quick-order') || pathname.includes('quick-order')) {
    return (
      <>
        <Header onLogout={() => { }} simple lang={lang} toggleLang={toggleLang} t={t} />
        <PublicOrder t={t} />
        <Footer t={t} />
      </>
    );
  }

  // Configurations for different login pages
  const loginConfig = {
    [UserRole.ADMIN]: {
      title: t.adminPortal,
      subtitle: t.adminSubtitle,
      icon: ShieldCheck,
      colorClass: "bg-slate-800",
      textClass: "text-slate-800",
      placeholder: "admin@ecoexpress.com"
    },
    [UserRole.DELIVERY_PARTNER]: {
      title: t.partnerPortal,
      subtitle: t.partnerSubtitle,
      icon: Truck,
      colorClass: "bg-[#4CAF50]", // Brand Green
      textClass: "text-[#4CAF50]",
      placeholder: "driver@fleet.com"
    },
    [UserRole.CUSTOMER]: {
      title: t.customerPortal,
      subtitle: t.customerSubtitle,
      icon: Users,
      colorClass: "bg-blue-600",
      textClass: "text-blue-600",
      placeholder: "customer@email.com"
    }
  }[targetRole];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Header onLogout={() => { }} simple lang={lang} toggleLang={toggleLang} t={t} />

      <div className="flex-grow flex items-center justify-center p-4">
        {targetRole === UserRole.CUSTOMER && !hash.includes('login') ? (
          // Customer Landing View (V3: Clean & Integrated)
          <div className="w-full max-w-lg flex flex-col items-center animate-fadeIn pb-12 pt-6 relative">

            {/* Background Water Image - Fixed Position */}
            <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
              <img src="/water-bg.png" alt="" className="w-full h-full object-cover" />
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full flex flex-col items-center">

              {/* 1. Integrated Info Row */}
              <div className="flex justify-center items-center gap-3 mb-8 w-full px-4 flex-wrap">
                <div className="flex items-center gap-1.5 bg-green-50/90 backdrop-blur-sm text-green-700 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold border border-green-200">
                  <Clock size={12} className="animate-pulse" />
                  {t.hours}
                </div>
                <div className="flex items-center gap-1.5 bg-yellow-50/90 backdrop-blur-sm text-yellow-700 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold border border-yellow-200">
                  <Star size={12} fill="currentColor" />
                  {t.customers50}
                </div>
              </div>

              {/* 2. Unified Hero */}
              <div className="text-center px-4 mb-8">
                <div className="mb-6 relative w-32 h-32 bg-white rounded-full p-6 shadow-2xl shadow-slate-100 flex items-center justify-center mx-auto border-[6px] border-slate-50">
                  <img src="/logo.png" alt="EcoExpress" className="w-full h-auto object-contain" />
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight drop-shadow-sm">
                  {t.thirsty}
                </h1>
                <span className="text-xl md:text-2xl font-bold text-[#4CAF50] block mb-6 drop-shadow-sm">{t.getWaterNow}</span>

                {/* Trust Badges - Row */}
                <div className="flex justify-center gap-3 mb-8">
                  <div className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-md rounded text-[10px] font-bold text-slate-500 uppercase tracking-wide border border-slate-200 shadow-sm">
                    <ShieldCheck size={12} className="text-[#4CAF50]" /> {t.isi}
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-md rounded text-[10px] font-bold text-slate-500 uppercase tracking-wide border border-slate-200 shadow-sm">
                    <ShieldCheck size={12} className="text-[#4CAF50]" /> {t.fssai}
                  </div>
                </div>

                {/* CTA Area */}
                <div className="w-full max-w-xs mx-auto flex flex-col gap-3">
                  <Button
                    className="w-full py-4 text-lg font-bold shadow-lg shadow-green-200/80 hover:shadow-green-300 transform transition active:scale-95"
                    onClick={() => window.location.href = '#/quick-order'}
                  >
                    {t.placeQuickOrder}
                  </Button>

                  <p className="text-[10px] text-slate-600 font-bold flex items-center justify-center gap-1 bg-white/60 py-1 rounded-full backdrop-blur-sm">
                    <Zap size={10} className="text-orange-400 fill-orange-400" /> {t.urgency}
                  </p>

                  <div className="relative flex items-center justify-center my-3">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-300/50"></div></div>
                    <span className="relative bg-transparent px-2 text-slate-500 text-[10px] uppercase font-bold backdrop-blur-sm rounded">{t.or}</span>
                  </div>

                  <button
                    onClick={() => window.location.hash = '#/login'}
                    className="w-full py-2 flex items-center justify-center gap-2 text-slate-600 font-bold text-sm bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg hover:border-[#4CAF50] hover:text-[#4CAF50] transition shadow-sm"
                  >
                    <LogIn size={14} /> {t.loginToAccount}
                  </button>
                </div>
              </div>

              {/* 3. Features - Clean Cards */}
              <div className="w-full px-6 max-w-md">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Truck, text: t.featDelivery, color: "text-blue-500", border: "border-blue-100", bg: "bg-white/90 backdrop-blur-sm" },
                    { icon: Recycle, text: t.featPickup, color: "text-green-500", border: "border-green-100", bg: "bg-white/90 backdrop-blur-sm" },
                    { icon: Smartphone, text: t.featEasy, color: "text-purple-500", border: "border-purple-100", bg: "bg-white/90 backdrop-blur-sm" },
                  ].map((feat, i) => (
                    <div key={i} className={`flex flex-col items-center p-2 rounded-xl border ${feat.border} ${feat.bg} text-center shadow-sm`}>
                      <feat.icon size={18} className={`mb-1 ${feat.color}`} />
                      <span className="text-[10px] font-bold text-slate-600 leading-tight">{feat.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        ) : (
          // Standard Login Card (Admin / Partner / Customer Login Mode)
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
            {/* Login Header */}
            <div className={`${loginConfig.colorClass} p-6 text-white text-center`}>
              <h2 className="text-2xl font-bold">{loginConfig.title}</h2>
              <p className="text-white/80 text-sm">{loginConfig.subtitle}</p>
            </div>

            {/* Login Form */}
            <div className="p-8">
              <Input
                label={t.usernamePlaceholder}
                placeholder={loginConfig.placeholder}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />

              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-semibold text-slate-700">{t.passwordLabel}</label>
                  <a href="#" className="text-xs text-[#4CAF50] hover:underline">{t.forgotPassword}</a>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mb-0"
                />
              </div>

              <div className="flex items-center mb-6">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-[#4CAF50] border-gray-300 rounded focus:ring-[#4CAF50]"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-slate-600">
                  {t.rememberMe}
                </label>
              </div>

              <Button
                className="w-full py-3 text-lg shadow-lg shadow-green-100"
                onClick={handleLogin}
                isLoading={isLoading}
                icon={LogIn}
              >
                {t.signIn}
              </Button>

              {targetRole === UserRole.CUSTOMER && (
                <div className="mt-6 text-center border-t border-slate-100 pt-4">
                  <button
                    onClick={() => window.location.hash = ''} // Go back to landing
                    className="text-sm text-slate-500 hover:text-[#4CAF50]"
                  >
                    {t.backToHome}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Role Switcher for Demo/Nav */}
            <div className="bg-slate-50 p-3 flex justify-center gap-4 text-xs text-slate-400 border-t border-slate-100">
              <a href="/Customer#/login" className={`hover:text-[#4CAF50] ${targetRole === UserRole.CUSTOMER ? 'font-bold text-[#4CAF50]' : ''}`}>Customer</a>
              <span>•</span>
              <a href="/Delivery-partner" className={`hover:text-[#4CAF50] ${targetRole === UserRole.DELIVERY_PARTNER ? 'font-bold text-[#4CAF50]' : ''}`}>Partner</a>
              <span>•</span>
              <a href="/Admin" className={`hover:text-[#4CAF50] ${targetRole === UserRole.ADMIN ? 'font-bold text-[#4CAF50]' : ''}`}>Admin</a>
            </div>
          </div>
        )}
      </div>

      <Footer t={t} />
    </div>
  );
};

// --- Sub Components ---

const Header: React.FC<{ role?: string, onLogout: () => void, userName?: string, simple?: boolean, lang: Language, toggleLang: () => void, t: any }> = ({ role, onLogout, userName, simple, lang, toggleLang, t }) => (
  <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 h-16 relative flex items-center justify-between">
      {/* Left Side: Role Indicator (if not simple) */}
      <div className="flex items-center gap-3">
        {!simple && role && (
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider hidden md:block">
            {role} {t.portal}
          </p>
        )}
      </div>

      {/* Center: Logo */}
      <div
        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
        onClick={() => window.location.href = '/'}
      >
        <img src="/logo.png" alt="EcoExpress Logistics" className="h-20 w-auto object-contain" />
      </div>

      {/* Right Side: User Controls & Language Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleLang}
          className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-[#4CAF50] border border-slate-200 rounded-full px-3 py-1 transition"
        >
          <Globe size={16} />
          {lang === 'en' ? 'English' : 'தமிழ்'}
        </button>

        {!simple && (
          <>
            {userName && <span className="text-sm font-medium text-slate-600 hidden md:block">{t.hi}, {userName}</span>}
            <button onClick={onLogout} className="text-sm text-red-500 hover:text-red-700 font-medium">{t.logout}</button>
          </>
        )}
      </div>
    </div>
  </header>
);

const Footer = ({ t }: { t: any }) => (
  <footer className="bg-slate-800 text-slate-400 py-8 mt-auto">
    <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
      <div>
        <h4 className="text-white font-bold mb-3">EcoExpress Logistics</h4>
        <p>{t.brandDesc}</p>
      </div>
      <div className="md:text-right">
        <h4 className="text-white font-bold mb-3">{t.opsTitle}</h4>
        <p className="flex items-center gap-2 mb-1 md:justify-end"><MapPin size={14} /> Valluvar Nagar, kadalaiyur road, kovilpatti - 628501</p>
        <p className="flex items-center gap-2 md:justify-end"><Phone size={14} /> +91 99946 04274, +91 63810 65877</p>
      </div>
    </div>
    <div className="text-center mt-8 pt-8 border-t border-slate-700 text-xs">
      &copy; 2026 EcoExpress Logistics. {t.rightsReserved}
    </div>
  </footer>
);

export default App;
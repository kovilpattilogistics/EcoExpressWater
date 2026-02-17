import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminInventory } from './components/AdminInventory';
import { AdminDeliveryStatus } from './components/AdminDeliveryStatus';
import { AdminRevenue } from './components/AdminRevenue';
import { AdminOrders } from './components/AdminOrders';
import { AdminCustomers } from './components/AdminCustomers';
import { AdminCreateOrder } from './components/AdminCreateOrder';
import { DeliveryDashboard } from './components/DeliveryDashboard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { PublicOrder } from './components/PublicOrder';
import { PublicLanding } from './components/PublicLanding';

import { Input, Button } from './components/SharedComponents';
import { getEcoLang, setEcoLang } from './lang';
import { ADMIN_CREDENTIALS, DRIVER_CREDENTIALS, BASE_PATH } from './constants';
import { getCustomers } from './services/firestoreService';
import { UserRole, Customer } from './types';
import { Truck, Users, ShieldCheck, MapPin, Phone, LogIn, Globe } from 'lucide-react';
import { TRANSLATIONS, Language } from './constants/translations';
import logo from './assets/logo-final.png';


const App: React.FC = () => {
  // Use pathname for top-level routing (Admin vs Customer vs Driver)
  const [pathname, setPathname] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    const cleanPath = path.startsWith(BASE_PATH) ? path.substring(BASE_PATH.length) : path;
    return cleanPath || '/';
  });
  // Use hash for internal routing within Admin dashboard (Dashboard vs Inventory)
  const [hash, setHash] = useState(window.location.hash);

  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Language State
  const [lang, setLang] = useState<Language>(() => getEcoLang());

  useEffect(() => {
    // Persist language on mount (handles ?lang= param) and changes
    setEcoLang(lang);
  }, [lang]);

  // Login Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    // Handler for SPA navigation
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      setPathname(path.startsWith(BASE_PATH) ? path.substring(BASE_PATH.length) : path);
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
    setLang(prev => {
      const newLang = prev === 'en' ? 'ta' : 'en';
      return newLang;
    });
  };

  const t = TRANSLATIONS[lang];

  // Determine which login screen to show based on URL
  let targetRole = UserRole.CUSTOMER; // Default
  if (pathname.startsWith('/admin')) targetRole = UserRole.ADMIN;
  else if (pathname.startsWith('/delivery-partner')) targetRole = UserRole.DELIVERY_PARTNER;
  else targetRole = UserRole.CUSTOMER; // Default fallback (includes /public)

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
                    hash.includes('delivery-status') ? <AdminDeliveryStatus onBack={() => window.location.hash = ''} /> :
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

  // 2. Unauthenticated Views

  // New: Welcome Page at Root (/) if no specific hash
  // Only show if strictly at root and not quick-order
  // Redirect /public to / and handle root path
  if (pathname === '/public') {
    window.location.replace(BASE_PATH || '/');
    return null;
  }

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
          // Public Landing View (Default Home)
          <PublicLanding t={t} />
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
                    onClick={() => {
                      // Go back to landing (clear hash)
                      window.location.hash = '';
                    }}
                    className="text-sm text-slate-500 hover:text-[#4CAF50]"
                  >
                    {t.backToHome}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Role Switcher for Demo/Nav */}
            <div className="bg-slate-50 p-3 flex justify-center gap-4 text-xs text-slate-400 border-t border-slate-100">
              <a href={`${BASE_PATH}/Customer#/login`} className={`hover:text-[#4CAF50] ${targetRole === UserRole.CUSTOMER ? 'font-bold text-[#4CAF50]' : ''}`}>Customer</a>
              <span>•</span>
              <a href={`${BASE_PATH}/Delivery-partner`} className={`hover:text-[#4CAF50] ${targetRole === UserRole.DELIVERY_PARTNER ? 'font-bold text-[#4CAF50]' : ''}`}>Partner</a>
              <span>•</span>
              <a href={`${BASE_PATH}/Admin`} className={`hover:text-[#4CAF50] ${targetRole === UserRole.ADMIN ? 'font-bold text-[#4CAF50]' : ''}`}>Admin</a>
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
        onClick={() => {
          // Navigate to Home Page
          if (window.location.pathname !== BASE_PATH && window.location.pathname !== '/') {
            window.location.href = BASE_PATH || '/';
          } else {
            window.location.hash = '';
          }
        }}
      >
        <img src={logo} alt="EcoExpress Logistics" className="h-12 md:h-14 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" />
      </div>

      {/* Right Side: User Controls & Language Toggle */}
      <div className="flex items-center gap-4">
        {/* Only show Language Toggle for Customers or Public pages (simple mode) */}
        {(simple || role === 'Customer') && (
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-[#4CAF50] border border-slate-200 rounded-full px-3 py-1 transition"
          >
            <Globe size={16} />
            {lang === 'en' ? 'English' : 'தமிழ்'}
          </button>
        )}

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
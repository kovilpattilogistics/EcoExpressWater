import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminInventory } from './components/AdminInventory';
import { AdminRevenue } from './components/AdminRevenue';
import { AdminCustomers } from './components/AdminCustomers'; // Import new component
import { AdminCreateOrder } from './components/AdminCreateOrder';
import { DeliveryDashboard } from './components/DeliveryDashboard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { PublicOrder } from './components/PublicOrder';
import { Input, Button, Card } from './components/SharedComponents';
import { ADMIN_CREDENTIALS, DRIVER_CREDENTIALS } from './constants';
import { getCustomers } from './services/mockService';
import { UserRole, Customer } from './types';
import { Truck, Users, ShieldCheck, MapPin, Phone, LogIn } from 'lucide-react';

const App: React.FC = () => {
  // Use pathname for top-level routing (Admin vs Customer vs Driver)
  const [pathname, setPathname] = useState(window.location.pathname.toLowerCase());
  // Use hash for internal routing within Admin dashboard (Dashboard vs Inventory)
  const [hash, setHash] = useState(window.location.hash);

  const [role, setRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      const customers = getCustomers();
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
    // Optionally redirect to home or keep on same login page
  };

  // --- RENDER LOGIC ---

  // 1. Authenticated Views
  if (role === UserRole.ADMIN) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header role="Admin" onLogout={logout} />
        <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full">
          {hash.includes('inventory') ? <AdminInventory /> :
            hash.includes('revenue') ? <AdminRevenue /> :
              hash.includes('customers') ? <AdminCustomers /> :
                hash.includes('create-order') ? <AdminCreateOrder onBack={() => window.location.hash = ''} /> :
                  <AdminDashboard onNavigate={(page) => window.location.hash = `#/${page}`} />}
        </main>
        <Footer />
      </div>
    );
  }

  if (role === UserRole.DELIVERY_PARTNER) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header role="Delivery Partner" onLogout={logout} />
        <main className="flex-grow p-4 md:p-6 w-full max-w-lg mx-auto">
          <DeliveryDashboard onLogout={logout} />
        </main>
        <Footer />
      </div>
    );
  }

  if (role === UserRole.CUSTOMER && currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Header role="Customer" onLogout={logout} userName={currentUser.name} />
        <main className="flex-grow p-4 md:p-6 w-full max-w-2xl mx-auto">
          <CustomerDashboard customer={currentUser} onLogout={logout} />
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Unauthenticated Login Views (Based on targetRole)

  // Quick Order route check
  if (hash.includes('quick-order') || pathname.includes('quick-order')) {
    return (
      <>
        <Header onLogout={() => { }} simple />
        <PublicOrder />
        <Footer />
      </>
    );
  }

  // Configurations for different login pages
  const loginConfig = {
    [UserRole.ADMIN]: {
      title: "Admin Portal",
      subtitle: "Secure Access for Management",
      icon: ShieldCheck,
      colorClass: "bg-slate-800",
      textClass: "text-slate-800",
      placeholder: "admin@ecoexpress.com"
    },
    [UserRole.DELIVERY_PARTNER]: {
      title: "Delivery Partner",
      subtitle: "Track, Deliver, Update",
      icon: Truck,
      colorClass: "bg-[#4CAF50]", // Brand Green
      textClass: "text-[#4CAF50]",
      placeholder: "driver@fleet.com"
    },
    [UserRole.CUSTOMER]: {
      title: "Customer Login",
      subtitle: "Order Water & Track Delivery",
      icon: Users,
      colorClass: "bg-blue-600",
      textClass: "text-blue-600",
      placeholder: "customer@email.com"
    }
  }[targetRole];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <Header onLogout={() => { }} simple />

      <div className="flex-grow flex items-center justify-center p-4">
        {targetRole === UserRole.CUSTOMER && !hash.includes('login') ? (
          // Customer Landing View (Thirsty?)
          <div className="w-full max-w-2xl flex flex-col items-center text-center animate-fadeIn">
            <div className="mb-6 relative w-48 h-48 bg-white rounded-full p-4 shadow-lg flex items-center justify-center">
              <img src="/logo.png" alt="EcoExpress" className="w-32 h-auto object-contain" />
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">
              Thirsty? <span className="text-[#4CAF50]">Get Water Now.</span>
            </h1>

            <p className="text-slate-600 text-lg mb-8 max-w-md">
              Premium quality water delivered to your doorstep in minutes. Order cans or bottles effortlessly.
            </p>

            <div className="w-full max-w-xs flex flex-col gap-4">
              <Button
                className="w-full py-4 text-lg shadow-xl shadow-green-100/50"
                onClick={() => window.location.href = '#/quick-order'}
              >
                Place Quick Order
              </Button>

              <div className="relative flex items-center justify-center">
                <span className="bg-slate-50 px-2 text-slate-400 text-sm">or</span>
              </div>

              <button
                onClick={() => window.location.hash = '#/login'}
                className="text-[#4CAF50] font-bold hover:underline"
              >
                Login to your account
              </button>
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
                label="Username / Email"
                placeholder={loginConfig.placeholder}
                value={username}
                onChange={e => setUsername(e.target.value)}
              />

              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <a href="#" className="text-xs text-[#4CAF50] hover:underline">Forgot Password?</a>
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
                  Remember me
                </label>
              </div>

              <Button
                className="w-full py-3 text-lg shadow-lg shadow-green-100"
                onClick={handleLogin}
                isLoading={isLoading}
                icon={LogIn}
              >
                Sign In
              </Button>

              {targetRole === UserRole.CUSTOMER && (
                <div className="mt-6 text-center border-t border-slate-100 pt-4">
                  <button
                    onClick={() => window.location.hash = ''} // Go back to landing
                    className="text-sm text-slate-500 hover:text-[#4CAF50]"
                  >
                    ← Back to Home
                  </button>
                </div>
              )}
            </div>

            {/* Quick Role Switcher for Demo/Nav */}
            <div className="bg-slate-50 p-3 flex justify-center gap-4 text-xs text-slate-400 border-t border-slate-100">
              <a href="/Customer" className={`hover:text-[#4CAF50] ${targetRole === UserRole.CUSTOMER ? 'font-bold text-[#4CAF50]' : ''}`}>Customer</a>
              <span>•</span>
              <a href="/Delivery-partner" className={`hover:text-[#4CAF50] ${targetRole === UserRole.DELIVERY_PARTNER ? 'font-bold text-[#4CAF50]' : ''}`}>Partner</a>
              <span>•</span>
              <a href="/Admin" className={`hover:text-[#4CAF50] ${targetRole === UserRole.ADMIN ? 'font-bold text-[#4CAF50]' : ''}`}>Admin</a>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

// --- Sub Components ---

const Header: React.FC<{ role?: string, onLogout: () => void, userName?: string, simple?: boolean }> = ({ role, onLogout, userName, simple }) => (
  <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 h-16 relative flex items-center justify-between">
      {/* Left Side: Role Indicator (if not simple) */}
      <div className="flex items-center gap-3">
        {!simple && role && (
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider hidden md:block">
            {role} Portal
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

      {/* Right Side: User Controls */}
      {!simple && (
        <div className="flex items-center gap-4">
          {userName && <span className="text-sm font-medium text-slate-600 hidden md:block">Hi, {userName}</span>}
          <button onClick={onLogout} className="text-sm text-red-500 hover:text-red-700 font-medium">Logout</button>
        </div>
      )}
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-slate-800 text-slate-400 py-8 mt-auto">
    <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
      <div>
        <h4 className="text-white font-bold mb-3">EcoExpress Logistics</h4>
        <p>Premium water delivery service ensuring hydration across Kovilpatti.</p>
      </div>
      <div className="md:text-right">
        <h4 className="text-white font-bold mb-3">Kovilpatti Operations</h4>
        <p className="flex items-center gap-2 mb-1 md:justify-end"><MapPin size={14} /> Valluvar Nagar, kadalaiyur road, kovilpatti - 628501</p>
        <p className="flex items-center gap-2 md:justify-end"><Phone size={14} /> +91 99946 04274, +91 63810 65877</p>
      </div>
    </div>
    <div className="text-center mt-8 pt-8 border-t border-slate-700 text-xs">
      &copy; 2026 EcoExpress Logistics. All rights reserved.
    </div>
  </footer>
);

export default App;
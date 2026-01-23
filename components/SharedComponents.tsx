import React, { createContext, useContext, useState, useEffect } from 'react';
import { LucideIcon, X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const Card: React.FC<{
  children: React.ReactNode,
  className?: string,
  title?: string,
  action?: React.ReactNode,
  icon?: LucideIcon,
  onClick?: () => void
}> = ({ children, className = '', title, action, icon: Icon, onClick }) => (
  <div
    className={`bg-white rounded-lg shadow-md border border-slate-200 p-4 ${className} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
    onClick={onClick}
  >
    {(title || action || Icon) && (
      <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="text-[#4CAF50]" size={20} />}
          {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    {children}
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'success', icon?: LucideIcon, isLoading?: boolean }> = ({
  children, variant = 'primary', className = '', icon: Icon, isLoading, ...props
}) => {
  const baseStyle = "px-4 py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95";
  const variants = {
    // Primary is now Tamil Nadu Green
    primary: "bg-[#4CAF50] text-white hover:bg-[#43a047]",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300",
    danger: "bg-red-500 text-white hover:bg-red-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700"
  };
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} disabled={isLoading || props.disabled} {...props}>
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
      ) : (
        Icon && <Icon size={18} />
      )}
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }> = ({ label, error, className = '', onChange, ...props }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.type === 'number' && e.target.value) {
      // Remove leading zeros, but allow "0" itself (e.g., "01" -> "1", "0" -> "0")
      e.target.value = e.target.value.replace(/^0+(?=\d)/, '');
    }
    if (onChange) onChange(e);
  };

  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>}
      <input
        className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent transition-all ${error ? 'border-red-500' : 'border-slate-300'} ${className}`}
        onChange={handleChange}
        {...props}
      />
      {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
    </div>
  );
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: { value: string, label: string }[] }> = ({ label, options, className = '', ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>}
    <select className={`w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#4CAF50] focus:border-transparent ${className}`} {...props}>
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

export const StatusBadge: React.FC<{ status: string, className?: string }> = ({ status, className = '' }) => {
  let color = "bg-gray-100 text-gray-800";
  if (status.includes("Pending")) color = "bg-amber-100 text-amber-800 border border-amber-200";
  if (status.includes("Confirmed")) color = "bg-blue-100 text-blue-800 border border-blue-200";
  if (status.includes("Dispatched") || status.includes("Delivery")) color = "bg-purple-100 text-purple-800 border border-purple-200";
  if (status.includes("Delivered") || status.includes("picked")) color = "bg-green-100 text-green-800 border border-green-200";

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color} ${className}`}>
      {status}
    </span>
  );
};

// --- New Components ---

// Modal Component
export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fadeIn">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// Toast Context & Hook
type ToastType = 'success' | 'error' | 'info';
interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{
  showToast: (message: string, type: ToastType) => void;
}>({ showToast: () => { } });

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000); // Auto dismiss after 3s
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto min-w-[300px] p-4 rounded-lg shadow-lg border-l-4 flex items-center gap-3 animate-slideIn bg-white ${t.type === 'success' ? 'border-green-500' :
              t.type === 'error' ? 'border-red-500' :
                'border-blue-500'
            }`}>
            {t.type === 'success' && <CheckCircle size={20} className="text-green-500" />}
            {t.type === 'error' && <AlertCircle size={20} className="text-red-500" />}
            {t.type === 'info' && <Info size={20} className="text-blue-500" />}
            <p className="text-sm font-medium text-slate-800">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const { showToast } = useContext(ToastContext);
  return {
    success: (msg: string) => showToast(msg, 'success'),
    error: (msg: string) => showToast(msg, 'error'),
    info: (msg: string) => showToast(msg, 'info'),
  };
};
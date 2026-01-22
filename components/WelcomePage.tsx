import React from 'react';
import { Button } from './SharedComponents';
import { ArrowRight, MapPin } from 'lucide-react';

interface WelcomePageProps {
    onEnter: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onEnter }) => {
    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Abstract Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#4CAF50]/20 rounded-full blur-[100px] animate-pulse delay-700"></div>
            </div>

            <div className="relative z-10 w-full max-w-md text-center">
                {/* Logo Area */}
                <div className="mb-10 animate-fadeScale">
                    <div className="w-28 h-28 bg-white/10 backdrop-blur-md rounded-2xl p-4 mx-auto border border-white/10 shadow-2xl flex items-center justify-center">
                        <img src="/logo.png" alt="EcoExpress" className="w-full h-full object-contain brightness-125" />
                    </div>
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                    EcoExpress <span className="text-[#4CAF50]">Logistics</span>
                </h1>

                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-12 uppercase tracking-widest font-bold">
                    <MapPin size={14} className="text-[#4CAF50]" />
                    <span>Kovilpatti, Tamil Nadu</span>
                </div>

                <div className="space-y-4 animate-slideUp">
                    <Button
                        onClick={onEnter}
                        className="w-full py-4 text-lg bg-white text-slate-900 hover:bg-slate-100 border-none shadow-xl shadow-white/10 group"
                    >
                        Enter Website
                        <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                    </Button>

                    <p className="text-slate-500 text-xs mt-8">
                        Premium Water Delivery Service
                    </p>
                </div>
            </div>

            <div className="absolute bottom-6 text-center w-full z-10">
                <p className="text-slate-600 text-[10px] uppercase font-bold tracking-widest">© 2026 EcoExpress Logistics</p>
            </div>
        </div>
    );
};

import React from 'react';
import { Button } from './SharedComponents';
import { ArrowRight } from 'lucide-react';

interface WelcomePageProps {
    onEnter: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onEnter }) => {
    return (
        <div className="min-h-screen relative overflow-hidden font-sans">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
                <img src="/ev-drivers.png" alt="EcoExpress Electric Fleet" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
            </div>

            {/* Top Right CTA - Book Water */}
            <div className="absolute top-4 right-4 z-20">
                <Button
                    onClick={onEnter}
                    className="bg-[#4CAF50] hover:bg-[#43a047] text-white px-6 py-2 rounded-full shadow-lg shadow-green-900/20 font-bold flex items-center gap-2 animate-bounce-slow"
                >
                    <span className="text-sm">Book Water</span>
                    <ArrowRight size={16} />
                </Button>
            </div>

            <div className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center p-6 text-center">

                {/* Logo Area */}
                <div className="mb-8 animate-fadeScale">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl p-3 mx-auto border border-white/20 shadow-2xl flex items-center justify-center">
                        <img src="/logo.png" alt="EcoExpress" className="w-full h-full object-contain brightness-125" />
                    </div>
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 tracking-tight drop-shadow-lg">
                    EcoExpress <span className="text-[#4CAF50]">Logistics</span>
                </h1>

                <p className="text-slate-200 text-lg md:text-xl max-w-xl mx-auto mb-10 font-medium drop-shadow-md">
                    Sustainable & Efficient Logistics Solutions
                </p>

                {/* Main Action (optional, or just informational) */}
                <div className="space-y-4 animate-slideUp">
                    <p className="text-slate-400 text-sm uppercase tracking-widest font-bold">
                        Powered by 100% Electric Fleet
                    </p>
                </div>
            </div>

            <div className="absolute bottom-6 text-center w-full z-10">
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">© 2026 EcoExpress Logistics</p>
            </div>
        </div>
    );
};

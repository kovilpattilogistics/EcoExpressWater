import React from 'react';
import { Truck, Users, ShieldCheck, Zap, Recycle, Smartphone, Clock, Star, LogIn, ShoppingBag } from 'lucide-react';
import logo from '../assets/logo-final.png';
import { Button } from './SharedComponents';
import { BASE_PATH } from '../constants';

interface PublicLandingProps {
    t: any;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({ t }) => {
    return (
        <div className="w-full max-w-lg flex flex-col items-center animate-fadeIn pb-12 pt-6 relative">

            {/* Background Water Image - Fixed Position (Handled by Parent/Layout usually, but kept here for fidelity) */}
            <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
                <img src={`${BASE_PATH}/water-bg.png`} alt="" className="w-full h-full object-cover" />
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
                    <div className="mb-6 flex items-center justify-center mx-auto">
                        <img src={logo} alt="EcoExpress" className="h-32 md:h-40 w-auto object-contain drop-shadow-md transition-transform hover:scale-105" />
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
                            className="w-full py-4 text-lg font-bold text-white bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-xl shadow-green-300/50 hover:shadow-green-400 hover:scale-105 active:scale-95 transition-all duration-300 transform flex items-center justify-center gap-2"
                            onClick={() => window.location.href = '#/quick-order'}
                        >
                            <ShoppingBag className="w-5 h-5 animate-bounce" />
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
    );
};

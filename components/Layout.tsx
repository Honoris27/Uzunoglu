import React from 'react';
import { DatabaseIcon, TagIcon, UsersIcon, WalletIcon, CheckCircleIcon } from './Icons';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  years: number[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  isDarkMode: boolean;
  siteTitle?: string;
  logoUrl?: string;
}

const NavItem = ({ id, label, icon: Icon, active, onClick }: any) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 group ${
      active 
        ? 'bg-white/80 dark:bg-white/10 shadow-sm font-semibold text-primary-600 dark:text-white' 
        : 'text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-white/5'
    }`}
  >
    <Icon className={`w-4 h-4 ${active ? 'text-primary-600 dark:text-white' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400'}`} />
    {label}
    {active && <div className="ml-auto w-1 h-4 bg-primary-600 rounded-full"></div>}
  </button>
);

const Layout: React.FC<LayoutProps> = ({ 
  children, activePage, onNavigate, onLogout, years, selectedYear, onYearChange, isDarkMode, siteTitle, logoUrl
}) => {
  return (
    <div className={`fixed inset-4 md:inset-8 rounded-xl overflow-hidden shadow-2xl flex flex-col border border-white/20 ${isDarkMode ? 'dark' : ''}`}>
      {/* Title Bar */}
      <div className="h-8 bg-gray-200 dark:bg-slate-800 flex items-center justify-between px-3 select-none draggable-region z-50">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
             {logoUrl ? <img src={logoUrl} className="w-4 h-4 object-contain"/> : <span>🐄</span>}
             <span>{siteTitle || "BANA Kurban Yönetim Sistemi"}</span>
          </div>
          <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
          </div>
      </div>

      {/* Main Window Content */}
      <div className="flex-1 flex overflow-hidden mica-effect">
        {/* Sidebar (Acrylic) */}
        <aside className="w-64 flex flex-col border-r border-gray-200/50 dark:border-gray-700/50 acrylic-sidebar transition-all duration-300">
          <div className="p-6">
             <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
               {siteTitle || "BANA Kurban"}
             </h1>
          </div>

          <div className="px-4 mb-4">
            <div className="bg-white/50 dark:bg-black/20 rounded-lg p-2 border border-gray-200/50 dark:border-gray-700/30">
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1 px-1">Sezon</label>
                <select 
                    value={selectedYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    className="w-full bg-transparent text-sm font-semibold outline-none dark:text-white"
                >
                    {years.map(y => (
                    <option key={y} value={y} className="text-gray-900">{y}</option>
                    ))}
                </select>
            </div>
          </div>

          <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
            <NavItem id="dashboard" label="Genel Bakış" icon={DatabaseIcon} active={activePage === 'dashboard'} onClick={onNavigate} />
            <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Yönetim</div>
            <NavItem id="animals" label="Hayvanlar" icon={TagIcon} active={activePage === 'animals'} onClick={onNavigate} />
            <NavItem id="customers" label="Müşteriler" icon={UsersIcon} active={activePage === 'customers'} onClick={onNavigate} />
            <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Operasyon</div>
            <NavItem id="sales" label="Satış & Kasa" icon={WalletIcon} active={activePage === 'sales'} onClick={onNavigate} />
            <NavItem id="slaughterhouse" label="Kesimhane" icon={CheckCircleIcon} active={activePage === 'slaughterhouse'} onClick={onNavigate} />
          </nav>

          <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
             <NavItem id="settings" label="Ayarlar" icon={(p:any) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} active={activePage === 'settings'} onClick={onNavigate} />
             <button 
                onClick={onLogout}
                className="mt-2 w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Oturumu Kapat
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm p-8 scroll-smooth relative">
           {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'
    }`}
  >
    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
    {label}
  </button>
);

const Layout: React.FC<LayoutProps> = ({ 
  children, activePage, onNavigate, onLogout, years, selectedYear, onYearChange, isDarkMode, siteTitle, logoUrl
}) => {
  return (
    <div className="fixed inset-0 bg-slate-100 flex items-center justify-center p-4 md:p-6">
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl overflow-hidden flex border border-slate-200">
        
        {/* Sidebar */}
        <aside className="w-72 flex flex-col bg-white border-r border-slate-100">
          <div className="p-8 pb-4">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-blue-200 shadow-lg">
                    {logoUrl ? <img src={logoUrl} className="w-6 h-6 object-contain"/> : 
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
                </div>
                <div>
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">
                        {siteTitle || "BANA Kurban"}
                    </h1>
                    <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Yönetim Paneli</span>
                </div>
             </div>

             <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 px-1">Aktif Sezon</label>
                <select 
                    value={selectedYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                >
                    {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            <NavItem id="dashboard" label="Genel Bakış" icon={DatabaseIcon} active={activePage === 'dashboard'} onClick={onNavigate} />
            <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Kayıt İşlemleri</div>
            <NavItem id="animals" label="Hayvan Listesi" icon={TagIcon} active={activePage === 'animals'} onClick={onNavigate} />
            <NavItem id="customers" label="Müşteri Listesi" icon={UsersIcon} active={activePage === 'customers'} onClick={onNavigate} />
            <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Finans & Takip</div>
            <NavItem id="sales" label="Satış ve Kasa" icon={WalletIcon} active={activePage === 'sales'} onClick={onNavigate} />
            <NavItem id="slaughterhouse" label="Kesimhane" icon={CheckCircleIcon} active={activePage === 'slaughterhouse'} onClick={onNavigate} />
          </nav>

          <div className="p-4 border-t border-slate-100">
             <button 
                onClick={() => onNavigate('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activePage === 'settings' ? 'bg-slate-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
             >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 Ayarlar
             </button>
             <button 
                onClick={onLogout}
                className="mt-2 w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Çıkış Yap
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-10">
                <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-sm font-medium">Hoşgeldiniz</span>
                </div>
                <div className="flex items-center gap-4">
                     <div className="text-right hidden md:block">
                         <div className="text-xs font-bold text-slate-800">Yönetici Hesabı</div>
                         <div className="text-[10px] text-slate-500">Tam Yetkili</div>
                     </div>
                     <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                         </svg>
                     </div>
                </div>
            </header>
            
           <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
             {children}
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
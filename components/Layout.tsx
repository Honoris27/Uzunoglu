
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
}

const NavItem = ({ id, label, icon: Icon, active, onClick }: any) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
      active 
        ? 'bg-primary-600 text-white shadow-sm' 
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
    }`}
  >
    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
    {label}
  </button>
);

const Layout: React.FC<LayoutProps> = ({ 
  children, activePage, onNavigate, onLogout, years, selectedYear, onYearChange, isDarkMode 
}) => {
  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <aside className={`w-64 fixed inset-y-0 left-0 z-20 flex flex-col border-r ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
           <TagIcon className="w-8 h-8 text-primary-600 mr-2" />
           <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
             BANA <span className="text-primary-600">Kurban</span>
           </span>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <label className={`block text-xs font-semibold uppercase mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Çalışma Yılı
          </label>
          <select 
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className={`w-full rounded-md border text-sm p-2 outline-none focus:ring-2 focus:ring-primary-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem id="dashboard" label="Genel Bakış" icon={DatabaseIcon} active={activePage === 'dashboard'} onClick={onNavigate} />
          <NavItem id="animals" label="Hayvan Yönetimi" icon={TagIcon} active={activePage === 'animals'} onClick={onNavigate} />
          <NavItem id="sales" label="Satış & Ödeme" icon={WalletIcon} active={activePage === 'sales'} onClick={onNavigate} />
          <NavItem id="customers" label="Müşteri Listesi" icon={UsersIcon} active={activePage === 'customers'} onClick={onNavigate} />
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <button
               onClick={() => window.open(window.location.href + '?mode=tv', '_blank')}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20`}
            >
              <CheckCircleIcon className="w-5 h-5" />
              Canlı Takip (TV)
            </button>
             <NavItem id="settings" label="Ayarlar" icon={(p:any) => <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} active={activePage === 'settings'} onClick={onNavigate} />
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
          >
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ml-64 p-8 transition-colors ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;

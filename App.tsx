
import React, { useState, useEffect, useMemo } from 'react';
import { Animal, AnimalType, Shareholder, ShareStatus, DashboardStats, AppSettings, SlaughterStatus } from './types';
import { animalService, shareService, configService } from './services/supabaseService';
import { SQL_SETUP_SCRIPT } from './constants';
import { PlusIcon, UsersIcon, WalletIcon, TagIcon, TrashIcon, CheckCircleIcon, DatabaseIcon } from './components/Icons';
import Modal from './components/Modal';
import Layout from './components/Layout';

// Sub-components (simulating pages)
import LoginPage from './pages/LoginPage';
import AnimalsPage from './pages/AnimalsPage';
import SalesPage from './pages/SalesPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import LiveTVPage from './pages/LiveTVPage';

function App() {
  // Global State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [settings, setSettings] = useState<AppSettings>({ theme: 'light', id: 0, admin_password: '' });
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // URL check for TV Mode (Simple routing)
  const isTVMode = new URLSearchParams(window.location.search).get('mode') === 'tv';

  // Initialization
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        
        // Load Settings
        const appSettings = await configService.getSettings();
        setSettings(appSettings);
        
        // Load Years
        const years = await configService.getYears();
        if (years.length > 0) {
          setAvailableYears(years);
          // If selected year not in list, pick first
          if (!years.includes(selectedYear)) setSelectedYear(years[0]);
        } else {
            // First run, add current year
            await configService.addYear(selectedYear);
        }

        // Check Local Storage Auth
        const storedAuth = localStorage.getItem('kurban_auth');
        if (storedAuth === 'true') setIsAuthenticated(true);

      } catch (err) {
        console.error("Init error", err);
      } finally {
        setLoading(false);
      }
    };

    if (!isTVMode) init();
  }, []);

  // Fetch Animals when Year changes or Auth changes
  useEffect(() => {
    if (isAuthenticated && !isTVMode) {
      loadAnimals();
    }
  }, [isAuthenticated, selectedYear]);

  const loadAnimals = async () => {
    try {
      setLoading(true);
      const data = await animalService.getAll(selectedYear);
      setAnimals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const handleLogin = (password: string) => {
    if (password === settings.admin_password) {
      setIsAuthenticated(true);
      localStorage.setItem('kurban_auth', 'true');
    } else {
      alert("Hatalı şifre!");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('kurban_auth');
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  // Dashboard Stats
  const stats: DashboardStats = useMemo(() => {
    let totalAnimals = animals.length;
    let totalSoldShares = 0;
    let totalRevenue = 0;
    let totalPending = 0;

    animals.forEach(a => {
      const shares = a.shares || [];
      totalSoldShares += shares.length;
      shares.forEach(s => {
        totalRevenue += s.amount_paid;
        if (s.status !== ShareStatus.Paid) {
          totalPending += (s.amount_agreed - s.amount_paid);
        }
      });
    });

    return { totalAnimals, totalSoldShares, totalRevenue, totalPending };
  }, [animals]);


  // RENDER LOGIC

  if (isTVMode) {
    return <LiveTVPage />; // No auth required for TV usually, or pass a key. For demo, open.
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} settings={settings} />;
  }

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold dark:text-white">Genel Durum - {selectedYear}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Toplam Hayvan" value={stats.totalAnimals} icon={TagIcon} color="blue" />
              <StatCard title="Satılan Hisse" value={stats.totalSoldShares} icon={UsersIcon} color="green" />
              <StatCard title="Kasa (Tahsilat)" value={stats.totalRevenue} icon={WalletIcon} color="emerald" isCurrency />
              <StatCard title="Bekleyen Alacak" value={stats.totalPending} icon={CheckCircleIcon} color="orange" isCurrency />
            </div>
          </div>
        );
      case 'animals':
        return <AnimalsPage animals={animals} selectedYear={selectedYear} refresh={loadAnimals} />;
      case 'sales':
        return <SalesPage animals={animals} refresh={loadAnimals} />;
      case 'customers':
        return <CustomersPage animals={animals} />;
      case 'settings':
        return <SettingsPage settings={settings} availableYears={availableYears} onRefresh={() => window.location.reload()} />;
      default:
        return <div>Sayfa bulunamadı</div>;
    }
  };

  return (
    <Layout 
      activePage={activePage} 
      onNavigate={setActivePage} 
      onLogout={handleLogout}
      years={availableYears}
      selectedYear={selectedYear}
      onYearChange={handleYearChange}
      isDarkMode={settings.theme === 'dark'}
    >
      {renderContent()}
    </Layout>
  );
}

// Simple Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, isCurrency }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colors[color]} dark:bg-opacity-10`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isCurrency 
              ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value)
              : value}
          </h3>
        </div>
      </div>
    </div>
  );
}

export default App;

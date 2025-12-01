import React, { useState, useEffect, useMemo } from 'react';
import { Animal, AnimalType, Shareholder, ShareStatus, DashboardStats } from './types';
import { animalService, shareService } from './services/supabaseService';
import { SQL_SETUP_SCRIPT } from './constants';
import { 
  PlusIcon, UsersIcon, WalletIcon, TagIcon, TrashIcon, CheckCircleIcon, DatabaseIcon 
} from './components/Icons';
import Modal from './components/Modal';

interface AnimalCardProps {
  animal: Animal;
  onOpenShareModal: (animal: Animal) => void;
  onDeleteShare: (id: string) => void;
  onDeleteAnimal: (id: string) => void;
}

const AnimalCard: React.FC<AnimalCardProps> = ({ animal, onOpenShareModal, onDeleteShare, onDeleteAnimal }) => {
  const maxShares = animal.type === AnimalType.Big ? 7 : 1;
  const currentShares = animal.shares?.length || 0;
  const progress = (currentShares / maxShares) * 100;
  const isFull = currentShares >= maxShares;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
                animal.type === AnimalType.Big ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {animal.type === AnimalType.Big ? 'Büyükbaş' : 'Küçükbaş'}
              </span>
              <span className="text-gray-500 text-sm font-mono">#{animal.tag_number}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mt-2">{animal.weight_kg} KG</h3>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary-600">
              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(animal.total_price)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1 text-gray-600">
              <span>Hisse Durumu</span>
              <span className="font-medium">{currentShares} / {maxShares}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${isFull ? 'bg-red-500' : 'bg-primary-500'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Shareholders List (Compact) */}
          <div className="space-y-2 mt-4">
            {animal.shares && animal.shares.length > 0 ? (
              animal.shares.map(share => (
                <div key={share.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-800">{share.name}</span>
                    <span className="text-xs text-gray-500">{share.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className={`text-xs px-1.5 py-0.5 rounded ${
                       share.status === ShareStatus.Paid ? 'bg-green-100 text-green-700' :
                       share.status === ShareStatus.Partial ? 'bg-yellow-100 text-yellow-700' :
                       'bg-red-100 text-red-700'
                     }`}>
                       {share.status === ShareStatus.Paid ? 'Ödendi' : share.status === ShareStatus.Partial ? 'Kısmi' : 'Bekliyor'}
                     </span>
                     <button onClick={() => onDeleteShare(share.id)} className="text-gray-400 hover:text-red-500">
                       <TrashIcon className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 italic text-center py-2">Henüz hisse satılmadı.</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {!isFull && (
            <button 
              onClick={() => onOpenShareModal(animal)}
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Hisse Sat
            </button>
          )}
           <button 
              onClick={() => onDeleteAnimal(animal.id)}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  // State
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal States
  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  
  // Selection State
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);

  // Forms State
  const [newAnimal, setNewAnimal] = useState({
    tag_number: '',
    type: AnimalType.Big,
    weight_kg: '',
    total_price: '',
    notes: ''
  });

  const [newShare, setNewShare] = useState({
    name: '',
    phone: '',
    amount_agreed: '',
    amount_paid: '0',
    status: ShareStatus.Unpaid
  });

  // Fetch Data
  const fetchAnimals = async () => {
    try {
      setLoading(true);
      const data = await animalService.getAll();
      setAnimals(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Veriler yüklenemedi. Veritabanı tabloları oluşturulmamış olabilir.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnimals();
  }, []);

  // Handlers
  const handleAddAnimal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await animalService.create({
        tag_number: newAnimal.tag_number,
        type: newAnimal.type,
        weight_kg: Number(newAnimal.weight_kg),
        total_price: Number(newAnimal.total_price),
        notes: newAnimal.notes
      });
      setIsAnimalModalOpen(false);
      setNewAnimal({ tag_number: '', type: AnimalType.Big, weight_kg: '', total_price: '', notes: '' });
      fetchAnimals();
    } catch (err) {
      alert("Hayvan eklenirken hata oluştu.");
    }
  };

  const handleOpenShareModal = (animal: Animal) => {
    setSelectedAnimal(animal);
    
    // Auto calculate suggested share price
    const maxShares = animal.type === AnimalType.Big ? 7 : 1;
    // const currentShares = animal.shares?.length || 0;
    
    // Simple logic: If no shares yet, suggest total / max. 
    // If shares exist, maybe just keep using the same average, but usually it's fixed per animal.
    const suggestedPrice = Math.floor(animal.total_price / maxShares);

    setNewShare({
      name: '',
      phone: '',
      amount_agreed: suggestedPrice.toString(),
      amount_paid: '0',
      status: ShareStatus.Unpaid
    });
    setIsShareModalOpen(true);
  };

  const handleAddShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;

    try {
      await shareService.create({
        animal_id: selectedAnimal.id,
        name: newShare.name,
        phone: newShare.phone,
        amount_agreed: Number(newShare.amount_agreed),
        amount_paid: Number(newShare.amount_paid),
        status: newShare.status
      });
      setIsShareModalOpen(false);
      fetchAnimals(); // Refresh to show new share
    } catch (err) {
      alert("Hissedar eklenirken hata oluştu.");
    }
  };

  const handleDeleteShare = async (id: string) => {
    if (confirm("Bu hissedarı silmek istediğinize emin misiniz?")) {
      try {
        await shareService.delete(id);
        fetchAnimals();
      } catch (err) {
        alert("Silme işlemi başarısız.");
      }
    }
  };

  const handleDeleteAnimal = async (id: string) => {
    if (confirm("Bu hayvanı ve tüm hissedarlarını silmek istediğinize emin misiniz?")) {
      try {
        await animalService.delete(id);
        fetchAnimals();
      } catch (err) {
        alert("Silme işlemi başarısız.");
      }
    }
  };

  // Stats Calculation
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

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-primary-100 p-2 rounded-lg">
                <TagIcon className="w-6 h-6 text-primary-700" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kurban<span className="text-primary-600">Sistemi</span></h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSqlModalOpen(true)}
                className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
              >
                <DatabaseIcon className="w-4 h-4" />
                Veritabanı Kurulumu
              </button>
              <button 
                onClick={() => setIsAnimalModalOpen(true)}
                className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-all shadow-sm active:scale-95"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Hayvan Ekle</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <div className="text-red-500 mt-0.5">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                 <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
               </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-800">Bağlantı Hatası</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button 
                onClick={() => setIsSqlModalOpen(true)}
                className="mt-2 text-xs font-semibold text-red-700 underline hover:text-red-900"
              >
                SQL Kurulum Kodunu Göster
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <TagIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Toplam Hayvan</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.totalAnimals}</h3>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                <UsersIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Satılan Hisse</p>
                <h3 className="text-2xl font-bold text-gray-900">{stats.totalSoldShares}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <WalletIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Tahsil Edilen</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(stats.totalRevenue)}
                </h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                <CheckCircleIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Bekleyen Ödeme</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(stats.totalPending)}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
           <div className="flex justify-center items-center h-64">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {animals.map(animal => (
              <AnimalCard 
                key={animal.id} 
                animal={animal} 
                onOpenShareModal={handleOpenShareModal}
                onDeleteShare={handleDeleteShare}
                onDeleteAnimal={handleDeleteAnimal}
              />
            ))}
            {animals.length === 0 && !error && (
              <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <TagIcon className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Henüz hayvan eklenmedi</h3>
                <p className="text-gray-500 mb-4">Satışa başlamak için sisteme yeni kurbanlık ekleyin.</p>
                <button 
                  onClick={() => setIsAnimalModalOpen(true)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Şimdi Ekle &rarr;
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Animal Modal */}
      <Modal isOpen={isAnimalModalOpen} onClose={() => setIsAnimalModalOpen(false)} title="Yeni Hayvan Ekle">
        <form onSubmit={handleAddAnimal} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Küpe Numarası</label>
            <input 
              required
              type="text" 
              value={newAnimal.tag_number}
              onChange={e => setNewAnimal({...newAnimal, tag_number: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              placeholder="Örn: TR-34-1234"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tür</label>
              <select 
                value={newAnimal.type}
                onChange={e => setNewAnimal({...newAnimal, type: e.target.value as AnimalType})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value={AnimalType.Big}>Büyükbaş</option>
                <option value={AnimalType.Small}>Küçükbaş</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Canlı Ağırlık (KG)</label>
              <input 
                required
                type="number" 
                value={newAnimal.weight_kg}
                onChange={e => setNewAnimal({...newAnimal, weight_kg: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Toplam Fiyat (TL)</label>
            <input 
              required
              type="number" 
              value={newAnimal.total_price}
              onChange={e => setNewAnimal({...newAnimal, total_price: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
            <textarea 
              rows={3}
              value={newAnimal.notes}
              onChange={e => setNewAnimal({...newAnimal, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ek bilgiler..."
            />
          </div>
          <div className="pt-2">
            <button 
              type="submit"
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Kaydet
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Share Modal */}
      <Modal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Hisse Satışı Ekle">
        <form onSubmit={handleAddShare} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hissedar Adı Soyadı</label>
            <input 
              required
              type="text" 
              value={newShare.name}
              onChange={e => setNewShare({...newShare, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ad Soyad"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input 
              required
              type="tel" 
              value={newShare.phone}
              onChange={e => setNewShare({...newShare, phone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="05XX XXX XX XX"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anlaşılan Tutar</label>
              <input 
                required
                type="number" 
                value={newShare.amount_agreed}
                onChange={e => setNewShare({...newShare, amount_agreed: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ödenen Tutar</label>
              <input 
                required
                type="number" 
                value={newShare.amount_paid}
                onChange={e => setNewShare({...newShare, amount_paid: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Durumu</label>
             <select
                value={newShare.status}
                onChange={e => setNewShare({...newShare, status: e.target.value as ShareStatus})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
             >
               <option value={ShareStatus.Unpaid}>Ödenmedi</option>
               <option value={ShareStatus.Partial}>Kısmi Ödeme</option>
               <option value={ShareStatus.Paid}>Tamamı Ödendi</option>
             </select>
          </div>
          <div className="pt-2">
            <button 
              type="submit"
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Hissedar Ekle
            </button>
          </div>
        </form>
      </Modal>

      {/* SQL Setup Modal */}
      <Modal isOpen={isSqlModalOpen} onClose={() => setIsSqlModalOpen(false)} title="Veritabanı Kurulumu">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Supabase projenizde tabloları oluşturmak için aşağıdaki SQL kodunu kopyalayın ve Supabase <strong>SQL Editor</strong> bölümünde çalıştırın.
          </p>
          <div className="bg-gray-800 rounded-lg p-4 relative group">
            <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
              {SQL_SETUP_SCRIPT}
            </pre>
            <button 
              onClick={() => navigator.clipboard.writeText(SQL_SETUP_SCRIPT)}
              className="absolute top-2 right-2 bg-white/10 text-white text-xs px-2 py-1 rounded hover:bg-white/20 transition-colors"
            >
              Kopyala
            </button>
          </div>
          <div className="text-xs text-gray-500">
            Not: Bu işlem sadece bir kez yapılmalıdır.
          </div>
          <button 
             onClick={() => setIsSqlModalOpen(false)}
             className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Kapat
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default App;
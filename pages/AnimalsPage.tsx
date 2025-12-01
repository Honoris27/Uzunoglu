
import React, { useState, useEffect, useMemo } from 'react';
import { Animal, SlaughterStatus, AppSettings } from '../types';
import { animalService, configService } from '../services/supabaseService';
import Modal from '../components/Modal';
import { PlusIcon } from '../components/Icons';

interface Props {
  animals: Animal[];
  selectedYear: number;
  refresh: () => void;
}

const AnimalsPage: React.FC<Props> = ({ animals, selectedYear, refresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    configService.getSettings().then(setSettings);
  }, []);

  const [formData, setFormData] = useState({
    tag_number: '',
    type: '',
    total_price: '',
    notes: '',
    image_url: ''
  });

  const animalTypes = settings?.animal_types && settings.animal_types.length > 0 
    ? settings.animal_types 
    : ['Büyükbaş'];

  const filteredAnimals = useMemo(() => {
      return animals.filter(a => {
          const matchesSearch = a.tag_number.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesType = filterType === 'all' || a.type === filterType;
          const matchesStatus = filterStatus === 'all' || (
             filterStatus === 'sold' ? (a.shares?.length || 0) >= a.max_shares :
             filterStatus === 'unsold' ? (a.shares?.length || 0) < a.max_shares : true
          );
          return matchesSearch && matchesType && matchesStatus;
      });
  }, [animals, searchTerm, filterType, filterStatus]);

  const openModal = (animal?: Animal) => {
    if (animal) {
      setEditingAnimal(animal);
      setFormData({
        tag_number: animal.tag_number,
        type: animal.type,
        total_price: animal.total_price.toString(),
        notes: animal.notes || '',
        image_url: animal.image_url || ''
      });
    } else {
      setEditingAnimal(null);
      setFormData({
        tag_number: '',
        type: animalTypes[0],
        total_price: '',
        notes: '',
        image_url: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setFormData(prev => ({ ...prev, image_url: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalImage = formData.image_url || settings?.default_image_url;

      const payload = {
        tag_number: formData.tag_number,
        type: formData.type,
        weight_kg: 0, 
        total_price: Number(formData.total_price),
        notes: formData.notes,
        image_url: finalImage,
        year: selectedYear,
        slaughter_status: SlaughterStatus.Barn // Default to Barn
      };

      if (editingAnimal) {
        await animalService.update(editingAnimal.id, payload);
      } else {
        const isSmall = formData.type.toLowerCase().includes('küçük') || formData.type.toLowerCase().includes('koyun') || formData.type.toLowerCase().includes('keçi');
        await animalService.create({ ...payload, max_shares: isSmall ? 1 : 7 });
      }
      setIsModalOpen(false);
      refresh();
    } catch (err) {
      alert("İşlem başarısız.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu hayvanı silmek istediğinize emin misiniz?")) {
      await animalService.delete(id);
      refresh();
    }
  };

  const handleResetShares = async (id: string) => {
    if (confirm("DİKKAT! Bu hayvana ait TÜM HİSSELER ve SATIŞ KAYITLARI SİLİNECEK. Onaylıyor musunuz?")) {
      await animalService.resetShares(id);
      refresh();
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold dark:text-white">Hayvan Listesi</h2>
            <button onClick={() => openModal()} className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-700 shadow-sm transition-colors">
                <PlusIcon className="w-5 h-5" /> Yeni Ekle
            </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
                <input 
                    type="text" 
                    placeholder="Küpe No Ara..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                />
            </div>
            <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value)}
                className="w-full md:w-48 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none"
            >
                <option value="all">Tüm Türler</option>
                {animalTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full md:w-48 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none"
            >
                <option value="all">Tüm Durumlar</option>
                <option value="sold">Dolu / Satıldı</option>
                <option value="unsold">Boş Yer Var</option>
            </select>
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1 shrink-0">
                <button 
                  onClick={() => setViewMode('list')} 
                  className={`px-3 py-1 rounded-md text-sm ${viewMode === 'list' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}
                >
                    Liste
                </button>
                <button 
                  onClick={() => setViewMode('grid')} 
                  className={`px-3 py-1 rounded-md text-sm ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}
                >
                    Kart
                </button>
            </div>
        </div>
      </div>

      {filteredAnimals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">Aramanızla eşleşen hayvan bulunamadı.</p>
        </div>
      ) : (
        <>
            {viewMode === 'list' ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Görsel</th>
                                <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Küpe No</th>
                                <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Tür</th>
                                <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Fiyat</th>
                                <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Hisse Durumu</th>
                                <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredAnimals.map(animal => (
                                <tr key={animal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                    <td className="p-4">
                                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden relative shadow-sm group-hover:scale-110 transition-transform">
                                            {animal.image_url ? (
                                                <img src={animal.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-gray-400">Yok</div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 font-bold dark:text-white">#{animal.tag_number}</td>
                                    <td className="p-4 text-sm dark:text-gray-300">{animal.type}</td>
                                    <td className="p-4 font-mono font-medium text-primary-600">
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(animal.total_price)}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full ${ (animal.shares?.length || 0) >= animal.max_shares ? 'bg-red-500' : 'bg-green-500'}`} 
                                                    style={{ width: `${Math.min(100, ((animal.shares?.length || 0) / animal.max_shares) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                {animal.shares?.length}/{animal.max_shares}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <button onClick={() => openModal(animal)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Düzenle</button>
                                            <button onClick={() => handleDelete(animal.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Sil</button>
                                        </div>
                                        {(animal.shares?.length || 0) > 0 && (
                                            <button onClick={() => handleResetShares(animal.id)} className="text-xs text-red-400 hover:text-red-600 mt-1 block">Sıfırla</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAnimals.map(animal => (
                    <div key={animal.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                        <div className="h-48 bg-gray-200 relative">
                            {animal.image_url ? (
                                <img src={animal.image_url} alt={animal.tag_number} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-900">
                                    <span className="text-sm">Resim Yok</span>
                                </div>
                            )}
                            <div className="absolute top-2 right-2 flex gap-1">
                                <span className="px-2 py-1 rounded text-xs font-bold shadow-sm bg-black/50 text-white backdrop-blur-md">
                                    {animal.type}
                                </span>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold dark:text-white">Küpe: {animal.tag_number}</h3>
                                <span className="font-mono font-bold text-primary-600 text-lg">
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(animal.total_price)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                                <span className={`${(animal.shares?.length || 0) >= animal.max_shares ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}`}>
                                Hisse: {animal.shares?.length || 0} / {animal.max_shares}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <button onClick={() => openModal(animal)} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Düzenle</button>
                                <button onClick={() => handleDelete(animal.id)} className="bg-red-50 text-red-600 py-2 rounded text-sm hover:bg-red-100 transition-colors">Sil</button>
                            </div>
                        </div>
                    </div>
                ))}
                </div>
            )}
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAnimal ? "Hayvanı Düzenle" : "Yeni Hayvan Ekle"}>
         <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                 <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Küpe No</label>
                 <input required value={formData.tag_number} onChange={e => setFormData({...formData, tag_number: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600" />
             </div>
             <div>
                 <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tür</label>
                 <select 
                    value={formData.type} 
                    onChange={e => setFormData({...formData, type: e.target.value})} 
                    className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
                 >
                     {animalTypes.map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
             </div>
             <div>
                 <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Fiyat (TL)</label>
                 <input type="number" required value={formData.total_price} onChange={e => setFormData({...formData, total_price: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600" />
             </div>
             
             <div>
                 <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Hayvan Resmi (Dosya Yükle)</label>
                 <input type="file" accept="image/*" onChange={handleFileChange} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm" />
                 {formData.image_url && <img src={formData.image_url} alt="Preview" className="h-20 w-20 object-cover mt-2 rounded border" />}
             </div>

             <div>
                 <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Notlar</label>
                 <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600" rows={3} />
             </div>
             <button type="submit" className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition-colors">Kaydet</button>
         </form>
      </Modal>
    </div>
  );
};

export default AnimalsPage;

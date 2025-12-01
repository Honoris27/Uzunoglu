
import React, { useState } from 'react';
import { Animal, AnimalType, ShareStatus, SlaughterStatus } from '../types';
import { animalService } from '../services/supabaseService';
import Modal from '../components/Modal';
import { PlusIcon, TrashIcon } from '../components/Icons';

interface Props {
  animals: Animal[];
  selectedYear: number;
  refresh: () => void;
}

// Extracted Card Component for better performance and readability
const AnimalCard = ({ 
  animal, 
  onEdit, 
  onDelete, 
  onReset 
}: { 
  animal: Animal; 
  onEdit: () => void; 
  onDelete: () => void; 
  onReset: () => void;
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-48 bg-gray-200 relative">
          {animal.image_url ? (
              <img src={animal.image_url} alt={animal.tag_number} className="w-full h-full object-cover" />
          ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-900">
                <span className="text-sm">Resim Yok</span>
              </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1">
              <span className={`px-2 py-1 rounded text-xs font-bold shadow-sm ${
                animal.type === AnimalType.Big ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
              }`}>
                  {animal.type === AnimalType.Big ? 'Büyükbaş' : 'Küçükbaş'}
              </span>
          </div>
          {animal.slaughter_status !== SlaughterStatus.Pending && (
             <div className="absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-bold bg-black/70 text-white backdrop-blur-sm">
               {animal.slaughter_status}
             </div>
          )}
      </div>
      <div className="p-4">
          <div className="flex justify-between items-start mb-2">
              <h3 className="text-xl font-bold dark:text-white">Küpe: {animal.tag_number}</h3>
              <span className="font-mono font-bold text-primary-600 text-lg">
                  {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(animal.total_price)}
              </span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
            <span>{animal.weight_kg} KG</span>
            <span className={`${(animal.shares?.length || 0) >= animal.max_shares ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}`}>
              Hisse: {animal.shares?.length || 0} / {animal.max_shares}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button 
                onClick={onEdit} 
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Düzenle
              </button>
              <button 
                onClick={onDelete} 
                className="bg-red-50 text-red-600 py-2 rounded text-sm hover:bg-red-100 transition-colors"
              >
                Sil
              </button>
              {(animal.shares?.length || 0) > 0 && (
                <button 
                  onClick={onReset} 
                  className="col-span-2 text-xs text-red-500 hover:text-red-700 hover:underline py-1 mt-1"
                >
                  Hisseleri ve Satışları Sıfırla
                </button>
              )}
          </div>
      </div>
    </div>
  );
};

const AnimalsPage: React.FC<Props> = ({ animals, selectedYear, refresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);

  const [formData, setFormData] = useState({
    tag_number: '',
    type: AnimalType.Big,
    weight_kg: '',
    total_price: '',
    notes: '',
    image_url: ''
  });

  const openModal = (animal?: Animal) => {
    if (animal) {
      setEditingAnimal(animal);
      setFormData({
        tag_number: animal.tag_number,
        type: animal.type,
        weight_kg: animal.weight_kg.toString(),
        total_price: animal.total_price.toString(),
        notes: animal.notes || '',
        image_url: animal.image_url || ''
      });
    } else {
      setEditingAnimal(null);
      setFormData({
        tag_number: '',
        type: AnimalType.Big,
        weight_kg: '',
        total_price: '',
        notes: '',
        image_url: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        tag_number: formData.tag_number,
        type: formData.type,
        weight_kg: Number(formData.weight_kg),
        total_price: Number(formData.total_price),
        notes: formData.notes,
        image_url: formData.image_url,
        year: selectedYear,
        slaughter_status: SlaughterStatus.Pending
      };

      if (editingAnimal) {
        await animalService.update(editingAnimal.id, payload);
      } else {
        await animalService.create({ ...payload, max_shares: formData.type === AnimalType.Big ? 7 : 1 });
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
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold dark:text-white">Hayvan Yönetimi</h2>
        <button onClick={() => openModal()} className="w-full sm:w-auto bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-700 shadow-sm transition-colors">
          <PlusIcon className="w-5 h-5" /> Yeni Hayvan Ekle
        </button>
      </div>

      {animals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">Bu yılda kayıtlı hayvan bulunamadı.</p>
          <button onClick={() => openModal()} className="mt-4 text-primary-600 hover:underline">İlk kaydı ekle</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {animals.map(animal => (
            <AnimalCard 
              key={animal.id} 
              animal={animal} 
              onEdit={() => openModal(animal)}
              onDelete={() => handleDelete(animal.id)}
              onReset={() => handleResetShares(animal.id)}
            />
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAnimal ? "Hayvanı Düzenle" : "Yeni Hayvan Ekle"}>
         <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                 <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Küpe No</label>
                 <input required value={formData.tag_number} onChange={e => setFormData({...formData, tag_number: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                     <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tür</label>
                     <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600">
                         <option value={AnimalType.Big}>Büyükbaş</option>
                         <option value={AnimalType.Small}>Küçükbaş</option>
                     </select>
                </div>
                <div>
                     <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Ağırlık (KG)</label>
                     <input type="number" required value={formData.weight_kg} onChange={e => setFormData({...formData, weight_kg: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600" />
                </div>
             </div>
             <div>
                 <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Fiyat (TL)</label>
                 <input type="number" required value={formData.total_price} onChange={e => setFormData({...formData, total_price: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600" />
             </div>
             <div>
                 <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Resim URL (İsteğe bağlı)</label>
                 <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="w-full border p-2 rounded dark:bg-gray-700 dark:text-white dark:border-gray-600" placeholder="https://..." />
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

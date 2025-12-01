
import React, { useState } from 'react';
import { Animal, AnimalType, ShareStatus } from '../types';
import { shareService, animalService } from '../services/supabaseService';
import Modal from '../components/Modal';

interface Props {
  animals: Animal[];
  refresh: () => void;
}

const SalesPage: React.FC<Props> = ({ animals, refresh }) => {
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    amount_agreed: '',
    amount_paid: '0',
    status: ShareStatus.Unpaid
  });

  const [maxSharesInput, setMaxSharesInput] = useState(7); // For first sale adjustment

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId);
  const isFirstSale = selectedAnimal && (!selectedAnimal.shares || selectedAnimal.shares.length === 0);

  // Suggested Price Calculation
  const suggestedPrice = selectedAnimal 
    ? Math.floor(selectedAnimal.total_price / (isFirstSale ? maxSharesInput : selectedAnimal.max_shares))
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;

    try {
      // If first sale, update animal max shares
      if (isFirstSale) {
        await animalService.update(selectedAnimal.id, { max_shares: maxSharesInput });
      }

      const share = await shareService.create({
        animal_id: selectedAnimal.id,
        name: formData.name,
        phone: formData.phone,
        amount_agreed: Number(formData.amount_agreed),
        amount_paid: Number(formData.amount_paid),
        status: formData.status as ShareStatus
      });

      setLastSale({ ...share, animal: selectedAnimal });
      setIsReceiptOpen(true);
      
      // Reset form
      setFormData({ name: '', phone: '', amount_agreed: '', amount_paid: '0', status: ShareStatus.Unpaid });
      refresh();
    } catch (err) {
      alert("Satış hatası.");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Hisse Satışı ve Ödeme</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hayvan Seçimi (Küpe No)</label>
               <select 
                 required
                 value={selectedAnimalId}
                 onChange={e => {
                     setSelectedAnimalId(e.target.value);
                     // Reset price when animal changes
                     const animal = animals.find(a => a.id === e.target.value);
                     if(animal) {
                         const shares = animal.shares?.length === 0 ? (animal.type === AnimalType.Big ? 7 : 1) : animal.max_shares;
                         setMaxSharesInput(shares);
                     }
                 }}
                 className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
               >
                 <option value="">Hayvan Seçiniz...</option>
                 {animals.filter(a => (a.shares?.length || 0) < a.max_shares).map(a => (
                   <option key={a.id} value={a.id}>
                     {a.tag_number} - {a.type} - {a.weight_kg}KG ({a.shares?.length}/{a.max_shares} Dolu)
                   </option>
                 ))}
               </select>
             </div>

             {selectedAnimal && isFirstSale && selectedAnimal.type === AnimalType.Big && (
                 <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                     <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Bu hayvan kaç hisseli olacak?</label>
                     <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">İlk satışta hisse sayısı belirlenir.</p>
                     <input 
                       type="number" 
                       min="1" 
                       max="7" 
                       value={maxSharesInput} 
                       onChange={e => setMaxSharesInput(Number(e.target.value))}
                       className="w-full p-2 border rounded"
                     />
                 </div>
             )}

             {selectedAnimal && (
               <div className="py-2">
                 <p className="text-sm text-gray-500">
                   Otomatik Hesaplanan Hisse Tutarı: <span className="font-bold text-primary-600">{suggestedPrice} TL</span>
                 </p>
               </div>
             )}

             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Müşteri Adı</label>
                   <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                   <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Telefon</label>
                   <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Anlaşılan Tutar</label>
                   <input type="number" required value={formData.amount_agreed} onChange={e => setFormData({...formData, amount_agreed: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                   <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Ödenen Tutar</label>
                   <input type="number" required value={formData.amount_paid} onChange={e => setFormData({...formData, amount_paid: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                </div>
             </div>

             <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Durum</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white">
                    <option value={ShareStatus.Unpaid}>Ödenmedi</option>
                    <option value={ShareStatus.Partial}>Kısmi Ödeme</option>
                    <option value={ShareStatus.Paid}>Tamamı Ödendi</option>
                </select>
             </div>

             <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg shadow-green-500/20">
               Satışı Tamamla
             </button>
          </form>
        </div>

        {/* Info Section */}
        <div className="hidden lg:block bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Son Satışlar</h3>
          {/* Could list recent sales here */}
          <div className="text-gray-400 text-sm text-center italic">
            Satış işlemi yapıldığında makbuz otomatik oluşturulacaktır.
          </div>
        </div>
      </div>

      <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="Satış Makbuzu">
         {lastSale && (
           <div className="bg-white p-4" id="receipt-area">
              <div className="text-center border-b pb-4 mb-4">
                 <h2 className="text-xl font-bold">Kurban Satış Makbuzu</h2>
                 <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
              </div>
              <div className="space-y-2 text-sm">
                 <div className="flex justify-between">
                    <span className="font-bold">Müşteri:</span>
                    <span>{lastSale.name}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="font-bold">Hayvan Küpe:</span>
                    <span>{lastSale.animal?.tag_number}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="font-bold">Anlaşılan Tutar:</span>
                    <span>{lastSale.amount_agreed} TL</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="font-bold">Ödenen:</span>
                    <span>{lastSale.amount_paid} TL</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="font-bold">Kalan:</span>
                    <span className="text-red-600 font-bold">{lastSale.amount_agreed - lastSale.amount_paid} TL</span>
                 </div>
              </div>
              <div className="mt-8 pt-4 border-t text-xs text-center text-gray-400">
                 Kurban Kesim Yönetim Sistemi
              </div>
              <button onClick={() => window.print()} className="w-full mt-6 bg-gray-800 text-white py-2 rounded">Yazdır</button>
           </div>
         )}
      </Modal>
    </div>
  );
};

export default SalesPage;

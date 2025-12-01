
import React, { useState, useEffect } from 'react';
import { Animal, ShareStatus, AppSettings, Shareholder } from '../types';
import { shareService, animalService, configService } from '../services/supabaseService';
import Modal from '../components/Modal';

interface Props {
  animals: Animal[];
  refresh: () => void;
}

const SalesPage: React.FC<Props> = ({ animals, refresh }) => {
  const [activeTab, setActiveTab] = useState<'sale' | 'payment'>('sale');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Payment State
  const [selectedShareholderId, setSelectedShareholderId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    configService.getSettings().then(setSettings);
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    amount_agreed: '',
    amount_paid: '0',
    status: ShareStatus.Unpaid
  });

  const [maxSharesInput, setMaxSharesInput] = useState(7); 

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId);
  const isFirstSale = selectedAnimal && (!selectedAnimal.shares || selectedAnimal.shares.length === 0);

  // Derived state for Payment Tab
  const allShareholders = animals.flatMap(a => (a.shares || []).map(s => ({ ...s, animalTag: a.tag_number, animalId: a.id })));
  const debtors = allShareholders.filter(s => s.status !== ShareStatus.Paid && (s.amount_agreed - s.amount_paid) > 0);
  const selectedDebtor = debtors.find(d => d.id === selectedShareholderId);

  const suggestedPrice = selectedAnimal 
    ? Math.floor(selectedAnimal.total_price / (isFirstSale ? maxSharesInput : selectedAnimal.max_shares))
    : 0;

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;

    try {
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

      setLastTransaction({ 
          type: 'SATIŞ',
          customer: formData.name,
          amount_total: Number(formData.amount_agreed),
          amount_paid: Number(formData.amount_paid),
          animal_tag: selectedAnimal.tag_number,
          remaining: Number(formData.amount_agreed) - Number(formData.amount_paid)
      });
      setIsReceiptOpen(true);
      
      setFormData({ name: '', phone: '', amount_agreed: '', amount_paid: '0', status: ShareStatus.Unpaid });
      refresh();
    } catch (err) {
      alert("Satış hatası.");
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDebtor) return;
      
      const payment = Number(paymentAmount);
      const newPaid = selectedDebtor.amount_paid + payment;
      const newStatus = newPaid >= selectedDebtor.amount_agreed ? ShareStatus.Paid : ShareStatus.Partial;

      try {
          await shareService.update(selectedDebtor.id, {
              amount_paid: newPaid,
              status: newStatus
          });

          setLastTransaction({
              type: 'TAHSİLAT',
              customer: selectedDebtor.name,
              amount_total: selectedDebtor.amount_agreed,
              amount_paid: payment, // Just the current payment amount for receipt
              animal_tag: selectedDebtor.animalTag,
              remaining: selectedDebtor.amount_agreed - newPaid
          });
          setIsReceiptOpen(true);
          setPaymentAmount('');
          setSelectedShareholderId('');
          refresh();
      } catch (err) {
          alert("Ödeme hatası");
      }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 dark:text-white">Kasa İşlemleri</h2>
      
      <div className="flex gap-4 mb-6">
          <button 
            onClick={() => setActiveTab('sale')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'sale' ? 'bg-primary-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
              Yeni Satış
          </button>
          <button 
            onClick={() => setActiveTab('payment')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'payment' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
              Tahsilat Yap (Borç Ödeme)
          </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          
          {activeTab === 'sale' ? (
              <form onSubmit={handleSaleSubmit} className="space-y-4">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-200">Hisse Satış Formu</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hayvan Seçimi</label>
                  <select 
                    required
                    value={selectedAnimalId}
                    onChange={e => {
                        setSelectedAnimalId(e.target.value);
                        const animal = animals.find(a => a.id === e.target.value);
                        if(animal) {
                            const shares = animal.shares?.length === 0 ? (animal.type.includes('üçük') ? 1 : 7) : animal.max_shares;
                            setMaxSharesInput(shares);
                        }
                    }}
                    className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Hayvan Seçiniz...</option>
                    {animals.filter(a => (a.shares?.length || 0) < a.max_shares).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.tag_number} - {a.type} ({a.shares?.length}/{a.max_shares} Dolu) - {a.total_price} TL
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAnimal && isFirstSale && !selectedAnimal.type.toLowerCase().includes('küçük') && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                        <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Bu hayvan kaç hisseli olacak?</label>
                        <input type="number" min="1" max="7" value={maxSharesInput} onChange={e => setMaxSharesInput(Number(e.target.value))} className="w-full p-2 border rounded" />
                    </div>
                )}

                {selectedAnimal && (
                  <div className="py-2">
                    <p className="text-sm text-gray-500">
                      Önerilen Hisse Fiyatı: <span className="font-bold text-primary-600">{suggestedPrice} TL</span>
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
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Ödenen (Şimdi)</label>
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
                  Satışı Tamamla ve Makbuz Kes
                </button>
              </form>
          ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <h3 className="text-lg font-bold mb-4 dark:text-gray-200">Borç Ödeme Formu</h3>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Müşteri Seçimi (Borçlu)</label>
                      <select 
                        required
                        value={selectedShareholderId}
                        onChange={e => setSelectedShareholderId(e.target.value)}
                        className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      >
                          <option value="">Müşteri Seçiniz...</option>
                          {debtors.map(d => (
                              <option key={d.id} value={d.id}>
                                  {d.name} - (Kalan Borç: {d.amount_agreed - d.amount_paid} TL)
                              </option>
                          ))}
                      </select>
                  </div>
                  {selectedDebtor && (
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 mb-4">
                          <p className="text-sm"><strong>Hayvan:</strong> #{selectedDebtor.animalTag}</p>
                          <p className="text-sm"><strong>Toplam Borç:</strong> {selectedDebtor.amount_agreed} TL</p>
                          <p className="text-sm"><strong>Ödenen:</strong> {selectedDebtor.amount_paid} TL</p>
                          <p className="text-lg font-bold text-red-600 mt-2">Kalan: {selectedDebtor.amount_agreed - selectedDebtor.amount_paid} TL</p>
                      </div>
                  )}
                  <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Tahsil Edilen Tutar</label>
                      <input 
                         type="number" 
                         required 
                         max={selectedDebtor ? selectedDebtor.amount_agreed - selectedDebtor.amount_paid : 0}
                         value={paymentAmount} 
                         onChange={e => setPaymentAmount(e.target.value)} 
                         className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:text-white" 
                      />
                  </div>
                  <button type="submit" disabled={!selectedDebtor} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg disabled:opacity-50">
                      Ödemeyi Al ve Makbuz Kes
                  </button>
              </form>
          )}
        </div>

        {/* Info Section */}
        <div className="hidden lg:block bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">İşlem Özeti</h3>
          <p className="text-gray-500 mb-4">
              Buradan hem yeni hisse satışı yapabilir hem de mevcut hissedarların kalan ödemelerini tahsil edebilirsiniz.
          </p>
          <div className="text-gray-400 text-sm italic border-t pt-4">
            Her işlem sonrası otomatik A4 makbuz oluşturulur.
          </div>
        </div>
      </div>

      <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="İşlem Makbuzu">
         {lastTransaction && (
           <div className="bg-white text-black p-8 font-serif" id="receipt-area">
              {/* A4 Print Layout Simulation */}
              <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                 <div>
                     <h1 className="text-2xl font-bold uppercase tracking-wider">Tahsilat Makbuzu</h1>
                     <p className="text-sm">Kurban Organizasyonu</p>
                 </div>
                 <div className="text-right">
                     <p className="font-bold">{new Date().toLocaleDateString()}</p>
                     <p className="text-sm">No: {Math.floor(Math.random() * 10000)}</p>
                 </div>
              </div>

              <div className="mb-8 p-4 border border-gray-300 rounded bg-gray-50">
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <span className="block text-xs font-bold uppercase text-gray-500">Müşteri</span>
                         <span className="text-lg font-bold">{lastTransaction.customer}</span>
                     </div>
                     <div>
                         <span className="block text-xs font-bold uppercase text-gray-500">İşlem Türü</span>
                         <span className="text-lg">{lastTransaction.type}</span>
                     </div>
                     <div>
                         <span className="block text-xs font-bold uppercase text-gray-500">Kurban Küpe No</span>
                         <span className="text-lg">#{lastTransaction.animal_tag}</span>
                     </div>
                     <div>
                         <span className="block text-xs font-bold uppercase text-gray-500">Kalan Bakiye</span>
                         <span className="text-lg text-red-600 font-bold">{lastTransaction.remaining} TL</span>
                     </div>
                 </div>
              </div>

              <div className="mb-8">
                  <table className="w-full text-left border-collapse border border-gray-300">
                      <thead className="bg-gray-100">
                          <tr>
                              <th className="border border-gray-300 p-2">Açıklama</th>
                              <th className="border border-gray-300 p-2 text-right">Tutar</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr>
                              <td className="border border-gray-300 p-2">Hisse Ödemesi / Tahsilat</td>
                              <td className="border border-gray-300 p-2 text-right font-bold">{lastTransaction.amount_paid} TL</td>
                          </tr>
                      </tbody>
                  </table>
              </div>

              {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                  <div className="mt-8 pt-4 border-t border-dashed">
                      <h4 className="font-bold mb-2 text-sm uppercase">Banka Hesap Bilgilerimiz</h4>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                          {settings.bank_accounts.map((acc, i) => (
                              <div key={i} className="flex gap-2">
                                  <span className="font-bold">{acc.bank_name}:</span>
                                  <span>{acc.name} -</span>
                                  <span className="font-mono">{acc.iban}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              <div className="mt-12 flex justify-between text-xs text-gray-500">
                  <div className="text-center w-32 pt-8 border-t border-gray-300">Teslim Eden (Kaşe/İmza)</div>
                  <div className="text-center w-32 pt-8 border-t border-gray-300">Teslim Alan</div>
              </div>

              <style>{`
                @media print {
                  @page { size: A4; margin: 1cm; }
                  body * { visibility: hidden; }
                  #receipt-area, #receipt-area * { visibility: visible; }
                  #receipt-area { position: absolute; left: 0; top: 0; width: 100%; }
                }
              `}</style>

              <button onClick={() => window.print()} className="w-full mt-6 bg-gray-900 text-white py-3 rounded hover:bg-black transition-colors print:hidden">
                  Yazdır (A4)
              </button>
           </div>
         )}
      </Modal>
    </div>
  );
};

export default SalesPage;

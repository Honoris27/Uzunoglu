
import React, { useState, useEffect } from 'react';
import { Animal, ShareStatus, AppSettings, Shareholder } from '../types';
import { shareService, animalService, configService, paymentService } from '../services/supabaseService';
import Modal from '../components/Modal';

interface Props {
  animals: Animal[];
  refresh: () => void;
}

interface TransactionRecord {
    id: number;
    time: string;
    type: string;
    customer: string;
    amount: number;
    detail: string;
}

const SalesPage: React.FC<Props> = ({ animals, refresh }) => {
  const [activeTab, setActiveTab] = useState<'sale' | 'payment'>('sale');
  const [selectedAnimalId, setSelectedAnimalId] = useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [transactionHistory, setTransactionHistory] = useState<TransactionRecord[]>([]);
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
    status: ShareStatus.Unpaid,
    share_count: 1 
  });

  const [maxSharesInput, setMaxSharesInput] = useState(7); 

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId);
  const isFirstSale = selectedAnimal && (!selectedAnimal.shares || selectedAnimal.shares.length === 0);
  
  const currentShares = selectedAnimal?.shares?.length || 0;
  const currentMaxShares = selectedAnimal ? (isFirstSale ? maxSharesInput : selectedAnimal.max_shares) : 7;
  const availableShares = currentMaxShares - currentShares;

  const allShareholders = animals.flatMap(a => (a.shares || []).map(s => ({ ...s, animalTag: a.tag_number, animalId: a.id })));
  const debtors = allShareholders.filter(s => s.status !== ShareStatus.Paid && (s.amount_agreed - s.amount_paid) > 0);
  const selectedDebtor = debtors.find(d => d.id === selectedShareholderId);

  const suggestedPrice = selectedAnimal 
    ? Math.floor(selectedAnimal.total_price / currentMaxShares)
    : 0;

  // Auto-Calculate Price whenever Animal, Max Shares, or Share Count changes
  useEffect(() => {
      if (selectedAnimal && formData.share_count > 0) {
          const pricePerShare = selectedAnimal.total_price / currentMaxShares;
          const totalAgreed = Math.floor(pricePerShare * formData.share_count);
          setFormData(prev => ({ ...prev, amount_agreed: totalAgreed.toString() }));
      }
  }, [selectedAnimalId, maxSharesInput, formData.share_count, selectedAnimal, currentMaxShares]);


  const addToHistory = (record: TransactionRecord) => {
      setTransactionHistory(prev => [record, ...prev].slice(0, 10));
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;

    if (formData.share_count > availableShares) {
        alert(`Hata: Sadece ${availableShares} adet hisse boşta.`);
        return;
    }

    try {
      if (isFirstSale) {
        await animalService.update(selectedAnimal.id, { max_shares: maxSharesInput });
      }

      const sharePrice = Number(formData.amount_agreed) / formData.share_count;
      const paidPerShare = Number(formData.amount_paid) / formData.share_count;

      for (let i = 0; i < formData.share_count; i++) {
          const newShare = await shareService.create({
            animal_id: selectedAnimal.id,
            name: formData.name,
            phone: formData.phone,
            amount_agreed: sharePrice,
            amount_paid: paidPerShare,
            status: formData.status as ShareStatus
          });

          // Log Transaction
          if (newShare && paidPerShare > 0) {
              await paymentService.create({
                  share_id: newShare.id,
                  amount: paidPerShare,
                  type: 'PAYMENT',
                  description: 'İlk Satış Ödemesi'
              });
          }
      }

      const transactionData = { 
          type: 'HİSSE SATIŞI',
          customer: formData.name,
          phone: formData.phone,
          amount_total: Number(formData.amount_agreed),
          amount_paid: Number(formData.amount_paid),
          animal_tag: selectedAnimal.tag_number,
          remaining: Number(formData.amount_agreed) - Number(formData.amount_paid),
          share_count: formData.share_count
      };

      setLastTransaction(transactionData);
      addToHistory({
          id: Date.now(),
          time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
          type: 'SATIŞ',
          customer: formData.name,
          amount: Number(formData.amount_paid),
          detail: `${formData.share_count} Hisse - #${selectedAnimal.tag_number}`
      });

      setIsReceiptOpen(true);
      
      setFormData({ name: '', phone: '', amount_agreed: '', amount_paid: '0', status: ShareStatus.Unpaid, share_count: 1 });
      refresh();
    } catch (err) {
      console.error(err);
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

          // Log Transaction
          await paymentService.create({
              share_id: selectedDebtor.id,
              amount: payment,
              type: 'PAYMENT',
              description: 'Borç Ödemesi'
          });

          const transactionData = {
              type: 'TAHSİLAT',
              customer: selectedDebtor.name,
              phone: selectedDebtor.phone,
              amount_total: selectedDebtor.amount_agreed,
              amount_paid: payment, 
              animal_tag: selectedDebtor.animalTag,
              remaining: selectedDebtor.amount_agreed - newPaid,
              share_count: 1
          };

          setLastTransaction(transactionData);
          addToHistory({
            id: Date.now(),
            time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
            type: 'TAHSİLAT',
            customer: selectedDebtor.name,
            amount: payment,
            detail: `Borç Ödeme - #${selectedDebtor.animalTag}`
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
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          
          {activeTab === 'sale' ? (
              <form onSubmit={handleSaleSubmit} className="space-y-4">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-200">Hisse Satış Formu</h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
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
                                setFormData(prev => ({...prev, share_count: 1}));
                            }
                        }}
                        className="w-full p-3 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Hayvan Seçiniz...</option>
                        {animals.filter(a => (a.shares?.length || 0) < a.max_shares).map(a => (
                        <option key={a.id} value={a.id}>
                            {a.tag_number} - {a.type} ({a.shares?.length}/{a.max_shares} Dolu) - {a.total_price} TL
                        </option>
                        ))}
                    </select>

                    {selectedAnimal && (
                         <div className="mt-2 text-sm text-gray-500 flex justify-between">
                            <span>Önerilen Hisse Fiyatı: <strong className="text-primary-600">{Math.floor(selectedAnimal.total_price / currentMaxShares)} TL</strong></span>
                            <span>Kalan Hisse: <strong className="text-red-600">{availableShares}</strong></span>
                        </div>
                    )}
                </div>

                {selectedAnimal && isFirstSale && !selectedAnimal.type.toLowerCase().includes('küçük') && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">Toplam Hisse Sayısı</label>
                            <p className="text-xs text-blue-600">Bu hayvan toplam kaç hisseye bölünecek?</p>
                        </div>
                        <input type="number" min="1" max="7" value={maxSharesInput} onChange={e => setMaxSharesInput(Number(e.target.value))} className="w-20 p-2 border rounded font-bold text-center" />
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

                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-100 dark:border-yellow-700">
                    <div className="flex gap-4 items-end">
                        <div className="w-1/4">
                             <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Kaç Hisse?</label>
                             <input 
                                type="number" 
                                min="1" 
                                max={availableShares} 
                                value={formData.share_count} 
                                onChange={e => setFormData({...formData, share_count: Number(e.target.value)})} 
                                className="w-full p-2 border rounded font-bold text-center dark:bg-gray-700 dark:text-white" 
                             />
                        </div>
                        <div className="flex-1">
                             <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Anlaşılan TOPLAM Tutar</label>
                             <input type="number" required value={formData.amount_agreed} onChange={e => setFormData({...formData, amount_agreed: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                             <p className="text-xs text-gray-500 mt-1">* Otomatik hesaplanır, değiştirebilirsiniz.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Ödenen (Şimdi)</label>
                      <input type="number" required value={formData.amount_paid} onChange={e => setFormData({...formData, amount_paid: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Durum</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white">
                            <option value={ShareStatus.Unpaid}>Ödenmedi</option>
                            <option value={ShareStatus.Partial}>Kısmi Ödeme</option>
                            <option value={ShareStatus.Paid}>Tamamı Ödendi</option>
                        </select>
                    </div>
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

        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 h-fit">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b pb-2">Son İşlemler (Bugün)</h3>
          
          {transactionHistory.length === 0 ? (
              <p className="text-gray-500 text-sm italic">Henüz işlem yapılmadı.</p>
          ) : (
              <ul className="space-y-4">
                  {transactionHistory.map(tr => (
                      <li key={tr.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm text-sm">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>{tr.time}</span>
                              <span className={`font-bold ${tr.type === 'SATIŞ' ? 'text-green-500' : 'text-blue-500'}`}>{tr.type}</span>
                          </div>
                          <div className="font-bold dark:text-white">{tr.customer}</div>
                          <div className="flex justify-between items-center mt-1">
                              <span className="text-gray-500 text-xs">{tr.detail}</span>
                              <span className="font-mono font-bold text-gray-900 dark:text-gray-200">+{tr.amount} TL</span>
                          </div>
                      </li>
                  ))}
              </ul>
          )}
        </div>
      </div>

      <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="İşlem Makbuzu">
         {lastTransaction && (
           <div className="bg-white text-black font-sans leading-relaxed p-8" id="receipt-area">
              
              <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                  <div className="flex flex-col">
                      <h1 className="text-4xl font-bold uppercase tracking-widest text-gray-900">TAHSİLAT MAKBUZU</h1>
                      <span className="text-sm text-gray-500 mt-1 uppercase tracking-wider">Kurban Satış Organizasyonu</span>
                  </div>
                  <div className="text-right">
                      <div className="text-sm font-semibold text-gray-400">TARİH</div>
                      <div className="text-xl font-bold">{new Date().toLocaleDateString('tr-TR')}</div>
                      <div className="text-xs text-gray-400 mt-1">Ref: {Math.floor(Math.random() * 100000)}</div>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="p-4 bg-gray-50 rounded border border-gray-100">
                      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Sayın</h3>
                      <p className="text-2xl font-bold text-gray-800">{lastTransaction.customer}</p>
                      <p className="text-gray-500 font-mono">{lastTransaction.phone}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded border border-gray-100">
                      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">İşlem Bilgileri</h3>
                      <div className="flex justify-between mb-1">
                          <span>İşlem:</span>
                          <span className="font-bold">{lastTransaction.type}</span>
                      </div>
                      <div className="flex justify-between">
                          <span>Kurban Küpe:</span>
                          <span className="font-bold">#{lastTransaction.animal_tag}</span>
                      </div>
                      {lastTransaction.share_count > 1 && (
                         <div className="flex justify-between text-blue-600">
                            <span>Hisse Adedi:</span>
                            <span className="font-bold">{lastTransaction.share_count} Adet</span>
                         </div>
                      )}
                  </div>
              </div>

              <table className="w-full border-collapse mb-8">
                  <thead>
                      <tr className="border-b-2 border-gray-800">
                          <th className="text-left py-3 font-bold text-gray-700">AÇIKLAMA</th>
                          <th className="text-right py-3 font-bold text-gray-700">TUTAR</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr className="border-b border-gray-200">
                          <td className="py-4 text-lg">Ödeme / Tahsilat Tutarı</td>
                          <td className="py-4 text-right text-2xl font-bold">{lastTransaction.amount_paid} TL</td>
                      </tr>
                      <tr>
                          <td className="py-3 text-sm text-gray-500 pt-4">Kalan Bakiye</td>
                          <td className="py-3 text-right text-red-600 font-bold pt-4">{lastTransaction.remaining} TL</td>
                      </tr>
                  </tbody>
              </table>

              {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                  <div className="mb-8 p-6 bg-gray-100 rounded-lg border border-dashed border-gray-300">
                      <h4 className="font-bold text-sm uppercase text-gray-500 mb-4 border-b border-gray-300 pb-2">Banka Hesap Bilgileri</h4>
                      <div className="grid grid-cols-1 gap-4 text-sm">
                          {settings.bank_accounts.map((acc, i) => (
                              <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                                  <span className="font-bold text-gray-800 w-32">{acc.bank_name}</span>
                                  <span className="text-gray-600">{acc.name}</span>
                                  <span className="font-mono bg-white px-2 py-1 rounded border ml-auto">{acc.iban}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              <button onClick={() => window.print()} className="w-full mt-8 bg-gray-900 text-white py-4 rounded-lg font-bold hover:bg-black transition-colors print:hidden shadow-xl">
                  YAZDIR (A4)
              </button>
           </div>
         )}
      </Modal>
    </div>
  );
};

export default SalesPage;

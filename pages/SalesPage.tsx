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
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Auto-Calculate Price
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
    if (!selectedAnimal || isSubmitting) return;

    if (formData.share_count > availableShares) {
        alert(`Hata: Sadece ${availableShares} adet hisse boşta. (İstenen: ${formData.share_count})`);
        return;
    }

    setIsSubmitting(true);

    try {
      // 1. Update Max Shares first if it's the first sale
      if (isFirstSale) {
        await animalService.update(selectedAnimal.id, { max_shares: Number(maxSharesInput) });
      }

      const count = Number(formData.share_count);
      const sharePrice = Number(formData.amount_agreed) / count;
      const paidPerShare = Number(formData.amount_paid) / count;

      // 2. Prepare Bulk Data
      const sharesToInsert = [];
      for (let i = 0; i < count; i++) {
          sharesToInsert.push({
            animal_id: selectedAnimal.id,
            name: formData.name,
            phone: formData.phone,
            amount_agreed: sharePrice,
            amount_paid: paidPerShare,
            status: formData.status as ShareStatus
          });
      }

      // 3. Bulk Insert Shares
      const createdShares = await shareService.createBulk(sharesToInsert);

      // 4. Create Payments if needed
      if (createdShares && createdShares.length > 0 && paidPerShare > 0) {
          const paymentsToInsert = createdShares.map(share => ({
              share_id: share.id,
              amount: paidPerShare,
              type: 'PAYMENT' as const,
              description: 'İlk Satış Ödemesi'
          }));
          await paymentService.createBulk(paymentsToInsert);
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
      alert("Satış işlemi sırasında bir hata oluştu. Lütfen bilgileri kontrol edip tekrar deneyin.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDebtor || isSubmitting) return;
      
      setIsSubmitting(true);
      const payment = Number(paymentAmount);
      const newPaid = selectedDebtor.amount_paid + payment;
      const newStatus = newPaid >= selectedDebtor.amount_agreed ? ShareStatus.Paid : ShareStatus.Partial;

      try {
          await shareService.update(selectedDebtor.id, {
              amount_paid: newPaid,
              status: newStatus
          });

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
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold dark:text-white flex items-center gap-3">
             <div className="bg-primary-100 dark:bg-primary-900/50 p-2 rounded-lg">
                <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             Satış ve Kasa İşlemleri
          </h2>
      </div>
      
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md p-1 rounded-xl inline-flex mb-8 shadow-sm border border-white/20">
          <button 
            onClick={() => setActiveTab('sale')}
            className={`px-8 py-3 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'sale' ? 'bg-white dark:bg-gray-700 shadow-md text-primary-600 dark:text-white' : 'text-gray-500 hover:bg-gray-100/50 dark:hover:bg-white/5'}`}
          >
              <span className="text-xl">🤝</span>
              YENİ SATIŞ
          </button>
          <button 
            onClick={() => setActiveTab('payment')}
            className={`px-8 py-3 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'payment' ? 'bg-white dark:bg-gray-700 shadow-md text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100/50 dark:hover:bg-white/5'}`}
          >
              <span className="text-xl">💳</span>
              TAHSİLAT (BORÇ)
          </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-md p-8 rounded-2xl shadow-sm border border-white/20">
          
          {activeTab === 'sale' ? (
              <form onSubmit={handleSaleSubmit} className="space-y-6">
                <div className="border-b border-gray-200/50 dark:border-gray-700/50 pb-4 mb-4">
                     <h3 className="text-xl font-bold dark:text-gray-200">Hisse Satış Formu</h3>
                </div>

                <div className="bg-primary-50/50 dark:bg-primary-900/10 p-5 rounded-xl border border-primary-100 dark:border-primary-800/30">
                    <label className="block text-sm font-bold text-primary-800 dark:text-primary-400 mb-2">Hayvan Seçimi</label>
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
                        className="w-full p-4 border-none rounded-xl bg-white dark:bg-gray-900/50 shadow-inner focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
                    >
                        <option value="">Hayvan Seçiniz...</option>
                        {animals.filter(a => (a.shares?.length || 0) < a.max_shares).map(a => (
                        <option key={a.id} value={a.id}>
                            #{a.tag_number} - {a.type} | Fiyat: {a.total_price} TL | Boş Hisse: {a.max_shares - (a.shares?.length || 0)}
                        </option>
                        ))}
                    </select>

                    {selectedAnimal && (
                         <div className="mt-3 flex items-center justify-between text-sm px-2">
                            <span className="text-primary-700 dark:text-primary-400 font-medium">Önerilen Hisse Fiyatı: <strong>{Math.floor(selectedAnimal.total_price / currentMaxShares)} TL</strong></span>
                            <span className="text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs font-bold">Kalan Yer: {availableShares}</span>
                        </div>
                    )}
                </div>

                {selectedAnimal && isFirstSale && !selectedAnimal.type.toLowerCase().includes('küçük') && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30 flex items-center gap-6">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">Toplam Hisse Adedi</label>
                            <p className="text-xs text-blue-600 dark:text-blue-400">Bu hayvan toplam kaç hisseye bölünecek?</p>
                        </div>
                        <input type="number" min="1" max="7" value={maxSharesInput} onChange={e => setMaxSharesInput(Number(e.target.value))} className="w-24 p-3 rounded-lg font-bold text-center text-lg shadow-inner outline-none dark:bg-gray-800 dark:text-white" />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Müşteri Adı Soyadı</label>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-white dark:bg-gray-900/50 border-none rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" placeholder="Örn: Ahmet Yılmaz" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Telefon Numarası</label>
                      <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 bg-white dark:bg-gray-900/50 border-none rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" placeholder="05XX XXX XX XX" />
                    </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-xl border border-amber-200 dark:border-amber-800/30">
                    <div className="flex gap-6 items-end">
                        <div className="w-32">
                             <label className="block text-xs font-bold uppercase text-amber-800 dark:text-amber-500 mb-1">Hisse Adedi</label>
                             <input 
                                type="number" 
                                min="1" 
                                max={availableShares} 
                                value={formData.share_count} 
                                onChange={e => setFormData({...formData, share_count: Number(e.target.value)})} 
                                className="w-full p-3 border-2 border-amber-300 dark:border-amber-600 rounded-lg font-black text-center text-xl bg-white dark:bg-gray-900 dark:text-white" 
                             />
                        </div>
                        <div className="flex-1">
                             <label className="block text-xs font-bold uppercase text-amber-800 dark:text-amber-500 mb-1">Anlaşılan TOPLAM Tutar</label>
                             <div className="relative">
                                <input type="number" required value={formData.amount_agreed} onChange={e => setFormData({...formData, amount_agreed: e.target.value})} className="w-full p-3 border-none shadow-inner rounded-lg font-bold text-lg bg-white dark:bg-gray-900 dark:text-white pr-10" />
                                <span className="absolute right-3 top-3.5 text-gray-400 font-bold">TL</span>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Şimdi Ödenen (Peşinat)</label>
                      <div className="relative">
                        <input type="number" required value={formData.amount_paid} onChange={e => setFormData({...formData, amount_paid: e.target.value})} className="w-full p-3 bg-white dark:bg-gray-900/50 border-none rounded-lg shadow-sm font-mono font-medium dark:text-white" />
                        <span className="absolute right-3 top-3 text-gray-400">TL</span>
                      </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Ödeme Durumu</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-3 bg-white dark:bg-gray-900/50 border-none rounded-lg shadow-sm dark:text-white">
                            <option value={ShareStatus.Unpaid}>🔴 Hiç Ödenmedi</option>
                            <option value={ShareStatus.Partial}>🟠 Kısmi Ödeme (Kapora)</option>
                            <option value={ShareStatus.Paid}>🟢 Tamamı Ödendi</option>
                        </select>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-primary-600 to-primary-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:scale-[1.01] transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-primary-500/30"
                >
                  {isSubmitting ? 'İşleniyor...' : 'Satışı Tamamla ve Makbuz Kes'}
                </button>
              </form>
          ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                   <div className="border-b border-gray-200/50 dark:border-gray-700/50 pb-4 mb-4">
                     <h3 className="text-xl font-bold dark:text-gray-200">Borç Ödeme Formu</h3>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Borçlu Müşteri Seçimi</label>
                      <select 
                        required
                        value={selectedShareholderId}
                        onChange={e => setSelectedShareholderId(e.target.value)}
                        className="w-full p-4 border-none rounded-xl bg-white dark:bg-gray-900/50 shadow-inner focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                      >
                          <option value="">Müşteri Seçiniz...</option>
                          {debtors.map(d => (
                              <option key={d.id} value={d.id}>
                                  {d.name} | Kalan Borç: {d.amount_agreed - d.amount_paid} TL | Küpe: {d.animalTag}
                              </option>
                          ))}
                      </select>
                  </div>

                  {selectedDebtor && (
                      <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30 flex flex-col gap-3">
                          <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-800 pb-2">
                              <span className="text-blue-800 dark:text-blue-300 font-bold">#{selectedDebtor.animalTag}</span>
                              <span className="text-xs text-blue-500 uppercase font-bold tracking-wider">Hisse Detayı</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                  <span className="block text-gray-500">Toplam Borç</span>
                                  <span className="font-bold text-gray-900 dark:text-white text-lg">{selectedDebtor.amount_agreed} TL</span>
                              </div>
                              <div className="text-right">
                                  <span className="block text-gray-500">Kalan</span>
                                  <span className="font-bold text-red-600 text-lg">{selectedDebtor.amount_agreed - selectedDebtor.amount_paid} TL</span>
                              </div>
                          </div>
                      </div>
                  )}

                  <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Tahsil Edilen Tutar</label>
                      <div className="relative">
                          <input 
                            type="number" 
                            required 
                            max={selectedDebtor ? selectedDebtor.amount_agreed - selectedDebtor.amount_paid : 0}
                            value={paymentAmount} 
                            onChange={e => setPaymentAmount(e.target.value)} 
                            className="w-full p-4 border-none rounded-xl bg-white dark:bg-gray-900 shadow-inner font-bold text-xl pr-12 dark:text-white" 
                          />
                          <span className="absolute right-4 top-5 text-gray-400 font-bold">TL</span>
                      </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={!selectedDebtor || isSubmitting} 
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                       {isSubmitting ? 'İşleniyor...' : 'Ödemeyi Al ve Makbuz Kes'}
                  </button>
              </form>
          )}
        </div>

        {/* Transaction History Sidebar */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-white/20 h-fit sticky top-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-primary-500 rounded-full"></span>
              Son İşlemler
          </h3>
          
          {transactionHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm italic border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  Henüz işlem yapılmadı.
              </div>
          ) : (
              <div className="space-y-4">
                  {transactionHistory.map((tr) => (
                      <div key={tr.id} className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:scale-[1.02] transition-transform">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                              <span className="text-gray-400">{tr.time}</span>
                              <span className={`${tr.type === 'SATIŞ' ? 'text-primary-600' : 'text-blue-600'}`}>{tr.type}</span>
                          </div>
                          <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">{tr.customer}</div>
                          <div className="flex justify-between items-end mt-1">
                              <span className="text-gray-500 text-xs">{tr.detail}</span>
                              <span className="font-mono font-bold text-green-600">+{tr.amount} TL</span>
                          </div>
                      </div>
                  ))}
              </div>
          )}
        </div>
      </div>

      <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="İşlem Makbuzu">
         {lastTransaction && (
           <div className="bg-white text-black font-sans leading-relaxed p-8 relative overflow-hidden" id="receipt-area">
              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                   <div className="transform -rotate-45 text-9xl font-black uppercase">MAKBUZ</div>
              </div>

              <div className="relative z-10">
                  <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                      <div className="flex flex-col">
                          <h1 className="text-4xl font-black uppercase tracking-widest text-black">TAHSİLAT MAKBUZU</h1>
                          <span className="text-sm font-bold text-gray-600 mt-1 uppercase tracking-[0.2em]">{settings?.site_title || 'KURBAN SATIŞ ORGANİZASYONU'}</span>
                      </div>
                      <div className="text-right">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">TARİH</div>
                          <div className="text-xl font-bold text-black">{new Date().toLocaleDateString('tr-TR')}</div>
                          <div className="text-xs text-gray-400 mt-1 font-mono">#{Math.floor(Math.random() * 100000)}</div>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-8">
                      <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                          <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Müşteri Bilgileri</h3>
                          <p className="text-2xl font-bold text-black">{lastTransaction.customer}</p>
                          <p className="text-gray-600 font-mono mt-1">{lastTransaction.phone}</p>
                      </div>
                      <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                          <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">İşlem Detayı</h3>
                          <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                  <span className="text-gray-600">İşlem Türü:</span>
                                  <span className="font-bold text-black uppercase">{lastTransaction.type}</span>
                              </div>
                              <div className="flex justify-between">
                                  <span className="text-gray-600">Kurban Küpe No:</span>
                                  <span className="font-bold text-black">#{lastTransaction.animal_tag}</span>
                              </div>
                              {lastTransaction.share_count > 1 && (
                                <div className="flex justify-between text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded">
                                    <span>Hisse Adedi:</span>
                                    <span>{lastTransaction.share_count} Adet</span>
                                </div>
                              )}
                          </div>
                      </div>
                  </div>

                  <table className="w-full border-collapse mb-8">
                      <thead>
                          <tr className="border-b-2 border-black">
                              <th className="text-left py-3 font-bold text-black uppercase text-sm tracking-wider">AÇIKLAMA</th>
                              <th className="text-right py-3 font-bold text-black uppercase text-sm tracking-wider">TUTAR</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr className="border-b border-gray-200">
                              <td className="py-4 text-lg font-medium text-gray-800">Ödeme / Tahsilat Tutarı</td>
                              <td className="py-4 text-right text-3xl font-bold text-black">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(lastTransaction.amount_paid)}</td>
                          </tr>
                          <tr>
                              <td className="py-4 text-sm font-bold text-gray-500 uppercase">Kalan Bakiye</td>
                              <td className="py-4 text-right text-xl font-bold text-red-600">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(lastTransaction.remaining)}</td>
                          </tr>
                      </tbody>
                  </table>

                  {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                      <div className="mb-8 p-6 bg-gray-100 rounded-xl border border-dashed border-gray-300">
                          <h4 className="font-bold text-xs uppercase text-gray-500 mb-4 border-b border-gray-300 pb-2 tracking-wider">Banka Hesap Bilgileri</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {settings.bank_accounts.map((acc, i) => (
                                  <div key={i} className="flex flex-col bg-white p-3 rounded border border-gray-200">
                                      <div className="font-bold text-black">{acc.bank_name}</div>
                                      <div className="text-gray-600 text-xs">{acc.name}</div>
                                      <div className="font-mono font-bold mt-1 text-gray-800">{acc.iban}</div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  <div className="text-center pt-8 border-t border-gray-100">
                      <p className="text-gray-400 text-xs uppercase tracking-widest">Bu makbuz dijital olarak oluşturulmuştur.</p>
                  </div>
              </div>

              <button onClick={() => window.print()} className="w-full mt-8 bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-colors print:hidden shadow-xl flex items-center justify-center gap-2">
                  YAZDIR (A4)
              </button>
           </div>
         )}
      </Modal>
    </div>
  );
};

export default SalesPage;
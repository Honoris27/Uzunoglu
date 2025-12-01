
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
    status: ShareStatus.Unpaid
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

  // Auto-Calculate Price suggestion
  useEffect(() => {
      if (selectedAnimal) {
          const pricePerShare = selectedAnimal.total_price / currentMaxShares;
          setFormData(prev => ({ ...prev, amount_agreed: Math.floor(pricePerShare).toString() }));
      }
  }, [selectedAnimalId, maxSharesInput, selectedAnimal, currentMaxShares]);


  const addToHistory = (record: TransactionRecord) => {
      setTransactionHistory(prev => [record, ...prev].slice(0, 10));
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal || isSubmitting) return;

    if (availableShares <= 0) {
        alert("Bu hayvanda boş hisse kalmadı.");
        return;
    }

    setIsSubmitting(true);

    try {
      // 1. Update Max Shares first if it's the first sale
      if (isFirstSale) {
        await animalService.update(selectedAnimal.id, { max_shares: Number(maxSharesInput) });
      }

      const agreedAmount = Number(formData.amount_agreed);
      const paidAmount = Number(formData.amount_paid);

      // 2. Create Single Share
      const shareData = {
        animal_id: selectedAnimal.id,
        name: formData.name,
        phone: formData.phone,
        amount_agreed: agreedAmount,
        amount_paid: paidAmount,
        status: formData.status as ShareStatus
      };

      const createdShare = await shareService.create(shareData);

      // 3. Create Payment Log
      if (paidAmount > 0) {
          await paymentService.create({
              share_id: createdShare.id,
              amount: paidAmount,
              type: 'PAYMENT',
              description: 'İlk Satış Ödemesi'
          });
      }

      const transactionData = { 
          type: 'HİSSE SATIŞI',
          customer: formData.name,
          phone: formData.phone,
          amount_total: agreedAmount,
          amount_paid: paidAmount,
          animal_tag: selectedAnimal.tag_number,
          remaining: agreedAmount - paidAmount,
          share_count: 1
      };

      setLastTransaction(transactionData);
      addToHistory({
          id: Date.now(),
          time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
          type: 'SATIŞ',
          customer: formData.name,
          amount: paidAmount,
          detail: `1 Hisse - #${selectedAnimal.tag_number}`
      });

      setIsReceiptOpen(true);
      setFormData({ name: '', phone: '', amount_agreed: '', amount_paid: '0', status: ShareStatus.Unpaid });
      refresh();
    } catch (err) {
      console.error(err);
      alert("Satış işlemi sırasında bir hata oluştu.");
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

  const ReceiptContent = ({ type }: { type: 'ORIGINAL' | 'COPY' }) => (
      <div className="h-full flex flex-col justify-between p-8 border border-gray-200 relative bg-white">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                <div className="transform -rotate-45 text-8xl font-black uppercase">MAKBUZ</div>
          </div>
          
          <div className="relative z-10">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-4">
                  <div>
                      <h3 className="text-xl font-black uppercase tracking-widest text-black">TAHSİLAT MAKBUZU</h3>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{settings?.site_title || 'KURBAN SATIŞ'}</p>
                      <span className="text-[10px] font-bold bg-gray-200 px-2 py-0.5 rounded uppercase mt-1 inline-block text-gray-600">{type === 'ORIGINAL' ? 'MÜŞTERİ NÜSHASI' : 'KOPYA NÜSHA'}</span>
                  </div>
                  <div className="text-right">
                      <div className="text-sm font-bold text-black">{new Date().toLocaleDateString('tr-TR')}</div>
                      <div className="text-[10px] text-gray-400 font-mono">#{Math.floor(Math.random() * 100000)}</div>
                  </div>
              </div>

              {/* Body */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                  <div className="p-3 bg-gray-50 rounded border border-gray-100">
                      <div className="font-bold text-gray-400 uppercase text-[9px]">SAYIN</div>
                      <div className="font-bold text-lg text-black">{lastTransaction?.customer}</div>
                      <div className="text-gray-600">{lastTransaction?.phone}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded border border-gray-100">
                      <div className="font-bold text-gray-400 uppercase text-[9px]">İŞLEM</div>
                      <div className="flex justify-between">
                          <span>Tür:</span> <span className="font-bold">{lastTransaction?.type}</span>
                      </div>
                      <div className="flex justify-between">
                          <span>Küpe:</span> <span className="font-bold">#{lastTransaction?.animal_tag}</span>
                      </div>
                  </div>
              </div>

              <div className="mb-4">
                  <table className="w-full text-sm">
                      <tr className="bg-black text-white">
                          <td className="p-2 font-bold text-xs rounded-l">AÇIKLAMA</td>
                          <td className="p-2 font-bold text-xs text-right rounded-r">TUTAR</td>
                      </tr>
                      <tr>
                          <td className="p-2 border-b">{lastTransaction?.type} Ödemesi</td>
                          <td className="p-2 border-b text-right font-bold text-lg">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(lastTransaction?.amount_paid || 0)}</td>
                      </tr>
                      <tr>
                          <td className="p-2 text-xs text-right font-bold text-gray-500">Kalan Bakiye:</td>
                          <td className="p-2 text-right font-bold text-red-600">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(lastTransaction?.remaining || 0)}</td>
                      </tr>
                  </table>
              </div>
              
              {/* Bank Info (Compact) */}
              {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                  <div className="text-[10px] text-gray-500 border-t border-dashed border-gray-300 pt-2">
                      <span className="font-bold mr-2">BANKA:</span>
                      {settings.bank_accounts[0].bank_name} - {settings.bank_accounts[0].iban}
                  </div>
              )}
          </div>

          <div className="text-center text-[9px] text-gray-400 uppercase tracking-widest mt-2">
              Bu belge bilgisayar ortamında oluşturulmuştur.
          </div>
      </div>
  );

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold dark:text-white flex items-center gap-3">
             <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-sm">
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             Satış ve Kasa İşlemleri
          </h2>
      </div>
      
      <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex mb-8 shadow-inner border border-white/10">
          <button 
            onClick={() => setActiveTab('sale')}
            className={`px-8 py-3 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'sale' ? 'bg-white dark:bg-gray-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
              <span>🤝</span> YENİ SATIŞ
          </button>
          <button 
            onClick={() => setActiveTab('payment')}
            className={`px-8 py-3 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'payment' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-300' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
              <span>💳</span> TAHSİLAT (BORÇ)
          </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          
          {activeTab === 'sale' ? (
              <form onSubmit={handleSaleSubmit} className="space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                     <h3 className="text-lg font-bold dark:text-gray-200">Hisse Satış Formu</h3>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Hayvan Seçimi</label>
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
                        className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white text-sm"
                    >
                        <option value="">Hayvan Seçiniz...</option>
                        {animals.filter(a => (a.shares?.length || 0) < a.max_shares).map(a => (
                        <option key={a.id} value={a.id}>
                            #{a.tag_number} - {a.type} | Fiyat: {a.total_price} TL | Boş Hisse: {a.max_shares - (a.shares?.length || 0)}
                        </option>
                        ))}
                    </select>

                    {selectedAnimal && (
                         <div className="mt-3 flex items-center justify-between text-xs px-2">
                            <span className="text-gray-600 dark:text-gray-400 font-medium">Önerilen Hisse Fiyatı: <strong>{Math.floor(selectedAnimal.total_price / currentMaxShares)} TL</strong></span>
                            <span className="text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded font-bold">Kalan Yer: {availableShares}</span>
                        </div>
                    )}
                </div>

                {selectedAnimal && isFirstSale && !selectedAnimal.type.toLowerCase().includes('küçük') && (
                    <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-blue-900 dark:text-blue-300">Toplam Hisse Adedi</label>
                            <p className="text-xs text-blue-600 dark:text-blue-400">Bu hayvan toplam kaç hisseye bölünecek?</p>
                        </div>
                        <input type="number" min="1" max="7" value={maxSharesInput} onChange={e => setMaxSharesInput(Number(e.target.value))} className="w-20 p-2 rounded border border-blue-200 dark:border-blue-700 font-bold text-center dark:bg-gray-800 dark:text-white" />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Müşteri Adı Soyadı</label>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white text-sm" placeholder="Örn: Ahmet Yılmaz" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Telefon Numarası</label>
                      <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none dark:text-white text-sm" placeholder="05XX XXX XX XX" />
                    </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800">
                    <div>
                        <label className="block text-xs font-bold uppercase text-amber-800 dark:text-amber-500 mb-1">Hisse Tutarı (Anlaşılan)</label>
                        <div className="relative">
                        <input type="number" required value={formData.amount_agreed} onChange={e => setFormData({...formData, amount_agreed: e.target.value})} className="w-full p-2 bg-transparent border-b-2 border-amber-300 dark:border-amber-700 font-bold text-xl text-gray-900 dark:text-white outline-none" />
                        <span className="absolute right-2 top-2 text-amber-600 font-bold">TL</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Şimdi Ödenen (Peşinat)</label>
                      <div className="relative">
                        <input type="number" required value={formData.amount_paid} onChange={e => setFormData({...formData, amount_paid: e.target.value})} className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg font-mono font-medium dark:text-white text-sm" />
                        <span className="absolute right-3 top-3 text-gray-400 text-xs">TL</span>
                      </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Ödeme Durumu</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg dark:text-white text-sm">
                            <option value={ShareStatus.Unpaid}>🔴 Hiç Ödenmedi</option>
                            <option value={ShareStatus.Partial}>🟠 Kısmi Ödeme (Kapora)</option>
                            <option value={ShareStatus.Paid}>🟢 Tamamı Ödendi</option>
                        </select>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'İşleniyor...' : 'Satışı Onayla'}
                </button>
              </form>
          ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                   <div className="border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                     <h3 className="text-lg font-bold dark:text-gray-200">Borç Ödeme Formu</h3>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Borçlu Müşteri Seçimi</label>
                      <select 
                        required
                        value={selectedShareholderId}
                        onChange={e => setSelectedShareholderId(e.target.value)}
                        className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none dark:text-white text-sm"
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
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 flex flex-col gap-3">
                          <div className="flex justify-between items-center border-b border-blue-200 dark:border-blue-800 pb-2">
                              <span className="text-blue-800 dark:text-blue-300 font-bold">#{selectedDebtor.animalTag}</span>
                              <span className="text-[10px] text-blue-500 uppercase font-bold tracking-wider">Hisse Detayı</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                  <span className="block text-gray-500 text-xs">Toplam Borç</span>
                                  <span className="font-bold text-gray-900 dark:text-white">{selectedDebtor.amount_agreed} TL</span>
                              </div>
                              <div className="text-right">
                                  <span className="block text-gray-500 text-xs">Kalan</span>
                                  <span className="font-bold text-red-600">{selectedDebtor.amount_agreed - selectedDebtor.amount_paid} TL</span>
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
                            className="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 font-bold text-xl pr-12 dark:text-white" 
                          />
                          <span className="absolute right-4 top-5 text-gray-400 font-bold">TL</span>
                      </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={!selectedDebtor || isSubmitting} 
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                       {isSubmitting ? 'İşleniyor...' : 'Ödemeyi Al'}
                  </button>
              </form>
          )}
        </div>

        {/* Transaction History Sidebar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 h-fit sticky top-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Son İşlemler
          </h3>
          
          {transactionHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs italic border border-dashed border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                  Henüz işlem yok
              </div>
          ) : (
              <div className="space-y-3">
                  {transactionHistory.map((tr) => (
                      <div key={tr.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-600 hover:border-gray-300 transition-colors">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                              <span className="text-gray-400">{tr.time}</span>
                              <span className={`${tr.type === 'SATIŞ' ? 'text-primary-600' : 'text-blue-600'}`}>{tr.type}</span>
                          </div>
                          <div className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate">{tr.customer}</div>
                          <div className="flex justify-between items-end mt-1">
                              <span className="text-gray-500 text-[10px]">{tr.detail}</span>
                              <span className="font-mono font-bold text-green-600 text-xs">+{tr.amount} TL</span>
                          </div>
                      </div>
                  ))}
              </div>
          )}
        </div>
      </div>

      <Modal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} title="İşlem Makbuzu">
         {lastTransaction && (
           <div className="bg-gray-100">
              {/* Screen View (Preview of one) */}
              <div className="p-4 print:hidden flex justify-center bg-gray-800">
                  <div className="bg-white w-[300px] shadow-xl origin-top transform scale-90">
                      <ReceiptContent type="ORIGINAL" />
                  </div>
              </div>

              {/* Print View (2 on A4) */}
              <div className="hidden print:flex flex-col h-[100vh] w-full bg-white print-container">
                  <div className="flex-1 border-b border-dashed border-gray-300 relative">
                     <ReceiptContent type="ORIGINAL" />
                  </div>
                  
                  {/* Scissors / Cut Line */}
                  <div className="h-0 relative flex items-center justify-center">
                       <div className="absolute bg-white px-2 text-gray-400 flex items-center gap-2">
                           <span>✂️</span> <span className="text-[10px] uppercase tracking-widest">Kesme Çizgisi</span>
                       </div>
                  </div>

                  <div className="flex-1">
                     <ReceiptContent type="COPY" />
                  </div>
              </div>

              {/* Print Button */}
              <div className="p-4 bg-white border-t flex justify-end print:hidden">
                   <button onClick={() => window.print()} className="bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Yazdır (2 Adet A4)
                   </button>
              </div>
              
              <style>{`
                  @media print {
                      body * { visibility: hidden; }
                      .print-container, .print-container * { visibility: visible; }
                      .print-container { 
                          position: fixed; 
                          left: 0; 
                          top: 0; 
                          width: 100%; 
                          height: 100%;
                          z-index: 9999;
                      }
                      .print\\:hidden { display: none !important; }
                      .print\\:flex { display: flex !important; }
                      @page { margin: 0; size: A4 portrait; }
                  }
              `}</style>
           </div>
         )}
      </Modal>
    </div>
  );
};

export default SalesPage;

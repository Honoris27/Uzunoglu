
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

  // Sale Form State
  const [shareCount, setShareCount] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    amount_agreed: '',
    amount_paid: '0',
    status: ShareStatus.Unpaid
  });
  const [maxSharesInput, setMaxSharesInput] = useState(7); 

  // Payment Form State
  const [selectedShareholderId, setSelectedShareholderId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    configService.getSettings().then(setSettings);
  }, []);

  const selectedAnimal = animals.find(a => a.id === selectedAnimalId);
  const isFirstSale = selectedAnimal && (!selectedAnimal.shares || selectedAnimal.shares.length === 0);
  
  const currentShares = selectedAnimal?.shares?.length || 0;
  const currentMaxShares = selectedAnimal ? (isFirstSale ? maxSharesInput : selectedAnimal.max_shares) : 7;
  const availableShares = currentMaxShares - currentShares;

  const allShareholders = animals.flatMap(a => (a.shares || []).map(s => ({ ...s, animalTag: a.tag_number, animalId: a.id })));
  const debtors = allShareholders.filter(s => s.status !== ShareStatus.Paid && (s.amount_agreed - s.amount_paid) > 0);
  const selectedDebtor = debtors.find(d => d.id === selectedShareholderId);

  // Auto-Calculate Price based on Share Count
  useEffect(() => {
      if (selectedAnimal) {
          const pricePerShare = selectedAnimal.total_price / currentMaxShares;
          const totalCalculated = Math.floor(pricePerShare * shareCount);
          setFormData(prev => ({ ...prev, amount_agreed: totalCalculated.toString() }));
      }
  }, [selectedAnimalId, maxSharesInput, selectedAnimal, currentMaxShares, shareCount]);

  const addToHistory = (record: TransactionRecord) => {
      setTransactionHistory(prev => [record, ...prev].slice(0, 10));
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal || isSubmitting) return;

    if (shareCount > availableShares) {
        alert(`Hata: Bu hayvanda sadece ${availableShares} adet boş hisse kaldı.`);
        return;
    }

    setIsSubmitting(true);

    try {
      // 1. Update Max Shares first if it's the first sale
      if (isFirstSale) {
        await animalService.update(selectedAnimal.id, { max_shares: Number(maxSharesInput) });
      }

      const totalAgreed = Number(formData.amount_agreed);
      const totalPaid = Number(formData.amount_paid);

      // Calculations for individual shares
      const agreedPerShare = Math.floor(totalAgreed / shareCount);
      const paidPerShare = Math.floor(totalPaid / shareCount);
      
      // Handle rounding diffs on the first share
      const agreedDiff = totalAgreed - (agreedPerShare * shareCount);
      const paidDiff = totalPaid - (paidPerShare * shareCount);

      const sharesToCreate = [];
      
      for (let i = 0; i < shareCount; i++) {
          const isFirst = i === 0;
          const thisAgreed = agreedPerShare + (isFirst ? agreedDiff : 0);
          const thisPaid = paidPerShare + (isFirst ? paidDiff : 0);
          
          let status = ShareStatus.Unpaid;
          if (thisPaid >= thisAgreed) status = ShareStatus.Paid;
          else if (thisPaid > 0) status = ShareStatus.Partial;

          sharesToCreate.push({
            animal_id: selectedAnimal.id,
            name: formData.name,
            phone: formData.phone,
            amount_agreed: thisAgreed,
            amount_paid: thisPaid,
            status: status
          });
      }

      // 2. Bulk Create Shares
      const createdShares = await shareService.createBulk(sharesToCreate);

      // 3. Bulk Create Payment Logs (if paid)
      if (totalPaid > 0 && createdShares) {
          const paymentsToCreate = createdShares.map((share, index) => {
               // Match the payment logic above
               const isFirst = index === 0;
               const thisPaid = paidPerShare + (isFirst ? paidDiff : 0);
               if (thisPaid <= 0) return null;
               
               return {
                  share_id: share.id,
                  amount: thisPaid,
                  type: 'PAYMENT' as const,
                  description: shareCount > 1 ? 'Toplu Satış Ödemesi' : 'İlk Satış Ödemesi'
               };
          }).filter(Boolean); // Remove nulls

          if (paymentsToCreate.length > 0) {
              await paymentService.createBulk(paymentsToCreate as any);
          }
      }

      const transactionData = { 
          type: 'HİSSE SATIŞI',
          customer: formData.name,
          phone: formData.phone,
          amount_total: totalAgreed,
          amount_paid: totalPaid,
          animal_tag: selectedAnimal.tag_number,
          remaining: totalAgreed - totalPaid,
          share_count: shareCount
      };

      setLastTransaction(transactionData);
      addToHistory({
          id: Date.now(),
          time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
          type: 'SATIŞ',
          customer: formData.name,
          amount: totalPaid,
          detail: `${shareCount} Hisse - #${selectedAnimal.tag_number}`
      });

      setIsReceiptOpen(true);
      setFormData({ name: '', phone: '', amount_agreed: '', amount_paid: '0', status: ShareStatus.Unpaid });
      setShareCount(1);
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
      <div className="h-full flex flex-col justify-between p-8 border border-slate-200 relative bg-white text-slate-900">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
                <div className="transform -rotate-45 text-8xl font-black uppercase text-slate-900">MAKBUZ</div>
          </div>
          
          <div className="relative z-10">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                  <div>
                      <h3 className="text-xl font-black uppercase tracking-widest text-slate-900">TAHSİLAT MAKBUZU</h3>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{settings?.site_title || 'KURBAN SATIŞ'}</p>
                      <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded uppercase mt-2 inline-block text-slate-600">{type === 'ORIGINAL' ? 'MÜŞTERİ NÜSHASI' : 'KOPYA NÜSHA'}</span>
                  </div>
                  <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('tr-TR')}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">Ref: {Math.floor(Math.random() * 100000)}</div>
                  </div>
              </div>

              {/* Body */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="font-bold text-slate-400 uppercase text-[9px] mb-1">SAYIN</div>
                      <div className="font-bold text-lg text-slate-900">{lastTransaction?.customer}</div>
                      <div className="text-slate-600 font-mono mt-1">{lastTransaction?.phone}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="font-bold text-slate-400 uppercase text-[9px] mb-1">İŞLEM DETAYI</div>
                      <div className="flex justify-between mb-1">
                          <span className="text-slate-600">İşlem Türü:</span> 
                          <span className="font-bold text-slate-900">{lastTransaction?.type}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                          <span className="text-slate-600">Küpe No:</span> 
                          <span className="font-bold text-slate-900">#{lastTransaction?.animal_tag}</span>
                      </div>
                      {lastTransaction?.share_count > 1 && (
                          <div className="flex justify-between">
                              <span className="text-slate-600">Hisse Adedi:</span> 
                              <span className="font-bold text-blue-600">{lastTransaction?.share_count} Adet</span>
                          </div>
                      )}
                  </div>
              </div>

              <div className="mb-6">
                  <table className="w-full text-sm">
                      <tr className="bg-slate-900 text-white">
                          <td className="p-3 font-bold text-xs rounded-l-lg">AÇIKLAMA</td>
                          <td className="p-3 font-bold text-xs text-right rounded-r-lg">TUTAR</td>
                      </tr>
                      <tr>
                          <td className="p-3 border-b border-slate-100 font-medium text-slate-700">{lastTransaction?.type} Ödemesi</td>
                          <td className="p-3 border-b border-slate-100 text-right font-bold text-lg text-slate-900">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(lastTransaction?.amount_paid || 0)}</td>
                      </tr>
                      <tr>
                          <td className="p-3 text-xs text-right font-bold text-slate-400 pt-4">Kalan Bakiye:</td>
                          <td className="p-3 text-right font-bold text-red-600 pt-4 text-base">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(lastTransaction?.remaining || 0)}</td>
                      </tr>
                  </table>
              </div>
              
              {/* Bank Info (Compact) */}
              {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                  <div className="text-[10px] text-slate-500 border-t border-dashed border-slate-300 pt-4 mt-auto">
                      <span className="font-bold mr-2 text-slate-700">BANKA HESAP BİLGİLERİ:</span>
                      <div className="grid grid-cols-1 gap-1 mt-2">
                        {settings.bank_accounts.slice(0, 2).map((acc, i) => (
                             <div key={i} className="flex justify-between">
                                 <span>{acc.bank_name}</span>
                                 <span className="font-mono">{acc.iban}</span>
                             </div>
                        ))}
                      </div>
                  </div>
              )}
          </div>

          <div className="text-center text-[9px] text-slate-400 uppercase tracking-widest mt-6">
              Bu belge bilgisayar ortamında oluşturulmuştur. Islak imza gerektirmez.
          </div>
      </div>
  );

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
             <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             Satış ve Kasa İşlemleri
          </h2>
      </div>
      
      <div className="bg-slate-200 p-1 rounded-xl inline-flex mb-8">
          <button 
            onClick={() => setActiveTab('sale')}
            className={`px-8 py-3 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'sale' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <span>🤝</span> YENİ SATIŞ
          </button>
          <button 
            onClick={() => setActiveTab('payment')}
            className={`px-8 py-3 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'payment' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
              <span>💳</span> TAHSİLAT (BORÇ)
          </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          
          {activeTab === 'sale' ? (
              <form onSubmit={handleSaleSubmit} className="space-y-6">
                <div className="border-b border-slate-100 pb-4 mb-4">
                     <h3 className="text-lg font-bold text-slate-800">Hisse Satış Formu</h3>
                     <p className="text-xs text-slate-400 mt-1">Yeni bir müşteri kaydı ve satış işlemi oluşturun.</p>
                </div>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Hayvan Seçimi</label>
                    <select 
                        required
                        value={selectedAnimalId}
                        onChange={e => {
                            setSelectedAnimalId(e.target.value);
                            const animal = animals.find(a => a.id === e.target.value);
                            setShareCount(1);
                            if(animal) {
                                const shares = animal.shares?.length === 0 ? (animal.type.includes('üçük') ? 1 : 7) : animal.max_shares;
                                setMaxSharesInput(shares);
                            }
                        }}
                        className="w-full p-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 text-sm font-medium"
                    >
                        <option value="">Hayvan Seçiniz...</option>
                        {animals.filter(a => (a.shares?.length || 0) < a.max_shares).map(a => (
                        <option key={a.id} value={a.id}>
                            #{a.tag_number} - {a.type} | Fiyat: {a.total_price} TL | Boş Yer: {a.max_shares - (a.shares?.length || 0)}
                        </option>
                        ))}
                    </select>

                    {selectedAnimal && (
                         <div className="mt-3 flex items-center justify-between text-xs px-2">
                            <span className="text-slate-500 font-medium">Birim Hisse Fiyatı: <strong>{Math.floor(selectedAnimal.total_price / currentMaxShares)} TL</strong></span>
                            <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded font-bold">Kalan Yer: {availableShares}</span>
                        </div>
                    )}
                </div>

                {selectedAnimal && isFirstSale && !selectedAnimal.type.toLowerCase().includes('küçük') && (
                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-blue-900">Toplam Hisse Payı</label>
                            <p className="text-[10px] text-blue-600 opacity-80">Bu büyükbaş hayvan toplam kaç hisseye bölünecek?</p>
                        </div>
                        <input type="number" min="1" max="7" value={maxSharesInput} onChange={e => setMaxSharesInput(Number(e.target.value))} className="w-20 p-2 rounded border border-blue-200 font-bold text-center text-blue-900 bg-white" />
                    </div>
                )}
                
                {/* BULK SHARE INPUT */}
                {selectedAnimal && availableShares > 1 && !selectedAnimal.type.toLowerCase().includes('küçük') && (
                    <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-orange-900">Satılacak Hisse Adedi</label>
                            <p className="text-[10px] text-orange-700 opacity-80">Bu müşteriye kaç hisse verilecek?</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setShareCount(Math.max(1, shareCount - 1))} className="w-8 h-8 rounded bg-orange-200 text-orange-800 font-bold hover:bg-orange-300">-</button>
                            <input 
                                type="number" 
                                min="1" 
                                max={availableShares} 
                                value={shareCount} 
                                onChange={e => setShareCount(Math.min(availableShares, Math.max(1, Number(e.target.value))))} 
                                className="w-16 p-1.5 rounded border border-orange-200 font-bold text-center text-orange-900 bg-white" 
                            />
                            <button type="button" onClick={() => setShareCount(Math.min(availableShares, shareCount + 1))} className="w-8 h-8 rounded bg-orange-200 text-orange-800 font-bold hover:bg-orange-300">+</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Müşteri Adı Soyadı</label>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium" placeholder="Örn: Ahmet Yılmaz" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Telefon Numarası</label>
                      <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium" placeholder="05XX XXX XX XX" />
                    </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div>
                        <label className="block text-xs font-bold uppercase text-emerald-800 mb-1">
                            {shareCount > 1 ? `Toplam Tutar (${shareCount} Hisse İçin)` : 'Hisse Tutarı (Anlaşılan)'}
                        </label>
                        <div className="relative">
                        <input type="number" required value={formData.amount_agreed} onChange={e => setFormData({...formData, amount_agreed: e.target.value})} className="w-full p-2 bg-transparent border-b-2 border-emerald-300 font-bold text-2xl text-emerald-900 outline-none" />
                        <span className="absolute right-2 top-2 text-emerald-600 font-bold text-sm">TL</span>
                        </div>
                        {shareCount > 1 && (
                            <div className="text-right text-[10px] text-emerald-600 font-bold mt-1">
                                Hisse Başına: {Math.floor(Number(formData.amount_agreed) / shareCount)} TL
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Şimdi Ödenen (Peşinat)</label>
                      <div className="relative">
                        <input type="number" required value={formData.amount_paid} onChange={e => setFormData({...formData, amount_paid: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 text-sm" />
                        <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">TL</span>
                      </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Ödeme Durumu</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-3 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm font-medium">
                            <option value={ShareStatus.Unpaid}>🔴 Hiç Ödenmedi</option>
                            <option value={ShareStatus.Partial}>🟠 Kısmi Ödeme (Kapora)</option>
                            <option value={ShareStatus.Paid}>🟢 Tamamı Ödendi</option>
                        </select>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
                >
                  {isSubmitting ? 'İşleniyor...' : 'Satışı Onayla'}
                </button>
              </form>
          ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                   <div className="border-b border-slate-100 pb-4 mb-4">
                     <h3 className="text-lg font-bold text-slate-800">Borç Ödeme Formu</h3>
                     <p className="text-xs text-slate-400 mt-1">Mevcut bir borç için tahsilat yapın.</p>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Borçlu Müşteri Seçimi</label>
                      <select 
                        required
                        value={selectedShareholderId}
                        onChange={e => setSelectedShareholderId(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 text-sm font-medium"
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
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col gap-3">
                          <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                              <span className="text-blue-800 font-bold">#{selectedDebtor.animalTag}</span>
                              <span className="text-[10px] text-blue-500 uppercase font-bold tracking-wider">Hisse Detayı</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                  <span className="block text-slate-500 text-xs">Toplam Borç</span>
                                  <span className="font-bold text-slate-900">{selectedDebtor.amount_agreed} TL</span>
                              </div>
                              <div className="text-right">
                                  <span className="block text-slate-500 text-xs">Kalan</span>
                                  <span className="font-bold text-red-600">{selectedDebtor.amount_agreed - selectedDebtor.amount_paid} TL</span>
                              </div>
                          </div>
                      </div>
                  )}

                  <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Tahsil Edilen Tutar</label>
                      <div className="relative">
                          <input 
                            type="number" 
                            required 
                            max={selectedDebtor ? selectedDebtor.amount_agreed - selectedDebtor.amount_paid : 0}
                            value={paymentAmount} 
                            onChange={e => setPaymentAmount(e.target.value)} 
                            className="w-full p-4 border border-slate-200 rounded-xl bg-white font-bold text-xl pr-12 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                          />
                          <span className="absolute right-4 top-5 text-slate-400 font-bold">TL</span>
                      </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={!selectedDebtor || isSubmitting} 
                    className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                       {isSubmitting ? 'İşleniyor...' : 'Ödemeyi Al'}
                  </button>
              </form>
          )}
        </div>

        {/* Transaction History Sidebar */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 h-fit sticky top-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Son İşlemler
          </h3>
          
          {transactionHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-lg bg-slate-50">
                  Henüz işlem yok
              </div>
          ) : (
              <div className="space-y-3">
                  {transactionHistory.map((tr) => (
                      <div key={tr.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                              <span className="text-slate-400">{tr.time}</span>
                              <span className={`${tr.type === 'SATIŞ' ? 'text-blue-600' : 'text-emerald-600'}`}>{tr.type}</span>
                          </div>
                          <div className="font-bold text-slate-800 text-sm truncate">{tr.customer}</div>
                          <div className="flex justify-between items-end mt-1">
                              <span className="text-slate-500 text-[10px]">{tr.detail}</span>
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
           <div className="bg-slate-100">
              {/* Screen View (Preview) */}
              <div className="p-4 print:hidden flex justify-center bg-slate-800">
                  <div className="bg-white w-[300px] shadow-2xl origin-top transform scale-90">
                      <ReceiptContent type="ORIGINAL" />
                  </div>
              </div>

              {/* Print View (2 on A4) */}
              <div className="hidden print:flex flex-col h-[100vh] w-full bg-white print-container">
                  <div className="flex-1 border-b border-dashed border-slate-300 relative">
                     <ReceiptContent type="ORIGINAL" />
                  </div>
                  
                  {/* Scissors / Cut Line */}
                  <div className="h-0 relative flex items-center justify-center">
                       <div className="absolute bg-white px-2 text-slate-400 flex items-center gap-2">
                           <span>✂️</span> <span className="text-[10px] uppercase tracking-widest font-bold">Kesme Çizgisi</span>
                       </div>
                  </div>

                  <div className="flex-1">
                     <ReceiptContent type="COPY" />
                  </div>
              </div>

              {/* Print Button */}
              <div className="p-4 bg-white border-t flex justify-end print:hidden">
                   <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 flex items-center gap-2 shadow-lg">
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

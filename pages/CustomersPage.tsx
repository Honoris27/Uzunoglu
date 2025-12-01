
import React, { useState, useMemo, useEffect } from 'react';
import { Animal, ShareStatus, AppSettings, PaymentTransaction } from '../types';
import { configService, paymentService, shareService } from '../services/supabaseService';
import Modal from '../components/Modal';

interface Props {
  animals: Animal[];
}

const CustomersPage: React.FC<Props> = ({ animals }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerTransactions, setCustomerTransactions] = useState<PaymentTransaction[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  
  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, debt, paid

  useEffect(() => {
    configService.getSettings().then(setSettings);
  }, []);

  const customers = useMemo(() => {
    const groupedData = new Map<string, any>();

    animals.forEach(animal => {
      if (animal.shares) {
        animal.shares.forEach(share => {
          const key = `${animal.id}_${share.name}`;
          
          if (groupedData.has(key)) {
              const existing = groupedData.get(key);
              existing.shareCount += 1;
              existing.amount_agreed += share.amount_agreed;
              existing.amount_paid += share.amount_paid;
              existing.remaining += (share.amount_agreed - share.amount_paid);
              existing.ids.push(share.id);
              if (share.status !== ShareStatus.Paid) existing.status = ShareStatus.Partial;
          } else {
              groupedData.set(key, {
                  ...share,
                  ids: [share.id],
                  shareCount: 1,
                  animalTag: animal.tag_number,
                  animalType: animal.type,
                  animalPrice: animal.total_price,
                  remaining: share.amount_agreed - share.amount_paid
              });
          }
        });
      }
    });
    
    let result = Array.from(groupedData.values());

    // Filter
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(lower) || c.phone.includes(searchTerm) || c.animalTag.toLowerCase().includes(lower));
    }

    if (filterStatus === 'debt') {
        result = result.filter(c => c.remaining > 0);
    } else if (filterStatus === 'paid') {
        result = result.filter(c => c.remaining <= 0);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [animals, searchTerm, filterStatus]);

  const openDetail = async (customerGroup: any) => {
      setSelectedCustomer(customerGroup);
      try {
          const allTransactions = await Promise.all(
              customerGroup.ids.map((id: string) => paymentService.getByShareId(id))
          );
          const flatTransactions = allTransactions.flat().sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          setCustomerTransactions(flatTransactions);
      } catch (e) {
          console.error("Error fetching transactions", e);
          setCustomerTransactions([]);
      }
  };

  const handleRefund = async () => {
      if (!selectedCustomer || !refundAmount) return;
      
      const amount = Number(refundAmount);
      if (amount > selectedCustomer.amount_paid) {
          alert("İade tutarı, ödenen tutardan fazla olamaz!");
          return;
      }
      
      try {
          const targetShareId = selectedCustomer.ids[0]; 
          const currentShareData = animals.flatMap(a => a.shares).find(s => s?.id === targetShareId);
          if (!currentShareData) return;

          const newPaid = Math.max(0, currentShareData.amount_paid - amount);
          
          await shareService.update(targetShareId, {
              amount_paid: newPaid,
              status: newPaid < currentShareData.amount_agreed ? ShareStatus.Partial : ShareStatus.Paid
          });

          await paymentService.create({
              share_id: targetShareId,
              amount: amount,
              type: 'REFUND',
              description: 'Ödeme İptali / İade'
          });

          alert("İade/İptal işlemi başarılı.");
          setShowRefundModal(false);
          setRefundAmount('');
          window.location.reload(); 
      } catch (e) {
          alert("İşlem hatası");
      }
  };

  const loggedTotal = customerTransactions
        .filter(t => t.type === 'PAYMENT')
        .reduce((sum, t) => sum + t.amount, 0) 
        - 
        customerTransactions
        .filter(t => t.type === 'REFUND')
        .reduce((sum, t) => sum + t.amount, 0);
  
  const openingBalance = selectedCustomer ? selectedCustomer.amount_paid - loggedTotal : 0;

  // Helper for avatar colors
  const getAvatarColor = (name: string) => {
      const colors = ['bg-indigo-500', 'bg-blue-600', 'bg-violet-500', 'bg-fuchsia-600', 'bg-rose-500'];
      const index = name.length % colors.length;
      return colors[index];
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
       <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-3xl font-bold dark:text-white flex items-center gap-3">
                <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                Müşteri Listesi
            </h2>
            
            <div className="flex gap-2 w-full md:w-auto bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <input 
                    type="text" 
                    placeholder="Ad, Telefon veya Küpe Ara..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none rounded-lg px-4 py-2 w-full md:w-64 outline-none focus:ring-0 text-gray-700 dark:text-white placeholder-gray-400 text-sm"
                />
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)}
                    className="bg-gray-50 dark:bg-gray-700 border-none rounded-md px-3 py-2 text-gray-700 dark:text-white outline-none cursor-pointer text-sm font-medium"
                >
                    <option value="all">Tümü</option>
                    <option value="debt">Borçlu</option>
                    <option value="paid">Ödenen</option>
                </select>
            </div>
       </div>
       
       {/* Modern Table Layout */}
       <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
           <table className="w-full text-left border-collapse">
               <thead>
                   <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                       <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Müşteri</th>
                       <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">İletişim</th>
                       <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kurban Bilgisi</th>
                       <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Toplam Tutar</th>
                       <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Ödenen</th>
                       <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Durum</th>
                       <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Detay</th>
                   </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                   {customers.map((c, i) => (
                       <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer" onClick={() => openDetail(c)}>
                           <td className="py-4 px-6">
                               <div className="flex items-center gap-3">
                                   <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${getAvatarColor(c.name)}`}>
                                       {c.name.charAt(0).toUpperCase()}
                                   </div>
                                   <div>
                                       <div className="font-semibold text-gray-900 dark:text-white text-sm">{c.name}</div>
                                       {c.shareCount > 1 && <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">{c.shareCount} Hisse</span>}
                                   </div>
                               </div>
                           </td>
                           <td className="py-4 px-6 font-mono text-xs text-gray-500 dark:text-gray-400">{c.phone}</td>
                           <td className="py-4 px-6">
                               <div className="flex flex-col">
                                   <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">#{c.animalTag}</span>
                                   <span className="text-[10px] text-gray-400">{c.animalType}</span>
                               </div>
                           </td>
                           <td className="py-4 px-6 text-right font-medium text-gray-900 dark:text-gray-100 text-sm">
                               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(c.amount_agreed)}
                           </td>
                           <td className="py-4 px-6 text-right text-emerald-600 font-medium text-sm">
                               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(c.amount_paid)}
                           </td>
                           <td className="py-4 px-6 text-right">
                               {c.remaining > 0 ? (
                                   <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-bold px-2 py-1 rounded-full border border-red-100">
                                       <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                       -{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(c.remaining)} TL
                                   </span>
                               ) : (
                                   <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-100">
                                       <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                       ÖDENDİ
                                   </span>
                               )}
                           </td>
                           <td className="py-4 px-6 text-center">
                               <button className="text-gray-300 hover:text-indigo-600 transition-colors">
                                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                               </button>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
           {customers.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                    Kayıt bulunamadı.
                </div>
           )}
       </div>


       {/* Statement Modal - Optimized for A4 */}
       <Modal isOpen={!!selectedCustomer && !showRefundModal} onClose={() => setSelectedCustomer(null)} title="Hesap Ekstresi">
           {selectedCustomer && (
               <div className="bg-white">
                   {/* A4 Printable Area */}
                   <div id="statement-area" className="bg-white text-gray-900 p-8 max-w-[210mm] mx-auto min-h-[297mm] relative print:w-full print:h-full print:absolute print:top-0 print:left-0">
                       
                       {/* Header */}
                       <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                           <div>
                               <h1 className="text-2xl font-black uppercase tracking-widest text-black">HESAP EKSTRESİ</h1>
                               <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">{settings?.site_title || 'KURBAN SATIŞ'}</p>
                           </div>
                           <div className="text-right">
                               <div className="text-[10px] font-bold text-gray-400 uppercase">TARİH</div>
                               <div className="font-bold text-lg text-black">{new Date().toLocaleDateString('tr-TR')}</div>
                           </div>
                       </div>

                       {/* Customer Info */}
                       <div className="flex justify-between items-end mb-8 bg-gray-50 p-4 rounded border border-gray-100">
                           <div>
                               <h4 className="text-[10px] font-bold uppercase text-gray-400 mb-1">MÜŞTERİ</h4>
                               <h2 className="text-xl font-bold text-black uppercase">{selectedCustomer.name}</h2>
                               <p className="text-gray-600 font-mono text-sm">{selectedCustomer.phone}</p>
                           </div>
                           <div className="text-right print:hidden">
                               <button 
                                 onClick={() => setShowRefundModal(true)}
                                 className="text-red-600 hover:text-red-800 text-xs font-bold underline"
                               >
                                   İade / İptal Yap
                               </button>
                           </div>
                       </div>

                       {/* Transaction Table */}
                       <table className="w-full mb-8 text-sm">
                           <thead>
                               <tr className="border-b-2 border-black text-black">
                                   <th className="text-left py-2 font-bold uppercase text-xs">Tarih / İşlem</th>
                                   <th className="text-right py-2 font-bold uppercase text-xs">Borç</th>
                                   <th className="text-right py-2 font-bold uppercase text-xs">Ödenen</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {/* Initial Agreement */}
                               <tr>
                                   <td className="py-3">
                                       <div className="font-bold text-black">Hisse Satışı ({selectedCustomer.shareCount} Adet)</div>
                                       <div className="text-xs text-gray-500 uppercase">Küpe: #{selectedCustomer.animalTag} • {selectedCustomer.animalType}</div>
                                   </td>
                                   <td className="text-right py-3 font-medium">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selectedCustomer.amount_agreed)}</td>
                                   <td className="text-right py-3 text-gray-400">-</td>
                               </tr>
                               
                               {openingBalance > 0 && (
                                   <tr className="bg-gray-50">
                                       <td className="py-2 italic text-gray-500 text-xs pl-2">Devreden Bakiye</td>
                                       <td className="text-right py-2"></td>
                                       <td className="text-right py-2 font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(openingBalance)}</td>
                                   </tr>
                               )}

                               {customerTransactions.map((tx) => (
                                   <tr key={tx.id} className={tx.type === 'REFUND' ? 'bg-red-50' : ''}>
                                       <td className="py-3">
                                           <div className="font-medium">{new Date(tx.created_at).toLocaleDateString('tr-TR')}</div>
                                           <div className="text-[10px] text-gray-500 uppercase">{tx.description || (tx.type === 'REFUND' ? 'İade' : 'Ödeme')}</div>
                                       </td>
                                       <td className="text-right py-3"></td>
                                       <td className={`text-right py-3 font-bold ${tx.type === 'REFUND' ? 'text-red-600' : 'text-black'}`}>
                                           {tx.type === 'REFUND' ? '-' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.amount)}
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                           <tfoot className="border-t-2 border-black">
                               <tr>
                                   <td className="py-3 font-black text-xs uppercase">TOPLAM</td>
                                   <td className="text-right py-3 font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.amount_agreed)}</td>
                                   <td className="text-right py-3 font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.amount_paid)}</td>
                               </tr>
                           </tfoot>
                       </table>

                       {/* Summary Box */}
                       <div className="flex justify-end mb-8">
                           <div className="bg-gray-100 p-4 rounded min-w-[200px] text-right">
                               <span className="block text-[10px] font-bold uppercase text-gray-500">KALAN BAKİYE</span>
                               <span className={`text-2xl font-black ${selectedCustomer.remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                   {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.remaining)}
                               </span>
                           </div>
                       </div>

                       {/* Bank Info */}
                        {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                            <div className="border-t border-dashed border-gray-300 pt-6">
                                <h4 className="font-bold mb-2 text-[10px] uppercase text-gray-500 tracking-wider">Banka Hesap Bilgilerimiz</h4>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    {settings.bank_accounts.map((acc, i) => (
                                        <div key={i}>
                                            <span className="font-bold">{acc.bank_name}</span> - {acc.name}
                                            <div className="font-mono text-gray-600 mt-0.5">{acc.iban}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                   </div>

                   <div className="p-4 border-t flex justify-end bg-gray-50 print:hidden">
                       <button onClick={() => window.print()} className="bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-800 flex items-center gap-2">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                           Yazdır (A4)
                       </button>
                   </div>
                   
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            #statement-area, #statement-area * { visibility: visible; }
                            #statement-area { 
                                position: fixed; 
                                left: 0; 
                                top: 0; 
                                width: 100%; 
                                height: 100%;
                                z-index: 9999;
                                margin: 0;
                                padding: 1.5cm; /* Standard A4 padding */
                            }
                            @page { size: A4; margin: 0; }
                        }
                    `}</style>
               </div>
           )}
       </Modal>

       {/* Refund Modal */}
       <Modal isOpen={showRefundModal} onClose={() => setShowRefundModal(false)} title="Ödeme İade / İptal">
           <div className="space-y-6">
               <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex gap-3 items-start">
                   <div className="text-red-600 text-xl">⚠️</div>
                   <div className="text-sm text-red-800">
                       <h4 className="font-bold mb-1">Dikkat</h4>
                       <p className="text-xs">Bu işlem müşterinin "Ödenen" tutarını azaltır ve ekstreye "İade" satırı olarak yansır.</p>
                   </div>
               </div>
               <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2">İptal Edilecek Tutar (TL)</label>
                   <input 
                    type="number" 
                    value={refundAmount} 
                    onChange={e => setRefundAmount(e.target.value)}
                    className="w-full border p-3 rounded-lg text-lg font-bold outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="0.00"
                    max={selectedCustomer?.amount_paid}
                   />
               </div>
               <button onClick={handleRefund} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 shadow-lg">
                   İşlemi Onayla
               </button>
           </div>
       </Modal>
    </div>
  );
};

export default CustomersPage;

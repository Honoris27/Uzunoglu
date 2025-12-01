
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
      const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
      const index = name.length % colors.length;
      return colors[index];
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-3xl font-bold dark:text-white flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/30">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                Müşteri Listesi
            </h2>
            
            <div className="flex gap-2 w-full md:w-auto bg-white/70 dark:bg-gray-800/70 p-1.5 rounded-xl border border-white/20 shadow-sm backdrop-blur-sm">
                <input 
                    type="text" 
                    placeholder="Ad, Telefon veya Küpe Ara..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none rounded-lg px-4 py-2 w-full md:w-64 outline-none focus:ring-0 text-gray-700 dark:text-white placeholder-gray-400"
                />
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)}
                    className="bg-white dark:bg-gray-700 border-none rounded-lg px-4 py-2 text-gray-700 dark:text-white outline-none shadow-sm cursor-pointer"
                >
                    <option value="all">Tümü</option>
                    <option value="debt">Borçlu</option>
                    <option value="paid">Ödenen</option>
                </select>
            </div>
       </div>
       
       {/* Modern Table Layout */}
       <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md rounded-2xl border border-white/40 dark:border-gray-700/50 shadow-sm overflow-hidden">
           <table className="w-full text-left border-collapse">
               <thead>
                   <tr className="bg-gray-100/50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                       <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Müşteri</th>
                       <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">İletişim</th>
                       <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Kurban Bilgisi</th>
                       <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Toplam Tutar</th>
                       <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ödenen</th>
                       <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Kalan / Durum</th>
                       <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">İşlem</th>
                   </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                   {customers.map((c, i) => (
                       <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors group cursor-pointer" onClick={() => openDetail(c)}>
                           <td className="py-4 px-6">
                               <div className="flex items-center gap-3">
                                   <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${getAvatarColor(c.name)}`}>
                                       {c.name.charAt(0).toUpperCase()}
                                   </div>
                                   <div>
                                       <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                                       {c.shareCount > 1 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{c.shareCount} Hisse</span>}
                                   </div>
                               </div>
                           </td>
                           <td className="py-4 px-6 font-mono text-sm text-gray-600 dark:text-gray-300">{c.phone}</td>
                           <td className="py-4 px-6">
                               <div className="flex flex-col">
                                   <span className="font-bold text-gray-800 dark:text-gray-200">#{c.animalTag}</span>
                                   <span className="text-xs text-gray-500">{c.animalType}</span>
                               </div>
                           </td>
                           <td className="py-4 px-6 text-right font-medium text-gray-900 dark:text-gray-100">
                               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(c.amount_agreed)}
                           </td>
                           <td className="py-4 px-6 text-right text-emerald-600 font-medium">
                               {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(c.amount_paid)}
                           </td>
                           <td className="py-4 px-6 text-right">
                               {c.remaining > 0 ? (
                                   <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-200 min-w-[80px] text-center">
                                       -{new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(c.remaining)} TL
                                   </span>
                               ) : (
                                   <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200 min-w-[80px] text-center">
                                       ÖDENDİ
                                   </span>
                               )}
                           </td>
                           <td className="py-4 px-6 text-center">
                               <button className="text-gray-400 hover:text-indigo-600 transition-colors">
                                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                               </button>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
           {customers.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    Kayıt bulunamadı.
                </div>
           )}
       </div>


       {/* Statement Modal - Styled as A4 Invoice */}
       <Modal isOpen={!!selectedCustomer && !showRefundModal} onClose={() => setSelectedCustomer(null)} title="Hesap Ekstresi">
           {selectedCustomer && (
               <div className="bg-white text-gray-900 p-8 relative overflow-hidden" id="statement-area">
                   
                   {/* Header */}
                   <div className="flex justify-between items-start border-b-4 border-gray-800 pb-6 mb-8">
                       <div>
                           <h1 className="text-4xl font-black uppercase tracking-widest text-gray-900">HESAP EKSTRESİ</h1>
                           <p className="text-sm font-bold text-gray-500 mt-2 tracking-[0.2em] uppercase">{settings?.site_title || 'KURBAN SATIŞ ORGANİZASYONU'}</p>
                       </div>
                       <div className="text-right">
                           <div className="bg-gray-100 px-4 py-2 rounded-lg inline-block">
                               <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">TARİH</div>
                               <div className="font-bold text-xl text-gray-900">{new Date().toLocaleDateString('tr-TR')}</div>
                           </div>
                       </div>
                   </div>

                   {/* Customer Info Box */}
                   <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 flex justify-between items-center shadow-sm">
                       <div>
                           <h4 className="text-xs font-bold uppercase text-gray-400 mb-1 tracking-wider">SAYIN</h4>
                           <h2 className="text-3xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                           <p className="text-gray-600 font-mono text-lg mt-1">{selectedCustomer.phone}</p>
                       </div>
                       <div className="no-print">
                           <button 
                             onClick={() => setShowRefundModal(true)}
                             className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 transition-colors flex items-center gap-2"
                           >
                               İade / İptal
                           </button>
                       </div>
                   </div>

                   {/* Transaction Table */}
                   <div className="mb-10">
                       <table className="w-full border-collapse">
                           <thead>
                               <tr className="bg-gray-900 text-white">
                                   <th className="text-left py-3 px-4 font-bold uppercase text-xs tracking-wider rounded-tl-lg">Tarih / İşlem</th>
                                   <th className="text-right py-3 px-4 font-bold uppercase text-xs tracking-wider">Borç</th>
                                   <th className="text-right py-3 px-4 font-bold uppercase text-xs tracking-wider rounded-tr-lg">Ödenen</th>
                               </tr>
                           </thead>
                           <tbody className="text-sm">
                               {/* Initial Agreement Row */}
                               <tr className="border-b border-gray-200 hover:bg-gray-50">
                                   <td className="py-4 px-4">
                                       <span className="block font-bold text-gray-800 text-base">Hisse Satışı ({selectedCustomer.shareCount} Adet)</span>
                                       <span className="text-xs text-gray-500 uppercase tracking-wide">Küpe: #{selectedCustomer.animalTag} • {selectedCustomer.animalType}</span>
                                   </td>
                                   <td className="text-right py-4 px-4 font-bold text-gray-800 text-lg">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selectedCustomer.amount_agreed)}</td>
                                   <td className="text-right py-4 px-4 text-gray-400">-</td>
                               </tr>
                               
                               {/* Opening Balance */}
                               {openingBalance > 0 && (
                                   <tr className="border-b border-gray-200 bg-gray-50">
                                       <td className="py-3 px-4 italic text-gray-500">Devreden Ödeme Bakiyesi</td>
                                       <td className="text-right py-3 px-4"></td>
                                       <td className="text-right py-3 px-4 text-emerald-600 font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(openingBalance)}</td>
                                   </tr>
                               )}

                               {/* Transactions */}
                               {customerTransactions.map((tx) => (
                                   <tr key={tx.id} className={`border-b border-gray-100 ${tx.type === 'REFUND' ? 'bg-red-50' : ''}`}>
                                       <td className="py-3 px-4">
                                           <div className="font-bold text-gray-800">{new Date(tx.created_at).toLocaleDateString('tr-TR')}</div>
                                           <div className="text-xs text-gray-500">{tx.description || (tx.type === 'REFUND' ? 'İade/İptal' : 'Ödeme')}</div>
                                       </td>
                                       <td className="text-right py-3 px-4"></td>
                                       <td className={`text-right py-3 px-4 font-bold ${tx.type === 'REFUND' ? 'text-red-600' : 'text-emerald-600'}`}>
                                           {tx.type === 'REFUND' ? '-' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.amount)}
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                           {/* Footer Summary */}
                           <tfoot className="bg-gray-50 border-t-2 border-gray-900">
                               <tr>
                                   <td className="py-4 px-4 font-black text-gray-900 uppercase">GENEL TOPLAM</td>
                                   <td className="text-right py-4 px-4 font-bold text-gray-900 text-lg">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.amount_agreed)}</td>
                                   <td className="text-right py-4 px-4 font-bold text-emerald-600 text-lg">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.amount_paid)}</td>
                               </tr>
                               <tr>
                                   <td colSpan={3} className="text-right px-4 py-4 bg-gray-100 rounded-b-lg">
                                       <span className="text-gray-500 text-sm font-bold uppercase mr-4">Kalan Bakiye:</span>
                                       <span className={`text-3xl font-black ${selectedCustomer.remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                           {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.remaining)}
                                       </span>
                                   </td>
                               </tr>
                           </tfoot>
                       </table>
                   </div>

                    {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                        <div className="mt-8 p-6 border-2 border-dashed border-gray-300 rounded-xl bg-white">
                            <h4 className="font-bold mb-4 text-xs uppercase text-gray-500 tracking-wider">Banka Hesap Bilgilerimiz</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {settings.bank_accounts.map((acc, i) => (
                                    <div key={i} className="flex flex-col p-3 bg-gray-50 rounded border border-gray-200">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-900 uppercase">{acc.bank_name}</span>
                                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                                            <span className="text-gray-600">{acc.name}</span>
                                        </div>
                                        <span className="font-mono text-gray-800 text-sm select-all">{acc.iban}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                   <div className="mt-8 flex justify-end no-print">
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
                                    padding: 1.5cm; 
                                    background: white; 
                                    color: black; 
                                    z-index: 9999;
                                }
                                .no-print { display: none !important; }
                            }
                        `}</style>
                       <button onClick={() => window.print()} className="bg-black text-white px-8 py-3 rounded-xl hover:bg-gray-800 font-bold flex items-center gap-3 shadow-lg transition-transform hover:-translate-y-1">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                           Yazdır (A4)
                       </button>
                   </div>
               </div>
           )}
       </Modal>

       {/* Refund Modal */}
       <Modal isOpen={showRefundModal} onClose={() => setShowRefundModal(false)} title="Ödeme İade / İptal">
           <div className="space-y-6">
               <div className="bg-red-50 p-5 rounded-xl border border-red-100 flex gap-4 items-start">
                   <div className="text-red-600">⚠️</div>
                   <div className="text-sm text-red-800">
                       <h4 className="font-bold mb-1">Dikkat Ediniz</h4>
                       <p>Bu işlem müşterinin "Ödenen" tutarını azaltır ve ekstreye "İade" satırı olarak yansır. Bu işlem geri alınamaz.</p>
                   </div>
               </div>
               <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">İptal Edilecek Tutar (TL)</label>
                   <input 
                    type="number" 
                    value={refundAmount} 
                    onChange={e => setRefundAmount(e.target.value)}
                    className="w-full border p-4 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="0.00"
                    max={selectedCustomer?.amount_paid}
                   />
               </div>
               <button onClick={handleRefund} className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-500/20">
                   İşlemi Onayla
               </button>
           </div>
       </Modal>
    </div>
  );
};

export default CustomersPage;

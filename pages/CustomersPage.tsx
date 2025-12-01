
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

  return (
    <div className="max-w-7xl mx-auto">
       <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-3xl font-bold dark:text-white flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                    <svg className="w-8 h-8 text-purple-600 dark:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                Müşteri Listesi
            </h2>
            
            <div className="flex gap-2 w-full md:w-auto">
                <input 
                    type="text" 
                    placeholder="Ad, Telefon veya Küpe Ara..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 w-full md:w-64 dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select 
                    value={filterStatus} 
                    onChange={e => setFilterStatus(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-800 dark:text-white outline-none"
                >
                    <option value="all">Tümü</option>
                    <option value="debt">Borçlu</option>
                    <option value="paid">Ödenen</option>
                </select>
            </div>
       </div>
       
       <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
         <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                 <tr>
                   <th className="p-5">Müşteri</th>
                   <th className="p-5">Hayvan Bilgisi</th>
                   <th className="p-5 text-center">Hisse</th>
                   <th className="p-5 text-right">Toplam Tutar</th>
                   <th className="p-5 text-right">Kalan Borç</th>
                   <th className="p-5 text-center">Durum</th>
                   <th className="p-5 text-right">İşlemler</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                 {customers.map((c, i) => (
                   <tr key={i} className="hover:bg-purple-50 dark:hover:bg-gray-700/50 transition-colors group">
                     <td className="p-5">
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                 {c.name.charAt(0).toUpperCase()}
                             </div>
                             <div>
                                 <div className="font-bold text-gray-900 dark:text-white">{c.name}</div>
                                 <div className="text-gray-500 dark:text-gray-400 text-xs font-mono">{c.phone}</div>
                             </div>
                         </div>
                     </td>
                     <td className="p-5">
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-800 dark:text-gray-200">#{c.animalTag}</span>
                            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded w-fit mt-1">{c.animalType}</span>
                        </div>
                     </td>
                     <td className="p-5 text-center">
                         <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${c.shareCount > 1 ? 'bg-blue-100 text-blue-800' : 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}>
                             {c.shareCount} Adet
                         </span>
                     </td>
                     <td className="p-5 text-right font-medium dark:text-gray-300">
                         {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(c.amount_agreed)}
                     </td>
                     <td className="p-5 text-right">
                        {c.remaining > 0 ? (
                            <span className="font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">-{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(c.remaining)}</span>
                        ) : (
                            <span className="font-bold text-emerald-600 flex items-center justify-end gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                0 TL
                            </span>
                        )}
                     </td>
                     <td className="p-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                           c.remaining <= 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                           c.amount_paid > 0 ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-red-100 text-red-800 border-red-200'
                        }`}>
                          {c.remaining <= 0 ? 'ÖDENDİ' : c.amount_paid > 0 ? 'KISMI' : 'ÖDENMEDİ'}
                        </span>
                     </td>
                     <td className="p-5 text-right">
                         <button 
                            onClick={() => openDetail(c)}
                            className="text-purple-600 hover:text-white hover:bg-purple-600 px-4 py-2 rounded-lg transition-all font-medium text-sm border border-purple-200 hover:border-purple-600"
                         >
                             Ekstre
                         </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
             {customers.length === 0 && (
                 <div className="p-10 text-center text-gray-500 dark:text-gray-400">
                     Aradığınız kriterlere uygun müşteri bulunamadı.
                 </div>
             )}
         </div>
       </div>

       {/* Statement Modal */}
       <Modal isOpen={!!selectedCustomer && !showRefundModal} onClose={() => setSelectedCustomer(null)} title="Hesap Ekstresi">
           {selectedCustomer && (
               <div className="bg-white text-gray-900" id="statement-area">
                   <div className="border-b-2 border-gray-900 pb-6 mb-6 flex justify-between items-start">
                       <div>
                           <h1 className="text-3xl font-black uppercase tracking-widest text-gray-900">HESAP EKSTRESİ</h1>
                           <p className="text-sm font-bold text-gray-500 mt-1 tracking-widest uppercase">{settings?.site_title || 'KURBAN SATIŞ ORGANİZASYONU'}</p>
                       </div>
                       <div className="text-right">
                           <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tarih</div>
                           <div className="font-bold text-lg">{new Date().toLocaleDateString('tr-TR')}</div>
                       </div>
                   </div>

                   <div className="bg-gray-50 p-6 rounded-xl mb-8 border border-gray-200 flex justify-between items-center">
                       <div>
                           <h4 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Müşteri</h4>
                           <h2 className="text-2xl font-bold text-gray-900">{selectedCustomer.name}</h2>
                           <p className="text-gray-600 font-mono mt-1">{selectedCustomer.phone}</p>
                       </div>
                       <div className="no-print">
                           <button 
                             onClick={() => setShowRefundModal(true)}
                             className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 transition-colors flex items-center gap-2"
                           >
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                               İade / İptal
                           </button>
                       </div>
                   </div>

                   <div className="mb-8">
                       <table className="w-full border-collapse">
                           <thead>
                               <tr className="border-b border-gray-300">
                                   <th className="text-left py-3 font-bold text-gray-600 uppercase text-xs tracking-wider">Tarih / Açıklama</th>
                                   <th className="text-right py-3 font-bold text-gray-600 uppercase text-xs tracking-wider">Borç</th>
                                   <th className="text-right py-3 font-bold text-gray-600 uppercase text-xs tracking-wider">Ödenen</th>
                                   <th className="text-right py-3 font-bold text-gray-600 uppercase text-xs tracking-wider">Bakiye</th>
                               </tr>
                           </thead>
                           <tbody className="text-sm">
                               {/* Initial Agreement */}
                               <tr className="border-b border-gray-100">
                                   <td className="py-4">
                                       <span className="block font-bold text-gray-800 text-base">Hisse Satışı ({selectedCustomer.shareCount} Adet)</span>
                                       <span className="text-xs text-gray-500 uppercase tracking-wide">Küpe: #{selectedCustomer.animalTag} • {selectedCustomer.animalType}</span>
                                   </td>
                                   <td className="text-right py-4 text-gray-800">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selectedCustomer.amount_agreed)}</td>
                                   <td className="text-right py-4 text-gray-400">-</td>
                                   <td className="text-right py-4 font-bold text-gray-800">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(selectedCustomer.amount_agreed)}</td>
                               </tr>
                               
                               {/* Opening Balance */}
                               {openingBalance > 0 && (
                                   <tr className="border-b border-gray-100 bg-gray-50/50">
                                       <td className="py-3 pl-2 italic text-gray-500">Devreden Ödeme Bakiyesi</td>
                                       <td className="text-right py-3"></td>
                                       <td className="text-right py-3 text-emerald-600 font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(openingBalance)}</td>
                                       <td className="text-right py-3"></td>
                                   </tr>
                               )}

                               {/* Transaction Log */}
                               {customerTransactions.map((tx) => (
                                   <tr key={tx.id} className={`border-b border-gray-100 ${tx.type === 'REFUND' ? 'bg-red-50' : 'bg-emerald-50/30'}`}>
                                       <td className="py-3 pl-2">
                                           <div className="font-bold text-gray-800">{new Date(tx.created_at).toLocaleDateString('tr-TR')}</div>
                                           <div className="text-xs text-gray-500">{tx.description || (tx.type === 'REFUND' ? 'İade/İptal' : 'Ödeme')}</div>
                                       </td>
                                       <td className="text-right py-3"></td>
                                       <td className={`text-right py-3 font-bold ${tx.type === 'REFUND' ? 'text-red-600' : 'text-emerald-600'}`}>
                                           {tx.type === 'REFUND' ? '-' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(tx.amount)}
                                       </td>
                                       <td className="text-right py-3"></td>
                                   </tr>
                               ))}
                           </tbody>
                           <tfoot className="border-t-2 border-gray-900 bg-gray-50">
                               <tr>
                                   <td className="py-4 pl-4 font-black text-lg text-gray-900 uppercase">GENEL TOPLAM</td>
                                   <td className="text-right py-4 font-bold text-gray-900">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.amount_agreed)}</td>
                                   <td className="text-right py-4 font-bold text-emerald-600">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.amount_paid)}</td>
                                   <td className="text-right py-4 font-black text-xl text-red-600 pr-4">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(selectedCustomer.remaining)}</td>
                               </tr>
                           </tfoot>
                       </table>
                   </div>

                    {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                        <div className="mt-8 p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                            <h4 className="font-bold mb-4 text-xs uppercase text-gray-500 tracking-wider">Banka Hesap Bilgilerimiz</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {settings.bank_accounts.map((acc, i) => (
                                    <div key={i} className="flex flex-col p-2 bg-white rounded border border-gray-200">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-900 uppercase">{acc.bank_name}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span className="text-gray-500">{acc.name}</span>
                                        </div>
                                        <span className="font-mono text-gray-700 text-sm select-all">{acc.iban}</span>
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
                                #statement-area { position: absolute; left: 0; top: 0; width: 100%; padding: 1cm; background: white; color: black; }
                                .no-print { display: none; }
                            }
                        `}</style>
                       <button onClick={() => window.print()} className="bg-gray-900 text-white px-8 py-3 rounded-xl hover:bg-black font-bold flex items-center gap-3 shadow-lg transition-transform hover:-translate-y-1">
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
                   <div className="bg-red-100 p-2 rounded-full text-red-600">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                   </div>
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

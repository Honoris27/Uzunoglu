
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

  useEffect(() => {
    configService.getSettings().then(setSettings);
  }, []);

  // Group Customers Logic:
  // If a customer has multiple shares (same Name + Animal), they appear as 1 row with aggregated totals.
  const customers = useMemo(() => {
    const groupedData = new Map<string, any>();

    animals.forEach(animal => {
      if (animal.shares) {
        animal.shares.forEach(share => {
          // Create a unique key for grouping. We use Name + AnimalID. 
          // Ideally use Phone too, but sometimes users don't enter phone perfectly same.
          // Using ID based grouping:
          const key = `${animal.id}_${share.name}`;
          
          if (groupedData.has(key)) {
              // Update existing entry
              const existing = groupedData.get(key);
              existing.shareCount += 1;
              existing.amount_agreed += share.amount_agreed;
              existing.amount_paid += share.amount_paid;
              existing.remaining += (share.amount_agreed - share.amount_paid);
              existing.ids.push(share.id);
              
              // Determine status: if any share is unpaid/partial, the group is partially paid unless all are paid
              if (share.status !== ShareStatus.Paid) {
                  existing.status = ShareStatus.Partial;
              }
          } else {
              // Create new entry
              groupedData.set(key, {
                  ...share,
                  ids: [share.id], // Keep track of all share IDs for this group
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
    
    // Convert map to array and sort
    return Array.from(groupedData.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [animals]);

  const openDetail = async (customerGroup: any) => {
      setSelectedCustomer(customerGroup);
      
      // Fetch transactions for ALL shares in this group
      try {
          const allTransactions = await Promise.all(
              customerGroup.ids.map((id: string) => paymentService.getByShareId(id))
          );
          // Flatten array and sort by date
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

      // Refund Logic for grouped shares:
      // We apply the refund to the first share in the group that has payment, or split it?
      // Simpler: Apply to the first share ID for record keeping.
      // Ideally we should ask WHICH share, but since they are grouped, we assume it's against the total debt.
      
      try {
          // We need to fetch the specific share data again to be safe, but we'll use the first one from IDs
          const targetShareId = selectedCustomer.ids[0]; 
          // We need current data for that share to update it correctly
          // For simplicity in this grouped view, we will just log the transaction against the first ID.
          // IMPORTANT: Status updates might be tricky if we don't know which specific share it belongs to.
          // For now, we just log the transaction. The DB trigger or logic handles balance.
          
          // Re-fetching the specific share to update its paid amount
          // Since we are in frontend-only logic mostly for calculation, let's just update the DB
          
          // Update: Just decrease amount_paid from the "Customer Group" total is visual. 
          // We must update a real row in DB.
          // We will update the FIRST share in the list.
          
          // NOTE: This is a limitation of grouping. We will pick the first share.
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

  // Calculate opening balance based on Total Paid - Sum of logged transactions
  const loggedTotal = customerTransactions
        .filter(t => t.type === 'PAYMENT')
        .reduce((sum, t) => sum + t.amount, 0) 
        - 
        customerTransactions
        .filter(t => t.type === 'REFUND')
        .reduce((sum, t) => sum + t.amount, 0);
  
  const openingBalance = selectedCustomer ? selectedCustomer.amount_paid - loggedTotal : 0;

  return (
    <div>
       <h2 className="text-2xl font-bold mb-6 dark:text-white flex items-center gap-2">
           <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
           </svg>
           Müşteri Listesi
       </h2>
       
       <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
         <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs uppercase tracking-wider">
                 <tr>
                   <th className="p-4 font-semibold">Müşteri</th>
                   <th className="p-4 font-semibold">İletişim</th>
                   <th className="p-4 font-semibold">Hayvan</th>
                   <th className="p-4 font-semibold text-center">Hisse Adedi</th>
                   <th className="p-4 font-semibold text-right">Kalan Borç</th>
                   <th className="p-4 font-semibold text-center">Durum</th>
                   <th className="p-4 font-semibold"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                 {customers.map((c, i) => (
                   <tr key={i} className="hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors">
                     <td className="p-4 font-bold text-gray-900 dark:text-white">{c.name}</td>
                     <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-sm">{c.phone}</td>
                     <td className="p-4 dark:text-gray-300">
                        <div className="flex flex-col">
                            <span className="font-bold">#{c.animalTag}</span>
                            <span className="text-xs text-gray-400">{c.animalType}</span>
                        </div>
                     </td>
                     <td className="p-4 text-center">
                         {c.shareCount > 1 ? (
                             <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                                 {c.shareCount} ADET
                             </span>
                         ) : (
                             <span className="text-gray-400 text-sm">1</span>
                         )}
                     </td>
                     <td className="p-4 text-right">
                        {c.remaining > 0 ? (
                            <span className="font-bold text-red-600">-{c.remaining} TL</span>
                        ) : (
                            <span className="font-bold text-green-600">0 TL</span>
                        )}
                     </td>
                     <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                           c.remaining <= 0 ? 'bg-green-100 text-green-800' : 
                           c.amount_paid > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {c.remaining <= 0 ? 'ÖDENDİ' : c.amount_paid > 0 ? 'KISMI' : 'ÖDENMEDİ'}
                        </span>
                     </td>
                     <td className="p-4 text-right">
                         <button 
                            onClick={() => openDetail(c)}
                            className="text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-3 py-1 rounded-lg transition-colors font-medium text-sm"
                         >
                             Ekstre Görüntüle
                         </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
         </div>
       </div>

       {/* Statement Modal */}
       <Modal isOpen={!!selectedCustomer && !showRefundModal} onClose={() => setSelectedCustomer(null)} title="Hesap Ekstresi">
           {selectedCustomer && (
               <div className="bg-white text-gray-900" id="statement-area">
                   <div className="border-b-2 border-gray-800 pb-6 mb-6 flex justify-between items-start">
                       <div>
                           <h1 className="text-3xl font-bold uppercase tracking-wide text-primary-700">Hesap Ekstresi</h1>
                           <p className="text-sm text-gray-500 mt-1">Kurban Satış Organizasyonu</p>
                       </div>
                       <div className="text-right">
                           <div className="text-sm text-gray-500">Tarih</div>
                           <div className="font-bold">{new Date().toLocaleDateString('tr-TR')}</div>
                       </div>
                   </div>

                   <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-100 flex justify-between items-center">
                       <div>
                           <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Sayın Müşteri</h4>
                           <h2 className="text-2xl font-bold">{selectedCustomer.name}</h2>
                           <p className="text-gray-600 font-mono">{selectedCustomer.phone}</p>
                       </div>
                       <div className="no-print">
                           <button 
                             onClick={() => setShowRefundModal(true)}
                             className="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold border border-red-200"
                           >
                               İade / İptal Yap
                           </button>
                       </div>
                   </div>

                   <div className="mb-8">
                       <table className="w-full border-collapse">
                           <thead>
                               <tr className="border-b border-gray-300">
                                   <th className="text-left py-2 font-bold text-gray-600">Tarih / Açıklama</th>
                                   <th className="text-right py-2 font-bold text-gray-600">Borç</th>
                                   <th className="text-right py-2 font-bold text-gray-600">Ödenen</th>
                                   <th className="text-right py-2 font-bold text-gray-600">Bakiye</th>
                               </tr>
                           </thead>
                           <tbody className="text-sm">
                               {/* Initial Agreement */}
                               <tr className="border-b border-gray-100">
                                   <td className="py-3">
                                       <span className="block font-bold text-gray-800">Kurban Hissesi Satışı ({selectedCustomer.shareCount} Adet)</span>
                                       <span className="text-xs text-gray-500">Küpe No: #{selectedCustomer.animalTag} ({selectedCustomer.animalType})</span>
                                   </td>
                                   <td className="text-right py-3">{selectedCustomer.amount_agreed} TL</td>
                                   <td className="text-right py-3">0 TL</td>
                                   <td className="text-right py-3">{selectedCustomer.amount_agreed} TL</td>
                               </tr>
                               
                               {/* Opening Balance (Old Payments) */}
                               {openingBalance > 0 && (
                                   <tr className="border-b border-gray-100 bg-gray-50/30">
                                       <td className="py-3 pl-2 italic">Devreden Ödeme Bakiyesi</td>
                                       <td className="text-right py-3"></td>
                                       <td className="text-right py-3 text-green-700">{openingBalance} TL</td>
                                       <td className="text-right py-3"></td>
                                   </tr>
                               )}

                               {/* Transaction Log */}
                               {customerTransactions.map((tx) => (
                                   <tr key={tx.id} className={`border-b border-gray-100 ${tx.type === 'REFUND' ? 'bg-red-50' : 'bg-green-50/50'}`}>
                                       <td className="py-3 pl-2">
                                           <div className="font-bold">{new Date(tx.created_at).toLocaleDateString('tr-TR')}</div>
                                           <div className="text-xs text-gray-500">{tx.description || (tx.type === 'REFUND' ? 'İade/İptal' : 'Ödeme')}</div>
                                       </td>
                                       <td className="text-right py-3"></td>
                                       <td className={`text-right py-3 font-bold ${tx.type === 'REFUND' ? 'text-red-600' : 'text-green-700'}`}>
                                           {tx.type === 'REFUND' ? '-' : ''}{tx.amount} TL
                                       </td>
                                       <td className="text-right py-3"></td>
                                   </tr>
                               ))}
                           </tbody>
                           <tfoot className="border-t-2 border-gray-800">
                               <tr>
                                   <td className="py-4 font-bold text-lg">GENEL TOPLAM</td>
                                   <td className="text-right py-4 font-bold">{selectedCustomer.amount_agreed} TL</td>
                                   <td className="text-right py-4 font-bold text-green-700">{selectedCustomer.amount_paid} TL</td>
                                   <td className="text-right py-4 font-bold text-xl text-red-600">{selectedCustomer.remaining} TL</td>
                               </tr>
                           </tfoot>
                       </table>
                   </div>

                    {settings?.bank_accounts && settings.bank_accounts.length > 0 && (
                        <div className="mt-8 p-4 border border-dashed border-gray-300 rounded bg-gray-50">
                            <h4 className="font-bold mb-3 text-sm uppercase text-gray-500 border-b pb-1">Banka Hesap Bilgilerimiz</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {settings.bank_accounts.map((acc, i) => (
                                    <div key={i} className="flex flex-col">
                                        <span className="font-bold text-gray-800">{acc.bank_name}</span>
                                        <span className="text-gray-600">{acc.name}</span>
                                        <span className="font-mono bg-white p-1 border rounded mt-1 select-all">{acc.iban}</span>
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
                       <button onClick={() => window.print()} className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-black font-bold flex items-center gap-2 shadow-lg">
                           Yazdır (A4)
                       </button>
                   </div>
               </div>
           )}
       </Modal>

       {/* Refund Modal */}
       <Modal isOpen={showRefundModal} onClose={() => setShowRefundModal(false)} title="Ödeme İade / İptal">
           <div className="space-y-4">
               <div className="bg-red-50 p-4 rounded text-red-800 text-sm">
                   Bu işlem müşterinin "Ödenen" tutarını azaltır ve ekstreye "İade" olarak yansır.
               </div>
               <div>
                   <label className="block text-sm font-bold text-gray-700 mb-1">İptal Edilecek Tutar</label>
                   <input 
                    type="number" 
                    value={refundAmount} 
                    onChange={e => setRefundAmount(e.target.value)}
                    className="w-full border p-2 rounded"
                    max={selectedCustomer?.amount_paid}
                   />
               </div>
               <button onClick={handleRefund} className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">
                   İşlemi Onayla
               </button>
           </div>
       </Modal>
    </div>
  );
};

export default CustomersPage;

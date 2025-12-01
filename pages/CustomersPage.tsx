
import React, { useState, useMemo } from 'react';
import { Animal, ShareStatus } from '../types';
import Modal from '../components/Modal';

interface Props {
  animals: Animal[];
}

const CustomersPage: React.FC<Props> = ({ animals }) => {
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const customers = useMemo(() => {
    const list: any[] = [];
    animals.forEach(animal => {
      if (animal.shares) {
        animal.shares.forEach(share => {
          list.push({
            ...share,
            animalTag: animal.tag_number,
            animalPrice: animal.total_price,
            remaining: share.amount_agreed - share.amount_paid
          });
        });
      }
    });
    return list;
  }, [animals]);

  const openDetail = (customer: any) => {
      setSelectedCustomer(customer);
  };

  return (
    <div>
       <h2 className="text-2xl font-bold mb-6 dark:text-white">Müşteri Listesi</h2>
       <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
         <table className="w-full text-left border-collapse">
           <thead className="bg-gray-50 dark:bg-gray-700">
             <tr>
               <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Ad Soyad</th>
               <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Telefon</th>
               <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Küpe No</th>
               <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Borç</th>
               <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Durum</th>
               <th className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-200">Detay</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
             {customers.map((c, i) => (
               <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                 <td className="p-4 font-medium dark:text-gray-300">{c.name}</td>
                 <td className="p-4 text-gray-500 dark:text-gray-400">{c.phone}</td>
                 <td className="p-4 dark:text-gray-300">#{c.animalTag}</td>
                 <td className="p-4 text-red-600 font-bold">{c.remaining > 0 ? `${c.remaining} TL` : '-'}</td>
                 <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded ${
                       c.status === ShareStatus.Paid ? 'bg-green-100 text-green-700' : 
                       c.status === ShareStatus.Partial ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.status}
                    </span>
                 </td>
                 <td className="p-4">
                     <button 
                        onClick={() => openDetail(c)}
                        className="text-primary-600 hover:text-primary-800 font-semibold text-sm"
                     >
                         Görüntüle
                     </button>
                 </td>
               </tr>
             ))}
             {customers.length === 0 && (
               <tr><td colSpan={6} className="p-6 text-center text-gray-400">Kayıt bulunamadı.</td></tr>
             )}
           </tbody>
         </table>
       </div>

       {/* Detail Modal */}
       <Modal isOpen={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title="Müşteri Detayı">
           {selectedCustomer && (
               <div className="space-y-6" id="statement-area">
                   <div className="border-b pb-4">
                       <h3 className="text-2xl font-bold">{selectedCustomer.name}</h3>
                       <p className="text-gray-500">{selectedCustomer.phone}</p>
                   </div>

                   <div className="bg-gray-50 p-4 rounded-lg">
                       <h4 className="font-bold text-gray-700 mb-2">Hisse Bilgileri</h4>
                       <div className="grid grid-cols-2 gap-4 text-sm">
                           <div>Hayvan Küpe:</div>
                           <div className="font-bold">#{selectedCustomer.animalTag}</div>
                           
                           <div>Anlaşılan Tutar:</div>
                           <div className="font-bold">{selectedCustomer.amount_agreed} TL</div>
                           
                           <div>Ödenen Tutar:</div>
                           <div className="font-bold text-green-600">{selectedCustomer.amount_paid} TL</div>
                           
                           <div>Kalan Borç:</div>
                           <div className="font-bold text-red-600">{selectedCustomer.remaining} TL</div>
                       </div>
                   </div>

                   <div className="text-center pt-4">
                        <style>{`
                            @media print {
                                body * { visibility: hidden; }
                                #statement-area, #statement-area * { visibility: visible; }
                                #statement-area { position: absolute; left: 0; top: 0; width: 100%; padding: 2cm; }
                                .no-print { display: none; }
                            }
                        `}</style>
                       <button onClick={() => window.print()} className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-black no-print">
                           Hesap Ekstresi Yazdır (A4)
                       </button>
                   </div>
               </div>
           )}
       </Modal>
    </div>
  );
};

export default CustomersPage;

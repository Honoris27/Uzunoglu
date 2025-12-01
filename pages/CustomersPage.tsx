
import React from 'react';
import { Animal } from '../types';

interface Props {
  animals: Animal[];
}

const CustomersPage: React.FC<Props> = ({ animals }) => {
  // Derive customers from shares
  const customers = React.useMemo(() => {
    const list: any[] = [];
    animals.forEach(animal => {
      if (animal.shares) {
        animal.shares.forEach(share => {
          list.push({
            ...share,
            animalTag: animal.tag_number,
            remaining: share.amount_agreed - share.amount_paid
          });
        });
      }
    });
    return list;
  }, [animals]);

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
                       c.status === 'ODENDI' ? 'bg-green-100 text-green-700' : 
                       c.status === 'KISMI' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {c.status}
                    </span>
                 </td>
               </tr>
             ))}
             {customers.length === 0 && (
               <tr><td colSpan={5} className="p-6 text-center text-gray-400">Kayıt bulunamadı.</td></tr>
             )}
           </tbody>
         </table>
       </div>
    </div>
  );
};

export default CustomersPage;

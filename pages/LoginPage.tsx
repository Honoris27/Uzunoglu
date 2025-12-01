
import React, { useState } from 'react';
import Modal from '../components/Modal';
import { SQL_SETUP_SCRIPT } from '../constants';

interface LoginProps {
  onLogin: (password: string) => void;
  settings: any;
}

const LoginPage: React.FC<LoginProps> = ({ onLogin, settings }) => {
  const [password, setPassword] = useState('');
  const [showSql, setShowSql] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Kurban<span className="text-primary-600">Sistemi</span></h1>
          <p className="text-gray-500 mt-2">Yönetici Girişi</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Admin şifresi"
              autoFocus
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
          >
            Giriş Yap
          </button>
        </form>

        <div className="mt-8 pt-6 border-t text-center">
            <button 
                onClick={() => setShowSql(true)}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
                Veritabanı Kurulumu (İlk Çalıştırma)
            </button>
        </div>
      </div>

      <Modal isOpen={showSql} onClose={() => setShowSql(false)} title="SQL Kurulumu">
        <div className="space-y-4">
             <p className="text-sm text-gray-600">
            Aşağıdaki kodu kopyalayıp Supabase SQL Editor'de çalıştırın.
          </p>
          <div className="bg-gray-800 rounded-lg p-4 relative">
            <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
              {SQL_SETUP_SCRIPT}
            </pre>
            <button 
              onClick={() => navigator.clipboard.writeText(SQL_SETUP_SCRIPT)}
              className="absolute top-2 right-2 bg-white/10 text-white text-xs px-2 py-1 rounded hover:bg-white/20"
            >
              Kopyala
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LoginPage;

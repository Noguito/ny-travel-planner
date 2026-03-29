import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, MapPin, Plus, Trash2, Edit2, Loader2, Plane, 
  Wallet, Calendar, Clock, LogOut, Search 
} from 'lucide-react';

// Firebase Core & Auth
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';

// TUS CLAVES OFICIALES
const firebaseConfig = {
  apiKey: "AIzaSyDrU7LqHmNKpQqC0kTgqRMpH_FBJo6RP0k",
  authDomain: "ny-travel-planner.firebaseapp.com",
  projectId: "ny-travel-planner",
  storageBucket: "ny-travel-planner.firebasestorage.app",
  messagingSenderId: "169070607923",
  appId: "1:169070607923:web:ee77bd2fc5fdf6e8aaad46"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ID compartido para el entorno ADN & GAP (Opción B)
const SHARED_TRIP_ID = "viaje_ny_2026_adn_gap";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('itinerary');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error en login:", error);
    }
  };

  if (loading) return (
    <div className="h-screen bg-slate-50 flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
      <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Iniciando Sistemas...</p>
    </div>
  );

  // PANTALLA DE ACCESO (PRODUCCIÓN)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md text-center space-y-8">
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25"></div>
            <Plane className="relative text-indigo-600" size={60} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">NY Travel Planner</h1>
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-2">Acceso Exclusivo ADN & GAP</p>
          </div>
          <button 
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Entrar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header Dinámico */}
      <header className={`pt-12 pb-6 text-white shadow-2xl transition-colors duration-500 ${activeTab === 'shopping' ? 'bg-blue-900' : 'bg-emerald-900'}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black">NY</div>
              <h1 className="text-xl md:text-2xl font-black tracking-tighter italic">ADN & GAP 🩵💜</h1>
            </div>
            <div className="flex items-center gap-4">
              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border-2 border-white/20" />
              <button onClick={() => signOut(auth)} className="p-2 bg-white/10 rounded-xl hover:bg-rose-500 transition-colors"><LogOut size={18}/></button>
            </div>
          </div>
          
          <nav className="flex gap-2">
            <button 
              onClick={() => setActiveTab('itinerary')}
              className={`px-8 py-4 rounded-t-3xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'itinerary' ? 'bg-slate-50 text-slate-900' : 'text-white/40 hover:bg-white/10'}`}
            >
              📍 Itinerario
            </button>
            <button 
              onClick={() => setActiveTab('shopping')}
              className={`px-8 py-4 rounded-t-3xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'shopping' ? 'bg-slate-50 text-slate-900' : 'text-white/40 hover:bg-white/10'}`}
            >
              🛍️ Compras
            </button>
          </nav>
        </div>
      </header>

      {/* Área de Trabajo Compartida */}
      <main className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeTab === 'itinerary' ? (
          <div className="max-w-4xl mx-auto px-4">
            {/* Aquí conectaremos el componente de Itinerario con SHARED_TRIP_ID */}
            <p className="text-center text-slate-400 font-bold uppercase tracking-widest py-20 border-2 border-dashed rounded-[3rem]">Módulo de Itinerario Compartido Activo</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-4">
            {/* Aquí conectaremos el componente de Compras con SHARED_TRIP_ID */}
            <p className="text-center text-slate-400 font-bold uppercase tracking-widest py-20 border-2 border-dashed rounded-[3rem]">Módulo de Compras ADN & GAP Activo</p>
          </div>
        )}
      </main>
    </div>
  );
}
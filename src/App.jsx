import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, MapPin, Plus, Trash2, Edit2, Loader2, Plane, 
  Wallet, Calendar, Clock, LogOut, Info, AlertCircle 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';

// CONFIGURACIÓN OFICIAL
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
const SHARED_TRIP_ID = "viaje_ny_2026_adn_gap";

// --- Constantes ---
const CATEGORIAS = ['Ropa', 'Zapatos', 'Accesorios', 'Belleza', 'Tecnología', 'Regalos', 'Vitaminas'];
const NYC_TAX_RATE = 0.08875;
const ISD_RATE = 0.05;
const ISD_EXEMPT_AMOUNT = 5188.26;

// ==========================================
// COMPONENTE: ITINERARIO
// ==========================================
const ItineraryView = () => {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({ date: '', time: '', title: '', location: '' });

  useEffect(() => {
    return onSnapshot(collection(db, 'trips', SHARED_TRIP_ID, 'itinerary'), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)));
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <form className="bg-white p-6 rounded-[2rem] border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={async (e) => {
        e.preventDefault();
        await addDoc(collection(db, 'trips', SHARED_TRIP_ID, 'itinerary'), { ...formData, createdAt: Date.now() });
        setFormData({ date: '', time: '', title: '', location: '' });
      }}>
        <input type="text" placeholder="¿Qué haremos?" className="md:col-span-2 p-3 bg-slate-50 border rounded-xl font-bold outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
        <input type="date" className="p-3 bg-slate-50 border rounded-xl outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
        <input type="time" className="p-3 bg-slate-50 border rounded-xl outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} required />
        <button className="md:col-span-2 bg-emerald-600 text-white py-4 rounded-xl font-black active:scale-95 transition-transform">Añadir al Plan</button>
      </form>
      <div className="space-y-3">
        {items.map(i => (
          <div key={i.id} className="bg-white p-5 rounded-2xl border flex items-center gap-4 group">
            <div className="text-emerald-600 font-black border-r pr-4 min-w-[70px]">{i.time}</div>
            <div className="flex-1 font-bold text-slate-800">{i.title}</div>
            <button onClick={() => deleteDoc(doc(db, 'trips', SHARED_TRIP_ID, 'itinerary', i.id))} className="text-slate-200 hover:text-red-500"><Trash2 size={18}/></button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// COMPONENTE: COMPRAS
// ==========================================
const ShoppingView = () => {
  const [activeShopper, setActiveShopper] = useState('ADN');
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({ name: '', price: '', quantity: 1, category: 'Ropa' });

  useEffect(() => {
    return onSnapshot(collection(db, 'trips', SHARED_TRIP_ID, 'purchases'), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt - a.createdAt));
    });
  }, []);

  const currentItems = items.filter(i => (i.owner || 'ADN') === activeShopper);
  const total = currentItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  
  // Clases estáticas para Tailwind en producción
  const theme = activeShopper === 'ADN' 
    ? { text: 'text-blue-800', border: 'border-blue-600', bg: 'bg-blue-600' } 
    : { text: 'text-pink-700', border: 'border-pink-500', bg: 'bg-pink-500' };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex gap-6 mb-8 border-b">
        {['ADN', 'GAP'].map(s => (
          <button key={s} onClick={() => setActiveShopper(s)} className={`pb-2 font-black border-b-4 transition-all ${activeShopper === s ? `${theme.border} ${theme.text}` : 'border-transparent text-slate-400'}`}>Compras {s}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form className="bg-white p-6 rounded-[2rem] border h-fit space-y-4 shadow-sm" onSubmit={async (e) => {
          e.preventDefault();
          await addDoc(collection(db, 'trips', SHARED_TRIP_ID, 'purchases'), { ...formData, price: parseFloat(formData.price), owner: activeShopper, createdAt: Date.now() });
          setFormData({ name: '', price: '', quantity: 1, category: 'Ropa' });
        }}>
          <input type="text" placeholder="Artículo" className="w-full p-3 bg-slate-50 border rounded-xl outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <input type="number" placeholder="Precio" className="w-full p-3 bg-slate-50 border rounded-xl outline-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
          <button className={`w-full py-4 text-white font-black rounded-xl ${theme.bg}`}>Añadir</button>
        </form>
        <div className="lg:col-span-2 space-y-2">
          <div className="bg-slate-800 text-white p-6 rounded-2xl mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase">Subtotal {activeShopper}</p>
            <p className="text-3xl font-black">${total.toFixed(2)}</p>
          </div>
          {currentItems.map(i => (
            <div key={i.id} className="bg-white p-4 rounded-xl border flex justify-between items-center group">
              <div className="font-bold text-slate-700">{i.name} <span className="text-[10px] text-slate-400 ml-2 uppercase">{i.category}</span></div>
              <div className="flex items-center gap-4">
                <span className="font-black">${(i.price * i.quantity).toFixed(2)}</span>
                <button onClick={() => deleteDoc(doc(db, 'trips', SHARED_TRIP_ID, 'purchases', i.id))} className="text-slate-200 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// APP PRINCIPAL
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('itinerary');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center font-black animate-pulse">Sincronizando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl max-w-sm w-full space-y-8">
          <Plane className="mx-auto text-indigo-600" size={60} />
          <h1 className="text-3xl font-black tracking-tighter uppercase">NY Planner</h1>
          <button onClick={() => signInWithPopup(auth, googleProvider)} className="w-full flex items-center justify-center gap-3 py-4 border-2 rounded-2xl font-black hover:bg-slate-50 transition-all">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Entrar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className={`pt-12 pb-6 text-white shadow-xl transition-colors duration-500 ${activeTab === 'shopping' ? 'bg-blue-900' : 'bg-emerald-900'}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-black tracking-tighter">NY TRIP 🩵💜</h1>
            <div className="flex items-center gap-3">
              <img src={user.photoURL} className="w-8 h-8 rounded-full border-2 border-white/20" alt="avatar" />
              <button onClick={() => signOut(auth)} className="p-2 bg-white/10 rounded-lg"><LogOut size={16}/></button>
            </div>
          </div>
          <nav className="flex gap-2">
            <button onClick={() => setActiveTab('itinerary')} className={`px-6 py-3 rounded-t-2xl font-black text-xs uppercase tracking-widest ${activeTab === 'itinerary' ? 'bg-slate-50 text-slate-900' : 'text-white/40'}`}>📍 Itinerario</button>
            <button onClick={() => setActiveTab('shopping')} className={`px-6 py-3 rounded-t-2xl font-black text-xs uppercase tracking-widest ${activeTab === 'shopping' ? 'bg-slate-50 text-slate-900' : 'text-white/40'}`}>🛍️ Compras</button>
          </nav>
        </div>
      </header>
      <main className="py-8">
        {activeTab === 'itinerary' ? <ItineraryView /> : <ShoppingView />}
      </main>
    </div>
  );
}
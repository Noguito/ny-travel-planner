import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  DollarSign, 
  MapPin, 
  Tag, 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2,
  Package,
  MessageSquare,
  Info,
  AlertCircle,
  Calculator,
  Plane,
  Wallet,
  Calendar,
  Clock,
  AlignLeft,
  LogOut
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';

// --- Configuración Real de Firebase ---
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

// ID compartido para el entorno ADN & GAP
const SHARED_TRIP_ID = "viaje_ny_2026_adn_gap";

const correosPermitidos = [
  "darkangel.adn@gmail.com",
  "gpogocruz@gmail.com" 
];

const correoAutorizado = (email = "") =>
  correosPermitidos.map(c => c.toLowerCase()).includes(email.toLowerCase());

// --- Constantes de Compras NY ---
const CATEGORIAS = ['Ropa', 'Zapatos', 'Accesorios', 'Belleza', 'Tecnología', 'Regalos', 'Vitaminas'];
const NYC_TAX_RATE = 0.08875;
const ISD_RATE = 0.05;
const ISD_EXEMPT_AMOUNT = 5188.26;

const CATEGORY_DESCRIPTIONS = {
  'Ropa': 'Ropa en general y ropa interior. (Libre de tax NY si cuesta < $110)',
  'Zapatos': 'Calzado deportivo, casual o formal. (Libre de tax NY si cuesta < $110)',
  'Accesorios': 'Carteras, billeteras, joyas, relojes, gafas. (Siempre pagan tax NY)',
  'Belleza': 'Maquillaje, skincare, planchas/secadoras de cabello. (Siempre pagan tax NY)',
  'Tecnología': 'Teléfonos, laptops, audífonos, gadgets. (Siempre pagan tax NY)',
  'Regalos': 'Recuerditos, souvenirs, juguetes. (Siempre pagan tax NY)',
  'Vitaminas': 'Suplementos y medicinas. (Generalmente libres de tax NY)'
};

// ==========================================
// VISTA 1: DASHBOARD DE COMPRAS NY
// ==========================================
const ShoppingView = ({ user }) => {
  const [activeShopper, setActiveShopper] = useState('ADN');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previousSpending, setPreviousSpending] = useState({ ADN: 0, GAP: 0 });
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '', price: '', store: '', quantity: 1, category: 'Ropa', comments: ''
  });

  // Limpiar formulario al cambiar de subpestaña
  useEffect(() => {
    setEditingId(null);
    setFormData({ name: '', price: '', store: '', quantity: 1, category: 'Ropa', comments: '' });
  }, [activeShopper]);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'trips', SHARED_TRIP_ID, 'ny_purchases');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener los datos de compras:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Filtrar los ítems según quién está seleccionado
  const currentItems = useMemo(() => {
    return items.filter(item => (item.owner || 'ADN') === activeShopper);
  }, [items, activeShopper]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !formData.name || !formData.price) return;
    setIsSubmitting(true);
    try {
      const itemData = {
        name: formData.name,
        price: parseFloat(formData.price) || 0,
        store: formData.store || 'No especificada',
        quantity: parseInt(formData.quantity) || 1,
        category: formData.category,
        comments: formData.comments,
        owner: activeShopper,
        updatedAt: Date.now()
      };
      const colRef = collection(db, 'trips', SHARED_TRIP_ID, 'ny_purchases');
      if (editingId) {
        await updateDoc(doc(colRef, editingId), itemData);
      } else {
        await addDoc(colRef, { ...itemData, createdAt: Date.now() });
      }
      setFormData({ name: '', price: '', store: '', quantity: 1, category: 'Ropa', comments: '' });
      setEditingId(null);
    } catch (error) {
      console.error("Error guardando el artículo:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name, price: item.price.toString(), store: item.store,
      quantity: item.quantity, category: item.category, comments: item.comments || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'trips', SHARED_TRIP_ID, 'ny_purchases', id));
    } catch (error) {
      console.error("Error eliminando el artículo:", error);
    }
  };

  const stats = useMemo(() => {
    let totalCost = 0, totalNYCTax = 0, totalItems = 0;
    const uniqueStores = new Set();

    currentItems.forEach(item => {
      const itemBaseTotal = item.price * item.quantity;
      totalCost += itemBaseTotal;
      totalItems += item.quantity;
      if (item.store && item.store !== 'No especificada') uniqueStores.add(item.store.toLowerCase());

      let itemTax = 0;
      if (item.category === 'Ropa' || item.category === 'Zapatos') {
        if (item.price >= 110) itemTax = itemBaseTotal * NYC_TAX_RATE;
      } else if (item.category !== 'Vitaminas') {
        itemTax = itemBaseTotal * NYC_TAX_RATE;
      }
      totalNYCTax += itemTax;
    });

    const subtotalUSA = totalCost + totalNYCTax;
    const currentPrevSpending = previousSpending[activeShopper] || 0;
    const totalAccumulated = currentPrevSpending + subtotalUSA;
    let isdTax = 0;
    if (totalAccumulated > ISD_EXEMPT_AMOUNT) {
      const taxableAmount = Math.min(subtotalUSA, totalAccumulated - ISD_EXEMPT_AMOUNT);
      isdTax = taxableAmount > 0 ? taxableAmount * ISD_RATE : 0;
    }

    return { totalCost, totalNYCTax, subtotalUSA, isdTax, granTotal: subtotalUSA + isdTax, totalItems, storesCount: uniqueStores.size };
  }, [currentItems, previousSpending, activeShopper]);

  const theme = activeShopper === 'ADN' ? {
    tabActive: 'border-blue-600 text-blue-800',
    btnBg: 'bg-blue-600 hover:bg-blue-700',
    iconText: 'text-blue-600',
    cardBg: 'bg-blue-50 border-blue-300',
    cardTitle: 'text-blue-800',
    cardValue: 'text-blue-900',
    ring: 'focus:ring-blue-500',
    badge: 'bg-blue-100 text-blue-800'
  } : {
    tabActive: 'border-pink-500 text-pink-700',
    btnBg: 'bg-pink-500 hover:bg-pink-600',
    iconText: 'text-pink-500',
    cardBg: 'bg-pink-50 border-pink-300',
    cardTitle: 'text-pink-800',
    cardValue: 'text-pink-900',
    ring: 'focus:ring-pink-500',
    badge: 'bg-pink-100 text-pink-800'
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex space-x-6 mb-8 border-b border-slate-200">
        <button onClick={() => setActiveShopper('ADN')} className={`pb-3 px-2 font-black text-lg border-b-4 transition-colors ${activeShopper === 'ADN' ? theme.tabActive : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Compras ADN
        </button>
        <button onClick={() => setActiveShopper('GAP')} className={`pb-3 px-2 font-black text-lg border-b-4 transition-colors ${activeShopper === 'GAP' ? theme.tabActive : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Compras GAP
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-2">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-lg"><DollarSign className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Subtotal (Sin Tax)</p>
              <p className="text-xl font-bold text-slate-800">${stats.totalCost.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-2">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg"><Calculator className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Impuestos NY</p>
              <p className="text-xl font-bold text-slate-800">${stats.totalNYCTax.toFixed(2)}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Ropa/Zapatos &lt;$110 y Vitaminas exentos.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 flex flex-col justify-between">
          <div className="flex items-center space-x-4 mb-2">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-lg"><AlertCircle className="w-6 h-6" /></div>
            <div>
              <p className="text-sm text-slate-500 font-medium">ISD Ecuador</p>
              <p className="text-xl font-bold text-slate-800">${stats.isdTax.toFixed(2)}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Exento hasta $5,188.26 anuales.</p>
        </div>
        
        <div className={`rounded-xl shadow-sm p-6 border ${theme.cardBg} flex flex-col justify-between transition-colors`}>
          <div className="flex items-center space-x-4 mb-2">
            <div className={`p-3 text-white rounded-lg ${theme.btnBg.split(' ')[0]}`}><DollarSign className="w-6 h-6" /></div>
            <div>
              <p className={`text-sm font-bold ${theme.cardTitle}`}>Total Estimado ({activeShopper})</p>
              <p className={`text-2xl font-black ${theme.cardValue}`}>${stats.granTotal.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200 mb-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex-1">
          <label className="block text-sm font-bold text-slate-700 mb-1">Consumos previos de {activeShopper} (USD)</label>
          <div className="relative max-w-xs mt-2">
            <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="number" 
              value={previousSpending[activeShopper] || ''} 
              onChange={(e) => setPreviousSpending(prev => ({ ...prev, [activeShopper]: parseFloat(e.target.value) || 0 }))}
              placeholder="Ej. 1500" min="0" 
              className={`w-full pl-9 p-2 border border-slate-300 rounded-lg focus:ring-2 ${theme.ring} outline-none transition-all`}
            />
          </div>
        </div>
        <div className="flex-1 bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start space-x-3">
          <Info className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 leading-relaxed">
            <strong>Produbanco:</strong> Tarifario oficial contempla cargos adicionales en el exterior para compras <strong>mayores a $100</strong>.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <h2 className="text-lg font-bold mb-4 flex items-center text-slate-800">
              {editingId ? <Edit2 className={`w-5 h-5 mr-2 ${theme.iconText}`} /> : <Plus className={`w-5 h-5 mr-2 ${theme.iconText}`} />}
              {editingId ? 'Editar Artículo' : `Añadir para ${activeShopper}`}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">¿Qué vas a comprar? *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ej. Zapatillas Nike" className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${theme.ring} outline-none`} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Unit. ($) *</label>
                  <input type="number" name="price" value={formData.price} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${theme.ring} outline-none`} required />
                  {formData.price && formData.category && (
                    <p className="text-[10px] mt-1 font-medium">
                      {((formData.category === 'Ropa' || formData.category === 'Zapatos') && parseFloat(formData.price) < 110) || formData.category === 'Vitaminas' 
                        ? <span className="text-emerald-600">✓ Libre de Tax</span> : <span className="text-orange-600">+8.875% Tax</span>}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} min="1" className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${theme.ring} outline-none`} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tienda (Opcional)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input type="text" name="store" value={formData.store} onChange={handleInputChange} placeholder="Ej. Macy's" className={`w-full p-2.5 pl-9 border border-slate-300 rounded-lg focus:ring-2 ${theme.ring} outline-none`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  Categoría
                  <div className="group relative flex items-center cursor-help">
                    <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 text-center">
                      Clasifica bien tus compras para calcular los impuestos de NY con exactitud.
                    </div>
                  </div>
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <select name="category" value={formData.category} onChange={handleInputChange} className={`w-full p-2.5 pl-9 border border-slate-300 rounded-lg focus:ring-2 ${theme.ring} outline-none appearance-none bg-white`}>
                    {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 font-medium flex items-start gap-1">
                  <span className="text-slate-400 mt-0.5">↳</span> {CATEGORY_DESCRIPTIONS[formData.category]}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comentarios</label>
                <textarea name="comments" value={formData.comments} onChange={handleInputChange} placeholder="Tallas, colores..." rows="2" className={`w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 ${theme.ring} outline-none resize-none`}></textarea>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="submit" disabled={isSubmitting} className={`flex-1 text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center transition-colors ${theme.btnBg}`}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? 'Guardar' : 'Añadir')}
                </button>
                {editingId && (
                  <button type="button" onClick={() => {setEditingId(null); setFormData({name: '', price: '', store: '', quantity: 1, category: 'Ropa', comments: ''});}} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Lista de {activeShopper}</h2>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${theme.badge}`}>{currentItems.length} ítems</span>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : currentItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p>La lista de {activeShopper} está vacía</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {currentItems.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-slate-50 flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <h3 className="font-bold text-slate-900">{item.name}</h3>
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200">{item.category}</span>
                      </div>
                      <div className="flex space-x-6 text-sm text-slate-600 mt-2">
                        <span className="font-medium text-emerald-700">${item.price.toFixed(2)} c/u {item.quantity > 1 && `(x${item.quantity})`}</span>
                        <span>{item.store}</span>
                      </div>
                      {item.comments && <p className="mt-2 text-sm text-slate-500 italic bg-slate-100 p-2 rounded">{item.comments}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-semibold uppercase">Subtotal + Tax</p>
                      <p className="text-lg font-bold text-slate-800">
                        ${(() => {
                          const base = item.price * item.quantity;
                          let tax = 0;
                          if (item.category === 'Ropa' || item.category === 'Zapatos') { if (item.price >= 110) tax = base * NYC_TAX_RATE; } 
                          else if (item.category !== 'Vitaminas') { tax = base * NYC_TAX_RATE; }
                          return (base + tax).toFixed(2);
                        })()}
                      </p>
                      <div className="flex justify-end space-x-2 mt-2">
                        <button onClick={() => handleEdit(item)} className={`p-1.5 rounded transition-colors ${activeShopper === 'ADN' ? 'text-slate-400 hover:text-blue-600' : 'text-slate-400 hover:text-pink-500'}`}><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// VISTA 2: PRESUPUESTO ADN & GAP
// ==========================================
const BudgetView = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('saved');
  const [savings, setSavings] = useState({ adn: 5265, gap: 1850 });
  const [expenses, setExpenses] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', amount: '' });
  const [shoppingItems, setShoppingItems] = useState([]);
  const isEditing = useRef(false);

  useEffect(() => {
    if (!user) return;
    const docPath = doc(db, 'trips', SHARED_TRIP_ID, 'travel_budget', 'main');
    
    const unsubscribe = onSnapshot(docPath, (docSnap) => {
        if (docSnap.exists() && !isEditing.current) {
            const data = docSnap.data();
            if (data.savings) setSavings(data.savings);
            if (data.expenses) setExpenses(data.expenses);
        }
        setLoading(false);
    }, (err) => {
        console.error("Error de Sincronización:", err);
        setSyncStatus('error');
        setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'trips', SHARED_TRIP_ID, 'ny_purchases');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const fetched = snapshot.docs.map(doc => doc.data());
        setShoppingItems(fetched);
    });
    return () => unsubscribe();
  }, [user]);

  const pushToCloud = async (currentSavings, currentExpenses) => {
    if (!user) return;
    setSyncStatus('saving');
    try {
        const docPath = doc(db, 'trips', SHARED_TRIP_ID, 'travel_budget', 'main');
        await setDoc(docPath, {
            savings: currentSavings,
            expenses: currentExpenses,
            lastUpdated: Date.now()
        }, { merge: true });
        setSyncStatus('saved');
    } catch (e) {
        setSyncStatus('error');
    }
  };

  const calculations = useMemo(() => {
      const sAdn = Number(savings.adn) || 0;
      const sGap = Number(savings.gap) || 0;
      const totalSavings = sAdn + sGap;
      const totalExpenses = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      
      const pctADN = totalSavings > 0 ? (sAdn / totalSavings) : 0;
      const pctGAP = totalSavings > 0 ? (sGap / totalSavings) : 0;
      
      const shareADN = totalExpenses * pctADN;
      const shareGAP = totalExpenses * pctGAP;
      
      const personalADN = Math.max(0, sAdn - shareADN);
      const personalGAP = Math.max(0, sGap - shareGAP);

      return {
          totalSavings, totalExpenses,
          pctADN: (pctADN * 100).toFixed(1),
          pctGAP: (pctGAP * 100).toFixed(1),
          shareADN, shareGAP,
          personalADN, personalGAP,
          leftoverPctADN: sAdn > 0 ? (personalADN / sAdn) * 100 : 0,
          leftoverPctGAP: sGap > 0 ? (personalGAP / sGap) * 100 : 0
      };
  }, [savings, expenses]);

  const shoppingTotals = useMemo(() => {
      let adn = 0;
      let gap = 0;
      shoppingItems.forEach(item => {
          const owner = item.owner || 'ADN';
          const base = (item.price || 0) * (item.quantity || 1);
          let tax = 0;
          if (item.category === 'Ropa' || item.category === 'Zapatos') {
              if (item.price >= 110) tax = base * NYC_TAX_RATE;
          } else if (item.category !== 'Vitaminas') {
              tax = base * NYC_TAX_RATE;
          }
          if (owner === 'ADN') adn += (base + tax);
          if (owner === 'GAP') gap += (base + tax);
      });
      return { adn, gap };
  }, [shoppingItems]);

  const handleLocalSavings = (person, val) => {
      isEditing.current = true;
      setSavings(prev => ({ ...prev, [person]: val }));
  };

  const commitSavings = () => {
      isEditing.current = false;
      pushToCloud(savings, expenses);
  };

  const handleAddExpense = () => {
      if (newItem.name && newItem.amount) {
          const updatedExpenses = [...expenses, {
              id: Date.now().toString(),
              name: newItem.name,
              amount: parseFloat(newItem.amount) || 0
          }];
          setExpenses(updatedExpenses);
          setNewItem({ name: '', amount: '' });
          pushToCloud(savings, updatedExpenses);
      }
  };

  const handleDeleteExpense = (id) => {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      pushToCloud(savings, updated);
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl">
                    <Plane size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Presupuesto USA</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2 h-2 rounded-full ${syncStatus === 'saved' ? 'bg-emerald-500' : syncStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`}></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {syncStatus === 'saved' ? 'Sincronizado' : syncStatus === 'saving' ? 'Guardando...' : 'Sin conexión'}
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex gap-4">
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 min-w-[140px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ahorro Total</p>
                    <p className="text-2xl font-black text-emerald-600">${calculations.totalSavings.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 min-w-[140px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Gastos</p>
                    <p className="text-2xl font-black text-rose-500">${calculations.totalExpenses.toLocaleString()}</p>
                </div>
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
                <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 text-slate-800">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2 px-2">
                        <Wallet className="text-indigo-500" size={22} /> Aportes Actuales
                    </h2>
                    <div className="space-y-4">
                        {['adn', 'gap'].map(p => (
                            <div key={p} className={`p-5 rounded-3xl border-2 ${p === 'adn' ? 'bg-blue-50/30 border-blue-100 focus-within:border-blue-300' : 'bg-pink-50/30 border-pink-100 focus-within:border-pink-300'}`}>
                                <div className="flex justify-between mb-1">
                                    <span className={`text-[10px] font-black uppercase ${p === 'adn' ? 'text-blue-600' : 'text-pink-600'}`}>{p}</span>
                                    <span className="text-[10px] font-bold text-slate-400">{p === 'adn' ? calculations.pctADN : calculations.pctGAP}% del fondo</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-2xl font-black text-slate-300">$</span>
                                    <input 
                                        type="number" value={savings[p]} onChange={(e) => handleLocalSavings(p, e.target.value)} onBlur={commitSavings}
                                        className="w-full bg-transparent border-none outline-none text-2xl font-black text-slate-800"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="space-y-4">
                    <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Libre para ADN</p>
                        <p className="text-4xl font-black text-slate-800 tracking-tighter">${calculations.personalADN.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div style={{ width: `${calculations.leftoverPctADN}%` }} className="h-full bg-blue-500 transition-all duration-700"></div>
                        </div>
                    </div>
                    <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-2">Libre para GAP</p>
                        <p className="text-4xl font-black text-slate-800 tracking-tighter">${calculations.personalGAP.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div style={{ width: `${calculations.leftoverPctGAP}%` }} className="h-full bg-pink-500 transition-all duration-700"></div>
                        </div>
                    </div>
                </div>

                <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 text-slate-800 mt-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 px-2">
                        <ShoppingBag className="text-indigo-500" size={22} /> Proyección de Compras
                    </h2>
                    <p className="text-xs text-slate-400 px-2 mb-4 leading-relaxed">Suma de las listas individuales. Te ayuda a saber si el "Fondo Libre" es suficiente.</p>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-4 bg-blue-50/50 rounded-3xl border border-blue-100">
                            <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Gasto ADN</span>
                            <span className="font-black text-blue-900 text-xl">${shoppingTotals.adn.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-pink-50/50 rounded-3xl border border-pink-100">
                            <span className="text-xs font-black text-pink-600 uppercase tracking-widest">Gasto GAP</span>
                            <span className="font-black text-pink-900 text-xl">${shoppingTotals.gap.toFixed(2)}</span>
                        </div>
                    </div>
                </section>
            </div>

            <div className="lg:col-span-8 space-y-6">
                <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-10">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <ShoppingBag className="text-indigo-600" size={28} /> Conceptos de Gasto
                            </h2>
                            <p className="text-sm text-slate-400 font-medium">Gastos compartidos para el viaje</p>
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-3">
                        {expenses.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                                <p className="text-slate-300 font-bold uppercase text-xs tracking-widest">No hay gastos registrados</p>
                            </div>
                        ) : expenses.map((exp) => (
                            <div key={exp.id} className="flex items-center justify-between p-6 rounded-[2rem] border border-slate-50 hover:bg-slate-50/80 transition-all group">
                                <div className="flex items-center gap-5">
                                    <div className="bg-white p-3.5 rounded-2xl shadow-sm text-indigo-500 group-hover:scale-110 transition-transform">
                                        <Tag size={20} />
                                    </div>
                                    <div>
                                        <p className="font-extrabold text-slate-700">{exp.name}</p>
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pago Proporcional</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <span className="text-xl font-black text-slate-800">${exp.amount.toLocaleString()}</span>
                                    <button onClick={() => handleDeleteExpense(exp.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 grid grid-cols-1 md:grid-cols-12 gap-4 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        <div className="md:col-span-7">
                            <input 
                                type="text" placeholder="¿En qué gastarán? (Ej: Hotel)" value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                                className="w-full bg-white border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 outline-none font-bold text-sm shadow-sm"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <input 
                                type="number" placeholder="Monto" value={newItem.amount} onChange={(e) => setNewItem({...newItem, amount: e.target.value})}
                                className="w-full bg-white border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 outline-none font-black text-center text-sm shadow-sm"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <button onClick={handleAddExpense} className="w-full h-full bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center p-4">
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Pago ADN ({calculations.pctADN}%)</p>
                        <h3 className="text-5xl font-black tracking-tighter">${calculations.shareADN.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Pago GAP ({calculations.pctGAP}%)</p>
                        <h3 className="text-5xl font-black text-slate-800 tracking-tighter">${calculations.shareGAP.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

// ==========================================
// VISTA 3: ITINERARIO DE VIAJE
// ==========================================
const ItineraryView = ({ user }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    date: '', time: '', title: '', location: '', notes: ''
  });

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'trips', SHARED_TRIP_ID, 'travel_itinerary');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener el itinerario:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const { groups, sortedDates } = useMemo(() => {
    const grouped = {};
    items.forEach(item => {
      const d = item.date || 'Sin fecha';
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(item);
    });
    const dates = Object.keys(grouped).sort();
    dates.forEach(date => {
      grouped[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    });
    return { groups: grouped, sortedDates: dates };
  }, [items]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !formData.title) return;
    setIsSubmitting(true);
    try {
      const colRef = collection(db, 'trips', SHARED_TRIP_ID, 'travel_itinerary');
      const dataToSave = { ...formData, updatedAt: Date.now() };
      
      if (editingId) {
        await updateDoc(doc(colRef, editingId), dataToSave);
      } else {
        await addDoc(colRef, { ...dataToSave, createdAt: Date.now() });
      }
      setFormData({ date: '', time: '', title: '', location: '', notes: '' });
      setEditingId(null);
    } catch (error) {
      console.error("Error guardando actividad:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      date: item.date || '', time: item.time || '', title: item.title,
      location: item.location || '', notes: item.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'trips', SHARED_TRIP_ID, 'travel_itinerary', id));
    } catch (error) {
      console.error("Error eliminando:", error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'Sin fecha') return 'Día por definir';
    try {
        const date = new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString('es-ES', { weekday: 'long', month: 'long', day: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase());
    } catch (e) {
        return dateStr;
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-7 sticky top-6">
                <h2 className="text-lg font-bold mb-6 flex items-center text-slate-800">
                    {editingId ? <Edit2 className="w-5 h-5 mr-2 text-emerald-500" /> : <Plus className="w-5 h-5 mr-2 text-emerald-500" />}
                    {editingId ? 'Editar Actividad' : 'Nueva Actividad'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Fecha</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Hora</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <input type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full p-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Actividad *</label>
                        <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="Ej. Museo de Historia Natural" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ubicación</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                            <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ej. Central Park West" className="w-full p-3 pl-9 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Notas</label>
                        <div className="relative">
                            <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                            <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Tickets comprados, llevar abrigo..." rows="3" className="w-full p-3 pl-9 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm"></textarea>
                        </div>
                    </div>
                    <div className="flex space-x-3 pt-2">
                        <button type="submit" disabled={isSubmitting} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center transition-all shadow-md shadow-emerald-200 active:scale-95">
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? 'Guardar Cambios' : 'Añadir al Plan')}
                        </button>
                        {editingId && (
                            <button type="button" onClick={() => {setEditingId(null); setFormData({date: '', time: '', title: '', location: '', notes: ''});}} className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors">
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>

        <div className="lg:col-span-8">
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-8 min-h-[500px]">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <Calendar className="text-emerald-500" size={28} /> Itinerario de Viaje
                        </h2>
                        <p className="text-sm text-slate-400 font-medium">Planifica tus días en la ciudad</p>
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 font-bold px-4 py-2 rounded-2xl text-sm border border-emerald-100">
                        {items.length} Actividades
                    </span>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-emerald-400" /></div>
                ) : items.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                        <Plane className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold text-lg">Aún no hay planes</p>
                        <p className="text-slate-400 text-sm">Empieza añadiendo tu vuelo de llegada o tu primera visita.</p>
                    </div>
                ) : (
                    <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                        {sortedDates.map(date => (
                            <div key={date} className="relative z-10">
                                <div className="flex items-center justify-start md:justify-center mb-6">
                                    <div className="bg-emerald-500 text-white font-black text-sm px-6 py-2 rounded-full shadow-md">
                                        {formatDate(date)}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {groups[date].map((item) => (
                                        <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                            <div className="absolute left-5 md:left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-emerald-200 text-emerald-600 shadow-sm transition-transform group-hover:scale-125 group-hover:bg-emerald-400 group-hover:text-white">
                                                <Clock size={12} className="font-bold" />
                                            </div>
                                            
                                            <div className="w-full pl-14 md:w-5/12 md:pl-0 md:odd:pr-10 md:even:pl-10">
                                                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group-hover:-translate-y-1 relative">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-emerald-600 font-black text-sm bg-emerald-50 px-3 py-1 rounded-lg">
                                                            {item.time || 'Todo el día'}
                                                        </span>
                                                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleEdit(item)} className="p-1.5 text-slate-400 hover:text-emerald-500 bg-slate-50 rounded-lg"><Edit2 size={14} /></button>
                                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500 bg-slate-50 rounded-lg"><Trash2 size={14} /></button>
                                                        </div>
                                                    </div>
                                                    <h3 className="font-black text-slate-800 text-lg mb-1">{item.title}</h3>
                                                    {item.location && (
                                                        <p className="text-slate-500 text-sm flex items-center gap-1.5 mb-2 font-medium">
                                                            <MapPin size={14} className="text-slate-400" /> {item.location}
                                                        </p>
                                                    )}
                                                    {item.notes && (
                                                        <p className="text-slate-500 text-sm bg-slate-50 p-3 rounded-2xl italic leading-relaxed">
                                                            {item.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

// ==========================================
// APLICACIÓN PRINCIPAL (Layout & Auth)
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('itinerary');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const email = u.email || '';

        if (!correoAutorizado(email)) {
          setAuthError(`El correo ${email} no está autorizado para usar esta app.`);
          await signOut(auth);
          setUser(null);
        } else {
          setAuthError('');
          setUser(u);
        }
      } else {
        setUser(null);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setAuthError('');
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email || '';

      if (!correoAutorizado(email)) {
        setAuthError(`El correo ${email} no está autorizado para usar esta app.`);
        await signOut(auth);
        return;
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setAuthError("No se pudo iniciar sesión.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-sm w-full space-y-8">
          <Plane className="text-indigo-600 mx-auto" size={60} />
          <h1 className="font-black uppercase tracking-tighter leading-tight"><span className="block text-3xl">NY Planner</span><span className="block text-2xl mt-1">ADN & GAP 🩵💜</span></h1>

          <button
            onClick={loginWithGoogle}
            className="w-full py-4 border-2 border-slate-200 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              className="w-6 h-6"
              alt="Google"
            />
            Ingresar con Google
          </button>

          {authError && (
            <p className="text-sm text-red-500 font-medium">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  const getHeaderColor = () => {
    if (activeTab === 'shopping') return 'bg-blue-900';
    if (activeTab === 'budget') return 'bg-indigo-900';
    return 'bg-emerald-900';
  };

  const getIconColor = () => {
    if (activeTab === 'shopping') return 'text-blue-300';
    if (activeTab === 'budget') return 'text-indigo-300';
    return 'text-emerald-300';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-12">
      <header className={`${getHeaderColor()} text-white pt-6 pb-2 transition-colors duration-500 shadow-md mb-8`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Plane className={`w-8 h-8 ${getIconColor()}`} />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">NY Travel Planner ADN & GAP 🩵💜</h1>
              </div>
            </div>
            <button onClick={() => signOut(auth)} className="p-2 hover:bg-white/10 rounded-lg flex items-center gap-2">
              <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />
              <LogOut size={18} />
            </button>
          </div>

          <div className="flex space-x-1 overflow-x-auto pb-2 custom-scrollbar">
            <button
              onClick={() => setActiveTab('itinerary')}
              className={`px-5 py-2.5 rounded-t-xl font-medium text-sm flex items-center transition-colors whitespace-nowrap ${activeTab === 'itinerary' ? 'bg-slate-100 text-emerald-900' : 'text-emerald-100 hover:bg-white/10'}`}
            >
              <Calendar className="w-4 h-4 mr-2" /> Itinerario
            </button>

            <button
              onClick={() => setActiveTab('budget')}
              className={`px-5 py-2.5 rounded-t-xl font-medium text-sm flex items-center transition-colors whitespace-nowrap ${activeTab === 'budget' ? 'bg-slate-100 text-indigo-900' : 'text-indigo-100 hover:bg-white/10'}`}
            >
              <Wallet className="w-4 h-4 mr-2" /> Presupuesto Compartido (ADN & GAP)
            </button>

            <button
              onClick={() => setActiveTab('shopping')}
              className={`px-5 py-2.5 rounded-t-xl font-medium text-sm flex items-center transition-colors whitespace-nowrap ${activeTab === 'shopping' ? 'bg-slate-100 text-blue-900' : 'text-blue-100 hover:bg-white/10'}`}
            >
              <ShoppingBag className="w-4 h-4 mr-2" /> Mis Compras (Individual)
            </button>
          </div>
        </div>
      </header>

      <main className="px-4">
        {activeTab === 'itinerary' && <ItineraryView user={user} />}
        {activeTab === 'shopping' && <ShoppingView user={user} />}
        {activeTab === 'budget' && <BudgetView user={user} />}
      </main>
    </div>
  );
}
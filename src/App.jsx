import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, onAuthStateChanged, signOut
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, getDocs, onSnapshot, 
  updateDoc, query, where, addDoc, deleteDoc, writeBatch
} from 'firebase/firestore';
import { 
  Clock, CheckCircle, Image as ImageIcon, LogOut, 
  Settings, Users, Download, ChevronRight, Menu, X, Plus, Trash2, Trophy
} from 'lucide-react';

// ==========================================
// 1. PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE
// ==========================================
// Ve a console.firebase.google.com -> Tu Proyecto -> Configuración (rueda dentada) -> Tus aplicaciones -> Copia el objeto firebaseConfig
const firebaseConfig = {
  apiKey: "AIzaSyBlyfL-5AerMX_QOV_6iXmRjJsFat7Y3os",
  authDomain: "watch-win-58136.firebaseapp.com",
  projectId: "watch-win-58136",
  storageBucket: "watch-win-58136.firebasestorage.app",
  messagingSenderId: "25924056675",
  appId: "1:25924056675:web:2a94cd69ab53f3be702a56",
  measurementId: "G-RSC4XCDSH5"

// Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Rutas de la base de datos
const RAFFLES_PATH = "raffles";
const TICKETS_PATH = "tickets";

// --- COMPONENTES UI REUTILIZABLES ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = "button" }) => {
  const baseStyle = "px-4 py-2 rounded-md font-semibold transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-amber-500 text-gray-900 hover:bg-amber-400 disabled:bg-gray-600 disabled:text-gray-400",
    secondary: "bg-gray-800 text-white hover:bg-gray-700 border border-gray-700 disabled:opacity-50",
    danger: "bg-red-600 text-white hover:bg-red-500 disabled:opacity-50",
    success: "bg-green-600 text-white hover:bg-green-500 disabled:opacity-50"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, type = "text", value, onChange, placeholder, required = false, accept }) => (
  <div className="flex flex-col gap-1 mb-4 w-full">
    {label && <label className="text-sm font-medium text-gray-400">{label}</label>}
    <input 
      type={type} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      required={required}
      accept={accept}
      className="bg-gray-900 border border-gray-700 rounded-md p-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
    />
  </div>
);

// --- UTILIDADES ---
const simulateEmail = (to, subject) => {
  console.log(`[SIMULACIÓN DE CORREO] Enviado a: ${to} | Asunto: ${subject}`);
};

const exportToCSV = (tickets, raffleTitle) => {
  const headers = ['Boleto', 'Estado', 'Nombre', 'Email', 'Teléfono', 'Fecha Reserva'];
  const rows = tickets.map(t => [
    t.ticketNumber,
    t.status,
    t.user?.name || '-',
    t.user?.email || '-',
    t.user?.phone || '-',
    t.reservationDate ? new Date(t.reservationDate).toLocaleString() : '-'
  ]);
  
  const csvContent = "data:text/csv;charset=utf-8," 
    + headers.join(",") + "\n" 
    + rows.map(e => e.join(",")).join("\n");
    
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Participantes_${raffleTitle.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// --- APLICACIÓN PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('home'); 
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Error auth:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser && currentUser.email ? true : false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-amber-500/30">
      {/* Toast Notification */}
      {toast.visible && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-medium transition-all animate-fade-in ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-amber-500 text-gray-900'
        }`}>
          {toast.type === 'error' ? <X size={18} /> : <CheckCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-[#111] border-b border-gray-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center cursor-pointer" onClick={() => setView('home')}>
              <Trophy className="text-amber-500 mr-3" size={32} />
              <span className="text-2xl font-black tracking-tighter text-white uppercase">
                LuxTime <span className="text-amber-500 font-light">Rifas</span>
              </span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => setView('home')} className={`text-sm font-semibold uppercase tracking-wider transition-colors ${view === 'home' ? 'text-amber-500' : 'text-gray-400 hover:text-white'}`}>Rifa Actual</button>
              <button onClick={() => setView('history')} className={`text-sm font-semibold uppercase tracking-wider transition-colors ${view === 'history' ? 'text-amber-500' : 'text-gray-400 hover:text-white'}`}>Historial</button>
              {isAdmin ? (
                <>
                  <button onClick={() => setView('admin')} className={`text-sm font-semibold uppercase tracking-wider transition-colors ${view === 'admin' ? 'text-amber-500' : 'text-gray-400 hover:text-white'}`}>Panel Admin</button>
                  <Button variant="secondary" onClick={() => signOut(auth)} className="text-xs py-1.5 px-3">
                    <LogOut size={16} className="mr-1"/> Salir
                  </Button>
                </>
              ) : (
                <button onClick={() => setView('admin')} className="text-xs text-gray-600 hover:text-gray-400">Admin Login</button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-400 hover:text-white focus:outline-none">
                {menuOpen ? <X size={28} /> : <Menu size={28} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-[#111] border-b border-gray-800 absolute w-full left-0 px-4 pt-2 pb-6 flex flex-col gap-4 shadow-2xl">
            <button onClick={() => {setView('home'); setMenuOpen(false);}} className="text-left font-semibold text-gray-300 py-2">Rifa Actual</button>
            <button onClick={() => {setView('history'); setMenuOpen(false);}} className="text-left font-semibold text-gray-300 py-2">Historial</button>
            {isAdmin ? (
              <>
                <button onClick={() => {setView('admin'); setMenuOpen(false);}} className="text-left font-semibold text-amber-500 py-2">Panel Admin</button>
                <button onClick={() => {signOut(auth); setMenuOpen(false);}} className="text-left font-semibold text-red-500 py-2">Cerrar Sesión</button>
              </>
            ) : (
              <button onClick={() => {setView('admin'); setMenuOpen(false);}} className="text-left text-sm text-gray-600 py-2">Admin Login</button>
            )}
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {view === 'home' && <HomeView db={db} RAFFLES_PATH={RAFFLES_PATH} TICKETS_PATH={TICKETS_PATH} showToast={showToast} user={user} />}
        {view === 'admin' && !isAdmin && <AdminLoginView showToast={showToast} auth={auth} />}
        {view === 'admin' && isAdmin && <AdminDashboardView db={db} RAFFLES_PATH={RAFFLES_PATH} TICKETS_PATH={TICKETS_PATH} showToast={showToast} />}
        {view === 'history' && <HistoryView db={db} RAFFLES_PATH={RAFFLES_PATH} />}
      </main>
    </div>
  );
}

// ==========================================
// VISTAS PRINCIPALES
// ==========================================

function HomeView({ db, RAFFLES_PATH, TICKETS_PATH, showToast, user }) {
  const [activeRaffle, setActiveRaffle] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    if (!user) return;

    const qRaffle = query(collection(db, RAFFLES_PATH), where("status", "==", "active"));
    const unsubRaffle = onSnapshot(qRaffle, (snap) => {
      if (!snap.empty) {
        const raffleData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setActiveRaffle(raffleData);
        
        const qTickets = query(collection(db, TICKETS_PATH), where("raffleId", "==", raffleData.id));
        const unsubTickets = onSnapshot(qTickets, (tSnap) => {
          const tData = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setTickets(tData);
          setLoading(false);
          
          setSelectedTickets(prev => prev.filter(num => {
            const ticketInDB = tData.find(t => t.ticketNumber === num);
            return !ticketInDB || ticketInDB.status === 'available';
          }));
        }, (err) => {
          console.error("Error tickets:", err);
          showToast("Error al cargar boletos. Revisa tu Firebase Config.", "error");
        });
        
        return () => unsubTickets();
      } else {
        setActiveRaffle(null);
        setLoading(false);
      }
    }, (err) => {
       console.error("Error raffle:", err);
       setLoading(false);
    });

    return () => unsubRaffle();
  }, [db, user, RAFFLES_PATH, TICKETS_PATH]); // Added dependencies

  const toggleTicket = (number) => {
    const ticketInDB = tickets.find(t => t.ticketNumber === number);
    if (ticketInDB && ticketInDB.status !== 'available') {
      showToast("Este boleto ya no está disponible", "error");
      return;
    }

    if (selectedTickets.includes(number)) {
      setSelectedTickets(selectedTickets.filter(n => n !== number));
    } else {
      setSelectedTickets([...selectedTickets, number]);
    }
  };

  const getTicketStatus = (number) => {
    const t = tickets.find(t => t.ticketNumber === number);
    if (!t) return 'available';
    return t.status;
  };

  if (loading) return <div className="text-center py-20 text-gray-500 animate-pulse">Cargando plataforma o conectando a base de datos...</div>;

  if (!activeRaffle) {
    return (
      <div className="text-center py-32">
        <Trophy size={64} className="mx-auto text-gray-800 mb-6" />
        <h2 className="text-3xl font-bold text-gray-400">No hay rifas activas en este momento.</h2>
        <p className="text-gray-600 mt-4">Mantente atento a nuestras próximas dinámicas.</p>
      </div>
    );
  }

  const availableCount = 100 - tickets.filter(t => t.status !== 'available').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative">
      {/* Información de la Rifa */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 bg-amber-500 text-gray-900 text-xs font-black px-3 py-1 rounded-full z-10">
            ACTIVA
          </div>
          {activeRaffle.imageUrl ? (
            <img src={activeRaffle.imageUrl} alt={activeRaffle.title} className="w-full h-auto aspect-square object-cover rounded-xl transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full aspect-square bg-gray-800 rounded-xl flex items-center justify-center">
              <ImageIcon size={64} className="text-gray-600" />
            </div>
          )}
        </div>
        
        <div>
          <h1 className="text-4xl font-black text-white mb-2 leading-tight">{activeRaffle.title}</h1>
          <p className="text-gray-400 text-lg mb-6 leading-relaxed">{activeRaffle.description}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#111] p-4 rounded-xl border border-gray-800">
              <p className="text-gray-500 text-sm font-medium mb-1">Precio por boleto</p>
              <p className="text-3xl font-black text-amber-500">${activeRaffle.price}</p>
            </div>
            <div className="bg-[#111] p-4 rounded-xl border border-gray-800">
              <p className="text-gray-500 text-sm font-medium mb-1">Boletos restantes</p>
              <p className="text-3xl font-black text-white">{availableCount} <span className="text-sm font-normal text-gray-500">/ 100</span></p>
            </div>
          </div>

          <div className="bg-[#111] p-5 rounded-xl border border-gray-800 flex items-center gap-4">
            <Clock className="text-amber-500 shrink-0" size={32}/>
            <div>
              <p className="text-sm text-gray-400 font-medium">Cierre de dinámica</p>
              <p className="text-lg font-bold text-white">{new Date(activeRaffle.closingDate).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cuadrícula de Boletos */}
      <div className="lg:col-span-7 bg-[#111] p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-2xl flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b border-gray-800 pb-6">
          <h3 className="text-2xl font-bold text-white">Selecciona tus números</h3>
          <div className="flex gap-4 text-xs font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-gray-400"><div className="w-3 h-3 rounded-full bg-green-500"></div> Libre</span>
            <span className="flex items-center gap-1.5 text-gray-400"><div className="w-3 h-3 rounded-full bg-orange-500"></div> En revisión</span>
            <span className="flex items-center gap-1.5 text-gray-400"><div className="w-3 h-3 rounded-full bg-red-600"></div> Pagado</span>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-8 flex-grow">
          {Array.from({ length: 100 }, (_, i) => {
            const numStr = i.toString().padStart(2, '0');
            const status = getTicketStatus(numStr);
            const isSelected = selectedTickets.includes(numStr);
            
            let bgClass = "bg-green-500 hover:bg-green-400 text-gray-900 border-green-600";
            if (status === 'reserved') bgClass = "bg-orange-500 text-white cursor-not-allowed opacity-80 border-orange-600";
            if (status === 'paid') bgClass = "bg-red-600 text-white cursor-not-allowed border-red-700";
            if (isSelected) bgClass = "bg-amber-500 text-gray-900 ring-2 ring-white scale-110 shadow-lg border-amber-600 z-10";

            return (
              <button
                key={numStr}
                onClick={() => toggleTicket(numStr)}
                disabled={status !== 'available'}
                className={`aspect-square rounded-lg font-bold text-sm sm:text-base flex items-center justify-center transition-all border-b-4 active:border-b-0 active:translate-y-1 ${bgClass}`}
              >
                {numStr}
              </button>
            );
          })}
        </div>

        {/* Floating Action / Sticky Bottom in Mobile */}
        <div className="sticky bottom-4 bg-[#1a1a1a] p-4 sm:p-6 rounded-2xl border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
          <div>
            <p className="text-gray-400 text-sm font-medium">Boletos seleccionados: <span className="text-white font-bold">{selectedTickets.length}</span></p>
            <p className="text-2xl font-black text-amber-500">Total: ${selectedTickets.length * activeRaffle.price}</p>
          </div>
          <Button 
            className="w-full sm:w-auto text-lg py-3 px-8 shadow-amber-500/20 shadow-lg"
            disabled={selectedTickets.length === 0}
            onClick={() => setShowCheckout(true)}
          >
            Apartar Boletos <ChevronRight size={20} />
          </Button>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal 
          onClose={() => setShowCheckout(false)} 
          selectedTickets={selectedTickets} 
          raffle={activeRaffle}
          db={db}
          TICKETS_PATH={TICKETS_PATH}
          showToast={showToast}
          onSuccess={() => {
            setShowCheckout(false);
            setSelectedTickets([]);
          }}
        />
      )}
    </div>
  );
}

// --- MODAL DE COMPRA ---
function CheckoutModal({ onClose, selectedTickets, raffle, db, TICKETS_PATH, showToast, onSuccess }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', proofFile: null });
  const [loading, setLoading] = useState(false);

  const total = selectedTickets.length * raffle.price;

  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) {
      showToast("Completa todos los campos", "error"); return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!formData.proofFile) {
      showToast("Debes subir tu comprobante de pago", "error"); return;
    }
    setLoading(true);

    try {
      const q = query(collection(db, TICKETS_PATH), where("raffleId", "==", raffle.id));
      const snap = await getDocs(q);
      const dbTickets = snap.docs.map(d => d.data());
      
      const unavailable = selectedTickets.filter(num => {
        const t = dbTickets.find(dbT => dbT.ticketNumber === num);
        return t && t.status !== 'available';
      });

      if (unavailable.length > 0) {
        showToast(`Los boletos ${unavailable.join(', ')} acaban de ser tomados.`, "error");
        setLoading(false);
        onClose(); 
        return;
      }

      const proofBase64 = await fileToBase64(formData.proofFile);

      const batch = writeBatch(db);
      
      selectedTickets.forEach(numStr => {
        const ticketRef = doc(collection(db, TICKETS_PATH), `${raffle.id}_${numStr}`);
        batch.set(ticketRef, {
          raffleId: raffle.id,
          ticketNumber: numStr,
          status: 'reserved',
          user: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone
          },
          proofUrl: proofBase64,
          reservationDate: new Date().toISOString()
        });
      });

      await batch.commit();

      simulateEmail("admin@luxtimerifas.com", `Nuevos comprobantes recibidos para boletos ${selectedTickets.join(',')}`);
      simulateEmail(formData.email, `Tus boletos ${selectedTickets.join(', ')} están en revisión`);

      showToast("¡Boletos apartados con éxito! Están en revisión.", "success");
      onSuccess();
    } catch (error) {
      console.error("Error comprando:", error);
      showToast("Error procesando la solicitud", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#111] border border-gray-800 rounded-3xl w-full max-w-lg shadow-2xl relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 bg-gray-900 rounded-full">
          <X size={20} />
        </button>

        <div className="p-8">
          <h2 className="text-3xl font-black text-white mb-2">Finalizar Apartado</h2>
          <p className="text-gray-400 mb-8">Estás asegurando {selectedTickets.length} boletos: <span className="font-bold text-amber-500">{selectedTickets.join(', ')}</span></p>

          {step === 1 && (
            <form onSubmit={handleNext} className="animate-fade-in">
              <Input label="Nombre Completo" placeholder="Ej. Juan Pérez" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <Input label="Correo Electrónico" type="email" placeholder="ejemplo@correo.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
              <Input label="Teléfono / WhatsApp" type="tel" placeholder="10 dígitos" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
              
              <div className="mt-8">
                <Button className="w-full py-3" type="submit">Continuar al Pago</Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="animate-fade-in flex flex-col gap-6">
              <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-xl">
                <p className="text-sm text-amber-500 font-bold uppercase tracking-wider mb-2">Total a transferir</p>
                <p className="text-4xl font-black text-white mb-4">${total.toLocaleString()} MXN</p>
                
                <div className="space-y-2 text-sm text-gray-300 bg-black/30 p-4 rounded-lg font-mono">
                  <p>Banco: <span className="text-white font-semibold">BBVA</span></p>
                  <p>Cuenta: <span className="text-white font-semibold">0123456789</span></p>
                  <p>CLABE: <span className="text-white font-semibold">012345678901234567</span></p>
                  <p>Nombre: <span className="text-white font-semibold">LuxTime Oficial SA</span></p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-400 block mb-2">Sube tu comprobante (Imagen o PDF)</label>
                <div className="border-2 border-dashed border-gray-700 hover:border-amber-500 transition-colors rounded-xl p-8 text-center cursor-pointer bg-gray-900 relative">
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => setFormData({...formData, proofFile: e.target.files[0]})}
                  />
                  <ImageIcon className="mx-auto text-gray-500 mb-2" size={32} />
                  <p className="text-white font-medium">{formData.proofFile ? formData.proofFile.name : 'Haz clic o arrastra tu archivo aquí'}</p>
                </div>
              </div>

              <div className="flex gap-4 mt-4">
                <Button variant="secondary" className="w-1/3" onClick={() => setStep(1)}>Atrás</Button>
                <Button className="w-2/3" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Procesando...' : 'Enviar Comprobante'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- VISTA HISTORIAL ---
function HistoryView({ db, RAFFLES_PATH }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, RAFFLES_PATH), where("status", "==", "finished"));
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [db, RAFFLES_PATH]); // Added dependencies

  if (loading) return <div className="text-center py-20 text-gray-500">Cargando historial...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-white uppercase tracking-wider mb-4">Salón de <span className="text-amber-500">Ganadores</span></h2>
        <p className="text-gray-400">Las piezas más exclusivas y sus afortunados nuevos dueños.</p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 bg-[#111] border border-gray-800 rounded-3xl">
          <p className="text-gray-500">Aún no hay rifas finalizadas. ¡Pronto tendremos a nuestro primer ganador!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {history.map(raffle => (
            <div key={raffle.id} className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden group">
              <div className="relative h-64 overflow-hidden">
                <img src={raffle.imageUrl} alt={raffle.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent"></div>
                <div className="absolute bottom-4 left-4">
                  <div className="bg-amber-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-full inline-block mb-2">Finalizada: {new Date(raffle.closingDate).toLocaleDateString()}</div>
                  <h3 className="text-2xl font-bold text-white">{raffle.title}</h3>
                </div>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Ganador</p>
                  <p className="text-lg font-bold text-white">{raffle.winnerName || 'Anónimo'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Boleto</p>
                  <p className="text-3xl font-black text-amber-500">{raffle.winningNumber}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- VISTA ADMIN LOGIN ---
function AdminLoginView({ showToast, auth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast("Administrador creado e iniciado sesión.", "success");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Sesión iniciada correctamente", "success");
      }
    } catch (error) {
      console.error(error);
      showToast("Error de autenticación. Revisa tus credenciales.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-[#111] border border-gray-800 p-8 rounded-3xl shadow-2xl">
      <div className="text-center mb-8">
        <Settings className="mx-auto text-amber-500 mb-4" size={48} />
        <h2 className="text-2xl font-black text-white">{isRegistering ? 'Crear Administrador' : 'Acceso Restringido'}</h2>
        <p className="text-gray-500 mt-2 text-sm">Solo personal autorizado</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Input label="Correo electrónico" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <Input label="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <Button className="w-full mt-4" type="submit" disabled={loading}>
          {loading ? 'Cargando...' : isRegistering ? 'Crear Cuenta' : 'Ingresar'}
        </Button>
      </form>
      
      <div className="mt-6 text-center">
        <button onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-gray-500 hover:text-amber-500 transition-colors">
          {isRegistering ? 'Ya tengo cuenta. Iniciar sesión.' : '¿Primer uso? Crear admin'}
        </button>
      </div>
    </div>
  );
}

// --- VISTA DASHBOARD ADMIN ---
function AdminDashboardView({ db, RAFFLES_PATH, TICKETS_PATH, showToast }) {
  const [raffles, setRaffles] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedRaffle, setSelectedRaffle] = useState(null);

  const [formData, setFormData] = useState({
    title: '', description: '', price: '', closingDate: '', imageBase64: '', status: 'active'
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, RAFFLES_PATH), (snap) => {
      setRaffles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [db, RAFFLES_PATH]); // Added dependencies

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, RAFFLES_PATH), {
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        closingDate: formData.closingDate,
        imageUrl: formData.imageBase64,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      showToast("Rifa creada exitosamente", "success");
      setFormData({ title: '', description: '', price: '', closingDate: '', imageBase64: '', status: 'active' });
      setActiveTab('list');
    } catch (error) {
      console.error(error);
      showToast("Error creando rifa", "error");
    }
  };

  const deleteRaffle = async (id) => {
    if(window.confirm("¿Seguro que deseas eliminar esta rifa y TODOS sus datos?")) {
      await deleteDoc(doc(db, RAFFLES_PATH, id));
      showToast("Rifa eliminada", "success");
    }
  };

  const openTicketManager = (raffle) => {
    setSelectedRaffle(raffle);
    setActiveTab('manage_tickets');
  };

  return (
    <div className="bg-[#111] border border-gray-800 rounded-3xl min-h-[70vh] flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar Admin */}
      <div className="w-full md:w-64 bg-[#161616] border-r border-gray-800 p-6 flex flex-col gap-2">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Panel de Control</h3>
        <button onClick={() => setActiveTab('list')} className={`text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'list' || activeTab === 'manage_tickets' ? 'bg-amber-500 text-gray-900' : 'text-gray-400 hover:bg-gray-800'}`}>
          Gestión de Rifas
        </button>
        <button onClick={() => {setActiveTab('create'); setFormData({...formData, title: '', description: '', price: '', imageBase64: ''})}} className={`text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'create' ? 'bg-amber-500 text-gray-900' : 'text-gray-400 hover:bg-gray-800'}`}>
          Crear Nueva Rifa
        </button>
      </div>

      {/* Contenido Admin */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto">
        
        {/* TAB: LISTA DE RIFAS */}
        {activeTab === 'list' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Tus Rifas</h2>
            <div className="grid grid-cols-1 gap-4">
              {raffles.map(r => (
                <div key={r.id} className="bg-gray-900 border border-gray-800 p-5 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-4">
                    <img src={r.imageUrl} alt={r.title} className="w-16 h-16 object-cover rounded-lg bg-gray-800" />
                    <div>
                      <h4 className="font-bold text-lg text-white">{r.title}</h4>
                      <p className="text-sm text-gray-400">Estado: <span className={r.status === 'active' ? 'text-green-500' : 'text-amber-500'}>{r.status.toUpperCase()}</span> | Precio: ${r.price}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="secondary" className="flex-1 md:flex-none" onClick={() => openTicketManager(r)}><Users size={16}/> Boletos</Button>
                    <Button variant="danger" className="flex-1 md:flex-none px-3" onClick={() => deleteRaffle(r.id)}><Trash2 size={16}/></Button>
                  </div>
                </div>
              ))}
              {raffles.length === 0 && <p className="text-gray-500">No hay rifas creadas.</p>}
            </div>
          </div>
        )}

        {/* TAB: CREAR RIFA */}
        {activeTab === 'create' && (
          <div className="animate-fade-in max-w-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Publicar Nueva Rifa</h2>
            <form onSubmit={handleCreateSubmit}>
              <Input label="Título del reloj" required value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} />
              <div className="flex flex-col gap-1 mb-4 w-full">
                <label className="text-sm font-medium text-gray-400">Descripción detallada</label>
                <textarea rows="4" required className="bg-gray-900 border border-gray-700 rounded-md p-3 text-white focus:border-amber-500 focus:outline-none" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Precio del Boleto ($)" type="number" required value={formData.price} onChange={e=>setFormData({...formData, price: e.target.value})} />
                <Input label="Fecha de Cierre" type="date" required value={formData.closingDate} onChange={e=>setFormData({...formData, closingDate: e.target.value})} />
              </div>
              <div className="mb-8">
                <label className="text-sm font-medium text-gray-400 block mb-2">Imagen Principal (Obligatorio)</label>
                <input type="file" accept="image/*" required className="text-white w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-gray-900 hover:file:bg-amber-400 bg-gray-900 p-2 rounded-lg border border-gray-700" 
                  onChange={async e => {
                    if(e.target.files[0]) {
                      const b64 = await fileToBase64(e.target.files[0]);
                      setFormData({...formData, imageBase64: b64});
                    }
                  }} 
                />
              </div>
              <Button type="submit" className="w-full text-lg py-3"><Plus size={20}/> Publicar Rifa</Button>
            </form>
          </div>
        )}

        {/* TAB: GESTION DE BOLETOS */}
        {activeTab === 'manage_tickets' && selectedRaffle && (
          <AdminTicketManager 
            raffle={selectedRaffle} 
            db={db} 
            TICKETS_PATH={TICKETS_PATH} 
            RAFFLES_PATH={RAFFLES_PATH}
            showToast={showToast}
            onBack={() => setActiveTab('list')}
          />
        )}
      </div>
    </div>
  );
}

// --- SUBCOMPONENTE: GESTIÓN DE BOLETOS Y GANADOR ---
function AdminTicketManager({ raffle, db, TICKETS_PATH, RAFFLES_PATH, showToast, onBack }) {
  const [tickets, setTickets] = useState([]);
  const [winnerInput, setWinnerInput] = useState('');
  const [selectedProof, setSelectedProof] = useState(null); 

  useEffect(() => {
    const q = query(collection(db, TICKETS_PATH), where("raffleId", "==", raffle.id));
    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [db, raffle.id, TICKETS_PATH]); // Added dependencies

  const updateTicketStatus = async (ticket, newStatus) => {
    try {
      await updateDoc(doc(db, TICKETS_PATH, ticket.id), { status: newStatus });
      showToast(`Estado actualizado a ${newStatus}`, "success");
      
      if(newStatus === 'paid') simulateEmail(ticket.user.email, `Tu pago del boleto ${ticket.ticketNumber} ha sido aprobado. ¡Suerte!`);
      if(newStatus === 'available') simulateEmail(ticket.user.email, `Tu pago del boleto ${ticket.ticketNumber} ha sido rechazado. Se ha liberado el boleto.`);
    } catch (error) {
      showToast("Error actualizando", "error");
    }
  };

  const finishRaffle = async () => {
    if(!winnerInput || winnerInput.length !== 2) { showToast("Ingresa un número ganador válido (Ej: 05, 42)", "error"); return; }
    if(!window.confirm(`¿Declarar al boleto ${winnerInput} como GANADOR y finalizar la rifa?`)) return;

    const winnerTicket = tickets.find(t => t.ticketNumber === winnerInput && t.status === 'paid');
    const winnerName = winnerTicket ? winnerTicket.user.name : 'Nadie compró este boleto / No confirmado';

    try {
      await updateDoc(doc(db, RAFFLES_PATH, raffle.id), {
        status: 'finished',
        winningNumber: winnerInput,
        winnerName: winnerName
      });
      showToast("¡Rifa Finalizada Exitosamente!", "success");
      onBack();
    } catch (e) {
      showToast("Error finalizando rifa", "error");
    }
  };

  const reservedTickets = tickets.filter(t => t.status === 'reserved');
  const paidTickets = tickets.filter(t => t.status === 'paid');

  return (
    <div className="animate-fade-in relative">
      <button onClick={onBack} className="text-gray-400 hover:text-white mb-4 text-sm font-semibold flex items-center gap-1">← Volver a lista</button>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white leading-none mb-1">{raffle.title}</h2>
          <p className="text-gray-400 text-sm">Gestionando boletos y comprobantes</p>
        </div>
        <Button variant="secondary" onClick={() => exportToCSV(tickets, raffle.title)} className="bg-[#1a1a1a]"><Download size={16}/> Exportar Excel</Button>
      </div>

      {raffle.status === 'active' && (
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-bold text-white mb-1">Finalizar Rifa</h4>
            <p className="text-sm text-gray-400">Ingresa el número premiado según la lotería nacional.</p>
          </div>
          <div className="flex gap-2 items-center">
            <input type="text" maxLength="2" placeholder="00" className="w-20 bg-black border border-gray-700 rounded-md p-2 text-center text-xl font-black text-amber-500 focus:outline-none" value={winnerInput} onChange={e=>setWinnerInput(e.target.value.replace(/\D/g, ''))} />
            <Button variant="success" onClick={finishRaffle}>Confirmar Ganador</Button>
          </div>
        </div>
      )}

      {/* Grid de Tickets en Revisión */}
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-full"></div> En Revisión (Requieren tu acción)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {reservedTickets.length === 0 ? <p className="text-gray-500 text-sm col-span-2">No hay boletos pendientes de revisión.</p> : null}
        {reservedTickets.map(t => (
          <div key={t.id} className="bg-gray-900 border border-orange-500/30 p-4 rounded-xl flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="bg-orange-500 text-gray-900 font-black text-xl px-2 py-1 rounded-md inline-block mb-2">#{t.ticketNumber}</span>
                <p className="text-white font-semibold">{t.user.name}</p>
                <p className="text-gray-400 text-sm">{t.user.phone}</p>
              </div>
              <button onClick={() => setSelectedProof(t.proofUrl)} className="text-amber-500 text-sm font-semibold underline">Ver Comprobante</button>
            </div>
            <div className="flex gap-2">
              <Button variant="success" className="flex-1 text-xs" onClick={() => updateTicketStatus(t, 'paid')}>Aprobar Pago</Button>
              <Button variant="danger" className="flex-1 text-xs" onClick={() => updateTicketStatus(t, 'available')}>Rechazar</Button>
            </div>
          </div>
        ))}
      </div>

      {/* Lista de Confirmados */}
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><div className="w-3 h-3 bg-red-600 rounded-full"></div> Pagados y Confirmados</h3>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-[#1a1a1a] text-gray-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Boleto</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {paidTickets.length === 0 ? <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-600">No hay boletos confirmados aún.</td></tr> : null}
            {paidTickets.map(t => (
              <tr key={t.id} className="border-t border-gray-800 hover:bg-black/20">
                <td className="px-4 py-3 font-bold text-red-500">{t.ticketNumber}</td>
                <td className="px-4 py-3 font-medium text-white">{t.user.name}</td>
                <td className="px-4 py-3">{t.user.phone} <br/><span className="text-xs text-gray-500">{t.user.email}</span></td>
                <td className="px-4 py-3">
                  <button onClick={() => {if(window.confirm("¿Revertir y liberar boleto?")) updateTicketStatus(t, 'available')}} className="text-xs text-gray-500 hover:text-red-500">Liberar / Cancelar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal para ver comprobante */}
      {selectedProof && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex justify-center items-center p-4" onClick={() => setSelectedProof(null)}>
          <div className="relative max-w-3xl w-full" onClick={e=>e.stopPropagation()}>
            <button onClick={() => setSelectedProof(null)} className="absolute -top-10 right-0 text-white hover:text-red-500"><X size={32}/></button>
            {selectedProof.includes('application/pdf') ? (
              <iframe src={selectedProof} className="w-full h-[80vh] rounded-lg bg-white" title="Comprobante PDF" />
            ) : (
              <img src={selectedProof} alt="Comprobante" className="w-full h-auto max-h-[90vh] object-contain rounded-lg" />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { io } from "socket.io-client";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Bike, 
  LayoutDashboard, 
  ClipboardList, 
  Package, 
  LogOut, 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  User, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Clock,
  Menu,
  X,
  Shield,
  FileText,
  FileSpreadsheet,
  Mail,
  Users,
  Wrench,
  Lock,
  Phone,
  ArrowRight,
  Cloud,
  Cpu,
  ExternalLink,
  Zap,
  Database
} from "lucide-react";
import * as XLSX from "xlsx";
import { auth, googleAuthProvider } from "./lib/firebase.ts";
import { 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signInWithPopup
} from "firebase/auth";
// @ts-ignore
import effLogo from "./assets/images/eff_logo_1784229618019.jpg";

// Intercept native fetch to inject VITE_API_BASE_URL if configured (e.g., for Cloudflare Pages support)
const originalFetch = window.fetch;
const fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || "";
  let url = input;
  if (API_BASE_URL && (API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://")) && typeof input === "string" && input.startsWith("/api/")) {
    const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    url = `${base}${input}`;
  }
  
  const response = await originalFetch(url, init);
  
  // Guard against static page fallbacks returning HTML index pages when API requests fail
  if (typeof input === "string" && input.startsWith("/api/")) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const errMsg = `API request to '${input}' returned HTML instead of JSON.\n\n` +
        `This typically occurs when hosting your frontend on a static CDN (such as Cloudflare Pages) without configuring VITE_API_BASE_URL.\n\n` +
        `Please configure the VITE_API_BASE_URL environment variable in your Cloudflare Pages dashboard to point to your live Google Cloud Run server: https://ais-dev-nirmkj3yoeyfseq4icue22-23626597169.europe-west2.run.app`;
      
      return new Response(JSON.stringify({
        error: "Invalid API Response",
        details: errMsg
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Override json method to handle non-JSON or empty bodies safely
    const originalJson = response.json.bind(response);
    response.json = async function() {
      try {
        const text = await response.text();
        if (!text || text.trim() === "") {
          return { error: "Empty Response", details: `The server returned an empty body with status code ${response.status}.` };
        }
        return JSON.parse(text);
      } catch (e: any) {
        return { 
          error: "Invalid JSON Response", 
          details: `The server returned a non-JSON response (Status ${response.status}). If you are running on Cloudflare Pages, this is likely because your VITE_API_BASE_URL is pointing to your protected AI Studio dev URL (ais-dev-...). You need to deploy your backend to a public hosting provider (like Render, Heroku, or Cloud Run) and update VITE_API_BASE_URL.`,
          raw: e.message 
        };
      }
    };
  }
  
  return response;
};

// Zambia Provinces and Districts data
const ZAMBIA_PROVINCES: { [key: string]: string[] } = {
  "Central": ["Chibombo", "Chisamba", "Chitambo", "Kabwe", "Kapiri Mposhi", "Luano", "Mkushi", "Mumbwa", "Ngabwe", "Serenje", "Shibuyunji"],
  "Copperbelt": ["Chililabombwe", "Chingola", "Kalulushi", "Kitwe", "Luanshya", "Lufwanyama", "Masaiti", "Mpongwe", "Mufulira", "Ndola"],
  "Eastern": ["Chadiza", "Chama", "Chasefu", "Chipangali", "Chipata", "Kasenengwa", "Katete", "Lumezi", "Lundazi", "Lusangazi", "Mambwe", "Nyimba", "Petauke", "Sinda", "Vubwi"],
  "Luapula": ["Chembe", "Chiengi", "Chifunabuli", "Chipili", "Kawambwa", "Lunga", "Mansa", "Milenge", "Mwansabombwe", "Mwense", "Nchelenge", "Samfya"],
  "Lusaka": ["Chilanga", "Chongwe", "Kafue", "Luangwa", "Lusaka", "Rufunsa"],
  "Muchinga": ["Chinsali", "Isoka", "Kanchibiya", "Lavushimanda", "Mafinga", "Mpika", "Nakonde", "Shiwang'andu"],
  "Northern": ["Chilubi", "Kaputa", "Kasama", "Lunte", "Lupososhi", "Luwingu", "Mbala", "Mporokoso", "Mpulungu", "Mungwi", "Nsama", "Senga"],
  "North-Western": ["Chavuma", "Ikelenge", "Kabompo", "Kalumbila", "Kasempa", "Manyinga", "Mufumbwe", "Mushindamo", "Mwinilunga", "Solwezi", "Zambezi"],
  "Southern": ["Chikankata", "Chirundu", "Choma", "Gwembe", "Itezhi-Tezhi", "Kalomo", "Kazungula", "Livingstone", "Mazabuka", "Monze", "Namwala", "Pemba", "Siavonga", "Sinazongwe", "Zimba"],
  "Western": ["Kalabo", "Kaoma", "Limulunga", "Luampa", "Lukulu", "Mitete", "Mongu", "Mulobezi", "Mwandi", "Nalolo", "Nkeyema", "Senanga", "Sesheke", "Shang'ombo", "Sikongo", "Sioma"]
};

interface BikeType {
  id: number;
  regNo: string;
  province: string;
  district: string;
  model: string;
  officer: string;
  dateAdded: string;
}

interface SpareInventoryType {
  id: number;
  name: string;
  quantity: number;
  dateAdded: string;
  addedBy: string;
}

interface LogSpareType {
  id: number;
  serviceLogId: number;
  spareId: number | null;
  spareName: string;
  quantity: number;
}

interface ServiceLogType {
  id: number;
  bikeId: number;
  bikeReg?: string; // Derived field for convenience
  date: string;
  nextServiceDate: string | null;
  nextServiceMileage: number | null;
  mileage: number;
  officer: string;
  province: string;
  district: string;
  workDone: string | null;
  workPending: string | null;
  status: string;
  bike?: BikeType;
  spares?: LogSpareType[];
}

interface ServiceRequestType {
  id: number;
  bikeId: number;
  bikeReg: string;
  requestedBy: string;
  serviceType: string;
  problemDescription: string;
  status: "pending" | "done" | "cancelled";
  dateRequested: string;
  createdAt?: string;
}

interface UserDBType {
  id: number;
  uid: string;
  email: string;
  name: string | null;
  phoneNumber: string | null;
  role: "admin" | "user";
  createdAt?: string;
}



function AgreementModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 p-0.5">
              <img src={effLogo} alt="EFF Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Software Agreement & Terms
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">EFF Zambia Fleet Maintenance System</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-600 leading-relaxed">
          {/* Section 1: Copyright */}
          <section className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-blue-600">01.</span> Copyright & Proprietary Notice
            </h4>
            <p className="text-xs">
              Copyright &copy; {new Date().getFullYear()} EFF Zambia Fleet Maintenance Division. All rights reserved.
            </p>
            <p className="text-xs">
              This software application, including all its database schemas, stock management algorithms, user interfaces, and associated codebases, is a proprietary asset of EFF Zambia. Unauthorized distribution, copying, modification, reverse engineering, or reproduction of any part of this system is strictly prohibited under the Patent and Copyright Act of the Laws of the Republic of Zambia.
            </p>
          </section>

          {/* Section 2: End-User License Agreement */}
          <section className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-blue-600">02.</span> End-User License Agreement (EULA)
            </h4>
            <p className="text-xs">
              By accessing and using this fleet maintenance system, you agree to comply with the following operational licensing terms:
            </p>
            <ul className="list-disc list-inside text-xs pl-2 space-y-1">
              <li><strong>Authorized Access Only:</strong> Access is limited exclusively to active mechanical personnel, supervisors, and fleet managers authorized by EFF Zambia.</li>
              <li><strong>Credentials Confidentiality:</strong> Users must access the platform solely via their assigned company/workspace credentials. Sharing credentials with third parties is a breach of security guidelines.</li>
              <li><strong>Purpose Limitation:</strong> This system must only be used for tracking genuine fleet motorcycle/vehicle assets, logging active services, and managing spare parts stock allocations.</li>
            </ul>
          </section>

          {/* Section 3: Terms and Conditions */}
          <section className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-blue-600">03.</span> Maintenance Logging Terms & Conditions
            </h4>
            <p className="text-xs">
              To preserve database integrity and ensure fleet reliability, all logged maintenance tasks must meet strict compliance standards:
            </p>
            <ul className="list-disc list-inside text-xs pl-2 space-y-1">
              <li><strong>Strict Accuracy:</strong> You represent and warrant that all vehicle registration details, assigned officers, mileage metrics (odometer entries), and description of work are complete, accurate, and entered in real-time.</li>
              <li><strong>Spares Stock Integrity:</strong> The database automatically decrements spares from inventory when logs are created. Incorrect entries must be corrected immediately via the editing panel to maintain precise physical inventory matching.</li>
              <li><strong>Audit and Liability:</strong> All entries are tracked by authenticated user accounts. EFF Zambia reserves the right to audit logged transactions against physically verifiable fleet and spare warehouse stock levels at any time.</li>
            </ul>
          </section>

          {/* Section 4: Warranty Disclaimer */}
          <section className="space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-1.5">
              <span className="text-blue-600">04.</span> Limitation of Liability & Support
            </h4>
            <p className="text-xs">
              This system is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. While every effort is made to maintain optimal uptime and secure automatic data backups, the IT Fleet division shall not be liable for any operational delays, data synchronization failures, or physical vehicle issues resulting from mislogged maintenance logs.
            </p>
            <p className="text-xs">
              For system technical assistance, support requests, or database synchronization errors, please contact the IT Administrator or open a ticket in the EFF Zambia Service Desk portal.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 cursor-pointer transition-colors animate-pulse-subtle"
          >
            I Acknowledge & Agree
          </button>
        </div>
      </div>
    </div>
  );
}

const COUNTRIES = [
  { name: "Zambia", code: "+260", flag: "🇿🇲" },
  { name: "South Africa", code: "+27", flag: "🇿🇦" },
  { name: "Zimbabwe", code: "+263", flag: "🇿🇼" },
  { name: "Malawi", code: "+265", flag: "🇲🇼" },
  { name: "Mozambique", code: "+258", flag: "🇲🇿" },
  { name: "Tanzania", code: "+255", flag: "🇹🇿" },
  { name: "Angola", code: "+244", flag: "🇦🇴" },
  { name: "DR Congo", code: "+243", flag: "🇨🇩" },
  { name: "Namibia", code: "+264", flag: "🇳🇦" },
  { name: "Botswana", code: "+267", flag: "🇧🇼" },
  { name: "Kenya", code: "+254", flag: "🇰🇪" },
  { name: "Rwanda", code: "+250", flag: "🇷🇼" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "United States", code: "+1", flag: "🇺🇸" },
];

const isIframe = typeof window !== "undefined" && window.self !== window.top;

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<UserDBType | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "register" | "forgot">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("+260");
  const [localPhoneInput, setLocalPhoneInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dbLayer, setDbLayer] = useState<"firestore" | "sql">("firestore");
  const [lastSynced, setLastSynced] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('eff_offline_queue') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    const fetchDbStatus = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (data.status === "ok") {
          setDbLayer(data.useFirestore ? "firestore" : "sql");
        }
      } catch (err) {
        console.error("Error checking system health status:", err);
      }
    };
    fetchDbStatus();

    const handleOnline = async () => {
      setIsOnline(true);
      await processOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processOfflineQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('eff_offline_queue') || '[]');
    if (queue.length === 0) return;
    
    setSyncing(true);
    const newQueue = [];
    let syncedCount = 0;
    for (const req of queue) {
      try {
        const res = await fetch(req.url, req.options);
        if (res.ok) {
          syncedCount++;
        } else {
          newQueue.push(req);
        }
      } catch (err) {
        newQueue.push(req);
      }
    }
    
    localStorage.setItem('eff_offline_queue', JSON.stringify(newQueue));
    setOfflineQueue(newQueue);
    if (syncedCount > 0) {
      fetchData();
      alert(`Synced ${syncedCount} offline actions successfully.`);
    }
    setSyncing(false);
  };

  const offlineFetch = async (url: string, options: any) => {
    if (navigator.onLine) {
      return await fetch(url, options);
    } else {
      const queue = JSON.parse(localStorage.getItem('eff_offline_queue') || '[]');
      queue.push({ url, options });
      localStorage.setItem('eff_offline_queue', JSON.stringify(queue));
      setOfflineQueue(queue);
      alert('You are currently offline. This action has been saved locally and will sync when network is available.');
      return { ok: true, json: async () => ({ status: "success", offline: true }) } as any;
    }
  };

  // Local Storage Helpers
  const saveToStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(`eff_cache_${key}`, JSON.stringify(data));
    } catch (e) { console.error("Error saving to storage:", e); }
  };
  const loadFromStorage = (key: string) => {
    try {
      const data = localStorage.getItem(`eff_cache_${key}`);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Error loading from storage:", e);
      return [];
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "logs" | "bikes" | "spares" | "users" | "requests">("dashboard");

  // App Data State
  const [bikesList, setBikesList] = useState<BikeType[]>(() => loadFromStorage("bikes"));
  const [sparesList, setSparesList] = useState<SpareInventoryType[]>(() => loadFromStorage("spares"));
  const [logsList, setLogsList] = useState<ServiceLogType[]>(() => loadFromStorage("logs"));
  const [usersList, setUsersList] = useState<UserDBType[]>(() => loadFromStorage("users"));
  const [requestsList, setServiceRequestsList] = useState<ServiceRequestType[]>(() => loadFromStorage("requests"));


  // Filtering & Searching State
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFilter, setLogStatusFilter] = useState("");
  const [logDistrictFilter, setLogDistrictFilter] = useState("");
  const [sparesTab, setSparesTab] = useState<"in_stock" | "used">("in_stock");

  // Modals state
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [bikeModalOpen, setBikeModalOpen] = useState(false);
  const [editingBike, setEditingBike] = useState<BikeType | null>(null);
  const [bikeForm, setBikeForm] = useState({ regNo: "", province: "", district: "", model: "", officer: "" });

  const [spareModalOpen, setSpareModalOpen] = useState(false);
  const [editingSpare, setEditingSpare] = useState<SpareInventoryType | null>(null);
  const [spareForm, setSpareForm] = useState({ name: "", quantity: 0, dateAdded: "" });

  // User Modals & Forms
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDBType | null>(null);
  const [userForm, setUserForm] = useState({ email: "", name: "", phoneNumber: "", role: "user" });

  // Service Request Modals & Forms
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ bikeId: "", serviceType: "", problemDescription: "" });



  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ServiceLogType | null>(null);
  const [logForm, setLogForm] = useState({
    bikeId: "",
    date: "",
    nextServiceDate: "",
    nextServiceMileage: "",
    mileage: "",
    officer: "",
    province: "",
    district: "",
    workDone: "",
    workPending: "",
    status: "pending",
    sparesUsed: [] as { spareId: string; quantity: number }[]
  });

  // Track Auth State (Local and persistent)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = localStorage.getItem("eff_user_session");
        if (stored) {
          const sessionUser = JSON.parse(stored);
          const customUser = {
            uid: sessionUser.uid,
            email: sessionUser.email,
            displayName: sessionUser.name,
            name: sessionUser.name,
            phoneNumber: sessionUser.phoneNumber,
            token: sessionUser.token,
            getIdToken: async () => sessionUser.token
          };
          setUser(customUser as any);
          setDbUser(sessionUser);
          await fetchData(customUser as any, sessionUser);
        }
      } catch (err) {
        console.error("Failed to restore session:", err);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  // Sync authenticated user to PostgreSQL database
  const syncUser = async (currentUser: FirebaseUser, overrideName?: string, overridePhone?: string) => {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: overrideName || authName || undefined,
          phoneNumber: overridePhone || authPhone || undefined,
          email: currentUser.email
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success" && data.user) {
          setDbUser(data.user);
          saveToStorage("dbUser", data.user);
          await fetchData(currentUser, data.user);
          return;
        }
      }
      await fetchData(currentUser, null);
    } catch (err) {
      console.error("Error syncing user with DB:", err);
      await fetchData(currentUser, null);
    }
  };

  // Fetch all database records
  const fetchData = async (currentUser = user, syncedDbUser = dbUser, isSilent = false) => {
    if (!currentUser) return;
    if (!isSilent) setSyncing(true);
    try {
      const token = await currentUser.getIdToken();
      const headers = { "Authorization": `Bearer ${token}` };

      const lowerEmail = currentUser.email?.toLowerCase() || "";
      const isAdminEmail = lowerEmail === "harrisonnjobvu@gmail.com" || lowerEmail === "harrisonnjobvu@gamil.com" || lowerEmail === "admin@effzambia.org" || lowerEmail === "admin@eff.org";
      const isAdminUser = syncedDbUser?.role === "admin" || isAdminEmail;

      const fetchPromises: Promise<any>[] = [
        fetch("/api/bikes", { headers }),
        fetch("/api/spares", { headers }),
        fetch("/api/logs", { headers }),
        fetch("/api/requests", { headers })
      ];

      if (isAdminUser) {
        fetchPromises.push(fetch("/api/users", { headers }));
      }

      const results = await Promise.all(fetchPromises);
      
      // Log errors if any fetch failed
      results.forEach((r, i) => {
        if (!r.ok) {
          console.error(`Fetch failed for index ${i} (${r.url}): ${r.status} ${r.statusText}`);
        }
      });
      
      if (results[0].ok) {
        const data = await results[0].json();
        setBikesList(data);
        saveToStorage("bikes", data);
      }
      if (results[1].ok) {
        const data = await results[1].json();
        setSparesList(data);
        saveToStorage("spares", data);
      }
      if (results[2].ok) {
        const data = await results[2].json();
        const mappedLogs = data.map((l: any) => ({
          ...l,
          bikeReg: l.bike?.regNo || `Bike #${l.bikeId}`
        }));
        setLogsList(mappedLogs);
        saveToStorage("logs", mappedLogs);
      }
      if (results[3].ok) {
        const data = await results[3].json();
        setServiceRequestsList(data);
        saveToStorage("requests", data);
      }
      if (isAdminUser) {
        if (results[4] && results[4].ok) {
          const data = await results[4].json();
          setUsersList(data);
          saveToStorage("users", data);
        }
      }
      
      setLastSynced(new Date());
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      if (!isSilent) setSyncing(false);
    }
  };

  const fetchDataRef = useRef(fetchData);
  useEffect(() => { fetchDataRef.current = fetchData; });

  // Real-time socket sync
  useEffect(() => {
    const socket = io();

    socket.on("data:updated", (data: { type: string }) => {
      console.log("Data updated, refetching...", data);
      fetchDataRef.current(undefined, undefined, true); // Silent update
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Automated background polling to sync data dynamically across all devices
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        fetchData(user, dbUser, true);
      }
    }, 10000); // Sync silently every 10 seconds

    return () => clearInterval(interval);
  }, [user, dbUser]);

  // Handle Email/Password Sign-In (Custom Secure Relational DB Login)
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError("Email and password are required");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const res = await fetch("/api/auth/custom-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sign in");
      }
      
      const sessionUser = {
        uid: data.user.uid,
        email: data.user.email,
        name: data.user.name,
        phoneNumber: data.user.phoneNumber,
        role: data.user.role,
        token: data.token
      };

      // Set session persistently in localStorage
      localStorage.setItem("eff_user_session", JSON.stringify(sessionUser));

      const customUser = {
        uid: sessionUser.uid,
        email: sessionUser.email,
        displayName: sessionUser.name,
        name: sessionUser.name,
        phoneNumber: sessionUser.phoneNumber,
        token: sessionUser.token,
        getIdToken: async () => sessionUser.token
      };

      setUser(customUser as any);
      setDbUser(sessionUser);
      setAuthSuccess(data.message || "Signed in successfully!");
      await fetchData(customUser as any, sessionUser);
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setAuthError(err.message || "Incorrect email or password. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Password Reset Email
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) {
      setAuthError("Please enter your email address to receive a password reset link");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      await sendPasswordResetEmail(auth, authEmail);
      setAuthSuccess(`Password reset email has been sent successfully to ${authEmail}! Please check your inbox and follow the instructions.`);
    } catch (err: any) {
      console.warn("Firebase password reset warning:", err);
      setAuthError(`Password reset request submitted. If this is a PostgreSQL-only account, please contact Harrison Njobvu (harrisonnjobvu@gmail.com) for direct password overrides.`);
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const currentUser = result.user;
      const token = await currentUser.getIdToken();
      
      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: currentUser.displayName,
          email: currentUser.email,
          phoneNumber: currentUser.phoneNumber || ""
        })
      });
      
      if (!res.ok) {
        throw new Error("Failed to sync Google account with fleet database.");
      }
      
      const data = await res.json();
      if (data.status === "success" && data.user) {
        const sessionUser = {
          uid: data.user.uid,
          email: data.user.email,
          name: data.user.name,
          phoneNumber: data.user.phoneNumber,
          role: data.user.role,
          token: token
        };
        
        localStorage.setItem("eff_user_session", JSON.stringify(sessionUser));
        
        const customUser = {
          uid: sessionUser.uid,
          email: sessionUser.email,
          displayName: sessionUser.name,
          name: sessionUser.name,
          phoneNumber: sessionUser.phoneNumber,
          token: sessionUser.token,
          getIdToken: async () => sessionUser.token
        };
        
        setUser(customUser as any);
        setDbUser(sessionUser);
        setAuthSuccess("Google Sign-In successful!");
        await fetchData(customUser as any, sessionUser);
      } else {
        throw new Error("Invalid response from sync endpoint.");
      }
    } catch (err: any) {
      console.error("Google Sign-In failed:", err);
      setAuthError(err.message || "Google Authentication failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Email/Password/Name/Phone Register (Custom Secure Relational DB Registration)
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPhone = selectedCountryCode + localPhoneInput.trim().replace(/\D/g, "");
    if (!authEmail || !authPassword || !authName || !localPhoneInput) {
      setAuthError("All fields (Name, Email, Phone Number, Password) are required");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters long");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    setAuthSuccess("");
    try {
      const res = await fetch("/api/auth/custom-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          name: authName,
          phoneNumber: finalPhone
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register");
      }

      const sessionUser = {
        uid: data.user.uid,
        email: data.user.email,
        name: data.user.name,
        phoneNumber: data.user.phoneNumber,
        role: data.user.role,
        token: data.token
      };

      // Set session persistently in localStorage
      localStorage.setItem("eff_user_session", JSON.stringify(sessionUser));

      const customUser = {
        uid: sessionUser.uid,
        email: sessionUser.email,
        displayName: sessionUser.name,
        name: sessionUser.name,
        phoneNumber: sessionUser.phoneNumber,
        token: sessionUser.token,
        getIdToken: async () => sessionUser.token
      };

      setUser(customUser as any);
      setDbUser(sessionUser);
      setAuthSuccess("Account created successfully!");
      await fetchData(customUser as any, sessionUser);
    } catch (err: any) {
      console.error("Registration failed:", err);
      setAuthError(err.message || "Failed to create account. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem("eff_user_session");
      window.location.reload();
    } catch (err) {
      console.error("Sign-out failed:", err);
    }
  };

  // User Management Handlers
  const openUserModal = (selectedUser: UserDBType | null = null) => {
    if (selectedUser) {
      setEditingUser(selectedUser);
      setUserForm({
        email: selectedUser.email,
        name: selectedUser.name || "",
        phoneNumber: selectedUser.phoneNumber || "",
        role: selectedUser.role
      });
    } else {
      setEditingUser(null);
      setUserForm({ email: "", name: "", phoneNumber: "", role: "user" });
    }
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const token = await user.getIdToken();
    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    const method = editingUser ? "PUT" : "POST";

    try {
      const res = await offlineFetch(url, { method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(userForm)
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Failed to save user");
        return;
      }

      await fetchData();
      setUserModalOpen(false);
    } catch (err) {
      console.error("Error saving user:", err);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!user || !confirm("Are you sure you want to delete this user account?")) return;

    try {
      const token = await user.getIdToken();
      const res = await offlineFetch(`/api/users/${userId}`, { method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Failed to delete user");
        return;
      }

      await fetchData();
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };



  // Service Request Handlers
  const openRequestModal = () => {
    setRequestForm({ bikeId: "", serviceType: "", problemDescription: "" });
    setRequestModalOpen(true);
  };

  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const token = await user.getIdToken();
    try {
      const res = await offlineFetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...requestForm,
          dateRequested: new Date().toISOString().split("T")[0]
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Failed to submit request");
        return;
      }

      await fetchData();
      setRequestModalOpen(false);
    } catch (err) {
      console.error("Error saving request:", err);
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    if (!user || !confirm("Are you sure you want to delete/cancel this service request?")) return;

    try {
      const token = await user.getIdToken();
      const res = await offlineFetch(`/api/requests/${requestId}`, { method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Failed to delete request");
        return;
      }

      await fetchData();
    } catch (err) {
      console.error("Error deleting request:", err);
    }
  };

  const handleAttendRequest = async (reqObj: ServiceRequestType) => {
    if (!user) return;
    
    // Set request status to "done" in database first
    const token = await user.getIdToken();
    try {
      await offlineFetch(`/api/requests/${reqObj.id}`, { method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "done" })
      });
      
      // Pre-fill the service log creation modal form
      const matchingBike = bikesList.find(b => b.id === reqObj.bikeId);
      
      setEditingLog(null);
      setLogForm({
        bikeId: String(reqObj.bikeId),
        date: new Date().toISOString().split("T")[0],
        nextServiceDate: "",
        nextServiceMileage: "",
        mileage: "",
        officer: matchingBike ? matchingBike.officer : "",
        province: matchingBike ? matchingBike.province : "",
        district: matchingBike ? matchingBike.district : "",
        workDone: `[Attending request: ${reqObj.serviceType}] - ${reqObj.problemDescription}`,
        workPending: "",
        status: "done",
        sparesUsed: []
      });
      
      await fetchData();
      setLogModalOpen(true);
    } catch (err) {
      console.error("Error attending service request:", err);
    }
  };

  // Bike Form Management
  const openBikeModal = (bike: BikeType | null = null) => {
    if (bike) {
      setEditingBike(bike);
      setBikeForm({
        regNo: bike.regNo,
        province: bike.province,
        district: bike.district,
        model: bike.model,
        officer: bike.officer
      });
    } else {
      setEditingBike(null);
      setBikeForm({ regNo: "", province: "", district: "", model: "", officer: "" });
    }
    setBikeModalOpen(true);
  };

  const handleSaveBike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const token = await user.getIdToken();
    const url = editingBike ? `/api/bikes/${editingBike.id}` : "/api/bikes";
    const method = editingBike ? "PUT" : "POST";

    try {
      const res = await offlineFetch(url, { method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...bikeForm,
          dateAdded: editingBike ? editingBike.dateAdded : new Date().toISOString().split("T")[0]
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to save bike");
        return;
      }

      await fetchData();
      setBikeModalOpen(false);
    } catch (err: any) {
      console.error("Error saving bike:", err);
      alert(err.message || "Failed to save bike");
    }
  };

  const handleDeleteBike = async (id: number) => {
    if (!confirm("Are you sure you want to delete this bike? All associated service logs will be permanently deleted.") || !user) return;
    try {
      const token = await user.getIdToken();
      await offlineFetch(`/api/bikes/${id}`, { method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      await fetchData();
    } catch (err) {
      console.error("Error deleting bike:", err);
    }
  };

  // Spares Inventory Form Management
  const openSpareModal = (spare: SpareInventoryType | null = null) => {
    if (spare) {
      setEditingSpare(spare);
      setSpareForm({
        name: spare.name,
        quantity: spare.quantity,
        dateAdded: spare.dateAdded
      });
    } else {
      setEditingSpare(null);
      setSpareForm({
        name: "",
        quantity: 0,
        dateAdded: new Date().toISOString().split("T")[0]
      });
    }
    setSpareModalOpen(true);
  };

  const handleSaveSpare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const token = await user.getIdToken();
    const url = editingSpare ? `/api/spares/${editingSpare.id}` : "/api/spares";
    const method = editingSpare ? "PUT" : "POST";

    try {
      const res = await offlineFetch(url, { method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(spareForm)
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to save spare");
        return;
      }

      await fetchData();
      setSpareModalOpen(false);
    } catch (err) {
      console.error("Error saving spare:", err);
    }
  };

  const handleDeleteSpare = async (id: number) => {
    if (!confirm("Are you sure you want to remove this spare from inventory?") || !user) return;
    try {
      const token = await user.getIdToken();
      await offlineFetch(`/api/spares/${id}`, { method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      await fetchData();
    } catch (err) {
      console.error("Error deleting spare:", err);
    }
  };

  // Service Log Form Management
  const openLogModal = (log: ServiceLogType | null = null) => {
    if (log) {
      setEditingLog(log);
      setLogForm({
        bikeId: String(log.bikeId),
        date: log.date,
        nextServiceDate: log.nextServiceDate || "",
        nextServiceMileage: log.nextServiceMileage ? String(log.nextServiceMileage) : "",
        mileage: String(log.mileage),
        officer: log.officer,
        province: log.province,
        district: log.district,
        workDone: log.workDone || "",
        workPending: log.workPending || "",
        status: log.status,
        sparesUsed: log.spares ? log.spares.map(s => ({ spareId: String(s.spareId), quantity: s.quantity })) : []
      });
    } else {
      setEditingLog(null);
      setLogForm({
        bikeId: "",
        date: new Date().toISOString().split("T")[0],
        nextServiceDate: "",
        nextServiceMileage: "",
        mileage: "",
        officer: "",
        province: "",
        district: "",
        workDone: "",
        workPending: "",
        status: "pending",
        sparesUsed: []
      });
    }
    setLogModalOpen(true);
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (!logForm.bikeId || !logForm.date || !logForm.mileage || !logForm.officer || !logForm.province || !logForm.district) {
      alert("Please fill in all required service log fields (Date, Mileage, Officer, Province, District, Bike)");
      return;
    }

    // Verify inventory quantities for new uses
    for (const item of logForm.sparesUsed) {
      const spareInInv = sparesList.find(s => String(s.id) === item.spareId);
      if (!spareInInv) continue;

      // Calculate quantity difference
      let difference = item.quantity;
      if (editingLog && editingLog.spares) {
        const oldUse = editingLog.spares.find(s => String(s.spareId) === item.spareId);
        if (oldUse) {
          difference = item.quantity - oldUse.quantity;
        }
      }

      if (difference > spareInInv.quantity) {
        alert(`Insufficient stock for spare: ${spareInInv.name}. Available: ${spareInInv.quantity}, requested additional: ${difference}`);
        return;
      }
    }

    const token = await user.getIdToken();
    const url = editingLog ? `/api/logs/${editingLog.id}` : "/api/logs";
    const method = editingLog ? "PUT" : "POST";

    try {
      const res = await offlineFetch(url, { method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          bikeId: parseInt(logForm.bikeId),
          date: logForm.date,
          nextServiceDate: logForm.nextServiceDate || null,
          nextServiceMileage: logForm.nextServiceMileage ? parseInt(logForm.nextServiceMileage) : null,
          mileage: parseInt(logForm.mileage),
          officer: logForm.officer,
          province: logForm.province,
          district: logForm.district,
          workDone: logForm.workDone || null,
          workPending: logForm.workPending || null,
          status: logForm.status,
          spares: logForm.sparesUsed.map(s => ({ spareId: parseInt(s.spareId), quantity: s.quantity }))
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Failed to save service log");
        return;
      }

      await fetchData();
      setLogModalOpen(false);
    } catch (err) {
      console.error("Error saving service log:", err);
    }
  };

  const handleDeleteLog = async (id: number) => {
    if (!confirm("Are you sure you want to delete this service log? Used spares will be returned to inventory.") || !user) return;
    try {
      const token = await user.getIdToken();
      await offlineFetch(`/api/logs/${id}`, { method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      await fetchData();
    } catch (err) {
      console.error("Error deleting service log:", err);
    }
  };

  // Bike Auto Fill Event Handler
  const handleBikeChangeForLog = (bikeIdStr: string) => {
    const bikeId = parseInt(bikeIdStr);
    if (!bikeId) {
      setLogForm(prev => ({ ...prev, bikeId: "", officer: "", province: "", district: "" }));
      return;
    }

    const selectedBike = bikesList.find(b => b.id === bikeId);
    if (selectedBike) {
      setLogForm(prev => ({
        ...prev,
        bikeId: bikeIdStr,
        officer: selectedBike.officer,
        province: selectedBike.province,
        district: selectedBike.district
      }));
    }
  };

  // Multiple Spares Selection Helpers
  const addSpareField = () => {
    setLogForm(prev => ({
      ...prev,
      sparesUsed: [...prev.sparesUsed, { spareId: "", quantity: 1 }]
    }));
  };

  const removeSpareField = (index: number) => {
    setLogForm(prev => ({
      ...prev,
      sparesUsed: prev.sparesUsed.filter((_, i) => i !== index)
    }));
  };

  const updateSpareField = (index: number, field: "spareId" | "quantity", value: string | number) => {
    setLogForm(prev => {
      const updated = [...prev.sparesUsed];
      if (field === "spareId") {
        updated[index] = { ...updated[index], spareId: String(value) };
      } else {
        updated[index] = { ...updated[index], quantity: parseInt(String(value)) || 1 };
      }
      return { ...prev, sparesUsed: updated };
    });
  };

  // Derived / Calculated Stats for Dashboard & Tables
  const totalBikes = bikesList.length;
  const totalCompleted = logsList.filter(l => l.status === "done").length;
  const totalPending = logsList.filter(l => l.status === "pending").length;
  const totalSparesInStock = sparesList.reduce((acc, s) => acc + s.quantity, 0);

  // Total spares used across all completed logs
  const totalSparesUsed = logsList.reduce((acc, log) => {
    if (!log.spares) return acc;
    return acc + log.spares.reduce((sum, s) => sum + s.quantity, 0);
  }, 0);

  // Grouped spares used stats
  const sparesUsedBreakdown: { [name: string]: number } = {};
  logsList.forEach(log => {
    if (!log.spares) return;
    log.spares.forEach(s => {
      sparesUsedBreakdown[s.spareName] = (sparesUsedBreakdown[s.spareName] || 0) + s.quantity;
    });
  });

  // Services by District
  const servicesByDistrict: { [district: string]: number } = {};
  logsList.forEach(log => {
    if (log.district) {
      servicesByDistrict[log.district] = (servicesByDistrict[log.district] || 0) + 1;
    }
  });
  const districtStatsArray = Object.entries(servicesByDistrict)
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count);

  // Spares Used by Bike
  const sparesByBike: { [bikeReg: string]: number } = {};
  logsList.forEach(log => {
    const bike = bikesList.find(b => b.id === log.bikeId);
    if (bike && log.spares) {
      const sparesCount = log.spares.reduce((sum, s) => sum + s.quantity, 0);
      if (sparesCount > 0) {
        sparesByBike[bike.regNo] = (sparesByBike[bike.regNo] || 0) + sparesCount;
      }
    }
  });
  const topBikesBySpares = Object.entries(sparesByBike)
    .map(([regNo, quantity]) => ({ regNo, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5); // top 5

  // Calculate stats per-bike
  const bikeStatsMap = bikesList.reduce((acc, bike) => {
    const bikeLogs = logsList.filter(l => l.bikeId === bike.id);
    let sparesTotalForBike = 0;
    const pendingWorksList: string[] = [];
    const sparesDetailsMap: { [name: string]: number } = {};

    bikeLogs.forEach(log => {
      if (log.spares) {
        log.spares.forEach(s => {
          sparesTotalForBike += s.quantity;
          sparesDetailsMap[s.spareName] = (sparesDetailsMap[s.spareName] || 0) + s.quantity;
        });
      }
      if (log.status === "pending" && log.workPending) {
        pendingWorksList.push(log.workPending);
      }
    });

    acc[bike.id] = {
      sparesUsed: sparesTotalForBike,
      sparesDetails: Object.entries(sparesDetailsMap).map(([name, qty]) => ({ name, qty })),
      pendingWork: pendingWorksList.join(" | ") || "None"
    };
    return acc;
  }, {} as { [bikeId: number]: { sparesUsed: number; sparesDetails: { name: string; qty: number }[]; pendingWork: string } });

  // Total bikes by each district
  const bikesByDistrict = bikesList.reduce((acc, bike) => {
    acc[bike.district] = (acc[bike.district] || 0) + 1;
    return acc;
  }, {} as { [district: string]: number });

  // Export full database to Excel format with multi-sheet workbook
  const exportToExcel = () => {
    try {
      // 1. Bike Registry
      const bikesData = bikesList.map(b => ({
        "Bike ID": b.id,
        "Registration No": b.regNo,
        "Model/Make": b.model,
        "Province": b.province,
        "District": b.district,
        "Assigned Officer": b.officer,
        "Date Registered": b.dateAdded
      }));
      
      // 2. Service Logs
      const logsData = logsList.map(l => ({
        "Log ID": l.id,
        "Date": l.date,
        "Bike Registration": l.bikeReg,
        "Assigned Officer": l.officer,
        "Mileage (KM)": l.mileage,
        "Province": l.province,
        "District": l.district,
        "Work Done": l.workDone || "None",
        "Work Pending": l.workPending || "None",
        "Spares Used": l.spares && l.spares.length > 0 
          ? l.spares.map(s => `${s.spareName} (${s.quantity})`).join(", ") 
          : "None",
        "Status": l.status.toUpperCase()
      }));

      // 3. Spares Stock Inventory
      const sparesData = sparesList.map(s => ({
        "Spare ID": s.id,
        "Item Name": s.name,
        "Current Stock Quantity": s.quantity,
        "Date Stocked": s.dateAdded,
        "Recorded By": s.addedBy
      }));

      const wb = XLSX.utils.book_new();
      
      const wsBikes = XLSX.utils.json_to_sheet(bikesData);
      const wsLogs = XLSX.utils.json_to_sheet(logsData);
      const wsSpares = XLSX.utils.json_to_sheet(sparesData);
      
      XLSX.utils.book_append_sheet(wb, wsBikes, "Bike Registry");
      XLSX.utils.book_append_sheet(wb, wsLogs, "Service Logs");
      XLSX.utils.book_append_sheet(wb, wsSpares, "Spares Stock");
      
      XLSX.writeFile(wb, `EFF_Zambia_Fleet_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (error) {
      console.error("Error generating Excel report:", error);
      alert("Failed to generate Excel report. Please try again.");
    }
  };

  // Filtering service logs for the view table
  const filteredLogs = logsList.filter(log => {
    const matchesSearch = !logSearch || 
      log.officer.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.bikeReg || "").toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.workDone && log.workDone.toLowerCase().includes(logSearch.toLowerCase())) ||
      (log.workPending && log.workPending.toLowerCase().includes(logSearch.toLowerCase()));

    const matchesStatus = !logStatusFilter || log.status === logStatusFilter;
    const matchesDistrict = !logDistrictFilter || log.district === logDistrictFilter;

    return matchesSearch && matchesStatus && matchesDistrict;
  });

  // Pre-load distinct districts in the service log filters based on registered bikes
  const distinctDistricts = Array.from(new Set(bikesList.map(b => b.district))).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mb-4"></div>
        <p className="text-emerald-800 font-bold tracking-wide">Loading EFF Fleet Intelligence System...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 flex items-center justify-center p-4 selection:bg-emerald-200/50 font-sans">
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-emerald-100/60 rounded-3xl mb-4 backdrop-blur-sm">
              <img src={effLogo} alt="EFF Logo" className="w-16 h-16 object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
            </div>
            
            {/* Animated Brand Header */}
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-4xl font-extrabold tracking-tighter uppercase italic flex items-center justify-center gap-1.5"
            >
              <motion.span 
                animate={{ scale: [1, 1.05, 1], color: ["#047857", "#059669", "#047857"] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="font-black"
              >
                EFF FLEET
              </motion.span>
            </motion.h1>
            
            <p className="text-emerald-800/80 text-xs font-bold uppercase tracking-[0.25em] mt-2">
              Mechanic Spare Log System
            </p>
          </div>

          <div className="bg-white/90 p-8 rounded-[2rem] border border-emerald-500/10 shadow-[0_20px_50px_rgba(4,120,87,0.08)] backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/5 blur-[80px] rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-green-500/5 blur-[80px] rounded-full" />

            <div className="relative z-10">
              
              {/* Title Section based on Auth Mode */}
              <div className="text-center mb-6">
                {authMode === "signin" && (
                  <p className="text-xs text-slate-500 mt-1 font-medium">Access the EFF Fleet mechanic log dashboard</p>
                )}
                {authMode === "register" && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Create account</h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Register as a new mechanical fleet administrator</p>
                  </>
                )}
                {authMode === "forgot" && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Reset password</h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Provide your email address to recover credentials</p>
                  </>
                )}
              </div>

              {authError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-rose-800 leading-relaxed">{authError}</p>
                </div>
              )}

              {authSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-emerald-800 leading-relaxed">{authSuccess}</p>
                </div>
              )}

              <form onSubmit={authMode === "signin" ? handleEmailSignIn : authMode === "register" ? handleEmailRegister : handleForgotPassword} className="space-y-4">
                {authMode === "register" && (
                  <div className="space-y-4">
                    <div className="group relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="FULL LEGAL NAME"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/60 border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all uppercase tracking-widest"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">International Phone Number</label>
                      <div className="flex gap-2">
                        <div className="relative w-1/3">
                          <select
                            value={selectedCountryCode}
                            onChange={(e) => setSelectedCountryCode(e.target.value)}
                            className="block w-full px-3 py-3.5 bg-slate-50/60 border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                          >
                            {COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[10px]">
                            ▼
                          </div>
                        </div>
                        
                        <div className="relative flex-1 group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Phone className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                          </div>
                          <input
                            type="tel"
                            required
                            placeholder="Phone Number"
                            value={localPhoneInput}
                            onChange={(e) => setLocalPhoneInput(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/60 border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all tracking-widest"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="EMAIL ADDRESS"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/60 border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all uppercase tracking-widest"
                  />
                </div>

                {authMode !== "forgot" && (
                  <div className="group relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="PASSWORD"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-50/60 border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all tracking-widest"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-sm hover:shadow transition-all duration-300 disabled:shadow-none flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {authLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      {authMode === "signin" ? "Sign in" : authMode === "register" ? "Sign up" : "Send Reset Link"}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Federated Login Methods */}
              {authMode !== "forgot" && (
                <>
                  <div className="relative flex py-4 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">or continue with</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                    className="w-full py-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-200 text-slate-700 rounded-2xl text-xs font-bold uppercase tracking-widest shadow-sm hover:shadow transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12 5.04c1.61 0 3.05.55 4.19 1.63l3.12-3.12C17.43 1.83 14.93 1 12 1 7.35 1 3.4 3.65 1.5 7.5l3.6 2.8C6.01 7.14 8.78 5.04 12 5.04z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.45h6.45c-.28 1.48-1.11 2.73-2.35 3.56l3.6 2.8c2.1-1.94 3.79-5.11 3.79-8.46z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.1 14.7c-.24-.73-.38-1.5-.38-2.3s.14-1.57.38-2.3L1.5 7.3C.54 9.22 0 11.38 0 13.7s.54 4.48 1.5 6.4l3.6-2.8z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c3.24 0 5.96-1.07 7.95-2.91l-3.6-2.8c-1.11.74-2.53 1.19-4.35 1.19-3.22 0-5.99-2.1-6.96-5.26l-3.6 2.8C3.4 20.35 7.35 23 12 23z"
                      />
                    </svg>
                    Sign in with Google
                  </button>
                </>
              )}

              <div className="mt-6 text-center flex flex-col gap-2">
                {authMode === "signin" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => { setAuthMode("register"); setAuthError(""); setAuthSuccess(""); }}
                      className="text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      Don't have an account? <span className="text-emerald-600 font-bold underline">Sign up / Create account</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode("forgot"); setAuthError(""); setAuthSuccess(""); }}
                      className="text-[10px] font-black text-slate-400 hover:text-emerald-600 uppercase tracking-widest transition-colors cursor-pointer mt-1"
                    >
                      Forgot password?
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAuthMode("signin"); setAuthError(""); setAuthSuccess(""); }}
                    className="text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    Already have an account? <span className="text-emerald-600 font-bold underline">Sign in</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isUserAdmin = dbUser?.role === "admin";
  const isAdminEmail = dbUser?.email === "admin@effzambia.org" || dbUser?.email === "harrisonnjobvu@gmail.com";
  const lowerEmail = dbUser?.email?.toLowerCase() || "";

  return (
    <div className="min-h-screen bg-emerald-50/40 flex flex-col md:flex-row text-slate-800 selection:bg-emerald-200/50">
      
      {/* Responsive Sidebar for Desktop / Header Drawer for Mobile */}
      <aside className={`fixed md:sticky top-0 left-0 z-50 h-screen w-72 bg-white border-r border-emerald-500/10 transition-transform duration-300 ease-out flex flex-col justify-between shadow-sm
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div>
          {/* Brand Logo */}
          <div className="p-6 border-b border-emerald-500/10 flex items-center justify-between bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center overflow-hidden p-0.5">
                <img src={effLogo} alt="EFF Logo" className="w-full h-full object-contain mix-blend-multiply" referrerPolicy="no-referrer" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-emerald-600 uppercase leading-none">
                  EFF Fleet
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">System Active</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {!isOnline && (
                <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg" title={`Offline Mode (${offlineQueue.length} unsynced)`}>
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-emerald-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-2">
            <button
              onClick={() => { setActiveTab("dashboard"); setSidebarOpen(false); }}
              id="tab-btn-dashboard"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 group ${activeTab === "dashboard" ? "bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
            >
              <LayoutDashboard className={`w-4 h-4 ${activeTab === "dashboard" ? "text-white" : "text-slate-500 group-hover:text-emerald-600"}`} />
              Dashboard
            </button>

            <button
              onClick={() => { setActiveTab("requests"); setSidebarOpen(false); }}
              id="tab-btn-requests"
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 group ${activeTab === "requests" ? "bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
            >
              <Mail className={`w-4 h-4 ${activeTab === "requests" ? "text-white" : "text-slate-500 group-hover:text-emerald-600"}`} />
              <span>{isUserAdmin ? "Service Mailbox" : "My Requests"}</span>
              {isUserAdmin && requestsList.filter(r => r.status === "pending").length > 0 && (
                <span className="ml-auto bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                  {requestsList.filter(r => r.status === "pending").length}
                </span>
              )}
            </button>

            {isUserAdmin && (
              <>
                <button
                  onClick={() => { setActiveTab("logs"); setSidebarOpen(false); }}
                  id="tab-btn-logs"
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 group ${activeTab === "logs" ? "bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
                >
                  <ClipboardList className={`w-4 h-4 ${activeTab === "logs" ? "text-white" : "text-slate-500 group-hover:text-emerald-600"}`} />
                  Service Logs
                </button>
                <button
                  onClick={() => { setActiveTab("bikes"); setSidebarOpen(false); }}
                  id="tab-btn-bikes"
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 group ${activeTab === "bikes" ? "bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
                >
                  <Bike className={`w-4 h-4 ${activeTab === "bikes" ? "text-white" : "text-slate-500 group-hover:text-emerald-600"}`} />
                  Bike Registry
                </button>
                <button
                  onClick={() => { setActiveTab("spares"); setSidebarOpen(false); }}
                  id="tab-btn-spares"
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 group ${activeTab === "spares" ? "bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
                >
                  <Package className={`w-4 h-4 ${activeTab === "spares" ? "text-white" : "text-slate-500 group-hover:text-emerald-600"}`} />
                  Spares Stock
                </button>
                <button
                  onClick={() => { setActiveTab("users"); setSidebarOpen(false); }}
                  id="tab-btn-users"
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300 group ${activeTab === "users" ? "bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}
                >
                  <Users className={`w-4 h-4 ${activeTab === "users" ? "text-white" : "text-slate-500 group-hover:text-emerald-600"}`} />
                  Admin Role
                </button>
              </>
            )}
          </nav>
        </div>

        {/* User Account Info */}
        <div className="p-4 border-t border-slate-100 bg-emerald-50/20">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-bold uppercase">
              {user?.displayName ? user.displayName[0] : (dbUser?.name ? dbUser.name[0] : (user?.email?.[0] || "A"))}
            </div>
            <div className="truncate flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user?.displayName || dbUser?.name || "Admin User"}</p>
              {dbUser?.phoneNumber && (
                <p className="text-[10px] text-slate-500 truncate mb-1" title={dbUser.phoneNumber}>📞 {dbUser.phoneNumber}</p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider ${isUserAdmin ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                  {isUserAdmin ? "Admin" : "Officer"}
                </span>
                <span className="text-[10px] text-slate-500 truncate max-w-[80px]" title={user?.email}>{user?.email || "admin@effzambia.org"}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer border border-rose-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out Session
          </button>
          
          <div className="mt-4 text-[9px] font-bold text-slate-400 text-center uppercase tracking-wider">
            EFF © {new Date().getFullYear()} Zambia
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 md:ml-0 flex flex-col min-w-0 bg-emerald-50/40">
        
        {/* Top Header Bar */}
        <header className="bg-white/90 backdrop-blur-md border-b border-emerald-500/10 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="md:hidden p-2 bg-emerald-50 border border-emerald-500/10 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase italic">
                {activeTab} <span className="text-emerald-600">Overview</span>
              </h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5 hidden sm:block">
                EFF Fleet Intelligence Interface
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-Time Live Sync Status Indicator */}
            <div className="flex items-center gap-3 px-3 py-1.5 bg-white border border-emerald-500/10 rounded-xl shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              </span>
              <div className="flex flex-col text-left">
                <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isOnline ? "text-emerald-600" : "text-amber-600"}`}>
                  {isOnline ? "System Uplink" : "Local Buffer"}
                </span>
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter leading-none mt-1">
                  {isOnline ? `Sync: ${lastSynced.toLocaleTimeString()}` : "Auth required"}
                </span>
              </div>
            </div>

            {syncing && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Updating...
              </span>
            )}
            
            <button
              onClick={() => fetchData()}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 border border-emerald-500/10 transition-all cursor-pointer group"
              title="Refresh Data Matrix"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-emerald-600" : "group-hover:rotate-180 transition-transform duration-500"}`} />
            </button>

            <button
              onClick={exportToExcel}
              className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-300 cursor-pointer border border-emerald-500/20"
              title="Export Full Report to Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {activeTab === "logs" && (
              <button
                onClick={() => openLogModal()}
                id="btn-add-log"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-300 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Log Service
              </button>
            )}
            {activeTab === "bikes" && (
              <button
                onClick={() => openBikeModal()}
                id="btn-add-bike"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-300 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Bike
              </button>
            )}
            {activeTab === "spares" && (
              <button
                onClick={() => openSpareModal()}
                id="btn-add-spare"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-300 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Spare Stock
              </button>
            )}
            {activeTab === "users" && isUserAdmin && (
              <button
                onClick={() => openUserModal()}
                id="btn-add-user"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-300 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add User / Role
              </button>
            )}

            {activeTab === "requests" && (
              <button
                onClick={() => openRequestModal()}
                id="btn-add-request"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-300 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Request Service
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 overflow-y-auto">
          
          {/* ==================== DASHBOARD VIEW ==================== */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Highlight Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Total Bikes Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-6 rounded-2xl border border-emerald-500/10 shadow-sm flex items-center gap-4 hover:border-emerald-500/30 transition-colors group"
                >
                  <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform shadow-sm">
                    <Bike className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Bikes</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{totalBikes}</h3>
                  </div>
                </motion.div>

                {/* Total Completed Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white p-6 rounded-2xl border border-emerald-500/10 shadow-sm flex items-center gap-4 hover:border-emerald-500/30 transition-colors group"
                >
                  <div className="p-3.5 bg-emerald-100/60 text-emerald-700 rounded-xl group-hover:scale-110 transition-transform shadow-sm">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Completed Services</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{totalCompleted}</h3>
                  </div>
                </motion.div>

                {/* Total Pending Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white p-6 rounded-2xl border border-emerald-500/10 shadow-sm flex items-center gap-4 hover:border-emerald-500/30 transition-colors group"
                >
                  <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform shadow-sm">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pending Services</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{totalPending}</h3>
                  </div>
                </motion.div>

                {/* Total Spares in Stock Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white p-6 rounded-2xl border border-emerald-500/10 shadow-sm flex items-center gap-4 hover:border-emerald-500/30 transition-colors group"
                >
                  <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform shadow-sm">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spares in Stock</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-0.5 tracking-tight">{totalSparesInStock}</h3>
                  </div>
                </motion.div>
              </div>

              {/* Real-Time Cloud Infrastructure & Launchpad */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="bg-white p-6 rounded-2xl border border-emerald-500/15 shadow-sm space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest italic">
                      <Cloud className="w-4 h-4 text-emerald-600 animate-pulse" />
                      Real-Time Cloud Services Dashboard
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                      Federated real-time synchronization across Global Edge Networks and Google Cloud Platform
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-500/10">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-emerald-800 tracking-wider uppercase">
                      SYSTEMS SYNCHRONIZED
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cloudflare Network Card */}
                  <div className="p-5 bg-gradient-to-br from-orange-50/50 via-white to-orange-50/10 rounded-2xl border border-orange-500/10 hover:border-orange-500/20 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Cloudflare Edge Network</h4>
                          <p className="text-[9px] text-orange-700/80 font-bold uppercase tracking-widest mt-0.5">DNS, CDN & WAF Routing</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-500/10">
                        12ms Latency
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-5 text-[11px] font-medium text-slate-600">
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                        <span>Shield Integrity</span>
                        <span className="text-emerald-600 font-bold uppercase tracking-wider">WAF Active</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                        <span>SSL Configuration</span>
                        <span className="text-slate-800 font-bold">Full (Strict)</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Edge CDN Cache</span>
                        <span className="text-emerald-600 font-bold uppercase tracking-wider">100% Operational</span>
                      </div>
                    </div>

                    <a
                      href="https://dash.cloudflare.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
                    >
                      <span>Launch Cloudflare Dashboard</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Google Cloud Platform Card */}
                  <div className="p-5 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/10 rounded-2xl border border-blue-500/10 hover:border-blue-500/20 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Google Cloud Platform</h4>
                          <p className="text-[9px] text-blue-700/80 font-bold uppercase tracking-widest mt-0.5">Cloud Run Container Engine</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-500/10">
                        Active Instance
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-5 text-[11px] font-medium text-slate-600">
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                        <span>Primary Compute</span>
                        <span className="text-slate-800 font-bold">Cloud Run (London)</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-dashed border-slate-100">
                        <span>Durable DB Layer</span>
                        <span className="text-emerald-600 font-bold uppercase tracking-wider">Firebase Firestore</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Database Sync Mode</span>
                        <span className="text-emerald-600 font-bold uppercase tracking-wider">Real-Time Sync Online</span>
                      </div>
                    </div>

                    <a
                      href="https://console.cloud.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow transition-all duration-300 cursor-pointer"
                    >
                      <span>Launch Google Cloud Console</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Integration Details Footer inside card */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    Active Connection:
                    <span className="font-mono text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-emerald-700">
                      {dbLayer === "firestore" ? "Firestore Live Sync" : "SQL Active Server"}
                    </span>
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    System Time: {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
                  </div>
                </div>
              </motion.div>

              {/* Quick Admin Protocol (Shortcut Matrix) */}


              {/* Grid with spares breakdown & bike lists */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Spares used details panel */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white p-6 rounded-2xl border border-emerald-500/10 shadow-sm lg:col-span-1"
                >
                  <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-widest italic">
                    <Package className="w-4 h-4 text-emerald-600" />
                    Spares Stock Overview
                  </h3>
                  
                  <div className="mb-6 pb-6 flex justify-between items-center bg-emerald-50/50 p-4 rounded-xl border border-emerald-500/10">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Spares Installed</p>
                      <h4 className="text-xl font-black text-slate-800 mt-1">{totalSparesUsed} <span className="text-xs text-slate-500">UNITS</span></h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Unique Types</p>
                      <h4 className="text-xl font-black text-emerald-600 mt-1">{sparesList.length} <span className="text-xs text-slate-500">TYPES</span></h4>
                    </div>
                  </div>

                  {/* Tab Selector for In Stock vs Used */}
                  <div className="flex bg-slate-50 p-1.5 rounded-xl mb-4 border border-emerald-500/5">
                    <button
                      type="button"
                      onClick={() => setSparesTab("in_stock")}
                      className={`flex-1 text-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg cursor-pointer transition-all duration-300 ${sparesTab === "in_stock" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-emerald-700"}`}
                    >
                      In Stock ({sparesList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSparesTab("used")}
                      className={`flex-1 text-center py-2 text-[10px] font-black uppercase tracking-widest rounded-lg cursor-pointer transition-all duration-300 ${sparesTab === "used" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-emerald-700"}`}
                    >
                      Usage Breakdown ({Object.keys(sparesUsedBreakdown).length})
                    </button>
                  </div>

                  {sparesTab === "in_stock" ? (
                    <div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">Current Stock Segregation</h4>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {sparesList.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-4">No spares registered in inventory yet.</p>
                        ) : (
                          sparesList.map((spare, idx) => (
                            <motion.div 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 * (idx % 5) }}
                              key={spare.id} 
                              className="flex justify-between items-center text-sm py-3 border-b border-emerald-500/5 last:border-0 hover:bg-emerald-50/50 rounded-lg px-2 transition-colors group"
                            >
                              <span className="font-bold text-slate-700 group-hover:text-emerald-950 transition-colors">{spare.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${spare.quantity > 5 ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : spare.quantity > 0 ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
                                  {spare.quantity} units
                                </span>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">Spares Usage Breakdown</h4>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {Object.keys(sparesUsedBreakdown).length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-4 text-center">No spares have been recorded as used yet.</p>
                        ) : (
                          Object.entries(sparesUsedBreakdown).map(([name, count], idx) => {
                             const originalSpare = sparesList.find(s => s.name === name);
                             return (
                               <motion.div 
                                 initial={{ opacity: 0, x: -10 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 transition={{ delay: 0.1 * (idx % 5) }}
                                 key={name} 
                                 className="flex justify-between items-center text-sm py-3 border-b border-emerald-500/5 last:border-0 hover:bg-emerald-50/50 rounded-lg px-2 transition-colors group"
                               >
                                 <span className="font-bold text-slate-700 group-hover:text-emerald-950 transition-colors">{name}</span>
                                 <div className="flex items-center gap-2">
                                   <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-500/10 px-2 py-0.5 rounded font-black uppercase">
                                     {count} used
                                   </span>
                                   {originalSpare && (
                                     <span className="text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">
                                       {originalSpare.quantity} stock
                                     </span>
                                   )}
                                 </div>
                               </motion.div>
                             );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Bike Summary Stats */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white p-6 rounded-2xl border border-emerald-500/10 shadow-sm lg:col-span-2"
                >
                  <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-widest italic">
                    <Bike className="w-4 h-4 text-emerald-600" />
                    Fleet Intelligence Summary
                  </h3>

                  {bikesList.length === 0 ? (
                    <div className="text-center py-20 bg-emerald-50/20 rounded-2xl border border-emerald-500/10 border-dashed">
                      <Bike className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No active fleet registry detected</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-sm text-left border-separate border-spacing-y-2">
                        <thead>
                          <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                            <th className="pb-4 px-4">Identification</th>
                            <th className="pb-4 px-4">Deployment</th>
                            <th className="pb-4 px-4 text-center">Resource Utilization</th>
                            <th className="pb-4 px-4">System Alerts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bikesList.map((bike, idx) => {
                            const stats = bikeStatsMap[bike.id] || { sparesUsed: 0, sparesDetails: [], pendingWork: "None" };
                            return (
                              <motion.tr 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * (idx % 10) }}
                                key={bike.id} 
                                className="bg-emerald-50/10 hover:bg-emerald-50/50 transition-colors group"
                              >
                                <td className="py-4 px-4 rounded-l-xl border-y border-l border-emerald-500/5">
                                  <div className="font-black text-slate-800 text-lg tracking-tight group-hover:text-emerald-700 transition-colors">{bike.regNo}</div>
                                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{bike.makeModel || "Generic Unit"}</div>
                                </td>
                                <td className="py-4 px-4 border-y border-emerald-500/5">
                                  <div className="text-xs text-slate-700 font-bold">{bike.officer}</div>
                                  <div className="text-[10px] text-slate-500 uppercase font-black">{bike.district}</div>
                                </td>
                                <td className="py-4 px-4 border-y border-emerald-500/5">
                                  <div className="flex flex-col items-center gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${stats.sparesUsed > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                                      {stats.sparesUsed} Spares Installed
                                    </span>
                                    {stats.sparesDetails && stats.sparesDetails.length > 0 && (
                                      <div className="flex flex-wrap gap-1 justify-center max-w-[200px]">
                                        {stats.sparesDetails.slice(0, 3).map((s, sIdx) => (
                                          <span key={sIdx} className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                                            {s.name}
                                          </span>
                                        ))}
                                        {stats.sparesDetails.length > 3 && (
                                          <span className="text-[8px] text-slate-600 font-bold">+{stats.sparesDetails.length - 3} more</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-4 rounded-r-xl border-y border-r border-emerald-500/5">
                                  {stats.pendingWork !== "None" ? (
                                    <div className="flex items-center gap-2 text-amber-600 animate-pulse">
                                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                      <span className="text-[10px] font-black uppercase tracking-wider truncate max-w-[120px]">{stats.pendingWork}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-emerald-600">
                                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                      <span className="text-[10px] font-bold uppercase tracking-wider">Nominal</span>
                                    </div>
                                  )}
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Row 3: District Fleet Distribution & Service Logs (Done/Pending) Tracker */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Total Bikes by District Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-white p-6 rounded-2xl border border-emerald-500/10 shadow-sm lg:col-span-1 flex flex-col h-[400px]"
                >
                  <h3 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2 uppercase tracking-widest italic">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Fleet Deployment Map
                  </h3>
                  <p className="text-[10px] text-slate-500 mb-6 font-bold uppercase tracking-wider">Geospatial distribution across active sectors</p>
                  
                  <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                    {Object.keys(bikesByDistrict).length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-10 text-center uppercase font-bold tracking-widest">No deployment data available</p>
                    ) : (
                      Object.entries(bikesByDistrict).map(([district, count], idx) => {
                        const countNum = Number(count);
                        const percentage = totalBikes > 0 ? (countNum / totalBikes) * 100 : 0;
                        return (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.8 + (idx * 0.05) }}
                            key={district} 
                            className="space-y-2 group"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest group-hover:text-emerald-700 transition-colors">{district}</span>
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                {count} UNITS
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-emerald-500/5">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 1, delay: 1 }}
                                className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full" 
                              ></motion.div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </motion.div>

                {/* Completed and Pending Services (col-span-2) */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 h-[400px]">
                  
                  {/* Completed Services */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="bg-[#0d1425] p-6 rounded-2xl border border-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.03)] flex flex-col h-full"
                  >
                    <h3 className="text-[10px] font-black text-emerald-500 mb-1 flex items-center gap-1.5 uppercase tracking-widest italic">
                      <CheckCircle className="w-4 h-4" />
                      Maintenance Executed
                    </h3>
                    <p className="text-[9px] text-slate-500 mb-6 font-bold uppercase tracking-wider">Historical performance logs</p>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 custom-scrollbar">
                      {logsList.filter(l => l.status === "done").length === 0 ? (
                        <div className="text-center py-20 text-slate-700 italic text-[10px] uppercase font-black tracking-widest opacity-30">
                          Empty execution history
                        </div>
                      ) : (
                        logsList.filter(l => l.status === "done").map((log, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.9 + (idx * 0.05) }}
                            key={log.id} 
                            className="p-3 bg-[#0a0f1d] rounded-xl border border-emerald-500/5 hover:border-emerald-500/20 transition-all group"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-white text-sm tracking-tight group-hover:text-emerald-400 transition-colors">{log.bikeReg || log.bike?.regNo || `Bike #${log.bikeId}`}</span>
                              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">{log.date}</span>
                            </div>
                            <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2 opacity-60">
                              {log.officer} // {log.district}
                            </div>
                            <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 text-[10px] text-emerald-200/70 font-medium italic leading-relaxed mb-2">
                              {log.workDone || "Standard maintenance protocols applied"}
                            </div>
                            {log.spares && log.spares.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                {log.spares.map((s, sIdx) => (
                                  <span key={sIdx} className="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black">
                                    {s.spareName} ({s.quantity})
                                  </span>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        ))
                      )}
                    </div>
                  </motion.div>

                  {/* Pending Services */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="bg-[#0d1425] p-6 rounded-2xl border border-amber-500/10 shadow-[0_0_30px_rgba(245,158,11,0.03)] flex flex-col h-full"
                  >
                    <h3 className="text-[10px] font-black text-amber-500 mb-1 flex items-center gap-1.5 uppercase tracking-widest italic">
                      <Clock className="w-4 h-4" />
                      Active Alerts (Pending)
                    </h3>
                    <p className="text-[9px] text-slate-500 mb-6 font-bold uppercase tracking-wider">Unresolved system requirements</p>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 custom-scrollbar">
                      {logsList.filter(l => l.status === "pending").length === 0 ? (
                        <div className="text-center py-20 text-emerald-500/30 italic text-[10px] uppercase font-black tracking-widest">
                          All systems operational
                        </div>
                      ) : (
                        logsList.filter(l => l.status === "pending").map((log, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1.0 + (idx * 0.05) }}
                            key={log.id} 
                            className="p-3 bg-[#0a0f1d] rounded-xl border border-amber-500/5 hover:border-amber-500/20 transition-all group"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-black text-white text-sm tracking-tight group-hover:text-amber-400 transition-colors">{log.bikeReg || log.bike?.regNo || `Bike #${log.bikeId}`}</span>
                              <span className="text-[9px] text-amber-500/50 font-bold uppercase tracking-tighter italic">Awaiting Action</span>
                            </div>
                            <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2 opacity-60">
                              {log.officer} // {log.district}
                            </div>
                            <div className="bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 text-[10px] text-amber-200/70 font-medium italic leading-relaxed mb-2">
                              {log.workPending || "Maintenance sequence pending validation"}
                            </div>
                            {log.spares && log.spares.length > 0 && (
                              <div className="flex flex-wrap gap-1 items-center">
                                {log.spares.map((s, sIdx) => (
                                  <span key={sIdx} className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-black">
                                    {s.spareName} ({s.quantity})
                                  </span>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        ))
                      )}
                    </div>
                  </motion.div>

                </div>

              </div>

              {/* Row 4: Analytics (Services by District & Top Spare Consumers) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                
                {/* Services by District */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[300px]">
                  <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    Services Done by District
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Total maintenance services completed in each district.</p>
                  
                  <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                    {districtStatsArray.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No services logged yet.</p>
                    ) : (
                      districtStatsArray.map(({ district, count }) => {
                        const percentage = totalCompleted > 0 ? (count / totalCompleted) * 100 : 0;
                        return (
                          <div key={district} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700">{district}</span>
                              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {count} {count === 1 ? 'service' : 'services'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Top Bikes by Spares Used */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[300px]">
                  <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Package className="w-5 h-5 text-rose-600" />
                    High Spare Consumption (Top 5)
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Bikes utilizing the highest volume of spares.</p>
                  
                  <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                    {topBikesBySpares.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No spares used yet.</p>
                    ) : (
                      topBikesBySpares.map(({ regNo, quantity }) => (
                        <div key={regNo} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                              <Bike className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{regNo}</div>
                              <div className="text-[10px] text-slate-500">Fleet motorcycle</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100/50">
                              {quantity} units
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SERVICE LOGS VIEW ==================== */}
          {activeTab === "logs" && (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  />
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-44">
                    <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={logStatusFilter}
                      onChange={(e) => setLogStatusFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                    >
                      <option value="">All Statuses</option>
                      <option value="done">Done</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>

                  <div className="relative flex-1 sm:w-44">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={logDistrictFilter}
                      onChange={(e) => setLogDistrictFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                    >
                      <option value="">All Districts</option>
                      {distinctDistricts.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-20">
                    <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-800">No Service Logs Found</h4>
                    <p className="text-xs text-slate-500 mt-1">Try resetting the filters or logging a new service.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Bike Reg</th>
                          <th className="px-6 py-4">Officer</th>
                          <th className="px-6 py-4">Mileage</th>
                          <th className="px-6 py-4">District</th>
                          <th className="px-6 py-4">Work Done</th>
                          <th className="px-6 py-4">Spares Used</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLogs.map(log => {
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 text-slate-700">
                              <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600">
                                {log.date}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                                {log.bikeReg || (log.bike?.regNo) || "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                                {log.officer}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-blue-600">
                                {log.mileage.toLocaleString()} KM
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs">
                                {log.district}
                              </td>
                              <td className="px-6 py-4 max-w-xs truncate" title={log.workDone || ""}>
                                {log.workDone || <span className="text-slate-400 italic">None</span>}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1.5 max-w-xs">
                                  {log.spares && log.spares.length > 0 ? (
                                    log.spares.map(s => (
                                      <span key={s.id} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-semibold">
                                        {s.spareName} ({s.quantity})
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-slate-400">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${log.status === "done" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
                                  {log.status === "done" ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                  {log.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => openLogModal(log)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                    title="Edit Service Log"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLog(log.id)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                    title="Delete Service Log"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== BIKE REGISTRY VIEW ==================== */}
          {activeTab === "bikes" && (
            <div className="space-y-6">
              {bikesList.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
                  <Bike className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-lg font-bold text-slate-800">No Bikes Registered Yet</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Add active fleet motorcycles to the directory to start logging services.</p>
                  <button
                    onClick={() => openBikeModal()}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 transition-all cursor-pointer"
                  >
                    Add Your First Bike
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bikesList.map(bike => {
                    return (
                      <div key={bike.id} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                              <Bike className="w-6 h-6" />
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => openBikeModal(bike)}
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBike(bike.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <h3 className="text-lg font-bold text-slate-900">{bike.regNo}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{bike.model}</p>

                          <div className="mt-4 space-y-2.5 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{bike.province} - {bike.district}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>Assigned: <strong className="text-slate-800">{bike.officer}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                          <span>Added: {bike.dateAdded}</span>
                          <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Active</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== SPARES STOCK VIEW ==================== */}
          {activeTab === "spares" && (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#0d1425] border border-blue-500/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                    <Package className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-black uppercase tracking-widest italic text-lg">Inventory Control</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Resource allocation & stock management matrix</p>
                  </div>
                </div>
                <button
                  onClick={() => openSpareModal()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all cursor-pointer flex items-center gap-2 group"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  Provision New Stock
                </button>
              </div>

              {sparesList.length === 0 ? (
                <div className="text-center py-24 bg-[#0d1425] rounded-3xl border border-blue-500/5 shadow-inner">
                  <Package className="w-20 h-20 text-slate-800 mx-auto mb-4 opacity-20" />
                  <h4 className="text-xl font-black text-slate-700 uppercase italic tracking-widest">Inventory Depleted</h4>
                  <p className="text-[10px] text-slate-600 mt-2 font-bold uppercase tracking-widest max-w-xs mx-auto">Zero resources detected in the primary buffer. Initialize provisioning sequence.</p>
                  <button
                    onClick={() => openSpareModal()}
                    className="mt-6 bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border border-slate-700/50"
                  >
                    Execute First Provisioning
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {sparesList.map(spare => {
                    const isLow = spare.quantity < 3;
                    return (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={spare.id} 
                        className={`bg-[#0d1425] rounded-3xl border transition-all duration-300 group overflow-hidden ${isLow ? "border-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.05)]" : "border-blue-500/5 hover:border-blue-500/20 shadow-xl"}`}
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-6">
                            <div className={`p-4 rounded-2xl border transition-colors ${isLow ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-blue-500/5 text-blue-400 border-blue-500/10 group-hover:bg-blue-600 group-hover:text-white"}`}>
                              <Package className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openSpareModal(spare)}
                                className="p-2.5 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-blue-600 rounded-xl transition-all cursor-pointer border border-slate-700/50"
                                title="Edit Asset Data"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSpare(spare.id)}
                                className="p-2.5 bg-slate-800/50 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer border border-slate-700/50"
                                title="Decommission Asset"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 mb-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-black text-white uppercase italic tracking-tight truncate pr-4" title={spare.name}>
                                {spare.name}
                              </h3>
                              {isLow && (
                                <span className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase tracking-widest rounded-lg animate-pulse border border-rose-500/20">
                                  Critical Level
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Part ID: SPC-{spare.id.toString().padStart(4, "0")}</p>
                          </div>
                          
                          <div className={`p-5 rounded-2xl border flex justify-between items-center transition-all ${isLow ? "bg-rose-500/5 border-rose-500/10" : "bg-slate-900/50 border-slate-800"}`}>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Stock Reservoir</span>
                              <span className={`text-2xl font-black italic tracking-tighter ${spare.quantity > 5 ? "text-emerald-500" : isLow ? "text-rose-500" : "text-amber-500"}`}>
                                {spare.quantity} <span className="text-xs uppercase not-italic ml-1">Units</span>
                              </span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter mb-1">Status</span>
                              <span className={`text-[10px] font-black uppercase italic tracking-widest ${spare.quantity > 0 ? "text-emerald-500/70" : "text-rose-500/70"}`}>
                                {spare.quantity > 0 ? "Available" : "Depleted"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-6 grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest block">Last Provision</span>
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                                <Calendar className="w-3 h-3 text-blue-500/50" />
                                {spare.dateAdded}
                              </div>
                            </div>
                            <div className="space-y-1 text-right">
                              <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest block">Custodian</span>
                              <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400 font-bold">
                                <User className="w-3 h-3 text-blue-500/50" />
                                {spare.addedBy}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`py-3 px-6 text-center border-t transition-all ${isLow ? "bg-rose-500/5 border-rose-500/10" : "bg-blue-500/5 border-blue-500/10"}`}>
                          <button 
                            onClick={() => openSpareModal(spare)}
                            className={`text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 mx-auto transition-colors ${isLow ? "text-rose-400 hover:text-rose-300" : "text-blue-400 hover:text-blue-300"}`}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Initiate Stock Injection
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== SERVICE REQUESTS VIEW ==================== */}
          {activeTab === "requests" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-blue-50 border border-blue-200/50 rounded-2xl p-4 flex gap-3 text-xs text-blue-800">
                <Mail className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p>
                  {isUserAdmin ? (
                    <strong>Admin Service Mailbox</strong>
                  ) : (
                    <strong>Service Requests Center</strong>
                  )}
                  : {isUserAdmin 
                    ? "Review and attend to service requests submitted by officers. Clicking 'Attend' will mark the request as attended and pre-populate a new service log." 
                    : "Need a repair, oil change, or spare parts replacement? Submit a service request stating the bike and description of the issue. Admins will review your request in their Mailbox."
                  }
                </p>
              </div>

              {/* Service Requests Table / List */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                {(() => {
                  const displayRequests = isUserAdmin 
                    ? requestsList 
                    : requestsList.filter(r => r.requestedBy?.toLowerCase() === user?.email?.toLowerCase());

                  return (
                    <div className="flex flex-col h-[600px] bg-slate-50 relative">
                      {/* Chat Messages Area */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {displayRequests.length === 0 ? (
                           <div className="text-center py-20">
                            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <h4 className="text-base font-bold text-slate-800">No Service Requests Found</h4>
                            <p className="text-xs text-slate-500 mt-1">
                              {isUserAdmin ? "All clear! No pending requests in the mailbox." : "You haven't submitted any service requests yet."}
                            </p>
                          </div>
                        ) : (
                          displayRequests.map(req => {
                            const isMine = req.requestedBy?.toLowerCase() === user?.email?.toLowerCase();
                            const matchedBike = bikesList.find(b => b.id === req.bikeId);
                            const bikeReg = req.bikeReg || (matchedBike ? matchedBike.regNo : `Bike #${req.bikeId}`);
                            const matchedUser = usersList.find(u => u.email.toLowerCase() === req.requestedBy?.toLowerCase());
                            const displayUser = matchedUser ? `${matchedUser.name} (${matchedUser.phoneNumber})` : req.requestedBy;

                            return (
                              <div key={req.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm border ${isMine ? "bg-blue-600 text-white border-blue-500 rounded-tr-sm" : "bg-white text-slate-800 border-slate-200 rounded-tl-sm"}`}>
                                  <div className="flex justify-between items-start mb-2 gap-4">
                                    <div className={`text-[10px] font-bold ${isMine ? "text-blue-200" : "text-slate-400"} uppercase tracking-wider`}>
                                      {displayUser} • {req.dateRequested}
                                    </div>
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${req.status === "done" ? "bg-emerald-500/20 text-emerald-100" : req.status === "cancelled" ? "bg-slate-500/20 text-slate-100" : "bg-amber-500/20 text-amber-100"}`}>
                                      {req.status}
                                    </span>
                                  </div>
                                  <div className="mb-2">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${isMine ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                                      {bikeReg} - {req.serviceType}
                                    </span>
                                    <p className="text-sm">{req.problemDescription}</p>
                                  </div>
                                  <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-white/10">
                                    {isUserAdmin && req.status === "pending" && (
                                      <button
                                        onClick={() => handleAttendRequest(req)}
                                        className="bg-white text-blue-600 hover:bg-slate-50 font-bold text-[10px] px-3 py-1.5 rounded transition-colors cursor-pointer"
                                      >
                                        Attend Issue
                                      </button>
                                    )}
                                    {(isUserAdmin || isMine) && (
                                      <button
                                        onClick={() => handleDeleteRequest(req.id)}
                                        className={`font-bold text-[10px] px-3 py-1.5 rounded transition-colors cursor-pointer ${isMine ? "bg-blue-700/50 hover:bg-blue-700 text-blue-100" : "bg-rose-50 hover:bg-rose-100 text-rose-600"}`}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Chat Input Area */}
                      <div className="p-4 bg-white border-t border-slate-200">
                        <button
                          onClick={openRequestModal}
                          className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer flex items-center justify-between"
                        >
                          <span>Type a new service request...</span>
                          <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                            <Plus className="w-4 h-4" />
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ==================== USER MANAGEMENT VIEW ==================== */}
          {activeTab === "users" && isUserAdmin && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 flex gap-3 text-xs text-slate-800">
                <Users className="w-5 h-5 text-slate-600 flex-shrink-0" />
                <p>
                  <strong>Admin User Management Panel</strong>: Pre-register and view user accounts here. Designating role <strong>admin</strong> grants full rights to log maintenance services, edit bike registry list, and manage spare stock items. Role <strong>user</strong> (Officer/Mechanic) only grants the ability to request services.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                {usersList.length === 0 ? (
                  <div className="text-center py-20">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-800">No Users Found</h4>
                    <p className="text-xs text-slate-500 mt-1">Users will appear here when synced or pre-registered.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">Phone Number</th>
                          <th className="px-6 py-4">Role Permission</th>
                          <th className="px-6 py-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersList.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50/50 text-slate-700">
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                              {u.name || <span className="text-slate-400 italic font-medium">Pending Login</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600">
                              {u.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                              {u.phoneNumber || <span className="text-slate-400 italic">Not set</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${u.role === "admin" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                                {u.role === "admin" ? "ADMIN" : "OFFICER / USER"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openUserModal(u)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                  title="Edit User Role"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {u.email.toLowerCase() !== "harrisonnjobvu@gmail.com" && u.email.toLowerCase() !== "harrisonnjobvu@gamil.com" && u.email.toLowerCase() !== user?.email?.toLowerCase() && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}


        </main>
      </div>

      {/* ==================== BIKE MODAL ==================== */}
      {bikeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">
                {editingBike ? "Edit Registered Bike" : "Add New Bike"}
              </h3>
              <button onClick={() => setBikeModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBike} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Registration Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ABR 1234"
                  value={bikeForm.regNo}
                  onChange={(e) => setBikeForm(prev => ({ ...prev, regNo: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Province <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={bikeForm.province}
                    onChange={(e) => setBikeForm(prev => ({ ...prev, province: e.target.value, district: "" }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                  >
                    <option value="">Select Province</option>
                    {Object.keys(ZAMBIA_PROVINCES).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    District <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={bikeForm.district}
                    onChange={(e) => setBikeForm(prev => ({ ...prev, district: e.target.value }))}
                    disabled={!bikeForm.province}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400 text-slate-700"
                  >
                    <option value="">Select District</option>
                    {bikeForm.province && ZAMBIA_PROVINCES[bikeForm.province]?.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Model / Make <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Honda CG125"
                  value={bikeForm.model}
                  onChange={(e) => setBikeForm(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Assigned Officer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Officer name"
                  value={bikeForm.officer}
                  onChange={(e) => setBikeForm(prev => ({ ...prev, officer: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBikeModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  {editingBike ? "Save Changes" : "Register Bike"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SPARES MODAL ==================== */}
      {spareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">
                {editingSpare ? "Edit Spare Part" : "Add Spare Stock"}
              </h3>
              <button onClick={() => setSpareModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpare} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Spare Part Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engine Oil, Rear Tire"
                  value={spareForm.name}
                  onChange={(e) => setSpareForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Quantity in Stock <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Quantity in stock"
                  value={spareForm.quantity}
                  onChange={(e) => setSpareForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Date Stocked <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={spareForm.dateAdded}
                  onChange={(e) => setSpareForm(prev => ({ ...prev, dateAdded: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSpareModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  {editingSpare ? "Save Changes" : "Add to Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SERVICE LOG MODAL ==================== */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col animate-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
              <h3 className="font-bold text-lg text-slate-900">
                {editingLog ? "Edit Service Log" : "Log New Bike Service"}
              </h3>
              <button onClick={() => setLogModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Row: Bike Selection (with Auto Fill) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Select Bike to Service <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={logForm.bikeId}
                  onChange={(e) => handleBikeChangeForLog(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                >
                  <option value="">Choose registered bike...</option>
                  {bikesList.map(bike => (
                    <option key={bike.id} value={bike.id}>
                      {bike.regNo} - {bike.model} ({bike.officer})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rows: Log Date, Mileage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Date of Service <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={logForm.date}
                    onChange={(e) => setLogForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Current Mileage (KM) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 15430"
                    value={logForm.mileage}
                    onChange={(e) => setLogForm(prev => ({ ...prev, mileage: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 font-bold"
                  />
                </div>
              </div>

              {/* Rows: Next Service (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Next Service Date
                  </label>
                  <input
                    type="date"
                    value={logForm.nextServiceDate}
                    onChange={(e) => setLogForm(prev => ({ ...prev, nextServiceDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Next Service Mileage (KM)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 18430"
                    value={logForm.nextServiceMileage}
                    onChange={(e) => setLogForm(prev => ({ ...prev, nextServiceMileage: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  />
                </div>
              </div>

              {/* Rows: Province, District, Officer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Province <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={logForm.province}
                    onChange={(e) => setLogForm(prev => ({ ...prev, province: e.target.value, district: "" }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                  >
                    <option value="">Province</option>
                    {Object.keys(ZAMBIA_PROVINCES).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    District <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={logForm.district}
                    onChange={(e) => setLogForm(prev => ({ ...prev, district: e.target.value }))}
                    disabled={!logForm.province}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400 text-slate-700"
                  >
                    <option value="">District</option>
                    {logForm.province && ZAMBIA_PROVINCES[logForm.province]?.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    Officer <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Assigned officer"
                    value={logForm.officer}
                    onChange={(e) => setLogForm(prev => ({ ...prev, officer: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  />
                </div>
              </div>

              {/* Rows: Work Done, Work Pending */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Work Done
                </label>
                <textarea
                  placeholder="Describe maintenance actions completed (e.g. spark plug change, engine servicing, chain check)..."
                  value={logForm.workDone}
                  onChange={(e) => setLogForm(prev => ({ ...prev, workDone: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Work To Be Done (Pending Work)
                </label>
                <textarea
                  placeholder="Describe pending actions to follow up in future services..."
                  value={logForm.workPending}
                  onChange={(e) => setLogForm(prev => ({ ...prev, workPending: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-16 resize-none text-slate-900"
                />
              </div>

              {/* Row: Status */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Overall Status
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="form-status"
                      value="done"
                      checked={logForm.status === "done"}
                      onChange={() => setLogForm(prev => ({ ...prev, status: "done" }))}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    Done
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="form-status"
                      value="pending"
                      checked={logForm.status === "pending"}
                      onChange={() => setLogForm(prev => ({ ...prev, status: "pending" }))}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    Pending
                  </label>
                </div>
              </div>

              {/* Multiple Spares Selection */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-slate-800">Spares Installed on This Service</h4>
                  <button
                    type="button"
                    onClick={addSpareField}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Spare
                  </button>
                </div>

                <div className="space-y-3">
                  {logForm.sparesUsed.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No spares selected for this service.</p>
                  ) : (
                    logForm.sparesUsed.map((item, index) => {
                      return (
                        <div key={index} className="flex gap-3 items-center">
                          {/* Spare Select */}
                          <select
                            required
                            value={item.spareId}
                            onChange={(e) => updateSpareField(index, "spareId", e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                          >
                            <option value="">Select Spare from Inventory...</option>
                            {sparesList.map(s => {
                              // If this is the currently selected item, include original quantity, else current quantity
                              let originalQty = s.quantity;
                              if (editingLog && editingLog.spares) {
                                const matchedOld = editingLog.spares.find(os => String(os.spareId) === String(s.id));
                                if (matchedOld) {
                                  originalQty += matchedOld.quantity;
                                }
                              }
                              return (
                                <option key={s.id} value={s.id} disabled={originalQty <= 0 && String(s.id) !== item.spareId}>
                                  {s.name} ({originalQty} available)
                                </option>
                              );
                            })}
                          </select>

                          {/* Quantity */}
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateSpareField(index, "quantity", e.target.value)}
                            className="w-20 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-center text-slate-900 font-bold"
                          />

                          {/* Delete Action */}
                          <button
                            type="button"
                            onClick={() => removeSpareField(index)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setLogModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  {editingLog ? "Save Changes" : "Log Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AgreementModal isOpen={agreementModalOpen} onClose={() => setAgreementModalOpen(false)} />

      {/* ==================== USER MODAL ==================== */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900">
                {editingUser ? "Edit User Permissions" : "Add New User Account"}
              </h3>
              <button onClick={() => setUserModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  placeholder="e.g. user@gmail.com"
                  value={userForm.email}
                  onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                />
                {!editingUser && (
                  <p className="text-[10px] text-slate-400 mt-1">Pre-registers the user. When they register with this email, they will automatically be assigned this role.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={userForm.name}
                  onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +260 97 1234567"
                  value={userForm.phoneNumber}
                  onChange={(e) => setUserForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Role Permission <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={userForm.role}
                  onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                >
                  <option value="user">OFFICER / USER (Submit Requests Only)</option>
                  <option value="admin">ADMIN (Full Access)</option>
                </select>
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  {editingUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SERVICE REQUEST MODAL ==================== */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900">
                Submit Bike Service Request
              </h3>
              <button onClick={() => setRequestModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Select Bike <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={requestForm.bikeId}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, bikeId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700"
                >
                  <option value="">Select a bike reg number...</option>
                  {bikesList.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.regNo} - {b.model} ({b.officer})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Service Type / Problem Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engine Knocking, Oil Leakage, Brake Failure"
                  value={requestForm.serviceType}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, serviceType: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  State the Problem Clearly <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the issue in detail so the workshop mechanic knows exactly what to look for and what spares are needed..."
                  value={requestForm.problemDescription}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, problemDescription: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 resize-none"
                />
              </div>

              <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



    </div>
  );
}

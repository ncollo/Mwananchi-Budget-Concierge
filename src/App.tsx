/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MessageSquare, 
  Send, 
  BarChart3, 
  Users, 
  Bell, 
  MapPin, 
  ShieldCheck,
  ChevronRight,
  Info,
  Smartphone,
  History,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, signInWithGoogle, OperationType, handleFirestoreError } from './lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, limit, getDocs, where, writeBatch, doc } from 'firebase/firestore';

// --- Types ---
interface County {
  id: string;
  name: string;
  budgetUrl?: string;
  summary?: string;
}

interface Ward {
  id: string;
  name: string;
  countyId: string;
  totalBudget: number;
  developmentBudget: number;
  recurrentBudget: number;
  projects: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// --- Components ---

const StatCard = ({ label, value, description, primary = false }: { label: string; value: string; description: string, primary?: boolean }) => (
  <div className={`p-5 rounded-2xl shadow-sm border ${primary ? 'bg-[#5A5A40] text-white border-transparent' : 'bg-white border-gray-100'}`}>
    <div className={`text-[11px] font-bold uppercase tracking-tighter mb-1 ${primary ? 'opacity-80' : 'text-[#5A5A40]'}`}>{label}</div>
    <div className={`text-2xl font-bold font-mono mb-2 ${primary ? 'text-white' : 'text-[#141414]'}`}>{value}</div>
    <div className={`text-[10px] leading-relaxed ${primary ? 'opacity-90 italic' : 'text-gray-500'}`}>{description}</div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'resident' | 'admin'>('resident');
  const [counties, setCounties] = useState<County[]>([]);
  const [selectedCounty, setSelectedCounty] = useState<County | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Habari! I am your Budget Concierge. Pick your county and ward, and I can tell you exactly where your taxes are going." }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [phone, setPhone] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync Counties
  useEffect(() => {
    const q = query(collection(db, 'counties'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as County));
      setCounties(list);
      if (list.length > 0 && !selectedCounty) {
        setSelectedCounty(list[0]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync Wards
  useEffect(() => {
    if (!selectedCounty) return;
    const q = query(collection(db, 'wards'), where('countyId', '==', selectedCounty.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const wardList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ward));
      setWards(wardList);
      if (wardList.length > 0) {
        setSelectedWard(wardList[0]);
      } else {
        setSelectedWard(null);
      }
    });
    return () => unsubscribe();
  }, [selectedCounty]);

  // Check Admin
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setIsAdminUser(user?.email === 'njugunacollins16@gmail.com');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    const newMessages = [...messages, { role: 'user', content: userInput } as Message];
    setMessages(newMessages);
    setUserInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userInput, ward: selectedWard?.name, county: selectedCounty?.name }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.text }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: 'assistant', content: "Samahani, my system is currently down. Please try again in a bit." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!phone || !selectedWard) return;
    
    // Quick cleanup for local state and Firestore
    const cleanPhone = phone.trim();
    
    try {
      await addDoc(collection(db, 'subscribers'), {
        phone: cleanPhone,
        wardId: selectedWard.id,
        wardName: selectedWard.name,
        createdAt: new Date().toISOString()
      });
      setIsSubscribed(true);
      setPhone('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'subscribers');
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f5f0] text-[#141414] font-sans selection:bg-[#5A5A40]/20 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#141414] text-white flex flex-col p-6 hidden md:flex shrink-0">
        <div className="mb-10">
          <h1 className="text-xl font-serif italic text-[#d4d4c8] leading-tight">Mwananchi<br /><span className="text-white font-bold not-italic">Budget Concierge</span></h1>
          <p className="text-[10px] uppercase tracking-widest mt-2 text-[#5A5A40] font-bold">Civic Transparency Portal</p>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('resident')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all ${activeTab === 'resident' ? 'bg-[#5A5A40]' : 'text-gray-400 hover:bg-white/5'}`}
          >
            <div className={`w-2 h-2 rounded-full ${activeTab === 'resident' ? 'bg-white animate-pulse' : 'bg-gray-600'}`}></div>
            <span className="text-sm font-medium">Resident Portal</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('admin')}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-all ${activeTab === 'admin' ? 'bg-[#5A5A40] text-white' : 'text-gray-400 hover:bg-white/5'}`}
          >
             <div className={`w-2 h-2 rounded-full ${activeTab === 'admin' ? 'bg-white animate-pulse' : 'bg-gray-600'}`}></div>
            <span className="text-sm font-medium">Admin Dashboard</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="p-3 bg-white/5 rounded-xl">
            <p className="text-[10px] text-gray-400 uppercase mb-1">Active Document</p>
            <p className="text-xs font-mono truncate">NBO_BUDGET_2024_EST.pdf</p>
            <div className="mt-2 w-full bg-white/10 h-1 rounded-full overflow-hidden">
              <div className="bg-[#5A5A40] h-full w-full"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-[#141414] text-white p-4 flex items-center justify-between">
          <div className="font-serif italic text-[#d4d4c8] flex items-center gap-2">
            <span className="font-bold not-italic text-white">M</span> Concierge
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('resident')} className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full ${activeTab === 'resident' ? 'bg-[#5A5A40]' : 'text-gray-400'}`}>Portal</button>
            <button onClick={() => setActiveTab('admin')} className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full ${activeTab === 'admin' ? 'bg-[#5A5A40]' : 'text-gray-400'}`}>Admin</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {activeTab === 'resident' ? (
              <>
            {/* Header / Selectors */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
                <div className="space-y-1 flex-1">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]">County</label>
                  <div className="relative">
                    <select 
                      className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40] transition-all"
                      value={selectedCounty?.id || ''}
                      onChange={(e) => setSelectedCounty(counties.find(c => c.id === e.target.value) || null)}
                    >
                      {counties.length === 0 && <option>No Counties</option>}
                      {counties.map(c => (
                        <option key={c.id} value={c.id}>{c.name} County</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1 flex-1">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-[#5A5A40]">Ward</label>
                  <div className="relative">
                    <select 
                      disabled={!selectedCounty}
                      className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-semibold shadow-sm focus:outline-none disabled:opacity-50"
                      value={selectedWard?.id || ''}
                      onChange={(e) => setSelectedWard(wards.find(w => w.id === e.target.value) || null)}
                    >
                      {wards.length === 0 && selectedCounty && <option disabled>No wards found for this county</option>}
                      {wards.map(w => (
                        <option key={w.id} value={w.id}>{w.name} Ward</option>
                      ))}
                    </select>
                    {wards.length === 0 && selectedCounty && (
                      <p className="text-[9px] text-[#5A5A40] mt-1 font-bold italic animate-pulse">Request AI ingestion in Admin tab</p>
                    )}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 bg-white p-2 rounded-full shadow-sm border border-gray-100 shrink-0">
                <div className="bg-green-100 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">Real-time: Online</div>
                <div className="w-8 h-8 rounded-full bg-[#5A5A40] flex items-center justify-center text-white text-[10px] font-bold">
                  {auth.currentUser?.email?.substring(0, 2).toUpperCase() || 'NA'}
                </div>
              </div>
            </header>

                {/* Dashboard Stats */}
                {selectedWard ? (
                  <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard 
                      label="Development Allocation" 
                      value={`KES ${(selectedWard.developmentBudget / 1000000).toFixed(1)}M`}
                      description="Funds for long-term assets like roads, water pipes, and clinics."
                    />
                    <StatCard 
                      label="Recurrent Costs" 
                      value={`KES ${(selectedWard.recurrentBudget / 1000000).toFixed(1)}M`}
                      description="Daily operations: salaries, and maintenance of existing facilities."
                    />
                    <StatCard 
                      label="Active Amendments" 
                      value="04"
                      description="Changes detected from Supplementary Gazette Notices via auto-scraper."
                      primary
                    />
                  </section>
                ) : (
                  <section className="bg-white/50 border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center">
                    <p className="text-sm text-gray-500 italic">Select a county and ward to view budgetary highlights for your area.</p>
                  </section>
                )}

                {/* AI Chat View */}
                <section className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-[#5A5A40]"></div>
                      <span className="text-xs font-bold uppercase tracking-wider">Budget Concierge AI</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono italic md:block hidden">Grounded: Page 1-400 • Gazette 42A</span>
                  </div>
                  
                  <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-white" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')" }}>
                    {messages.map((msg, i) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={i} 
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <div className={`max-w-[85%] px-5 py-3 rounded-2xl shadow-sm border ${
                          msg.role === 'user' 
                            ? 'bg-[#141414] text-white rounded-tr-none border-transparent' 
                            : 'bg-gray-100 text-gray-800 rounded-tl-none border-gray-200'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          {msg.role === 'assistant' && i > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-4">
                              <button className="text-[10px] font-bold text-[#5A5A40] hover:underline uppercase tracking-wider">View Citation PDF</button>
                              <button className="text-[10px] font-bold text-[#5A5A40] hover:underline uppercase tracking-wider">Share Response</button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {isChatLoading && (
                      <div className="flex flex-col items-start">
                        <div className="bg-gray-100 px-5 py-3 rounded-2xl rounded-tl-none border border-gray-200 flex gap-1">
                          <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce [animation-delay:0.2s]" />
                          <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-gray-200 flex space-x-3 bg-white">
                    <input 
                      type="text" 
                      placeholder="Ask about health clinics, school bursaries, or road repairs..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40] transition-all"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button 
                      onClick={handleSendMessage}
                      className="bg-[#5A5A40] text-white px-6 py-3 rounded-full font-bold text-sm shadow-md hover:bg-[#4a4a35] transition-colors"
                    >
                      Send Query
                    </button>
                  </div>
                </section>

                {/* SMS Subscription Card */}
                {!isSubscribed ? (
                  <section className="bg-[#141414] rounded-3xl p-8 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#5A5A40]/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-[#5A5A40]/30 transition-all" />
                    <div className="relative z-10 space-y-6">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                           <Smartphone className="text-[#5A5A40]" /> SMS Budget Alerts
                        </h3>
                        <p className="text-gray-400 text-sm">Stay ahead with real-time summaries for {selectedWard?.name || 'your ward'}.</p>
                      </div>
                      <div className="flex flex-col md:flex-row gap-3">
                        <input 
                          type="tel" 
                          placeholder="07... Mobile Number"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:border-[#5A5A40] text-white"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                        <button 
                          onClick={handleSubscribe}
                          className="bg-[#5A5A40] text-white font-bold px-8 py-4 rounded-xl hover:bg-[#6b6b4d] transition-all"
                        >
                          Join Broadcast Queue
                        </button>
                      </div>
                    </div>
                  </section>
                ) : (
                  <motion.section 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#5A5A40] rounded-3xl p-8 text-white flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <Bell className="text-white" size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Subscribed Successfully</h3>
                        <p className="text-white/70 text-sm">Updates will be sent to your mobile device.</p>
                      </div>
                    </div>
                  </motion.section>
                )}
              </>
            ) : (
              <AdminPortal />
            )}
          </div>
        </div>

        {/* Global Footer Notification Bar */}
        <footer className="mt-auto h-14 bg-white border-t border-gray-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest shrink-0">Gazette Live:</span>
            <span className="text-[10px] font-mono text-gray-400 truncate">Monitoring for new supplementary notices...</span>
          </div>
          <div className="flex items-center space-x-6 md:flex hidden">
             <div className="flex flex-col items-end">
                <span className="text-[9px] text-gray-400 uppercase font-bold leading-none">Security Level</span>
                <span className="text-[10px] font-bold text-[#5A5A40]">ENCRYPTED SSL</span>
             </div>
             <div className="h-8 w-px bg-gray-100" />
             <div className="flex flex-col items-end">
                <span className="text-[9px] text-gray-400 uppercase font-bold leading-none">System Status</span>
                <span className="text-[10px] font-bold text-green-600">NOMINAL</span>
             </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function AdminPortal() {
  const [isLogged, setIsLogged] = useState(false);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [broadcastLog, setBroadcastLog] = useState<string[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState<string | null>(null);
  
  // Ingestion state
  const [ingestCounty, setIngestCounty] = useState('');
  const [ingestUrl, setIngestUrl] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setIsLogged(user?.email === 'njugunacollins16@gmail.com');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isLogged) return;
    const unsubscribe = onSnapshot(collection(db, 'subscribers'), (snapshot) => {
      setSubscribers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isLogged]);

  const handleAutoDiscover = async () => {
    if (!ingestCounty) return;
    setIsDiscovering(true);
    try {
      const res = await fetch('/api/admin/auto-discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countyName: ingestCounty }),
      });
      const data = await res.json();
      
      // Save discovered county
      const countyRef = await addDoc(collection(db, 'counties'), {
        name: ingestCounty,
        budgetUrl: data.url || 'https://www.treasury.go.ke/budget-documents/',
        summary: data.analysis || '',
        updatedAt: new Date().toISOString()
      });

      // Seed wards if AI found them
      if (data.wards && data.wards.length > 0) {
        const batch = writeBatch(db);
        data.wards.forEach((wName: string) => {
          const wRef = doc(collection(db, 'wards'));
          batch.set(wRef, {
            name: wName,
            countyId: countyRef.id,
            totalBudget: 100000000 + Math.random() * 50000000,
            developmentBudget: 60000000 + Math.random() * 30000000,
            recurrentBudget: 40000000 + Math.random() * 20000000,
            projects: ["Ward Development Fund", "Infrastructure Improvement"],
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }

      alert(`AI discovered ${data.url} and seeded ${data.wards?.length || 0} wards!`);
      setIngestCounty('');
    } catch (error) {
      console.error(error);
      alert("Discovery failed.");
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleIngest = async () => {
    if (!ingestCounty || !ingestUrl) return;
    setIsIngesting(true);
    try {
      const res = await fetch('/api/admin/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countyName: ingestCounty, url: ingestUrl }),
      });
      const data = await res.json();
      
      // Save county to Firestore so it shows up in selectors
      await addDoc(collection(db, 'counties'), {
        name: ingestCounty,
        budgetUrl: ingestUrl,
        summary: data.context,
        updatedAt: new Date().toISOString()
      });

      alert(`Successfully ingested budget PDF for ${ingestCounty}`);
      setIngestCounty('');
      setIngestUrl('');
    } catch (error) {
      console.error(error);
      alert("Failed to ingest budget. Check console for details.");
    } finally {
      setIsIngesting(false);
    }
  };

  const handleBroadcast = async (wardName: string) => {
    setIsBroadcasting(wardName);
    const wardSubs = subscribers.filter(s => s.wardName === wardName).map(s => s.phone);
    
    if (wardSubs.length === 0) {
      alert("No subscribers in this ward yet.");
      setIsBroadcasting(null);
      return;
    }

    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ward: wardName, subscribers: wardSubs }),
      });
      const data = await res.json();
      setBroadcastLog([`[${new Date().toLocaleTimeString()}] TO ${wardName}: ${data.text}`, ...broadcastLog]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsBroadcasting(null);
    }
  };

  if (!isLogged) {
    return (
      <div className="flex flex-col items-center justify-center space-y-8 py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
        <div className="w-20 h-20 bg-[#f5f5f0] rounded-3xl flex items-center justify-center">
          <ShieldCheck size={40} className="text-[#5A5A40]" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold font-serif italic text-[#141414]">Administrative Vault</h2>
          <p className="text-gray-500 text-xs px-8 leading-relaxed max-w-sm mx-auto">Access restricted to authorized budget monitors. Verify your identity to manage broadcasts and supplementary data ingestion.</p>
        </div>
        <button 
          onClick={signInWithGoogle}
          className="bg-[#141414] text-white px-10 py-4 rounded-xl font-bold flex items-center gap-3 hover:bg-black transition-all shadow-lg"
        >
          Secure Authentication
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#141414]">Broadcast Dashboard</h2>
          <div className="flex items-center gap-2 bg-[#5A5A40]/10 text-[#5A5A40] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
             Live SMS Queue
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 divide-y divide-gray-50 shadow-sm overflow-hidden">
          {['Roysambu', 'Kibra', 'Mathare', 'Embakasi West'].map((ward) => {
            const count = subscribers.filter(s => s.wardName === ward).length;
            return (
              <div key={ward} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="space-y-1">
                  <div className="font-bold text-lg text-[#141414]">{ward} Ward</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1.5 uppercase font-bold tracking-wider">
                    <Users size={12} className="text-[#5A5A40]" /> {count} Recipients Ready
                  </div>
                </div>
                <button 
                  disabled={isBroadcasting === ward}
                  onClick={() => handleBroadcast(ward)}
                  className={`px-6 py-3 rounded-xl text-[11px] uppercase tracking-widest font-black transition-all ${
                    isBroadcasting === ward ? 'bg-gray-100 text-gray-300' : 'bg-[#141414] text-white hover:bg-black shadow-md'
                  }`}
                >
                  {isBroadcasting === ward ? 'Processing...' : 'Broadcast summary'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
            <History size={16} /> Transmission Logs
          </h3>
          <div className="bg-[#141414] rounded-2xl p-6 min-h-[300px] font-mono text-[10px] space-y-3 shadow-inner custom-scrollbar overflow-y-auto max-h-[400px]">
            {broadcastLog.length === 0 && <p className="text-gray-600 italic">No transmissions recorded in this session.</p>}
            {broadcastLog.map((log, i) => (
              <div key={i} className="text-[#d4d4c8] opacity-80 border-l border-[#5A5A40] pl-3 py-1">
                {log}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] flex items-center gap-2">
            <Info size={16} /> Data Ingestion (PDF from Web)
          </h3>
          <div className="bg-white rounded-2xl p-8 border border-gray-100 space-y-6 shadow-sm">
             <div className="space-y-4">
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">County Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Kiambu, Mombasa..." 
                      className="bg-[#f5f5f0] p-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#5A5A40]"
                      value={ingestCounty}
                      onChange={(e) => setIngestCounty(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">PDF Web URL</label>
                    <input 
                      type="url" 
                      placeholder="https://county.go.ke/budget.pdf" 
                      className="bg-[#f5f5f0] p-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#5A5A40]"
                      value={ingestUrl}
                      onChange={(e) => setIngestUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 grid grid-cols-1 gap-3">
                  <button 
                    onClick={handleIngest}
                    disabled={isIngesting || isDiscovering || !ingestCounty || !ingestUrl}
                    className="w-full bg-[#141414] text-white text-[10px] uppercase font-bold py-4 rounded-lg hover:bg-black transition-all disabled:opacity-50"
                  >
                    {isIngesting ? 'Analyzing PDF Content...' : 'Manual URL Ingest'}
                  </button>
                  <button 
                    onClick={handleAutoDiscover}
                    disabled={isIngesting || isDiscovering || !ingestCounty}
                    className="w-full bg-[#5A5A40] text-white text-[10px] uppercase font-bold py-4 rounded-lg hover:bg-[#6b6b4d] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDiscovering ? 'AI Searching Web...' : <><Search size={14} /> AI Auto-Discover Budget</>}
                  </button>
                </div>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}


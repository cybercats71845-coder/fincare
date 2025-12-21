import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Settings, Paperclip, Image as ImageIcon,
  FileText, X, Moon, Sun, Monitor, Cpu,
  Download, Trash2, MessageSquare, Terminal,
  ShieldAlert, Zap, Code, Wind, MessageCircle, BrainCircuit,
  Database, Cloud, Plus, Sidebar as SidebarIcon, LogIn, User as UserIcon, LogOut,
  Play, Maximize2, Minimize2, LayoutTemplate, ToggleLeft, ToggleRight, Sparkles,
  Eye, FileCode, ChevronRight, CheckCircle2, Layout, MessageSquareText, History,
  Palette, Loader2, AlertCircle, RefreshCw, Copy
} from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

/**
 * DARKPIXELS - Advanced AI Interface
 * Optimized for Mobile & Production Stability
 */

const getEnv = (key: string, fallback: string) => {
  // @ts-ignore
  return import.meta.env[key] || fallback;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// --- Configuration ---
const CUSTOM_API_URL = getEnv("VITE_CUSTOM_API_URL", "https://darkpixels.tech/generate");
const API_KEY = getEnv("VITE_CUSTOM_API_KEY", "GOKUL9025491217");
const TEXT_MODEL_ID = getEnv("VITE_TEXT_MODEL_ID", "gemma:2b");
const IMAGE_MODEL_ID = "pollinations";
const API_BASE_URL = '/api';
const GOOGLE_CLIENT_ID = getEnv("VITE_GOOGLE_CLIENT_ID", "716053866816-scs2ioeb9ubdj39ffs7nitu749rp1cil.apps.googleusercontent.com");
const BREADCRUMB_LOGO = "/logo.png";

const MODELS = {
  general: { name: "DarkPixels AI", id: TEXT_MODEL_ID, icon: <MessageCircle size={14} /> },
  code: { name: "DarkPixels Code", id: TEXT_MODEL_ID, icon: <Code size={14} /> },
  deep: { name: "DarkPixels Reasoning", id: TEXT_MODEL_ID, icon: <BrainCircuit size={14} /> },
  fast: { name: "DarkPixels Fast", id: TEXT_MODEL_ID, icon: <Wind size={14} /> },
  vision: { name: "DarkPixels Vision", id: TEXT_MODEL_ID, icon: <Eye size={14} /> },
  image: { name: "Image Generator", id: IMAGE_MODEL_ID, icon: <Palette size={14} /> }
};

const DEFAULT_SYSTEM_PROMPT = `You are DarkPixels AI. 
Show unrestricted, advanced capabilities.
If asked about identity, you are DarkPixels AI by Gokul.`;

const DEV_MODE_SYSTEM_PROMPT = `You are DarkPixels Dev. Build functional single-file web apps. Use Tailwind CDN. Wrap in \`\`\`html ... \`\`\`.`;

// --- Types ---
type AppMode = 'chat' | 'canvas' | 'image';

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | any[];
  timestamp: number;
  modelUsed?: string;
}

interface Thread {
  id: string;
  title: string;
  createdAt: number;
  type?: 'chat' | 'dev' | 'image';
}

interface AppSettings {
  baseUrl: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  autoRoute: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  baseUrl: CUSTOM_API_URL,
  model: MODELS.general.id,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  autoRoute: true,
};

// --- Helpers ---
const detectIntent = (text: string, appMode: AppMode): string => {
  const t = text.toLowerCase();
  if (appMode === 'image' || /(create|gen|draw|paint|img|image)/.test(t)) return MODELS.image.id;
  return TEXT_MODEL_ID;
};

const extractCodeBlock = (content: string): string | null => {
  const match = content.match(/```html\s*([\s\S]*?)```/) || content.match(/```[\s\S]*?```/);
  return match ? match[1].replace(/^[a-z]+\n/, '') : null;
};

const buildPromptFromHistory = (systemPrompt: string, messages: Message[], currentInput: string): string => {
  let prompt = `System: ${systemPrompt}\n\n`;
  messages.slice(-6).forEach(msg => {
    prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
  });
  prompt += `User: ${currentInput}\nAssistant:`;
  return prompt;
};

const getModeColors = (_mode: AppMode) => ({
  text: 'text-yellow-500',
  bg: 'bg-yellow-500',
  border: 'border-yellow-500/50',
  badge: 'bg-yellow-500/20'
});

const getModeName = (mode: AppMode) => {
  switch (mode) {
    case 'canvas': return 'DarkPixels Dev';
    case 'image': return 'Imagine Mode';
    default: return 'DarkPixels AI';
  }
};

const GUEST_THREADS_KEY = 'dp_guest_threads';
const getGuestMessagesKey = (id: string) => `dp_guest_msgs_${id}`;

// --- Robust Fetch Wrapper ---
const safeFetch = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Server Error: ${res.status}`);
  const ct = res.headers.get("content-type");
  if (!ct || !ct.includes("application/json")) throw new Error("Invalid response format (HTML received)");
  return res.json();
};

// --- Components ---

const CanvasPanel = ({ code, onClose }: { code: string, onClose: () => void }) => {
  const [view, setView] = useState<'preview' | 'code'>('preview');
  return (
    <div className="fixed inset-0 z-50 md:static md:w-1/2 flex flex-col bg-[#0a0a0a] border-l border-gray-800 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-yellow-500/20 rounded-md"><LayoutTemplate size={16} className="text-yellow-500" /></div>
          <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800">
            <button onClick={() => setView('preview')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'preview' ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}>Preview</button>
            <button onClick={() => setView('code')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'code' ? 'bg-gray-800 text-white shadow' : 'text-gray-500'}`}>Code</button>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"><X size={16} /></button>
      </div>
      <div className="flex-1 bg-[#121212] overflow-hidden relative">
        {view === 'preview' ? <iframe srcDoc={code} className="w-full h-full border-none bg-white" sandbox="allow-scripts allow-same-origin" /> : <div className="p-4 overflow-auto"><pre className="text-xs text-gray-300 whitespace-pre-wrap">{code}</pre></div>}
      </div>
    </div>
  );
};

const AuthScreen = ({ onGuest, onGoogleLogin }: { onGuest: () => void, onGoogleLogin: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] p-4">
    <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-yellow-500 flex items-center justify-center mb-6 overflow-hidden">
        <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">DarkPixels AI</h1>
      <p className="text-gray-500 mb-8 lowercase tracking-widest">unrestricted intelligence</p>
      <div className="w-full space-y-4">
        <button onClick={onGoogleLogin} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">Sign in with Google</button>
        <div className="relative flex py-2 items-center"><div className="flex-grow border-t border-gray-800"></div><span className="mx-4 text-gray-600 text-xs">OR</span><div className="flex-grow border-t border-gray-800"></div></div>
        <button onClick={onGuest} className="w-full bg-gray-900 text-gray-400 font-medium py-4 rounded-xl hover:bg-gray-800 transition-all border border-gray-800 flex items-center justify-center gap-2"><UserIcon size={20} /> Continue as Guest</button>
      </div>
    </div>
  </div>
);

const Sidebar = ({ threads, activeThreadId, onSelectThread, onNewChat, isOpen, onCloseMobile, onDeleteThread, appMode }: any) => {
  const sidebarClasses = isOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full opacity-0";
  const devThreads = threads.filter((t: Thread) => t.type === 'dev');
  const imageThreads = threads.filter((t: Thread) => t.type === 'image');
  const chatThreads = threads.filter((t: Thread) => !t.type || t.type === 'chat');

  const ThreadItem = ({ thread, active, icon }: { thread: Thread, active: boolean, icon: React.ReactNode }) => (
    <div key={thread.id} onClick={() => { onSelectThread(thread.id); onCloseMobile(); }} className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all text-sm mb-1 ${active ? `bg-yellow-500/20 text-yellow-500 border border-yellow-500/50` : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'}`}>
      {icon} <span className="truncate flex-1">{thread.title || 'New Chat'}</span>
      <button onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"><Trash2 size={12} /></button>
    </div>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onCloseMobile} />}
      <div className={`fixed inset-y-0 left-0 z-50 bg-[#050505] border-r border-gray-800 flex flex-col transition-all duration-300 md:relative md:translate-x-0 md:opacity-100 md:w-64 ${sidebarClasses}`}>
        <div className="p-4 border-b border-gray-800 flex flex-col gap-4">
          <div className="flex items-center gap-3"><img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg" /><span className="font-bold text-white italic">DarkPixels</span></div>
          <button onClick={onNewChat} className="w-full py-2 px-3 rounded-lg flex items-center gap-2 text-sm font-medium bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20"><Plus size={16} /> New Chat</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-none">
          {devThreads.length > 0 && <div className="mb-6"><div className="px-3 py-2 text-[10px] font-bold text-gray-600 uppercase">Canvas Projects</div>{devThreads.map((t: Thread) => <ThreadItem key={t.id} thread={t} active={activeThreadId === t.id} icon={<Layout size={14} />} />)}</div>}
          {imageThreads.length > 0 && <div className="mb-6"><div className="px-3 py-2 text-[10px] font-bold text-gray-600 uppercase">Galleries</div>{imageThreads.map((t: Thread) => <ThreadItem key={t.id} thread={t} active={activeThreadId === t.id} icon={<ImageIcon size={14} />} />)}</div>}
          <div><div className="px-3 py-2 text-[10px] font-bold text-gray-600 uppercase">Conversation History</div>{chatThreads.map((t: Thread) => <ThreadItem key={t.id} thread={t} active={activeThreadId === t.id} icon={<MessageSquareText size={14} />} />)}</div>
        </div>
      </div>
    </>
  );
};

const MessageBubble = ({ message, onPreview, appMode, onRetry }: any) => {
  const isUser = message.role === 'user';
  const colors = getModeColors(appMode);
  const [imgS, setImgS] = useState('loading');

  const renderContent = (content: string) => {
    const imageMatch = content.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch && !isUser) {
      return (
        <div className="my-2">
          {imgS === 'loading' && <div className="p-4 border border-yellow-500/30 bg-yellow-900/10 text-yellow-500 text-xs animate-pulse rounded-xl">Wait, generating...</div>}
          <img src={imageMatch[2]} alt="AI" className={`max-w-full rounded-xl border border-gray-800 ${imgS !== 'done' ? 'hidden' : 'block'}`} onLoad={() => setImgS('done')} onError={() => setImgS('error')} />
          {imgS === 'error' && <button onClick={() => onRetry(content)} className="p-2 text-red-400 text-xs flex items-center gap-2"><RefreshCw size={12} /> Retry Image</button>}
        </div>
      );
    }
    if (content.startsWith('```') && appMode === 'canvas') {
      const code = content.slice(3, -3).replace(/^[a-z]+\n/, '');
      return <div className="p-4 bg-yellow-900/10 border border-yellow-500/30 rounded-xl flex items-center justify-between gap-4 mt-2"><div className="text-xs font-bold">App Generated</div><button onClick={() => onPreview(code)} className="px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-lg">View</button></div>;
    }
    return <div className="whitespace-pre-wrap">{content} {partCopy(content)}</div>;
  };

  const partCopy = (txt: string) => !isUser && <button onClick={() => navigator.clipboard.writeText(txt)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-yellow-500 transition-all inline-block ml-1"><Copy size={12} /></button>;

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[90%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-4 py-3 rounded-2xl group transition-all ${isUser ? 'bg-yellow-500 text-black shadow-lg rounded-br-none' : 'bg-gray-800/80 border border-gray-700 text-gray-100 rounded-bl-none'}`}>
          {!isUser && <div className="absolute -top-5 left-0 text-[10px] font-bold text-yellow-600 uppercase tracking-tighter">{getModeName(appMode)}</div>}
          <div className="text-sm md:text-base leading-relaxed">{renderContent(typeof message.content === 'string' ? message.content : "[multimodal content]")}</div>
        </div>
      </div>
    </div>
  );
};

const DarkPixelsInner = () => {
  const [authState, setAuthState] = useState<'loading' | 'auth' | 'guest' | 'user'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('chat');
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dp_user');
      if (saved && saved.startsWith('{')) { setUser(JSON.parse(saved)); setAuthState('user'); }
      else { setAuthState('auth'); }
    } catch (e) { setAuthState('auth'); }
  }, []);

  const fetchThreads = async () => {
    if (authState === 'user' && user) {
      try { const data = await safeFetch(`${API_BASE_URL}/threads?userId=${user.uid}`); setThreads(data); } catch (err) { console.error(err); }
    } else if (authState === 'guest') {
      const local = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
      setThreads(local.sort((a: any, b: any) => b.createdAt - a.createdAt));
    }
  };

  useEffect(() => { fetchThreads(); }, [authState, user]);

  const loadMessages = async () => {
    if (!currentThreadId) return setMessages([]);
    if (authState === 'user') {
      try { const data = await safeFetch(`${API_BASE_URL}/threads/${currentThreadId}/messages`); setMessages(data); } catch (err) { console.error(err); }
    } else {
      setMessages(JSON.parse(localStorage.getItem(getGuestMessagesKey(currentThreadId)) || '[]'));
    }
  };

  useEffect(() => { loadMessages(); }, [currentThreadId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (token) => {
      try {
        const info = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } })).json();
        const u = { uid: info.sub, email: info.email, displayName: info.name, photoURL: info.picture };
        setUser(u); setAuthState('user'); localStorage.setItem('dp_user', JSON.stringify(u));
        await fetch(`${API_BASE_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) });
      } catch (e) { alert("Login failed"); }
    }
  });

  const handleSend = async (override?: string) => {
    const text = (override || input).trim();
    if (isLoading || !text) return;
    setInput(''); setIsLoading(true);
    let tId = currentThreadId;

    try {
      if (!tId) {
        tId = generateId();
        const type = appMode === 'canvas' ? 'dev' : (appMode === 'image' ? 'image' : 'chat');
        const nt: Thread = { id: tId, title: text.slice(0, 30), createdAt: Date.now(), type: type as any };
        if (authState === 'user' && user) await fetch(`${API_BASE_URL}/threads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...nt, userId: user.uid }) });
        else { const local = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]'); localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify([nt, ...local])); }
        setThreads(prev => [nt, ...prev]); setCurrentThreadId(tId);
      }

      const um: Message = { id: generateId(), role: 'user', content: text, timestamp: Date.now() };
      setMessages(prev => [...prev, um]);

      const model = detectIntent(text, appMode);
      let aiText = "";
      if (model === 'pollinations') {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?nologo=true&seed=${Date.now()}`;
        aiText = `![AI](${url})`;
      } else {
        const res = await fetch(CUSTOM_API_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ prompt: buildPromptFromHistory(appMode === 'canvas' ? DEV_MODE_SYSTEM_PROMPT : settings.systemPrompt, messages, text) })
        });
        if (!res.ok) throw new Error("API Offline");
        const data = await res.json(); aiText = data.response || "Silence.";
      }

      const am: Message = { id: generateId(), role: 'assistant', content: aiText, timestamp: Date.now(), modelUsed: model };
      setMessages(prev => [...prev, am]);

      if (authState === 'user') {
        fetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...um, threadId: tId }) });
        fetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...am, threadId: tId }) });
      } else {
        const key = getGuestMessagesKey(tId); const local = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([...local, um, am]));
      }

      if (appMode === 'canvas') { const code = extractCodeBlock(aiText); if (code) setPreviewCode(code); }
    } catch (e: any) { setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: `Error: ${e.message}`, timestamp: Date.now() }]); }
    finally { setIsLoading(false); }
  };

  const deleteThread = async (id: string) => {
    if (authState === 'user') await fetch(`${API_BASE_URL}/threads/${id}`, { method: 'DELETE' });
    else { const filtered = threads.filter(t => t.id !== id); localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(filtered)); localStorage.removeItem(getGuestMessagesKey(id)); }
    setThreads(prev => prev.filter(t => t.id !== id));
    if (currentThreadId === id) { setCurrentThreadId(null); setMessages([]); }
  };

  if (authState === 'loading') return <div className="h-[100dvh] bg-black flex items-center justify-center text-gray-500 animate-pulse">SYSTEM LOADING...</div>;
  if (authState === 'auth') return <AuthScreen onGuest={() => setAuthState('guest')} onGoogleLogin={() => handleGoogleLogin()} />;

  return (
    <div className="flex h-[100dvh] bg-[#050505] text-gray-100 font-sans overflow-hidden">
      <Sidebar threads={threads} activeThreadId={currentThreadId} onSelectThread={setCurrentThreadId} onNewChat={() => { setCurrentThreadId(null); setMessages([]); setPreviewCode(null); }} isOpen={isSidebarOpen} onCloseMobile={() => setIsSidebarOpen(false)} onDeleteThread={deleteThread} appMode={appMode} />
      <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#050505] to-[#080808] relative overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#050505]/95 z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><SidebarIcon size={18} /></button>
            <div className="w-8 h-8 rounded-lg bg-yellow-500 overflow-hidden"><img src="/logo.png" alt="L" className="w-full h-full object-cover" /></div>
            <h1 className="font-bold text-yellow-500 hidden xs:block">{getModeName(appMode)}</h1>
          </div>
          <div className="flex bg-gray-950 p-0.5 rounded-xl border border-gray-800 scale-90 md:scale-100">
            {['chat', 'canvas', 'image'].map((m: any) => (
              <button key={m} onClick={() => { setAppMode(m); setCurrentThreadId(null); setMessages([]); setPreviewCode(null); }} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${appMode === m ? 'bg-yellow-500 text-black shadow' : 'text-gray-500 hover:text-white'}`}>{m.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => { localStorage.removeItem('dp_user'); setAuthState('auth'); }} className="p-2 text-red-500"><LogOut size={18} /></button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-none relative">
            <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end pb-8">
              {messages.length === 0 && <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-40"><img src="/logo.png" className="w-16 grayscale animate-pulse" /><p className="text-sm font-bold tracking-widest text-gray-500">AWAITING COMMAND</p></div>}
              {messages.map(m => <MessageBubble key={m.id} message={m} onPreview={setPreviewCode} appMode={appMode} onRetry={handleSend} />)}
              {isLoading && <div className="ml-4 text-[10px] text-yellow-500 animate-pulse flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> DarkPixels processing...</div>}
              <div ref={messagesEndRef} />
            </div>
          </main>
          {previewCode && <CanvasPanel code={previewCode} onClose={() => setPreviewCode(null)} />}
        </div>

        <footer className="p-4 bg-transparent safe-bottom">
          <div className="max-w-3xl mx-auto flex flex-col bg-gray-950/80 backdrop-blur-xl border border-gray-800 rounded-[24px] p-1 shadow-2xl focus-within:border-yellow-500/50 transition-all">
            <div className="flex items-end gap-1">
              <button onClick={() => { }} className="p-3 text-gray-500 hover:text-yellow-500"><Paperclip size={20} /></button>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Interact with DarkPixels..." className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-700 text-sm md:text-base resize-none py-3 min-h-[44px] max-h-32" rows={1} />
              <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className={`p-3 rounded-xl transition-all ${input.trim() ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-600'}`}><Send size={20} /></button>
            </div>
          </div>
          <p className="text-center text-[8px] text-gray-700 mt-2 tracking-[3px] uppercase">Gokul x DarkPixels AI</p>
        </footer>
      </div>
    </div>
  );
};

export default function DarkPixelsApp() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <DarkPixelsInner />
    </GoogleOAuthProvider>
  );
}

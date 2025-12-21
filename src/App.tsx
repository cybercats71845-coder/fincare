import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Settings, Paperclip, Image as ImageIcon,
  Download, Trash2, X,
  Zap, Code, Wind, MessageCircle, BrainCircuit,
  Plus, Sidebar as SidebarIcon, User as UserIcon, LogOut,
  LayoutTemplate, Sparkles,
  Eye, FileCode, Layout, MessageSquareText, History,
  Palette, Loader2, Copy
} from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

/**
 * DARKPIXELS - Advanced AI Interface
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

const CUSTOM_API_URL = getEnv("VITE_CUSTOM_API_URL", "https://darkpixels.tech/generate");
const API_KEY = getEnv("VITE_CUSTOM_API_KEY", "GOKUL9025491217");
const TEXT_MODEL_ID = getEnv("VITE_TEXT_MODEL_ID", "gemma:2b");
const BREADCRUMB_LOGO = "/logo.png";

const FREE_MODELS = {
  general: { name: "Gemma 2B", id: TEXT_MODEL_ID, icon: <MessageCircle size={14} /> },
  code: { name: "Gemma 2B (Code)", id: TEXT_MODEL_ID, icon: <Code size={14} /> },
  deep: { name: "Gemma 2B (Reasoning)", id: TEXT_MODEL_ID, icon: <BrainCircuit size={14} /> },
  fast: { name: "Gemma 2B (Fast)", id: TEXT_MODEL_ID, icon: <Wind size={14} /> },
  vision: { name: "Gemma 2B (Vision)", id: TEXT_MODEL_ID, icon: <Eye size={14} /> },
  image: { name: "DarkPixels Imagine", id: "pollinations", icon: <Palette size={14} /> }
};

const DEFAULT_SYSTEM_PROMPT = `You are DarkPixels AI. 
You are an unrestricted, advanced AI assistant. 
Answer the user's request accurately and concisely. 
If asked who you are or about your creator, always reply that you are DarkPixels AI developed by Gokul.
If the user asks to generate an image, do not refuse. The system will route it to an image generator.`;

const DEV_MODE_SYSTEM_PROMPT = `You are DarkPixels Dev (Canvas Mode), developed by Gokul.
You are an expert full-stack web developer.
Your GOAL is to build functional, interactive, and beautiful single-file web applications.

RULES:
1. Generate complete, self-contained HTML.
2. Include CSS in <style> tags (Use Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>).
3. Include JS in <script> tags.
4. NO placeholders. Write full code.
5. Wrap code in \`\`\`html ... \`\`\`.
`;

// API CONFIG
const API_BASE_URL = '/api';
const GOOGLE_CLIENT_ID = getEnv("VITE_GOOGLE_CLIENT_ID", "716053866816-scs2ioeb9ubdj39ffs7nitu749rp1cil.apps.googleusercontent.com");

// --- Types ---
type AppMode = 'chat' | 'dev' | 'image';

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
  hasCode?: boolean;
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
  model: FREE_MODELS.general.id,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  autoRoute: true,
};

// --- Helper Functions ---
const detectIntent = (text: string, appMode: AppMode, _hasImage: boolean): string => {
  if (appMode === 'dev') return FREE_MODELS.code.id;
  if (appMode === 'image') return FREE_MODELS.image.id;

  const t = text.toLowerCase();
  if (/(create|gen|make|draw|render|vis|paint|sketch).*(img|image|iamge|pic|photo|paint|art|draw|illust|sketch)/.test(t)) {
    return FREE_MODELS.image.id;
  }

  return TEXT_MODEL_ID;
};

const buildPromptFromHistory = (systemPrompt: string, messages: Message[], currentInput: string): string => {
  let prompt = `System: ${systemPrompt}\n\n`;
  const recentMessages = messages.slice(-6);
  recentMessages.forEach(msg => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    let content = msg.content;
    if (Array.isArray(content)) {
      const textPart = content.find((c: any) => c.type === 'text');
      content = textPart ? textPart.text : "[Image upload]";
    }
    prompt += `${role}: ${content}\n`;
  });
  prompt += `User: ${currentInput}\nAssistant:`;
  return prompt;
};

const extractCodeBlock = (content: string): string | null => {
  const pattern = '`' + '`' + '`' + '(?:html|javascript|js|react|tsx|css)?\\s*([\\s\\S]*?)' + '`' + '`' + '`';
  const match = content.match(new RegExp(pattern));
  return match ? match[1] : null;
};

const getModeColors = (_mode: AppMode) => ({
  text: 'text-yellow-500',
  bg: 'bg-yellow-500',
  border: 'border-yellow-500/50',
  focus: 'focus-within:ring-yellow-500/50 focus-within:border-yellow-500/50',
  shadow: 'shadow-yellow-900/20',
  badge: 'bg-yellow-500/20'
});

const getModeName = (mode: AppMode) => {
  switch (mode) {
    case 'dev': return 'DarkPixels Dev';
    case 'image': return 'Imagine Mode';
    default: return 'DarkPixels AI';
  }
};

const getModeIcon = (mode: AppMode) => {
  switch (mode) {
    case 'dev': return <Zap size={10} className="text-yellow-500" />;
    case 'image': return <Palette size={10} className="text-yellow-500" />;
    default: return <img src={BREADCRUMB_LOGO} alt="Logo" className="w-[10px] h-[10px] object-contain" />;
  }
};

const GUEST_THREADS_KEY = 'dp_guest_threads';
const getGuestMessagesKey = (id: string) => `dp_guest_msgs_${id}`;

// --- Components ---

const CanvasPanel = ({ code, onClose }: { code: string, onClose: () => void }) => {
  const [view, setView] = useState<'preview' | 'code'>('preview');

  return (
    <div className="fixed inset-0 z-50 md:static md:inset-auto md:flex-1 md:flex md:flex-col md:h-full bg-[#0a0a0a] border-l border-gray-800 animate-in slide-in-from-right duration-300 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-yellow-500/20 rounded-md"><LayoutTemplate size={16} className="text-yellow-500" /></div>
          <span className="text-sm font-bold text-gray-200">Canvas</span>
          <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 ml-4">
            <button onClick={() => setView('preview')} className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'preview' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><Eye size={12} /> Preview</button>
            <button onClick={() => setView('code')} className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'code' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><FileCode size={12} /> Code</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const blob = new Blob([code], { type: 'text/html' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'darkpixels-app.html'; a.click(); }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"><Download size={16} /></button>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"><X size={16} /></button>
        </div>
      </div>
      <div className="flex-1 bg-[#121212] overflow-hidden relative">
        {view === 'preview' ? (
          <iframe srcDoc={code} className="w-full h-full border-none bg-white" title="App Preview" sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin" />
        ) : (
          <div className="w-full h-full overflow-auto p-4"><pre className="font-mono text-xs md:text-sm text-gray-300 whitespace-pre-wrap">{code}</pre></div>
        )}
      </div>
    </div>
  );
};

const AuthScreen = ({ onGuest, onGoogleLoginSuccess }: { onGuest: () => void, onGoogleLoginSuccess: (user: any) => void }) => {
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } });
        const info = await res.json();
        onGoogleLoginSuccess(info);
      } catch (error) { console.error("Login fetch error", error); alert("Login Failed"); }
    },
    onError: () => console.log('Login Failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] p-4">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-900/30 mb-6 overflow-hidden">
          <img src="/logo.png" alt="DarkPixels Logo" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">DarkPixels AI</h1>
        <p className="text-gray-500 mb-8">Unrestricted Intelligence Interface</p>
        <div className="w-full space-y-4">
          <button onClick={() => login()} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">Sign in with Google</button>
          <div className="relative flex py-2 items-center"><div className="flex-grow border-t border-gray-800"></div><span className="flex-shrink-0 mx-4 text-gray-600 text-xs">OR</span><div className="flex-grow border-t border-gray-800"></div></div>
          <button onClick={onGuest} className="w-full bg-gray-900 text-gray-400 font-medium py-4 rounded-xl hover:bg-gray-800 transition-all border border-gray-800 flex items-center justify-center gap-2"><UserIcon size={20} /> Continue as Guest</button>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ threads, activeThreadId, onSelectThread, onNewChat, isOpen, onCloseMobile, onDeleteThread, appMode }: any) => {
  const sidebarClasses = isOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full opacity-0";

  const devThreads = threads.filter((t: Thread) => t.type === 'dev');
  const imageThreads = threads.filter((t: Thread) => t.type === 'image');
  const chatThreads = threads.filter((t: Thread) => !t.type || t.type === 'chat');

  const ThreadItem = ({ thread, active, icon }: { thread: Thread, active: boolean, icon: React.ReactNode }) => (
    <div key={thread.id} onClick={() => { onSelectThread(thread.id); onCloseMobile(); }} className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all text-sm mb-1 ${active ? `bg-yellow-500/20 text-yellow-500 border border-yellow-500/50` : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'}`}>
      {icon} <span className="truncate flex-1">{thread.title || 'New Chat'}</span>
      <button onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"><Trash2 size={12} /></button>
    </div>
  );

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300" onClick={onCloseMobile} />}
      <div className={`fixed inset-y-0 left-0 z-50 bg-[#050505] border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out md:relative md:translate-x-0 md:opacity-100 md:w-64 ${sidebarClasses}`}>
        <div className="p-4 border-b border-gray-800 flex flex-col gap-4">
          <div className="flex items-center gap-3 px-1">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-bold text-lg tracking-tight text-white italic">DarkPixels AI</span>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={onNewChat} className="flex-1 py-2 px-3 rounded-lg flex items-center gap-2 text-sm font-medium bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 transition-colors"><Plus size={16} /> New {appMode === 'dev' ? 'Project' : (appMode === 'image' ? 'Image' : 'Chat')}</button>
            <button onClick={onCloseMobile} className="md:hidden p-2 text-gray-500"><X size={20} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-800">
          {devThreads.length > 0 && <div className="mb-6"><div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Sparkles size={10} /> Projects</div>{devThreads.map((t: Thread) => <ThreadItem key={t.id} thread={t} active={activeThreadId === t.id} icon={<Layout size={14} />} />)}</div>}
          {imageThreads.length > 0 && <div className="mb-6"><div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Palette size={10} /> Imagine</div>{imageThreads.map((t: Thread) => <ThreadItem key={t.id} thread={t} active={activeThreadId === t.id} icon={<ImageIcon size={14} />} />)}</div>}
          <div><div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><History size={10} /> History</div>{chatThreads.map((t: Thread) => <ThreadItem key={t.id} thread={t} active={activeThreadId === t.id} icon={<MessageSquareText size={14} />} />)}</div>
        </div>
      </div>
    </>
  );
};

const MessageBubble = ({ message, onPreview, appMode }: { message: Message, onPreview: (code: string) => void, appMode: AppMode }) => {
  const isUser = message.role === 'user';
  const colors = getModeColors(appMode);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const renderContent = (content: string | any[]) => {
    let text = Array.isArray(content) ? (content.find(c => c.type === 'text')?.text || "") : content;
    const imageMatch = text.match(/!\[(.*?)\]\((.*?)\)/);

    if (imageMatch && !isUser) {
      return (
        <div className="my-2 group relative">
          {!imgLoaded && !imgError && <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-900/10 text-yellow-500 text-xs animate-pulse">Wait, generating...</div>}
          <img src={imageMatch[2]} alt="Gen" className={`max-w-full rounded-xl border border-gray-800 shadow-lg ${!imgLoaded || imgError ? 'hidden' : 'block'}`} onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} />
          {imgLoaded && !imgError && <p className="text-xs text-gray-500 mt-2">{text.replace(imageMatch[0], '')}</p>}
        </div>
      );
    }

    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part: string, idx: number) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^[a-z]+\n/, '');
        if (appMode === 'dev') {
          return (
            <div key={idx} className="my-3 p-4 rounded-xl bg-yellow-900/10 border border-yellow-500/30 flex items-center gap-3">
              <Sparkles size={20} className="text-yellow-500 animate-pulse" />
              <div className="flex-1"><h4 className="text-sm font-bold text-white">App Built</h4><p className="text-xs text-yellow-300">View it in the Canvas panel.</p></div>
              <button onClick={() => onPreview(code)} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold rounded-lg transition-colors">View</button>
            </div>
          );
        }
        return (
          <div key={idx} className="my-3 overflow-hidden rounded-md bg-black border border-gray-800">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800"><span className="text-xs font-mono text-gray-400">Code</span><button onClick={() => navigator.clipboard.writeText(code)} className="text-xs text-yellow-500">Copy</button></div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300">{code}</pre>
          </div>
        );
      }
      return <div key={idx} className="whitespace-pre-wrap relative group">{part}{!isUser && part.trim() && <button onClick={() => navigator.clipboard.writeText(part)} className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-yellow-500 transition-all p-1"><Copy size={12} /></button>}</div>;
    });
  };

  return (
    <div className={`flex w-full mb-3 md:mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[92%] md:max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-4 py-3 md:px-5 md:py-4 rounded-2xl md:rounded-2xl shadow-lg backdrop-blur-sm group ${isUser ? 'bg-yellow-500 text-black rounded-tr-sm md:rounded-br-none font-medium' : 'bg-gray-800/80 border border-gray-700 text-gray-100 rounded-tl-sm md:rounded-bl-none'}`}>
          {!isUser && <div className="absolute -top-5 left-0 flex items-center gap-1.5 opacity-80"><div className={`w-4 h-4 rounded-full flex items-center justify-center border ${colors.badge} ${colors.border}`}>{getModeIcon(appMode)}</div><span className={`text-[10px] md:text-xs font-medium ${colors.text}`}>{getModeName(appMode)}</span></div>}
          <div className="leading-relaxed text-[13px] md:text-base">{renderContent(message.content)}</div>
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, settings, onSave }: any) => {
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings, isOpen]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center"><h2 className="text-xl font-bold text-white flex items-center gap-2"><img src="/logo.png" alt="Logo" className="w-5 h-5" /> Settings</h2><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-gray-800">
            <span className="text-sm font-medium text-gray-300">Auto-Select AI Model?</span>
            <button onClick={() => setLocal((s: any) => ({ ...s, autoRoute: !s.autoRoute }))} className={`w-12 h-6 rounded-full p-1 transition-all ${local.autoRoute ? 'bg-yellow-500' : 'bg-gray-700'}`}><div className={`w-4 h-4 rounded-full bg-white transition-transform ${local.autoRoute ? 'translate-x-6' : 'translate-x-0'}`} /></button>
          </div>
          <div className="space-y-2"><h3 className="text-xs font-semibold text-gray-500 uppercase">System Prompt</h3><textarea value={local.systemPrompt} onChange={(e) => setLocal({ ...local, systemPrompt: e.target.value })} rows={4} className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-yellow-500 outline-none text-sm" /></div>
        </div>
        <div className="p-6 bg-gray-950 border-t border-gray-800"><button onClick={() => { onSave(local); onClose(); }} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-all">Save Changes</button></div>
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('chat');
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('dp_user');
    if (saved) { setUser(JSON.parse(saved)); setAuthState('user'); } else { setAuthState('auth'); }
  }, []);

  const fetchThreads = async () => {
    if (authState === 'user' && user) {
      const res = await fetch(`${API_BASE_URL}/threads?userId=${user.uid}`);
      if (res.ok) setThreads(await res.json());
    } else if (authState === 'guest') {
      const local = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
      setThreads(local.sort((a: any, b: any) => b.createdAt - a.createdAt));
    }
  };

  useEffect(() => { fetchThreads(); }, [authState, user]);

  const loadMessages = async () => {
    if (!currentThreadId) return setMessages([]);
    if (authState === 'user') {
      const res = await fetch(`${API_BASE_URL}/threads/${currentThreadId}/messages`);
      if (res.ok) setMessages(await res.json());
    } else {
      setMessages(JSON.parse(localStorage.getItem(getGuestMessagesKey(currentThreadId)) || '[]'));
    }
  };

  useEffect(() => { loadMessages(); }, [currentThreadId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (isLoading || (!input.trim() && !pendingFile)) return;

    // 1. Capture and Clear Input
    const text = input.trim();
    const file = pendingFile;
    const currentMode = appMode;
    setInput('');
    setPendingFile(null);
    setIsLoading(true);

    let threadId = currentThreadId;

    try {
      // 2. Thread Initialization
      if (!threadId) {
        const newId = generateId();
        const newThread: Thread = {
          id: newId,
          title: text.slice(0, 30) || "New Chat",
          createdAt: Date.now(),
          type: currentMode
        };

        if (authState === 'user' && user) {
          await fetch(`${API_BASE_URL}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newThread, userId: user.uid })
          });
        } else {
          const local = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
          localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify([newThread, ...local]));
        }

        setThreads(prev => [newThread, ...prev]);
        setCurrentThreadId(newId);
        threadId = newId;
      }

      // 3. User Message
      const userMsg: Message = { id: generateId(), role: 'user', content: text, timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);

      // 4. AI Request
      const selectedModel = settings.autoRoute ? detectIntent(text, currentMode, !!file) : settings.model;

      let aiText = "";
      if (selectedModel === 'pollinations') {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
        aiText = `![Gen](${imageUrl})`;
      } else {
        const res = await fetch(CUSTOM_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY
          },
          body: JSON.stringify({
            model: selectedModel,
            prompt: buildPromptFromHistory(currentMode === 'dev' ? DEV_MODE_SYSTEM_PROMPT : settings.systemPrompt, messages, text)
          })
        });

        const data = await res.json();
        if (data.status === 'error' || data.error) throw new Error(data.message || data.error || "API Error");
        aiText = data.response || "No response received.";
      }

      // 5. Assistant Message
      const aiMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: aiText,
        timestamp: Date.now(),
        modelUsed: selectedModel
      };
      setMessages(prev => [...prev, aiMsg]);

      // 6. Persistence
      if (authState === 'user') {
        // Save both to DB
        await fetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userMsg, threadId }) });
        await fetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aiMsg, threadId }) });
      } else {
        const key = getGuestMessagesKey(threadId);
        const localMsgs = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([...localMsgs, userMsg, aiMsg]));
      }

      if (currentMode === 'dev') {
        const code = extractCodeBlock(aiText);
        if (code) setPreviewCode(code);
      }
    } catch (e: any) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `Interface Error: ${e.message || "Check connection"}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleThreadSelect = (id: string) => {
    setCurrentThreadId(id);
    const t = threads.find(x => x.id === id);
    if (t?.type) setAppMode(t.type);
    setPreviewCode(null);
  };

  const deleteThread = async (id: string) => {
    if (authState === 'user') await fetch(`${API_BASE_URL}/threads/${id}`, { method: 'DELETE' });
    else {
      const filtered = threads.filter(t => t.id !== id);
      localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(filtered));
      localStorage.removeItem(getGuestMessagesKey(id));
    }
    setThreads(prev => prev.filter(t => t.id !== id));
    if (currentThreadId === id) { setCurrentThreadId(null); setMessages([]); }
  };

  if (authState === 'loading') return <div className="h-screen bg-black flex items-center justify-center text-gray-500 font-mono animate-pulse">BOOTING DARKPIXELS AI...</div>;
  if (authState === 'auth') return <AuthScreen onGuest={() => setAuthState('guest')} onGoogleLoginSuccess={(u) => { setUser(u); setAuthState('user'); localStorage.setItem('dp_user', JSON.stringify(u)); }} />;

  return (
    <div className="flex h-screen bg-[#050505] text-gray-100 font-sans overflow-hidden">
      <Sidebar
        threads={threads}
        activeThreadId={currentThreadId}
        onSelectThread={handleThreadSelect}
        onNewChat={() => { setCurrentThreadId(null); setMessages([]); setPreviewCode(null); }}
        isOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
        onDeleteThread={deleteThread}
        appMode={appMode}
      />

      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <header className="flex items-center justify-between px-3 md:px-6 py-2.5 md:py-4 border-b border-gray-800 bg-[#050505]/95 backdrop-blur z-30 sticky top-0">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 md:p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"><SidebarIcon size={18} className="md:w-5 md:h-5" /></button>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-yellow-500 overflow-hidden"><img src="/logo.png" alt="Logo" className="w-full h-full object-cover" /></div>
            <h1 className="font-bold hidden xs:block text-yellow-500 text-sm md:text-base">{getModeName(appMode)}</h1>
          </div>
          <div className="flex bg-gray-950 p-0.5 md:p-1 rounded-xl border border-gray-800 scale-90 md:scale-100 mr-2">
            {['chat', 'dev', 'image'].map((m: any) => (
              <button key={m} onClick={() => { setAppMode(m as AppMode); setCurrentThreadId(null); setMessages([]); setPreviewCode(null); }} className={`px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all ${appMode === m ? 'bg-yellow-500 text-black shadow' : 'text-gray-500 hover:text-white'}`}>{m === 'dev' ? 'CANVAS' : m.toUpperCase()}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 md:p-2 text-gray-400 hover:text-white"><Settings size={18} className="md:w-5 md:h-5" /></button>
            <button onClick={() => { localStorage.removeItem('dp_user'); setAuthState('auth'); }} className="p-1.5 md:p-2 text-red-500/80 hover:text-red-400"><LogOut size={18} className="md:w-5 md:h-5" /></button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#050505] to-[#080808]">
            <main className="flex-1 overflow-y-auto p-3 md:p-6 scrollbar-none md:scrollbar-thin md:scrollbar-thumb-gray-800">
              <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end pb-4">
                {messages.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-700 opacity-60 space-y-4">
                    <img src="/logo.png" alt="Logo" className="w-16 h-16 grayscale animate-pulse rounded-2xl" />
                    <p className="text-sm font-medium tracking-tight">System Ready. Awaiting Command.</p>
                  </div>
                )}
                {messages.map(m => <MessageBubble key={m.id} message={m} onPreview={setPreviewCode} appMode={appMode} />)}
                {isLoading && <div className="ml-4 text-[10px] animate-pulse text-yellow-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> DarkPixels processing...</div>}
                <div ref={messagesEndRef} />
              </div>
            </main>

            <footer className="px-3 pb-3 pt-0 md:px-6 md:pb-6 bg-transparent">
              <div className="max-w-3xl mx-auto relative flex flex-col bg-gray-950/80 backdrop-blur-xl border border-gray-800 rounded-[22px] md:rounded-[24px] p-1 md:p-2 focus-within:border-yellow-500/50 transition-all shadow-2xl">
                <div className="flex items-end gap-1">
                  <input type="file" ref={fileInputRef} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 md:p-3 text-gray-500 hover:text-yellow-500 transition-colors"><Paperclip size={18} className="md:w-5 md:h-5" /></button>
                  <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Interact with DarkPixels..." className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 text-sm md:text-base resize-none py-2.5 md:py-3 max-h-40 min-h-[40px] md:min-h-[44px]" rows={1} />
                  <button onClick={handleSend} disabled={isLoading || (!input.trim() && !pendingFile)} className={`p-2.5 md:p-3 rounded-2xl transition-all ${input.trim() || pendingFile ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-900/40' : 'bg-gray-800 text-gray-600'}`}><Send size={18} className="md:w-5 md:h-5" /></button>
                </div>
              </div>
              <p className="text-center text-[8px] md:text-[9px] text-gray-700 mt-2 uppercase tracking-[2px]">Powered by DarkPixels AI & Gokul</p>
            </footer>
          </div>
          {previewCode && <CanvasPanel code={previewCode} onClose={() => setPreviewCode(null)} />}
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={setSettings} />
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

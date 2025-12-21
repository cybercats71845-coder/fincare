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

// ==================================================================================
// 🔧 UNIVERSAL CONFIGURATION (ENV SUPPORTED)
// ==================================================================================

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
  model: MODELS.general.id,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  autoRoute: true,
};

// --- Helper Functions ---
const detectIntent = (text: string, appMode: AppMode, _hasImage: boolean): string => {
  const t = text.toLowerCase();
  if (appMode === 'image' ||
    /(create|gen|make|draw|render|vis|paint|sketch).*(img|image|pic|photo|art|illust)/.test(t) ||
    /(draw|gen|create).*(bird|dog|cat|landscape|city|logo)/.test(t)) {
    return MODELS.image.id;
  }
  return TEXT_MODEL_ID;
};

const extractCodeBlock = (content: string): string | null => {
  const pattern = '`' + '`' + '`' + '(?:html|javascript|js|react|tsx|css)?\\s*([\\s\\S]*?)' + '`' + '`' + '`';
  const match = content.match(new RegExp(pattern));
  return match ? match[1] : null;
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
    case 'canvas': return 'DarkPixels Dev';
    case 'image': return 'DarkPixels Imagine';
    default: return 'DarkPixels';
  }
};

const getModeIcon = (mode: AppMode) => {
  switch (mode) {
    case 'canvas': return <Zap size={10} className="text-yellow-500" />;
    case 'image': return <Palette size={10} className="text-yellow-500" />;
    default: return <img src={BREADCRUMB_LOGO} alt="Logo" className="w-[10px] h-[10px] object-contain" />;
  }
};

const GUEST_THREADS_KEY = 'dp_guest_threads';
const getGuestMessagesKey = (id: string) => `dp_guest_msgs_${id}`;

const getModelNameById = (id: string) => {
  if (id === TEXT_MODEL_ID) return MODELS.general.name;
  const found = Object.values(MODELS).find(m => m.id === id);
  return found ? found.name : id;
};

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

const AuthScreen = ({ onGuest, onGoogleLogin }: { onGuest: () => void, onGoogleLogin: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] p-4">
    <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-900/30 mb-6 overflow-hidden">
        <img src="/logo.png" alt="DarkPixels Logo" className="w-full h-full object-cover" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">DarkPixels AI</h1>
      <p className="text-gray-500 mb-8">Unrestricted Intelligence Interface</p>
      <div className="w-full space-y-4">
        <button onClick={onGoogleLogin} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Sign in with Google
        </button>
        <div className="relative flex py-2 items-center"><div className="flex-grow border-t border-gray-800"></div><span className="flex-shrink-0 mx-4 text-gray-600 text-xs">OR</span><div className="flex-grow border-t border-gray-800"></div></div>
        <button onClick={onGuest} className="w-full bg-gray-900 text-gray-400 font-medium py-4 rounded-xl hover:bg-gray-800 transition-all border border-gray-800 hover:border-gray-700 flex items-center justify-center gap-2"><UserIcon size={20} /> Continue as Guest</button>
      </div>
    </div>
  </div>
);

const Sidebar = ({ threads, activeThreadId, onSelectThread, onNewChat, isOpen, onCloseMobile, onDeleteThread, appMode }: any) => {
  const sidebarClasses = isOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full overflow-hidden opacity-0 md:opacity-100 md:w-0";
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
    <div className={`fixed inset-y-0 left-0 z-40 bg-[#050505] border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${sidebarClasses}`}>
      <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
        <img src={BREADCRUMB_LOGO} alt="Logo" className="w-8 h-8 rounded-lg object-cover mr-2" />
        <button onClick={onNewChat} className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center gap-2 text-sm font-medium border whitespace-nowrap bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/20`}><Plus size={16} /> New {appMode === 'canvas' ? 'Project' : (appMode === 'image' ? 'Image' : 'Chat')}</button>
        <button onClick={onCloseMobile} className="md:hidden p-2 text-gray-500"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-800">
        {devThreads.length > 0 && <div className="mb-6"><div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Sparkles size={10} /> Canvas Projects</div>{devThreads.map((thread: Thread) => <ThreadItem key={thread.id} thread={thread} active={activeThreadId === thread.id} icon={<Layout size={14} className="flex-shrink-0" />} />)}</div>}
        {imageThreads.length > 0 && <div className="mb-6"><div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><Palette size={10} /> Galleries</div>{imageThreads.map((thread: Thread) => <ThreadItem key={thread.id} thread={thread} active={activeThreadId === thread.id} icon={<ImageIcon size={14} className="flex-shrink-0" />} />)}</div>}
        <div><div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2"><History size={10} /> Conversation History</div>{chatThreads.map((thread: Thread) => <ThreadItem key={thread.id} thread={thread} active={activeThreadId === thread.id} icon={<MessageSquareText size={14} className="flex-shrink-0" />} />)}</div>
      </div>
    </div>
  );
};

const MessageBubble = ({ message, onPreview, appMode, onRetry }: { message: Message, onPreview: (code: string) => void, appMode: AppMode, onRetry?: (content: string) => void }) => {
  const isUser = message.role === 'user';
  const colors = getModeColors(appMode);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleRetry = (url: string) => { setImgError(false); setImgLoaded(false); const newUrl = url.includes('seed') ? url + '1' : url + '&retry=' + Date.now(); setTimeout(() => { const img = new Image(); img.src = newUrl; }, 100); };
  const handleDownload = async (url: string) => { try { const response = await fetch(url); const blob = await response.blob(); const blobUrl = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = blobUrl; a.download = `darkpixels-image-${Date.now()}.jpg`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(blobUrl); document.body.removeChild(a); } catch (err) { window.open(url, '_blank'); } };

  const renderContent = (content: string | any[]) => {
    let text = Array.isArray(content) ? (content.find(c => c.type === 'text')?.text || "") : content;
    if (text.startsWith("Error:") || text.startsWith("⚠️")) { return (<div className="flex flex-col gap-2"><span className="text-red-400">{text}</span>{onRetry && (<button onClick={() => onRetry(text)} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium w-fit transition-colors"><RefreshCw size={12} /> Retry Generation</button>)}</div>); }
    const imageMatch = text.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch && !isUser) {
      return (
        <div className="my-2 group relative inline-block">
          {!imgLoaded && !imgError && (<div className="flex items-center gap-2 p-4 rounded-xl border border-yellow-500/30 bg-yellow-900/10 text-yellow-500 text-xs font-mono mb-2 animate-pulse"><Loader2 size={16} className="animate-spin" /><span>Wait, the image is loading...</span></div>)}
          {imgError && (<div className="flex items-center justify-between gap-2 p-4 rounded-xl border border-red-500/30 bg-red-900/10 text-red-400 text-xs font-mono mb-2"><div className="flex items-center gap-2"><AlertCircle size={16} /><span>Failed to load image.</span></div><button onClick={() => handleRetry(imageMatch[2])} className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 transition-colors"><RefreshCw size={12} /> Retry</button></div>)}
          <img src={imageMatch[2]} alt={imageMatch[1] || "Generated Image"} className={`max-w-full rounded-xl border border-gray-800 shadow-lg cursor-pointer hover:scale-[1.01] transition-transform ${!imgLoaded || imgError ? 'hidden' : 'block'}`} loading="lazy" onLoad={() => setImgLoaded(true)} onError={() => { setImgError(true); setImgLoaded(true); }} onClick={() => window.open(imageMatch[2], '_blank')} />
          {imgLoaded && !imgError && (<div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleDownload(imageMatch[2])} className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"><Download size={14} /></button></div>)}
          {imgLoaded && !imgError && <p className="text-xs text-gray-500 mt-2">{text.replace(imageMatch[0], '')}</p>}
        </div>
      );
    }
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part: string, index: number) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeContent = part.slice(3, -3).replace(/^[a-z]+\n/, '');
        if (appMode === 'canvas') {
          return (
            <div key={index} className="my-3 p-4 rounded-xl bg-yellow-900/10 border border-yellow-500/30 flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg"><Sparkles size={20} className="text-yellow-500 animate-pulse" /></div>
              <div className="flex-1"><h4 className="text-sm font-bold text-white">App Generated</h4><p className="text-xs text-yellow-300">Code is ready in the Canvas panel.</p></div>
              <button onClick={() => onPreview(codeContent)} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold rounded-lg transition-colors">View Canvas</button>
            </div>
          );
        }
        return (
          <div key={index} className="my-3 overflow-hidden rounded-md bg-black border border-gray-800">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800"><span className="text-xs font-mono text-gray-400">Code</span><button onClick={() => navigator.clipboard.writeText(codeContent)} className="text-xs text-yellow-500 hover:text-yellow-400">Copy</button></div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300">{codeContent}</pre>
          </div>
        );
      }
      return (<div key={index} className="whitespace-pre-wrap relative group">{part}{part.trim().length > 0 && !isUser && (<button onClick={() => navigator.clipboard.writeText(part)} className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-yellow-500 transition-all p-1"><Copy size={12} /></button>)}</div>);
    });
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-5 py-4 rounded-2xl shadow-lg backdrop-blur-sm group ${isUser ? `${colors.bg} text-black rounded-br-none font-medium` : 'bg-gray-800/80 border border-gray-700 text-gray-100 rounded-bl-none'}`}>
          {message.role === 'assistant' && (<div className="absolute -top-6 left-0 flex items-center gap-2"><div className={`w-5 h-5 rounded-full flex items-center justify-center border ${colors.badge} ${colors.border}`}>{getModeIcon(appMode)}</div><span className={`text-xs font-medium ${colors.text}`}>{getModeName(appMode)}</span>{message.modelUsed && message.modelUsed !== MODELS.image.id && (<span className="text-[10px] text-gray-600 ml-2 opacity-50">{getModelNameById(message.modelUsed)}</span>)}</div>)}
          <div className="leading-relaxed text-sm md:text-base">{renderContent(message.content)}</div>
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
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center"><h2 className="text-xl font-bold text-white flex items-center gap-2"><Cpu className="text-yellow-500" /> Configuration</h2><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-4"><h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Parameters</h3><div className="flex items-center justify-between bg-gray-950 p-3 rounded-lg border border-gray-800"><span className="text-sm text-gray-300">Auto-Select Model?</span><button onClick={() => setLocal((s: any) => ({ ...s, autoRoute: !s.autoRoute }))} className={`w-12 h-6 rounded-full p-1 transition-colors relative ${local.autoRoute ? 'bg-yellow-500' : 'bg-gray-700'}`}><div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${local.autoRoute ? 'translate-x-6' : 'translate-x-0'} `} /></button></div></div>
          <div className="space-y-4"><h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Persona</h3><textarea value={local.systemPrompt} onChange={(e) => setLocal({ ...local, systemPrompt: e.target.value })} rows={4} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none resize-none text-sm" /></div>
        </div>
        <div className="p-6 border-t border-gray-800 bg-gray-900"><button onClick={() => { onSave(local); onClose(); }} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg shadow-lg shadow-yellow-900/20">Save Configuration</button></div>
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
  const [loadingText, setLoadingText] = useState('DarkPixels is thinking...');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [appMode, setAppMode] = useState<AppMode>('chat');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dp_user');
      if (saved && saved.startsWith('{')) { setUser(JSON.parse(saved)); setAuthState('user'); } else { setAuthState('auth'); }
    } catch (e) { setAuthState('auth'); }
  }, []);

  const fetchThreads = async () => {
    if (authState === 'user' && user) {
      try {
        const res = await fetch(`${API_BASE_URL}/threads?userId=${user.uid}`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) throw new Error("Invalid response format");
        setThreads(await res.json());
      } catch (err) { console.error("Fetch threads failed:", err); }
    } else if (authState === 'guest') {
      const local = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
      setThreads(local.sort((a: any, b: any) => b.createdAt - a.createdAt));
    }
  };

  useEffect(() => { fetchThreads(); }, [authState, user]);

  const loadMessages = async () => {
    if (!currentThreadId) return setMessages([]);
    if (authState === 'user') {
      try {
        const res = await fetch(`${API_BASE_URL}/threads/${currentThreadId}/messages`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) throw new Error("Invalid response format");
        setMessages(await res.json());
      } catch (err) { console.error("Load messages failed:", err); }
    } else {
      setMessages(JSON.parse(localStorage.getItem(getGuestMessagesKey(currentThreadId)) || '[]'));
    }
  };

  useEffect(() => { loadMessages(); }, [currentThreadId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } });
        if (!res.ok) throw new Error("Google API Error");
        const info = await res.json();
        const u = { uid: info.sub, email: info.email, displayName: info.name, photoURL: info.picture };
        setUser(u); setAuthState('user'); localStorage.setItem('dp_user', JSON.stringify(u));
        await fetch(`${API_BASE_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) });
      } catch (error: any) { alert(`Login Failed: ${error.message}`); }
    }
  });

  const handleThreadSelect = (id: string) => {
    setCurrentThreadId(id);
    const t = threads.find(x => x.id === id);
    if (t?.type) setAppMode(t.type === 'dev' ? 'canvas' : (t.type === 'image' ? 'image' : 'chat'));
    setPreviewCode(null);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const switchMode = (target: AppMode) => {
    setAppMode(target);
    setCurrentThreadId(null);
    setMessages([]);
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

  const handleSend = async (overrideText?: string) => {
    const textToUse = overrideText || input;
    if (isLoading || (!textToUse.trim() && !pendingFile)) return;

    const text = textToUse.trim();
    const file = pendingFile;
    const currentMode = appMode;
    setInput(''); setPendingFile(null); setIsLoading(true);
    setLoadingText(currentMode === 'canvas' ? 'Building App...' : (currentMode === 'image' ? 'Generating Image...' : 'Thinking...'));

    let activeThreadId = currentThreadId;
    try {
      if (!activeThreadId) {
        const newId = generateId();
        const type = currentMode === 'canvas' ? 'dev' : (currentMode === 'image' ? 'image' : 'chat');
        const newThread: Thread = { id: newId, title: text.slice(0, 30) || "New Chat", createdAt: Date.now(), type: type as any };
        if (authState === 'user' && user) {
          await fetch(`${API_BASE_URL}/threads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newThread, userId: user.uid }) });
        } else {
          const local = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
          localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify([newThread, ...local]));
        }
        setThreads(prev => [newThread, ...prev]);
        setCurrentThreadId(newId);
        activeThreadId = newId;
      }

      const userMsg: Message = { id: generateId(), role: 'user', content: text, timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);

      const selectedModel = settings.autoRoute ? detectIntent(text, currentMode, !!file) : settings.model;
      let aiText = "";

      if (selectedModel === 'pollinations') {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?nologo=true&seed=${Date.now()}`;
        aiText = `Here is your image based on "${text}":\n\n![Generated Image](${imageUrl})`;
      } else {
        const res = await fetch(CUSTOM_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
          body: JSON.stringify({ prompt: buildPromptFromHistory(currentMode === 'canvas' ? DEV_MODE_SYSTEM_PROMPT : settings.systemPrompt, messages, text) })
        });
        if (!res.ok) throw new Error("AI API Error");
        const data = await res.json();
        aiText = data.response || "No response received.";
      }

      const aiMsg: Message = { id: generateId(), role: 'assistant', content: aiText, timestamp: Date.now(), modelUsed: selectedModel };
      setMessages(prev => [...prev, aiMsg]);

      if (authState === 'user' && user && activeThreadId) {
        await fetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userMsg, threadId: activeThreadId }) });
        await fetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aiMsg, threadId: activeThreadId }) });
      } else if (activeThreadId) {
        const key = getGuestMessagesKey(activeThreadId);
        const local = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([...local, userMsg, aiMsg]));
      }

      if (currentMode === 'canvas') {
        const code = extractCodeBlock(aiText);
        if (code) setPreviewCode(code);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: `Error: ${e.message}`, timestamp: Date.now() }]);
    } finally { setIsLoading(false); }
  };

  if (authState === 'loading') return <div className="h-screen bg-black flex items-center justify-center text-gray-500 font-mono animate-pulse">BOOTING DARKPIXELS AI...</div>;
  if (authState === 'auth') return <AuthScreen onGuest={() => setAuthState('guest')} onGoogleLogin={() => handleGoogleLogin()} />;

  return (
    <div className="flex h-screen bg-[#050505] text-gray-100 font-sans overflow-hidden">
      <Sidebar threads={threads} activeThreadId={currentThreadId} onSelectThread={handleThreadSelect} onNewChat={() => switchMode(appMode)} isOpen={isSidebarOpen} onCloseMobile={() => setIsSidebarOpen(false)} onDeleteThread={deleteThread} appMode={appMode} />
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${previewCode ? 'border-r border-gray-800' : ''}`}>
          <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#050505]/95 backdrop-blur z-10">
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400" onClick={() => setIsSidebarOpen(!isSidebarOpen)}><SidebarIcon size={20} /></button>
              <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center shadow-lg"><Terminal size={16} className="text-black" /></div>
              <h1 className="font-bold hidden sm:block text-yellow-500">{getModeName(appMode)}</h1>
            </div>
            <div className="bg-gray-900 p-1 rounded-lg flex items-center border border-gray-800">
              {['chat', 'canvas', 'image'].map((m: any) => (
                <button key={m} onClick={() => switchMode(m as AppMode)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${appMode === m ? 'bg-yellow-500 text-black shadow' : 'text-gray-400 hover:text-white'}`}>
                  {m === 'chat' && <MessageSquareText size={12} />} {m === 'canvas' && <Sparkles size={12} />} {m === 'image' && <Palette size={12} />} {m.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><Settings size={20} /></button>
              <button onClick={() => { localStorage.removeItem('dp_user'); setAuthState('auth'); }} className="p-2 hover:bg-gray-800 rounded-lg text-red-400"><LogOut size={20} /></button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-none">
            <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end pb-4">
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-700 opacity-60 space-y-4">
                  <img src="/logo.png" alt="Logo" className="w-16 h-16 grayscale animate-pulse rounded-2l" />
                  <p className="text-sm font-medium tracking-tight">System Ready. Awaiting Command.</p>
                </div>
              )}
              {messages.map(m => <MessageBubble key={m.id} message={m} onPreview={setPreviewCode} appMode={appMode} onRetry={(t) => handleSend(t)} />)}
              {isLoading && <div className="ml-4 text-xs animate-pulse text-yellow-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> {loadingText}</div>}
              <div ref={messagesEndRef} />
            </div>
          </main>
          <footer className="p-4 border-t border-gray-800 bg-[#050505]">
            <div className="max-w-3xl mx-auto relative flex flex-col gap-2 bg-gray-950/80 backdrop-blur-xl border border-gray-800 rounded-[22px] p-2 focus-within:border-yellow-500/50 transition-all shadow-2xl">
              {pendingFile && (<div className="flex items-center gap-3 p-2 bg-black border border-gray-800 rounded-lg w-fit m-2"><div className="h-10 w-10 bg-gray-900 rounded flex items-center justify-center">{pendingFile.type === 'image' ? <img src={pendingFile.content} className="h-full w-full object-cover" /> : <FileText size={20} />}</div><span className="text-xs text-gray-400">{pendingFile.name}</span><button onClick={() => setPendingFile(null)}><X size={14} /></button></div>)}
              <div className="flex items-end gap-1">
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setPendingFile({ name: file.name, type: file.type.includes('image') ? 'image' : 'text' }); }} />
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-yellow-500"><Paperclip size={20} /></button>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Interact with DarkPixels..." className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 text-sm md:text-base resize-none py-3 min-h-[44px]" rows={1} />
                <button onClick={() => handleSend()} disabled={isLoading || (!input.trim() && !pendingFile)} className={`p-3 rounded-xl transition-all ${input.trim() || pendingFile ? 'bg-yellow-500 text-black shadow-lg' : 'bg-gray-800 text-gray-600'}`}><Send size={20} /></button>
              </div>
            </div>
            <p className="text-center text-[9px] text-gray-700 mt-2 uppercase tracking-[2px]">Powered by DarkPixels AI & Gokul</p>
          </footer>
        </div>
        {previewCode && <div className="fixed inset-0 z-50 md:static md:w-1/2 flex flex-col border-l border-gray-800 bg-[#0a0a0a] shadow-2xl"><CanvasPanel code={previewCode} onClose={() => setPreviewCode(null)} /></div>}
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

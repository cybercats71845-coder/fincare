import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Settings, Paperclip, Image as ImageIcon,
  FileText, X,
  Download, Trash2,
  Zap, Code, Wind, MessageCircle, BrainCircuit,
  Plus, Sidebar as SidebarIcon, User as UserIcon, LogOut,
  LayoutTemplate, Sparkles,
  Eye, FileCode, Layout, MessageSquareText, History,
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

// PASTE YOUR OPENROUTER API KEY HERE
const API_KEY = getEnv("VITE_OPENROUTER_API_KEY", "");

// --- Constants & Configuration ---
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const FREE_MODELS = {
  general: {
    name: "Gemini 2.0 Flash",
    id: "google/gemini-2.0-flash-exp:free",
    icon: <MessageCircle size={14} />
  },
  code: {
    name: "Kwaipilot: KAT-Coder-Pro V1",
    id: "mistralai/mistral-7b-instruct:free",
    icon: <Code size={14} />
  },
  deep: {
    name: "TNG: DeepSeek R1T2 Chimera",
    id: "gryphe/mythomax-l2-13b:free",
    icon: <BrainCircuit size={14} />
  },
  fast: {
    name: "NVIDIA Nemotron Nano",
    id: "google/gemma-7b-it:free",
    icon: <Wind size={14} />
  },
  vision: {
    name: "Gemini 2.0 Flash (Free)",
    id: "google/gemini-2.0-flash-exp:free",
    icon: <Eye size={14} />
  },
  image: {
    name: "DarkPixels Imagine",
    id: "pollinations",
    icon: <Palette size={14} />
  }
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
const API_BASE_URL = '/api'; // Relative access for Vercel/Proxy
const GOOGLE_CLIENT_ID = getEnv("VITE_GOOGLE_CLIENT_ID", "716053866816-scs2ioeb9ubdj39ffs7nitu749rp1cil.apps.googleusercontent.com");


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
  baseUrl: OPENROUTER_BASE_URL,
  model: FREE_MODELS.general.id,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  autoRoute: true,
};

// --- Helper Functions ---
const detectIntent = (text: string, appMode: AppMode, hasImage: boolean): string => {
  if (appMode === 'canvas') return FREE_MODELS.code.id;
  if (appMode === 'image') return FREE_MODELS.image.id;
  if (hasImage) return FREE_MODELS.vision.id;

  const t = text.toLowerCase();

  if (/(create|gen|make|mack|draw|render|vis|paint|sketch).*(img|image|iamge|pic|photo|paint|art|draw|illust|sketch)/.test(t) ||
    /(draw|gen|create|make).*(bird|dog|cat|landscape|city|person|logo|icon|background|scene|character)/.test(t)) {
    return FREE_MODELS.image.id;
  }

  if (/(create|build|make|generate).*(app|website|game|dashboard|interface|ui|clone)/.test(t)) {
    return FREE_MODELS.code.id;
  }
  if (/(code|function|script|react|html|css|python|javascript|typescript|java|c\+\+|fix|debug|error|compiler|api|endpoint|json|xml)/.test(t)) {
    return FREE_MODELS.code.id;
  }
  if (/(analyze|why|explain|theory|complex|history|story|roleplay|essay|detailed|break down|philosophy)/.test(t)) {
    return FREE_MODELS.deep.id;
  }
  if (/(quick|short|brief|summary|summarize|fast|simple|translate|define)/.test(t)) {
    return FREE_MODELS.fast.id;
  }

  return FREE_MODELS.general.id;
};

const extractCodeBlock = (content: string): string | null => {
  const pattern = '`' + '`' + '`' + '(?:html|javascript|js|react|tsx|css)?\\s*([\\s\\S]*?)' + '`' + '`' + '`';
  const codeBlockRegex = new RegExp(pattern);
  const match = content.match(codeBlockRegex);
  return match ? match[1] : null;
};

// Unified Yellow/Black Theme
const getModeColors = (_mode: AppMode) => {
  return {
    text: 'text-yellow-500',
    bg: 'bg-yellow-500',
    border: 'border-yellow-500/50',
    focus: 'focus-within:ring-yellow-500/50 focus-within:border-yellow-500/50',
    shadow: 'shadow-yellow-900/20',
    badge: 'bg-yellow-500/20'
  };
};

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
    default: return <img src="/logo.png" alt="Logo" className="w-[10px] h-[10px] object-contain" />;
  }
};

// --- Local Storage Helpers ---
const GUEST_THREADS_KEY = 'dp_guest_threads';
const getGuestMessagesKey = (id: string) => `dp_guest_msgs_${id}`;

// --- Components ---

const CanvasPanel = ({ code, onClose }: { code: string, onClose: () => void }) => {
  const [view, setView] = useState<'preview' | 'code'>('preview');

  return (
    <div className="fixed inset-0 z-50 md:static md:inset-auto md:flex-1 md:flex md:flex-col md:h-full bg-[#0a0a0a] border-l border-gray-800 animate-in slide-in-from-right duration-300 flex flex-col">
      {/* Canvas Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-yellow-500/20 rounded-md">
            <LayoutTemplate size={16} className="text-yellow-500" />
          </div>
          <span className="text-sm font-bold text-gray-200">Canvas</span>

          <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800 ml-4">
            <button
              onClick={() => setView('preview')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'preview' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Eye size={12} /> Preview
            </button>
            <button
              onClick={() => setView('code')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${view === 'code' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <FileCode size={12} /> Code
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const blob = new Blob([code], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'darkpixels-app.html';
              a.click();
            }}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Download HTML"
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Close Canvas"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Canvas Content */}
      <div className="flex-1 bg-[#121212] overflow-hidden relative">
        {view === 'preview' ? (
          <iframe
            srcDoc={code}
            className="w-full h-full border-none bg-white"
            title="App Preview"
            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
          />
        ) : (
          <div className="w-full h-full overflow-auto p-4">
            <pre className="font-mono text-xs md:text-sm text-gray-300 whitespace-pre-wrap">{code}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

const AuthScreen = ({ onGuest, onGoogleLoginSuccess }: { onGuest: () => void, onGoogleLoginSuccess: (user: any) => void }) => {
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Fetch user info from Google
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const info = await res.json();
        onGoogleLoginSuccess(info);
      } catch (error) {
        console.error("Failed to fetch user info", error);
        alert("Login Failed");
      }
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
          <button
            onClick={() => login()}
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-800"></div>
            <span className="flex-shrink-0 mx-4 text-gray-600 text-xs">OR</span>
            <div className="flex-grow border-t border-gray-800"></div>
          </div>

          <button
            onClick={onGuest}
            className="w-full bg-gray-900 text-gray-400 font-medium py-4 rounded-xl hover:bg-gray-800 transition-all border border-gray-800 hover:border-gray-700 flex items-center justify-center gap-2"
          >
            <UserIcon size={20} />
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  isOpen,
  onCloseMobile,
  onDeleteThread,
  appMode
}: any) => {
  const sidebarClasses = isOpen
    ? "w-64 translate-x-0"
    : "w-0 -translate-x-full overflow-hidden opacity-0 md:opacity-100 md:w-0";

  // const colors = getModeColors(appMode);

  // Filters
  const devThreads = threads.filter((t: Thread) => t.type === 'dev');
  const imageThreads = threads.filter((t: Thread) => t.type === 'image');
  const chatThreads = threads.filter((t: Thread) => !t.type || t.type === 'chat');

  const ThreadItem = ({ thread, active, icon }: { thread: Thread, active: boolean, icon: React.ReactNode }) => {
    return (
      <div
        key={thread.id}
        onClick={() => { onSelectThread(thread.id); onCloseMobile(); }}
        className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all text-sm mb-1
          ${active
            ? `bg-yellow-500/20 text-yellow-500 border border-yellow-500/50`
            : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'}
        `}
      >
        {icon}
        <span className="truncate flex-1">{thread.title || 'New Chat'}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  };

  return (
    <div className={`
      fixed inset-y-0 left-0 z-40 bg-[#050505] border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out
      md:relative md:translate-x-0 ${sidebarClasses}
    `}>
      <div className="p-4 border-b border-gray-800/50 flex flex-col gap-4">
        <div className="flex items-center gap-3 px-1">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover shadow-lg" />
          <span className="font-bold text-lg tracking-tight text-white italic">DarkPixels AI</span>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={onNewChat}
            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center gap-2 text-sm font-medium border whitespace-nowrap
               bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/20
             `}
          >
            <Plus size={16} /> New {appMode === 'canvas' ? 'Project' : (appMode === 'image' ? 'Image' : 'Chat')}
          </button>
          <button onClick={onCloseMobile} className="md:hidden p-2 text-gray-500">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-800">

        {/* Canvas Projects Section */}
        {devThreads.length > 0 && (
          <div className="mb-6">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={10} /> Canvas Projects
            </div>
            {devThreads.map((thread: Thread) => (
              <ThreadItem key={thread.id} thread={thread} active={activeThreadId === thread.id} icon={<Layout size={14} className="flex-shrink-0" />} />
            ))}
          </div>
        )}

        {/* Image Galleries Section */}
        {imageThreads.length > 0 && (
          <div className="mb-6">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Palette size={10} /> Galleries
            </div>
            {imageThreads.map((thread: Thread) => (
              <ThreadItem key={thread.id} thread={thread} active={activeThreadId === thread.id} icon={<ImageIcon size={14} className="flex-shrink-0" />} />
            ))}
          </div>
        )}

        {/* Conversation History Section (Standard Chats) */}
        <div>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <History size={10} /> Conversation History
          </div>
          {chatThreads.map((thread: Thread) => (
            <ThreadItem key={thread.id} thread={thread} active={activeThreadId === thread.id} icon={<MessageSquareText size={14} className="flex-shrink-0" />} />
          ))}
          {chatThreads.length === 0 && devThreads.length === 0 && imageThreads.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-600 italic">No history yet</div>
          )}
        </div>

      </div>
    </div>
  );
};

const MessageBubble = ({ message, onPreview, appMode }: { message: Message, onPreview: (code: string) => void, appMode: AppMode }) => {
  const isUser = message.role === 'user';
  const colors = getModeColors(appMode);

  // Local state for image loading
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Safety timeout for stuck loading - force show error or fallback if too long
  useEffect(() => {
    if (!imgLoaded && !imgError && message.role !== 'user') {
      const timer = setTimeout(() => {
        setImgLoaded(true);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [imgLoaded, imgError, message]);

  // Retry Handler
  const handleRetry = (url: string) => {
    setImgError(false);
    setImgLoaded(false);
    const newUrl = url.includes('seed') ? url + '1' : url + '&retry=' + Date.now();
    setTimeout(() => {
      const img = new Image();
      img.src = newUrl;
    }, 100);
  };

  // Download Handler
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `darkpixels-image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed", err);
      window.open(url, '_blank');
    }
  };

  const renderContent = (content: string | any[]) => {
    let text = "";
    if (Array.isArray(content)) {
      const textPart = content.find(c => c.type === 'text');
      text = textPart ? textPart.text : "";
    } else {
      text = content;
    }

    const imageMatch = text.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch && !isUser) {
      return (
        <div className="my-2 group relative inline-block">
          {!imgLoaded && !imgError && (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-yellow-500/30 bg-yellow-900/10 text-yellow-500 text-xs font-mono mb-2 animate-pulse">
              <Loader2 size={16} className="animate-spin" />
              <span>Wait, the image is loading...</span>
            </div>
          )}
          {imgError && (
            <div className="flex items-center justify-between gap-2 p-4 rounded-xl border border-red-500/30 bg-red-900/10 text-red-400 text-xs font-mono mb-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <span>Failed to load image.</span>
              </div>
              <button
                onClick={() => handleRetry(imageMatch[2])}
                className="flex items-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 transition-colors"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          )}
          <img
            src={imageMatch[2]}
            alt={imageMatch[1] || "Generated Image"}
            className={`max-w-full rounded-xl border border-gray-800 shadow-lg cursor-pointer hover:scale-[1.01] transition-transform ${!imgLoaded || imgError ? 'hidden' : 'block'}`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgError(true); setImgLoaded(true); }}
            onClick={() => window.open(imageMatch[2], '_blank')}
          />

          {/* Image Actions Overlay */}
          {imgLoaded && !imgError && (
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleDownload(imageMatch[2])}
                className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
                title="Download Image"
              >
                <Download size={14} />
              </button>
            </div>
          )}

          {imgLoaded && !imgError && <p className="text-xs text-gray-500 mt-2">{text.replace(imageMatch[0], '')}</p>}
        </div>
      );
    }

    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeContent = part.slice(3, -3).replace(/^[a-z]+\n/, '');

        if (appMode === 'canvas') {
          return (
            <div key={index} className="my-3 p-4 rounded-xl bg-yellow-900/10 border border-yellow-500/30 flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Sparkles size={20} className="text-yellow-500 animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white">App Generated</h4>
                <p className="text-xs text-yellow-300">Code is ready in the Canvas panel.</p>
              </div>
              <button
                onClick={() => onPreview(codeContent)}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold rounded-lg transition-colors"
              >
                View Canvas
              </button>
            </div>
          );
        }

        return (
          <div key={index} className="my-3 overflow-hidden rounded-md bg-black border border-gray-800">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
              <span className="text-xs font-mono text-gray-400">Code</span>
              <button
                onClick={() => navigator.clipboard.writeText(codeContent)}
                className="text-xs text-yellow-500 hover:text-yellow-400"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300">
              {codeContent}
            </pre>
          </div>
        );
      }
      // Regular text
      return (
        <div key={index} className="whitespace-pre-wrap relative group">
          {part}
          {/* Message Copy Button */}
          {part.trim().length > 0 && !isUser && (
            <button
              onClick={() => navigator.clipboard.writeText(part)}
              className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-yellow-500 transition-all p-1"
              title="Copy text"
            >
              <Copy size={12} />
            </button>
          )}
        </div>
      );
    });
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`
          relative px-5 py-4 rounded-2xl shadow-lg backdrop-blur-sm group
          ${isUser
            ? `${colors.bg} text-black rounded-br-none font-medium`
            : 'bg-gray-800/80 border border-gray-700 text-gray-100 rounded-bl-none'}
        `}>
          {message.role === 'assistant' && (
            <div className="absolute -top-6 left-0 flex items-center gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border
                ${colors.badge} ${colors.border}
              `}>
                {getModeIcon(appMode)}
              </div>
              <span className={`text-xs font-medium ${colors.text}`}>
                {getModeName(appMode)}
              </span>
            </div>
          )}
          <div className="leading-relaxed text-sm md:text-base">
            {renderContent(message.content)}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({
  isOpen,
  onClose,
  settings,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
}) => {
  const [localSettings, setLocalSettings] = useState(settings);
  useEffect(() => setLocalSettings(settings), [settings, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-5 h-5 rounded-md object-cover" /> Configuration
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Parameters</h3>

            <div className="flex items-center justify-between bg-gray-950 p-3 rounded-lg border border-gray-800">
              <span className="text-sm text-gray-300">Auto-Select Model?</span>
              <button
                onClick={() => setLocalSettings(s => ({ ...s, autoRoute: !s.autoRoute }))}
                className={`w-12 h-6 rounded-full p-1 transition-colors relative ${localSettings.autoRoute ? 'bg-yellow-500' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${localSettings.autoRoute ? 'translate-x-6' : 'translate-x-0'} `} />
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Persona</h3>
            <textarea
              value={localSettings.systemPrompt}
              onChange={(e) => setLocalSettings({ ...localSettings, systemPrompt: e.target.value })}
              rows={4}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none resize-none text-sm"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-900">
          <button
            onClick={() => { onSave(localSettings); onClose(); }}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg shadow-lg shadow-yellow-900/20"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

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
  const [pendingFile, setPendingFile] = useState<{ name: string, content: string, type: 'image' | 'text' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Check for existing session
  useEffect(() => {
    const savedUser = localStorage.getItem('dp_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setAuthState('user');
      } catch (e) {
        setAuthState('auth');
      }
    } else {
      setAuthState('auth');
    }
  }, []);

  // 2. Load Threads
  const fetchThreads = async () => {
    if (authState === 'user' && user) {
      try {
        const res = await fetch(`${API_BASE_URL}/threads?userId=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setThreads(data);
        }
      } catch (e) {
        console.error("Threads fetch failed", e);
      }
    } else if (authState === 'guest') {
      const localThreads = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
      localThreads.sort((a: Thread, b: Thread) => b.createdAt - a.createdAt);
      setThreads(localThreads);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [authState, user]);

  // 3. Load Messages
  const loadMessages = async () => {
    if (!currentThreadId) {
      setMessages([]);
      return;
    }

    if (authState === 'user' && user) {
      try {
        const res = await fetch(`${API_BASE_URL}/threads/${currentThreadId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (e) {
        console.error("Messages fetch failed", e);
      }
    } else if (authState === 'guest') {
      const msgs = JSON.parse(localStorage.getItem(getGuestMessagesKey(currentThreadId)) || '[]');
      msgs.sort((a: Message, b: Message) => a.timestamp - b.timestamp);
      setMessages(msgs);
    }
  };

  useEffect(() => {
    loadMessages();
    // Optional: Polling for real-time updates if needed
    let interval: any;
    if (authState === 'user' && currentThreadId) {
      interval = setInterval(loadMessages, 5000);
    }
    return () => clearInterval(interval);
  }, [authState, user, currentThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* const handleLogin = () => {
    signInAnonymously(auth);
  }; */

  const handleLogsout = () => {
    localStorage.removeItem('dp_user');
    setUser(null);
    setAuthState('auth');
    setMessages([]);
    setThreads([]);
  };

  const handleGoogleLoginSuccess = async (googleUser: any) => {
    // Send to backend to sync
    const userData: User = {
      uid: googleUser.sub,
      email: googleUser.email,
      displayName: googleUser.name,
      photoURL: googleUser.picture
    };

    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      if (res.ok) {
        setUser(userData);
        localStorage.setItem('dp_user', JSON.stringify(userData));
        setAuthState('user');
      }
    } catch (e) {
      console.error("Sync user failed", e);
    }
  };

  const handleGuest = () => {
    setAuthState('guest');
    const localThreads = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
    setThreads(localThreads);

    if (localThreads.length > 0) {
      setCurrentThreadId(null);
      setMessages([{
        id: 'init', role: 'assistant', content: 'Hi, I am DarkPixels AI. How can I help you?', timestamp: Date.now()
      }]);
    } else {
      createNewChat('chat');
    }
  };

  const handleThreadSelect = (threadId: string) => {
    const selectedThread = threads.find(t => t.id === threadId);
    if (selectedThread) {
      const targetMode = selectedThread.type === 'dev' ? 'canvas' : (selectedThread.type === 'image' ? 'image' : 'chat');
      setAppMode(targetMode);
      setCurrentThreadId(threadId);
      setPreviewCode(null);
    }
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const switchMode = (targetMode: AppMode) => {
    if (appMode === targetMode) return;

    setPreviewCode(null);
    setPendingFile(null);
    setInput('');

    const hasUserMessages = messages.some(m => m.role === 'user');

    if (!hasUserMessages && currentThreadId) {
      // Reuse logic
      setAppMode(targetMode);
      const newType = targetMode === 'canvas' ? 'dev' : (targetMode === 'image' ? 'image' : 'chat');
      const newTitle = targetMode === 'canvas' ? 'New Project' : (targetMode === 'image' ? 'New Image' : 'New Chat');

      setMessages([{
        id: generateId(),
        role: 'assistant',
        content: `Hi, I am ${getModeName(targetMode)}. How can I help you?`,
        timestamp: Date.now()
      }]);

      if (authState === 'user' && user) {
        fetch(`${API_BASE_URL}/threads/${currentThreadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        }).then(fetchThreads);
      } else {
        const updatedThreads = threads.map(t =>
          t.id === currentThreadId ? { ...t, type: newType as any, title: newTitle } : t
        );
        setThreads(updatedThreads);
        localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(updatedThreads));
      }
    } else {
      createNewChat(targetMode);
    }
  };

  const createNewChat = async (targetMode: AppMode) => {
    setAppMode(targetMode);

    const type = targetMode === 'canvas' ? 'dev' : (targetMode === 'image' ? 'image' : 'chat');
    const title = targetMode === 'canvas' ? 'New Project' : (targetMode === 'image' ? 'New Image' : 'New Chat');

    if (authState === 'user' && user) {
      try {
        const res = await fetch(`${API_BASE_URL}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, title: title })
        });
        if (res.ok) {
          const newThread = await res.json();
          setCurrentThreadId(newThread.id);
          fetchThreads();
        }
      } catch (e) {
        console.error("Create thread failed", e);
      }
    } else {
      const newId = generateId();
      const newThread: Thread = {
        id: newId,
        title: title,
        createdAt: Date.now(),
        type: type
      };

      const updatedThreads = [newThread, ...threads];
      setThreads(updatedThreads);
      localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(updatedThreads));

      setCurrentThreadId(newId);

      const initialMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Hi, I am ${getModeName(targetMode)}. How can I help you?`,
        timestamp: Date.now()
      };

      setMessages([initialMsg]);
      localStorage.setItem(getGuestMessagesKey(newId), JSON.stringify([initialMsg]));
    }
    setPreviewCode(null);
  };

  const deleteThread = async (threadId: string) => {
    if (authState === 'user' && user) {
      await fetch(`${API_BASE_URL}/threads/${threadId}`, { method: 'DELETE' });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        setMessages([]);
        setPreviewCode(null);
      }
    } else {
      const updatedThreads = threads.filter(t => t.id !== threadId);
      setThreads(updatedThreads);
      localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(updatedThreads));
      localStorage.removeItem(getGuestMessagesKey(threadId));

      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        setMessages([]);
        setPreviewCode(null);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setPendingFile({
            name: file.name,
            content: content,
            type: 'image'
          });
        }
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setPendingFile({
            name: file.name,
            content: content,
            type: 'text'
          });
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !pendingFile) || isLoading) return;

    // Allow Image Mode to proceed without API key since it uses Pollinations (Free)
    if (!API_KEY && appMode !== 'image') {
      const devMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: "⚠️ **System Error:** API Key Missing. Please switch to 'Image' mode or provide a key.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, devMsg]);
      return;
    }

    const text = input;
    const currentFile = pendingFile;

    setInput('');
    setPendingFile(null);
    setIsLoading(true);
    setLoadingText("DarkPixels is thinking...");

    let selectedModel = settings.model;
    const hasImage = currentFile?.type === 'image';

    // Auto-routing logic based on App Mode
    if (appMode === 'canvas') {
      selectedModel = FREE_MODELS.code.id;
      setLoadingText("Building App...");
    } else if (appMode === 'image') {
      selectedModel = FREE_MODELS.image.id;
      setLoadingText("DarkPixels AI is generating your image...");
    } else if (settings.autoRoute) {
      selectedModel = detectIntent(text, 'chat', hasImage);
      if (selectedModel === FREE_MODELS.image.id) setLoadingText("DarkPixels AI is generating your image...");
    }

    let activeThreadId = currentThreadId;

    if (messages.length <= 1 && activeThreadId) {
      const titleText = text || (currentFile ? `File: ${currentFile.name}` : 'New Chat');
      const newTitle = titleText.slice(0, 30) + (titleText.length > 30 ? '...' : '');

      const type = appMode === 'canvas' ? 'dev' : (appMode === 'image' ? 'image' : 'chat');

      if (authState === 'user' && user) {
        fetch(`${API_BASE_URL}/threads/${activeThreadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        }).then(fetchThreads);
      } else {
        const updatedThreads = threads.map(t =>
          t.id === activeThreadId ? { ...t, title: newTitle, type: type } : t
        ) as Thread[];
        setThreads(updatedThreads);
        localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(updatedThreads));
      }
    }

    let uiContent = text;
    if (currentFile) {
      if (currentFile.type === 'text') {
        uiContent = (text ? text + '\n\n' : '') + `--- BEGIN FILE: ${currentFile.name} ---\n${currentFile.content}\n--- END FILE ---`;
      } else {
        uiContent = (text ? text + '\n\n' : '') + `[User uploaded image: ${currentFile.name}]`;
      }
    }

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: uiContent,
      timestamp: Date.now()
    };

    // Helper to safely save message
    const saveMessage = async (msg: Message) => {
      if (authState === 'user' && user && activeThreadId) {
        try {
          await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              threadId: activeThreadId,
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              modelUsed: msg.modelUsed
            })
          });
        } catch (e) { console.error("Message Save Error (Ignored)", e); }
      } else if (activeThreadId) {
        const currentLsMsgs = JSON.parse(localStorage.getItem(getGuestMessagesKey(activeThreadId)) || '[]');
        const newLsMsgs = [...currentLsMsgs, msg];
        localStorage.setItem(getGuestMessagesKey(activeThreadId), JSON.stringify(newLsMsgs));
      }
    };

    // Optimistically update UI
    setMessages(prev => [...prev, userMsg]);
    saveMessage(userMsg);

    try {
      const activeSystemPrompt = appMode === 'canvas' ? DEV_MODE_SYSTEM_PROMPT : settings.systemPrompt;

      // POLLINATIONS - DIRECT IMAGE GENERATION (NO DELAY)
      if (selectedModel === FREE_MODELS.image.id) {
        const safePrompt = encodeURIComponent(text + " realistic high quality minimal watermark");
        const seed = Math.floor(Math.random() * 1000000);
        // Pollinations Direct URL
        const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?nologo=true&seed=${seed}`;

        // Instant return, handled by Image Loader in Bubble
        const aiText = `Here is your image based on "${text}":\n\n![Generated Image](${imageUrl})`;

        const aiMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: aiText,
          timestamp: Date.now(),
          modelUsed: selectedModel
        };

        setMessages(prev => [...prev, aiMsg]);
        saveMessage(aiMsg);

        setIsLoading(false);
        return;
      }

      // STANDARD CHAT / VISION
      let apiContent: any = text;
      if (currentFile?.type === 'image') {
        apiContent = [
          { type: "text", text: text || "Analyze this image." },
          { type: "image_url", image_url: { url: currentFile.content } }
        ];
      } else if (currentFile?.type === 'text') {
        apiContent = (text ? text + '\n\n' : '') + `--- BEGIN FILE: ${currentFile.name} ---\n${currentFile.content}\n--- END FILE ---`;
      }

      const apiMessages = [
        { role: 'system', content: activeSystemPrompt },
        ...messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        { role: 'user', content: apiContent }
      ];

      const res = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://darkpixels.app',
          'X-Title': 'DarkPixels'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          temperature: appMode === 'canvas' ? 0.2 : settings.temperature
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      const aiText = data.choices[0]?.message?.content || "No response.";

      if (appMode === 'canvas') {
        const extracted = extractCodeBlock(aiText);
        if (extracted) {
          setPreviewCode(extracted);
        }
      }

      const aiMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: aiText,
        timestamp: Date.now(),
        modelUsed: selectedModel
      };

      setMessages(prev => [...prev, aiMsg]);
      saveMessage(aiMsg);

    } catch (err: any) {
      let errorText = `Error: ${err.message}`;
      if (err.message.includes('402')) errorText = "Error: Model busy or credit limit reached. Try again later.";

      const errorMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: errorText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const activeColors = getModeColors(appMode);

  if (authState === 'loading') return <div className="h-screen bg-black flex items-center justify-center text-gray-500">Loading Core Systems...</div>;
  if (authState === 'auth') return <AuthScreen onGoogleLoginSuccess={handleGoogleLoginSuccess} onGuest={handleGuest} />;

  return (
    <div className="flex h-screen bg-[#050505] text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      {authState === 'user' || authState === 'guest' ? (
        <Sidebar
          isOpen={isSidebarOpen}
          threads={threads}
          activeThreadId={currentThreadId}
          onSelectThread={handleThreadSelect}
          onNewChat={() => switchMode(appMode)}
          onDeleteThread={deleteThread}
          onCloseMobile={() => setIsSidebarOpen(false)}
          appMode={appMode}
        />
      ) : null}

      {/* Split Pane: Chat + Canvas */}
      <div className="flex-1 flex overflow-hidden">

        {/* Main Chat Panel */}
        <div className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${previewCode ? 'border-r border-gray-800' : ''}`}>

          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#050505]/95 backdrop-blur z-10">
            <div className="flex items-center gap-3">
              <button
                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title={isSidebarOpen ? "Close Sidebar" : "Open History"}
              >
                <SidebarIcon size={20} />
              </button>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-colors duration-500 overflow-hidden
                ${activeColors.bg} ${activeColors.shadow}
              `}>
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div className="hidden sm:block">
                <h1 className={`font-bold tracking-tight ${activeColors.text}`}>
                  {getModeName(appMode)}
                </h1>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="bg-gray-900 p-1 rounded-lg flex items-center border border-gray-800 overflow-x-auto">
              <button
                onClick={() => switchMode('chat')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2
                   ${appMode === 'chat' ? 'bg-yellow-500 text-black shadow' : 'text-gray-400 hover:text-white'}
                 `}
              >
                <MessageSquareText size={12} /> Chat
              </button>
              <button
                onClick={() => switchMode('canvas')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2
                   ${appMode === 'canvas' ? 'bg-yellow-500 text-black shadow' : 'text-gray-400 hover:text-white'}
                 `}
              >
                <Sparkles size={12} /> Canvas
              </button>
              <button
                onClick={() => switchMode('image')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2
                   ${appMode === 'image' ? 'bg-yellow-500 text-black shadow' : 'text-gray-400 hover:text-white'}
                 `}
              >
                <Palette size={12} /> Image
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><Settings size={20} /></button>
              <button onClick={handleLogsout} className="p-2 hover:bg-gray-800 rounded-lg text-red-400" title="Sign Out"><LogOut size={20} /></button>
            </div>
          </header>

          {/* Chat Scroll Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-gray-800">
            <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end pb-4">
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 space-y-4 opacity-50">
                  {appMode === 'canvas' ? (
                    <>
                      <LayoutTemplate size={48} className="text-yellow-500/50" />
                      <p className="text-yellow-500/50">DarkPixels Canvas Mode Active</p>
                      <p className="text-sm">Ask to "Build a website" or "Create a game"</p>
                    </>
                  ) : appMode === 'image' ? (
                    <>
                      <Palette size={48} className="text-yellow-500/50" />
                      <p className="text-yellow-500/50">DarkPixels Imagine Mode Active</p>
                      <p className="text-sm">Describe an image to generate it instantly</p>
                    </>
                  ) : (
                    <>
                      <img src="/logo.png" alt="Logo" className="w-12 h-12 rounded-xl mb-2 opacity-80" />
                      <p>Start a new conversation</p>
                    </>
                  )}
                </div>
              )}
              {messages.map(m => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onPreview={(code) => setPreviewCode(code)}
                  appMode={appMode}
                />
              ))}
              {isLoading && (
                <div className={`ml-4 text-xs animate-pulse text-yellow-500 flex items-center gap-2`}>
                  <Loader2 size={12} className="animate-spin" /> {loadingText}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input */}
          <footer className="p-4 border-t border-gray-800 bg-[#050505]">
            <div className={`max-w-3xl mx-auto relative flex flex-col gap-2 bg-gray-900/50 border rounded-2xl p-2 focus-within:ring-2 transition-all
               ${activeColors.border} ${activeColors.focus}
            `}>
              {/* File Preview Area */}
              {pendingFile && (
                <div className="flex items-center gap-3 p-2 mx-2 mt-1 mb-1 bg-black/40 rounded-lg w-fit border border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                  {pendingFile.type === 'image' ? (
                    <div className="relative group">
                      <img src={pendingFile.content} alt="Preview" className="h-14 w-14 object-cover rounded-md border border-gray-600" />
                    </div>
                  ) : (
                    <div className="h-14 w-14 flex items-center justify-center bg-gray-800 rounded-md border border-gray-600">
                      <FileText size={24} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-200 max-w-[150px] truncate">{pendingFile.name}</span>
                    <span className="text-[10px] text-gray-500">{pendingFile.type === 'image' ? 'Image' : 'Document'}</span>
                  </div>
                  <button
                    onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white ml-2"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".txt,.md,.js,.ts,.tsx,.py,.html,.css,.json,.csv,.jpg,.jpeg,.png,.gif,.webp"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-gray-500 hover:text-gray-300 transition-colors"
                  title="Upload Document or Image"
                >
                  <Paperclip size={20} />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder={appMode === 'canvas' ? "Describe the app you want to build..." : (appMode === 'image' ? "Describe the image you want to create..." : "Message DarkPixels...")}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 resize-none py-3 max-h-32 min-h-[44px]"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !pendingFile)}
                  className={`p-3 rounded-xl transition-all font-bold 
                    ${(input.trim() || pendingFile)
                      ? `${activeColors.bg} text-black shadow-lg shadow-yellow-900/20`
                      : 'bg-gray-800 text-gray-500'}
                  `}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </footer>
        </div>

        {/* Canvas Panel (Right Side Split) */}
        {previewCode && (
          <div className="fixed inset-0 z-50 md:static md:inset-auto md:w-1/2 md:min-w-[400px] md:h-full flex flex-col border-l border-gray-800 bg-[#0a0a0a] shadow-2xl transition-all duration-300 ease-in-out">
            <CanvasPanel
              code={previewCode}
              onClose={() => setPreviewCode(null)}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
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

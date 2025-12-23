import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Settings, Paperclip, Image as ImageIcon,
  FileText, X,
  Download, Trash2,
  Code, Wind, MessageCircle, BrainCircuit,
  Plus, Sidebar as SidebarIcon, User as UserIcon, LogOut, LogIn,
  LayoutTemplate, Sparkles,
  Eye, FileCode, Layout, MessageSquareText, History,
  Palette, Loader2, AlertCircle, RefreshCw, Copy, UserCheck, Square
} from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

/**
 * DARKPIXELS - Advanced AI Interface
 */
const getEnv = (key: string, fallback: string) => {
  const viteKey = key.startsWith('REACT_APP_') ? key.replace('REACT_APP_', 'VITE_') : key;

  // Check for various ways Vite/Vercel might expose these
  return import.meta.env[viteKey] ||
    import.meta.env[key] ||
    (key === 'REACT_APP_CUSTOM_API_URL' ? import.meta.env.VITE_CUSTOM_API_URL || import.meta.env.REACT_APP_CUSTOM_API_URL : null) ||
    (key === 'REACT_APP_CUSTOM_API_KEY' ? import.meta.env.VITE_CUSTOM_API_KEY || import.meta.env.REACT_APP_CUSTOM_API_KEY : null) ||
    (key === 'REACT_APP_TEXT_MODEL_ID' ? import.meta.env.VITE_TEXT_MODEL_ID || import.meta.env.REACT_APP_TEXT_MODEL_ID : null) ||
    (key === 'REACT_APP_FALLBACK_MODEL_ID' ? import.meta.env.VITE_FALLBACK_MODEL_ID || import.meta.env.REACT_APP_FALLBACK_MODEL_ID : null) ||
    (key === 'REACT_APP_IMAGE_MODEL_ID' ? import.meta.env.VITE_IMAGE_MODEL_ID || import.meta.env.REACT_APP_IMAGE_MODEL_ID : null) ||
    fallback;
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

// 1. API URL (OpenRouter)
const API_URL = getEnv("REACT_APP_CUSTOM_API_URL", "https://openrouter.ai/api/v1/chat/completions");

// 2. API KEY (OpenRouter Key)
const API_KEY = getEnv("REACT_APP_CUSTOM_API_KEY", "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");

// 3. PRIMARY MODEL
const PRIMARY_MODEL = getEnv("REACT_APP_TEXT_MODEL_ID", "mistralai/mistral-7b-instruct:free");

// 4. FALLBACK MODELS (Tried in order if primary fails)
const FALLBACK_MODELS = (getEnv("REACT_APP_FALLBACK_MODEL_ID", "") || "")
  .split(',')
  .map((m: string) => m.trim())
  .filter(Boolean);

// 5. IMAGE MODEL (Pollinations)
const IMAGE_MODEL_ID = getEnv("REACT_APP_IMAGE_MODEL_ID", "pollinations");

// 6. BACKEND API BASE URL
const API_BASE_URL = '/api';

const GOOGLE_CLIENT_ID = getEnv("VITE_GOOGLE_CLIENT_ID", "");

// ==================================================================================


// --- Dynamic Model Configuration ---
const MODELS = {
  general: { name: "DarkPixels AI", id: PRIMARY_MODEL, icon: <MessageCircle size={14} /> },
  code: { name: "DarkPixels AI", id: PRIMARY_MODEL, icon: <Code size={14} /> },
  deep: { name: "DarkPixels AI", id: PRIMARY_MODEL, icon: <BrainCircuit size={14} /> },
  fast: { name: "DarkPixels AI", id: PRIMARY_MODEL, icon: <Wind size={14} /> },
  vision: { name: "DarkPixels AI", id: PRIMARY_MODEL, icon: <Eye size={14} /> },
  image: { name: "DarkPixels AI", id: IMAGE_MODEL_ID, icon: <Palette size={14} /> }
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
  baseUrl: API_URL,
  model: MODELS.general.id,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  autoRoute: true,
};

// --- Helper Functions ---
const detectIntent = (text: string, appMode: AppMode, _hasImage: boolean): string => {
  const t = text.toLowerCase();

  // 1. Image Generation Check
  const imageKeywords = [
    'create', 'gen', 'make', 'draw', 'render', 'vis', 'paint', 'sketch', 'photo',
    'illustrate', 'generate', 'imagine', 'portrait', 'wallpaper', 'logo', 'background'
  ];
  const imageSubjects = [
    'img', 'image', 'pic', 'photo', 'paint', 'art', 'draw', 'illust', 'sketch',
    'bird', 'dog', 'cat', 'landscape', 'city', 'logo', 'person', 'woman', 'man', 'car'
  ];

  const hasKeyword = imageKeywords.some(kw => t.includes(kw));
  const hasSubject = imageSubjects.some(sj => t.includes(sj));

  if (appMode === 'image' || (hasKeyword && hasSubject) || t.startsWith('/draw ') || t.startsWith('/imagine ')) {
    return MODELS.image.id;
  }

  // 2. Everything else uses the configured Primary Model
  return PRIMARY_MODEL;
};

const extractCodeBlock = (content: string): string | null => {
  const pattern = '```' + '(?:html|javascript|js|react|tsx|css)?\\s*([\\s\\S]*?)' + '```';
  const codeBlockRegex = new RegExp(pattern);
  const match = content.match(codeBlockRegex);
  return match ? match[1] : null;
};

// Helper to clean raw tokens from AI response
const cleanAIResponse = (text: string) => {
  if (!text) return "";
  return text
    .replace(/<s>/g, '')
    .replace(/<\/s>/g, '')
    .replace(/\[INST\]/g, '')
    .replace(/\[\/INST\]/g, '')
    .replace(/<system>[\s\S]*?<\/system>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/g, '')
    .replace(/<\|eot_id\|>/g, '')
    .trim();
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

const GUEST_THREADS_KEY = 'dp_guest_threads';
const getGuestMessagesKey = (id: string) => `dp_guest_msgs_${id}`;

// --- Robust Fetch Wrapper ---
const safeFetch = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Server Error: ${res.status} - ${errText}`);
  }
  const ct = res.headers.get("content-type");
  if (!ct || !ct.includes("application/json")) {
    return null;
  }
  return res.json();
};

// --- Components ---

const CanvasPanel = ({ code, onClose }: { code: string, onClose: () => void }) => {
  const [view, setView] = useState<'preview' | 'code'>('preview');

  return (
    <div className="fixed inset-0 z-50 md:static md:inset-auto md:flex-1 md:flex md:flex-col md:h-full bg-[#0a0a0a] border-l border-gray-800 animate-in slide-in-from-right duration-300 flex flex-col">
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

const AuthScreen = ({ onGoogleLogin, onGuest }: { onGoogleLogin: () => void, onGuest: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] p-4">
    <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-2xl bg-black border border-gray-800 flex items-center justify-center shadow-lg shadow-yellow-900/10 mb-6 overflow-hidden">
        <img src="/logo.png" alt="DarkPixels Logo" className="w-full h-full object-contain" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">DarkPixels AI</h1>
      <p className="text-gray-500 mb-8">Unrestricted Intelligence Interface</p>

      <div className="w-full space-y-4">
        <button
          onClick={onGoogleLogin}
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
    ? "w-72 translate-x-0 z-[60]"
    : "w-0 -translate-x-full overflow-hidden opacity-0 md:opacity-100 md:w-0";

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
      <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
        <button
          onClick={() => { onNewChat(); onCloseMobile(); }}
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

const MessageBubble = ({ message, onPreview, appMode, onRetry }: { message: Message, onPreview: (code: string) => void, appMode: AppMode, onRetry?: (content: string) => void }) => {
  const isUser = message.role === 'user';

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [watermarkedUrl, setWatermarkedUrl] = useState<string | null>(null);

  const bakeWatermark = async (url: string) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return url;

      ctx.drawImage(img, 0, 0);

      const logo = new Image();
      logo.src = '/logo.png';
      await new Promise(res => { logo.onload = res; logo.onerror = res; });

      const padding = canvas.width * 0.02;
      const h = canvas.height * 0.045;
      const ctxFont = `bold ${h * 0.45}px monospace`;
      ctx.font = ctxFont;
      const tw = ctx.measureText('DARKPIXELS AI').width;
      const ls = h * 0.65;
      const bw = ls + tw + (h * 0.4 * 3);
      const bx = canvas.width - bw - padding;
      const by = canvas.height - h - padding;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, h, 8); else ctx.rect(bx, by, bw, h);
      ctx.fill();

      ctx.drawImage(logo, bx + (h * 0.4), by + (h - ls) / 2, ls, ls);
      ctx.fillStyle = '#EAB308';
      ctx.textBaseline = 'middle';
      ctx.fillText('DARKPIXELS AI', bx + ls + (h * 0.4 * 1.5), by + h / 2);

      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error("Watermarking failed", e);
      return url;
    }
  };

  useEffect(() => {
    if (!imgLoaded && !imgError && message.role !== 'user') {
      const timer = setTimeout(() => { setImgLoaded(true); }, 30000);
      return () => clearTimeout(timer);
    }
  }, [imgLoaded, imgError, message]);

  const handleRetry = (url: string) => {
    setImgError(false);
    setImgLoaded(false);
    const newUrl = url.includes('seed') ? url + '1' : url + '&retry=' + Date.now();
    setTimeout(() => {
      const img = new Image();
      img.src = newUrl;
    }, 100);
  };

  const handleDownload = async (url: string) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Setup watermark logo
      const logo = new Image();
      logo.src = '/logo.png';
      await new Promise((resolve) => {
        logo.onload = resolve;
        logo.onerror = resolve; // Continue even if logo fails
      });

      // Watermark sizing logic (responsive to image size)
      const basePadding = canvas.width * 0.02;
      const watermarkHeight = canvas.height * 0.045;
      const textPadding = watermarkHeight * 0.4;

      // Calculate text width to size the background box
      ctx.font = `bold ${watermarkHeight * 0.45}px monospace`;
      const textMetrics = ctx.measureText('DARKPIXELS AI');
      const logoSize = watermarkHeight * 0.65;
      const boxWidth = logoSize + textMetrics.width + (textPadding * 3);
      const boxHeight = watermarkHeight;

      const boxX = canvas.width - boxWidth - basePadding;
      const boxY = canvas.height - boxHeight - basePadding;

      // Draw rounded background box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      // Simple rect fallback if roundRect is not supported in some older environments
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
      } else {
        ctx.rect(boxX, boxY, boxWidth, boxHeight);
      }
      ctx.fill();

      // Draw Logo
      ctx.drawImage(logo, boxX + textPadding, boxY + (boxHeight - logoSize) / 2, logoSize, logoSize);

      // Draw Branded Text
      ctx.fillStyle = '#EAB308'; // yellow-500
      ctx.textBaseline = 'middle';
      ctx.fillText('DARKPIXELS AI', boxX + logoSize + (textPadding * 1.5), boxY + boxHeight / 2);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `darkpixels-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }, 'image/png');

    } catch (err) {
      console.error("Download failed", err);
      // Fallback to simple download if canvas fails
      const a = document.createElement('a');
      a.href = url;
      a.download = `darkpixels-${Date.now()}.jpg`;
      a.click();
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

    if (text.startsWith("Error:") || text.startsWith("⚠️") || text.includes("Payment Required")) {
      return (
        <div className="flex flex-col gap-2">
          <span className="text-red-400">{text}</span>
          {onRetry && (
            <button
              onClick={() => onRetry(text)}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium w-fit transition-colors"
            >
              <RefreshCw size={12} /> Retry Generation
            </button>
          )}
        </div>
      );
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
            src={watermarkedUrl || imageMatch[2]}
            alt={imageMatch[1] || "Generated Image"}
            className={`max-w-full rounded-xl border border-gray-800 shadow-lg select-none pointer-events-auto transition-all duration-1000 ease-in-out ${!imgLoaded || imgError ? 'opacity-0 scale-95 h-0' : 'opacity-100 scale-100 h-auto'}`}
            loading="lazy"
            onLoad={async () => {
              if (!watermarkedUrl && !imgError) {
                const baked = await bakeWatermark(imageMatch[2]);
                setWatermarkedUrl(baked);
              }
              setImgLoaded(true);
            }}
            onError={() => { setImgError(true); setImgLoaded(true); }}
          />

          {imgLoaded && !imgError && (
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleDownload(watermarkedUrl || imageMatch[2])}
                className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
                title="Download Image"
              >
                <Download size={14} />
              </button>
            </div>
          )}

          {imgLoaded && !imgError && !watermarkedUrl && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 pointer-events-none select-none overflow-hidden origin-bottom-right scale-90 md:scale-100 shadow-2xl">
              <img src="/logo.png" alt="" className="w-3.5 h-3.5 object-contain" />
              <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest leading-none">DARKPIXELS AI</span>
            </div>
          )}

          {imgLoaded && !imgError && <p className="text-xs text-gray-500 mt-2">{cleanAIResponse(text.replace(imageMatch[0], ''))}</p>}
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
            <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300">{codeContent}</pre>
          </div>
        );
      }
      return (
        <div key={index} className="whitespace-pre-wrap relative group">
          {cleanAIResponse(part)}
          {part.trim().length > 0 && !isUser && (
            <button
              onClick={() => navigator.clipboard.writeText(part)}
              className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-yellow-500 transition-all p-1"
              title="Copy text"
            ><Copy size={12} /></button>
          )}
        </div>
      );
    });
  };

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-5 py-4 rounded-2xl shadow-lg backdrop-blur-sm group ${isUser ? 'bg-yellow-500 text-black rounded-br-none font-medium' : 'bg-gray-800/80 border border-gray-700 text-gray-100 rounded-bl-none'}`}>
          {message.role === 'assistant' && (
            <div className="absolute -top-7 left-0 flex items-center gap-2 mb-2 pointer-events-none">
              <img src="/logo.png" alt="AI" className="w-4 h-4 object-contain shadow-sm" />
              <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-tighter">DARKPIXELS AI</span>
            </div>
          )}
          <div className="leading-relaxed text-sm md:text-base selection:bg-yellow-500/30">{renderContent(message.content)}</div>
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({ isOpen, onClose, user, onLogin, onClearHistory }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {user ? <UserCheck className="text-yellow-500" /> : <LogIn className="text-yellow-500" />} {user ? 'Account' : 'Sign In'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          {!user ? (
            <div className="text-center py-8 space-y-6">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4"><UserIcon size={32} className="text-gray-400" /></div>
              <p className="text-gray-300">Sign in to save your chats and access advanced features.</p>
              <button onClick={() => { onLogin(); onClose(); }} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2">Sign in with Google</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold text-xl">
                  {user.email ? user.email[0].toUpperCase() : 'G'}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-white font-medium truncate">{user.displayName || 'Guest User'}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email || `ID: ${user.uid.slice(0, 12)}...`}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-800">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete all chat history? This cannot be undone.')) {
                      onClearHistory();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 py-3 rounded-lg transition-colors font-medium"
                >
                  <Trash2 size={16} /> Delete All History
                </button>
              </div>
            </div>
          )}
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
  const [loadingText, setLoadingText] = useState('Thinking...');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [appMode, setAppMode] = useState<AppMode>('chat');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [settings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string, content: string, type: 'image' | 'text' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('dp_user');
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      setAuthState(u.uid.startsWith('guest_') ? 'guest' : 'user');
    }
    else { setAuthState('auth'); }
  }, []);

  const fetchThreads = async () => {
    if (authState === 'user' && user) {
      try {
        const data = await safeFetch(`${API_BASE_URL}/threads?userId=${user.uid}`);
        if (data) setThreads(data.map((d: any) => ({ ...d, id: d.id.toString() })));
      } catch (e) { console.error(e); }
    } else if (authState === 'guest') {
      setThreads(JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]'));
    }
  };

  useEffect(() => { fetchThreads(); }, [authState, user]);

  const fetchMessages = async () => {
    if (!currentThreadId) { setMessages([]); return; }
    if (authState === 'user' && user) {
      try {
        const data = await safeFetch(`${API_BASE_URL}/threads/${currentThreadId}/messages`);
        if (data) setMessages(data.map((d: any) => ({ ...d, id: d.id.toString() })));
      } catch (e) { console.error(e); }
    } else if (authState === 'guest') {
      setMessages(JSON.parse(localStorage.getItem(getGuestMessagesKey(currentThreadId)) || '[]'));
    }
  };

  useEffect(() => { fetchMessages(); }, [currentThreadId, authState]);

  useEffect(() => {
    if (appMode === 'canvas' && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant') {
          const content = Array.isArray(msg.content) ? msg.content.find(c => c.type === 'text')?.text || "" : msg.content;
          const code = extractCodeBlock(content);
          if (code) {
            setPreviewCode(code);
            break;
          }
        }
      }
    }
  }, [messages, appMode]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } });
      const info = await res.json();
      const u = { uid: info.sub, email: info.email, displayName: info.name, photoURL: info.picture };
      setUser(u); setAuthState('user'); localStorage.setItem('dp_user', JSON.stringify(u));
      await safeFetch(`${API_BASE_URL}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) });
    }
  });

  const handleGuest = () => {
    setAuthState('guest');
    const guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
    const u = { uid: guestId, email: '', displayName: 'Guest User' };
    setUser(u);
    localStorage.setItem('dp_user', JSON.stringify(u));
    const local = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
    setThreads(local);
    setCurrentThreadId(null);
    setMessages([]);
  };

  const createNewChat = async (targetMode: AppMode): Promise<string | undefined> => {
    setAppMode(targetMode);
    setCurrentThreadId(null);
    setMessages([]);
    setPreviewCode(null);
    return undefined;
  };

  const switchMode = (mode: AppMode) => {
    if (appMode === mode) return;
    const hasMessages = messages.length > 0;

    if (hasMessages) {
      setPreviewCode(null);
      setPendingFile(null);
      setInput('');
      createNewChat(mode);
    } else {
      setAppMode(mode);
    }
  };

  const handleSend = async (override?: string) => {
    const text = override || input;
    if ((!text.trim() && !pendingFile) || isLoading) return;
    const currentFile = pendingFile;
    setInput(''); setPendingFile(null); setIsLoading(true); setLoadingText("Thinking...");
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    let model = settings.model;
    if (appMode === 'canvas') { model = MODELS.code.id; setLoadingText("Building App..."); }
    else if (appMode === 'image') { model = MODELS.image.id; setLoadingText("Generating Image..."); }
    else if (settings.autoRoute) { model = detectIntent(text, appMode, !!currentFile); }

    let activeId = currentThreadId;
    if (!activeId) {
      // Lazy create thread
      const type = appMode === 'canvas' ? 'dev' : (appMode === 'image' ? 'image' : 'chat');
      const title = text.slice(0, 30) || 'New Chat';

      if (authState === 'user' && user) {
        const newT = await safeFetch(`${API_BASE_URL}/threads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.uid, title, type }) });
        if (newT) {
          activeId = newT.id.toString();
          setCurrentThreadId(activeId);
          setThreads(prev => [newT, ...prev]);
        }
      } else {
        activeId = generateId();
        const newT = { id: activeId, title, createdAt: Date.now(), type: type as any };
        const updated = [newT, ...threads];
        setThreads(updated);
        localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(updated));
        setCurrentThreadId(activeId);
      }
    }

    let ui = text;
    if (currentFile) ui = (text ? text + '\n\n' : '') + (currentFile.type === 'text' ? `--- FILE: ${currentFile.name} ---\n${currentFile.content}\n--- END ---` : `[Image: ${currentFile.name}]`);

    const userMsg: Message = { id: generateId(), role: 'user', content: ui, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    const isNewConversation = !currentThreadId || messages.length === 0;

    const saveMsg = async (msg: Message, tid: string) => {
      if (authState === 'user' && user) await safeFetch(`${API_BASE_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ threadId: tid, role: msg.role, content: msg.content, modelUsed: msg.modelUsed }) });
      else { const local = JSON.parse(localStorage.getItem(getGuestMessagesKey(tid)) || '[]'); localStorage.setItem(getGuestMessagesKey(tid), JSON.stringify([...local, msg])); }
    };

    if (activeId) saveMsg(userMsg, activeId);

    // --- DIRECT IMAGE GENERATION (Pollinations) ---
    // We handle this separately to ensure NO text AI API calls are made for images
    const isImageIntent = settings.autoRoute && detectIntent(text, appMode, !!currentFile) === MODELS.image.id;

    if (appMode === 'image' || isImageIntent) {
      setLoadingText("Generating Image...");
      const prompt = text.replace(/^\/(draw|imagine)\s+/i, '');
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
      const aiMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: `![Generated Image](${imageUrl})`,
        timestamp: Date.now(),
        modelUsed: MODELS.image.id
      };
      setMessages(prev => [...prev, aiMsg]);
      if (activeId) saveMsg(aiMsg, activeId);
      setIsLoading(false);
      return;
    }

    try {
      const history = messages.slice(-10); // Get more context

      const performCall = async (mId: string) => {
        const res = await fetch(API_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}`, 'HTTP-Referer': 'https://darkpixels.app', 'X-Title': 'DarkPixels' },
          body: JSON.stringify({ model: mId, messages: [{ role: 'system', content: appMode === 'canvas' ? DEV_MODE_SYSTEM_PROMPT : settings.systemPrompt }, ...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }], temperature: appMode === 'canvas' ? 0.2 : settings.temperature }),
          signal: abortControllerRef.current?.signal
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw { status: res.status, message: errData.error?.message || res.statusText };
        }
        return res.json();
      };

      let data;
      try {
        data = await performCall(model);
        if (!data.choices?.[0]?.message?.content) throw new Error("Empty response content");
      }
      catch (e: any) {
        if (e.name === 'AbortError') return;
        let success = false;
        if (FALLBACK_MODELS.length > 0) {
          for (const fb of FALLBACK_MODELS) {
            try {
              setLoadingText("DarkPixels is busy, retrying...");
              const fbData = await performCall(fb);
              if (!fbData.choices?.[0]?.message?.content) throw new Error("Empty fallback content");
              data = fbData;
              model = fb;
              success = true;
              break;
            } catch { continue; }
          }
        }
        if (!success) throw e;
      }

      let aiText = cleanAIResponse(data.choices?.[0]?.message?.content || "");
      if (!aiText) aiText = "The system is currently unresponsive. Please try again shortly.";

      if (appMode === 'canvas') { const code = extractCodeBlock(aiText); if (code) setPreviewCode(code); }
      const aiMsg: Message = { id: generateId(), role: 'assistant', content: aiText, timestamp: Date.now(), modelUsed: model };
      setMessages(prev => [...prev, aiMsg]); if (activeId) saveMsg(aiMsg, activeId);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      let displayMsg = `Error: ${err.message || "An unexpected error occurred"}`;

      // Error Message Logic
      if (err.status === 429) {
        if (isNewConversation || authState === 'guest') {
          displayMsg = "OUR DARKPIXELS AI IS BUSY NOW TRY AFTER SOMETIME";
        } else {
          displayMsg = "your limit is reached try after some time";
        }
      } else if (authState === 'guest' || isNewConversation) {
        displayMsg = "OUR DARKPIXELS AI IS BUSY NOW TRY AFTER SOMETIME";
      }

      const errorMsg: Message = { id: generateId(), role: 'assistant', content: displayMsg, timestamp: Date.now() };
      setMessages(prev => [...prev, errorMsg]); if (activeId) saveMsg(errorMsg, activeId);
    } finally { setIsLoading(false); }
  };

  const handleFileSelect = (e: any) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    if (file.type.startsWith('image/')) { r.onload = (ev) => setPendingFile({ name: file.name, content: ev.target?.result as string, type: 'image' }); r.readAsDataURL(file); }
    else { r.onload = (ev) => setPendingFile({ name: file.name, content: ev.target?.result as string, type: 'text' }); r.readAsText(file); }
    e.target.value = '';
  };

  const handleClearHistory = async () => {
    if (authState === 'user' && user) {
      for (const t of threads) {
        await fetch(`${API_BASE_URL}/threads/${t.id}`, { method: 'DELETE' });
      }
      localStorage.removeItem('dp_user');
      window.location.reload();
    } else {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleStop = () => { if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; } setIsLoading(false); };

  if (authState === 'loading') return <div className="h-screen bg-black flex items-center justify-center text-gray-500 font-mono tracking-widest animate-pulse uppercase">Link Start...</div>;
  if (authState === 'auth') return <AuthScreen onGoogleLogin={() => handleGoogleLogin()} onGuest={handleGuest} />;

  return (
    <div className="flex h-[100dvh] bg-[#050505] text-gray-100 font-sans overflow-hidden fixed inset-0">
      <Sidebar
        isOpen={isSidebarOpen}
        threads={threads}
        activeThreadId={currentThreadId}
        onSelectThread={(id: string) => {
          setCurrentThreadId(id);
          const thread = threads.find(t => t.id === id);
          if (thread) {
            const mode = thread.type === 'dev' ? 'canvas' : (thread.type === 'image' ? 'image' : 'chat');
            setAppMode(mode);
          }
        }}
        onNewChat={() => createNewChat(appMode)}
        onDeleteThread={(id: string) => {
          if (authState === 'user') fetch(`${API_BASE_URL}/threads/${id}`, { method: 'DELETE' }).then(() => fetchThreads());
          else {
            const updated = threads.filter(t => t.id !== id);
            setThreads(updated);
            localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(updated));
            localStorage.removeItem(getGuestMessagesKey(id));
            if (currentThreadId === id) setCurrentThreadId(null);
          }
        }}
        onCloseMobile={() => setIsSidebarOpen(false)}
        appMode={appMode}
      />

      <div className="flex-1 flex overflow-hidden flex-col h-full bg-[#050505] relative">
        <header className="fixed top-0 left-0 right-0 md:relative flex items-center justify-between px-3 md:px-6 py-2 md:py-4 border-b border-gray-800 bg-[#050505]/95 backdrop-blur z-50">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
              <SidebarIcon size={18} />
            </button>
            <img src="/logo.png" alt="Logo" className="w-6 h-6 md:w-8 md:h-8 object-contain shrink-0" />
            <h1 className="font-bold tracking-tight text-yellow-500 text-sm md:text-base uppercase truncate ml-1">DARKPIXELS AI</h1>
          </div>
          <div className="bg-gray-900/50 p-1 rounded-xl flex items-center border border-gray-800 scale-90 md:scale-100">
            {['chat', 'canvas', 'image'].map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m as AppMode)}
                className={`px-2.5 md:px-3 py-1.2 md:py-1.5 rounded-lg text-[9px] md:text-[10px] font-bold transition-all uppercase ${appMode === m ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-900/40' : 'text-gray-500 hover:text-white'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 md:p-2 hover:bg-gray-800 rounded-lg text-gray-400">
              <Settings size={18} />
            </button>
            <button onClick={() => { localStorage.removeItem('dp_user'); setAuthState('auth'); setUser(null); }} className="p-1.5 md:p-2 hover:bg-gray-800 rounded-lg text-red-500">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-6 scrollbar-thin scrollbar-thumb-gray-800 relative pt-[60px] md:pt-3">
          <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end pb-2">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-700 space-y-4 opacity-50 grayscale animate-pulse">
                <img src="/logo.png" alt="DarkPixels AI" className="w-16 h-16 opacity-20" />
                <div className="text-center font-mono text-[10px] tracking-[0.4em] uppercase">System Ready / Awaiting Interaction</div>
              </div>
            )}
            {messages.map(m => (
              <MessageBubble
                key={m.id}
                message={m}
                onPreview={setPreviewCode}
                appMode={appMode}
                onRetry={handleSend}
              />
            ))}
            {isLoading && (
              <div className="ml-4 text-[10px] animate-pulse text-yellow-500 font-mono uppercase tracking-widest flex items-center gap-2">
                <Loader2 size={10} className="animate-spin" /> {loadingText}
                <button onClick={handleStop} className="ml-2 p-1 bg-red-500/20 text-red-400 hover:text-red-300 rounded">
                  <Square size={10} fill="currentColor" />
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="p-2 md:p-4 border-t border-gray-800 bg-[#050505] z-40">
          <div className={`max-w-3xl mx-auto relative flex flex-col gap-1.5 bg-gray-950/50 border rounded-2xl md:rounded-3xl p-1.5 md:p-2 transition-all group ${getModeColors(appMode).border}`}>
            {pendingFile && (
              <div className="flex items-center gap-3 p-2 bg-black/60 rounded-xl w-fit border border-gray-700 ml-1 mt-1">
                {pendingFile.type === 'image' ? <img src={pendingFile.content} className="h-10 w-10 md:h-12 md:w-12 object-cover rounded-lg" /> : <FileText size={18} className="text-gray-400 mx-2" />}
                <span className="text-[9px] md:text-[10px] text-gray-300 max-w-[80px] md:max-w-[100px] truncate">{pendingFile.name}</span>
                <button onClick={() => setPendingFile(null)}><X size={12} /></button>
              </div>
            )}
            <div className="flex items-end gap-1 relative px-1">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-3 text-gray-500 hover:text-yellow-500">
                <Paperclip size={18} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Interact..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-700 text-sm md:text-base resize-none py-2.5 md:py-3 min-h-[40px] max-h-32"
                rows={1}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading}
                className={`p-2 md:p-3 rounded-xl md:rounded-2xl transition-all ${input.trim() || pendingFile ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-600'}`}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-2 md:mt-4 opacity-40 hover:opacity-100 transition-opacity duration-500 text-center px-4">
            <img src="/logo.png" alt="DarkPixels AI Logo" className="w-3.5 h-3.5 grayscale shrink-0" />
            <p className="text-[9px] md:text-[10px] text-gray-500 font-mono uppercase tracking-[0.1em] leading-relaxed">
              <span className="font-bold text-gray-300">DARKPIXELS AI</span> can make mistakes.
            </p>
          </div>
        </footer>

        {previewCode && <CanvasPanel code={previewCode} onClose={() => setPreviewCode(null)} />}

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          user={user}
          onLogin={() => handleGoogleLogin()}
          onClearHistory={handleClearHistory}
        />
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

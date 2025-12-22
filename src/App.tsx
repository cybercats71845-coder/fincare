import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Settings, Paperclip, Image as ImageIcon,
  FileText, X, Cpu,
  Download, Trash2, Terminal,
  Zap, Code, Wind, MessageCircle, BrainCircuit,
  Plus, Sidebar as SidebarIcon, User as UserIcon, LogOut,
  LayoutTemplate, Sparkles,
  Eye, FileCode, Layout, MessageSquareText, History,
  Palette, Loader2, AlertCircle, RefreshCw, Smile
} from 'lucide-react';
// @ts-ignore
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import remarkGfm from 'remark-gfm';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

/**
 * DARKPIXELS - Advanced AI Interface
 */
const getEnv = (key: string, fallback: string) => {
  // Vite requires static access for replacement during build
  if (key === 'REACT_APP_CUSTOM_API_URL') return import.meta.env.REACT_APP_CUSTOM_API_URL || fallback;
  if (key === 'REACT_APP_CUSTOM_API_KEY') return import.meta.env.REACT_APP_CUSTOM_API_KEY || fallback;
  if (key === 'REACT_APP_TEXT_MODEL_ID') return import.meta.env.REACT_APP_TEXT_MODEL_ID || fallback;
  if (key === 'REACT_APP_FALLBACK_MODEL_ID') return import.meta.env.REACT_APP_FALLBACK_MODEL_ID || fallback;
  if (key === 'REACT_APP_IMAGE_MODEL_ID') return import.meta.env.REACT_APP_IMAGE_MODEL_ID || fallback;
  if (key === 'VITE_GOOGLE_CLIENT_ID') return import.meta.env.VITE_GOOGLE_CLIENT_ID || fallback;

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

// 1. API URL for AI Completions
const AI_COMPLETIONS_URL = getEnv("REACT_APP_CUSTOM_API_URL", "");

// 2. API KEY for AI Completions
const AI_COMPLETIONS_KEY = getEnv("REACT_APP_CUSTOM_API_KEY", "");

// 3. TEXT MODEL ID
const TEXT_MODEL_ID = getEnv("REACT_APP_TEXT_MODEL_ID", "");

// 4. IMAGE MODEL ID
const IMAGE_MODEL_ID = getEnv("REACT_APP_IMAGE_MODEL_ID", "");

// 5. FALLBACK MODEL ID (Used if primary fails)
const FALLBACK_MODEL_ID = getEnv("REACT_APP_FALLBACK_MODEL_ID", "");

// 5. BACKEND API BASE URL
const API_BASE_URL = '/api';

const GOOGLE_CLIENT_ID = getEnv("VITE_GOOGLE_CLIENT_ID", "");

// ==================================================================================


// --- Dynamic Model Configuration ---
const MODELS = {
  general: { name: "DarkPixels AI", id: TEXT_MODEL_ID, icon: <MessageCircle size={14} /> },
  code: { name: "DarkPixels AI", id: TEXT_MODEL_ID, icon: <Code size={14} /> },
  deep: { name: "DarkPixels AI", id: TEXT_MODEL_ID, icon: <BrainCircuit size={14} /> },
  fast: { name: "DarkPixels AI", id: TEXT_MODEL_ID, icon: <Wind size={14} /> },
  vision: { name: "DarkPixels AI", id: TEXT_MODEL_ID, icon: <Eye size={14} /> },
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
  baseUrl: AI_COMPLETIONS_URL,
  model: MODELS.general.id,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.7,
  autoRoute: true,
};

// --- Helper Functions ---
const detectIntent = (text: string, appMode: AppMode, _hasImage: boolean): string => {
  const t = text.toLowerCase();

  // 1. Image Generation Check
  if (appMode === 'image' ||
    /(create|gen|make|draw|render|vis|paint|sketch).*(img|image|pic|photo|art|illust)/.test(t) ||
    /(draw|gen|create).*(bird|dog|cat|landscape|city|logo)/.test(t)) {
    return MODELS.image.id;
  }

  // 2. Everything else uses the single configured Text Model
  return TEXT_MODEL_ID;
};

const extractCodeBlock = (content: string): string | null => {
  const pattern = '```' + '(?:html|javascript|js|react|tsx|css)?\\s*([\\s\\S]*?)' + '```';
  const codeBlockRegex = new RegExp(pattern);
  const match = content.match(codeBlockRegex);
  return match ? match[1] : null;
};

// Helper to convert chat history array to a single prompt string for the custom API
/* Unused in current implementation
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
*/

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


const getModeIcon = (mode: AppMode) => {
  switch (mode) {
    case 'canvas': return <Zap size={10} className="text-yellow-500" />;
    case 'image': return <Palette size={10} className="text-yellow-500" />;
    default: return <Terminal size={10} className="text-yellow-500" />;
  }
};

// --- Local Storage Helpers ---
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

const AuthScreen = ({ onGuest, onGoogleLogin }: { onGuest: () => void, onGoogleLogin: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] p-4">
    <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
      <div className="w-20 h-20 rounded-2xl bg-black border border-gray-800 flex items-center justify-center shadow-lg shadow-yellow-900/10 mb-6 overflow-hidden">
        <img src="/logo.png" alt="DarkPixels Logo" className="w-full h-full object-contain" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">DarkPixels AI</h1>
      <p className="text-gray-500 mb-8 lowercase tracking-[0.2em]">Unrestricted Intelligence Interface</p>

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
          <span className="flex-shrink-0 mx-4 text-gray-600 text-xs text-nowrap">OR</span>
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
    ? "w-64 translate-x-0"
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
  const colors = getModeColors(appMode);

  // Local state for image loading
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Safety timeout for stuck loading
  useEffect(() => {
    if (!imgLoaded && !imgError && message.role !== 'user') {
      const timer = setTimeout(() => {
        setImgLoaded(true);
      }, 30000);
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

    if (text.startsWith("Error:") || text.startsWith("⚠️") || text.includes("Payment Required")) {
      return (
        <div className="flex flex-col gap-2">
          <span className="text-nowrap text-red-400">{text}</span>
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
            <div className="flex items-center gap-2 p-4 rounded-xl border border-yellow-500/30 bg-yellow-900/10 text-yellow-500 text-xs font-mono mb-2 animate-pulse text-nowrap">
              <Loader2 size={16} className="animate-spin" />
              <span>Wait, the image is loading...</span>
            </div>
          )}
          {imgError && (
            <div className="flex items-center justify-between gap-2 p-4 rounded-xl border border-red-500/30 bg-red-900/10 text-red-400 text-xs font-mono mb-2">
              <div className="flex items-center gap-2 text-nowrap">
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

    return (
      <div className="markdown-container prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black prose-pre:border prose-pre:border-gray-800">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeContent = String(children).replace(/\n$/, '');

            if (!inline && match) {
              if (appMode === 'canvas') {
                return (
                  <div className="my-3 p-4 rounded-xl bg-yellow-900/10 border border-yellow-500/30 flex items-center gap-3 not-prose">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <Sparkles size={20} className="text-yellow-500 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white mb-0">App Generated</h4>
                      <p className="text-xs text-yellow-300 mb-0">Code is ready in the Canvas panel.</p>
                    </div>
                    <button
                      onClick={() => onPreview(codeContent)}
                      className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold rounded-lg transition-colors text-nowrap"
                    >
                      View Canvas
                    </button>
                  </div>
                );
              }
              return (
                <div className="my-3 overflow-hidden rounded-md bg-black border border-gray-800 not-prose">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
                    <span className="text-xs font-mono text-gray-400 capitalize">{match[1]}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(codeContent)}
                      className="text-xs text-yellow-500 hover:text-yellow-400 font-medium"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300 mb-0">
                    {codeContent}
                  </pre>
                </div>
              );
            }
            return <code className={`${className} bg-gray-900 text-yellow-500 px-1.5 py-0.5 rounded text-xs`} {...props}>{children}</code>;
          },
          img({ node, ...props }: any) {
            return <img {...props} className="max-w-full rounded-xl border border-gray-800 shadow-lg my-2" loading="lazy" />;
          }
        }}>
          {text}
        </ReactMarkdown>
      </div>
    );
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
              <span className={`text-xs font-medium ${colors.text} text-nowrap uppercase tracking-tighter`}>
                DARKPIXELS
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
            <Cpu className="text-yellow-500" /> Configuration
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

// --- Main App Logic ---

const EmojiPicker = ({ onSelect }: { onSelect: (emoji: string) => void }) => {
  const emojis = ['😊', '😂', '🔥', '✨', '💻', '🚀', '🤖', '🎨', '👍', '❤️', '🤔', '🎉', '💡', '✅', '⚡', '🌈', '🫂', '⭐', '🔥', '🎯', '👋', '🙌', '🔍', '📱'];
  return (
    <div className="absolute bottom-full mb-2 left-0 bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-2xl p-3 shadow-2xl grid grid-cols-6 gap-2 z-50 animate-in fade-in slide-in-from-bottom-2">
      {emojis.map((e, i) => (
        <button key={i} onClick={() => onSelect(e)} className="text-xl hover:bg-gray-800 hover:scale-110 p-2 rounded-xl transition-all duration-200">{e}</button>
      ))}
    </div>
  );
};

const DarkPixelsInner = () => {
  const [authState, setAuthState] = useState<'loading' | 'auth' | 'guest' | 'user'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Thinking...');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [appMode, setAppMode] = useState<AppMode>('chat');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string, content: string, type: 'image' | 'text' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Init Auth (Check Session)
  useEffect(() => {
    const savedUser = localStorage.getItem('dp_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
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
        const data = await safeFetch(`${API_BASE_URL}/threads?userId=${user.uid}`);
        if (data) {
          const loaded = data.map((d: any) => ({ ...d, id: d.id.toString() } as Thread));
          loaded.sort((a: any, b: any) => b.createdAt - a.createdAt);
          setThreads(loaded);
        }
      } catch (e) { console.error("Thread fetch error", e); }
    } else if (authState === 'guest') {
      const localThreads = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
      localThreads.sort((a: Thread, b: Thread) => b.createdAt - a.createdAt);
      setThreads(localThreads);
    }
  };

  useEffect(() => { fetchThreads(); }, [authState, user]);

  // 3. Load Messages
  const fetchMessages = async () => {
    if (!currentThreadId) {
      setMessages([]);
      return;
    }

    if (authState === 'user' && user) {
      try {
        const data = await safeFetch(`${API_BASE_URL}/threads/${currentThreadId}/messages`);
        if (data) {
          const loaded = data.map((d: any) => ({ ...d, id: d.id.toString() } as Message));
          loaded.sort((a: any, b: any) => a.timestamp - b.timestamp);
          setMessages(loaded);
        }
      } catch (e) { console.error("Message fetch error", e); }
    } else if (authState === 'guest') {
      const msgs = JSON.parse(localStorage.getItem(getGuestMessagesKey(currentThreadId)) || '[]');
      msgs.sort((a: Message, b: Message) => a.timestamp - b.timestamp);
      setMessages(msgs);
    }
  };

  useEffect(() => { fetchMessages(); }, [currentThreadId, authState]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const info = await res.json();
        const u = { uid: info.sub, email: info.email, displayName: info.name, photoURL: info.picture };
        setUser(u);
        setAuthState('user');
        localStorage.setItem('dp_user', JSON.stringify(u));

        // Sync with DB
        await safeFetch(`${API_BASE_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(u)
        });
      } catch (e) {
        console.error("Login failed", e);
        alert("Google Sign-In failed.");
      }
    }
  });

  const handleGuest = () => {
    setAuthState('guest');
    const localThreads = JSON.parse(localStorage.getItem(GUEST_THREADS_KEY) || '[]');
    setThreads(localThreads);

    if (localThreads.length === 0) {
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
    createNewChat(targetMode);
  };

  const createNewChat = async (targetMode: AppMode) => {
    setAppMode(targetMode);
    const type = targetMode === 'canvas' ? 'dev' : (targetMode === 'image' ? 'image' : 'chat');
    const title = targetMode === 'canvas' ? 'New Project' : (targetMode === 'image' ? 'New Image' : 'New Chat');

    if (authState === 'user' && user) {
      try {
        const newThread = await safeFetch(`${API_BASE_URL}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, title, type })
        });
        if (newThread) {
          setCurrentThreadId(newThread.id.toString());
          setThreads(prev => [newThread, ...prev]);
        }
      } catch (e) { console.error("Thread creation error", e); }
    } else {
      const newId = generateId();
      const newThread: Thread = { id: newId, title, createdAt: Date.now(), type: type as any };
      const updatedThreads = [newThread, ...threads];
      setThreads(updatedThreads);
      localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(updatedThreads));
      setCurrentThreadId(newId);
      setMessages([]);
    }
    setPreviewCode(null);
  };

  const deleteThread = async (threadId: string) => {
    if (authState === 'user' && user) {
      await safeFetch(`${API_BASE_URL}/threads/${threadId}`, { method: 'DELETE' });
      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        setMessages([]);
        setPreviewCode(null);
      }
      fetchThreads();
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
      reader.onload = (event) => setPendingFile({ name: file.name, content: event.target?.result as string, type: 'image' });
      reader.readAsDataURL(file);
    } else {
      reader.onload = (event) => setPendingFile({ name: file.name, content: event.target?.result as string, type: 'text' });
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleSend = async (overrideText?: string) => {
    const textToUse = overrideText || input;
    if ((!textToUse.trim() && !pendingFile) || isLoading) return;

    const text = textToUse;
    const currentFile = pendingFile;

    setInput('');
    setPendingFile(null);
    setIsLoading(true);
    setLoadingText("Thinking...");

    let selectedModel = settings.model;
    const hasImage = currentFile?.type === 'image';

    if (appMode === 'canvas') { selectedModel = MODELS.code.id; setLoadingText("Building App..."); }
    else if (appMode === 'image') { selectedModel = MODELS.image.id; setLoadingText("Generating Image..."); }
    else if (settings.autoRoute) { selectedModel = detectIntent(text, appMode, hasImage); }

    let activeThreadId = currentThreadId;

    if (!activeThreadId) {
      await createNewChat(appMode);
      // Note: createNewChat sets currentThreadId, but we might need to wait or use the local ID
      activeThreadId = generateId(); // Temporary fallback if async creation is too slow for logic
    }

    // Unified UI Message
    let uiContent: any = text;
    if (currentFile) {
      if (currentFile.type === 'text') {
        uiContent = (text ? text + '\n\n' : '') + `--- BEGIN FILE: ${currentFile.name} ---\n${currentFile.content}\n--- END FILE ---`;
      } else {
        uiContent = (text ? text + '\n\n' : '') + `[User uploaded image: ${currentFile.name}]`;
      }
    }

    const userMsg: Message = { id: generateId(), role: 'user', content: uiContent, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    const saveMsg = async (msg: Message, tid: string) => {
      if (authState === 'user' && user) {
        await safeFetch(`${API_BASE_URL}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: tid, role: msg.role, content: msg.content, modelUsed: msg.modelUsed })
        });
      } else {
        const local = JSON.parse(localStorage.getItem(getGuestMessagesKey(tid)) || '[]');
        localStorage.setItem(getGuestMessagesKey(tid), JSON.stringify([...local, msg]));
      }
    };

    if (currentThreadId) saveMsg(userMsg, currentThreadId);

    // Auto-update thread title after first message
    if (messages.length <= 1 && currentThreadId) {
      const titleText = text || (currentFile ? `File: ${currentFile.name}` : 'New Chat');
      const newTitle = titleText.slice(0, 30) + (titleText.length > 30 ? '...' : '');
      const type = appMode === 'canvas' ? 'dev' : (appMode === 'image' ? 'image' : 'chat');

      if (authState === 'user' && user) {
        safeFetch(`${API_BASE_URL}/threads/${currentThreadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle })
        }).catch(e => console.error("Title Update Error", e));
      } else {
        const updatedThreads = threads.map(t =>
          t.id === currentThreadId ? { ...t, title: newTitle, type: type as any } : t
        );
        setThreads(updatedThreads);
        localStorage.setItem(GUEST_THREADS_KEY, JSON.stringify(updatedThreads));
      }
    }

    try {
      const activeSystemPrompt = appMode === 'canvas' ? DEV_MODE_SYSTEM_PROMPT : settings.systemPrompt;

      if (selectedModel === MODELS.image.id) {
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?nologo=true&seed=${seed}`;
        const aiText = `Here is your image based on "${text}":\n\n![Generated Image](${imageUrl})`;
        const aiMsg: Message = { id: generateId(), role: 'assistant', content: aiText, timestamp: Date.now(), modelUsed: selectedModel };
        setMessages(prev => [...prev, aiMsg]);
        if (currentThreadId) saveMsg(aiMsg, currentThreadId);
        setIsLoading(false);
        return;
      }

      // API Payload logic
      let apiContent: any = text;
      if (currentFile?.type === 'image') {
        apiContent = [
          { type: "text", text: text || "Analyze this image." },
          { type: "image_url", image_url: { url: currentFile.content } }
        ];
      } else if (currentFile?.type === 'text') {
        apiContent = (text ? text + '\n\n' : '') + `--- BEGIN FILE: ${currentFile.name} ---\n${currentFile.content}\n--- END FILE ---`;
      }

      const performApiCall = async (modelToUse: string) => {
        const response = await fetch(AI_COMPLETIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_COMPLETIONS_KEY}`,
            'HTTP-Referer': 'https://darkpixels.app',
            'X-Title': 'DarkPixels'
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [
              { role: 'system', content: activeSystemPrompt },
              ...messages.slice(-6).map(m => ({
                role: m.role,
                content: typeof m.content === 'object' ? JSON.stringify(m.content) : m.content
              })),
              { role: 'user', content: apiContent }
            ],
            temperature: appMode === 'canvas' ? 0.2 : settings.temperature
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `API Error: ${response.status}`);
        }

        return response.json();
      };

      let data;
      try {
        data = await performApiCall(selectedModel);
      } catch (err: any) {
        // Multi-Model Fallback Logic
        const isRateLimit = err.message.includes('429') || err.message.includes('rate_limit') || err.message.includes('402');
        if (isRateLimit && selectedModel === TEXT_MODEL_ID) {
          const fallbacks = FALLBACK_MODEL_ID.split(',').map((f: string) => f.trim()).filter(Boolean);
          let fallbackSuccess = false;

          for (const fallbackModel of fallbacks) {
            try {
              setLoadingText(`DarkPixels AI is busy, trying alternate system...`);
              data = await performApiCall(fallbackModel);
              selectedModel = fallbackModel;
              fallbackSuccess = true;
              break;
            } catch (fallbackErr) {
              console.error(`Fallback failed for ${fallbackModel}:`, fallbackErr);
            }
          }

          if (!fallbackSuccess) throw err;
        } else {
          throw err;
        }
      }

      let aiText = data.choices?.[0]?.message?.content || "";
      // Clean up common BOS/EOS tokens that leak from some models (e.g. <s>, </s>)
      aiText = aiText.replace(/<\/?s>/gi, '').trim();

      if (!aiText) {
        aiText = "I'm sorry, I was unable to generate a coherent response. 🤖 This can happen if the model is busy or the input was unclear. Please try switching models or rephrasing.";
      }

      if (appMode === 'canvas') {
        const extracted = extractCodeBlock(aiText);
        if (extracted) setPreviewCode(extracted);
      }

      const aiMsg: Message = { id: generateId(), role: 'assistant', content: aiText, timestamp: Date.now(), modelUsed: selectedModel };
      setMessages(prev => [...prev, aiMsg]);
      if (currentThreadId) saveMsg(aiMsg, currentThreadId);

    } catch (err: any) {
      let errorText = `Error: ${err.message}`;
      if (err.message.includes('429')) {
        errorText = "⚠️ **Rate Limit Reached:** You're sending messages too fast for this free model. Please wait a minute or switch to a different model in Settings.";
      } else if (err.message.includes('402')) {
        errorText = "⚠️ **Insufficient Credits:** This model require a balance on OpenRouter. Please switch to a ':free' model or top up your account.";
      }

      const errorMsg: Message = { id: generateId(), role: 'assistant', content: errorText, timestamp: Date.now() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const activeColors = getModeColors(appMode);

  if (authState === 'loading') return <div className="h-screen bg-black flex items-center justify-center text-gray-500 font-mono tracking-widest animate-pulse uppercase">Link Start...</div>;
  if (authState === 'auth') return <AuthScreen onGoogleLogin={() => handleGoogleLogin()} onGuest={handleGuest} />;

  return (
    <div className="flex h-screen bg-[#050505] text-gray-100 font-sans overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} threads={threads} activeThreadId={currentThreadId} onSelectThread={handleThreadSelect} onNewChat={() => switchMode(appMode)} onDeleteThread={deleteThread} onCloseMobile={() => setIsSidebarOpen(false)} appMode={appMode} />
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${previewCode ? 'border-r border-gray-800' : ''}`}>
          <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#050505]/95 backdrop-blur z-10 sticky top-0">
            <div className="flex items-center gap-3">
              <button
                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <SidebarIcon size={20} />
              </button>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg bg-black border border-gray-800 overflow-hidden`}>
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              </div>
              <h1 className={`font-bold tracking-tight ${activeColors.text} hidden sm:block uppercase`}>
                DARKPIXELS
              </h1>
            </div>

            <div className="bg-gray-900/50 p-1 rounded-xl flex items-center border border-gray-800">
              {['chat', 'canvas', 'image'].map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m as AppMode)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold md:text-xs transition-all uppercase tracking-tighter
                     ${appMode === m ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-900/40' : 'text-gray-500 hover:text-white'}
                   `}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hidden xs:block"><Settings size={20} /></button>
              <button onClick={() => { localStorage.removeItem('dp_user'); setAuthState('auth'); setUser(null); }} className="p-2 hover:bg-gray-800 rounded-lg text-red-500" title="Sign Out"><LogOut size={20} /></button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-gray-800">
            <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end pb-4">
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-700 space-y-4 opacity-50 grayscale animate-pulse">
                  <Terminal size={48} className="text-yellow-500/20" />
                  <div className="text-center font-mono text-[10px] tracking-[0.4em] uppercase">System Ready / Awaiting Interaction</div>
                </div>
              )}
              {messages.map(m => (
                <MessageBubble key={m.id} message={m} onPreview={(code) => setPreviewCode(code)} appMode={appMode} onRetry={(text) => handleSend(text)} />
              ))}
              {isLoading && (
                <div className={`ml-4 text-[10px] animate-pulse text-yellow-500 font-mono uppercase tracking-widest flex items-center gap-2`}>
                  <Loader2 size={10} className="animate-spin" /> {loadingText}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          <footer className="p-4 border-t border-gray-800 bg-[#050505]">
            <div className={`max-w-3xl mx-auto relative flex flex-col gap-2 bg-gray-950/50 border rounded-3xl p-2 transition-all group
               ${activeColors.border} ${activeColors.focus}
            `}>
              {pendingFile && (
                <div className="flex items-center gap-3 p-2 bg-black/60 rounded-xl w-fit border border-gray-700 ml-2 mt-1">
                  {pendingFile.type === 'image' ? <img src={pendingFile.content} className="h-12 w-12 object-cover rounded-lg border border-gray-600" /> : <FileText size={20} className="text-gray-400 mx-2" />}
                  <span className="text-[10px] text-gray-300 max-w-[100px] truncate">{pendingFile.name}</span>
                  <button onClick={() => setPendingFile(null)} className="p-1 hover:bg-gray-700 rounded-full text-gray-500"><X size={12} /></button>
                </div>
              )}

              <div className="flex items-end gap-1 relative">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-yellow-500 transition-colors"><Paperclip size={20} /></button>
                <button onClick={() => setIsEmojiOpen(!isEmojiOpen)} className={`p-3 transition-colors ${isEmojiOpen ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-500'}`}><Smile size={20} /></button>

                {isEmojiOpen && <EmojiPicker onSelect={(emoji) => { setInput(prev => prev + emoji); setIsEmojiOpen(false); }} />}

                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Interact with DarkPixels..." className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-700 text-sm md:text-base resize-none py-3 min-h-[44px] max-h-32" rows={1} />
                <button onClick={() => handleSend()} disabled={isLoading || (!input.trim() && !pendingFile)} className={`p-3 rounded-2xl transition-all ${input.trim() || pendingFile ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-900/30' : 'bg-gray-800 text-gray-600'}`}><Send size={20} /></button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 mt-4">
              <img src="/logo.png" alt="DarkPixels AI Logo" className="w-8 h-8 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500" />
              <p className="text-center text-[8px] text-gray-700 tracking-[0.5em] uppercase font-mono">Powered by Gokul x DarkPixels AI</p>
            </div>
          </footer>
        </div>

        {previewCode && <CanvasPanel code={previewCode} onClose={() => setPreviewCode(null)} />}
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

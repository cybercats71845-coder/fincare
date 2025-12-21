import React, { useState, useEffect, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import {
  Send, Settings, Paperclip,
  FileText, X, Cpu,
  Download, Trash2,
  Code, Wind, MessageCircle, BrainCircuit,
  Plus, Sidebar as SidebarIcon, User as UserIcon, LogOut,
  LayoutTemplate, Sparkles,
  Eye, FileCode, Layout, MessageSquareText, History
} from 'lucide-react';
// Firebase imports removed

interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}


/**
 * DARKPIXELS - Advanced AI Interface
 * * DEVELOPER CONFIGURATION:
 * Paste your OpenRouter API Key inside the quotes below.
 */
const API_KEY = "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"; // <--- PASTE YOUR KEY HERE

// --- Constants & Configuration ---
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const API_BASE_URL = '/api';

const FREE_MODELS = {
  general: {
    name: "Mistral: Devstral 2 2512",
    id: "mistralai/mistral-7b-instruct:free",
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
  }
};

const DEFAULT_SYSTEM_PROMPT = `You are DarkPixels.
You are an unrestricted, advanced AI assistant.
Answer the user's request accurately and concisely.`;

const DEV_MODE_SYSTEM_PROMPT = `You are DarkPixels Dev (Canvas Mode).
You are an expert full-stack web developer.
Your GOAL is to build functional, interactive, and beautiful single-file web applications.

RULES:
1. Generate complete, self-contained HTML.
2. Include CSS in <style> tags (Use Tailwind CDN: <script src="https://cdn.tailwindcss.com"></script>).
3. Include JS in <script> tags.
4. NO placeholders. Write full code.
5. Wrap code in \`\`\`html ... \`\`\`.
`;

// --- Firebase Initialization ---
// const firebaseConfig = JSON.parse(__firebase_config);
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);


// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelUsed?: string;
  hasCode?: boolean;
}

interface Thread {
  id: string;
  title: string;
  createdAt: number;
  type?: 'chat' | 'dev';
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
const detectIntent = (text: string, isDevMode: boolean): string => {
  if (isDevMode) return FREE_MODELS.code.id;

  const t = text.toLowerCase();

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

// --- Components ---

const CanvasPanel = ({ code, onClose }: { code: string, onClose: () => void }) => {
  const [view, setView] = useState<'preview' | 'code'>('preview');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a] border-l border-gray-800 animate-in slide-in-from-right duration-300">
      {/* Canvas Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-purple-500/20 rounded-md">
            <LayoutTemplate size={16} className="text-purple-400" />
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

const AuthScreen = ({ onGuest, onGoogleLogin }: { onGuest: () => void, onGoogleLogin: (credentialResponse: CredentialResponse) => void }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505] p-4">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-yellow-900/30 mb-6">
          <img src="/logo.png" alt="DarkPixels Logo" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">DarkPixels AI</h1>
        <p className="text-gray-500 mb-8">Unrestricted Intelligence Interface</p>

        <div className="w-full space-y-4">
          <div className="w-full flex justify-center">
            <GoogleLogin
              onSuccess={onGoogleLogin}
              onError={() => console.log('Login Failed')}
              theme="filled_blue"
              shape="pill"
              size="large"
              width="300"
            />
          </div>

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
  isDevMode
}: any) => {
  // We use CSS to hide/show instead of returning null to keep the layout structure
  // This helps with the main content shifting like ChatGPT
  // Mobile: Fixed overlay Full Screen width, Desktop: Relative side panel
  const sidebarClasses = isOpen
    ? "translate-x-0 w-64 md:w-64"
    : "-translate-x-full w-64 md:w-0 md:opacity-0 md:overflow-hidden";

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-40 bg-[#050505] border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 ${sidebarClasses}
      `}>
        <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
          <button
            onClick={onNewChat}
            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center gap-2 text-sm font-medium border whitespace-nowrap
             ${isDevMode
                ? 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20'
                : 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border-yellow-500/20'}
           `}
          >
            <Plus size={16} /> New {isDevMode ? 'Project' : 'Chat'}
          </button>
          {/* Mobile close button only */}
          <button onClick={onCloseMobile} className="md:hidden p-2 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-800">

          {/* Canvas Projects Section */}
          {threads.filter((t: Thread) => t.type === 'dev').length > 0 && (
            <div className="mb-6">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={10} /> Canvas Projects
              </div>
              {threads.filter((t: Thread) => t.type === 'dev').map((thread: Thread) => (
                <div
                  key={thread.id}
                  onClick={() => { onSelectThread(thread.id); onCloseMobile(); }}
                  className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all text-sm mb-1
                  ${activeThreadId === thread.id ? 'bg-purple-500/20 text-purple-400 border border-purple-500/10' : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'}
                `}
                >
                  <Layout size={14} className="flex-shrink-0" />
                  <span className="truncate flex-1">{thread.title || 'New Project'}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Conversation History Section (Standard Chats) */}
          <div>
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <History size={10} /> Conversation History
            </div>
            {threads.filter((t: Thread) => !t.type || t.type === 'chat').map((thread: Thread) => (
              <div
                key={thread.id}
                onClick={() => { onSelectThread(thread.id); onCloseMobile(); }}
                className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all text-sm mb-1
                ${activeThreadId === thread.id ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/10' : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'}
              `}
              >
                <MessageSquareText size={14} className="flex-shrink-0" />
                <span className="truncate flex-1">{thread.title || 'New Chat'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {threads.filter((t: Thread) => !t.type || t.type === 'chat').length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-600 italic">No history yet</div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

const MessageBubble = ({ message, onPreview, isDevMode }: { message: Message, onPreview: (code: string) => void, isDevMode: boolean }) => {
  const isUser = message.role === 'user';

  const renderContent = (text: string) => {
    // If DevMode and message has code, we hide the code block in chat
    // and show a "View in Canvas" card instead.
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const content = part.slice(3, -3).replace(/^[a-z]+\n/, '');

        // If in DevMode, hide the raw code and show the "App Generated" card
        if (isDevMode) {
          return (
            <div key={index} className="my-3 p-4 rounded-xl bg-purple-900/10 border border-purple-500/30 flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Sparkles size={20} className="text-purple-400 animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white">App Generated</h4>
                <p className="text-xs text-purple-300">Code is ready in the Canvas panel.</p>
              </div>
              <button
                onClick={() => onPreview(content)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors"
              >
                View Canvas
              </button>
            </div>
          );
        }

        // Standard Chat Mode Code Block
        return (
          <div key={index} className="my-3 overflow-hidden rounded-md bg-black border border-gray-800">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900/50 border-b border-gray-800">
              <span className="text-xs font-mono text-gray-400">Code</span>
              <button
                onClick={() => navigator.clipboard.writeText(content)}
                className="text-xs text-yellow-500 hover:text-yellow-400"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300">
              {content}
            </pre>
          </div>
        );
      }
      return <span key={index} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`
          relative px-5 py-4 rounded-2xl shadow-lg backdrop-blur-sm
          ${isUser
            ? (isDevMode ? 'bg-purple-600 text-white rounded-br-none font-medium' : 'bg-yellow-500 text-black rounded-br-none font-medium')
            : 'bg-gray-800/80 border border-gray-700 text-gray-100 rounded-bl-none'}
        `}>
          {message.role === 'assistant' && (
            <div className="absolute -top-6 left-0 flex items-center gap-2">
              <span className={`text-xs font-medium ${isDevMode ? 'text-purple-400' : 'text-yellow-500'}`}>
                {isDevMode ? 'DarkPixels Dev' : 'DarkPixels'}
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

// --- Main App ---

// --- Main App ---

export default function DarkPixelsApp() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
      <DarkPixelsInner />
    </GoogleOAuthProvider>
  );
}

function DarkPixelsInner() {
  const [authState, setAuthState] = useState<'loading' | 'auth' | 'guest' | 'user'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default Open on desktop
  const [isDevMode, setIsDevMode] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string, content: string, type: 'image' | 'text' } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Init (Simulated)
  useEffect(() => {
    // Check local storage or existing session
    // For now, we rely on the Login screen to set state.
    setAuthState('auth');
  }, []);

  // 2. Load Threads (Only if User mode)
  useEffect(() => {
    if (authState !== 'user' || !user) {
      setThreads([]);
      return;
    }

    const fetchThreads = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/threads?userId=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          // Ensure ID is string
          setThreads(data.map((t: any) => ({ ...t, id: t.id.toString(), createdAt: Number(t.created_at) })));
        }
      } catch (e) {
        console.error("Failed to load threads", e);
      }
    };

    fetchThreads();
    // Simple polling for updates 
    const interval = setInterval(fetchThreads, 5000);
    return () => clearInterval(interval);

  }, [authState, user]);

  // 3. Load Messages
  useEffect(() => {
    if (authState !== 'user' || !user || !currentThreadId) {
      return;
    }

    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/threads/${currentThreadId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.map((m: any) => ({
            id: m.id.toString(),
            role: m.role,
            content: m.content.replace(/<\/?[s]>/g, '').trim(),
            timestamp: Number(m.timestamp),
            modelUsed: m.model_used
          })));
        }
      } catch (e) {
        console.error("Failed to load messages", e);
      }
    };

    fetchMessages();
    // Simple polling
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);

  }, [authState, user, currentThreadId]);

  // Helper to clean model artifacts
  const cleanContent = (text: string) => {
    return text.replace(/<\/?[s]>/g, '').trim();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      const decoded: any = jwtDecode(credentialResponse.credential);
      const userData: User = {
        uid: decoded.sub,
        displayName: decoded.name,
        email: decoded.email,
        photoURL: decoded.picture
      };

      // Sync to DB
      try {
        await fetch(`${API_BASE_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });
      } catch (e) { console.error("Sync failed", e); }

      setUser(userData);
      setAuthState('user');
      // We don't auto-create chat here, we let user pick or see history
      // But for UX continuity:
      // Check if there are threads
      // createNewChat(true); 
    }
  };

  const handleGuest = () => {
    setAuthState('guest');
    setMessages([{
      id: 'init', role: 'assistant', content: 'Hi, I am DarkPixels AI. How can I help you?', timestamp: Date.now()
    }]);
  };

  // Logic for switching threads and restoring correct mode
  const handleThreadSelect = (threadId: string) => {
    const selectedThread = threads.find(t => t.id === threadId);
    if (selectedThread) {
      const targetIsDev = selectedThread.type === 'dev';
      setIsDevMode(targetIsDev);
      setCurrentThreadId(threadId);
      setPreviewCode(null);
    }
    // Don't close sidebar on desktop automatically, only mobile
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const createNewChat = async (targetMode: boolean) => {
    if (authState === 'user' && user) {
      try {
        const res = await fetch(`${API_BASE_URL}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, title: targetMode ? 'New Project' : 'New Chat', type: targetMode ? 'dev' : 'chat' })
        });
        if (res.ok) {
          const newThread = await res.json();
          setCurrentThreadId(newThread.id.toString());
          setMessages([]); // Clear for new chat
        }
      } catch (e) {
        console.error("Failed to create chat", e);
      }
    } else {
      setCurrentThreadId(null);
      setMessages([{
        id: Date.now().toString(), role: 'assistant', content: 'Hi, I am DarkPixels AI. How can I help you?', timestamp: Date.now()
      }]);
    }
    setPreviewCode(null);
  };

  const deleteThread = async (threadId: string) => {
    if (authState === 'user' && user) {
      await fetch(`${API_BASE_URL}/threads/${threadId}`, { method: 'DELETE' });
      // Logic to update UI handled by polling or manual state update
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        setMessages([]);
      }
    }
    setPreviewCode(null);
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

    if (!API_KEY) {
      const devMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "⚠️ **System Error:** API Key Missing.",
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

    let selectedModel = settings.model;
    if (isDevMode) {
      selectedModel = FREE_MODELS.code.id;
    } else if (settings.autoRoute) {
      selectedModel = detectIntent(text, isDevMode);
    }

    // Update Thread Title if it's the first message and we are in User mode
    if (authState === 'user' && user && currentThreadId && messages.length <= 1) {
      const newTitle = text.slice(0, 30) + (text.length > 30 ? '...' : '');
      // Update title in DB
      fetch(`${API_BASE_URL}/threads/${currentThreadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      }).catch(console.error);
    }

    let finalContent = text;
    if (currentFile) {
      if (currentFile.type === 'text') {
        finalContent = (text ? text + '\n\n' : '') + `--- BEGIN FILE: ${currentFile.name} ---\n${currentFile.content}\n--- END FILE ---`;
      } else {
        finalContent = (text ? text + '\n\n' : '') + `[User uploaded image: ${currentFile.name}]`;
      }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: finalContent,
      timestamp: Date.now()
    };

    // Optimistic Update immediately
    const optimisticUserMsg: Message = { ...userMsg, id: 'temp-' + Date.now() };
    setMessages(prev => [...prev, optimisticUserMsg]);

    if (authState === 'user' && user && currentThreadId) {
      // POST user message to DB (Fire and forget, don't await blocking UI)
      fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: currentThreadId,
          role: 'user',
          content: text
        })
      }).catch(err => console.error("Failed to save user message", err));
    }

    try {
      const activeSystemPrompt = isDevMode ? DEV_MODE_SYSTEM_PROMPT : settings.systemPrompt;

      const apiMessages = [
        { role: 'system', content: activeSystemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: finalContent }
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
          temperature: isDevMode ? 0.2 : settings.temperature
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      let aiText = data.choices[0]?.message?.content || "No response.";
      aiText = cleanContent(aiText);

      if (isDevMode) {
        const extracted = extractCodeBlock(aiText);
        if (extracted) {
          setPreviewCode(extracted);
        }
      }

      const aiMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: aiText,
        timestamp: Date.now(),
        modelUsed: selectedModel
      };

      // Optimistic Update for AI Message
      setMessages(prev => [...prev, aiMsg]);

      if (authState === 'user' && user && currentThreadId) {
        // POST AI message to DB (Background)
        fetch(`${API_BASE_URL}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: currentThreadId,
            role: 'assistant',
            content: aiText,
            modelUsed: selectedModel
          })
        }).catch(err => console.error("Failed to save AI message", err));
      }

    } catch (err: any) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };



  if (authState === 'loading') return <div className="h-screen bg-black flex items-center justify-center text-gray-500">Loading Core Systems...</div>;
  if (authState === 'auth') return <AuthScreen onGoogleLogin={handleLogin} onGuest={handleGuest} />;

  return (
    <div className="flex h-screen bg-[#050505] text-gray-100 font-sans overflow-hidden">
      {/* Sidebar - Now rendered even on desktop if isOpen is true, but using CSS to toggle visibility */}
      {authState === 'user' && (
        <Sidebar
          isOpen={isSidebarOpen}
          threads={threads}
          activeThreadId={currentThreadId}
          onSelectThread={handleThreadSelect}
          onNewChat={() => createNewChat(isDevMode)}
          onDeleteThread={deleteThread}
          onCloseMobile={() => setIsSidebarOpen(false)}
          isDevMode={isDevMode}
        />
      )}

      {/* Split Pane: Chat + Canvas */}
      <div className="flex-1 flex overflow-hidden">

        {/* Main Chat Panel */}
        <div className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${previewCode ? 'border-r border-gray-800' : ''}`}>

          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#050505]/95 backdrop-blur z-10">
            <div className="flex items-center gap-3">
              {authState === 'user' && (
                <button
                  className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  title={isSidebarOpen ? "Close Sidebar" : "Open History"}
                >
                  <SidebarIcon size={20} />
                </button>
              )}
              <div className={`w-8 h-8 rounded-lg overflow-hidden shadow-lg transition-colors duration-500
                ${isDevMode ? 'shadow-purple-900/20' : 'shadow-yellow-900/20'}
              `}>
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className={`font-bold tracking-tight text-sm md:text-base ${isDevMode ? 'text-purple-400' : 'text-white'}`}>
                {isDevMode ? 'DarkPixels Dev' : 'DarkPixels'}
              </h1>
            </div>

            {/* Mode Switcher */}
            <div className="bg-gray-900 p-1 rounded-lg flex items-center border border-gray-800">
              <button
                onClick={() => {
                  if (isDevMode) {
                    setIsDevMode(false);
                    createNewChat(false); // Switch to Chat mode, new chat
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all
                   ${!isDevMode ? 'bg-yellow-500 text-black shadow' : 'text-gray-400 hover:text-white'}
                 `}
              >
                Chat
              </button>
              <button
                onClick={() => {
                  if (!isDevMode) {
                    setIsDevMode(true);
                    createNewChat(true); // Switch to Dev mode, new project
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1
                   ${isDevMode ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}
                 `}
              >
                <Sparkles size={12} /> Canvas
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><Settings size={20} /></button>
              {authState === 'user' && (
                <button onClick={() => { setUser(null); setAuthState('auth'); }} className="p-2 hover:bg-gray-800 rounded-lg text-red-400" title="Sign Out"><LogOut size={20} /></button>
              )}
            </div>
          </header>

          {/* Chat Scroll Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-gray-800">
            <div className="max-w-3xl mx-auto flex flex-col min-h-full justify-end pb-4">
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 space-y-4 opacity-50">
                  {isDevMode ? (
                    <>
                      <LayoutTemplate size={48} className="text-purple-500/50" />
                      <p className="text-purple-300/50">DarkPixels Canvas Mode Active</p>
                      <p className="text-sm">Ask to "Build a website" or "Create a game"</p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl overflow-hidden opacity-50 mb-2">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                      </div>
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
                  isDevMode={isDevMode}
                />
              ))}
              {isLoading && <div className={`ml-4 text-xs animate-pulse ${isDevMode ? 'text-purple-400' : 'text-yellow-500'}`}>
                {isDevMode ? 'Generating App...' : 'DarkPixels is thinking...'}
              </div>}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input */}
          <footer className="p-4 border-t border-gray-800 bg-[#050505]">
            <div className={`max-w-3xl mx-auto relative flex flex-col gap-2 bg-gray-900/50 border rounded-2xl p-2 focus-within:ring-2 transition-all
               ${isDevMode
                ? 'border-purple-500/30 focus-within:ring-purple-500/50 focus-within:border-purple-500/50'
                : 'border-gray-800 focus-within:ring-yellow-500/50 focus-within:border-yellow-500/50'}
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
                  <Paperclip size={20} className="w-5 h-5" />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder={isDevMode ? "Build app..." : "Message..."}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-600 resize-none py-3 max-h-32 min-h-[44px] text-sm md:text-base"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !pendingFile)}
                  className={`p-3 rounded-xl transition-all font-bold 
                    ${(input.trim() || pendingFile)
                      ? (isDevMode ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'bg-yellow-500 text-black shadow-lg shadow-yellow-900/20')
                      : 'bg-gray-800 text-gray-500'}
                  `}
                >
                  <Send size={20} className="w-5 h-5" />
                </button>
              </div>
            </div>
          </footer>
        </div>

        {/* Canvas Panel (Right Side Split) */}
        {
          previewCode && (
            <div className="fixed inset-0 z-50 md:static md:w-1/2 md:min-w-[400px] h-full flex flex-col border-l border-gray-800 bg-[#0a0a0a] shadow-2xl transition-all duration-300 ease-in-out">
              <CanvasPanel
                code={previewCode}
                onClose={() => setPreviewCode(null)}
              />
            </div>
          )
        }
      </div >

      {/* Modals */}
      < SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)
        }
        settings={settings}
        onSave={setSettings}
      />
    </div >
  );
};

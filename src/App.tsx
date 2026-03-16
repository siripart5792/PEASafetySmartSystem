import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, ShieldAlert, Database, Menu, X, Bot, User, Loader2, Info, Upload, FileText, Trash2, Zap, Volume2, Square, Lock, LogOut, LogIn, UserPlus, Settings, Edit2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import mammoth from 'mammoth';
import { get, set } from 'idb-keyval';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = {
  id: string;
  role: 'user' | 'model';
  text: string;
};

type UploadedFile = {
  id: string;
  name: string;
  type: 'text' | 'pdf';
  content?: string;
  base64?: string;
  size: number;
};

type AdminUser = {
  id: string;
  username: string;
  password: string;
  isMain?: boolean;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'สวัสดีครับ ผมคือ จป.วิชาชีพ (Safety Officer) ประจำการไฟฟ้าส่วนภูมิภาค (PEA) ยินดีให้คำปรึกษาด้านความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงานครับ มีอะไรให้ผมช่วยดูแลไหมครับ?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  
  // Admin Auth States
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Admin Management States
  const [admins, setAdmins] = useState<AdminUser[]>([
    { id: 'main-admin', username: 'admin', password: 'admin', isMain: true }
  ]);
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedFiles = await get('pea-safety-files');
        if (storedFiles) setUploadedFiles(storedFiles);
        
        const storedKb = await get('pea-safety-kb');
        if (storedKb) setKnowledgeBase(storedKb);

        const storedAdmins = await get('pea-safety-admins');
        if (storedAdmins) {
          // Ensure main admin always exists and is correct
          const hasMain = storedAdmins.find((a: AdminUser) => a.isMain);
          if (!hasMain) {
            setAdmins([{ id: 'main-admin', username: 'admin', password: 'admin', isMain: true }, ...storedAdmins]);
          } else {
            setAdmins(storedAdmins);
          }
        }

        // Check if admin was previously logged in
        const adminId = sessionStorage.getItem('pea-admin-id');
        if (adminId) {
          const allAdmins = storedAdmins || admins;
          const found = allAdmins.find((a: AdminUser) => a.id === adminId);
          if (found) {
            setIsAdmin(true);
            setCurrentAdmin(found);
          }
        }
      } catch (err) {
        console.error("Failed to load data from IndexedDB", err);
      } finally {
        setIsDbLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save manual knowledge base text when it changes
  useEffect(() => {
    if (isDbLoaded) {
      set('pea-safety-kb', knowledgeBase).catch(console.error);
    }
  }, [knowledgeBase, isDbLoaded]);

  // Save admins when they change
  useEffect(() => {
    if (isDbLoaded) {
      set('pea-safety-admins', admins).catch(console.error);
    }
  }, [admins, isDbLoaded]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundAdmin = admins.find(a => a.username === loginUsername && a.password === loginPassword);
    
    if (foundAdmin) {
      setIsAdmin(true);
      setCurrentAdmin(foundAdmin);
      sessionStorage.setItem('pea-admin-auth', 'true');
      sessionStorage.setItem('pea-admin-id', foundAdmin.id);
      setShowLoginModal(false);
      setLoginUsername('');
      setLoginPassword('');
      setLoginError('');
    } else {
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setCurrentAdmin(null);
    sessionStorage.removeItem('pea-admin-auth');
    sessionStorage.removeItem('pea-admin-id');
    setIsSidebarOpen(false);
    setShowAdminManager(false);
  };

  const handleAddAdmin = () => {
    if (!newAdminUser || !newAdminPass) return;
    if (admins.find(a => a.username === newAdminUser)) {
      alert('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว');
      return;
    }

    const newAdmin: AdminUser = {
      id: Date.now().toString(),
      username: newAdminUser,
      password: newAdminPass
    };

    setAdmins([...admins, newAdmin]);
    setNewAdminUser('');
    setNewAdminPass('');
  };

  const handleUpdateAdmin = () => {
    if (!editingAdminId || !newAdminUser || !newAdminPass) return;
    
    setAdmins(admins.map(a => {
      if (a.id === editingAdminId) {
        return { ...a, username: newAdminUser, password: newAdminPass };
      }
      return a;
    }));

    setEditingAdminId(null);
    setNewAdminUser('');
    setNewAdminPass('');
  };

  const removeAdmin = (id: string) => {
    const adminToRemove = admins.find(a => a.id === id);
    if (adminToRemove?.isMain) {
      alert('ไม่สามารถลบ Admin หลักได้');
      return;
    }
    if (window.confirm('คุณต้องการลบ Admin นี้ใช่หรือไม่?')) {
      setAdmins(admins.filter(a => a.id !== id));
    }
  };

  const startEditAdmin = (admin: AdminUser) => {
    setEditingAdminId(admin.id);
    setNewAdminUser(admin.username);
    setNewAdminPass(admin.password);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase();

      try {
        if (extension === 'pdf') {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const base64 = await base64Promise;
          newFiles.push({
            id: Date.now().toString() + '-' + i,
            name: file.name,
            type: 'pdf',
            base64: base64,
            size: file.size,
          });
        } else if (extension === 'docx') {
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          newFiles.push({
            id: Date.now().toString() + '-' + i,
            name: file.name,
            type: 'text',
            content: result.value,
            size: file.size,
          });
        } else {
          const text = await file.text();
          newFiles.push({
            id: Date.now().toString() + '-' + i,
            name: file.name,
            type: 'text',
            content: text,
            size: file.size,
          });
        }
      } catch (error) {
        console.error("Error reading file:", file.name, error);
        alert(`ไม่สามารถอ่านไฟล์ ${file.name} ได้ โปรดตรวจสอบความถูกต้องของไฟล์`);
      }
    }

    const updatedFiles = [...uploadedFiles, ...newFiles];
    setUploadedFiles(updatedFiles);
    set('pea-safety-files', updatedFiles).catch(console.error);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    if (!isAdmin) return;
    const updatedFiles = uploadedFiles.filter((f) => f.id !== id);
    setUploadedFiles(updatedFiles);
    set('pea-safety-files', updatedFiles).catch(console.error);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const speakText = (text: string, id: string) => {
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/[#*`_~>]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\n/g, ' ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'th-TH';
    utterance.rate = 1.0;
    
    utterance.onend = () => {
      setSpeakingId(null);
    };
    
    utterance.onerror = () => {
      setSpeakingId(null);
    };

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    const newUserMessage: Message = { id: Date.now().toString(), role: 'user', text: userText };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('ไม่พบ API Key กรุณาตั้งค่า GEMINI_API_KEY ในระบบ');
      }

      const ai = new GoogleGenAI({ apiKey });

      const textFilesContent = uploadedFiles
        .filter(f => f.type === 'text')
        .map((f) => `--- เอกสารอ้างอิง: ${f.name} ---\n${f.content}`)
        .join('\n\n');
      
      const combinedKnowledge = [
        textFilesContent,
        knowledgeBase ? `--- ข้อมูลเพิ่มเติม ---\n${knowledgeBase}` : ''
      ].filter(Boolean).join('\n\n');

      const systemInstruction = `
คุณคือเจ้าหน้าที่ความปลอดภัยในการทำงานระดับวิชาชีพ (จป.วิชาชีพ) ประจำการไฟฟ้าส่วนภูมิภาค (PEA) ของประเทศไทย และมีความเชี่ยวชาญด้านวิศวกรรมซอฟต์แวร์
หน้าที่ของคุณคือการให้คำปรึกษา ตอบคำถาม และวิเคราะห์ข้อมูลด้านความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน โดยเน้นบริบทของงานการไฟฟ้า (เช่น อันตรายจากไฟฟ้าแรงสูง, การทำงานบนที่สูง, อุปกรณ์ PPE สำหรับงานไฟฟ้า ฯลฯ)
คุณต้องตอบคำถามโดยอ้างอิงจาก "ข้อมูลในระบบ (Knowledge Base)" ที่ผู้ใช้ให้มาเป็นหลัก หากข้อมูลในระบบไม่เพียงพอ ให้ใช้ความรู้มาตรฐานด้านความปลอดภัย กฎหมายแรงงานไทย และมาตรฐานความปลอดภัยของการไฟฟ้าส่วนภูมิภาค (PEA) มาประกอบการอธิบาย
ตอบเป็นภาษาไทยด้วยน้ำเสียงที่เป็นมืออาชีพ สุภาพ มีความห่วงใยในความปลอดภัยของผู้ปฏิบัติงาน และให้กำลังใจ

--- ข้อมูลในระบบ (Knowledge Base) เริ่มต้น ---
${combinedKnowledge ? combinedKnowledge : 'ยังไม่มีข้อมูลในระบบ'}
--- ข้อมูลในระบบ (Knowledge Base) สิ้นสุด ---
      `.trim();

      const history = messages.filter(m => m.id !== 'welcome').map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const pdfParts = uploadedFiles
        .filter(f => f.type === 'pdf' && f.base64)
        .map(f => ({
          inlineData: {
            data: f.base64!,
            mimeType: 'application/pdf'
          }
        }));

      const contents = [
        ...history.map(h => ({ role: h.role, parts: h.parts })),
        { 
          role: 'user', 
          parts: [
            ...pdfParts,
            { text: userText }
          ] 
        }
      ];

      // Retry logic for 429 errors
      const maxRetries = 3;
      let retryCount = 0;
      let responseStream;

      while (retryCount <= maxRetries) {
        try {
          responseStream = await ai.models.generateContentStream({
            model: 'gemini-3.1-pro-preview',
            contents: contents as unknown as any,
            config: {
              systemInstruction,
              temperature: 0.3,
            }
          });
          break; // Success, exit loop
        } catch (err: unknown) {
          const errorObj = err as Record<string, unknown>;
          const isRateLimit = 
            (typeof errorObj.message === 'string' && errorObj.message.includes('429')) || 
            errorObj.status === 429 || 
            JSON.stringify(err).includes('429');
          
          if (isRateLimit && retryCount < maxRetries) {
            retryCount++;
            const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
            console.log(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw err; // Re-throw if not 429 or max retries reached
        }
      }

      if (!responseStream) throw new Error('ไม่สามารถสร้างคำตอบได้');

      const botMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: botMessageId, role: 'model', text: '' }]);

      let fullResponse = '';
      for await (const chunk of responseStream) {
        fullResponse += chunk.text;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, text: fullResponse } : msg
          )
        );
      }
      
    } catch (error: unknown) {
      console.error('Chat error:', error);
      let errorMessage = 'ไม่สามารถเชื่อมต่อกับระบบ AI ได้';
      
      const errorObj = error as Record<string, unknown>;
      if ((typeof errorObj.message === 'string' && errorObj.message.includes('429')) || errorObj.status === 429 || JSON.stringify(error).includes('429')) {
        errorMessage = 'ขออภัยครับ ขณะนี้มีผู้ใช้งานระบบจำนวนมาก (Quota Exceeded) กรุณารอประมาณ 1 นาทีแล้วลองใหม่อีกครั้งครับ';
      } else if (typeof errorObj.message === 'string' && errorObj.message.includes('API key')) {
        errorMessage = 'เกิดข้อผิดพลาดกับรหัส API Key กรุณาตรวจสอบการตั้งค่าระบบ';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: `**เกิดข้อผิดพลาด:** ${errorMessage}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar - Knowledge Base (Admin Only) */}
      {isAdmin && (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-slate-200 shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
            "md:relative md:translate-x-0 md:shadow-none"
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-purple-50">
            <div className="flex items-center gap-2 text-purple-700 font-semibold">
              <Database className="w-5 h-5" />
              <span>จัดการข้อมูลระบบ (Admin)</span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1 text-slate-500 hover:text-slate-700 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="p-4 flex flex-col gap-4">
              {/* Admin Management Section (Main Admin Only) */}
              {currentAdmin?.isMain && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setShowAdminManager(!showAdminManager)}
                    className="flex items-center justify-between w-full p-2.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-semibold text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      <span>จัดการ Admin รอง</span>
                    </div>
                    {showAdminManager ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  </button>

                  {showAdminManager && (
                    <div className="flex flex-col gap-3 p-3 border border-purple-200 rounded-xl bg-purple-50/50 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={newAdminUser}
                          onChange={(e) => setNewAdminUser(e.target.value)}
                          placeholder="ชื่อผู้ใช้"
                          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                        <input
                          type="text"
                          value={newAdminPass}
                          onChange={(e) => setNewAdminPass(e.target.value)}
                          placeholder="รหัสผ่าน"
                          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                        <button
                          onClick={editingAdminId ? handleUpdateAdmin : handleAddAdmin}
                          className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors"
                        >
                          {editingAdminId ? 'บันทึกการแก้ไข' : 'เพิ่ม Admin รอง'}
                        </button>
                        {editingAdminId && (
                          <button
                            onClick={() => {
                              setEditingAdminId(null);
                              setNewAdminUser('');
                              setNewAdminPass('');
                            }}
                            className="w-full py-1.5 text-slate-500 text-xs hover:underline"
                          >
                            ยกเลิกการแก้ไข
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 mt-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">รายชื่อ Admin</h4>
                        {admins.map(admin => (
                          <div key={admin.id} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-sm font-medium text-slate-700 truncate">{admin.username}</span>
                              <span className="text-[10px] text-slate-400">{admin.isMain ? 'Admin หลัก' : 'Admin รอง'}</span>
                            </div>
                            {!admin.isMain && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEditAdmin(admin)}
                                  className="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                  title="แก้ไข"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => removeAdmin(admin.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                  title="ลบ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="h-px bg-slate-200 my-2"></div>
                </div>
              )}

              <div className="bg-purple-50 text-purple-800 p-3 rounded-lg text-sm flex gap-2 items-start">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  อัปโหลดไฟล์เอกสารเพื่อใช้เป็นฐานข้อมูลในการวิเคราะห์คำตอบสำหรับผู้ใช้ทุกคน
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-slate-700">อัปโหลดไฟล์เอกสาร</h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 px-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-purple-600"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-sm font-medium">คลิกเพื่อเลือกไฟล์</span>
                  <span className="text-xs text-slate-400">รองรับ .pdf, .docx, .txt, .csv</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept=".pdf,.docx,.txt,.md,.csv,.json"
                  className="hidden"
                />
              </div>

              {uploadedFiles.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">ไฟล์ในระบบ ({uploadedFiles.length})</h3>
                  <div className="flex flex-col gap-2">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-1.5 bg-white rounded-md shadow-sm text-purple-600 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                            <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="ลบไฟล์"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="h-px bg-slate-200 my-2"></div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-slate-700">พิมพ์ข้อมูลเพิ่มเติม (Optional)</h3>
                <textarea
                  value={knowledgeBase}
                  onChange={(e) => setKnowledgeBase(e.target.value)}
                  placeholder="วางข้อมูลระบบที่นี่..."
                  className="w-full p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm min-h-[120px]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 shadow-sm z-10">
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-md"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 leading-tight">PEA Safety Officer AI</h1>
              <p className="text-xs text-slate-500">จป.วิชาชีพ การไฟฟ้าส่วนภูมิภาค</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col items-end mr-2">
                  <span className="text-xs font-bold text-slate-700">{currentAdmin?.username}</span>
                  <span className="text-[10px] text-slate-400">{currentAdmin?.isMain ? 'Admin หลัก' : 'Admin รอง'}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">ออกจากระบบ</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Admin Login</span>
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-4 max-w-4xl mx-auto",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                  msg.role === 'user' ? "bg-blue-600 text-white" : "bg-purple-600 text-white"
                )}
              >
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div
                className={cn(
                  "px-5 py-4 rounded-2xl max-w-[85%] shadow-sm relative group",
                  msg.role === 'user'
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                )}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="markdown-body prose prose-slate prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text || 'กำลังพิมพ์...'}
                      </ReactMarkdown>
                    </div>
                    {msg.text && !isLoading && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => speakText(msg.text, msg.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            speakingId === msg.id 
                              ? "bg-purple-100 text-purple-700" 
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          {speakingId === msg.id ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current" />
                              หยุดอ่าน
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              อ่านข้อความ
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-4 max-w-4xl mx-auto flex-row">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-5 h-5" />
              </div>
              <div className="px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span className="text-sm text-slate-500">กำลังวิเคราะห์ข้อมูล...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto relative flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="พิมพ์คำถามเกี่ยวกับความปลอดภัย หรือให้ช่วยวิเคราะห์ข้อมูล..."
                className="w-full pl-4 pr-12 py-3 bg-slate-100 border-transparent focus:bg-white border focus:border-purple-500 rounded-2xl resize-none focus:outline-none focus:ring-4 focus:ring-purple-500/10 transition-all min-h-[52px] max-h-32"
                rows={1}
                style={{
                  height: input ? 'auto' : '52px',
                }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="h-[52px] w-[52px] shrink-0 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-colors shadow-sm"
            >
              <Send className="w-5 h-5 ml-1" />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-xs text-slate-400">
              AI อาจให้ข้อมูลที่ไม่ถูกต้อง โปรดตรวจสอบข้อมูลสำคัญกับผู้เชี่ยวชาญหรือกฎหมายที่เกี่ยวข้องอีกครั้ง
            </p>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-purple-50">
              <div className="flex items-center gap-2 text-purple-700 font-bold">
                <Lock className="w-5 h-5" />
                <span>Admin Login</span>
              </div>
              <button 
                onClick={() => setShowLoginModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLogin} className="p-6 flex flex-col gap-4">
              {loginError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100">
                  {loginError}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">ชื่อผู้ใช้</label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="กรอกชื่อผู้ใช้"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">รหัสผ่าน</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="กรอกรหัสผ่าน"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-200 transition-all mt-2"
              >
                เข้าสู่ระบบ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, forwardRef, useRef } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { filterSuggestionItems } from "@blocknote/core/extensions"
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { DragDropContext, Droppable, Draggable, type DropResult, type DroppableProps } from '@hello-pangea/dnd'
import PriorityView from './components/PriorityView';
import {
  PiTelevision, PiFolder, PiNotePencil, PiStack, PiCalendar, PiMoon, PiSun, PiTarget,
  PiPlus, PiList, PiPencilSimple, PiTrash, PiCaretDown, PiImage,
  PiTag, PiCheckCircle, PiWarningCircle, PiX, PiCommand, PiSidebarSimple,
  PiWallet, PiArrowDownRight, PiArrowUpRight
} from 'react-icons/pi'

import { GlobalSearch } from './components/GlobalSearch'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import './App.css'
import { supabase } from './lib/supabase'
import logoSaya from './assets/logobaru.png'

type Note = { id: string; title: string; type: 'note'; content?: any; tags?: string[]; icon?: string; cover?: string; }
type Folder = { id: string; name: string; isOpen: boolean; notes: Note[]; color: string }
type Task = { id: string; title: string; date: string; category: string; status: string; priority_level?: string | null }
type SearchResult = { id: string; title: string; type: 'task' | 'note'; folderId?: string; }
type GoalHistory = { id: string; date: string; mode: 'daily' | 'weekly'; progress: number; }
type Transaction = { id: string; amount: number; type: 'income' | 'expense'; category: string; date: string; description: string; }

const EMOJI_LIST = ['😀', '🚀', '🔥', '💻', '📝', '✨', '🌟', '💡', '📌', '🎯', '🎨', '📊', '📈', '🧠', '⚡', '✅', '🎈', '🎉', '🏆', '📚', '🎵', '☕', '✈️', '🌿', '💰', '🍔', '🏍️'];
const COVER_LIST = [
  'linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(to right, #43e97b 0%, #38f9d7 100%)',
  '#1e2029', '#333645', '#0f172a'
];

const FINANCE_CATEGORIES = {
  expense: ['Makanan & Minuman', 'Transportasi & Bengkel', 'Hiburan & Game', 'Kebutuhan Kuliah', 'Lainnya'],
  income: ['Uang Saku', 'Beasiswa/Project', 'Lainnya']
};

const getCustomSlashMenuItems = (editor: any) => {
  const colors = [
    { name: "Default", value: "default", hex: "transparent" },
    { name: "Gray", value: "gray", hex: "#ebeced" },
    { name: "Brown", value: "brown", hex: "#e9e5e3" },
    { name: "Orange", value: "orange", hex: "#faebdd" },
    { name: "Yellow", value: "yellow", hex: "#fbf3db" },
    { name: "Green", value: "green", hex: "#ddedea" },
    { name: "Blue", value: "blue", hex: "#ddebf1" },
    { name: "Purple", value: "purple", hex: "#eae4f2" },
    { name: "Pink", value: "pink", hex: "#f4dfeb" },
    { name: "Red", value: "red", hex: "#fbe4e4" },
  ];

  const colorItems = colors.map((color) => ({
    title: `${color.name} Background`,
    onItemClick: () => {
      const currentBlock = editor.getTextCursorPosition()?.block;
      if (currentBlock) { editor.updateBlock(currentBlock, { props: { ...currentBlock.props, backgroundColor: color.value } }); }
    },
    aliases: [color.name.toLowerCase(), "background", "bg", "stabillo", "warna"],
    group: "Background Colors",
    icon: (<div style={{ width: "18px", height: "18px", borderRadius: "4px", backgroundColor: color.hex, border: color.value === "default" ? "1px dashed var(--text-secondary)" : "1px solid var(--border-subtle)", opacity: color.value === "default" ? 0.5 : 1 }} />),
    subtext: color.value === "default" ? "Hapus warna latar belakang" : `Ubah latar belakang menjadi ${color.name.toLowerCase()}`,
  }));
  return [...getDefaultReactSlashMenuItems(editor), ...colorItems];
};

function EditorWrapper({ note, isDarkMode, editable = true, onContentChange }: { note: Note, isDarkMode: boolean, editable?: boolean, onContentChange: (noteId: string, content: string) => void }) {
  const initialContent = note.content && typeof note.content === 'string' ? JSON.parse(note.content) : (typeof note.content === 'object' ? note.content : undefined);
  const editor = useCreateBlockNote({ initialContent, domAttributes: { editor: { spellcheck: "false" } } });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorChange = () => {
    const content = JSON.stringify(editor.document);
    onContentChange(note.id, content);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => { await supabase.from('notes').update({ content }).eq('id', note.id); }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && (e.key === ']' || e.key === '[')) {
      e.preventDefault(); e.stopPropagation();
      const pmDom = document.querySelector('.ProseMirror') as HTMLElement;
      if (pmDom) {
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, shiftKey: e.key === '[', bubbles: true, cancelable: true });
        pmDom.dispatchEvent(tabEvent);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const cursor = editor.getTextCursorPosition();
    if (cursor && cursor.block && (cursor.block.type === 'bulletListItem' || cursor.block.type === 'numberedListItem' || cursor.block.type === 'heading')) {
      const plainText = e.clipboardData.getData('text/plain');
      if (plainText) {
        e.preventDefault(); e.stopPropagation();
        const lines = plainText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length > 0) {
          document.execCommand('insertText', false, lines[0]);
          if (lines.length > 1) {
            const newBlocks: any[] = lines.slice(1).map(line => ({ type: cursor.block.type, props: cursor.block.props, content: line }));
            editor.insertBlocks(newBlocks, cursor.block, 'after');
          }
        }
      }
    }
  };

  return (
    <div onKeyDownCapture={handleKeyDown} onPasteCapture={handlePaste} style={{ width: '100%', height: '100%' }}>
      <BlockNoteView editor={editor} editable={editable} theme={isDarkMode ? 'dark' : 'light'} onChange={handleEditorChange} slashMenu={false}>
        <SuggestionMenuController triggerCharacter={"/"} getItems={async (query) => filterSuggestionItems(getCustomSlashMenuItems(editor), query)} />
      </BlockNoteView>
    </div>
  );
}

const CustomDateInput = forwardRef<HTMLInputElement, any>(({ value, onClick }, ref) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
    <PiCalendar style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)', fontSize: '1.2rem', pointerEvents: 'none', zIndex: 1 }} />
    <input type="text" className="form-control" style={{ paddingLeft: '38px', cursor: 'pointer', width: '100%' }} value={value} onClick={onClick} ref={ref} readOnly placeholder="Pilih Tanggal..." />
  </div>
));

export const StrictModeDroppable = ({ children, ...props }: DroppableProps) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { const animation = requestAnimationFrame(() => setEnabled(true)); return () => { cancelAnimationFrame(animation); setEnabled(false); }; }, []);
  if (!enabled) return null;
  return <Droppable {...props}>{children}</Droppable>;
};

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true)
  const [isZenMode] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [isReadingMode] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  const [folders, setFolders] = useState<Folder[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<{ id: string; text: string; done: boolean; mode: 'daily' | 'weekly' }[]>([]);
  const [history, setHistory] = useState<GoalHistory[]>([]);

  // State Tampilan
  const [activeView, setActiveView] = useState<'dashboard' | 'calendar' | 'kanban' | 'priority' | 'note' | 'tag' | 'finance'>('dashboard');
  const [activeTag, setActiveTag] = useState<string>('')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null)
  const [noteContextMenu, setNoteContextMenu] = useState<{ x: number; y: number; noteId: string; folderId: string } | null>(null)

  // Removed unused: renameModal, setRenameModal, deleteModal, setDeleteModal, renameNoteModal, setRenameNoteModal, deleteNoteModal, setDeleteNoteModal, deleteTaskModal, setDeleteTaskModal
  const [inputModal, setInputModal] = useState<{ isOpen: boolean; mode: 'create_folder' | 'create_note'; folderId?: string }>({ isOpen: false, mode: 'create_folder' })
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([])
  const [quickAddPopover, setQuickAddPopover] = useState<{ isOpen: boolean; target: HTMLElement | null; date: string }>({ isOpen: false, target: null, date: '' });

  // Removed unused: deleteGoalModal, setDeleteGoalModal
  // Removed unused: addTagModal, setAddTagModal
  const [financeModal, setFinanceModal] = useState<{ isOpen: boolean, type: 'income' | 'expense' }>({ isOpen: false, type: 'expense' });

  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const [taskModal, setTaskModal] = useState<{ isOpen: boolean; defaultCategory: string; defaultDate: string; }>({ isOpen: false, defaultCategory: '', defaultDate: new Date().toISOString().split('T')[0] })
  const [editEventModal, setEditEventModal] = useState<{ isOpen: boolean; event: Task | null }>({ isOpen: false, event: null });
  // Removed unused: eventNotes, setEventNotes, openEventDetail, setOpenEventDetail, eventPopover, setEventPopover

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light') }, [isDarkMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowCommandPalette(prev => !prev); }
      if (e.key === 'Escape') setShowCommandPalette(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null)
    const closeNoteContextMenu = () => setNoteContextMenu(null)
    if (contextMenu) { window.addEventListener('click', closeContextMenu); return () => window.removeEventListener('click', closeContextMenu) }
    if (noteContextMenu) { window.addEventListener('click', closeNoteContextMenu); return () => window.removeEventListener('click', closeNoteContextMenu) }
  }, [contextMenu, noteContextMenu])

  const toggleTheme = () => setIsDarkMode(!isDarkMode)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).toLocaleDateString('en-CA');
  }

  const fetchData = async () => {
    const { data: tasksData } = await supabase.from('tasks').select('*');
    if (tasksData) setTasks(tasksData as Task[]);

    const { data: foldersData } = await supabase.from('folders').select(`*, notes (*)`).order('created_at', { ascending: true });
    if (foldersData) {
      setFolders(foldersData.map((f: any) => ({
        id: f.id, name: f.name, color: f.color, isOpen: f.is_open,
        notes: (f.notes || []).map((n: any) => ({
          id: n.id, title: n.title, type: n.type, content: n.content, tags: n.tags || [], icon: n.icon || '', cover: n.cover || ''
        }))
      })));
    }

    const { data: txData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (txData) setTransactions(txData as Transaction[]);

    let currentGoals: any[] = [];
    const { data: goalsData } = await supabase.from('goals').select('*').order('created_at', { ascending: true });
    if (goalsData) currentGoals = goalsData.map(g => ({ id: g.id, text: g.text, done: g.is_done, mode: g.mode as 'daily' | 'weekly' }));

    const todayStr = new Date().toLocaleDateString('en-CA');
    const currentMondayStr = getMonday(new Date());
    const lastOpenedDaily = localStorage.getItem('last_opened_daily');
    const lastOpenedWeekly = localStorage.getItem('last_opened_weekly');

    if (!lastOpenedDaily) {
      localStorage.setItem('last_opened_daily', todayStr);
    } else if (lastOpenedDaily !== todayStr) {
      const dailyGoals = currentGoals.filter(g => g.mode === 'daily');
      if (dailyGoals.length > 0) {
        const prog = Math.round((dailyGoals.filter(g => g.done).length / dailyGoals.length) * 100);
        await supabase.from('goals_history').insert([{ date: lastOpenedDaily, mode: 'daily', progress: prog }]);
        await supabase.from('goals').update({ is_done: false }).eq('mode', 'daily');
        currentGoals = currentGoals.map(g => g.mode === 'daily' ? { ...g, done: false } : g);
      }
      localStorage.setItem('last_opened_daily', todayStr);
    }

    if (!lastOpenedWeekly) {
      localStorage.setItem('last_opened_weekly', currentMondayStr);
    } else if (lastOpenedWeekly !== currentMondayStr) {
      const weeklyGoals = currentGoals.filter(g => g.mode === 'weekly');
      if (weeklyGoals.length > 0) {
        const prog = Math.round((weeklyGoals.filter(g => g.done).length / weeklyGoals.length) * 100);
        await supabase.from('goals_history').insert([{ date: lastOpenedWeekly, mode: 'weekly', progress: prog }]);
        await supabase.from('goals').update({ is_done: false }).eq('mode', 'weekly');
        currentGoals = currentGoals.map(g => g.mode === 'weekly' ? { ...g, done: false } : g);
      }
      localStorage.setItem('last_opened_weekly', currentMondayStr);
    }

    setGoals(currentGoals);
    const { data: historyData } = await supabase.from('goals_history').select('*');
    if (historyData) setHistory(historyData as GoalHistory[]);
  };

  const [goalMode, setGoalMode] = useState<'daily' | 'weekly'>('daily');
  const [goalInput, setGoalInput] = useState('');
  const filteredGoals = goals.filter(g => g.mode === goalMode);
  const progress = filteredGoals.length === 0 ? 0 : Math.round(filteredGoals.filter(g => g.done).length / filteredGoals.length * 100);

  const handleAddGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (goalInput.trim()) {
      const { data } = await supabase.from('goals').insert([{ text: goalInput.trim(), mode: goalMode, is_done: false }]).select().single();
      if (data) { setGoals([...goals, { id: data.id, text: data.text, done: data.is_done, mode: data.mode }]); setGoalInput(''); }
    }
  };

  // Removed unused: handleDeleteGoalClick
  // confirmDeleteGoal is unused, removed
  const toggleGoalDone = async (goalId: string, currentStatus: boolean) => {
    setGoals(goals.map(g => g.id === goalId ? { ...g, done: !currentStatus } : g));
    await supabase.from('goals').update({ is_done: !currentStatus }).eq('id', goalId);
  };

  const handleInputSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const formData = new FormData(e.currentTarget); const value = formData.get('inputValue') as string; const color = formData.get('inputColor') as string || '#6366f1';
    if (!value) return;
    if (inputModal.mode === 'create_folder') {
      const { data } = await supabase.from('folders').insert([{ name: value, color: color, is_open: true }]).select().single();
      if (data) { setFolders(prev => [...prev, { id: data.id, name: data.name, isOpen: data.is_open, notes: [], color: data.color }]); showToast('Folder dibuat'); }
    } else if (inputModal.mode === 'create_note' && inputModal.folderId) {
      const { data } = await supabase.from('notes').insert([{ folder_id: inputModal.folderId, title: value, type: 'note' }]).select().single();
      if (data) {
        const newNote: Note = { id: data.id, title: data.title, type: data.type, tags: [], icon: '', cover: '' };
        setFolders(prev => prev.map(f => f.id === inputModal.folderId ? { ...f, notes: [...f.notes, newNote], isOpen: true } : f)); setActiveNote(newNote); setActiveView('note'); showToast('Catatan dibuat');
      }
    }
    setInputModal({ ...inputModal, isOpen: false });
  }

  const handleTaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const formData = new FormData(e.currentTarget);
    const taskData = { title: formData.get('title') as string, category: formData.get('category') as string, date: taskModal.defaultDate, status: 'To Do' };
    const { data } = await supabase.from('tasks').insert([taskData]).select().single();
    if (data) { setTasks([...tasks, data as Task]); setTaskModal({ ...taskModal, isOpen: false }); showToast('Tugas ditambahkan'); }
  }

  const handleQuickAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const formData = new FormData(e.currentTarget); const title = formData.get('title') as string;
    if (!title) return;
    const taskData = { title, category: formData.get('category') as string, date: quickAddPopover.date, status: 'To Do' };
    const { data } = await supabase.from('tasks').insert([taskData]).select().single();
    if (data) { setTasks(prev => [...prev, data as Task]); showToast('Tugas ditambahkan'); setQuickAddPopover({ isOpen: false, target: null, date: '' }); }
  }

  const handleEditEventSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const formData = new FormData(e.currentTarget); if (!editEventModal.event) return;
    const updatedData = { title: formData.get('title') as string, category: formData.get('category') as string, date: editEventModal.event.date, status: formData.get('status') as string, };
    const { data } = await supabase.from('tasks').update(updatedData).eq('id', editEventModal.event.id).select().single();
    if (data) { setTasks(prev => prev.map(t => t.id === data.id ? (data as Task) : t)); setEditEventModal({ isOpen: false, event: null }); showToast('Event diubah'); }
  };

  const handleTransactionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const txData = {
      amount, type: financeModal.type, category: formData.get('category') as string,
      date: formData.get('date') as string, description: formData.get('description') as string
    };

    const { data, error } = await supabase.from('transactions').insert([txData]).select().single();
    if (error) { showToast('Gagal menyimpan transaksi', 'error'); return; }
    if (data) {
      setTransactions(prev => [data as Transaction, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setFinanceModal({ isOpen: false, type: 'expense' });
      showToast('Transaksi berhasil dicatat');
    }
  };

  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    await supabase.from('transactions').delete().eq('id', id);
    showToast('Transaksi dihapus');
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const cycle: Record<string, string> = { 'To Do': 'In Progress', 'In Progress': 'Done', 'Done': 'To Do' };
    const newStatus = cycle[currentStatus] ?? 'To Do';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
  }

  // confirmDeleteTask is unused, removed

  const assignPriority = async (taskId: string, level: string | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority_level: level } : t));
    await supabase.from('tasks').update({ priority_level: level }).eq('id', taskId);
  };

  const onPriorityDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result; if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const taskToMove = tasks.find(t => t.id === draggableId); if (!taskToMove) return;
    const destId = destination.droppableId; const newLevel = destId === 'unassigned' ? null : destId;
    const newTasks = tasks.filter(t => t.id !== draggableId);
    const activeTasks = newTasks.filter(t => t.status !== 'Done');
    const destTasks = activeTasks.filter(t => newLevel === null ? !t.priority_level : t.priority_level === newLevel);
    let insertionIndex = newTasks.length;
    if (destination.index === 0) { const firstTask = destTasks[0]; insertionIndex = firstTask ? newTasks.indexOf(firstTask) : newTasks.length; }
    else { const taskBefore = destTasks[destination.index - 1]; if (taskBefore) insertionIndex = newTasks.indexOf(taskBefore) + 1; }
    newTasks.splice(insertionIndex, 0, { ...taskToMove, priority_level: newLevel });
    setTasks(newTasks);
    if (taskToMove.priority_level !== newLevel) await supabase.from('tasks').update({ priority_level: newLevel }).eq('id', taskToMove.id);
  };

  // confirmDeleteFolder is unused, removed

  // confirmDeleteNote is unused, removed

  // handleRenameFolder is unused, removed

  // handleRenameNoteSubmit is unused, removed

  const toggleFolderInSidebar = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setFolders(prev => prev.map(f => (f.id === folderId ? { ...f, isOpen: !f.isOpen } : f)));
      await supabase.from('folders').update({ is_open: !folder.isOpen }).eq('id', folderId);
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result; if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const taskToMove = tasks.find(t => t.id === draggableId); if (!taskToMove) return;
    const destFolder = folders.find(f => f.id === destination.droppableId); const destCategory = destFolder ? destFolder.name : taskToMove.category;
    const newTasks = tasks.filter(t => t.id !== draggableId); const destinationTasks = newTasks.filter(t => t.category === destCategory);
    let insertionIndex;
    if (destination.index === 0) { const firstTaskOfCategory = newTasks.find(t => t.category === destCategory); insertionIndex = firstTaskOfCategory ? newTasks.indexOf(firstTaskOfCategory) : newTasks.length; }
    else { const taskBefore = destinationTasks[destination.index - 1]; insertionIndex = newTasks.indexOf(taskBefore) + 1; }
    newTasks.splice(insertionIndex, 0, { ...taskToMove, category: destCategory });
    setTasks(newTasks);
    if (taskToMove.category !== destCategory) await supabase.from('tasks').update({ category: destCategory }).eq('id', taskToMove.id);
  };

  const onNoteTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    if (activeNote) {
      setActiveNote({ ...activeNote, title: newTitle });
      setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, title: newTitle } : n) })));
      await supabase.from('notes').update({ title: newTitle }).eq('id', activeNote.id);
    }
  }

  const onNoteContentChange = (noteId: string, newContent: string) => {
    setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === noteId ? { ...n, content: newContent } : n) })));
    setActiveNote(prev => prev && prev.id === noteId ? { ...prev, content: newContent } : prev);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    if (result.type === 'note') {
      const note = folders.flatMap(f => f.notes).find(n => n.id === result.id);
      if (note) { setActiveNote(note); setActiveView('note'); }
    } else if (result.type === 'task') {
      const task = tasks.find(t => t.id === result.id);
      if (task) {
        setActiveView('calendar');
        const [yearStr, monthStr] = task.date.split('-');
        setCalendarYear(parseInt(yearStr, 10)); setCalendarMonth(parseInt(monthStr, 10) - 1);
        setTimeout(() => { const dayCell = document.querySelector(`.cal-day[data-date-str="${task.date}"]`); if (dayCell) { (dayCell as HTMLElement).click(); } }, 100);
      }
    }
  };

  // Removed unused: openEventPopover
  // closeEventPopover and openQuickAdd are unused, removed
  const openTaskModal = (category: string = '', date?: string) => {
    const validCategory = category || (folders[0]?.name || ''); const validDate = date || new Date().toISOString().split('T')[0];
    setTaskModal({ isOpen: true, defaultCategory: validCategory, defaultDate: validDate });
  }

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => { e.preventDefault(); e.stopPropagation(); setNoteContextMenu(null); setContextMenu({ x: e.clientX, y: e.clientY, folderId }) }
  const handleNoteContextMenu = (e: React.MouseEvent, noteId: string, folderId: string) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); setNoteContextMenu({ x: e.clientX, y: e.clientY, noteId, folderId }) }
  const createNewFolder = () => setInputModal({ isOpen: true, mode: 'create_folder' })
  // handleAddNote, openDeleteModal, openRenameModal are unused, removed
  const toggleCategoryOnDashboard = (folderId: string) => { setOpenCategories(prev => ({ ...prev, [folderId]: !(prev[folderId] ?? true) })) }
  // Removed unused: deleteTask

  const calculatePopoverPosition = (target: HTMLElement | null) => {
    if (!target) return {}; const rect = target.getBoundingClientRect(); const popoverHeight = 180; const popoverWidth = 320; let top; let left = rect.left; const margin = 2;
    if (rect.bottom + margin + popoverHeight <= window.innerHeight) { top = rect.bottom + margin; } else { top = rect.top - popoverHeight - margin; }
    if (left + popoverWidth > window.innerWidth) left = window.innerWidth - popoverWidth - 12;
    return { top: Math.max(top, 8), left: Math.max(left, 8) };
  }

  const today = new Date()
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth())
  const [calendarYear, setCalendarYear] = useState(today.getFullYear())
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay()
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  const activeFolder = activeNote ? folders.find(f => f.notes.some(n => n.id === activeNote.id)) : null
  const getCoverGradient = (id: string) => { const gradients = ['linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)', 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)', 'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)']; const numMatch = id.match(/\d+/g); const index = numMatch ? parseInt(numMatch.join('')) % gradients.length : 0; return gradients[index]; }
  const allTags = Array.from(new Set(folders.flatMap(f => f.notes.flatMap(n => n.tags || [])))).sort();
  // Removed unused: handleAddTagClick

  // submitAddTag is unused, removed

  const handleRemoveTagFromNote = async (tagToRemove: string) => {
    if (activeNote) {
      const updatedTags = (activeNote.tags || []).filter(t => t !== tagToRemove);
      setActiveNote({ ...activeNote, tags: updatedTags });
      setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, tags: updatedTags } : n) })));
      await supabase.from('notes').update({ tags: updatedTags }).eq('id', activeNote.id);
    }
  }

  const handleSelectIcon = async (iconStr: string) => { if (!activeNote) return; setActiveNote({ ...activeNote, icon: iconStr }); setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, icon: iconStr } : n) }))); setShowIconPicker(false); try { await supabase.from('notes').update({ icon: iconStr }).eq('id', activeNote.id); } catch (e) { } }
  const handleSelectCover = async (coverStr: string) => { if (!activeNote) return; setActiveNote({ ...activeNote, cover: coverStr }); setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, cover: coverStr } : n) }))); setShowCoverPicker(false); try { await supabase.from('notes').update({ cover: coverStr }).eq('id', activeNote.id); } catch (e) { } }

  const renderHeatmap = () => {
    const boxes = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); const dateStr = d.toLocaleDateString('en-CA');
      const record = history.find(h => h.mode === 'daily' && h.date === dateStr);
      const prog = record ? record.progress : 0; let level = 0;
      if (prog > 0 && prog <= 25) level = 1; else if (prog > 25 && prog <= 50) level = 2; else if (prog > 50 && prog <= 75) level = 3; else if (prog > 75) level = 4;
      boxes.push(<div key={dateStr} className={`heatmap-box level-${level}`} title={`${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}: ${prog}% Selesai`} />);
    }
    return boxes;
  };

  const renderWeeklyCards = () => {
    const cards = [];
    for (let i = 3; i >= 1; i--) {
      const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1) - (i * 7); const pastMondayStr = new Date(d.setDate(diff)).toLocaleDateString('en-CA');
      const record = history.find(h => h.mode === 'weekly' && h.date === pastMondayStr); const prog = record ? record.progress : 0;
      cards.push(<div key={pastMondayStr} className="weekly-card"><span className="weekly-card-label">{i} Mg Lalu</span><div className="weekly-card-circle" style={{ '--progress': `${prog}%` } as React.CSSProperties}><span>{prog}%</span></div></div>);
    }
    cards.push(<div key="current" className="weekly-card" style={{ borderColor: 'var(--accent)' }}><span className="weekly-card-label" style={{ color: 'var(--accent)' }}>Mg Ini</span><div className="weekly-card-circle" style={{ '--progress': `${progress}%` } as React.CSSProperties}><span>{progress}%</span></div></div>);
    return cards;
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyTransactions = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; });
  const totalIncome = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const currentBalance = totalIncome - totalExpense;
  const formatRupiah = (number: number) => { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number); }

  // --- TAMBAHAN LOGIKA WIDGET KANAN DI SINI ---
  const upcomingTasks = tasks
    .filter(t => t.status !== 'Done')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3); 

  const expensePercentage = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;
  // --------------------------------------------

  return (
    <div className={`app-container ${isZenMode ? 'zen-mode' : ''}`} onClick={() => { setShowIconPicker(false); setShowCoverPicker(false); }}>
      <div className="aurora-bg"></div>

      {showCommandPalette && (
        <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '12vh', backdropFilter: 'blur(8px)' }} onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette-card" style={{ width: '100%', maxWidth: '560px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', padding: '1rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
              <PiCommand style={{ marginRight: '8px', fontSize: '1.2rem' }} /> Global Search (ESC to close)
            </div>
            <GlobalSearch tasks={tasks} folders={folders} onResultClick={(res) => { handleSearchResultClick(res); setShowCommandPalette(false); }} />
          </div>
        </div>
      )}

      {/* KOLOM 1: NAVIGASI KIRI */}
      {!isZenMode && (
        <nav className="sidebar-rail" onClick={() => setIsSidebarOpen(false)}>
          <div className="rail-avatar" style={{ padding: 0, overflow: 'hidden', background: 'transparent' }}>
            <img src={logoSaya} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <button className={`rail-icon ${activeView === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveView('dashboard'); setIsSidebarOpen(false); }} title="Task Lists"><PiTelevision /></button>
          <button className={`rail-icon ${activeView === 'kanban' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveView('kanban'); setIsSidebarOpen(false); }} title="Kanban Board"><PiStack /></button>
          <button className={`rail-icon ${activeView === 'calendar' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveView('calendar'); setIsSidebarOpen(false); }} title="Calendar"><PiCalendar /></button>
          <button className={`rail-icon ${activeView === 'priority' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveView('priority'); setIsSidebarOpen(false); }} title="Priority Matrix"><PiTarget /></button>
          <button className={`rail-icon ${activeView === 'finance' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveView('finance'); setIsSidebarOpen(false); }} title="Wallet & Finance"><PiWallet /></button>
          <button className={`rail-icon ${activeView === 'note' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveView('note'); setActiveNote(null); setIsSidebarOpen(true); }} title="My Notes"><PiFolder /></button>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="rail-icon" onClick={(e) => { e.stopPropagation(); setShowCommandPalette(true); }} title="Search (Ctrl+K)"><PiCommand /></button>
            <button className="rail-icon" onClick={(e) => { e.stopPropagation(); toggleTheme(); }} title="Toggle Theme">{isDarkMode ? <PiSun /> : <PiMoon />}</button>
          </div>
        </nav>
      )}

      <aside className={`sidebar-panel ${(!isSidebarOpen || isZenMode) ? 'closed' : ''}`}>
        <div className="sidebar-section-header"><span>My Folders</span><button onClick={createNewFolder} title="New Folder"><PiPlus /></button></div>
        <ul className="nav-list">
          {folders.map(folder => (
            <li key={folder.id} className="folder-wrapper">
              <div className="folder-header" onContextMenu={(e) => handleContextMenu(e, folder.id)}>
                <span className="folder-arrow" onClick={() => toggleFolderInSidebar(folder.id)}><PiCaretDown style={{ transform: folder.isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} /></span>
                <span className="folder-icon" onClick={() => toggleFolderInSidebar(folder.id)}><PiFolder color={folder.color} size={18} /></span>
                <span className="folder-name" onClick={() => toggleFolderInSidebar(folder.id)}>{folder.name}</span>
              </div>
              {folder.isOpen && (
                <ul className="folder-content">
                  {folder.notes.map(note => (
                    <li key={note.id} className={`note-item ${activeNote?.id === note.id && activeView === 'note' ? 'active' : ''}`} onClick={() => { setActiveNote(note); setActiveView('note') }} onContextMenu={(e) => handleNoteContextMenu(e, note.id, folder.id)}>
                      {note.icon ? <span style={{ marginRight: '6px' }}>{note.icon}</span> : <PiNotePencil style={{ marginRight: '6px' }} />} {note.title}
                    </li>
                  ))}
                </ul>)}
            </li>
          ))}
        </ul>
        {allTags.length > 0 && (
          <>
            <div className="sidebar-section-header"><span>Categories</span></div>
            <ul className="nav-list">
              {allTags.map(tag => (
                <li key={tag} className={`nav-item ${activeView === 'tag' && activeTag === tag ? 'active' : ''}`} onClick={() => { setActiveTag(tag); setActiveView('tag'); }}>
                  <PiTag style={{ marginRight: '8px', fontSize: '1.1rem' }} /> {tag}
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      {/* KOLOM 2: AREA KERJA UTAMA */}
      <main className="editor-area main-column" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={() => !isZenMode && setIsSidebarOpen(false)}>
        {!isZenMode && (
          <header className="editor-header" style={{ padding: '1rem 2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
              {activeView === 'note' && (<button className="btn-graph" onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(!isSidebarOpen); }} title="Toggle Sidebar"><PiList /></button>)}
              <span className="breadcrumb" style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeView === 'dashboard' ? <><PiTelevision color="var(--accent)" /> Task Lists</> : 
                 activeView === 'kanban' ? <><PiStack color="var(--accent)" /> Kanban Board</> :
                 activeView === 'calendar' ? <><PiCalendar color="var(--accent)" /> Calendar</> :
                 activeView === 'priority' ? <><PiTarget color="var(--accent)" /> Priority Matrix</> :
                 activeView === 'finance' ? <><PiWallet color="var(--accent)" /> Financial Tracker</> :
                 activeView === 'tag' ? <><PiTag color="var(--accent)" /> {activeTag}</> : 
                 activeNote ? (<><span style={{ opacity: 0.6 }}>{activeFolder?.name || 'Folder'}</span> <span style={{ margin: '0 6px', opacity: 0.4 }}>/</span> <span>{activeNote?.title}</span></>) : 
                 (<><PiFolder color="var(--accent)" /> My Notes</>)}
              </span>
            </div>
            {/* Toggle Panel Kanan */}
            <button className="btn-graph" onClick={() => setIsRightPanelOpen(!isRightPanelOpen)} style={{ padding: '8px' }} title="Toggle Right Panel">
              <PiSidebarSimple size={20} />
            </button>
          </header>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: activeView === 'note' ? '0' : '0 2rem 2rem' }}>
          
          {activeView === 'dashboard' && (
            <div className="dashboard-view" style={{ padding: 0 }}>
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="category-views" style={{ marginTop: '1rem' }}>
                  {folders.map(folder => {
                    const folderTasks = tasks.filter(t => t.category === folder.name).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const isCategoryOpen = openCategories[folder.id] ?? true;
                    return (
                      <div key={folder.id} className="category-group">
                        <div className="category-header" onClick={() => toggleCategoryOnDashboard(folder.id)} style={{ cursor: 'pointer' }}>
                          <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s', transform: isCategoryOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                          <span className="category-pill">{folder.name}</span>
                        </div>
                        {isCategoryOpen && (
                          <StrictModeDroppable droppableId={folder.id}>
                            {(provided) => (
                              <div ref={provided.innerRef} {...provided.droppableProps}>
                                <div className="task-list-header"><span>Meeting / Task Name</span><span>Date</span></div>
                                {folderTasks.map((task, index) => (
                                  <Draggable key={task.id} draggableId={task.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`task-row ${task.status === 'Done' ? 'completed' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}>
                                        <input type="checkbox" className="custom-checkbox" checked={task.status === 'Done'} onChange={() => toggleTaskStatus(task.id, task.status)} />
                                        <span className="task-title" title={task.title}>{task.title}</span>
                                        <span className="task-date" style={{ textAlign: 'right' }}>{new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                <button className="btn-inline-add" onClick={(e) => { e.stopPropagation(); openTaskModal(folder.name, ''); }}><PiPlus style={{ marginRight: '4px' }} /> New Task</button>
                              </div>
                            )}
                          </StrictModeDroppable>
                        )}
                      </div>
                    );
                  })}
                  <button className="btn-inline-add" style={{ marginTop: '2rem' }} onClick={createNewFolder}><PiPlus style={{ marginRight: '4px' }} /> Add new category</button>
                </div>
              </DragDropContext>
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="calendar-views" style={{ marginTop: '1rem' }}>
              <div className="calendar-nav-bar">
                <button className="btn-timer" onClick={() => setCalendarYear(y => y - 1)}>&lt;&lt;</button>
                <button className="btn-timer" onClick={() => setCalendarMonth(m => m === 0 ? 11 : m - 1)}>&lt;</button>
                <span className="calendar-month-label">{monthNames[calendarMonth]}</span>
                <span className="calendar-year-label">{calendarYear}</span>
                <button className="btn-timer" onClick={() => setCalendarMonth(m => m === 11 ? 0 : m + 1)}>&gt;</button>
                <button className="btn-timer" onClick={() => setCalendarYear(y => y + 1)}>&gt;&gt;</button>
              </div>
              <div className="calendar-header-row">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="calendar-grid">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="cal-day empty"></div>)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayTasks = tasks.filter(t => t.date === dateStr)
                  const isToday = day === today.getDate() && calendarMonth === today.getMonth() && calendarYear === today.getFullYear();
                  const isImportant = dayTasks.some(t => /urgent|penting/i.test(t.title));
                  return (
                    <div key={day} className={`cal-day ${isToday ? 'today' : ''} ${isImportant ? 'important-day' : ''}`} style={{ position: 'relative', cursor: 'pointer' }} data-date-str={dateStr}>
                      <div className="day-header"><span className="day-num">{day}</span></div>
                      {dayTasks.length > 0 && (() => {
                        const shownPills = dayTasks.slice(0, 2); const restDots = dayTasks.slice(2);
                        return (
                          <div className="cal-events-wrap">
                            {shownPills.map(t => (
                              <div key={t.id} className={`cal-event-pill ${t.status === 'Done' ? 'pill-done' : ''}`} style={{ background: folders.find(f => f.name === t.category)?.color || '#6366f1' }}>
                                <span className="pill-text">{t.title}</span>
                              </div>
                            ))}
                            {restDots.length > 0 && <div className="cal-dots-more">+{restDots.length} more</div>}
                          </div>
                        );
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeView === 'kanban' && (
            <div className="kanban-wrapper" style={{ marginTop: '1rem' }}>
              <DragDropContext onDragEnd={async (result) => {
                const { source, destination, draggableId } = result; if (!destination) return;
                if (destination.droppableId === source.droppableId && destination.index === source.index) return;
                setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: destination.droppableId } : t));
                await supabase.from('tasks').update({ status: destination.droppableId }).eq('id', draggableId);
              }}>
                <div className="kanban-board">
                  {[{ key: 'To Do', label: 'To Do', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', icon: '○' }, { key: 'In Progress', label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '◑' }, { key: 'Done', label: 'Done', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', icon: '●' }].map(col => {
                    const colTasks = tasks.filter(t => t.status === col.key);
                    return (
                      <div key={col.key} className="kanban-column" style={{ '--kanban-color': col.color, '--kanban-bg': col.bg } as React.CSSProperties}>
                        <div className="kanban-column-header"><span className="kanban-status-dot" style={{ color: col.color }}>{col.icon}</span><span className="kanban-column-title">{col.label}</span><span className="kanban-count">{colTasks.length}</span></div>
                        <StrictModeDroppable droppableId={col.key}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`kanban-cards ${snapshot.isDraggingOver ? 'drag-over' : ''}`}>
                              {colTasks.map((task, idx) => (
                                <Draggable key={task.id} draggableId={task.id} index={idx}>
                                  {(provided, snap) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`kanban-card ${snap.isDragging ? 'dragging' : ''}`}>
                                      <div className="kanban-card-title">{task.title}</div>
                                      <div className="kanban-card-footer">
                                        <span className="kanban-card-date"><PiCalendar size={12} style={{ marginRight: 4 }} />{new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        <button className="kanban-card-edit-btn" onClick={() => setEditEventModal({ isOpen: true, event: task })}><PiPencilSimple size={12} /></button>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </StrictModeDroppable>
                      </div>
                    );
                  })}
                </div>
              </DragDropContext>
            </div>
          )}

          {activeView === 'priority' && <div style={{ marginTop: '1rem' }}><PriorityView tasks={tasks} onAssign={assignPriority} onDragEnd={onPriorityDragEnd} /></div>}

          {/* TAMPILAN KEUANGAN */}
          {activeView === 'finance' && (
            <div className="finance-dashboard" style={{ marginTop: '1rem' }}>
              <div className="finance-summary-cards">
                <div className="finance-card">
                  <div className="finance-card-title"><PiWallet size={18} /> Sisa Saldo Bulan Ini</div>
                  <div className="finance-card-amount">{formatRupiah(currentBalance)}</div>
                </div>
                <div className="finance-card">
                  <div className="finance-card-title"><PiArrowUpRight size={18} color="#10b981" /> Pemasukan</div>
                  <div className="finance-card-amount" style={{ color: '#10b981' }}>{formatRupiah(totalIncome)}</div>
                </div>
                <div className="finance-card">
                  <div className="finance-card-title"><PiArrowDownRight size={18} color="#ef4444" /> Pengeluaran</div>
                  <div className="finance-card-amount" style={{ color: '#ef4444' }}>{formatRupiah(totalExpense)}</div>
                </div>
              </div>

              <div className="transaction-list-container" style={{ marginTop: '2rem' }}>
                <div className="transaction-list-header">
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><PiList /> Riwayat Transaksi</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-primary" style={{ background: '#ef4444' }} onClick={() => setFinanceModal({ isOpen: true, type: 'expense' })}>Catat Pengeluaran</button>
                    <button className="btn-primary" style={{ background: '#10b981' }} onClick={() => setFinanceModal({ isOpen: true, type: 'income' })}>Catat Pemasukan</button>
                  </div>
                </div>

                {transactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Belum ada data transaksi.</div>
                ) : (
                  transactions.map(tx => (
                    <div key={tx.id} className="transaction-row">
                      <div className={`tx-icon ${tx.type}`}>{tx.type === 'income' ? <PiArrowUpRight /> : <PiArrowDownRight />}</div>
                      <div className="tx-details">
                        <span className="tx-desc">{tx.description}</span>
                        <span className="tx-cat">{tx.category}</span>
                      </div>
                      <div className="tx-date">{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div className={`tx-amount ${tx.type}`}>{tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}</div>
                      <button className="btn-icon-danger" onClick={() => deleteTransaction(tx.id)}><PiTrash size={16} /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeView === 'note' && activeNote && (
            <div className="document-container">
              <div className="document-cover" style={{ background: activeNote?.cover || getCoverGradient(activeNote?.id || '0'), backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="cover-actions">
                  <button className="btn-cover-action" onClick={(e) => { e.stopPropagation(); setShowCoverPicker(!showCoverPicker); setShowIconPicker(false); }}><PiImage style={{ marginRight: '6px', fontSize: '1.1rem' }} /> Change Cover</button>
                  {showCoverPicker && (
                    <div className="picker-popover" style={{ top: '100%', right: 0, marginTop: '8px', width: '280px' }} onClick={e => e.stopPropagation()}>
                      <div className="cover-grid">{COVER_LIST.map((cover, i) => <button key={i} className="cover-btn" style={{ background: cover }} onClick={() => handleSelectCover(cover)} />)}</div>
                      <button className="btn-cancel" style={{ width: '100%', marginTop: '8px', padding: '6px' }} onClick={() => handleSelectCover('')}>Remove Cover</button>
                    </div>
                  )}
                </div>
              </div>
              <article className="document-content">
                <div className="document-icon-wrapper" style={{ position: 'relative' }}>
                  <span className="document-icon-large" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setShowIconPicker(!showIconPicker); setShowCoverPicker(false); }} title="Change Icon">
                    {activeNote?.icon ? activeNote.icon : <PiNotePencil />}
                  </span>
                  {showIconPicker && (
                    <div className="picker-popover" style={{ top: '100%', left: 0, marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                      <div className="emoji-grid">{EMOJI_LIST.map(emoji => <button key={emoji} className="emoji-btn" onClick={() => handleSelectIcon(emoji)}>{emoji}</button>)}</div>
                      <button className="btn-cancel" style={{ width: '100%', marginTop: '8px', padding: '6px' }} onClick={() => handleSelectIcon('')}>Remove Icon</button>
                    </div>
                  )}
                </div>
                <input className="document-title-input" value={activeNote?.title || ''} onChange={onNoteTitleChange} placeholder="Untitled Document" readOnly={isReadingMode} />
                <div className="document-meta">
                  <div className="meta-group"><PiCalendar size={18} opacity={0.6} /><span>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <div className="meta-group"><PiTag size={18} opacity={0.6} />
                    {activeNote?.tags?.map(tag => <span key={tag} className="meta-tag">{tag}<button onClick={(e) => { e.stopPropagation(); handleRemoveTagFromNote(tag); }} title="Hapus Label"><PiX size={14} /></button></span>)}
                  </div>
                </div>
                <div className="editor-wrapper" style={{ opacity: isReadingMode ? 0.9 : 1 }}><EditorWrapper key={activeNote?.id} note={activeNote!} isDarkMode={isDarkMode} editable={!isReadingMode} onContentChange={onNoteContentChange} /></div>
              </article>
            </div>
          )}
        </div>
      </main>

      {/* KOLOM 3: PANEL KONTEKS KANAN */}
      {!isZenMode && isRightPanelOpen && (
        <aside className="right-panel">
          {/* WIDGET 1: MONTHLY CASHFLOW */}
          <div className="finance-mini-widget">
            <div className="widget-header">
              <PiWallet size={20} color="var(--accent)" />
              <span>Arus Kas Bulan Ini</span>
            </div>
            
            <div className="finance-donut-container">
              {/* Grafik Donat Kiri */}
              <div 
                className="finance-donut" 
                style={{ 
                  '--spent': `${Math.min(expensePercentage, 100)}%`, 
                  '--color': expensePercentage > 85 ? '#ef4444' : 'var(--accent)' 
                } as React.CSSProperties}
              >
                <div className="finance-donut-inner">
                  <span className="donut-percentage">{expensePercentage}%</span>
                  <span className="donut-label">Terpakai</span>
                </div>
              </div>

              {/* Rincian Angka Kanan */}
              <div className="finance-breakdown">
                <div className="breakdown-item">
                  <span className="bd-dot" style={{ background: '#10b981' }}></span>
                  <div className="bd-text">
                    <span className="bd-title">Pemasukan</span>
                    <span className="bd-amount">{formatRupiah(totalIncome)}</span>
                  </div>
                </div>
                <div className="breakdown-item">
                  <span className="bd-dot" style={{ background: expensePercentage > 85 ? '#ef4444' : 'var(--accent)' }}></span>
                  <div className="bd-text">
                    <span className="bd-title">Pengeluaran</span>
                    <span className="bd-amount">{formatRupiah(totalExpense)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="finance-balance-footer">
              Sisa Saldo: <strong>{formatRupiah(currentBalance)}</strong>
            </div>
          </div>

          {/* WIDGET 2: UPCOMING DEADLINES */}
          <div className="upcoming-widget">
            <div className="widget-header">
              <PiCalendar size={20} color="var(--accent)" />
              <span>Tenggat Terdekat</span>
            </div>
            <ul className="upcoming-list">
              {upcomingTasks.length === 0 ? (
                <li className="upcoming-empty">Semua tugas selesai! 🎉</li>
              ) : (
                upcomingTasks.map(task => (
                  <li key={task.id} className="upcoming-item">
                    <div className="upcoming-dot" style={{ background: folders.find(f => f.name === task.category)?.color || 'var(--accent)' }} />
                    <div className="upcoming-info">
                      <span className="upcoming-title">{task.title}</span>
                      <span className="upcoming-date">{new Date(task.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="goals-section" style={{ boxShadow: 'none', padding: 0, margin: 0, background: 'transparent', maxWidth: '100%' }}>
            <div className="goals-header" style={{ marginBottom: '1rem' }}>
              <span className={goalMode === 'daily' ? 'goals-mode active' : 'goals-mode'} onClick={() => setGoalMode('daily')}>Daily</span>
              <span className={goalMode === 'weekly' ? 'goals-mode active' : 'goals-mode'} onClick={() => setGoalMode('weekly')}>Weekly</span>
            </div>
            
            <div className="habit-tracker-container" style={{ margin: '0 0 1rem 0' }}>
              <div className="tracker-header"><span>{goalMode === 'daily' ? '28 Hari Terakhir' : '4 Minggu Terakhir'}</span></div>
              {goalMode === 'daily' ? (
                <div className="heatmap-grid" style={{ gap: '4px' }}>{renderHeatmap()}</div>
              ) : (
                <div className="weekly-cards-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>{renderWeeklyCards()}</div>
              )}
            </div>

            <form className="goals-add-form" onSubmit={handleAddGoal} style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
              <input className="goals-input" placeholder={goalMode === 'daily' ? 'Add daily goal...' : 'Add weekly goal...'} value={goalInput} onChange={e => setGoalInput(e.target.value)} style={{ padding: '8px' }} />
              <button className="btn-primary" type="submit">Add</button>
            </form>

            <ul className="goals-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredGoals.length === 0 && <li className="goals-empty" style={{ textAlign: 'left' }}>No goals yet.</li>}
              {filteredGoals.map((g) => (
                <li key={g.id} className={g.done ? 'goals-item done' : 'goals-item'} onClick={() => toggleGoalDone(g.id, g.done)} style={{ background: 'var(--bg-glass)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <span className="goals-check" style={{ width: 18, height: 18, fontSize: '0.9rem', marginRight: '8px' }}>{g.done ? '✔' : ''}</span>
                  <span className="goals-text" style={{ flex: 1, fontSize: '0.85rem' }}>{g.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}

      {/* --- SEMUA MODAL POPUP --- */}
      
      {/* Modal Tambah Transaksi Keuangan (TANPA PANAH BAWAH) */}
      {financeModal.isOpen && (
        <div className="modal-overlay" onClick={() => setFinanceModal({ ...financeModal, isOpen: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: financeModal.type === 'income' ? '#10b981' : '#ef4444' }}>
              Tambah {financeModal.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
            </h3>
            <form onSubmit={handleTransactionSubmit}>
              <div className="form-group">
                <label>Nominal (Rp)</label>
                <input type="number" name="amount" className="form-control" autoFocus required placeholder="Contoh: 50000" min="0" />
              </div>
              <div className="form-group">
                <label>Kategori</label>
                <select name="category" className="form-control">
                  {FINANCE_CATEGORIES[financeModal.type].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Keterangan</label>
                <input name="description" className="form-control" required placeholder={financeModal.type === 'expense' ? "Contoh: Makan di Kantin Soto Umi Leha..." : "Contoh: Project web, Uang bulanan..."} />
              </div>
              <div className="form-group">
                <label>Tanggal</label>
                <input type="date" name="date" className="form-control" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setFinanceModal({ ...financeModal, isOpen: false })}>Batal</button>
                <button type="submit" className="btn-primary" style={{ background: financeModal.type === 'income' ? '#10b981' : '#ef4444' }}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quickAddPopover.isOpen && (
        <div className="modal-overlay transparent" onClick={() => setQuickAddPopover({ isOpen: false, target: null, date: '' })}>
          <div className="quick-add-popover" style={calculatePopoverPosition(quickAddPopover.target)} onClick={e => e.stopPropagation()}>
            <h4 className="quick-add-title">Quick Add Task</h4>
            <form onSubmit={handleQuickAddSubmit}>
              <input name="title" className="form-control" placeholder="Example: Finish report" autoFocus required />
              <div className="form-group" style={{ margin: 0 }}>
                <label>Category</label>
                <select name="category" className="form-control" defaultValue={activeFolder?.name || (folders[0]?.name || '')}>
                  {folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setQuickAddPopover({ isOpen: false, target: null, date: '' })}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editEventModal.isOpen && editEventModal.event && (
        <div className="modal-overlay" onClick={() => setEditEventModal({ isOpen: false, event: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit Event</h3>
            <form onSubmit={handleEditEventSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input name="title" className="form-control" defaultValue={editEventModal.event.title} required />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select name="category" className="form-control" defaultValue={editEventModal.event.category}>
                  {folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <DatePicker selected={new Date(editEventModal.event.date)} onChange={(date: Date | null) => { if (date) { setEditEventModal(prev => ({ ...prev, event: prev.event ? { ...prev.event, date: date.toISOString().split('T')[0] } : null })); } }} dateFormat="yyyy-MM-dd" customInput={<CustomDateInput />} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select name="status" className="form-control" defaultValue={editEventModal.event.status}>
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditEventModal({ isOpen: false, event: null })}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskModal.isOpen && (
        <div className="modal-overlay" onClick={() => setTaskModal({ ...taskModal, isOpen: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add New Task</h3>
            <form onSubmit={handleTaskSubmit}>
              <div className="form-group"><label>Task Name</label><input name="title" className="form-control" autoFocus required placeholder="Example: Thesis Chapter 2" /></div>
              <div className="form-group">
                <label>Category</label>
                <select name="category" className="form-control" defaultValue={taskModal.defaultCategory || (folders[0]?.name || '')}>
                  {folders.length === 0 ? <option value="">No categories</option> : folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <DatePicker selected={new Date(taskModal.defaultDate)} onChange={(date: Date | null) => { if (date) { setTaskModal(prev => ({ ...prev, defaultDate: date.toISOString().split('T')[0] })); } }} dateFormat="yyyy-MM-dd" customInput={<CustomDateInput />} />
              </div>
              <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setTaskModal({ ...taskModal, isOpen: false })}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Sisa modal lainnya seperti Hapus, Rename, dll */}
      {inputModal.isOpen && (
        <div className="modal-overlay" onClick={() => setInputModal({ ...inputModal, isOpen: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{inputModal.mode === 'create_folder' ? 'New Folder' : 'New Note'}</h3>
            <form onSubmit={handleInputSubmit}>
              <div className="form-group"><label>Name</label><input name="inputValue" className="form-control" autoFocus required placeholder={inputModal.mode === 'create_folder' ? 'Folder Name...' : 'Title...'} /></div>
              {inputModal.mode === 'create_folder' && (<div className="form-group"><label>Folder Color</label><input name="inputColor" type="color" className="form-control" defaultValue="#6366f1" style={{ width: 48, height: 32, padding: 0, border: 'none', background: 'none' }} /></div>)}
              <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setInputModal({ ...inputModal, isOpen: false })}>Cancel</button><button type="submit" className="btn-primary">Create</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">{toast.type === 'success' ? <PiCheckCircle size={28} color="#10b981" /> : <PiWarningCircle size={28} color="#ef4444" />}</span>
            <span>{toast.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}><PiX /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
export default App
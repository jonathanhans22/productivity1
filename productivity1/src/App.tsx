import { useState, useEffect, forwardRef, useRef } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { filterSuggestionItems } from "@blocknote/core"
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { DragDropContext, Droppable, Draggable, type DropResult, type DroppableProps } from '@hello-pangea/dnd'

import { PiTelevision, PiFolder, PiNotePencil, PiStack, PiCalendar, PiMoon, PiSun, PiPlus, PiList, PiPencilSimple, PiTrash, PiCaretDown, PiFilePlus, PiImage, PiTag, PiCheckCircle, PiWarningCircle, PiX, PiCaretLeft, PiCaretRight, PiCornersOut, PiCornersIn } from 'react-icons/pi'

import { GlobalSearch } from './components/GlobalSearch'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import './App.css'
import { supabase } from './lib/supabase'
import logoSaya from './assets/logobaru.png'

type Note = { id: string; title: string; type: 'note'; content?: any; tags?: string[]; icon?: string; cover?: string; }
type Folder = { id: string; name: string; isOpen: boolean; notes: Note[]; color: string }
type Task = { id: string; title: string; date: string; category: string; status: string }
type SearchResult = { id: string; title: string; type: 'task' | 'note'; folderId?: string; }

type GoalHistory = { id: string; date: string; mode: 'daily' | 'weekly'; progress: number; }

const EMOJI_LIST = ['😀', '🚀', '🔥', '💻', '📝', '✨', '🌟', '💡', '📌', '🎯', '🎨', '📊', '📈', '🧠', '⚡', '✅', '🎈', '🎉', '🏆', '📚', '🎵', '☕', '✈️', '🌿'];
const COVER_LIST = [
  'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)',
  'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(to right, #43e97b 0%, #38f9d7 100%)',
  '#1e2029', '#333645'
];

const getCustomSlashMenuItems = (editor: any) => {
  const colors = [
    { name: "Red", value: "red" },
    { name: "Blue", value: "blue" },
    { name: "Green", value: "green" },
    { name: "Yellow", value: "yellow" },
    { name: "Purple", value: "purple" },
    { name: "Pink", value: "pink" },
    { name: "Orange", value: "orange" },
    { name: "Brown", value: "brown" },
    { name: "Gray", value: "gray" },
  ];

  const colorItems = colors.map((color) => ({
    title: `${color.name} Background`,
    onItemClick: () => {
      const currentBlock = editor.getTextCursorPosition()?.block;
      if (currentBlock) {
        editor.updateBlock(currentBlock, {
          props: { ...currentBlock.props, backgroundColor: color.value },
        });
      }
    },
    aliases: [color.name.toLowerCase(), "background", "bg", "stabillo", "warna"],
    group: "Background Colors",
    icon: (
      <div
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "4px",
          backgroundColor: color.value,
          border: "1px solid #e0e0e0"
        }}
      />
    ),
    subtext: `Ubah latar belakang menjadi ${color.name.toLowerCase()}`,
  }));

  return [...getDefaultReactSlashMenuItems(editor), ...colorItems];
};

function EditorWrapper({ note, isDarkMode, onContentChange }: { note: Note, isDarkMode: boolean, onContentChange: (noteId: string, content: string) => void }) {
  const initialContent = note.content && typeof note.content === 'string'
    ? JSON.parse(note.content)
    : (typeof note.content === 'object' ? note.content : undefined);

  const editor = useCreateBlockNote({ initialContent });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorChange = () => {
    const content = JSON.stringify(editor.document);

    onContentChange(note.id, content);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await supabase.from('notes').update({ content }).eq('id', note.id);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey && (e.key === ']' || e.key === '[')) {
      e.preventDefault();
      e.stopPropagation();

      const pmDom = document.querySelector('.ProseMirror') as HTMLElement;

      if (pmDom) {
        const tabEvent = new KeyboardEvent('keydown', {
          key: 'Tab',
          code: 'Tab',
          keyCode: 9,
          which: 9,
          shiftKey: e.key === '[',
          bubbles: true,
          cancelable: true,
        });

        pmDom.dispatchEvent(tabEvent);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const cursor = editor.getTextCursorPosition();

    if (
      cursor &&
      cursor.block &&
      (cursor.block.type === 'bulletListItem' ||
        cursor.block.type === 'numberedListItem' ||
        cursor.block.type === 'heading')
    ) {
      const plainText = e.clipboardData.getData('text/plain');

      if (plainText) {
        e.preventDefault();
        e.stopPropagation();

        const lines = plainText.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length > 0) {
          document.execCommand('insertText', false, lines[0]);

          if (lines.length > 1) {
            const newBlocks: any[] = lines.slice(1).map(line => ({
              type: cursor.block.type,
              props: cursor.block.props,
              content: line
            }));

            editor.insertBlocks(newBlocks, cursor.block, 'after');
          }
        }
      }
    }
  };

  return (
    <div
      onKeyDownCapture={handleKeyDown}
      onPasteCapture={handlePaste}
      style={{ width: '100%', height: '100%' }}
    >
      <BlockNoteView
        editor={editor}
        theme={isDarkMode ? 'dark' : 'light'}
        onChange={handleEditorChange}
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query) =>
            filterSuggestionItems(getCustomSlashMenuItems(editor), query)
          }
        />
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
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => { cancelAnimationFrame(animation); setEnabled(false); };
  }, []);
  if (!enabled) return null;
  return <Droppable {...props}>{children}</Droppable>;
};

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isZenMode, setIsZenMode] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(true)

  const [folders, setFolders] = useState<Folder[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const [goals, setGoals] = useState<{ id: string; text: string; done: boolean; mode: 'daily' | 'weekly' }[]>([]);
  const [history, setHistory] = useState<GoalHistory[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

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

    let currentGoals: any[] = [];
    const { data: goalsData } = await supabase.from('goals').select('*').order('created_at', { ascending: true });
    if (goalsData) {
      currentGoals = goalsData.map(g => ({ id: g.id, text: g.text, done: g.is_done, mode: g.mode as 'daily' | 'weekly' }));
    }

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

  const [activeView, setActiveView] = useState<'dashboard' | 'note' | 'tag'>('dashboard')
  const [activeTag, setActiveTag] = useState<string>('')
  const [dashboardTab, setDashboardTab] = useState<'category' | 'calendar' | 'status'>('category')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

  const [kanbanFilter, setKanbanFilter] = useState<string>('all')

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null)
  const [noteContextMenu, setNoteContextMenu] = useState<{ x: number; y: number; noteId: string; folderId: string } | null>(null)

  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; folderId: string; currentName: string; currentColor: string }>({ isOpen: false, folderId: '', currentName: '', currentColor: '' })
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; folderId: string; folderName: string }>({ isOpen: false, folderId: '', folderName: '' })
  const [renameNoteModal, setRenameNoteModal] = useState<{ isOpen: boolean; folderId: string; noteId: string; currentTitle: string }>({ isOpen: false, folderId: '', noteId: '', currentTitle: '' })
  const [deleteNoteModal, setDeleteNoteModal] = useState<{ isOpen: boolean; folderId: string; noteId: string; noteTitle: string }>({ isOpen: false, folderId: '', noteId: '', noteTitle: '' })
  const [deleteTaskModal, setDeleteTaskModal] = useState<{ isOpen: boolean; taskId: string; taskTitle: string }>({ isOpen: false, taskId: '', taskTitle: '' })
  const [inputModal, setInputModal] = useState<{ isOpen: boolean; mode: 'create_folder' | 'create_note'; folderId?: string }>({ isOpen: false, mode: 'create_folder' })
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([])
  const [quickAddPopover, setQuickAddPopover] = useState<{ isOpen: boolean; target: HTMLElement | null; date: string }>({ isOpen: false, target: null, date: '' });

  const [deleteGoalModal, setDeleteGoalModal] = useState<{ isOpen: boolean; goalId: string }>({ isOpen: false, goalId: '' });
  const [addTagModal, setAddTagModal] = useState(false);

  const [activeNote, setActiveNote] = useState<Note | null>(null)

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const [taskModal, setTaskModal] = useState<{ isOpen: boolean; defaultCategory: string; defaultDate: string; }>({ isOpen: false, defaultCategory: '', defaultDate: new Date().toISOString().split('T')[0] })
  const [editEventModal, setEditEventModal] = useState<{ isOpen: boolean; event: Task | null }>({ isOpen: false, event: null });
  const [eventNotes, setEventNotes] = useState<Record<string, string>>({});
  const [openEventDetail, setOpenEventDetail] = useState<{ isOpen: boolean; event: Task | null }>({ isOpen: false, event: null });
  const [eventPopover, setEventPopover] = useState<{ isOpen: boolean; target: HTMLElement | null; date: string }>({ isOpen: false, target: null, date: '' });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

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

  const handleSelectIcon = async (iconStr: string) => {
    if (!activeNote) return;
    setActiveNote({ ...activeNote, icon: iconStr });
    setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, icon: iconStr } : n) })));
    setShowIconPicker(false);
    try { await supabase.from('notes').update({ icon: iconStr }).eq('id', activeNote.id); } catch (e) { }
  }

  const handleSelectCover = async (coverStr: string) => {
    if (!activeNote) return;
    setActiveNote({ ...activeNote, cover: coverStr });
    setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, cover: coverStr } : n) })));
    setShowCoverPicker(false);
    try { await supabase.from('notes').update({ cover: coverStr }).eq('id', activeNote.id); } catch (e) { }
  }

  const handleAddGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (goalInput.trim()) {
      const { data } = await supabase.from('goals').insert([{ text: goalInput.trim(), mode: goalMode, is_done: false }]).select().single();
      if (data) { setGoals([...goals, { id: data.id, text: data.text, done: data.is_done, mode: data.mode }]); setGoalInput(''); } else { showToast('Gagal menambah goal', 'error'); }
    }
  };

  const handleDeleteGoalClick = (e: React.MouseEvent, goalId: string) => {
    e.stopPropagation();
    setDeleteGoalModal({ isOpen: true, goalId });
  };

  const confirmDeleteGoal = async () => {
    const goalId = deleteGoalModal.goalId;
    setGoals(prev => prev.filter(g => g.id !== goalId));
    await supabase.from('goals').delete().eq('id', goalId);
    showToast('Target berhasil dihapus');
    setDeleteGoalModal({ isOpen: false, goalId: '' });
  };

  const toggleGoalDone = async (goalId: string, currentStatus: boolean) => {
    setGoals(goals.map(g => g.id === goalId ? { ...g, done: !currentStatus } : g));
    await supabase.from('goals').update({ is_done: !currentStatus }).eq('id', goalId);
  };

  const handleInputSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const value = formData.get('inputValue') as string
    const color = formData.get('inputColor') as string || '#6366f1';
    if (!value) return

    if (inputModal.mode === 'create_folder') {
      const { data } = await supabase.from('folders').insert([{ name: value, color: color, is_open: true }]).select().single();
      if (data) { setFolders(prev => [...prev, { id: data.id, name: data.name, isOpen: data.is_open, notes: [], color: data.color }]); showToast('Folder berhasil dibuat') }
    } else if (inputModal.mode === 'create_note' && inputModal.folderId) {
      const { data } = await supabase.from('notes').insert([{ folder_id: inputModal.folderId, title: value, type: 'note' }]).select().single();
      if (data) {
        const newNote: Note = { id: data.id, title: data.title, type: data.type, tags: [], icon: '', cover: '' }
        setFolders(prev => prev.map(f => f.id === inputModal.folderId ? { ...f, notes: [...f.notes, newNote], isOpen: true } : f)); setActiveNote(newNote); setActiveView('note'); showToast('Catatan berhasil dibuat')
      }
    }
    setInputModal({ ...inputModal, isOpen: false })
  }

  const handleTaskSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const taskData = { title: formData.get('title') as string, category: formData.get('category') as string, date: taskModal.defaultDate, status: 'To Do' };
    const { data } = await supabase.from('tasks').insert([taskData]).select().single();
    if (data) { setTasks([...tasks, data as Task]); setTaskModal({ ...taskModal, isOpen: false }); showToast('Tugas berhasil ditambahkan') }
  }

  const handleQuickAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    if (!title) return;
    const taskData = { title, category: formData.get('category') as string, date: quickAddPopover.date, status: 'To Do' };
    const { data } = await supabase.from('tasks').insert([taskData]).select().single();
    if (data) { setTasks(prev => [...prev, data as Task]); showToast('Tugas berhasil ditambahkan'); setQuickAddPopover({ isOpen: false, target: null, date: '' }); }
  }

  const handleEditEventSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!editEventModal.event) return;
    const updatedData = { title: formData.get('title') as string, category: formData.get('category') as string, date: editEventModal.event.date, status: formData.get('status') as string, };
    const { data } = await supabase.from('tasks').update(updatedData).eq('id', editEventModal.event.id).select().single();
    if (data) { setTasks(prev => prev.map(t => t.id === data.id ? (data as Task) : t)); setEditEventModal({ isOpen: false, event: null }); showToast('Event berhasil diubah'); }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const cycle: Record<string, string> = { 'To Do': 'In Progress', 'In Progress': 'Done', 'Done': 'To Do' };
    const newStatus = cycle[currentStatus] ?? 'To Do';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
  }

  const confirmDeleteTask = async () => {
    const taskId = deleteTaskModal.taskId;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (!error) { setTasks(prev => prev.filter(t => t.id !== taskId)); setDeleteTaskModal({ isOpen: false, taskId: '', taskTitle: '' }); showToast('Tugas berhasil dihapus') }
  }

  const confirmDeleteFolder = async () => {
    const { folderId, folderName } = deleteModal
    const { error } = await supabase.from('folders').delete().eq('id', folderId);
    if (!error) { setFolders(prev => prev.filter(f => f.id !== folderId)); setTasks(prev => prev.filter(t => t.category !== folderName)); setDeleteModal({ isOpen: false, folderId: '', folderName: '' }); showToast('Folder berhasil dihapus') }
  }

  const confirmDeleteNote = async () => {
    const { folderId, noteId } = deleteNoteModal
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (!error) {
      setFolders(prev => prev.map(f => { if (f.id === folderId) { return { ...f, notes: f.notes.filter(n => n.id !== noteId) } } return f }))
      if (activeNote?.id === noteId) { setActiveNote(null); setActiveView('dashboard') }
      setDeleteNoteModal({ isOpen: false, folderId: '', noteId: '', noteTitle: '' }); showToast('Catatan berhasil dihapus')
    }
  }

  const handleRenameFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newName = formData.get('newName') as string
    const newColor = formData.get('folderColor') as string
    const { folderId, currentName: oldName, currentColor } = renameModal
    if (!newName || (newName === oldName && newColor === currentColor)) { setRenameModal({ isOpen: false, folderId: '', currentName: '', currentColor: '' }); return }
    const { error } = await supabase.from('folders').update({ name: newName, color: newColor }).eq('id', folderId);
    if (!error) {
      if (newName !== oldName) { await supabase.from('tasks').update({ category: newName }).eq('category', oldName); }
      setFolders(prev => prev.map(f => (f.id === folderId ? { ...f, name: newName, color: newColor } : f)))
      setTasks(prev => prev.map(t => (t.category === oldName ? { ...t, category: newName } : t)))
      setRenameModal({ isOpen: false, folderId: '', currentName: '', currentColor: '' }); showToast('Folder berhasil diubah')
    }
  }

  const handleRenameNoteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newTitle = formData.get('newNoteTitle') as string
    const { folderId, noteId } = renameNoteModal
    if (newTitle) {
      const { error } = await supabase.from('notes').update({ title: newTitle }).eq('id', noteId);
      if (!error) {
        setFolders(prev => prev.map(f => { if (f.id === folderId) { return { ...f, notes: f.notes.map(n => n.id === noteId ? { ...n, title: newTitle } : n) } } return f }))
        if (activeNote?.id === noteId) setActiveNote(prev => prev ? { ...prev, title: newTitle } : null)
        setRenameNoteModal({ isOpen: false, folderId: '', noteId: '', currentTitle: '' }); showToast('Nama catatan berhasil diubah')
      }
    }
  }

  const toggleFolderInSidebar = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setFolders(prev => prev.map(f => (f.id === folderId ? { ...f, isOpen: !f.isOpen } : f)))
      await supabase.from('folders').update({ is_open: !folder.isOpen }).eq('id', folderId);
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const taskToMove = tasks.find(t => t.id === draggableId);
    if (!taskToMove) return;
    const destFolder = folders.find(f => f.id === destination.droppableId);
    const destCategory = destFolder ? destFolder.name : taskToMove.category;
    const newTasks = tasks.filter(t => t.id !== draggableId);
    const destinationTasks = newTasks.filter(t => t.category === destCategory);
    let insertionIndex;
    if (destination.index === 0) {
      const firstTaskOfCategory = newTasks.find(t => t.category === destCategory);
      insertionIndex = firstTaskOfCategory ? newTasks.indexOf(firstTaskOfCategory) : newTasks.length;
    } else {
      const taskBefore = destinationTasks[destination.index - 1];
      insertionIndex = newTasks.indexOf(taskBefore) + 1;
    }
    newTasks.splice(insertionIndex, 0, { ...taskToMove, category: destCategory });
    setTasks(newTasks);
    if (taskToMove.category !== destCategory) { await supabase.from('tasks').update({ category: destCategory }).eq('id', taskToMove.id); }
  };

  const onNoteTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    if (activeNote) {
      setActiveNote({ ...activeNote, title: newTitle })
      setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, title: newTitle } : n) })))
      await supabase.from('notes').update({ title: newTitle }).eq('id', activeNote.id);
    }
  }

  const onNoteContentChange = (noteId: string, newContent: string) => {
    setFolders(prev => prev.map(f => ({
      ...f,
      notes: f.notes.map(n => n.id === noteId ? { ...n, content: newContent } : n)
    })));
    setActiveNote(prev => prev && prev.id === noteId ? { ...prev, content: newContent } : prev);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    if (result.type === 'note') {
      const note = folders.flatMap(f => f.notes).find(n => n.id === result.id);
      if (note) { setActiveNote(note); setActiveView('note'); }
    } else if (result.type === 'task') {
      const task = tasks.find(t => t.id === result.id);
      if (task) {
        setActiveView('dashboard'); setDashboardTab('calendar');
        const [yearStr, monthStr] = task.date.split('-');
        setCalendarYear(parseInt(yearStr, 10)); setCalendarMonth(parseInt(monthStr, 10) - 1);
        setTimeout(() => { const dayCell = document.querySelector(`.cal-day[data-date-str="${task.date}"]`); if (dayCell) { (dayCell as HTMLElement).click(); } }, 100);
      }
    }
  };

  const openEventPopover = (e: React.MouseEvent, date: string) => { setEventPopover({ isOpen: true, target: e.currentTarget as HTMLElement, date }); };
  const closeEventPopover = () => setEventPopover({ isOpen: false, target: null, date: '' });
  const openQuickAdd = (e: React.MouseEvent, date: string) => { setQuickAddPopover({ isOpen: true, target: e.currentTarget as HTMLElement, date }); };
  const openTaskModal = (category: string = '', date?: string) => {
    const validCategory = category || (folders[0]?.name || ''); const validDate = date || new Date().toISOString().split('T')[0];
    setTaskModal({ isOpen: true, defaultCategory: validCategory, defaultDate: validDate });
  }

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => { e.preventDefault(); e.stopPropagation(); setNoteContextMenu(null); setContextMenu({ x: e.clientX, y: e.clientY, folderId }) }
  const handleNoteContextMenu = (e: React.MouseEvent, noteId: string, folderId: string) => { e.preventDefault(); e.stopPropagation(); setContextMenu(null); setNoteContextMenu({ x: e.clientX, y: e.clientY, noteId, folderId }) }
  const createNewFolder = () => setInputModal({ isOpen: true, mode: 'create_folder' })
  const handleAddNote = (folderId: string) => { setInputModal({ isOpen: true, mode: 'create_note', folderId }); setContextMenu(null) }
  const openDeleteModal = (folderId: string) => { const folder = folders.find(f => f.id === folderId); if (folder) setDeleteModal({ isOpen: true, folderId, folderName: folder.name }) }
  const openRenameModal = (folderId: string) => { const folder = folders.find(f => f.id === folderId); if (folder) setRenameModal({ isOpen: true, folderId, currentName: folder.name, currentColor: folder.color }) }
  const toggleCategoryOnDashboard = (folderId: string) => { setOpenCategories(prev => ({ ...prev, [folderId]: !(prev[folderId] ?? true) })) }
  const deleteTask = (taskId: string) => { const task = tasks.find(t => t.id === taskId); if (task) setDeleteTaskModal({ isOpen: true, taskId, taskTitle: task.title }) }

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

  const getCoverGradient = (id: string) => {
    const gradients = ['linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)', 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)', 'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)']
    const numMatch = id.match(/\d+/g);
    const index = numMatch ? parseInt(numMatch.join('')) % gradients.length : 0;
    return gradients[index];
  }

  const allTags = Array.from(new Set(folders.flatMap(f => f.notes.flatMap(n => n.tags || [])))).sort();

  const handleAddTagClick = () => {
    setAddTagModal(true);
  }

  const submitAddTag = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTag = formData.get('tagValue') as string;

    if (newTag && newTag.trim() && activeNote) {
      const tagStr = newTag.trim().toLowerCase();
      const currentTags = activeNote.tags || [];
      if (!currentTags.includes(tagStr)) {
        const updatedTags = [...currentTags, tagStr];
        setActiveNote({ ...activeNote, tags: updatedTags });
        setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, tags: updatedTags } : n) })));
        await supabase.from('notes').update({ tags: updatedTags }).eq('id', activeNote.id);
      }
    }
    setAddTagModal(false);
  };

  const handleRemoveTagFromNote = async (tagToRemove: string) => {
    if (activeNote) {
      const updatedTags = (activeNote.tags || []).filter(t => t !== tagToRemove);
      setActiveNote({ ...activeNote, tags: updatedTags });
      setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, tags: updatedTags } : n) })));
      await supabase.from('notes').update({ tags: updatedTags }).eq('id', activeNote.id);
    }
  }

  const renderHeatmap = () => {
    const boxes = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA');

      const record = history.find(h => h.mode === 'daily' && h.date === dateStr);
      const prog = record ? record.progress : 0;

      let level = 0;
      if (prog > 0 && prog <= 25) level = 1;
      else if (prog > 25 && prog <= 50) level = 2;
      else if (prog > 50 && prog <= 75) level = 3;
      else if (prog > 75) level = 4;

      boxes.push(<div key={dateStr} className={`heatmap-box level-${level}`} title={`${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}: ${prog}% Selesai`} />);
    }
    return boxes;
  };

  const renderWeeklyCards = () => {
    const cards = [];
    for (let i = 3; i >= 1; i--) {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) - (i * 7);
      const pastMondayStr = new Date(d.setDate(diff)).toLocaleDateString('en-CA');

      const record = history.find(h => h.mode === 'weekly' && h.date === pastMondayStr);
      const prog = record ? record.progress : 0;

      cards.push(
        <div key={pastMondayStr} className="weekly-card">
          <span className="weekly-card-label">{i} Mg Lalu</span>
          <div className="weekly-card-circle" style={{ '--progress': `${prog}%` } as React.CSSProperties}><span>{prog}%</span></div>
        </div>
      );
    }

    cards.push(
      <div key="current" className="weekly-card" style={{ borderColor: 'var(--accent)' }}>
        <span className="weekly-card-label" style={{ color: 'var(--accent)' }}>Mg Ini</span>
        <div className="weekly-card-circle" style={{ '--progress': `${progress}%` } as React.CSSProperties}><span>{progress}%</span></div>
      </div>
    );

    return cards;
  };

  return (
    <div className={`app-container ${isZenMode ? 'zen-mode' : ''}`} onClick={() => { setShowIconPicker(false); setShowCoverPicker(false); }}>
      <div className="aurora-bg"></div>

      {!isZenMode && (
        <nav className="sidebar-rail" onClick={() => setIsSidebarOpen(false)}>
          <div className="rail-avatar" style={{ padding: 0, overflow: 'hidden', background: 'transparent' }}>
            <img
              src={logoSaya}
              alt="Profile"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <button className={`rail-icon ${activeView === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveView('dashboard'); setDashboardTab('category'); setIsSidebarOpen(false); }} title="Dashboard"><PiTelevision /></button>
          <button className={`rail-icon ${activeView === 'note' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveView('note'); setActiveNote(null); setIsSidebarOpen(true); }} title="My Folders & Notes"><PiFolder /></button>
          <div style={{ marginTop: 'auto' }}>
            <button className="rail-icon" onClick={(e) => { e.stopPropagation(); toggleTheme(); }} title="Toggle Theme">{isDarkMode ? <PiSun /> : <PiMoon />}</button>
          </div>
        </nav>
      )}

      <aside className={`sidebar-panel ${(!isSidebarOpen || isZenMode) ? 'closed' : ''}`}>
        <div style={{ marginBottom: '1rem' }}><GlobalSearch tasks={tasks} folders={folders} onResultClick={handleSearchResultClick} /></div>
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
                    <li
                      key={note.id}
                      className={`note-item ${activeNote?.id === note.id && activeView === 'note' ? 'active' : ''}`}
                      onClick={() => { setActiveNote(note); setActiveView('note') }}
                      onContextMenu={(e) => handleNoteContextMenu(e, note.id, folder.id)}
                    >
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

      <main className="editor-area" onClick={() => !isZenMode && setIsSidebarOpen(false)}>
        {!isZenMode && (
          <header className="editor-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
              {activeView === 'note' && (<button className="btn-graph" onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(!isSidebarOpen); }} title="Toggle Sidebar"><PiList /></button>)}
              <span className="breadcrumb">
                {activeView === 'dashboard' ? 'Dashboard' : activeView === 'tag' ? `Category: ${activeTag}` : (
                  activeNote ? (<><span style={{ opacity: 0.6 }}>{activeFolder?.name || 'Folder'}</span> <span style={{ margin: '0 6px', opacity: 0.4 }}>/</span> <span>{activeNote?.title}</span></>) : ('My Notes')
                )}
              </span>
            </div>
          </header>
        )}

        {activeView === 'note' && activeNote && (
          <button className="btn-zen-toggle" onClick={(e) => { e.stopPropagation(); setIsZenMode(!isZenMode); }} title={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode"}>
            {isZenMode ? <PiCornersIn size={22} /> : <PiCornersOut size={22} />}
          </button>
        )}

        {activeView === 'dashboard' ? (
          <div className="dashboard-view">
            <div className="dashboard-title"><h1>Tasks & Deadlines</h1></div>

            <div className="goals-section">
              <div className="goals-header">
                <span className={goalMode === 'daily' ? 'goals-mode active' : 'goals-mode'} onClick={() => setGoalMode('daily')}>Daily</span>
                <span className={goalMode === 'weekly' ? 'goals-mode active' : 'goals-mode'} onClick={() => setGoalMode('weekly')}>Weekly</span>
                <span style={{ flex: 1 }} />
                <span className="goals-progress-label">Progress: {progress}%</span>
              </div>
              <div className="goals-progress-bar-bg"><div className="goals-progress-bar" style={{ width: progress + '%' }} /></div>

              <div className="habit-tracker-container">
                <div className="tracker-header"><span>{goalMode === 'daily' ? 'Riwayat 28 Hari Terakhir' : 'Riwayat 4 Minggu Terakhir'}</span></div>
                {goalMode === 'daily' ? (<div className="heatmap-grid">{renderHeatmap()}</div>) : (<div className="weekly-cards-grid">{renderWeeklyCards()}</div>)}
              </div>

              <form className="goals-add-form" onSubmit={handleAddGoal}>
                <input className="goals-input" placeholder={goalMode === 'daily' ? 'Add daily goal...' : 'Add weekly goal...'} value={goalInput} onChange={e => setGoalInput(e.target.value)} />
                <button className="goals-add-btn" type="submit">Add</button>
              </form>

              <ul className="goals-list">
                {filteredGoals.length === 0 && <li className="goals-empty">No goals yet.</li>}
                {filteredGoals.map((g) => (
                  <li key={g.id} className={g.done ? 'goals-item done' : 'goals-item'} onClick={() => toggleGoalDone(g.id, g.done)}>
                    <span className="goals-check">{g.done ? '✔' : ''}</span>
                    <span className="goals-text" style={{ flex: 1 }}>{g.text}</span>
                    <button className="btn-icon-danger" onClick={(e) => handleDeleteGoalClick(e, g.id)} title="Hapus Target"><PiTrash size={16} /></button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="view-tabs">
              <button className={`view-tab ${dashboardTab === 'category' ? 'active' : ''}`} onClick={() => setDashboardTab('category')}><PiStack style={{ verticalAlign: 'text-bottom' }} /> By Category</button>
              <button className={`view-tab ${dashboardTab === 'calendar' ? 'active' : ''}`} onClick={() => setDashboardTab('calendar')}><PiCalendar style={{ verticalAlign: 'text-bottom' }} /> Calendar</button>
              <button className={`view-tab ${dashboardTab === 'status' ? 'active' : ''}`} onClick={() => setDashboardTab('status')}><PiCheckCircle style={{ verticalAlign: 'text-bottom' }} /> By Status</button>
            </div>

            {dashboardTab === 'category' && (
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="category-views">
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
                                        <button onClick={() => deleteTask(task.id)} className="btn-icon-danger"><PiTrash /></button>
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
            )}

            {dashboardTab === 'calendar' && (
              <div className="calendar-views">
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

                    const onDropEvent = async (e: React.DragEvent<HTMLDivElement>) => {
                      e.preventDefault(); const taskId = e.dataTransfer.getData('text/event-id');
                      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, date: dateStr } : t));
                      await supabase.from('tasks').update({ date: dateStr }).eq('id', taskId);
                    };
                    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
                    const isImportant = dayTasks.some(t => /urgent|penting/i.test(t.title));
                    return (
                      <div key={day} className={`cal-day ${isToday ? 'today' : ''} ${isImportant ? 'important-day' : ''}`} onClick={e => openEventPopover(e, dateStr)} style={{ position: 'relative', cursor: 'pointer' }} onDrop={onDropEvent} onDragOver={onDragOver} data-date-str={dateStr}>
                        <div className="day-header"><span className="day-num">{day}</span></div>
                        {dayTasks.length > 0 && (() => {
                          const SHOW_PILLS = 2; const shownPills = dayTasks.slice(0, SHOW_PILLS); const restDots = dayTasks.slice(SHOW_PILLS);
                          return (
                            <div className="cal-events-wrap">
                              {shownPills.map((t: Task) => {
                                const folderColor = folders.find(f => f.name === t.category)?.color || '#6366f1';
                                const statusIcon = t.status === 'Done' ? '✓' : t.status === 'In Progress' ? '◑' : '';
                                return (
                                  <div key={t.id} className={`cal-event-pill ${t.status === 'Done' ? 'pill-done' : ''}`} draggable onDragStart={e => e.dataTransfer.setData('text/event-id', t.id)} style={{ background: folderColor }} title={`${t.title} [${t.status}]`}>
                                    {statusIcon && <span className="pill-status-icon">{statusIcon}</span>}<span className="pill-text">{t.title}</span>
                                  </div>
                                );
                              })}
                              {restDots.length > 0 && (
                                <div className="cal-dots-row" title={restDots.map(t => `${t.title} [${t.status}]`).join('\n')}>
                                  {restDots.map((t: Task) => {
                                    const folderColor = folders.find(f => f.name === t.category)?.color || '#6366f1';
                                    const borderColor = t.status === 'Done' ? '#22c55e' : t.status === 'In Progress' ? '#f59e0b' : 'transparent';
                                    return (<span key={t.id} className="cal-dot" draggable onDragStart={e => e.dataTransfer.setData('text/event-id', t.id)} style={{ background: folderColor, boxShadow: `0 0 0 2px ${borderColor}` }} title={`${t.title} [${t.status}]`} />);
                                  })}
                                  <span className="cal-dots-more">+{restDots.length}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )
                  })}
                  {eventPopover.isOpen && (() => {
                    const dateTasks = tasks.filter(t => t.date === eventPopover.date);
                    const isToday = eventPopover.date === new Date().toISOString().split('T')[0];
                    return (
                      <>
                        <div className="day-panel-backdrop" onClick={closeEventPopover} />
                        <div className="day-panel">
                          <div className="day-panel-header">
                            <div className="day-panel-header-left">
                              <div className="day-panel-date-num">{new Date(eventPopover.date + 'T00:00:00').getDate()}</div>
                              <div className="day-panel-date-info">
                                <span className="day-panel-month">{new Date(eventPopover.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                <span className="day-panel-weekday">{new Date(eventPopover.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}{isToday && <span className="day-panel-today-badge">Today</span>}</span>
                              </div>
                            </div>
                            <button className="day-panel-close" onClick={closeEventPopover}><PiX size={20} /></button>
                          </div>
                          <div className="day-panel-summary">
                            <span className="day-panel-summary-item" style={{ '--sc': '#6366f1' } as React.CSSProperties}><span className="dps-num">{dateTasks.filter(t => t.status === 'To Do').length}</span><span className="dps-label">To Do</span></span>
                            <span className="day-panel-summary-item" style={{ '--sc': '#f59e0b' } as React.CSSProperties}><span className="dps-num">{dateTasks.filter(t => t.status === 'In Progress').length}</span><span className="dps-label">In Progress</span></span>
                            <span className="day-panel-summary-item" style={{ '--sc': '#22c55e' } as React.CSSProperties}><span className="dps-num">{dateTasks.filter(t => t.status === 'Done').length}</span><span className="dps-label">Done</span></span>
                          </div>
                          <div className="day-panel-body">
                            {dateTasks.length === 0 ? (
                              <div className="day-panel-empty"><span style={{ fontSize: '2.5rem' }}>📭</span><span>No tasks for this day</span><span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Click below to add one!</span></div>
                            ) : (
                              dateTasks.map(task => {
                                const folderColor = folders.find(f => f.name === task.category)?.color || '#6366f1';
                                const statusColor = task.status === 'Done' ? '#22c55e' : task.status === 'In Progress' ? '#f59e0b' : '#6366f1';
                                const statusIcon = task.status === 'Done' ? '✓' : task.status === 'In Progress' ? '◑' : '○';
                                return (
                                  <div key={task.id} className="day-panel-event-card" style={{ '--fc': folderColor } as React.CSSProperties}>
                                    <div className="dpec-bar" style={{ background: folderColor }} />
                                    <div className="dpec-body">
                                      <div className="dpec-top">
                                        <span className="dpec-status-badge" style={{ background: statusColor + '22', color: statusColor, borderColor: statusColor + '44' }}>{statusIcon} {task.status}</span>
                                        <span className="dpec-category" style={{ background: folderColor + '22', color: folderColor }}>{task.category}</span>
                                      </div>
                                      <div className={`dpec-title ${task.status === 'Done' ? 'dpec-done' : ''}`}>{task.title}</div>
                                      <div className="dpec-actions">
                                        <button className="dpec-btn dpec-btn-check" onClick={() => toggleTaskStatus(task.id, task.status)} style={{ borderColor: statusColor + '66', color: statusColor }}>{statusIcon} Cycle</button>
                                        <button className="dpec-btn dpec-btn-edit" onClick={() => { setEditEventModal({ isOpen: true, event: task }); closeEventPopover(); }}><PiPencilSimple size={13} /> Edit</button>
                                        <button className="dpec-btn dpec-btn-detail" onClick={() => { setOpenEventDetail({ isOpen: true, event: task }); closeEventPopover(); }}><PiNotePencil size={13} /> Notes</button>
                                        <button className="dpec-btn dpec-btn-del" onClick={() => { setDeleteTaskModal({ isOpen: true, taskId: task.id, taskTitle: task.title }); closeEventPopover(); }}><PiTrash size={13} /></button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div className="day-panel-footer">
                            <button className="day-panel-add-btn" onClick={() => { openQuickAdd({ currentTarget: null } as any, eventPopover.date); closeEventPopover(); }}><PiPlus size={16} /> Add Task to This Day</button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {dashboardTab === 'status' && (() => {
              const statusColumns = [
                { key: 'To Do', label: 'To Do', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', icon: '○' },
                { key: 'In Progress', label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '◑' },
                { key: 'Done', label: 'Done', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', icon: '●' },
              ];
              return (
                <div className="kanban-wrapper">
                  <div className="kanban-top-bar">
                    <div className="kanban-year-nav">
                      <button onClick={() => setCalendarYear(y => y - 1)}><PiCaretLeft size={16} /></button>
                      <span>{calendarYear}</span>
                      <button onClick={() => setCalendarYear(y => y + 1)}><PiCaretRight size={16} /></button>
                    </div>
                    <div className="kanban-month-list">
                      <button className={`kanban-filter-pill ${kanbanFilter === 'all' ? 'active' : ''}`} onClick={() => setKanbanFilter('all')}>All Time</button>
                      {monthNames.map((m, i) => (
                        <button key={m} className={`kanban-filter-pill ${kanbanFilter === i.toString() ? 'active' : ''}`} onClick={() => setKanbanFilter(i.toString())}>{m}</button>
                      ))}
                    </div>
                  </div>

                  <DragDropContext onDragEnd={async (result) => {
                    const { source, destination, draggableId } = result;
                    if (!destination) return;
                    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
                    const newStatus = destination.droppableId;
                    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t));
                    await supabase.from('tasks').update({ status: newStatus }).eq('id', draggableId);
                  }}>
                    <div className="kanban-board">
                      {statusColumns.map(col => {
                        const colTasks = tasks.filter(t => {
                          if (t.status !== col.key) return false;
                          if (kanbanFilter === 'all') return true;
                          const taskDate = new Date(t.date);
                          return taskDate.getFullYear() === calendarYear && taskDate.getMonth().toString() === kanbanFilter;
                        });

                        return (
                          <div key={col.key} className="kanban-column" style={{ '--kanban-color': col.color, '--kanban-bg': col.bg } as React.CSSProperties}>
                            <div className="kanban-column-header">
                              <span className="kanban-status-dot" style={{ color: col.color }}>{col.icon}</span>
                              <span className="kanban-column-title">{col.label}</span>
                              <span className="kanban-count">{colTasks.length}</span>
                            </div>
                            <StrictModeDroppable droppableId={col.key}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className={`kanban-cards ${snapshot.isDraggingOver ? 'drag-over' : ''}`}>
                                  {colTasks.map((task, idx) => {
                                    const folderColor = folders.find(f => f.name === task.category)?.color || '#6366f1';
                                    return (
                                      <Draggable key={task.id} draggableId={task.id} index={idx}>
                                        {(provided, snap) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`kanban-card ${snap.isDragging ? 'dragging' : ''}`}>
                                            <div className="kanban-card-top">
                                              <span className="kanban-card-category-dot" style={{ background: folderColor }} />
                                              <span className="kanban-card-category">{task.category}</span>
                                              <button className="btn-icon-danger" style={{ marginLeft: 'auto', padding: '2px 4px' }} onClick={() => deleteTask(task.id)}><PiTrash size={14} /></button>
                                            </div>
                                            <div className="kanban-card-title">{task.title}</div>
                                            <div className="kanban-card-footer">
                                              <span className="kanban-card-date"><PiCalendar size={12} style={{ marginRight: 4 }} />{new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                              <button className="kanban-card-edit-btn" onClick={() => setEditEventModal({ isOpen: true, event: task })}><PiPencilSimple size={12} /></button>
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    );
                                  })}
                                  {provided.placeholder}
                                  <button className="kanban-add-btn" onClick={() => openTaskModal('', '')}><PiPlus size={14} style={{ marginRight: 4 }} /> Add Task</button>
                                </div>
                              )}
                            </StrictModeDroppable>
                          </div>
                        );
                      })}
                    </div>
                  </DragDropContext>
                </div>
              );
            })()}
          </div>
        ) : activeView === 'tag' ? (
          <div className="dashboard-view" style={{ paddingTop: '1rem' }}>
            <div className="dashboard-title">
              <h1><PiTag style={{ verticalAlign: 'middle', marginRight: '10px', color: 'var(--accent)' }} /> Label: {activeTag}</h1>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Menampilkan semua catatan yang memiliki label ini.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
              {folders.flatMap(f => f.notes).filter(n => n.tags?.includes(activeTag)).map(note => {
                const folder = folders.find(f => f.notes.some(n => n.id === note.id));
                return (
                  <div key={note.id} className="kanban-card" onClick={() => { setActiveNote(note); setActiveView('note'); }} style={{ cursor: 'pointer' }}>
                    <div className="kanban-card-top">
                      <span className="kanban-card-category-dot" style={{ background: folder?.color || '#6366f1' }} />
                      <span className="kanban-card-category">{folder?.name}</span>
                    </div>
                    <div className="kanban-card-title">{note.title}</div>
                    <div className="kanban-card-footer">
                      <span className="kanban-card-date"><PiNotePencil size={12} style={{ marginRight: 4 }} /> Notes</span>
                    </div>
                  </div>
                )
              })}
              {folders.flatMap(f => f.notes).filter(n => n.tags?.includes(activeTag)).length === 0 && (
                <div style={{ color: 'var(--text-secondary)' }}>Tidak ada catatan dengan label ini.</div>
              )}
            </div>
          </div>
        ) : activeView === 'note' && !activeNote ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', color: 'var(--text-secondary)' }}>
            <PiFolder size={64} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Pilih atau Buat Catatan</h2>
            <p style={{ opacity: 0.8 }}>Silakan pilih catatan dari panel di sebelah kiri untuk mulai mengedit.</p>
          </div>
        ) : (
          <div className="document-container">
            <div
              className="document-cover"
              style={{
                background: activeNote?.cover || getCoverGradient(activeNote?.id || '0'),
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              <div className="cover-actions">
                <button className="btn-cover-action" onClick={(e) => { e.stopPropagation(); setShowCoverPicker(!showCoverPicker); setShowIconPicker(false); }}>
                  <PiImage style={{ marginRight: '6px', fontSize: '1.1rem' }} /> Change Cover
                </button>

                {showCoverPicker && (
                  <div className="picker-popover" style={{ top: '100%', right: 0, marginTop: '8px', width: '280px' }} onClick={e => e.stopPropagation()}>
                    <div className="cover-grid">
                      {COVER_LIST.map((cover, i) => (
                        <button key={i} className="cover-btn" style={{ background: cover }} onClick={() => handleSelectCover(cover)} />
                      ))}
                    </div>
                    <div className="cover-url-input">
                      <input id="cover-url-input" className="form-control" placeholder="Paste Image URL..." style={{ padding: '6px', fontSize: '0.85rem' }} />
                      <button className="btn-primary" style={{ padding: '6px 12px' }} onClick={() => {
                        const val = (document.getElementById('cover-url-input') as HTMLInputElement).value;
                        if (val) handleSelectCover(`url(${val})`);
                      }}>Set</button>
                    </div>
                    <button className="btn-cancel" style={{ width: '100%', marginTop: '8px', padding: '6px' }} onClick={() => handleSelectCover('')}>Remove Cover</button>
                  </div>
                )}
              </div>
            </div>

            <article className="document-content">
              <div className="document-icon-wrapper" style={{ position: 'relative' }}>
                <span
                  className="document-icon-large"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); setShowIconPicker(!showIconPicker); setShowCoverPicker(false); }}
                  title="Change Icon"
                >
                  {activeNote?.icon ? activeNote.icon : <PiNotePencil />}
                </span>

                {showIconPicker && (
                  <div className="picker-popover" style={{ top: '100%', left: 0, marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                    <div className="emoji-grid">
                      {EMOJI_LIST.map(emoji => (
                        <button key={emoji} className="emoji-btn" onClick={() => handleSelectIcon(emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <button className="btn-cancel" style={{ width: '100%', marginTop: '8px', padding: '6px' }} onClick={() => handleSelectIcon('')}>Remove Icon</button>
                  </div>
                )}
              </div>

              <input
                className="document-title-input"
                value={activeNote?.title || ''}
                onChange={onNoteTitleChange}
                placeholder="Untitled Document"
              />

              <div className="document-meta">
                <div className="meta-group">
                  <PiCalendar size={18} opacity={0.6} />
                  <span>{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>

                <span style={{ opacity: 0.3 }}>|</span>

                <div className="meta-group">
                  <PiTag size={18} opacity={0.6} />
                  {activeNote?.tags?.map(tag => (
                    <span key={tag} className="meta-tag">
                      {tag}
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveTagFromNote(tag); }} title="Hapus Label">
                        <PiX size={14} />
                      </button>
                    </span>
                  ))}
                  <span className="meta-tag-add" onClick={handleAddTagClick}>
                    <PiPlus style={{ marginRight: '4px' }} /> Add Tag
                  </span>
                </div>
              </div>

              <div className="editor-wrapper">
                <EditorWrapper
                  key={activeNote?.id}
                  note={activeNote!}
                  isDarkMode={isDarkMode}
                  onContentChange={onNoteContentChange}
                />
              </div>
            </article>
          </div>
        )}
      </main>

      {quickAddPopover.isOpen && (
        <div className="modal-overlay transparent" onClick={() => setQuickAddPopover({ isOpen: false, target: null, date: '' })}>
          <div className="quick-add-popover" style={calculatePopoverPosition(quickAddPopover.target)} onClick={e => e.stopPropagation()}>
            <h4 className="quick-add-title">Quick Add Task</h4>
            <form onSubmit={handleQuickAddSubmit}>
              <input name="title" className="form-control" placeholder="Example: Finish report" autoFocus required />
              <div className="select-wrapper">
                <select name="category" className="form-control" defaultValue={activeFolder?.name || (folders[0]?.name || '')}>
                  {folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
                <PiCaretDown className="select-icon" />
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
                <DatePicker
                  selected={new Date(editEventModal.event.date)}
                  onChange={(date: Date | null) => { if (date) { setEditEventModal(prev => ({ ...prev, event: prev.event ? { ...prev.event, date: date.toISOString().split('T')[0] } : null })); } }}
                  dateFormat="yyyy-MM-dd"
                  customInput={<CustomDateInput />}
                />
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

      {openEventDetail.isOpen && openEventDetail.event && (
        <div className="modal-overlay" onClick={() => setOpenEventDetail({ isOpen: false, event: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Event Details</h3>
            <div className="event-detail-card">
              <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }} title={openEventDetail.event.title}>{openEventDetail.event.title}</div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                Category: {openEventDetail.event.category} | Date: {openEventDetail.event.date} | Status: {openEventDetail.event.status}
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" rows={5} placeholder="Write notes..." value={eventNotes[openEventDetail.event.id] || ''} onChange={e => { const val = e.target.value; setEventNotes(prev => ({ ...prev, [openEventDetail.event!.id]: val })); }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Autosaved</span>
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setOpenEventDetail({ isOpen: false, event: null })}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <div className="context-item" onClick={() => handleAddNote(contextMenu.folderId)}><PiFilePlus style={{ marginRight: '8px' }} /> Add Note</div>
          <div className="context-item" onClick={() => openRenameModal(contextMenu.folderId)}><PiPencilSimple style={{ marginRight: '8px' }} /> Edit</div>
          <div className="context-item delete" onClick={() => openDeleteModal(contextMenu.folderId)}><PiTrash style={{ marginRight: '8px' }} /> Delete</div>
        </div>
      )}

      {noteContextMenu && (
        <div className="context-menu" style={{ top: noteContextMenu.y, left: noteContextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <div className="context-item" onClick={() => setRenameNoteModal({ isOpen: true, folderId: noteContextMenu.folderId, noteId: noteContextMenu.noteId, currentTitle: folders.find(f => f.id === noteContextMenu.folderId)?.notes.find(n => n.id === noteContextMenu.noteId)?.title || '' })}><PiPencilSimple style={{ marginRight: '8px' }} /> Rename</div>
          <div className="context-item delete" onClick={() => setDeleteNoteModal({ isOpen: true, folderId: noteContextMenu.folderId, noteId: noteContextMenu.noteId, noteTitle: folders.find(f => f.id === noteContextMenu.folderId)?.notes.find(n => n.id === noteContextMenu.noteId)?.title || '' })}><PiTrash style={{ marginRight: '8px' }} /> Delete</div>
        </div>
      )}

      {renameModal.isOpen && (
        <div className="modal-overlay" onClick={() => setRenameModal({ isOpen: false, folderId: '', currentName: '', currentColor: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit Folder</h3>
            <form onSubmit={handleRenameFolder}>
              <div className="form-group"><label>Folder Name</label><input name="newName" className="form-control" autoFocus required defaultValue={renameModal.currentName} /></div>
              <div className="form-group"><label>Folder Color</label><input name="folderColor" type="color" className="form-control" defaultValue={renameModal.currentColor} style={{ width: 48, height: 32, padding: 0, border: 'none', background: 'none' }} /></div>
              <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setRenameModal({ isOpen: false, folderId: '', currentName: '', currentColor: '' })}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {renameNoteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setRenameNoteModal({ isOpen: false, folderId: '', noteId: '', currentTitle: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Edit Note</h3>
            <form onSubmit={handleRenameNoteSubmit}>
              <div className="form-group"><label>Note Name</label><input name="newNoteTitle" className="form-control" autoFocus required defaultValue={renameNoteModal.currentTitle} /></div>
              <div className="modal-actions"><button type="button" className="btn-cancel" onClick={() => setRenameNoteModal({ isOpen: false, folderId: '', noteId: '', currentTitle: '' })}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ isOpen: false, folderId: '', folderName: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delete Folder?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>Are you sure you want to delete the folder <strong>{deleteModal.folderName}</strong>? <br />All tasks and notes within it will be permanently deleted.</p>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setDeleteModal({ isOpen: false, folderId: '', folderName: '' })}>Cancel</button><button className="btn-danger" onClick={confirmDeleteFolder}>Delete</button></div>
          </div>
        </div>
      )}

      {deleteNoteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteNoteModal({ isOpen: false, folderId: '', noteId: '', noteTitle: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delete Note?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>Are you sure you want to delete the note <strong>{deleteNoteModal.noteTitle}</strong>? <br />This action cannot be undone.</p>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setDeleteNoteModal({ isOpen: false, folderId: '', noteId: '', noteTitle: '' })}>Cancel</button><button className="btn-danger" onClick={confirmDeleteNote}>Delete</button></div>
          </div>
        </div>
      )}

      {deleteTaskModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteTaskModal({ isOpen: false, taskId: '', taskTitle: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delete Task?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>Are you sure you want to delete the task <strong>{deleteTaskModal.taskTitle}</strong>?</p>
            <div className="modal-actions"><button className="btn-cancel" onClick={() => setDeleteTaskModal({ isOpen: false, taskId: '', taskTitle: '' })}>Cancel</button><button className="btn-danger" onClick={confirmDeleteTask}>Delete</button></div>
          </div>
        </div>
      )}

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

      {taskModal.isOpen && (
        <div className="modal-overlay" onClick={() => setTaskModal({ ...taskModal, isOpen: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add New Task</h3>
            <form onSubmit={handleTaskSubmit}>
              <div className="form-group"><label>Task Name</label><input name="title" className="form-control" autoFocus required placeholder="Example: Thesis Chapter 2" /></div>
              <div className="form-group">
                <label>Category</label>
                <div className="select-wrapper">
                  <select name="category" className="form-control" defaultValue={taskModal.defaultCategory || (folders[0]?.name || '')}>
                    {folders.length === 0 ? <option value="">No categories</option> : folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                  <PiCaretDown className="select-icon" />
                </div>
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

      {deleteGoalModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteGoalModal({ isOpen: false, goalId: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Hapus Target?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Yakin ingin menghapus target ini? Data tidak dapat dikembalikan.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteGoalModal({ isOpen: false, goalId: '' })}>Batal</button>
              <button className="btn-danger" onClick={confirmDeleteGoal}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {addTagModal && (
        <div className="modal-overlay" onClick={() => setAddTagModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Tambah Label Baru</h3>
            <form onSubmit={submitAddTag}>
              <div className="form-group">
                <label>Nama Label</label>
                <input name="tagValue" className="form-control" autoFocus required placeholder="Contoh: penting, referensi..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setAddTagModal(false)}>Batal</button>
                <button type="submit" className="btn-primary">Tambah</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">{toast.type === 'success' ? <PiCheckCircle size={28} color="#22c55e" /> : <PiWarningCircle size={28} color="#ef4444" />}</span>
            <span>{toast.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}><PiX /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
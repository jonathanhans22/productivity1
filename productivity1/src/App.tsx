import { useState, useEffect } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { DragDropContext, Droppable, Draggable, type DropResult, type DroppableProps } from 'react-beautiful-dnd'
import { PiTelevision, PiFolder, PiNotePencil, PiStack, PiCalendar, PiTimer, PiMoon, PiSun, PiPlus, PiList, PiPencilSimple, PiTrash, PiCaretDown, PiFilePlus, PiSquaresFour, PiImage, PiSmiley, PiTag, PiCheckCircle, PiWarningCircle, PiX } from 'react-icons/pi'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import './App.css'

type Note = { id: string; title: string; type: 'note' | 'canvas' }
type Folder = { id: string; name: string; isOpen: boolean; notes: Note[] }
type Task = { id: string; title: string; date: string; category: 'Kuliah' | 'Excel' | 'Manpro' | (string & {}); status: string }

// Fix for React Strict Mode with react-beautiful-dnd
export const StrictModeDroppable = ({ children, ...props }: DroppableProps) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props}>{children}</Droppable>;
};

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)

  const [activeView, setActiveView] = useState<'dashboard' | 'note'>('dashboard')
  const [dashboardTab, setDashboardTab] = useState<'category' | 'calendar'>('category')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: string } | null>(null)
  const [noteContextMenu, setNoteContextMenu] = useState<{ x: number; y: number; noteId: string; folderId: string } | null>(null)
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; folderId: string; currentName: string }>({ isOpen: false, folderId: '', currentName: '' })
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; folderId: string; folderName: string }>({ isOpen: false, folderId: '', folderName: '' })
  const [renameNoteModal, setRenameNoteModal] = useState<{ isOpen: boolean; folderId: string; noteId: string; currentTitle: string }>({ isOpen: false, folderId: '', noteId: '', currentTitle: '' })
  const [deleteNoteModal, setDeleteNoteModal] = useState<{ isOpen: boolean; folderId: string; noteId: string; noteTitle: string }>({ isOpen: false, folderId: '', noteId: '', noteTitle: '' })
  const [deleteTaskModal, setDeleteTaskModal] = useState<{ isOpen: boolean; taskId: string; taskTitle: string }>({ isOpen: false, taskId: '', taskTitle: '' })
  const [inputModal, setInputModal] = useState<{ isOpen: boolean; mode: 'create_folder' | 'create_note' | 'create_canvas'; folderId?: string }>({ isOpen: false, mode: 'create_folder' })
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' }[]>([])
  const [quickAddPopover, setQuickAddPopover] = useState<{ isOpen: boolean; target: HTMLElement | null; date: string }>({ isOpen: false, target: null, date: '' });
  const [activeNote, setActiveNote] = useState<Note | null>(null)

  const [folders, setFolders] = useState<Folder[]>([
    { id: 'f1', name: 'Pribadi', isOpen: true, notes: [{ id: 'n1', title: 'Jurnal', type: 'note' }] },
    { id: 'f2', name: 'Kuliah', isOpen: true, notes: [{ id: 'n2', title: 'Skripsi Bab 1', type: 'note' }] },
    { id: 'f3', name: 'Excel', isOpen: true, notes: [] },
    { id: 'f4', name: 'Manpro', isOpen: true, notes: [] }
  ])

  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Basic to Advanced', date: '2026-01-26', category: 'Excel', status: 'To Do' },
    { id: '2', title: 'jobseeker toolkit', date: '2026-01-28', category: 'Kuliah', status: 'To Do' },
    { id: '3', title: 'ManPro week 1', date: '2026-02-03', category: 'Manpro', status: 'To Do' },
  ])

  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  const [taskModal, setTaskModal] = useState<{
    isOpen: boolean;
    defaultCategory: string;
    defaultDate: string;
  }>({ isOpen: false, defaultCategory: '', defaultDate: new Date().toISOString().split('T')[0] })

  const editor = useCreateBlockNote()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null)
    const closeNoteContextMenu = () => setNoteContextMenu(null)
    if (contextMenu) {
      window.addEventListener('click', closeContextMenu)
      return () => window.removeEventListener('click', closeContextMenu)
    }
    if (noteContextMenu) {
      window.addEventListener('click', closeNoteContextMenu)
      return () => window.removeEventListener('click', closeNoteContextMenu)
    }
  }, [contextMenu, noteContextMenu])

  useEffect(() => {
    let interval: number | undefined
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0) setIsTimerRunning(false)
    return () => clearInterval(interval)
  }, [isTimerRunning, timeLeft])

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)
  const toggleTheme = () => setIsDarkMode(!isDarkMode)
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const openQuickAdd = (e: React.MouseEvent, date: string) => {
    if ((e.target as HTMLElement).closest('.event-badge')) {
      return;
    }
    setQuickAddPopover({ isOpen: true, target: e.currentTarget as HTMLElement, date });
  };

  const openTaskModal = (category: string = '', date: string = new Date().toISOString().split('T')[0]) => {
    setTaskModal({ isOpen: true, defaultCategory: category, defaultDate: date })
  }

  const handleContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, folderId })
  }

  const handleNoteContextMenu = (e: React.MouseEvent, noteId: string, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setNoteContextMenu({ x: e.clientX, y: e.clientY, noteId, folderId })
    setContextMenu(null)
  }

  const createNewFolder = () => {
    setInputModal({ isOpen: true, mode: 'create_folder' })
  }

  const openDeleteModal = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (folder) {
      setDeleteModal({ isOpen: true, folderId, folderName: folder.name })
    }
  }

  const confirmDeleteFolder = () => {
    const { folderId, folderName } = deleteModal
    setFolders(prev => prev.filter(f => f.id !== folderId))
    setTasks(prev => prev.filter(t => t.category !== folderName))
    setDeleteModal({ isOpen: false, folderId: '', folderName: '' })
    showToast('Folder berhasil dihapus')
  }

  const confirmDeleteNote = () => {
    const { folderId, noteId } = deleteNoteModal
    setFolders(prev => prev.map(f => {
      if (f.id === folderId) {
        return { ...f, notes: f.notes.filter(n => n.id !== noteId) }
      }
      return f
    }))
    if (activeNote?.id === noteId) {
      setActiveNote(null)
      setActiveView('dashboard')
    }
    setDeleteNoteModal({ isOpen: false, folderId: '', noteId: '', noteTitle: '' })
    showToast('Catatan berhasil dihapus')
  }

  const handleAddNote = (folderId: string) => {
    setInputModal({ isOpen: true, mode: 'create_note', folderId })
    setContextMenu(null)
  }

  const handleAddCanvas = (folderId: string) => {
    setInputModal({ isOpen: true, mode: 'create_canvas', folderId })
    setContextMenu(null)
  }

  const openRenameModal = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (folder) {
      setRenameModal({ isOpen: true, folderId, currentName: folder.name })
    }
  }

  const handleRenameFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newName = formData.get('newName') as string
    const { folderId, currentName: oldName } = renameModal

    if (!newName || newName === oldName) {
      setRenameModal({ isOpen: false, folderId: '', currentName: '' })
      return
    }

    setFolders(prev => prev.map(f => (f.id === folderId ? { ...f, name: newName } : f)))
    setTasks(prev => prev.map(t => (t.category === oldName ? { ...t, category: newName } : t)))

    setRenameModal({ isOpen: false, folderId: '', currentName: '' })
    showToast('Folder berhasil diubah')
  }

  const handleRenameNoteSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newTitle = formData.get('newNoteTitle') as string
    const { folderId, noteId } = renameNoteModal

    if (newTitle) {
      setFolders(prev => prev.map(f => {
        if (f.id === folderId) {
          return { ...f, notes: f.notes.map(n => n.id === noteId ? { ...n, title: newTitle } : n) }
        }
        return f
      }))
      if (activeNote?.id === noteId) setActiveNote(prev => prev ? { ...prev, title: newTitle } : null)
    }
    setRenameNoteModal({ isOpen: false, folderId: '', noteId: '', currentTitle: '' })
    showToast('Nama catatan berhasil diubah')
  }

  const toggleFolderInSidebar = (folderId: string) => {
    setFolders(prev => prev.map(f => (f.id === folderId ? { ...f, isOpen: !f.isOpen } : f)))
  }

  const toggleCategoryOnDashboard = (folderId: string) => {
    setOpenCategories(prev => ({ ...prev, [folderId]: !(prev[folderId] ?? true) }))
  }

  const handleTaskSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newTask: Task = {
      id: Date.now().toString(),
      title: formData.get('title') as string,
      category: formData.get('category') as string,
      date: formData.get('date') as string,
      status: 'To Do'
    }
    setTasks([...tasks, newTask])
    setTaskModal({ ...taskModal, isOpen: false })
    showToast('Tugas berhasil ditambahkan')
  }

  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: t.status === 'Done' ? 'To Do' : 'Done' } : t))
  }

  const deleteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) setDeleteTaskModal({ isOpen: true, taskId, taskTitle: task.title })
  }

  const confirmDeleteTask = () => {
    setTasks(prev => prev.filter(t => t.id !== deleteTaskModal.taskId))
    setDeleteTaskModal({ isOpen: false, taskId: '', taskTitle: '' })
    showToast('Tugas berhasil dihapus')
  }

  const onDragEnd = (result: DropResult) => {
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
  };

  const handleQuickAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    if (!title) {
      showToast('Judul tugas tidak boleh kosong', 'error');
      return;
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title,
      category: formData.get('category') as string,
      date: quickAddPopover.date,
      status: 'To Do'
    };

    setTasks(prev => [...prev, newTask]);
    showToast('Tugas berhasil ditambahkan');
    setQuickAddPopover({ isOpen: false, target: null, date: '' });
  }

  const calculatePopoverPosition = (target: HTMLElement | null) => {
    if (!target) return {};
    const rect = target.getBoundingClientRect();
    const popoverHeight = 180;
    const popoverWidth = 320;

    let top = rect.bottom + 8;
    let left = rect.left;

    if (top + popoverHeight > window.innerHeight) top = rect.top - popoverHeight - 8;
    if (left + popoverWidth > window.innerWidth) left = window.innerWidth - popoverWidth - 24;

    return { top, left };
  }

  const handleInputSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const value = formData.get('inputValue') as string
    if (!value) return

    if (inputModal.mode === 'create_folder') {
      setFolders(prev => [...prev, { id: Date.now().toString(), name: value, isOpen: true, notes: [] }])
      showToast('Folder berhasil dibuat')
    } else if (inputModal.mode === 'create_note' && inputModal.folderId) {
      const newNote: Note = { id: Date.now().toString(), title: value, type: 'note' }
      setFolders(prev => prev.map(f => f.id === inputModal.folderId ? { ...f, notes: [...f.notes, newNote], isOpen: true } : f))
      setActiveNote(newNote)
      setActiveView('note')
      showToast('Catatan berhasil dibuat')
    } else if (inputModal.mode === 'create_canvas' && inputModal.folderId) {
      const newNote: Note = { id: Date.now().toString(), title: value, type: 'canvas' }
      setFolders(prev => prev.map(f => f.id === inputModal.folderId ? { ...f, notes: [...f.notes, newNote], isOpen: true } : f))
      setActiveNote(newNote)
      setActiveView('note')
      showToast('Canvas berhasil dibuat')
    }
    setInputModal({ ...inputModal, isOpen: false })
  }

  const onNoteTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    if (activeNote) {
      setActiveNote({ ...activeNote, title: newTitle })
      setFolders(prev => prev.map(f => ({ ...f, notes: f.notes.map(n => n.id === activeNote.id ? { ...n, title: newTitle } : n) })))
    }
  }

  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  const activeFolder = activeNote ? folders.find(f => f.notes.some(n => n.id === activeNote.id)) : null

  const getCoverGradient = (id: string) => {
    const gradients = ['linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)', 'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)', 'linear-gradient(120deg, #f093fb 0%, #f5576c 100%)']
    const index = parseInt(id.replace(/\D/g, '') || '0') % gradients.length
    return gradients[index]
  }

  return (
    <div className="app-container">
      <div className="aurora-bg"></div>

      <aside className={isSidebarOpen ? 'sidebar' : 'sidebar closed'}>
        <div className="user-profile">
          <div className="avatar">P</div>
          <div className="user-info">
            <span className="user-name">Pengguna Aktif</span>
            <span className="user-plan">Ruang Kerja Privat</span>
          </div>
        </div>

        <ul className="nav-list">
          <li className={"nav-item " + (activeView === 'dashboard' ? 'active' : '')} onClick={() => setActiveView('dashboard')}>
            <PiTelevision style={{ marginRight: '8px', fontSize: '1.1rem' }} /> Dashboard
          </li>

          <li style={{ marginTop: '1rem' }}><button className="btn-add-folder" onClick={createNewFolder}><PiPlus style={{ verticalAlign: 'middle' }} /> Folder Baru</button></li>
          {folders.map(folder => (
            <li key={folder.id} className="folder-wrapper">
              <div className="folder-header" onContextMenu={(e) => handleContextMenu(e, folder.id)}>
                <span className="folder-arrow" onClick={() => toggleFolderInSidebar(folder.id)}>
                  <PiCaretDown style={{ transform: folder.isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                </span>
                <span className="folder-icon" onClick={() => toggleFolderInSidebar(folder.id)}><PiFolder size={18} /></span>
                <span className="folder-name" onClick={() => toggleFolderInSidebar(folder.id)}>{folder.name}</span>
              </div>
              {folder.isOpen && (
                <ul className="folder-content">
                  {folder.notes.map(note => (
                    <li key={note.id} className={"note-item " + (activeNote?.id === note.id ? 'active' : '')} onClick={() => { setActiveNote(note); setActiveView('note') }} onContextMenu={(e) => handleNoteContextMenu(e, note.id, folder.id)}>
                      {note.type === 'canvas' ? <PiSquaresFour style={{ marginRight: '6px' }} /> : <PiNotePencil style={{ marginRight: '6px' }} />} {note.title}
                    </li>
                  ))}
                </ul>)}
            </li>
          ))}
        </ul>

        <div className="pomodoro-widget">
          <div className="timer-label"><PiTimer style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} /> Fokus Timer</div>
          <div className="timer-display">{formatTime(timeLeft)}</div>
          <button className="btn-timer" onClick={() => setIsTimerRunning(!isTimerRunning)}>{isTimerRunning ? 'Jeda' : 'Mulai'}</button>
          <button className="btn-timer" onClick={() => { setIsTimerRunning(false); setTimeLeft(25 * 60) }}>Reset</button>
        </div>

        <div className="theme-wrapper">
          <span className="theme-label">Mode Gelap</span>
          <button className={`toggle-switch ${isDarkMode ? 'active' : ''}`} onClick={toggleTheme}><div className="toggle-handle">{isDarkMode ? <PiMoon size={12} color="#333" style={{ marginTop: '3px', marginLeft: '3px' }} /> : <PiSun size={12} color="#F59E0B" style={{ marginTop: '3px', marginLeft: '3px' }} />}</div></button>
        </div>
      </aside>

      <main className="editor-area">
        <header className="editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {!isSidebarOpen && <button className="btn-graph" onClick={toggleSidebar}><PiList /></button>}
            <span className="breadcrumb">
              {activeView === 'dashboard' ? 'Dashboard' : (
                <>
                  <span style={{ opacity: 0.6 }}>{activeFolder?.name || 'Folder'}</span> <span style={{ margin: '0 6px', opacity: 0.4 }}>/</span> <span>{activeNote?.title}</span>
                </>
              )}
            </span>
          </div>
        </header>

        {activeView === 'dashboard' ? (
          <div className="dashboard-view">
            <div className="dashboard-title">
              <h1>Deadline</h1>
            </div>

            <div className="view-tabs">
              <button className={`view-tab ${dashboardTab === 'category' ? 'active' : ''}`} onClick={() => setDashboardTab('category')}><PiStack style={{ verticalAlign: 'text-bottom' }} /> By Category</button>
              <button className={`view-tab ${dashboardTab === 'calendar' ? 'active' : ''}`} onClick={() => setDashboardTab('calendar')}><PiCalendar style={{ verticalAlign: 'text-bottom' }} /> Calendar</button>
            </div>

            {dashboardTab === 'category' && (
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="category-views">
                  {folders.map(folder => {
                    const folderTasks = tasks.filter(t => t.category === folder.name);
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
                                <div className="task-list-header">
                                  <span>Aa Meeting name</span>
                                  <span>Date</span>
                                </div>
                                {folderTasks.map((task, index) => (
                                  <Draggable key={task.id} draggableId={task.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`task-row ${task.status === 'Done' ? 'completed' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                          <input type="checkbox" className="custom-checkbox" checked={task.status === 'Done'} onChange={() => toggleTaskStatus(task.id)} />
                                          <span className="task-title">{task.title}</span>
                                        </div>
                                        <span className="task-date" style={{ marginRight: '1rem' }}>{new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        <button onClick={() => deleteTask(task.id)} className="btn-icon-danger"><PiTrash /></button>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                                <button className="btn-inline-add" onClick={(e) => { e.stopPropagation(); openTaskModal(folder.name, ''); }}>
                                  <PiPlus style={{ marginRight: '4px' }} /> New meeting
                                </button>
                              </div>
                            )}
                          </StrictModeDroppable>
                        )}
                      </div>
                    );
                  })}
                  <button className="btn-inline-add" style={{ marginTop: '2rem' }} onClick={createNewFolder}>
                    <PiPlus style={{ marginRight: '4px' }} /> Add new category group
                  </button>
                </div>
              </DragDropContext>
            )}

            {dashboardTab === 'calendar' && (
              <div className="calendar-views">
                <h3 style={{ marginBottom: '1rem' }}>{monthNames[currentMonth]} {currentYear}</h3>
                <div className="calendar-header-row">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="calendar-grid">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="cal-day empty"></div>)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const dayTasks = tasks.filter(t => t.date === dateStr)
                    const isToday = day === today.getDate()

                    return (
                      <div key={day} className={`cal-day ${isToday ? 'today' : ''}`} onClick={(e) => openQuickAdd(e, dateStr)}>
                        <div className="day-header">
                          <span className="day-num">{day}</span>
                        </div>
                        {dayTasks.map(t => (
                          <div key={t.id} className="event-badge">{t.title}</div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="document-container">
            <div className="document-cover" style={{ background: getCoverGradient(activeNote?.id || '0') }}>
              <div className="cover-actions">
                <button className="btn-cover-action"><PiImage style={{ marginRight: '6px' }} /> Ubah Cover</button>
              </div>
            </div>

            <article className="document-content">
              <div className="document-icon-wrapper">
                <span className="document-icon-large">{activeNote?.type === 'canvas' ? <PiSquaresFour /> : <PiNotePencil />}</span>
                <button className="btn-icon-action"><PiSmiley /></button>
              </div>

              <input className="document-title-input" value={activeNote?.title || ''} onChange={onNoteTitleChange} placeholder="Untitled" />

              <div className="document-meta">
                <span className="meta-item"><PiCalendar style={{ marginRight: '4px' }} /> Hari ini</span>
                <span className="meta-item"><PiTag style={{ marginRight: '4px' }} /> Tambah Tag</span>
              </div>

              <div className="editor-wrapper">
                {activeNote?.type === 'canvas' ? (<div className="canvas-placeholder"><PiSquaresFour size={48} /><h3>Canvas Mode</h3><p>Area ini untuk menggambar diagram.</p></div>) : (<BlockNoteView editor={editor} theme={isDarkMode ? 'dark' : 'light'} />)}
              </div>
            </article>
          </div>
        )}
      </main>

      {quickAddPopover.isOpen && (
        <div className="modal-overlay transparent" onClick={() => setQuickAddPopover({ isOpen: false, target: null, date: '' })}>
          <div className="quick-add-popover" style={calculatePopoverPosition(quickAddPopover.target)} onClick={e => e.stopPropagation()}>
            <h4 className="quick-add-title">Tambah Tugas Cepat</h4>
            <form onSubmit={handleQuickAddSubmit}>
              <input name="title" className="form-control" placeholder="Contoh: Mengerjakan laporan" autoFocus required />
              <div className="select-wrapper">
                <select name="category" className="form-control" defaultValue={activeFolder?.name || (folders[0]?.name || '')}>
                  {folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
                <PiCaretDown className="select-icon" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setQuickAddPopover({ isOpen: false, target: null, date: '' })}>Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <div className="context-item" onClick={() => handleAddNote(contextMenu.folderId)}>
            <PiFilePlus style={{ marginRight: '8px' }} /> Tambah Catatan
          </div>
          <div className="context-item" onClick={() => handleAddCanvas(contextMenu.folderId)}>
            <PiSquaresFour style={{ marginRight: '8px' }} /> Tambah Canvas
          </div>
          <div className="context-item" onClick={() => openRenameModal(contextMenu.folderId)}>
            <PiPencilSimple style={{ marginRight: '8px' }} /> Ubah Nama
          </div>
          <div className="context-item delete" onClick={() => openDeleteModal(contextMenu.folderId)}>
            <PiTrash style={{ marginRight: '8px' }} /> Hapus
          </div>
        </div>
      )}

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <PiCheckCircle size={20} /> : <PiWarningCircle size={20} />}
            <span>{toast.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}><PiX /></button>
          </div>
        ))}
      </div>

      {noteContextMenu && (
        <div className="context-menu" style={{ top: noteContextMenu.y, left: noteContextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <div className="context-item" onClick={() => setRenameNoteModal({ isOpen: true, folderId: noteContextMenu.folderId, noteId: noteContextMenu.noteId, currentTitle: folders.find(f => f.id === noteContextMenu.folderId)?.notes.find(n => n.id === noteContextMenu.noteId)?.title || '' })}>
            <PiPencilSimple style={{ marginRight: '8px' }} /> Ubah Nama
          </div>
          <div className="context-item delete" onClick={() => setDeleteNoteModal({ isOpen: true, folderId: noteContextMenu.folderId, noteId: noteContextMenu.noteId, noteTitle: folders.find(f => f.id === noteContextMenu.folderId)?.notes.find(n => n.id === noteContextMenu.noteId)?.title || '' })}>
            <PiTrash style={{ marginRight: '8px' }} /> Hapus
          </div>
        </div>
      )}

      {renameModal.isOpen && (
        <div className="modal-overlay" onClick={() => setRenameModal({ isOpen: false, folderId: '', currentName: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Ubah Nama Folder</h3>
            <form onSubmit={handleRenameFolder}>
              <div className="form-group">
                <label>Nama Folder</label>
                <input name="newName" className="form-control" autoFocus required defaultValue={renameModal.currentName} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setRenameModal({ isOpen: false, folderId: '', currentName: '' })}>Cancel</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renameNoteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setRenameNoteModal({ isOpen: false, folderId: '', noteId: '', currentTitle: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Ubah Nama Catatan</h3>
            <form onSubmit={handleRenameNoteSubmit}>
              <div className="form-group">
                <label>Nama Catatan</label>
                <input name="newNoteTitle" className="form-control" autoFocus required defaultValue={renameNoteModal.currentTitle} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setRenameNoteModal({ isOpen: false, folderId: '', noteId: '', currentTitle: '' })}>Cancel</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ isOpen: false, folderId: '', folderName: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Hapus Folder?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Apakah Anda yakin ingin menghapus folder <strong>{deleteModal.folderName}</strong>? <br />
              Semua tugas dan catatan di dalamnya akan dihapus secara permanen.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteModal({ isOpen: false, folderId: '', folderName: '' })}>Batal</button>
              <button className="btn-danger" onClick={confirmDeleteFolder}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {deleteNoteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteNoteModal({ isOpen: false, folderId: '', noteId: '', noteTitle: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Hapus Catatan?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Apakah Anda yakin ingin menghapus catatan <strong>{deleteNoteModal.noteTitle}</strong>? <br />
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteNoteModal({ isOpen: false, folderId: '', noteId: '', noteTitle: '' })}>Batal</button>
              <button className="btn-danger" onClick={confirmDeleteNote}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {deleteTaskModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteTaskModal({ isOpen: false, taskId: '', taskTitle: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Hapus Tugas?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Apakah Anda yakin ingin menghapus tugas <strong>{deleteTaskModal.taskTitle}</strong>?
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteTaskModal({ isOpen: false, taskId: '', taskTitle: '' })}>Batal</button>
              <button className="btn-danger" onClick={confirmDeleteTask}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {inputModal.isOpen && (
        <div className="modal-overlay" onClick={() => setInputModal({ ...inputModal, isOpen: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              {inputModal.mode === 'create_folder' ? 'Folder Baru' : inputModal.mode === 'create_note' ? 'Catatan Baru' : 'Canvas Baru'}
            </h3>
            <form onSubmit={handleInputSubmit}>
              <div className="form-group">
                <label>Nama</label>
                <input name="inputValue" className="form-control" autoFocus required placeholder={inputModal.mode === 'create_folder' ? 'Nama Folder...' : 'Judul...'} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setInputModal({ ...inputModal, isOpen: false })}>Batal</button>
                <button type="submit" className="btn-primary">Buat</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {taskModal.isOpen && (
        <div className="modal-overlay" onClick={() => setTaskModal({ ...taskModal, isOpen: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Tambah Data Baru</h3>
            <form onSubmit={handleTaskSubmit}>
              <div className="form-group">
                <label>Nama Meeting / Tugas</label>
                <input name="title" className="form-control" autoFocus required placeholder="Contoh: Skripsi Bab 2" />
              </div>
              <div className="form-group">
                <label>Kategori</label>
                <div className="select-wrapper">
                  <select name="category" className="form-control" defaultValue={taskModal.defaultCategory || (folders[0]?.name || '')}>
                    {folders.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                  <PiCaretDown className="select-icon" />
                </div>
              </div>
              <div className="form-group">
                <label>Tanggal</label>
                <input type="date" name="date" className="form-control" defaultValue={taskModal.defaultDate} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setTaskModal({ ...taskModal, isOpen: false })}>Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
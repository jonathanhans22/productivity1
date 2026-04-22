import React from 'react';
import {
  DragDropContext,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { PiTarget, PiClock, PiWarningCircle, PiUsersThree, PiTrash, PiX, PiCheckCircle, PiDotsSixVertical } from 'react-icons/pi';
import { StrictModeDroppable } from '../App';

interface Task {
  id: string;
  title: string;
  category: string;
  status: string;
  priority_level?: string | null;
}

interface Props {
  tasks: Task[];
  onAssign: (taskId: string, level: string | null) => void;
  onDragEnd?: (result: DropResult) => void;
}

const quadrants = [
  {
    id: 'urgent-important',
    title: 'Do Now',
    subtitle: 'Urgent & Important',
    icon: <PiWarningCircle size={18} />,
    color: '#ef4444',
    shortLabel: 'Q1',
    description: 'Critical tasks that need immediate attention',
  },
  {
    id: 'important-not-urgent',
    title: 'Schedule',
    subtitle: 'Important, Not Urgent',
    icon: <PiClock size={18} />,
    color: '#6366f1',
    shortLabel: 'Q2',
    description: 'Plan these for later — high value, no rush',
  },
  {
    id: 'urgent-not-important',
    title: 'Delegate',
    subtitle: 'Urgent, Not Important',
    icon: <PiUsersThree size={18} />,
    color: '#f59e0b',
    shortLabel: 'Q3',
    description: 'Try to hand these off to someone else',
  },
  {
    id: 'low',
    title: 'Eliminate',
    subtitle: 'Low Priority',
    icon: <PiTrash size={18} />,
    color: '#64748b',
    shortLabel: 'Q4',
    description: 'Rarely urgent or important — consider dropping',
  },
];

const UNASSIGNED_ID = 'unassigned';

const PriorityView = ({ tasks, onAssign, onDragEnd }: Props) => {
  const activeTasks = tasks.filter(t => t.status !== 'Done');
  const unassigned = activeTasks.filter(t => !t.priority_level);
  const assigned = activeTasks.filter(t => !!t.priority_level);

  const handleDragEnd = (result: DropResult) => {
    if (onDragEnd) {
      onDragEnd(result);
      return;
    }

    const { draggableId, destination } = result;
    if (!destination) return;

    const destId = destination.droppableId;
    const newLevel = destId === UNASSIGNED_ID ? null : destId;
    onAssign(draggableId, newLevel);
  };

  const renderTaskCard = (task: Task, index: number, accentColor: string) => (
    <Draggable key={task.id} draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`priority-task-item${snapshot.isDragging ? ' dragging' : ''}`}
        >
          {/* Drag handle */}
          <span
            {...provided.dragHandleProps}
            className="drag-handle"
            title="Drag to move"
          >
            <PiDotsSixVertical size={15} />
          </span>

          <span className="task-dot" style={{ background: accentColor }} />
          <div className="task-info">
            <p className="task-name">{task.title}</p>
            <small className="task-cat">{task.category}</small>
          </div>
          <button
            className="task-unassign-btn"
            onClick={() => onAssign(task.id, null)}
            title="Move back to unassigned"
          >
            <PiX size={13} />
          </button>
        </div>
      )}
    </Draggable>
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="priority-container">

        {/* Header */}
        <header className="priority-header">
          <div className="priority-header-icon">
            <PiTarget size={28} />
          </div>
          <div>
            <h1>Priority Matrix</h1>
            <p>Drag tasks from the pool into a quadrant, or between quadrants</p>
          </div>
          <div className="priority-stats">
            <div className="pstat">
              <span className="pstat-num">{unassigned.length}</span>
              <span className="pstat-label">Unassigned</span>
            </div>
            <div className="pstat">
              <span className="pstat-num">{assigned.length}</span>
              <span className="pstat-label">Assigned</span>
            </div>
          </div>
        </header>

        {/* All done empty state */}
        {activeTasks.length === 0 && (
          <div className="priority-empty">
            <PiCheckCircle size={56} />
            <h3>All caught up!</h3>
            <p>No pending tasks. Mark tasks as "To Do" or "In Progress" on the Dashboard to see them here.</p>
          </div>
        )}

        {/* Unassigned Task Pool — always visible if there are active tasks */}
        {activeTasks.length > 0 && (
          <div className="unassigned-pool">
            <div className="pool-label">
              <span className="pool-badge">{unassigned.length}</span>
              <span>Unassigned Tasks</span>
              <span className="pool-hint">— drag into a quadrant below, or use the Q1–Q4 buttons</span>
            </div>

            <StrictModeDroppable droppableId={UNASSIGNED_ID} direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`pool-scroll${snapshot.isDraggingOver ? ' drag-over-pool' : ''}`}
                >
                  {unassigned.length === 0 && !snapshot.isDraggingOver && (
                    <div className="pool-empty-hint">All tasks have been assigned 🎉</div>
                  )}

                  {unassigned.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`pool-chip${snapshot.isDragging ? ' dragging' : ''}`}
                        >
                          {/* drag handle */}
                          <span
                            {...provided.dragHandleProps}
                            className="drag-handle pool-drag-handle"
                            title="Drag to a quadrant"
                          >
                            <PiDotsSixVertical size={14} />
                          </span>

                          <div className="chip-body">
                            <span className="chip-title">{task.title}</span>
                            <span className="chip-cat">{task.category}</span>
                          </div>

                          {/* Quick-assign buttons */}
                          <div className="chip-btns">
                            {quadrants.map(q => (
                              <button
                                key={q.id}
                                className="chip-assign-btn"
                                style={{
                                  background: q.color + '1a',
                                  color: q.color,
                                  border: `1.5px solid ${q.color}55`,
                                }}
                                onClick={() => onAssign(task.id, q.id)}
                                title={`${q.title} — ${q.subtitle}`}
                              >
                                {q.shortLabel}
                              </button>
                            ))}
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
        )}

        {/* 2×2 Eisenhower Grid */}
        <div className="eisenhower-grid">
          {quadrants.map(q => {
            const qTasks = activeTasks.filter(t => t.priority_level === q.id);
            return (
              <div key={q.id} className="quadrant-card">
                <div className="quadrant-header" style={{ borderTop: `3px solid ${q.color}` }}>
                  <span className="q-icon" style={{ color: q.color, background: q.color + '18' }}>
                    {q.icon}
                  </span>
                  <div className="q-labels">
                    <h3>{q.title}</h3>
                    <span className="q-subtitle">{q.subtitle}</span>
                  </div>
                  <span className="q-count" style={{ background: q.color + '22', color: q.color }}>
                    {qTasks.length}
                  </span>
                </div>

                <p className="q-description">{q.description}</p>

                <StrictModeDroppable droppableId={q.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`quadrant-content${snapshot.isDraggingOver ? ' drag-over-quadrant' : ''}`}
                      style={snapshot.isDraggingOver ? { '--quad-accent': q.color } as React.CSSProperties : {}}
                    >
                      {qTasks.length === 0 && !snapshot.isDraggingOver && (
                        <div className="empty-quadrant">
                          <span>Drop tasks here</span>
                        </div>
                      )}

                      {qTasks.map((task, index) => renderTaskCard(task, index, q.color))}
                      {provided.placeholder}
                    </div>
                  )}
                </StrictModeDroppable>
              </div>
            );
          })}
        </div>

      </div>
    </DragDropContext>
  );
};

export default PriorityView;
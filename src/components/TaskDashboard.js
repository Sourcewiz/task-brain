'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Brain, Plus, Check, Circle, Clock, AlertTriangle,
  ChevronDown, LogOut, Flame, Target, Phone,
  Calendar, Tag, X, Trash2, RotateCcw, Zap
} from 'lucide-react'

const PRIORITY_CONFIG = {
  P0: { color: 'bg-red-100 text-red-700', dot: 'bg-red-500', label: 'P0' },
  P1: { color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'P1' },
  P2: { color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: 'P2' },
  backlog: { color: 'bg-gray-50 text-gray-400', dot: 'bg-gray-300', label: 'BL' },
}

const FILTERS = [
  { key: 'today', label: 'Today', icon: Target },
  { key: 'p0', label: 'P0 Only', icon: AlertTriangle },
  { key: 'follow-ups', label: 'Follow-ups', icon: Phone },
  { key: 'all', label: 'All Active', icon: Circle },
  { key: 'done', label: 'Done', icon: Check },
]

export default function TaskDashboard({ session }) {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('today')
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addPriority, setAddPriority] = useState('P1')
  const [addType, setAddType] = useState('task')
  const [addDueDate, setAddDueDate] = useState('')
  const [addFollowUp, setAddFollowUp] = useState('')
  const inputRef = useRef(null)

  const today = new Date().toISOString().split('T')[0]
  const user = session.user

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setTasks(data)
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    fetchTasks()

    // Real-time subscription
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchTasks, user.id])

  // Parse natural language input
  const parseTaskInput = (text) => {
    let priority = addPriority
    let type = addType
    let dueDate = addDueDate || null
    let followUpWith = addFollowUp || null
    let title = text

    // Priority detection
    if (/\b(p0|urgent|asap|critical)\b/i.test(text)) { priority = 'P0'; title = title.replace(/\b(p0|urgent|asap|critical)\b/i, '').trim() }
    else if (/\bp1\b/i.test(text)) { priority = 'P1'; title = title.replace(/\bp1\b/i, '').trim() }
    else if (/\bp2\b/i.test(text)) { priority = 'P2'; title = title.replace(/\bp2\b/i, '').trim() }
    else if (/\b(backlog|later|someday)\b/i.test(text)) { priority = 'backlog'; title = title.replace(/\b(backlog|later|someday)\b/i, '').trim() }

    // Follow-up detection
    const followMatch = text.match(/follow\s*up\s*(?:with\s+)?(\w+)/i) || text.match(/ping\s+(\w+)/i) || text.match(/chase\s+(\w+)/i) || text.match(/check\s*(?:in)?\s*(?:with\s+)?(\w+)/i)
    if (followMatch) {
      type = 'follow-up'
      followUpWith = followMatch[1]
    }

    // Reminder detection
    if (/\bremind\s*me\b/i.test(text)) { type = 'reminder' }

    // Date detection
    if (!dueDate) {
      if (/\btoday\b/i.test(text)) dueDate = today
      else if (/\btomorrow\b/i.test(text)) {
        const d = new Date(); d.setDate(d.getDate() + 1); dueDate = d.toISOString().split('T')[0]
      }
      else if (/\b(monday|mon)\b/i.test(text)) dueDate = getNextWeekday(1)
      else if (/\b(tuesday|tue)\b/i.test(text)) dueDate = getNextWeekday(2)
      else if (/\b(wednesday|wed)\b/i.test(text)) dueDate = getNextWeekday(3)
      else if (/\b(thursday|thu)\b/i.test(text)) dueDate = getNextWeekday(4)
      else if (/\b(friday|fri)\b/i.test(text)) dueDate = getNextWeekday(5)
      else if (/\bnext week\b/i.test(text)) {
        const d = new Date(); d.setDate(d.getDate() + 7); dueDate = d.toISOString().split('T')[0]
      }
      // Clean date words from title
      title = title.replace(/\b(by |on |before )?(today|tomorrow|monday|tuesday|wednesday|thursday|friday|next week|mon|tue|wed|thu|fri)\b/gi, '').trim()
    }

    // Clean up title
    title = title.replace(/\b(follow up with|ping|chase|check in with|remind me to|remind me)\b/gi, '').trim()
    title = title.replace(/\s{2,}/g, ' ').trim()
    if (!title) title = text // fallback to original

    return { title, priority, type, dueDate, followUpWith }
  }

  const getNextWeekday = (day) => {
    const d = new Date()
    const diff = (day - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + diff)
    return d.toISOString().split('T')[0]
  }

  // Add task
  const handleAddTask = async (e) => {
    e?.preventDefault()
    if (!inputValue.trim()) return

    const parsed = parseTaskInput(inputValue)

    const newTask = {
      title: parsed.title,
      detail: inputValue,
      priority: parsed.priority,
      type: parsed.type,
      status: 'active',
      owner: 'supreet',
      follow_up_with: parsed.followUpWith,
      follow_up_channel: parsed.followUpWith ? 'slack' : null,
      due_date: parsed.dueDate,
      remind_at: parsed.dueDate,
      tags: [],
      notes: [],
      user_id: user.id,
    }

    // Optimistic update
    const tempId = crypto.randomUUID()
    setTasks(prev => [{ ...newTask, id: tempId, created_at: new Date().toISOString() }, ...prev])
    setInputValue('')
    setShowAddForm(false)
    setAddPriority('P1')
    setAddType('task')
    setAddDueDate('')
    setAddFollowUp('')

    const { data, error } = await supabase.from('tasks').insert(newTask).select().single()
    if (data) {
      setTasks(prev => prev.map(t => t.id === tempId ? data : t))
    }
  }

  // Toggle task completion
  const toggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newStatus = task.status === 'active' ? 'done' : 'active'
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null

    // Optimistic
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, completed_at: completedAt } : t
    ))

    await supabase.from('tasks').update({ status: newStatus, completed_at: completedAt }).eq('id', taskId)
  }

  // Delete task
  const deleteTask = async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await supabase.from('tasks').delete().eq('id', taskId)
  }

  // Update priority
  const cyclePriority = async (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const order = ['P0', 'P1', 'P2', 'backlog']
    const next = order[(order.indexOf(task.priority) + 1) % order.length]

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: next } : t))
    await supabase.from('tasks').update({ priority: next }).eq('id', taskId)
  }

  // Filter tasks
  const getFilteredTasks = () => {
    const active = tasks.filter(t => t.status === 'active')
    const done = tasks.filter(t => t.status === 'done')

    switch (filter) {
      case 'today':
        return active.filter(t => {
          if (t.priority === 'P0') return true
          if (t.due_date && t.due_date <= today) return true
          return false
        }).sort((a, b) => {
          const p = { P0: 0, P1: 1, P2: 2, backlog: 3 }
          return (p[a.priority] || 3) - (p[b.priority] || 3)
        })
      case 'p0':
        return active.filter(t => t.priority === 'P0')
      case 'follow-ups':
        return active.filter(t => t.type === 'follow-up')
      case 'all':
        return active.sort((a, b) => {
          const p = { P0: 0, P1: 1, P2: 2, backlog: 3 }
          return (p[a.priority] || 3) - (p[b.priority] || 3)
        })
      case 'done':
        return done.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')).slice(0, 30)
      default:
        return active
    }
  }

  const getDueLabel = (task) => {
    if (!task.due_date) return null
    if (task.due_date < today) return { text: 'Overdue', cls: 'text-red-600 font-semibold' }
    if (task.due_date === today) return { text: 'Today', cls: 'text-orange-600 font-semibold' }
    const d = new Date(task.due_date + 'T00:00:00')
    const t = new Date(today + 'T00:00:00')
    const diff = Math.ceil((d - t) / 86400000)
    if (diff === 1) return { text: 'Tomorrow', cls: 'text-gray-600' }
    if (diff <= 7) return { text: d.toLocaleDateString('en-US', { weekday: 'short' }), cls: 'text-gray-500' }
    return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'text-gray-400' }
  }

  // Stats
  const active = tasks.filter(t => t.status === 'active')
  const doneToday = tasks.filter(t => t.status === 'done' && t.completed_at?.startsWith(today))
  const stats = {
    p0: active.filter(t => t.priority === 'P0').length,
    p1: active.filter(t => t.priority === 'P1').length,
    followups: active.filter(t => t.type === 'follow-up').length,
    doneToday: doneToday.length,
  }

  const filtered = getFilteredTasks()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading tasks...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Task Brain</h1>
              <p className="text-[11px] text-gray-400">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={handleSignOut} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <LogOut className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-32">
        {/* Streak bar */}
        {stats.doneToday >= 3 && (
          <div className="mt-4 flex items-center gap-3 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl px-4 py-3 text-white animate-fade-in">
            <Flame className="w-5 h-5" />
            <div>
              <p className="text-sm font-semibold">{stats.doneToday} tasks done today!</p>
              <p className="text-xs opacity-80">Keep the momentum going.</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2.5 mt-4">
          {[
            { n: stats.p0, label: 'P0s', color: 'text-red-600' },
            { n: stats.p1, label: 'P1s', color: 'text-orange-600' },
            { n: stats.followups, label: 'Follow-ups', color: 'text-blue-600' },
            { n: stats.doneToday, label: 'Done today', color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-100 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.n}</div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mt-5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                filter === f.key
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="mt-4 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <div className="text-4xl mb-2">
                {filter === 'today' ? '☀️' : filter === 'p0' ? '🎯' : filter === 'follow-ups' ? '📞' : filter === 'done' ? '🏁' : '✨'}
              </div>
              <p className="text-gray-500 text-sm font-medium">
                {filter === 'today' ? 'Nothing urgent today' : filter === 'p0' ? 'No P0s right now' : filter === 'follow-ups' ? 'No pending follow-ups' : filter === 'done' ? 'No completed tasks yet' : 'Task list is empty'}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {filter === 'today' ? 'Add tasks below or wait for Mary\'s morning brief' : 'Dump your first task below'}
              </p>
            </div>
          ) : (
            filtered.map(task => {
              const isDone = task.status === 'done'
              const due = getDueLabel(task)
              const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.P1

              return (
                <div
                  key={task.id}
                  className="group flex items-start gap-3 bg-white rounded-xl px-4 py-3.5 border border-gray-100 hover:border-gray-200 transition-all animate-fade-in"
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      isDone ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
                    }`}
                  >
                    {isDone && <Check className="w-3 h-3 text-white animate-check" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.type === 'follow-up' && <Phone className="w-3.5 h-3.5 inline mr-1.5 text-blue-500" />}
                      {task.type === 'reminder' && <Clock className="w-3.5 h-3.5 inline mr-1.5 text-orange-500" />}
                      {task.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {task.follow_up_with && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          → {task.follow_up_with}
                        </span>
                      )}
                      {due && (
                        <span className={`text-xs ${due.cls}`}>{due.text}</span>
                      )}
                    </div>
                  </div>

                  {/* Priority badge */}
                  <button
                    onClick={() => cyclePriority(task.id)}
                    className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${pc.color} hover:opacity-80 transition-opacity`}
                    title="Click to cycle priority"
                  >
                    {pc.label}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* Add task bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {showAddForm && (
            <div className="flex items-center gap-2 mb-2.5 animate-fade-in">
              {/* Priority selector */}
              <div className="flex gap-1">
                {['P0', 'P1', 'P2', 'backlog'].map(p => (
                  <button
                    key={p}
                    onClick={() => setAddPriority(p)}
                    className={`text-xs font-bold px-2 py-1 rounded transition-all ${
                      addPriority === p ? PRIORITY_CONFIG[p].color : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-gray-200"></div>
              {/* Type selector */}
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              >
                <option value="task">Task</option>
                <option value="follow-up">Follow-up</option>
                <option value="reminder">Reminder</option>
              </select>
              {/* Due date */}
              <input
                type="date"
                value={addDueDate}
                onChange={(e) => setAddDueDate(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1"
              />
              {addType === 'follow-up' && (
                <input
                  type="text"
                  value={addFollowUp}
                  onChange={(e) => setAddFollowUp(e.target.value)}
                  placeholder="Who?"
                  className="text-xs border border-gray-200 rounded px-2 py-1 w-20"
                />
              )}
            </div>
          )}
          <form onSubmit={handleAddTask} className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className={`p-2.5 rounded-xl border transition-all flex-shrink-0 ${
                showAddForm ? 'bg-gray-100 border-gray-300' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {showAddForm ? <X className="w-4 h-4 text-gray-500" /> : <Zap className="w-4 h-4 text-gray-400" />}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => {}}
              placeholder="Dump a task... 'follow up with Div on pricing by Friday'"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="px-5 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-30"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
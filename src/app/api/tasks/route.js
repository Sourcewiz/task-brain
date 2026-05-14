import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// This endpoint uses the service role key for server-to-server calls (Mary's scheduled tasks)
// Protected by a simple API key check
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function checkAuth(request) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.TASK_BRAIN_API_KEY) {
    return false
  }
  return true
}

// GET /api/tasks?owner=supreet&status=active
export async function GET(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const owner = searchParams.get('owner') || 'supreet'
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const type = searchParams.get('type')

  const supabase = getAdminClient()
  let query = supabase.from('tasks').select('*').eq('owner', owner)

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (type) query = query.eq('type', type)

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data })
}

// POST /api/tasks — create a new task
export async function POST(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = getAdminClient()

  const { data, error } = await supabase.from('tasks').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}

// PATCH /api/tasks — update a task
export async function PATCH(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Task ID required' }, { status: 400 })

  const supabase = getAdminClient()
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}
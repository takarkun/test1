const STORAGE_KEY = 'simple-todo-tasks';
const ROOM_KEY = 'simple-todo-room';
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
const supabaseClient = SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const state = {
  tasks: loadTasks(),
  filter: 'all',
  roomCode: localStorage.getItem(ROOM_KEY) || '',
};

let roomSubscription;

const elements = {
  input: document.querySelector('#taskInput'),
  addButton: document.querySelector('#addButton'),
  taskList: document.querySelector('#taskList'),
  emptyState: document.querySelector('#emptyState'),
  emptyTitle: document.querySelector('#emptyTitle'),
  emptyText: document.querySelector('#emptyText'),
  clearButton: document.querySelector('#clearButton'),
  today: document.querySelector('#today'),
  progressRing: document.querySelector('#progressRing'),
  progressValue: document.querySelector('#progressValue'),
  remainingText: document.querySelector('#remainingText'),
  allCount: document.querySelector('#allCount'),
  activeCount: document.querySelector('#activeCount'),
  completedCount: document.querySelector('#completedCount'),
  roomInput: document.querySelector('#roomInput'),
  joinRoomButton: document.querySelector('#joinRoomButton'),
  roomLabel: document.querySelector('#roomLabel'),
  syncStatus: document.querySelector('#syncStatus'),
};

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});
elements.today.textContent = dateFormatter.format(new Date());

function loadTasks() {
  try {
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedTasks) ? savedTasks : [];
  } catch {
    return [];
  }
}

function saveTasks({ sync = true } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  if (sync && state.roomCode) saveSharedTasks();
}

async function saveSharedTasks() {
  if (!supabaseClient) return;
  setSyncStatus('保存中...', 'pending');
  const { error } = await supabaseClient
    .from('todo_rooms')
    .upsert({ room_code: state.roomCode, tasks: state.tasks, updated_at: new Date().toISOString() }, { onConflict: 'room_code' });
  setSyncStatus(error ? '同期エラー' : '同期済み', error ? 'error' : 'success');
}

function setSyncStatus(message, type = 'success') {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.state = type;
}

async function joinRoom() {
  const roomCode = elements.roomInput.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!roomCode) return;
  if (!supabaseClient) {
    setSyncStatus('Supabase設定が必要', 'error');
    return;
  }

  setSyncStatus('接続中...', 'pending');
  const { data, error } = await supabaseClient
    .from('todo_rooms')
    .select('tasks')
    .eq('room_code', roomCode)
    .maybeSingle();
  if (error) {
    setSyncStatus('接続できません', 'error');
    return;
  }

  if (roomSubscription) await supabaseClient.removeChannel(roomSubscription);
  state.roomCode = roomCode;
  localStorage.setItem(ROOM_KEY, roomCode);
  state.tasks = Array.isArray(data?.tasks) ? data.tasks : state.tasks;
  saveTasks({ sync: false });
  if (!data) await saveSharedTasks();
  roomSubscription = supabaseClient
    .channel(`todo-room-${roomCode}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_rooms', filter: `room_code=eq.${roomCode}` }, (payload) => {
      if (payload.new?.tasks && Array.isArray(payload.new.tasks)) {
        state.tasks = payload.new.tasks;
        saveTasks({ sync: false });
        render();
      }
    })
    .subscribe();
  elements.roomInput.value = roomCode;
  render();
  setSyncStatus('同期済み', 'success');
}

function addTask() {
  const title = elements.input.value.trim();
  if (!title) return;

  state.tasks.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title,
    completed: false,
  });
  elements.input.value = '';
  saveTasks();
  render();
  elements.input.focus();
}

function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  render();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  saveTasks();
  render();
}

function visibleTasks() {
  if (state.filter === 'active') return state.tasks.filter((task) => !task.completed);
  if (state.filter === 'completed') return state.tasks.filter((task) => task.completed);
  return state.tasks;
}

function render() {
  const visible = visibleTasks();
  const completedCount = state.tasks.filter((task) => task.completed).length;
  const activeCount = state.tasks.length - completedCount;
  const progress = state.tasks.length ? Math.round((completedCount / state.tasks.length) * 100) : 0;

  elements.taskList.innerHTML = visible.map((task) => `
    <article class="task-item${task.completed ? ' is-complete' : ''}">
      <button class="check-button" type="button" aria-label="${task.completed ? '未完了に戻す' : '完了にする'}: ${escapeHtml(task.title)}" data-action="toggle" data-id="${task.id}"></button>
      <p class="task-text">${escapeHtml(task.title)}</p>
      <button class="delete-button" type="button" aria-label="削除: ${escapeHtml(task.title)}" data-action="delete" data-id="${task.id}">×</button>
    </article>
  `).join('');

  elements.allCount.textContent = state.tasks.length;
  elements.activeCount.textContent = activeCount;
  elements.completedCount.textContent = completedCount;
  elements.progressValue.textContent = `${progress}%`;
  elements.progressRing.style.background = `conic-gradient(var(--accent) ${progress}%, var(--line) ${progress}%)`;
  elements.remainingText.textContent = `${activeCount}個の未完了タスク`;
  elements.clearButton.disabled = completedCount === 0;
  elements.clearButton.style.opacity = completedCount === 0 ? '.45' : '1';
  elements.roomLabel.textContent = state.roomCode ? `部屋 ${state.roomCode}` : '個人用';

  const isEmpty = visible.length === 0;
  elements.emptyState.hidden = !isEmpty;
  if (state.tasks.length === 0) {
    elements.emptyTitle.textContent = 'タスクはありません';
    elements.emptyText.textContent = '上の入力欄から、今日やることを追加しましょう。';
  } else if (state.filter === 'completed') {
    elements.emptyTitle.textContent = '完了したタスクはありません';
    elements.emptyText.textContent = 'タスクを完了すると、ここに表示されます。';
  } else {
    elements.emptyTitle.textContent = 'すべて完了しました';
    elements.emptyText.textContent = '今日のタスクをきれいに片付けました。';
  }

  document.querySelectorAll('.filter-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.filter === state.filter);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

elements.addButton.addEventListener('click', addTask);
elements.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addTask();
});
elements.taskList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  if (button.dataset.action === 'toggle') toggleTask(button.dataset.id);
  if (button.dataset.action === 'delete') deleteTask(button.dataset.id);
});
document.querySelector('.filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
});
elements.clearButton.addEventListener('click', () => {
  state.tasks = state.tasks.filter((task) => !task.completed);
  saveTasks();
  render();
});
elements.joinRoomButton.addEventListener('click', joinRoom);
elements.roomInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') joinRoom();
});

render();
if (state.roomCode) {
  elements.roomInput.value = state.roomCode;
  if (supabaseClient) joinRoom();
  else setSyncStatus('Supabase設定が必要', 'error');
}

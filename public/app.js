// --- Token helpers ---
const getToken = () => localStorage.getItem('token');
const setToken = (t) => localStorage.setItem('token', t);
const clearToken = () => localStorage.removeItem('token');

// --- Authenticated fetch helper ---
async function authFetch(url, options = {}) {
    const token = getToken();
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        }
    });
}

// --- Section helpers ---
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');

function showAuth() {
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
}

function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
}

// --- Tab switching ---
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
});

// --- Login ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) { errorDiv.textContent = data.error || 'Login failed.'; return; }
        setToken(data.token);
        await init();
    } catch {
        errorDiv.textContent = 'Network error.';
    }
});

// --- Register ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const errorDiv = document.getElementById('register-error');
    errorDiv.textContent = '';

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) { errorDiv.textContent = data.error || 'Registration failed.'; return; }

        // Auto-fill login form and switch to it
        document.getElementById('login-username').value = username;
        document.getElementById('login-password').value = password;
        loginTab.click();
        document.getElementById('login-error').textContent = 'Registered! You can now log in.';
        registerForm.reset();
    } catch {
        errorDiv.textContent = 'Network error.';
    }
});

// --- Logout ---
document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    loginForm.reset();
    document.getElementById('login-error').textContent = '';
    showAuth();
});

// --- Initialize ---
async function init() {
    if (!getToken()) { showAuth(); return; }

    try {
        const res = await authFetch('/api/auth/me');
        if (!res.ok) { clearToken(); showAuth(); return; }

        const user = await res.json();
        document.getElementById('user-info').textContent = `Logged in as ${user.username} (${user.role})`;

        if (user.role === 'admin') {
            document.getElementById('admin-section').classList.remove('hidden');
            loadUsers();
        } else {
            document.getElementById('admin-section').classList.add('hidden');
        }

        showDashboard();
        loadTasks();
    } catch {
        clearToken();
        showAuth();
    }
}

// --- Safe DOM element builder ---
function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'className') node.className = v;
        else if (k === 'textContent') node.textContent = v;
        else node.setAttribute(k, v);
    }
    for (const child of children) node.appendChild(child);
    return node;
}

// --- Tasks ---
document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;
    try {
        const res = await authFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ title }) });
        if (!res.ok) throw new Error('Failed to create task');
        document.getElementById('task-title').value = '';
        loadTasks();
    } catch (err) {
        alert(err.message);
    }
});

async function loadTasks() {
    const taskList = document.getElementById('task-list');
    try {
        const res = await authFetch('/api/tasks');
        if (!res.ok) throw new Error();
        const tasks = await res.json();

        taskList.innerHTML = '';
        if (!tasks.length) {
            taskList.appendChild(el('p', {
                textContent: 'No tasks yet.',
                style: 'color: var(--text-muted); text-align: center; margin-top: 1rem;'
            }));
            return;
        }

        tasks.forEach(task => {
            const content = el('div', { className: 'item-content' }, [
                el('h3', { textContent: task.title }),
                el('p', { textContent: task.description || 'No description' })
            ]);
            const deleteBtn = el('button', { type: 'button', className: 'btn-delete', textContent: '×' });
            deleteBtn.addEventListener('click', async () => {
                await authFetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
                loadTasks();
            });
            taskList.appendChild(el('li', { className: 'item' }, [content, deleteBtn]));
        });
    } catch {
        taskList.innerHTML = '';
        taskList.appendChild(el('p', { textContent: 'Failed to load tasks.', style: 'color: #f87171; text-align: center;' }));
    }
}

// --- Users (admin) ---
async function loadUsers() {
    const userList = document.getElementById('user-list');
    try {
        const res = await authFetch('/admin/users');
        if (!res.ok) throw new Error();
        const users = await res.json();

        userList.innerHTML = '';
        users.forEach(user => {
            const content = el('div', { className: 'item-content' }, [
                el('h3', { textContent: user.username }),
                el('p', { textContent: `ID: ${user.id}` })
            ]);
            const badge = el('span', { className: `badge badge-${user.role}`, textContent: user.role });
            userList.appendChild(el('li', { className: 'item' }, [content, badge]));
        });
    } catch {
        console.error('Failed to load users');
    }
}

init();

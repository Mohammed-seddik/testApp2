const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');
const userList = document.getElementById('user-list');
const adminSection = document.getElementById('admin-section');
const userInfo = document.getElementById('user-info');

// Initialize
init();

async function init() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('Not authenticated');
        const user = await res.json();
        
        userInfo.textContent = `Logged in as ${user.username} (${user.role})`;
        
        if (user.role === 'admin') {
            adminSection.classList.remove('hidden');
            loadUsers();
        } else {
            adminSection.classList.add('hidden');
        }
        
        loadTasks();
    } catch (err) {
        console.error('Initialization failed:', err);
        userInfo.textContent = 'Failed to load user info';
    }
}

// Task Form Submission
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value;

    try {
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });

        if (!res.ok) throw new Error('Failed to create task');
        document.getElementById('task-title').value = '';
        loadTasks();
    } catch (err) {
        alert(err.message);
    }
});

async function loadTasks() {
    try {
        const res = await fetch('/api/tasks');
        if (!res.ok) throw new Error('err');
        const tasks = await res.json();
        
        taskList.innerHTML = tasks.length ? '' : '<p style="color: var(--text-muted); text-align: center; margin-top: 1rem;">No tasks yet.</p>';
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'item';
            li.innerHTML = `
                <div class="item-content">
                    <h3>${task.title}</h3>
                    <p>${task.description || 'No description'}</p>
                </div>
            `;
            taskList.appendChild(li);
        });
    } catch (err) {
        console.error('Failed to load tasks');
    }
}

async function loadUsers() {
    try {
        const res = await fetch('/admin/users');
        if (!res.ok) throw new Error('err');
        const users = await res.json();
        
        userList.innerHTML = '';
        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'item';
            li.innerHTML = `
                <div class="item-content">
                    <h3>${user.username}</h3>
                    <p>ID: ${user.id}</p>
                </div>
                <span class="badge badge-${user.role}">${user.role}</span>
            `;
            userList.appendChild(li);
        });
    } catch (err) {
        console.error('Failed to load users');
    }
}

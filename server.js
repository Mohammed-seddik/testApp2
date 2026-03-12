require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.APP_JWT_SECRET || 'fallback_secret';

// Database Setup
const sequelize = new Sequelize(
    process.env.DB_NAME ,
    process.env.DB_USER ,
    process.env.DB_PASSWORD ,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
    }
);

// Models
const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'user' }
});

const Task = sequelize.define('Task', {
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    completed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

User.hasMany(Task, { foreignKey: 'userId', onDelete: 'CASCADE' });
Task.belongsTo(User, { foreignKey: 'userId' });

// Initialize Database
async function initDb() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');
        await sequelize.sync({ alter: true });
        console.log('Database schema synchronized.');
        await seedDb();
    } catch (err) {
        console.error('Database connection failed:', err.message);
    }
}

async function seedDb() {
    const count = await User.count();
    if (count > 0) return;

    const adminPwd = await bcrypt.hash('admin123', 10);
    const userPwd  = await bcrypt.hash('alice123', 10);

    const admin = await User.create({ username: 'admin', password: adminPwd, role: 'admin' });
    const alice = await User.create({ username: 'alice', password: userPwd,  role: 'user' });

    await Task.bulkCreate([
        { title: 'Review pull requests',    description: 'Check open PRs on GitHub',         completed: false, userId: admin.id },
        { title: 'Update documentation',    description: 'Keep the README up to date',       completed: false, userId: admin.id },
        { title: 'Buy groceries',           description: 'Milk, eggs, bread',                completed: false, userId: alice.id },
        { title: 'Go for a run',            description: '30-minute jog in the park',        completed: false, userId: alice.id },
        { title: 'Learn Express routing',   description: 'Finish the middleware chapter',    completed: true,  userId: alice.id },
    ]);

    console.log('Database seeded — admin:admin123  alice:alice123');
}

initDb();

// Middleware: Authenticate JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token.' });
        req.user = user;
        next();
    });
};

// Middleware: Admin check
const authorizeAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admins only.' });
    }
    next();
};

// --- ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword, role: 'user' });
        res.status(201).json({ message: 'User registered.' });
    } catch (err) {
        res.status(400).json({ error: 'User registration failed (possibly exists).' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: 'Login error.' });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
    const tasks = await Task.findAll({ where: { userId: req.user.id } });
    res.json(tasks);
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { title, description } = req.body;
        const task = await Task.create({ title, description, userId: req.user.id });
        res.status(201).json(task);
    } catch (err) {
        res.status(400).json({ error: 'Task creation failed.' });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const task = await Task.findOne({ where: { id: req.params.id, userId: req.user.id } });
        if (!task) return res.status(404).json({ error: 'Task not found.' });
        await task.destroy();
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete task.' });
    }
});

app.get('/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
    const users = await User.findAll({ attributes: ['id', 'username', 'role'] });
    res.json(users);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

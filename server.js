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
    process.env.DB_NAME || 'taskdb',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || 'rootpassword',
    {
        host: process.env.DB_HOST || 'localhost',
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
        await sequelize.sync({ alter: true }); // Sync models to DB
        console.log('Database schema synchronized.');
    } catch (err) {
        console.error('Database connection failed:', err.message);
    }
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

app.get('/', (req, res) => {
    res.json({ message: 'Task App API (MySQL)' });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({ username, password: hashedPassword, role: role === 'admin' ? 'admin' : 'user' });
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

app.get('/admin/users', authenticateToken, authorizeAdmin, async (req, res) => {
    const users = await User.findAll({ attributes: ['id', 'username', 'role'] });
    res.json(users);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

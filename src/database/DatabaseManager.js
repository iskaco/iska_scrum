const fs = require('fs');
const path = require('path');
const os = require('os');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.config = null;
    this.configPath = path.join(os.homedir(), '.iska-scrum', 'config.json');
  }

  // Normalize optional values for SQL drivers (convert undefined/empty string to null)
  normalizeOptional(value) {
    return (value === undefined || value === '') ? null : value;
  }

  async initialize() {
    await this.loadConfig();
    await this.connect();
    await this.createTables();
  }

  async loadConfig() {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(configData);
      } else {
        // Default configuration
        this.config = {
          type: 'sqlite',
          sqlite: {
            path: path.join(os.homedir(), '.iska-scrum', 'scrum.db')
          },
          mysql: {
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '',
            database: 'iska_scrum'
          },
          postgresql: {
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: '',
            database: 'iska_scrum'
          }
        };
        await this.saveConfig(this.config);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      throw error;
    }
  }

  async saveConfig(config) {
    this.config = config;
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    return true;
  }

  async getConfig() {
    return this.config;
  }

  async connect() {
    try {
      const { type } = this.config;
      
      switch (type) {
        case 'sqlite':
          const sqlite3 = require('sqlite3').verbose();
          const dbPath = this.config.sqlite.path;
          const dbDir = path.dirname(dbPath);
          if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
          }
          this.db = new sqlite3.Database(dbPath);
          break;
          
        case 'mysql':
          const mysql = require('mysql2/promise');
          this.db = await mysql.createConnection(this.config.mysql);
          break;
          
        case 'postgresql':
          const { Pool } = require('pg');
          this.db = new Pool(this.config.postgresql);
          break;
          
        default:
          throw new Error(`Unsupported database type: ${type}`);
      }
      
      return true;
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }

  async testConnection(config) {
    try {
      const { type } = config;
      let testDb;
      
      switch (type) {
        case 'sqlite':
          const sqlite3 = require('sqlite3').verbose();
          testDb = new sqlite3.Database(config.sqlite.path);
          testDb.close();
          break;
          
        case 'mysql':
          const mysql = require('mysql2/promise');
          testDb = await mysql.createConnection(config.mysql);
          await testDb.end();
          break;
          
        case 'postgresql':
          const { Pool } = require('pg');
          testDb = new Pool(config.postgresql);
          await testDb.end();
          break;
          
        default:
          throw new Error(`Unsupported database type: ${type}`);
      }
      
      return { success: true, message: 'اتصال موفقیت‌آمیز بود' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async createTables() {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.createSQLiteTables();
    } else if (type === 'mysql') {
      await this.createMySQLTables();
    } else if (type === 'postgresql') {
      await this.createPostgreSQLTables();
    }
  }

  async createSQLiteTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'member',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'medium',
        created_by INTEGER,
        assigned_to INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        assigned_to INTEGER,
        due_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS subtasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        assigned_to INTEGER,
        due_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration_seconds INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ];

    for (const table of tables) {
      await this.runSQLiteQuery(table);
    }
  }

  async createMySQLTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS issues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(50) DEFAULT 'medium',
        created_by INT,
        assigned_to INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'medium',
        assigned_to INT,
        due_date DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS subtasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        assigned_to INT,
        due_date DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS time_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration_seconds INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ];

    for (const table of tables) {
      await this.db.execute(table);
    }
  }

  async createPostgreSQLTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS issues (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(50) DEFAULT 'medium',
        created_by INTEGER,
        assigned_to INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        issue_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'medium',
        assigned_to INTEGER,
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS subtasks (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        assigned_to INTEGER,
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS time_entries (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration_seconds INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`
    ];

    for (const table of tables) {
      await this.db.query(table);
    }
  }

  // Time tracking methods
  async startTaskTimer(taskId, userId) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const MM = String(now.getMinutes()).padStart(2, '0');
    const SS = String(now.getSeconds()).padStart(2, '0');
    const nowSql = `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
    const { type } = this.config;
    // Ensure no active timer for this user+task
    await this.stopActiveTimerIfAny(taskId, userId);
    if (type === 'sqlite') {
      const result = await this.runSQLiteQuery('INSERT INTO time_entries (task_id, user_id, start_time) VALUES (?, ?, ?)', [taskId, userId, nowSql]);
      return { id: result.lastID, task_id: taskId, user_id: userId, start_time: nowSql };
    } else if (type === 'mysql') {
      const [result] = await this.db.execute('INSERT INTO time_entries (task_id, user_id, start_time) VALUES (?, ?, ?)', [taskId, userId, nowSql]);
      return { id: result.insertId, task_id: taskId, user_id: userId, start_time: nowSql };
    } else if (type === 'postgresql') {
      const res = await this.db.query('INSERT INTO time_entries (task_id, user_id, start_time) VALUES ($1, $2, $3) RETURNING id', [taskId, userId, nowSql]);
      return { id: res.rows[0].id, task_id: taskId, user_id: userId, start_time: nowSql };
    }
  }

  async stopTaskTimer(taskId, userId) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const MM = String(now.getMinutes()).padStart(2, '0');
    const SS = String(now.getSeconds()).padStart(2, '0');
    const nowSql = `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
    const { type } = this.config;
    const active = await this.getActiveTimer(taskId, userId);
    if (!active) return { success: true, message: 'no active timer' };
    const durationSeconds = Math.max(0, Math.floor((new Date(nowSql) - new Date(active.start_time)) / 1000));
    if (type === 'sqlite') {
      await this.runSQLiteQuery('UPDATE time_entries SET end_time = ?, duration_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nowSql, durationSeconds, active.id]);
    } else if (type === 'mysql') {
      await this.db.execute('UPDATE time_entries SET end_time = ?, duration_seconds = ? WHERE id = ?', [nowSql, durationSeconds, active.id]);
    } else if (type === 'postgresql') {
      await this.db.query('UPDATE time_entries SET end_time = $1, duration_seconds = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [nowSql, durationSeconds, active.id]);
    }
    return { success: true };
  }

  async stopActiveTimerIfAny(taskId, userId) {
    const active = await this.getActiveTimer(taskId, userId);
    if (active) {
      await this.stopTaskTimer(taskId, userId);
    }
  }

  async getActiveTimer(taskId, userId) {
    const { type } = this.config;
    if (type === 'sqlite') {
      const rows = await this.getSQLiteQuery('SELECT * FROM time_entries WHERE task_id = ? AND user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1', [taskId, userId]);
      return rows[0] || null;
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute('SELECT * FROM time_entries WHERE task_id = ? AND user_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1', [taskId, userId]);
      return rows[0] || null;
    } else if (type === 'postgresql') {
      const res = await this.db.query('SELECT * FROM time_entries WHERE task_id = $1 AND user_id = $2 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1', [taskId, userId]);
      return res.rows[0] || null;
    }
  }

  async getTaskTotalTime(taskId) {
    const { type } = this.config;
    if (type === 'sqlite') {
      const rows = await this.getSQLiteQuery('SELECT COALESCE(SUM(duration_seconds),0) as total FROM time_entries WHERE task_id = ?', [taskId]);
      return rows[0]?.total || 0;
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute('SELECT COALESCE(SUM(duration_seconds),0) as total FROM time_entries WHERE task_id = ?', [taskId]);
      return rows[0]?.total || 0;
    } else if (type === 'postgresql') {
      const res = await this.db.query('SELECT COALESCE(SUM(duration_seconds),0) as total FROM time_entries WHERE task_id = $1', [taskId]);
      return Number(res.rows[0]?.total || 0);
    }
  }

  async getUserTimeReport(userId, fromIso, toIso) {
    const { type } = this.config;
    if (type === 'sqlite') {
      return await this.getSQLiteQuery('SELECT * FROM time_entries WHERE user_id = ? AND start_time >= ? AND (end_time <= ? OR end_time IS NULL)', [userId, fromIso, toIso]);
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute('SELECT * FROM time_entries WHERE user_id = ? AND start_time >= ? AND (end_time <= ? OR end_time IS NULL)', [userId, fromIso.replace('T', ' ').slice(0, 19), toIso.replace('T', ' ').slice(0, 19)]);
      return rows;
    } else if (type === 'postgresql') {
      const res = await this.db.query('SELECT * FROM time_entries WHERE user_id = $1 AND start_time >= $2 AND (end_time <= $3 OR end_time IS NULL)', [userId, fromIso, toIso]);
      return res.rows;
    }
  }

  async getTasksByProject(projectId) {
    const { type } = this.config;
    if (type === 'sqlite') {
      return await this.getSQLiteQuery(`
        SELECT t.*, u.name as assigned_to_name
        FROM tasks t
        JOIN issues i ON t.issue_id = i.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE i.project_id = ?
        ORDER BY t.created_at DESC
      `, [projectId]);
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute(`
        SELECT t.*, u.name as assigned_to_name
        FROM tasks t
        JOIN issues i ON t.issue_id = i.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE i.project_id = ?
        ORDER BY t.created_at DESC
      `, [projectId]);
      return rows;
    } else if (type === 'postgresql') {
      const res = await this.db.query(`
        SELECT t.*, u.name as assigned_to_name
        FROM tasks t
        JOIN issues i ON t.issue_id = i.id
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE i.project_id = $1
        ORDER BY t.created_at DESC
      `, [projectId]);
      return res.rows;
    }
  }

  // Helper methods for SQLite
  runSQLiteQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  getSQLiteQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // User management methods
  async getUsers() {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      return await this.getSQLiteQuery('SELECT * FROM users ORDER BY created_at DESC');
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute('SELECT * FROM users ORDER BY created_at DESC');
      return rows;
    } else if (type === 'postgresql') {
      const result = await this.db.query('SELECT * FROM users ORDER BY created_at DESC');
      return result.rows;
    }
  }

  async createUser(userData) {
    const { name, email, role = 'member' } = userData;
    const { type } = this.config;
    
    if (type === 'sqlite') {
      const result = await this.runSQLiteQuery('INSERT INTO users (name, email, role) VALUES (?, ?, ?)', [name, email, role]);
      return { id: result.lastID, name, email, role };
    } else if (type === 'mysql') {
      const [result] = await this.db.execute('INSERT INTO users (name, email, role) VALUES (?, ?, ?)', [name, email, role]);
      return { id: result.insertId, name, email, role };
    } else if (type === 'postgresql') {
      const result = await this.db.query('INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING id', [name, email, role]);
      return { id: result.rows[0].id, name, email, role };
    }
  }

  async updateUser(userId, userData) {
    const { name, email, role } = userData;
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('UPDATE users SET name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, email, role, userId]);
    } else if (type === 'mysql') {
      await this.db.execute('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, userId]);
    } else if (type === 'postgresql') {
      await this.db.query('UPDATE users SET name = $1, email = $2, role = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4', [name, email, role, userId]);
    }
    
    return { success: true };
  }

  async deleteUser(userId) {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('DELETE FROM users WHERE id = ?', [userId]);
    } else if (type === 'mysql') {
      await this.db.execute('DELETE FROM users WHERE id = ?', [userId]);
    } else if (type === 'postgresql') {
      await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    
    return { success: true };
  }

  // Project management methods
  async getProjects() {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      return await this.getSQLiteQuery('SELECT * FROM projects ORDER BY created_at DESC');
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute('SELECT * FROM projects ORDER BY created_at DESC');
      return rows;
    } else if (type === 'postgresql') {
      const result = await this.db.query('SELECT * FROM projects ORDER BY created_at DESC');
      return result.rows;
    }
  }

  async createProject(projectData) {
    const { name, description, status = 'active' } = projectData;
    const { type } = this.config;
    
    if (type === 'sqlite') {
      const result = await this.runSQLiteQuery('INSERT INTO projects (name, description, status) VALUES (?, ?, ?)', [name, description, status]);
      return { id: result.lastID, name, description, status };
    } else if (type === 'mysql') {
      const [result] = await this.db.execute('INSERT INTO projects (name, description, status) VALUES (?, ?, ?)', [name, description, status]);
      return { id: result.insertId, name, description, status };
    } else if (type === 'postgresql') {
      const result = await this.db.query('INSERT INTO projects (name, description, status) VALUES ($1, $2, $3) RETURNING id', [name, description, status]);
      return { id: result.rows[0].id, name, description, status };
    }
  }

  async updateProject(projectId, projectData) {
    const { name, description, status } = projectData;
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('UPDATE projects SET name = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, description, status, projectId]);
    } else if (type === 'mysql') {
      await this.db.execute('UPDATE projects SET name = ?, description = ?, status = ? WHERE id = ?', [name, description, status, projectId]);
    } else if (type === 'postgresql') {
      await this.db.query('UPDATE projects SET name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4', [name, description, status, projectId]);
    }
    
    return { success: true };
  }

  async deleteProject(projectId) {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('DELETE FROM projects WHERE id = ?', [projectId]);
    } else if (type === 'mysql') {
      await this.db.execute('DELETE FROM projects WHERE id = ?', [projectId]);
    } else if (type === 'postgresql') {
      await this.db.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    
    return { success: true };
  }

  // Issue management methods
  async getIssues(projectId) {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      return await this.getSQLiteQuery(`
        SELECT i.*, u1.name as created_by_name, u2.name as assigned_to_name 
        FROM issues i 
        LEFT JOIN users u1 ON i.created_by = u1.id 
        LEFT JOIN users u2 ON i.assigned_to = u2.id 
        WHERE i.project_id = ? 
        ORDER BY i.created_at DESC
      `, [projectId]);
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute(`
        SELECT i.*, u1.name as created_by_name, u2.name as assigned_to_name 
        FROM issues i 
        LEFT JOIN users u1 ON i.created_by = u1.id 
        LEFT JOIN users u2 ON i.assigned_to = u2.id 
        WHERE i.project_id = ? 
        ORDER BY i.created_at DESC
      `, [projectId]);
      return rows;
    } else if (type === 'postgresql') {
      const result = await this.db.query(`
        SELECT i.*, u1.name as created_by_name, u2.name as assigned_to_name 
        FROM issues i 
        LEFT JOIN users u1 ON i.created_by = u1.id 
        LEFT JOIN users u2 ON i.assigned_to = u2.id 
        WHERE i.project_id = $1 
        ORDER BY i.created_at DESC
      `, [projectId]);
      return result.rows;
    }
  }

  async createIssue(issueData) {
    const { project_id, title, description, status = 'open', priority = 'medium', created_by, assigned_to } = issueData;
    const { type } = this.config;
    const pid = Number(project_id);
    const desc = this.normalizeOptional(description);
    const creator = this.normalizeOptional(created_by);
    const assignee = this.normalizeOptional(assigned_to);
    
    if (type === 'sqlite') {
      const result = await this.runSQLiteQuery('INSERT INTO issues (project_id, title, description, status, priority, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)', [pid, title, desc, status, priority, creator, assignee]);
      return { id: result.lastID, project_id: pid, title, description: desc, status, priority, created_by: creator, assigned_to: assignee };
    } else if (type === 'mysql') {
      const [result] = await this.db.execute('INSERT INTO issues (project_id, title, description, status, priority, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)', [pid, title, desc, status, priority, creator, assignee]);
      return { id: result.insertId, project_id: pid, title, description: desc, status, priority, created_by: creator, assigned_to: assignee };
    } else if (type === 'postgresql') {
      const result = await this.db.query('INSERT INTO issues (project_id, title, description, status, priority, created_by, assigned_to) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [pid, title, desc, status, priority, creator, assignee]);
      return { id: result.rows[0].id, project_id: pid, title, description: desc, status, priority, created_by: creator, assigned_to: assignee };
    }
  }

  async updateIssue(issueId, issueData) {
    const { title, description, status, priority, assigned_to } = issueData;
    const { type } = this.config;
    const desc = this.normalizeOptional(description);
    const assignee = this.normalizeOptional(assigned_to);
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('UPDATE issues SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, desc, status, priority, assignee, issueId]);
    } else if (type === 'mysql') {
      await this.db.execute('UPDATE issues SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ? WHERE id = ?', [title, desc, status, priority, assignee, issueId]);
    } else if (type === 'postgresql') {
      await this.db.query('UPDATE issues SET title = $1, description = $2, status = $3, priority = $4, assigned_to = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6', [title, desc, status, priority, assignee, issueId]);
    }
    
    return { success: true };
  }

  async deleteIssue(issueId) {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('DELETE FROM issues WHERE id = ?', [issueId]);
    } else if (type === 'mysql') {
      await this.db.execute('DELETE FROM issues WHERE id = ?', [issueId]);
    } else if (type === 'postgresql') {
      await this.db.query('DELETE FROM issues WHERE id = $1', [issueId]);
    }
    
    return { success: true };
  }

  // Task management methods
  async getTasks(issueId) {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      return await this.getSQLiteQuery(`
        SELECT t.*, u.name as assigned_to_name 
        FROM tasks t 
        LEFT JOIN users u ON t.assigned_to = u.id 
        WHERE t.issue_id = ? 
        ORDER BY t.created_at DESC
      `, [issueId]);
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute(`
        SELECT t.*, u.name as assigned_to_name 
        FROM tasks t 
        LEFT JOIN users u ON t.assigned_to = u.id 
        WHERE t.issue_id = ? 
        ORDER BY t.created_at DESC
      `, [issueId]);
      return rows;
    } else if (type === 'postgresql') {
      const result = await this.db.query(`
        SELECT t.*, u.name as assigned_to_name 
        FROM tasks t 
        LEFT JOIN users u ON t.assigned_to = u.id 
        WHERE t.issue_id = $1 
        ORDER BY t.created_at DESC
      `, [issueId]);
      return result.rows;
    }
  }

  async createTask(taskData) {
    const { issue_id, title, description, status = 'pending', priority = 'medium', assigned_to, due_date } = taskData;
    const { type } = this.config;
    
    if (type === 'sqlite') {
      const result = await this.runSQLiteQuery('INSERT INTO tasks (issue_id, title, description, status, priority, assigned_to, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)', [issue_id, title, description, status, priority, assigned_to, due_date]);
      return { id: result.lastID, issue_id, title, description, status, priority, assigned_to, due_date };
    } else if (type === 'mysql') {
      const [result] = await this.db.execute('INSERT INTO tasks (issue_id, title, description, status, priority, assigned_to, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)', [issue_id, title, description, status, priority, assigned_to, due_date]);
      return { id: result.insertId, issue_id, title, description, status, priority, assigned_to, due_date };
    } else if (type === 'postgresql') {
      const result = await this.db.query('INSERT INTO tasks (issue_id, title, description, status, priority, assigned_to, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [issue_id, title, description, status, priority, assigned_to, due_date]);
      return { id: result.rows[0].id, issue_id, title, description, status, priority, assigned_to, due_date };
    }
  }

  async updateTask(taskId, taskData) {
    const { title, description, status, priority, assigned_to, due_date } = taskData;
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, description, status, priority, assigned_to, due_date, taskId]);
    } else if (type === 'mysql') {
      await this.db.execute('UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ?, due_date = ? WHERE id = ?', [title, description, status, priority, assigned_to, due_date, taskId]);
    } else if (type === 'postgresql') {
      await this.db.query('UPDATE tasks SET title = $1, description = $2, status = $3, priority = $4, assigned_to = $5, due_date = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7', [title, description, status, priority, assigned_to, due_date, taskId]);
    }
    
    return { success: true };
  }

  async deleteTask(taskId) {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('DELETE FROM tasks WHERE id = ?', [taskId]);
    } else if (type === 'mysql') {
      await this.db.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    } else if (type === 'postgresql') {
      await this.db.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    }
    
    return { success: true };
  }

  // Subtask management methods
  async getSubtasks(taskId) {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      return await this.getSQLiteQuery(`
        SELECT s.*, u.name as assigned_to_name 
        FROM subtasks s 
        LEFT JOIN users u ON s.assigned_to = u.id 
        WHERE s.task_id = ? 
        ORDER BY s.created_at DESC
      `, [taskId]);
    } else if (type === 'mysql') {
      const [rows] = await this.db.execute(`
        SELECT s.*, u.name as assigned_to_name 
        FROM subtasks s 
        LEFT JOIN users u ON s.assigned_to = u.id 
        WHERE s.task_id = ? 
        ORDER BY s.created_at DESC
      `, [taskId]);
      return rows;
    } else if (type === 'postgresql') {
      const result = await this.db.query(`
        SELECT s.*, u.name as assigned_to_name 
        FROM subtasks s 
        LEFT JOIN users u ON s.assigned_to = u.id 
        WHERE s.task_id = $1 
        ORDER BY s.created_at DESC
      `, [taskId]);
      return result.rows;
    }
  }

  async createSubtask(subtaskData) {
    const { task_id, title, description, status = 'pending', assigned_to, due_date } = subtaskData;
    const { type } = this.config;
    
    if (type === 'sqlite') {
      const result = await this.runSQLiteQuery('INSERT INTO subtasks (task_id, title, description, status, assigned_to, due_date) VALUES (?, ?, ?, ?, ?, ?)', [task_id, title, description, status, assigned_to, due_date]);
      return { id: result.lastID, task_id, title, description, status, assigned_to, due_date };
    } else if (type === 'mysql') {
      const [result] = await this.db.execute('INSERT INTO subtasks (task_id, title, description, status, assigned_to, due_date) VALUES (?, ?, ?, ?, ?, ?)', [task_id, title, description, status, assigned_to, due_date]);
      return { id: result.insertId, task_id, title, description, status, assigned_to, due_date };
    } else if (type === 'postgresql') {
      const result = await this.db.query('INSERT INTO subtasks (task_id, title, description, status, assigned_to, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [task_id, title, description, status, assigned_to, due_date]);
      return { id: result.rows[0].id, task_id, title, description, status, assigned_to, due_date };
    }
  }

  async updateSubtask(subtaskId, subtaskData) {
    const { title, description, status, assigned_to, due_date } = subtaskData;
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('UPDATE subtasks SET title = ?, description = ?, status = ?, assigned_to = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [title, description, status, assigned_to, due_date, subtaskId]);
    } else if (type === 'mysql') {
      await this.db.execute('UPDATE subtasks SET title = ?, description = ?, status = ?, assigned_to = ?, due_date = ? WHERE id = ?', [title, description, status, assigned_to, due_date, subtaskId]);
    } else if (type === 'postgresql') {
      await this.db.query('UPDATE subtasks SET title = $1, description = $2, status = $3, assigned_to = $4, due_date = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6', [title, description, status, assigned_to, due_date, subtaskId]);
    }
    
    return { success: true };
  }

  async deleteSubtask(subtaskId) {
    const { type } = this.config;
    
    if (type === 'sqlite') {
      await this.runSQLiteQuery('DELETE FROM subtasks WHERE id = ?', [subtaskId]);
    } else if (type === 'mysql') {
      await this.db.execute('DELETE FROM subtasks WHERE id = ?', [subtaskId]);
    } else if (type === 'postgresql') {
      await this.db.query('DELETE FROM subtasks WHERE id = $1', [subtaskId]);
    }
    
    return { success: true };
  }

  async close() {
    if (this.db) {
      if (this.config.type === 'sqlite') {
        this.db.close();
      } else if (this.config.type === 'mysql') {
        await this.db.end();
      } else if (this.config.type === 'postgresql') {
        await this.db.end();
      }
    }
  }
}

module.exports = DatabaseManager;
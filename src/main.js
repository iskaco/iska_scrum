const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const DatabaseManager = require('./database/DatabaseManager');

let mainWindow;
let databaseManager;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Iska Scrum - مدیریت پروژه اسکرام'
  });

  // Load the index.html file
  mainWindow.loadFile('src/renderer/index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'فایل',
      submenu: [
        {
          label: 'تنظیمات دیتابیس',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('open-database-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'خروج',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'پروژه',
      submenu: [
        {
          label: 'پروژه جدید',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('create-new-project');
          }
        },
        {
          label: 'نمای بورد',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            mainWindow.webContents.send('switch-to-board');
          }
        },
        {
          label: 'نمای لیست',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.webContents.send('switch-to-list');
          }
        },
        {
          label: 'مدیریت اعضا',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            mainWindow.webContents.send('open-user-management');
          }
        }
      ]
    },
    {
      label: 'کمک',
      submenu: [
        {
          label: 'درباره',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Initialize database manager
async function initializeDatabase() {
  databaseManager = new DatabaseManager();
  await databaseManager.initialize();
}

// IPC handlers
ipcMain.handle('get-database-config', async () => {
  return await databaseManager.getConfig();
});

ipcMain.handle('save-database-config', async (event, config) => {
  return await databaseManager.saveConfig(config);
});

ipcMain.handle('test-database-connection', async (event, config) => {
  return await databaseManager.testConnection(config);
});

ipcMain.handle('get-users', async () => {
  return await databaseManager.getUsers();
});

ipcMain.handle('create-user', async (event, userData) => {
  return await databaseManager.createUser(userData);
});

ipcMain.handle('update-user', async (event, userId, userData) => {
  return await databaseManager.updateUser(userId, userData);
});

ipcMain.handle('delete-user', async (event, userId) => {
  return await databaseManager.deleteUser(userId);
});

ipcMain.handle('get-projects', async () => {
  return await databaseManager.getProjects();
});

ipcMain.handle('create-project', async (event, projectData) => {
  return await databaseManager.createProject(projectData);
});

ipcMain.handle('update-project', async (event, projectId, projectData) => {
  return await databaseManager.updateProject(projectId, projectData);
});

ipcMain.handle('delete-project', async (event, projectId) => {
  return await databaseManager.deleteProject(projectId);
});

ipcMain.handle('get-issues', async (event, projectId) => {
  return await databaseManager.getIssues(projectId);
});

ipcMain.handle('create-issue', async (event, issueData) => {
  return await databaseManager.createIssue(issueData);
});

ipcMain.handle('update-issue', async (event, issueId, issueData) => {
  return await databaseManager.updateIssue(issueId, issueData);
});

ipcMain.handle('delete-issue', async (event, issueId) => {
  return await databaseManager.deleteIssue(issueId);
});

ipcMain.handle('get-tasks', async (event, issueId) => {
  return await databaseManager.getTasks(issueId);
});

ipcMain.handle('create-task', async (event, taskData) => {
  return await databaseManager.createTask(taskData);
});

ipcMain.handle('update-task', async (event, taskId, taskData) => {
  return await databaseManager.updateTask(taskId, taskData);
});

ipcMain.handle('delete-task', async (event, taskId) => {
  return await databaseManager.deleteTask(taskId);
});

ipcMain.handle('get-subtasks', async (event, taskId) => {
  return await databaseManager.getSubtasks(taskId);
});

ipcMain.handle('create-subtask', async (event, subtaskData) => {
  return await databaseManager.createSubtask(subtaskData);
});

ipcMain.handle('update-subtask', async (event, subtaskId, subtaskData) => {
  return await databaseManager.updateSubtask(subtaskId, subtaskData);
});

ipcMain.handle('delete-subtask', async (event, subtaskId) => {
  return await databaseManager.deleteSubtask(subtaskId);
});

// Tasks by project (for task board)
ipcMain.handle('get-project-tasks', async (event, projectId) => {
  return await databaseManager.getTasksByProject(projectId);
});

// Time tracking
ipcMain.handle('start-task-timer', async (event, taskId, userId) => {
  return await databaseManager.startTaskTimer(taskId, userId);
});

ipcMain.handle('stop-task-timer', async (event, taskId, userId) => {
  return await databaseManager.stopTaskTimer(taskId, userId);
});

ipcMain.handle('get-task-total-time', async (event, taskId) => {
  return await databaseManager.getTaskTotalTime(taskId);
});

ipcMain.handle('get-user-time-report', async (event, userId, fromIso, toIso) => {
  return await databaseManager.getUserTimeReport(userId, fromIso, toIso);
});

ipcMain.handle('get-user-total-time-today', async (event, userId) => {
  return await databaseManager.getUserTotalTimeToday(userId);
});

// App event handlers
app.whenReady().then(async () => {
  await initializeDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (databaseManager) {
    await databaseManager.close();
  }
});

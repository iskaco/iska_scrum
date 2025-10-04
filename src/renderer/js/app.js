const { ipcRenderer } = require('electron');

class ScrumApp {
    constructor() {
        this.currentProject = null;
        this.currentIssue = null;
        this.currentTask = null;
        this.users = [];
        this.projects = [];
        this.issues = [];
        this.tasks = [];
        this.subtasks = [];
        this.currentView = 'list'; // 'list' or 'board'
        this.activeTaskTimer = null; // {taskId, startMs}
        
        this.initializeApp();
    }

    async initializeApp() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.showWelcomeScreen();
        // Respond to menu events
        ipcRenderer.on('switch-to-board', () => {
            if (this.currentProject) {
                this.switchView('board');
            }
        });
        ipcRenderer.on('switch-to-list', () => {
            if (this.currentProject) {
                this.switchView('list');
            }
        });
    }

    setupEventListeners() {
        // Header buttons
        document.getElementById('newProjectBtn').addEventListener('click', () => this.showProjectModal());
        document.getElementById('manageUsersBtn').addEventListener('click', () => this.showUserManagementModal());
        document.getElementById('databaseSettingsBtn').addEventListener('click', () => this.showDatabaseSettingsModal());
        document.getElementById('createFirstProjectBtn').addEventListener('click', () => this.showProjectModal());

        // Project modal
        document.getElementById('closeProjectModal').addEventListener('click', () => this.hideProjectModal());
        document.getElementById('cancelProjectBtn').addEventListener('click', () => this.hideProjectModal());
        document.getElementById('projectForm').addEventListener('submit', (e) => this.handleProjectSubmit(e));

        // User management modal
        document.getElementById('closeUserModal').addEventListener('click', () => this.hideUserManagementModal());
        document.getElementById('addUserBtn').addEventListener('click', () => this.showUserModal());
        document.getElementById('closeUserFormModal').addEventListener('click', () => this.hideUserModal());
        document.getElementById('cancelUserBtn').addEventListener('click', () => this.hideUserModal());
        document.getElementById('userForm').addEventListener('submit', (e) => this.handleUserSubmit(e));

        // Issue modal
        document.getElementById('closeIssueModal').addEventListener('click', () => this.hideIssueModal());
        document.getElementById('cancelIssueBtn').addEventListener('click', () => this.hideIssueModal());
        document.getElementById('issueForm').addEventListener('submit', (e) => this.handleIssueSubmit(e));

        // Database settings modal
        document.getElementById('closeDatabaseModal').addEventListener('click', () => this.hideDatabaseSettingsModal());
        document.getElementById('dbType').addEventListener('change', (e) => this.handleDatabaseTypeChange(e));
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testDatabaseConnection());
        document.getElementById('databaseForm').addEventListener('submit', (e) => this.handleDatabaseSubmit(e));

        // New issue button
        document.getElementById('newIssueBtn').addEventListener('click', () => this.showIssueModal());

        // View toggle buttons
        document.getElementById('listViewBtn').addEventListener('click', () => this.switchView('list'));
        document.getElementById('boardViewBtn').addEventListener('click', () => this.switchView('board'));

        // Task modal
        document.getElementById('closeTaskModal').addEventListener('click', () => this.hideTaskModal());
        document.getElementById('cancelTaskBtn').addEventListener('click', () => this.hideTaskModal());
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSubmit(e));

        // Subtask modal
        document.getElementById('closeSubtaskModal').addEventListener('click', () => this.hideSubtaskModal());
        document.getElementById('cancelSubtaskBtn').addEventListener('click', () => this.hideSubtaskModal());
        document.getElementById('subtaskForm').addEventListener('submit', (e) => this.handleSubtaskSubmit(e));

        // Initialize Jalali datepickers when modals open
        document.getElementById('taskModal').addEventListener('click', () => this.initJalaliPickers());
        document.getElementById('subtaskModal').addEventListener('click', () => this.initJalaliPickers());

        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    initJalaliPickers() {
        // Use Flatpickr with Jalali plugin
        if (typeof flatpickr === 'undefined') return;
        if (typeof window.jalali === 'function') {
            try { window.jalali(flatpickr); } catch {}
        }
        const initOne = (inputId, hiddenId) => {
            const input = document.getElementById(inputId);
            const hidden = document.getElementById(hiddenId);
            if (!input) return;
            if (input._flatpickr) return;
            flatpickr.localize(flatpickr.l10ns.fa || {});
            flatpickr(input, {
                enableTime: true,
                dateFormat: 'Y/m/d H:i',
                altInput: true,
                altFormat: 'Y/m/d H:i',
                locale: flatpickr.l10ns.fa,
                onChange: function(selectedDates) {
                    if (!hidden) return;
                    const d = selectedDates && selectedDates[0];
                    if (!d) { hidden.value = ''; return; }
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const HH = String(d.getHours()).padStart(2, '0');
                    const MM = String(d.getMinutes()).padStart(2, '0');
                    hidden.value = `${yyyy}-${mm}-${dd} ${HH}:${MM}:00`;
                }
            });
        };
        initOne('taskDueDate', 'taskDueDateGregorian');
        initOne('subtaskDueDate', 'subtaskDueDateGregorian');
    }

    async loadInitialData() {
        try {
            this.showLoading();
            this.users = await ipcRenderer.invoke('get-users');
            this.projects = await ipcRenderer.invoke('get-projects');
            this.hideLoading();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('خطا در بارگذاری داده‌ها', 'error');
            this.hideLoading();
        }
    }

    showWelcomeScreen() {
        document.getElementById('welcomeScreen').style.display = 'block';
        document.getElementById('projectView').style.display = 'none';
        this.renderProjectsList();
    }

    showProjectView(project) {
        this.currentProject = project;
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('projectView').style.display = 'block';
        document.getElementById('projectTitle').textContent = project.name;
        this.loadProjectIssues();
        this.switchView('list'); // Default to list view
        this.renderTeamTimePanel();
    }

    async loadProjectIssues() {
        try {
            this.showLoading();
            this.issues = await ipcRenderer.invoke('get-issues', this.currentProject.id);
            this.projectTasks = null; // Reset project tasks cache
            if (this.currentView === 'board') {
                this.renderKanbanBoard();
                this.renderTaskBoard();
            } else {
                await this.renderIssuesList();
            }
            this.renderTeamTimePanel();
            this.hideLoading();
        } catch (error) {
            console.error('Error loading issues:', error);
            this.showNotification('خطا در بارگذاری ایشوها', 'error');
            this.hideLoading();
        }
    }

    renderProjectsList() {
        const projectsList = document.getElementById('projectsList');
        projectsList.innerHTML = '';

        if (this.projects.length === 0) {
            projectsList.innerHTML = '<p class="text-center" style="color: #718096;">هیچ پروژه‌ای وجود ندارد</p>';
            return;
        }

        this.projects.forEach(project => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.innerHTML = `
                <h4>${project.name}</h4>
                <p>${project.description || 'بدون توضیحات'}</p>
                <small>وضعیت: ${this.getStatusText(project.status)}</small>
            `;
            projectItem.addEventListener('click', () => this.showProjectView(project));
            projectsList.appendChild(projectItem);
        });
    }

    async renderIssuesList() {
        const issuesList = document.getElementById('issuesList');
        issuesList.innerHTML = '';

        if (this.issues.length === 0) {
            issuesList.innerHTML = '<p class="text-center" style="color: #718096;">هیچ ایشویی وجود ندارد</p>';
            return;
        }

        for (const issue of this.issues) {
            const issueCard = document.createElement('div');
            issueCard.className = 'issue-card';
            
            // Load tasks for this issue
            const tasks = await this.loadIssueTasks(issue.id);
            
            issueCard.innerHTML = `
                <div class="issue-header">
                    <div>
                        <h3 class="issue-title">${issue.title}</h3>
                        <div class="issue-meta">
                            <span class="issue-priority priority-${issue.priority}">${this.getPriorityText(issue.priority)}</span>
                            <span class="issue-status status-${issue.status}">${this.getStatusText(issue.status)}</span>
                            ${issue.assigned_to_name ? `<span>واگذار شده به: ${issue.assigned_to_name}</span>` : ''}
                        </div>
                    </div>
                    <div class="issue-actions">
                        <button class="btn btn-secondary" onclick="app.showIssueModal(${JSON.stringify(issue).replace(/"/g, '&quot;')})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-primary" onclick="app.showTaskModal(null, ${issue.id})">
                            <i class="fas fa-plus"></i> تسک
                        </button>
                    </div>
                </div>
                <div class="issue-description">${issue.description || 'بدون توضیحات'}</div>
                <div class="issue-assignee">
                    ایجاد شده توسط: ${issue.created_by_name || 'نامشخص'}
                </div>
                ${tasks.length > 0 ? this.renderTasksSection(tasks) : ''}
            `;
            issuesList.appendChild(issueCard);
        }
    }

    renderTasksSection(tasks) {
        let html = `
            <div class="tasks-section">
                <div class="tasks-header">
                    <h4>تسک‌ها (${tasks.length})</h4>
                </div>
        `;

        tasks.forEach(task => {
            const taskId = task.id;
            html += `
                <div class="task-item" id="task-${taskId}">
                    <div class="task-header">
                        <div class="task-title">${task.title}</div>
                        <div class="task-actions">
                            <button class="btn btn-secondary" onclick="app.showTaskModal(${JSON.stringify(task).replace(/"/g, '&quot;')})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-primary" onclick="app.showSubtaskModal(null, ${taskId})">
                                <i class="fas fa-plus"></i> زیرتسک
                            </button>
                            <button class="btn" title="تایمر" ${'${task.status !== \'in_progress\' ? \"disabled\" : \"\"}'} onclick="app.toggleTaskTimer(${taskId})">
                                <i class="fas fa-clock"></i>
                            </button>
                            <button class="btn btn-danger" onclick="app.deleteTask(${taskId})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="task-meta">
                        <span class="task-priority priority-${task.priority}">${this.getPriorityText(task.priority)}</span>
                        <span class="task-status status-${task.status}">${this.getStatusText(task.status)}</span>
                        ${task.assigned_to_name ? `<span class="task-assignee">${task.assigned_to_name}</span>` : ''}
                        <span class="task-assignee" id="task-time-${taskId}">زمان: —</span>
                    </div>
                    <div class="task-description">${task.description || 'بدون توضیحات'}</div>
                    ${task.due_date ? `<div class="task-due-date">سررسید: ${new Date(task.due_date).toLocaleDateString('fa-IR')}</div>` : ''}
                    <div class="subtasks-section" id="subtasks-${taskId}"></div>
                </div>
            `;
        });

        html += '</div>';

        setTimeout(() => {
            this.populateTasksExtras(tasks);
        }, 0);

        return html;
    }

    async populateTasksExtras(tasks) {
        for (const task of tasks) {
            try {
                const [subs, totalSec] = await Promise.all([
                    ipcRenderer.invoke('get-subtasks', task.id),
                    ipcRenderer.invoke('get-task-total-time', task.id)
                ]);
                const subsEl = document.getElementById(`subtasks-${task.id}`);
                if (subsEl) subsEl.innerHTML = this.renderSubtasks(subs);
                const timeEl = document.getElementById(`task-time-${task.id}`);
                if (timeEl) timeEl.textContent = `زمان: ${this.formatDuration(totalSec)}`;
            } catch {}
        }
    }

    renderSubtasks(subtasks) {
        if (!subtasks || subtasks.length === 0) return '';
        let html = '';
        subtasks.forEach(st => {
            html += `
                <div class="subtask-item">
                    <div class="subtask-header">
                        <div class="subtask-title">${st.title}</div>
                        <div class="subtask-actions">
                            <button class="btn btn-secondary" onclick="app.showSubtaskModal(${JSON.stringify(st).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger" onclick="app.deleteSubtask(${st.id})"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="subtask-meta">
                        <span class="subtask-status status-${st.status}">${this.getStatusText(st.status)}</span>
                        ${st.assigned_to_name ? `<span class="subtask-assignee">${st.assigned_to_name}</span>` : ''}
                    </div>
                    <div class="subtask-description">${st.description || ''}</div>
                </div>
            `;
        });
        return html;
    }

    formatDuration(totalSeconds) {
        const s = Math.max(0, Number(totalSeconds || 0));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        const mm = String(m).padStart(2, '0');
        const ss = String(sec).padStart(2, '0');
        return `${h}:${mm}:${ss}`;
    }

    // Project Management
    showProjectModal(project = null) {
        this.currentProject = project;
        const modal = document.getElementById('projectModal');
        const title = document.getElementById('projectModalTitle');
        const form = document.getElementById('projectForm');
        
        if (project) {
            title.textContent = 'ویرایش پروژه';
            form.name.value = project.name;
            form.description.value = project.description || '';
            form.status.value = project.status;
        } else {
            title.textContent = 'پروژه جدید';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    hideProjectModal() {
        document.getElementById('projectModal').style.display = 'none';
    }

    async handleProjectSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const projectData = {
            name: formData.get('name'),
            description: formData.get('description'),
            status: formData.get('status')
        };

        try {
            this.showLoading();
            if (this.currentProject) {
                await ipcRenderer.invoke('update-project', this.currentProject.id, projectData);
                this.showNotification('پروژه با موفقیت به‌روزرسانی شد');
            } else {
                await ipcRenderer.invoke('create-project', projectData);
                this.showNotification('پروژه با موفقیت ایجاد شد');
            }
            
            await this.loadInitialData();
            this.renderProjectsList();
            this.hideProjectModal();
            this.hideLoading();
        } catch (error) {
            console.error('Error saving project:', error);
            this.showNotification('خطا در ذخیره پروژه', 'error');
            this.hideLoading();
        }
    }

    // User Management
    showUserManagementModal() {
        document.getElementById('userManagementModal').style.display = 'block';
        this.renderUsersList();
    }

    hideUserManagementModal() {
        document.getElementById('userManagementModal').style.display = 'none';
    }

    showUserModal(user = null) {
        this.currentUser = user;
        const modal = document.getElementById('userModal');
        const title = document.getElementById('userModalTitle');
        const form = document.getElementById('userForm');
        
        if (user) {
            title.textContent = 'ویرایش عضو';
            form.name.value = user.name;
            form.email.value = user.email;
            form.role.value = user.role;
        } else {
            title.textContent = 'عضو جدید';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    hideUserModal() {
        document.getElementById('userModal').style.display = 'none';
    }

    async handleUserSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            role: formData.get('role')
        };

        try {
            this.showLoading();
            if (this.currentUser) {
                await ipcRenderer.invoke('update-user', this.currentUser.id, userData);
                this.showNotification('عضو با موفقیت به‌روزرسانی شد');
            } else {
                await ipcRenderer.invoke('create-user', userData);
                this.showNotification('عضو با موفقیت اضافه شد');
            }
            
            await this.loadInitialData();
            this.renderUsersList();
            this.hideUserModal();
            this.hideLoading();
        } catch (error) {
            console.error('Error saving user:', error);
            this.showNotification('خطا در ذخیره عضو', 'error');
            this.hideLoading();
        }
    }

    renderUsersList() {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';

        if (this.users.length === 0) {
            usersList.innerHTML = '<p class="text-center" style="color: #718096;">هیچ عضوی وجود ندارد</p>';
            return;
        }

        this.users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.innerHTML = `
                <div class="user-info">
                    <h4>${user.name}</h4>
                    <p>${user.email}</p>
                    <span class="user-role">${this.getRoleText(user.role)}</span>
                </div>
                <div class="user-actions-buttons">
                    <button class="btn btn-secondary" onclick="app.showUserModal(${JSON.stringify(user).replace(/"/g, '&quot;')})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteUser(${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            usersList.appendChild(userItem);
        });
    }

    async deleteUser(userId) {
        if (confirm('آیا مطمئن هستید که می‌خواهید این عضو را حذف کنید؟')) {
            try {
                this.showLoading();
                await ipcRenderer.invoke('delete-user', userId);
                this.showNotification('عضو با موفقیت حذف شد');
                await this.loadInitialData();
                this.renderUsersList();
                this.hideLoading();
            } catch (error) {
                console.error('Error deleting user:', error);
                this.showNotification('خطا در حذف عضو', 'error');
                this.hideLoading();
            }
        }
    }

    // Issue Management
    showIssueModal(issue = null) {
        this.currentIssue = issue;
        const modal = document.getElementById('issueModal');
        const title = document.getElementById('issueModalTitle');
        const form = document.getElementById('issueForm');
        
        if (issue) {
            title.textContent = 'ویرایش ایشو';
            form.title.value = issue.title;
            form.description.value = issue.description || '';
            form.status.value = issue.status;
            form.priority.value = issue.priority;
            form.assigned_to.value = issue.assigned_to || '';
        } else {
            title.textContent = 'ایشو جدید';
            form.reset();
        }
        
        this.populateUserSelect('issueAssignedTo');
        modal.style.display = 'block';
    }

    hideIssueModal() {
        document.getElementById('issueModal').style.display = 'none';
    }

    async handleIssueSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const issueData = {
            project_id: this.currentProject.id,
            title: formData.get('title'),
            description: formData.get('description'),
            status: formData.get('status'),
            priority: formData.get('priority'),
            assigned_to: formData.get('assigned_to') || null
        };

        try {
            this.showLoading();
            if (this.currentIssue) {
                await ipcRenderer.invoke('update-issue', this.currentIssue.id, issueData);
                this.showNotification('ایشو با موفقیت به‌روزرسانی شد');
            } else {
                await ipcRenderer.invoke('create-issue', issueData);
                this.showNotification('ایشو با موفقیت ایجاد شد');
            }
            
            await this.loadProjectIssues();
            this.hideIssueModal();
            this.hideLoading();
        } catch (error) {
            console.error('Error saving issue:', error);
            this.showNotification('خطا در ذخیره ایشو', 'error');
            this.hideLoading();
        }
    }

    // Database Settings
    showDatabaseSettingsModal() {
        document.getElementById('databaseSettingsModal').style.display = 'block';
        this.loadDatabaseConfig();
    }

    hideDatabaseSettingsModal() {
        document.getElementById('databaseSettingsModal').style.display = 'none';
    }

    async loadDatabaseConfig() {
        try {
            const config = await ipcRenderer.invoke('get-database-config');
            document.getElementById('dbType').value = config.type;
            this.handleDatabaseTypeChange({ target: { value: config.type } });
            
            // Populate form fields
            Object.keys(config).forEach(key => {
                if (typeof config[key] === 'object') {
                    Object.keys(config[key]).forEach(subKey => {
                        const input = document.querySelector(`[name="${key}.${subKey}"]`);
                        if (input) {
                            input.value = config[key][subKey];
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Error loading database config:', error);
        }
    }

    handleDatabaseTypeChange(e) {
        const dbType = e.target.value;
        
        // Hide all database settings
        document.querySelectorAll('.db-settings').forEach(settings => {
            settings.style.display = 'none';
        });
        
        // Show relevant settings
        if (dbType === 'sqlite') {
            document.getElementById('sqliteSettings').style.display = 'block';
        } else if (dbType === 'mysql') {
            document.getElementById('mysqlSettings').style.display = 'block';
        } else if (dbType === 'postgresql') {
            document.getElementById('postgresqlSettings').style.display = 'block';
        }
    }

    async testDatabaseConnection() {
        const formData = new FormData(document.getElementById('databaseForm'));
        const config = {
            type: formData.get('type'),
            sqlite: {
                path: formData.get('sqlite.path')
            },
            mysql: {
                host: formData.get('mysql.host'),
                port: parseInt(formData.get('mysql.port')),
                user: formData.get('mysql.user'),
                password: formData.get('mysql.password'),
                database: formData.get('mysql.database')
            },
            postgresql: {
                host: formData.get('postgresql.host'),
                port: parseInt(formData.get('postgresql.port')),
                user: formData.get('postgresql.user'),
                password: formData.get('postgresql.password'),
                database: formData.get('postgresql.database')
            }
        };

        try {
            this.showLoading();
            const result = await ipcRenderer.invoke('test-database-connection', config);
            if (result.success) {
                this.showNotification('اتصال موفقیت‌آمیز بود', 'success');
            } else {
                this.showNotification(`خطا در اتصال: ${result.message}`, 'error');
            }
            this.hideLoading();
        } catch (error) {
            console.error('Error testing connection:', error);
            this.showNotification('خطا در تست اتصال', 'error');
            this.hideLoading();
        }
    }

    async handleDatabaseSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const config = {
            type: formData.get('type'),
            sqlite: {
                path: formData.get('sqlite.path')
            },
            mysql: {
                host: formData.get('mysql.host'),
                port: parseInt(formData.get('mysql.port')),
                user: formData.get('mysql.user'),
                password: formData.get('mysql.password'),
                database: formData.get('mysql.database')
            },
            postgresql: {
                host: formData.get('postgresql.host'),
                port: parseInt(formData.get('postgresql.port')),
                user: formData.get('postgresql.user'),
                password: formData.get('postgresql.password'),
                database: formData.get('postgresql.database')
            }
        };

        try {
            this.showLoading();
            await ipcRenderer.invoke('save-database-config', config);
            this.showNotification('تنظیمات دیتابیس ذخیره شد');
            this.hideDatabaseSettingsModal();
            this.hideLoading();
        } catch (error) {
            console.error('Error saving database config:', error);
            this.showNotification('خطا در ذخیره تنظیمات', 'error');
            this.hideLoading();
        }
    }

    // Utility Methods
    populateUserSelect(selectId) {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">انتخاب کنید...</option>';
        
        this.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            select.appendChild(option);
        });
    }

    getStatusText(status) {
        const statusMap = {
            'active': 'فعال',
            'inactive': 'غیرفعال',
            'completed': 'تکمیل شده',
            'open': 'باز',
            'in_progress': 'در حال انجام',
            'review': 'بررسی',
            'closed': 'بسته',
            'pending': 'در انتظار'
        };
        return statusMap[status] || status;
    }

    getPriorityText(priority) {
        const priorityMap = {
            'low': 'کم',
            'medium': 'متوسط',
            'high': 'زیاد',
            'critical': 'بحرانی'
        };
        return priorityMap[priority] || priority;
    }

    getRoleText(role) {
        const roleMap = {
            'member': 'عضو',
            'admin': 'مدیر',
            'scrum_master': 'اسکرام مستر'
        };
        return roleMap[role] || role;
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const messageElement = document.getElementById('notificationMessage');
        
        messageElement.textContent = message;
        notification.className = `notification ${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    // View Management
    switchView(view) {
        this.currentView = view;
        
        // Update button states
        document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
        document.getElementById('boardViewBtn').classList.toggle('active', view === 'board');
        
        // Show/hide views
        document.getElementById('listView').style.display = view === 'list' ? 'block' : 'none';
        document.getElementById('boardView').style.display = view === 'board' ? 'block' : 'none';
        
        if (view === 'board') {
            this.renderKanbanBoard();
            this.renderTaskBoard();
        } else {
            this.renderIssuesList();
        }
    }

    // Kanban Board
    renderKanbanBoard() {
        const statuses = ['open', 'in_progress', 'review', 'closed'];
        
        statuses.forEach(status => {
            const column = document.getElementById(`${status}Issues`);
            const countElement = document.getElementById(`${status}Count`);
            
            // Clear column
            column.innerHTML = '';
            
            // Filter issues by status
            const statusIssues = this.issues.filter(issue => issue.status === status);
            countElement.textContent = statusIssues.length;
            
            // Render issues in column
            statusIssues.forEach(issue => {
                const card = this.createKanbanCard(issue);
                column.appendChild(card);
            });
        });
        
        // Setup drag and drop
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const columns = document.querySelectorAll('.kanban-column');
        
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });
            
            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                
                const issueId = e.dataTransfer.getData('text/plain');
                const newStatus = column.dataset.status;
                
                // Find the issue and update its status
                const issue = this.issues.find(i => i.id == issueId);
                if (issue && issue.status !== newStatus) {
                    try {
                        this.showLoading();
                        await ipcRenderer.invoke('update-issue', issueId, {
                            ...issue,
                            status: newStatus
                        });
                        
                        // Update local data
                        issue.status = newStatus;
                        
                        // Re-render the board
                        this.renderKanbanBoard();
                        this.showNotification('وضعیت ایشو به‌روزرسانی شد');
                        this.hideLoading();
                    } catch (error) {
                        console.error('Error updating issue status:', error);
                        this.showNotification('خطا در به‌روزرسانی وضعیت', 'error');
                        this.hideLoading();
                    }
                }
            });
        });
    }

    // Task Board
    async renderTaskBoard() {
        const taskStatuses = ['pending', 'in_progress', 'review', 'completed'];
        if (!this.projectTasks) {
            this.projectTasks = await ipcRenderer.invoke('get-project-tasks', this.currentProject.id);
        }
        const ids = {
            pending: 'pendingTasks',
            in_progress: 'inProgressTasks',
            review: 'reviewTasks',
            completed: 'completedTasks'
        };
        const counts = {
            pending: 'pendingTaskCount',
            in_progress: 'inProgressTaskCount',
            review: 'reviewTaskCount',
            completed: 'completedTaskCount'
        };
        taskStatuses.forEach(status => {
            const column = document.getElementById(ids[status]);
            const count = document.getElementById(counts[status]);
            column.innerHTML = '';
            const filtered = this.projectTasks.filter(t => t.status === status);
            count.textContent = filtered.length;
            filtered.forEach(task => {
                const card = this.createTaskCard(task);
                column.appendChild(card);
            });
        });
        this.setupTaskDragAndDrop();
    }

    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.taskId = task.id;
        card.innerHTML = `
            <div class="card-title">${task.title}</div>
            <div class="card-meta">
                <span class="card-priority priority-${task.priority}">${this.getPriorityText(task.priority)}</span>
                ${task.assigned_to_name ? `<span class=\"card-assignee\">${task.assigned_to_name}</span>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn btn-secondary" onclick="app.showTaskModal(${JSON.stringify(task).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-primary" onclick="app.toggleTaskTimer(${task.id})"><i class="fas fa-clock"></i></button>
            </div>
        `;
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', `task:${task.id}`);
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        return card;
    }

    setupTaskDragAndDrop() {
        document.querySelectorAll('[data-task-status]').forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                const data = e.dataTransfer.getData('text/plain');
                if (!data.startsWith('task:')) return;
                const taskId = Number(data.split(':')[1]);
                const newStatus = column.getAttribute('data-task-status');
                const task = this.projectTasks.find(t => t.id === taskId);
                if (task && task.status !== newStatus) {
                    try {
                        this.showLoading();
                        await ipcRenderer.invoke('update-task', taskId, { ...task, status: newStatus });
                        task.status = newStatus;
                        this.renderTaskBoard();
                        this.showNotification('وضعیت تسک به‌روزرسانی شد');
                        this.hideLoading();
                    } catch (err) {
                        console.error(err);
                        this.showNotification('خطا در به‌روزرسانی وضعیت تسک', 'error');
                        this.hideLoading();
                    }
                }
            });
        });
    }

    async toggleTaskTimer(taskId) {
        // For demo, assume current user is the first user if available
        const currentUserId = this.users[0]?.id;
        if (!currentUserId) {
            this.showNotification('ابتدا یک کاربر اضافه کنید', 'warning');
            return;
        }
        // Only allow when task is in progress
        const task = (this.projectTasks || []).find(t => t.id === taskId) || null;
        if (task && task.status !== 'in_progress') {
            this.showNotification('تایمر فقط برای تسک‌های در حال انجام فعال است', 'warning');
            return;
        }
        try {
            // If timer active for this task, stop it
            if (this.activeTaskTimer && this.activeTaskTimer.taskId === taskId) {
                await ipcRenderer.invoke('stop-task-timer', taskId, currentUserId);
                this.activeTaskTimer = null;
                this.showNotification('تایمر متوقف شد');
                this.refreshTaskTime(taskId);
            } else {
                // Stop any active task
                if (this.activeTaskTimer) {
                    await ipcRenderer.invoke('stop-task-timer', this.activeTaskTimer.taskId, currentUserId);
                    this.refreshTaskTime(this.activeTaskTimer.taskId);
                }
                await ipcRenderer.invoke('start-task-timer', taskId, currentUserId);
                this.activeTaskTimer = { taskId, startMs: Date.now() };
                this.showNotification('تایمر شروع شد');
                this.startLiveTimer(taskId);
            }
        } catch (error) {
            console.error('Timer error', error);
            this.showNotification('خطا در مدیریت تایمر', 'error');
        }
    }

    async refreshTaskTime(taskId) {
        try {
            const totalSec = await ipcRenderer.invoke('get-task-total-time', taskId);
            const timeEl = document.getElementById(`task-time-${taskId}`);
            if (timeEl) timeEl.textContent = `زمان: ${this.formatDuration(totalSec)}`;
        } catch {}
    }

    startLiveTimer(taskId) {
        if (this.liveTimerInterval) clearInterval(this.liveTimerInterval);
        const startMs = Date.now();
        this.liveTimerInterval = setInterval(async () => {
            // base total from DB plus current elapsed
            const base = await ipcRenderer.invoke('get-task-total-time', taskId).catch(() => 0);
            const elapsed = Math.floor((Date.now() - startMs) / 1000);
            const timeEl = document.getElementById(`task-time-${taskId}`);
            if (timeEl) timeEl.textContent = `زمان: ${this.formatDuration(Number(base) + elapsed)}`;
            if (!this.activeTaskTimer || this.activeTaskTimer.taskId !== taskId) {
                clearInterval(this.liveTimerInterval);
            }
        }, 1000);
    }

    async renderTeamTimePanel() {
        const panel = document.getElementById('teamTimePanel');
        if (!panel) return;
        if (!this.users || this.users.length === 0) { panel.style.display = 'none'; return; }
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setHours(23,59,59,999);
        const fromIso = start.toISOString();
        const toIso = end.toISOString();
        const items = [];
        for (const user of this.users) {
            try {
                const entries = await ipcRenderer.invoke('get-user-time-report', user.id, fromIso, toIso);
                const total = (entries || []).reduce((sum, e) => sum + Number(e.duration_seconds || 0), 0);
                items.push({ name: user.name, total });
            } catch {}
        }
        if (items.length === 0) { panel.style.display = 'none'; return; }
        panel.innerHTML = items.map(i => `<span class="team-time-chip">${i.name}: ${this.formatDuration(i.total)}</span>`).join(' ');
        panel.style.display = 'flex';
    }

    createKanbanCard(issue) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.issueId = issue.id;
        
        card.innerHTML = `
            <div class="card-title">${issue.title}</div>
            <div class="card-meta">
                <span class="card-priority priority-${issue.priority}">${this.getPriorityText(issue.priority)}</span>
                ${issue.assigned_to_name ? `<span class="card-assignee">${issue.assigned_to_name}</span>` : ''}
            </div>
            <div class="card-description">${issue.description || 'بدون توضیحات'}</div>
            <div class="card-actions">
                <button class="btn btn-secondary" onclick="app.showIssueModal(${JSON.stringify(issue).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-primary" onclick="app.showTaskModal(null, ${issue.id})">
                    <i class="fas fa-tasks"></i>
                </button>
            </div>
        `;
        
        // Add drag and drop functionality
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', issue.id);
            card.classList.add('dragging');
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
        
        return card;
    }

    // Task Management
    async loadIssueTasks(issueId) {
        try {
            this.tasks = await ipcRenderer.invoke('get-tasks', issueId);
            return this.tasks;
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showNotification('خطا در بارگذاری تسک‌ها', 'error');
            return [];
        }
    }

    async loadTaskSubtasks(taskId) {
        try {
            this.subtasks = await ipcRenderer.invoke('get-subtasks', taskId);
            return this.subtasks;
        } catch (error) {
            console.error('Error loading subtasks:', error);
            this.showNotification('خطا در بارگذاری زیرتسک‌ها', 'error');
            return [];
        }
    }

    showTaskModal(task = null, issueId = null) {
        this.currentTask = task;
        this.currentIssueId = issueId || task?.issue_id;
        
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('taskModalTitle');
        const form = document.getElementById('taskForm');
        
        if (task) {
            title.textContent = 'ویرایش تسک';
            form.title.value = task.title;
            form.description.value = task.description || '';
            form.status.value = task.status;
            form.priority.value = task.priority;
            form.assigned_to.value = task.assigned_to || '';
            const g = task.due_date ? new Date(task.due_date) : null;
            const gStr = g ? `${g.getFullYear()}-${String(g.getMonth()+1).padStart(2,'0')}-${String(g.getDate()).padStart(2,'0')} ${String(g.getHours()).padStart(2,'0')}:${String(g.getMinutes()).padStart(2,'0')}:00` : '';
            const hidden = document.getElementById('taskDueDateGregorian');
            if (hidden) hidden.value = gStr;
            setTimeout(() => {
                const input = document.getElementById('taskDueDate');
                if (input && input._flatpickr && g) input._flatpickr.setDate(g, true);
            }, 0);
        } else {
            title.textContent = 'تسک جدید';
            form.reset();
            const hidden = document.getElementById('taskDueDateGregorian');
            if (hidden) hidden.value = '';
        }
        
        this.populateUserSelect('taskAssignedTo');
        modal.style.display = 'block';
        setTimeout(() => this.initJalaliPickers(), 0);
    }

    hideTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
    }

    async handleTaskSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const taskData = {
            issue_id: this.currentIssueId,
            title: formData.get('title'),
            description: formData.get('description'),
            status: formData.get('status'),
            priority: formData.get('priority'),
            assigned_to: formData.get('assigned_to') || null,
            due_date: (document.getElementById('taskDueDateGregorian').value || null)
        };

        try {
            this.showLoading();
            if (this.currentTask) {
                await ipcRenderer.invoke('update-task', this.currentTask.id, taskData);
                this.showNotification('تسک با موفقیت به‌روزرسانی شد');
            } else {
                await ipcRenderer.invoke('create-task', taskData);
                this.showNotification('تسک با موفقیت ایجاد شد');
            }
            
            await this.loadProjectIssues();
            if (this.currentView === 'board') {
                this.renderKanbanBoard();
            } else {
                this.renderIssuesList();
            }
            this.hideTaskModal();
            this.hideLoading();
        } catch (error) {
            console.error('Error saving task:', error);
            this.showNotification('خطا در ذخیره تسک', 'error');
            this.hideLoading();
        }
    }

    showSubtaskModal(subtask = null, taskId = null) {
        this.currentSubtask = subtask;
        this.currentTaskId = taskId || subtask?.task_id;
        
        const modal = document.getElementById('subtaskModal');
        const title = document.getElementById('subtaskModalTitle');
        const form = document.getElementById('subtaskForm');
        
        if (subtask) {
            title.textContent = 'ویرایش زیرتسک';
            form.title.value = subtask.title;
            form.description.value = subtask.description || '';
            form.status.value = subtask.status;
            form.assigned_to.value = subtask.assigned_to || '';
            const g = subtask.due_date ? new Date(subtask.due_date) : null;
            const gStr = g ? `${g.getFullYear()}-${String(g.getMonth()+1).padStart(2,'0')}-${String(g.getDate()).padStart(2,'0')} ${String(g.getHours()).padStart(2,'0')}:${String(g.getMinutes()).padStart(2,'0')}:00` : '';
            const hidden = document.getElementById('subtaskDueDateGregorian');
            if (hidden) hidden.value = gStr;
            setTimeout(() => {
                const input = document.getElementById('subtaskDueDate');
                if (input && input._flatpickr && g) input._flatpickr.setDate(g, true);
            }, 0);
        } else {
            title.textContent = 'زیرتسک جدید';
            form.reset();
            const hidden = document.getElementById('subtaskDueDateGregorian');
            if (hidden) hidden.value = '';
        }
        
        this.populateUserSelect('subtaskAssignedTo');
        modal.style.display = 'block';
        setTimeout(() => this.initJalaliPickers(), 0);
    }

    hideSubtaskModal() {
        document.getElementById('subtaskModal').style.display = 'none';
    }

    async handleSubtaskSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const subtaskData = {
            task_id: this.currentTaskId,
            title: formData.get('title'),
            description: formData.get('description'),
            status: formData.get('status'),
            assigned_to: formData.get('assigned_to') || null,
            due_date: (document.getElementById('subtaskDueDateGregorian').value || null)
        };

        try {
            this.showLoading();
            if (this.currentSubtask) {
                await ipcRenderer.invoke('update-subtask', this.currentSubtask.id, subtaskData);
                this.showNotification('زیرتسک با موفقیت به‌روزرسانی شد');
            } else {
                await ipcRenderer.invoke('create-subtask', subtaskData);
                this.showNotification('زیرتسک با موفقیت ایجاد شد');
            }
            
            await this.loadProjectIssues();
            if (this.currentView === 'board') {
                this.renderKanbanBoard();
            } else {
                this.renderIssuesList();
            }
            this.hideSubtaskModal();
            this.hideLoading();
        } catch (error) {
            console.error('Error saving subtask:', error);
            this.showNotification('خطا در ذخیره زیرتسک', 'error');
            this.hideLoading();
        }
    }

    async deleteTask(taskId) {
        if (confirm('آیا مطمئن هستید که می‌خواهید این تسک را حذف کنید؟')) {
            try {
                this.showLoading();
                await ipcRenderer.invoke('delete-task', taskId);
                this.showNotification('تسک با موفقیت حذف شد');
                await this.loadProjectIssues();
                if (this.currentView === 'board') {
                    this.renderKanbanBoard();
                } else {
                    this.renderIssuesList();
                }
                this.hideLoading();
            } catch (error) {
                console.error('Error deleting task:', error);
                this.showNotification('خطا در حذف تسک', 'error');
                this.hideLoading();
            }
        }
    }

    async deleteSubtask(subtaskId) {
        if (confirm('آیا مطمئن هستید که می‌خواهید این زیرتسک را حذف کنید؟')) {
            try {
                this.showLoading();
                await ipcRenderer.invoke('delete-subtask', subtaskId);
                this.showNotification('زیرتسک با موفقیت حذف شد');
                await this.loadProjectIssues();
                if (this.currentView === 'board') {
                    this.renderKanbanBoard();
                } else {
                    this.renderIssuesList();
                }
                this.hideLoading();
            } catch (error) {
                console.error('Error deleting subtask:', error);
                this.showNotification('خطا در حذف زیرتسک', 'error');
                this.hideLoading();
            }
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ScrumApp();
});

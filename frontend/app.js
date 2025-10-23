class ARMServiceDesk {
    constructor() {
        this.apiBase = 'http://localhost:8000/api';
        this.token = localStorage.getItem('arm_token');
        this.user = JSON.parse(localStorage.getItem('arm_user') || '{}');
        this.arms = [];
        this.tickets = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        
        if (this.token && this.user.username) {
            this.showMainApp();
        } else {
            this.showLoginModal();
        }
    }

    setupEventListeners() {
        // Форма входа
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Форма создания заявки
        document.getElementById('ticketForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTicket();
        });

        // Форма добавления АРМ
        document.getElementById('addArmForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addArm();
        });

        // Поиск АРМ
        document.getElementById('searchArms').addEventListener('input', (e) => {
            this.filterArms(e.target.value);
        });
    }

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                
                this.token = data.token;
                this.user = {
                    username: data.username,
                    is_admin: data.is_admin
                };
                
                // Сохраняем в localStorage
                localStorage.setItem('arm_token', this.token);
                localStorage.setItem('arm_user', JSON.stringify(this.user));
                
                this.showMainApp();
                this.showSuccess('Успешный вход в систему!');
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Ошибка входа');
            }
        } catch (error) {
            this.showError('Ошибка подключения к серверу');
        }
    }

    logout() {
        localStorage.removeItem('arm_token');
        localStorage.removeItem('arm_user');
        this.token = null;
        this.user = {};
        this.showLoginModal();
    }

    showLoginModal() {
        document.getElementById('loginModal').classList.add('active');
        document.getElementById('app').classList.add('hidden');
    }

    async showMainApp() {
        document.getElementById('loginModal').classList.remove('active');
        document.getElementById('app').classList.remove('hidden');
        
        document.getElementById('currentUser').textContent = 
            `${this.user.username} ${this.user.is_admin ? '(Администратор)' : ''}`;
        
        // Показываем/скрываем вкладку админа
        const adminTab = document.getElementById('adminTab');
        adminTab.style.display = this.user.is_admin ? 'block' : 'none';
        
        await this.loadInitialData();
        this.switchTab('tickets');
    }

    async loadInitialData() {
        await Promise.all([
            this.loadArms(),
            this.loadTickets()
        ]);
    }

    async loadArms() {
        try {
            const response = await fetch(`${this.apiBase}/arms`, {
                headers: { 'Authorization': this.token }
            });

            if (response.ok) {
                this.arms = await response.json();
                this.populateArmsSelect();
                this.renderArmsList();
                if (this.user.is_admin) {
                    this.renderAdminArmsList();
                }
            }
        } catch (error) {
            this.showError('Ошибка загрузки АРМ');
        }
    }

    async loadTickets() {
        try {
            const response = await fetch(`${this.apiBase}/tickets`, {
                headers: { 'Authorization': this.token }
            });

            if (response.ok) {
                this.tickets = await response.json();
                this.renderTicketsList();
                if (this.user.is_admin) {
                    this.renderAdminTicketsList();
                    this.loadAdminStats();
                }
            }
        } catch (error) {
            this.showError('Ошибка загрузки заявок');
        }
    }

    populateArmsSelect() {
        const select = document.getElementById('ticketArmId');
        select.innerHTML = '<option value="">Выберите АРМ</option>';
        
        this.arms.forEach(arm => {
            const option = document.createElement('option');
            option.value = arm.id;
            option.textContent = `${arm.name} (${arm.location}) - ${arm.user}`;
            select.appendChild(option);
        });
    }

    renderArmsList() {
        const container = document.getElementById('armsList');
        
        if (this.arms.length === 0) {
            container.innerHTML = '<p class="loading">Нет данных об АРМ</p>';
            return;
        }

        container.innerHTML = this.arms.map(arm => `
            <div class="arm-item">
                <div class="arm-header">
                    <div class="arm-title">${arm.name} (${arm.id})</div>
                    <span class="status-badge status-${arm.status}">
                        ${this.getStatusText(arm.status)}
                    </span>
                </div>
                <div class="arm-meta">
                    📍 ${arm.location} | 👤 ${arm.user} | 🏢 ${arm.department}
                </div>
                <div class="arm-characteristics">
                    <h4>🛠️ Характеристики:</h4>
                    <div class="characteristics-grid">
                        <div class="characteristic-item">
                            <span class="characteristic-label">Процессор:</span>
                            <span>${arm.characteristics.cpu || 'Не указан'}</span>
                        </div>
                        <div class="characteristic-item">
                            <span class="characteristic-label">Память:</span>
                            <span>${arm.characteristics.ram || 'Не указана'}</span>
                        </div>
                        <div class="characteristic-item">
                            <span class="characteristic-label">Накопитель:</span>
                            <span>${arm.characteristics.storage || 'Не указан'}</span>
                        </div>
                        <div class="characteristic-item">
                            <span class="characteristic-label">ОС:</span>
                            <span>${arm.characteristics.os || 'Не указана'}</span>
                        </div>
                        ${arm.characteristics.monitor ? `
                        <div class="characteristic-item">
                            <span class="characteristic-label">Монитор:</span>
                            <span>${arm.characteristics.monitor}</span>
                        </div>
                        ` : ''}
                        ${arm.characteristics.additional ? `
                        <div class="characteristic-item">
                            <span class="characteristic-label">Дополнительно:</span>
                            <span>${arm.characteristics.additional}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="arm-meta">
                    📅 Установлен: ${new Date(arm.created_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    }

    renderTicketsList() {
        const container = document.getElementById('ticketsList');
        const userTickets = this.user.is_admin ? 
            this.tickets : 
            this.tickets.filter(t => t.created_by === this.user.username);

        if (userTickets.length === 0) {
            container.innerHTML = '<p class="loading">У вас пока нет заявок</p>';
            return;
        }

        container.innerHTML = userTickets.map(ticket => {
            const arm = this.arms.find(a => a.id === ticket.arm_id);
            return `
                <div class="ticket-item">
                    <div class="ticket-header">
                        <div class="ticket-id">${ticket.id}</div>
                        <div>
                            <span class="status-badge status-${ticket.status}">
                                ${this.getTicketStatusText(ticket.status)}
                            </span>
                            <span class="priority-badge priority-${ticket.priority}">
                                ${this.getPriorityText(ticket.priority)}
                            </span>
                        </div>
                    </div>
                    <div class="ticket-info">
                        <strong>АРМ:</strong> ${arm ? arm.name : ticket.arm_id} | 
                        <strong>Тип проблемы:</strong> ${this.getProblemTypeText(ticket.problem_type)} |
                        <strong>Создана:</strong> ${new Date(ticket.created_at).toLocaleString()}
                    </div>
                    <div class="ticket-description">
                        ${ticket.description}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Административные функции
    renderAdminArmsList() {
        const container = document.getElementById('adminArmsList');
        
        if (this.arms.length === 0) {
            container.innerHTML = '<p class="loading">Нет данных об АРМ</p>';
            return;
        }

        container.innerHTML = this.arms.map(arm => `
            <div class="arm-item">
                <div class="arm-header">
                    <div class="arm-title">${arm.name} (${arm.id})</div>
                    <span class="status-badge status-${arm.status}">
                        ${this.getStatusText(arm.status)}
                    </span>
                </div>
                <div class="arm-meta">
                    📍 ${arm.location} | 👤 ${arm.user} | 🏢 ${arm.department} |
                    📦 ${arm.inventory_number}
                </div>
                <div class="actions">
                    <button class="btn-small btn-secondary" onclick="app.showEditArmModal('${arm.id}')">
                        ✏️ Редактировать
                    </button>
                    <button class="btn-small btn-danger" onclick="app.deleteArm('${arm.id}')">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderAdminTicketsList() {
        const container = document.getElementById('adminTicketsList');
        
        if (this.tickets.length === 0) {
            container.innerHTML = '<p class="loading">Нет заявок</p>';
            return;
        }

        container.innerHTML = this.tickets.map(ticket => {
            const arm = this.arms.find(a => a.id === ticket.arm_id);
            return `
                <div class="ticket-item">
                    <div class="ticket-header">
                        <div class="ticket-id">${ticket.id}</div>
                        <div>
                            <span class="status-badge status-${ticket.status}">
                                ${this.getTicketStatusText(ticket.status)}
                            </span>
                            <span class="priority-badge priority-${ticket.priority}">
                                ${this.getPriorityText(ticket.priority)}
                            </span>
                        </div>
                    </div>
                    <div class="ticket-info">
                        <strong>АРМ:</strong> ${arm ? arm.name : ticket.arm_id} | 
                        <strong>Тип:</strong> ${this.getProblemTypeText(ticket.problem_type)} |
                        <strong>Создал:</strong> ${ticket.created_by} |
                        <strong>Дата:</strong> ${new Date(ticket.created_at).toLocaleString()}
                    </div>
                    <div class="ticket-description">
                        ${ticket.description}
                    </div>
                    <div class="actions">
                        ${ticket.status === 'new' ? `
                            <button class="btn-small btn-success" onclick="app.updateTicketStatus('${ticket.id}', 'in_progress')">
                                🚀 В работу
                            </button>
                        ` : ''}
                        ${ticket.status === 'in_progress' ? `
                            <button class="btn-small btn-success" onclick="app.updateTicketStatus('${ticket.id}', 'resolved')">
                                ✅ Решено
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadAdminStats() {
        try {
            const response = await fetch(`${this.apiBase}/stats`, {
                headers: { 'Authorization': this.token }
            });

            if (response.ok) {
                const stats = await response.json();
                this.renderAdminStats(stats);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    renderAdminStats(stats) {
        const container = document.getElementById('adminStats');
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.total_arms}</div>
                <div class="stat-label">Всего АРМ</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.operational_arms}</div>
                <div class="stat-label">Рабочих АРМ</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.total_tickets}</div>
                <div class="stat-label">Всего заявок</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.new_tickets}</div>
                <div class="stat-label">Новых заявок</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.in_progress_tickets}</div>
                <div class="stat-label">Заявок в работе</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.resolved_tickets}</div>
                <div class="stat-label">Решенных заявок</div>
            </div>
        `;
    }

    // Создание заявки
    async createTicket() {
        const formData = {
            arm_id: document.getElementById('ticketArmId').value,
            problem_type: document.getElementById('ticketProblemType').value,
            priority: document.getElementById('ticketPriority').value,
            description: document.getElementById('ticketDescription').value
        };

        try {
            const response = await fetch(`${this.apiBase}/tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccess('Заявка успешно создана!');
                document.getElementById('ticketForm').reset();
                await this.loadTickets();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Ошибка создания заявки');
            }
        } catch (error) {
            this.showError('Ошибка подключения к серверу');
        }
    }

    // Управление АРМ (админ)
    showAddArmModal() {
        document.getElementById('addArmModal').classList.remove('hidden');
    }

    closeAddArmModal() {
        document.getElementById('addArmModal').classList.add('hidden');
        document.getElementById('addArmForm').reset();
    }

    async addArm() {
        const formData = {
            inventory_number: document.getElementById('armInventoryNumber').value,
            name: document.getElementById('armName').value,
            location: document.getElementById('armLocation').value,
            user: document.getElementById('armUser').value,
            department: document.getElementById('armDepartment').value,
            characteristics: {
                cpu: document.getElementById('armCpu').value,
                ram: document.getElementById('armRam').value,
                storage: document.getElementById('armStorage').value,
                os: document.getElementById('armOs').value,
                monitor: document.getElementById('armMonitor').value,
                keyboard_mouse: document.getElementById('armKeyboard').value,
                additional: document.getElementById('armAdditional').value
            }
        };

        try {
            const response = await fetch(`${this.apiBase}/admin/arms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccess('АРМ успешно добавлен!');
                this.closeAddArmModal();
                await this.loadArms();
                await this.loadAdminStats();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Ошибка добавления АРМ');
            }
        } catch (error) {
            this.showError('Ошибка подключения к серверу');
        }
    }

    async showEditArmModal(armId) {
        const arm = this.arms.find(a => a.id === armId);
        if (!arm) return;

        const modalContent = document.getElementById('editArmContent');
        modalContent.innerHTML = `
            <h2>✏️ Редактирование АРМ</h2>
            <form onsubmit="app.updateArm('${armId}'); return false;">
                <div class="form-row">
                    <div class="form-group">
                        <label>Инвентарный номер:*</label>
                        <input type="text" id="editInventoryNumber" value="${arm.inventory_number}" required>
                    </div>
                    <div class="form-group">
                        <label>Название:*</label>
                        <input type="text" id="editArmName" value="${arm.name}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Местоположение:*</label>
                        <input type="text" id="editArmLocation" value="${arm.location}" required>
                    </div>
                    <div class="form-group">
                        <label>Пользователь:*</label>
                        <input type="text" id="editArmUser" value="${arm.user}" required>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Отдел:*</label>
                        <input type="text" id="editArmDepartment" value="${arm.department}" required>
                    </div>
                    <div class="form-group">
                        <label>Статус:*</label>
                        <select id="editArmStatus" required>
                            <option value="operational" ${arm.status === 'operational' ? 'selected' : ''}>Рабочий</option>
                            <option value="broken" ${arm.status === 'broken' ? 'selected' : ''}>Сломан</option>
                            <option value="maintenance" ${arm.status === 'maintenance' ? 'selected' : ''}>На обслуживании</option>
                        </select>
                    </div>
                </div>

                <h4>🛠️ Характеристики оборудования</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label>Процессор:</label>
                        <input type="text" id="editArmCpu" value="${arm.characteristics.cpu || ''}">
                    </div>
                    <div class="form-group">
                        <label>Оперативная память:</label>
                        <input type="text" id="editArmRam" value="${arm.characteristics.ram || ''}">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Накопитель:</label>
                        <input type="text" id="editArmStorage" value="${arm.characteristics.storage || ''}">
                    </div>
                    <div class="form-group">
                        <label>Операционная система:</label>
                        <input type="text" id="editArmOs" value="${arm.characteristics.os || ''}">
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="app.closeEditArmModal()">Отмена</button>
                    <button type="submit" class="btn-primary">Сохранить изменения</button>
                </div>
            </form>
        `;

        document.getElementById('editArmModal').classList.remove('hidden');
    }

    closeEditArmModal() {
        document.getElementById('editArmModal').classList.add('hidden');
    }

    async updateArm(armId) {
        const formData = {
            inventory_number: document.getElementById('editInventoryNumber').value,
            name: document.getElementById('editArmName').value,
            location: document.getElementById('editArmLocation').value,
            user: document.getElementById('editArmUser').value,
            department: document.getElementById('editArmDepartment').value,
            status: document.getElementById('editArmStatus').value,
            characteristics: {
                cpu: document.getElementById('editArmCpu').value,
                ram: document.getElementById('editArmRam').value,
                storage: document.getElementById('editArmStorage').value,
                os: document.getElementById('editArmOs').value
            }
        };

        try {
            const response = await fetch(`${this.apiBase}/admin/arms/${armId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showSuccess('АРМ успешно обновлен!');
                this.closeEditArmModal();
                await this.loadArms();
                await this.loadAdminStats();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Ошибка обновления АРМ');
            }
        } catch (error) {
            this.showError('Ошибка подключения к серверу');
        }
    }

    async deleteArm(armId) {
        if (!confirm('Вы уверены, что хотите удалить этот АРМ?')) return;

        try {
            const response = await fetch(`${this.apiBase}/admin/arms/${armId}`, {
                method: 'DELETE',
                headers: { 'Authorization': this.token }
            });

            if (response.ok) {
                this.showSuccess('АРМ успешно удален!');
                await this.loadArms();
                await this.loadAdminStats();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Ошибка удаления АРМ');
            }
        } catch (error) {
            this.showError('Ошибка подключения к серверу');
        }
    }

    async updateTicketStatus(ticketId, newStatus) {
        try {
            const response = await fetch(`${this.apiBase}/admin/tickets/${ticketId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                this.showSuccess('Статус заявки обновлен!');
                await this.loadTickets();
                await this.loadAdminStats();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'Ошибка обновления заявки');
            }
        } catch (error) {
            this.showError('Ошибка подключения к серверу');
        }
    }

    // Вспомогательные методы
    switchTab(tabName) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        if (tabName === 'admin' && this.user.is_admin) {
            this.loadAdminStats();
        }
    }

    filterArms(searchQuery) {
        const filteredArms = searchQuery ? 
            this.arms.filter(arm => 
                arm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                arm.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                arm.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
                arm.department.toLowerCase().includes(searchQuery.toLowerCase())
            ) : this.arms;

        const container = document.getElementById('armsList');
        if (filteredArms.length === 0) {
            container.innerHTML = '<p class="loading">АРМ не найдены</p>';
            return;
        }

        container.innerHTML = filteredArms.map(arm => `
            <div class="arm-item">
                <div class="arm-header">
                    <div class="arm-title">${arm.name} (${arm.id})</div>
                    <span class="status-badge status-${arm.status}">
                        ${this.getStatusText(arm.status)}
                    </span>
                </div>
                <div class="arm-meta">
                    📍 ${arm.location} | 👤 ${arm.user} | 🏢 ${arm.department}
                </div>
                <div class="arm-characteristics">
                    <h4>🛠️ Характеристики:</h4>
                    <div class="characteristics-grid">
                        <div class="characteristic-item">
                            <span class="characteristic-label">Процессор:</span>
                            <span>${arm.characteristics.cpu || 'Не указан'}</span>
                        </div>
                        <div class="characteristic-item">
                            <span class="characteristic-label">Память:</span>
                            <span>${arm.characteristics.ram || 'Не указана'}</span>
                        </div>
                        <div class="characteristic-item">
                            <span class="characteristic-label">Накопитель:</span>
                            <span>${arm.characteristics.storage || 'Не указан'}</span>
                        </div>
                        <div class="characteristic-item">
                            <span class="characteristic-label">ОС:</span>
                            <span>${arm.characteristics.os || 'Не указана'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Текстовые представления
    getStatusText(status) {
        const statuses = {
            'operational': 'Рабочий',
            'broken': 'Сломан',
            'maintenance': 'Обслуживание'
        };
        return statuses[status] || status;
    }

    getTicketStatusText(status) {
        const statuses = {
            'new': 'Новая',
            'in_progress': 'В работе',
            'resolved': 'Решена'
        };
        return statuses[status] || status;
    }

    getProblemTypeText(type) {
        const types = {
            'hardware': 'Аппаратная',
            'software': 'Программная',
            'network': 'Сетевая',
            'other': 'Другая'
        };
        return types[type] || type;
    }

    getPriorityText(priority) {
        const priorities = {
            'low': 'Низкий',
            'medium': 'Средний',
            'high': 'Высокий',
            'critical': 'Критический'
        };
        return priorities[priority] || priority;
    }

    // Уведомления
    showSuccess(message) {
        alert(`✅ ${message}`);
    }

    showError(message) {
        alert(`❌ ${message}`);
    }
}

// Глобальные функции для HTML
const app = new ARMServiceDesk();

function logout() {
    app.logout();
}

function showAddArmModal() {
    app.showAddArmModal();
}

function closeAddArmModal() {
    app.closeAddArmModal();
}

function closeEditArmModal() {
    app.closeEditArmModal();
}

function loadTickets() {
    app.loadTickets();
}
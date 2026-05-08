        
        // Global variables
        let professionals = JSON.parse(localStorage.getItem('professionals') || '[]');
        let appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
        let rooms = JSON.parse(localStorage.getItem('rooms') || '[]');
        let remarkRequests = JSON.parse(localStorage.getItem('remarkRequests') || '[]');
        let waitlistItems = JSON.parse(localStorage.getItem('waitlistItems') || '[]');
        let waitlistOptions = { pacientes: [], profissionais: [], salas: [] };
        let waitlistFetchPromise = null;
        let waitlistOptionsFetchPromise = null;
        let remarkCanAuthorizeFromServer = null;
        let remarkRequestsEnabled = true;
        let remarkCanManageConfigFromServer = false;
        const LOCAL_API_BASE = 'http://127.0.0.1:5000';

        function apiUrl(path) {
            if (/^https?:\/\//i.test(path)) return path;
            const normalizedPath = path.startsWith('/') ? path : `/${path}`;
            if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
                return normalizedPath;
            }
            return `${LOCAL_API_BASE}${normalizedPath}`;
        }

        const nativeFetch = window.fetch.bind(window);
        window.fetch = function(input, init) {
            if (typeof input === 'string' && input.startsWith(`${LOCAL_API_BASE}/api/`)) {
                return nativeFetch(apiUrl(input.slice(LOCAL_API_BASE.length)), init);
            }
            return nativeFetch(input, init);
        };

        professionals = professionals.map(prof => ({
            ...prof,
            id: String(prof.id || '').trim()
        }));

        function normalizeRoomRecord(room) {
            return {
                id: String(room.id || room.sala_id || '').trim(),
                name: room.name || room.nome || '',
                color: room.color || room.cor || '#e5e7eb',
                active: typeof room.active !== 'undefined' ? room.active : (room.ativo !== false)
            };
        }

        function normalizeRoomNameText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();
        }

        function isRemovedRoomName(name) {
            return normalizeRoomNameText(name).includes('SALA DE CONVEN');
        }

        rooms = rooms
            .map(normalizeRoomRecord)
            .filter(room => room.id && room.name && !isRemovedRoomName(room.name));

        const APPOINTMENT_STATUS_OPTIONS = [
            { value: 'agendado', label: 'Agendado', color: 'blue' },
            { value: 'pre_atendimento', label: 'Pre atendimento', color: 'cyan' },
            { value: 'confirmado', label: 'Confirmado', color: 'indigo' },
            { value: 'chegou', label: 'Chegou', color: 'emerald' },
            { value: 'em_atendimento', label: 'Em atendimento', color: 'teal' },
            { value: 'finalizado', label: 'Finalizado', color: 'green' },
            { value: 'faltou', label: 'Faltou', color: 'yellow' },
            { value: 'cancelado_paciente', label: 'Cancelado pelo paciente', color: 'orange' },
            { value: 'cancelado_profissional', label: 'Cancelado pelo profissional', color: 'red' }
        ];

        const WAITLIST_STATUS_OPTIONS = [
            { value: 'aguardando', label: 'Aguardando' },
            { value: 'em_contato', label: 'Em contato' },
            { value: 'encaixado', label: 'Encaixado' },
            { value: 'cancelado', label: 'Cancelado' }
        ];

        const WAITLIST_PRIORITY_OPTIONS = [
            { value: 'urgente', label: 'Urgente' },
            { value: 'alta', label: 'Alta' },
            { value: 'normal', label: 'Normal' },
            { value: 'baixa', label: 'Baixa' }
        ];

        function normalizeScheduleStatus(status) {
            const raw = String(status || 'agendado').trim();
            if (!raw) return 'agendado';
            const key = raw
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[-_]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const aliases = {
                'agendado': 'agendado',
                'pre atendimento': 'pre_atendimento',
                'pre-atendimento': 'pre_atendimento',
                'confirmado': 'confirmado',
                'chegou': 'chegou',
                'presente': 'chegou',
                'em atendimento': 'em_atendimento',
                'finalizado': 'finalizado',
                'faltou': 'faltou',
                'falta': 'faltou',
                'nao compareceu': 'faltou',
                'cancelado paciente': 'cancelado_paciente',
                'cancelado pelo paciente': 'cancelado_paciente',
                'cancelado profissional': 'cancelado_profissional',
                'cancelado pelo profissional': 'cancelado_profissional'
            };
            return aliases[key] || raw.toLowerCase();
        }
        
        function normalizeAppointmentRecord(apt) {
            const professionalId = apt.professionalId || apt.profissional_id || apt.professional_id || apt.profissional || apt.professional || '';
            const patientId = apt.patientId || apt.paciente_id || apt.patient_id || apt.clientId || '';
            const clientName = apt.clientName || apt.paciente || apt.patient || '';
            const type = apt.type || apt.tipo || apt.tipo_atendimento || '';
            const date = normalizeDate(apt.date || apt.data || '');
            const time = normalizeTime(apt.time || apt.hora_inicio || apt.hora || '');
            const endTime = normalizeTime(apt.endTime || apt.hora_fim || apt.endTime || apt.hora || apt.time || '');
            const roomId = apt.roomId || apt.sala_id || apt.salaId || apt.room_id || apt.roomId || '';
            const recurrenceGroupId = apt.recurrenceGroupId || apt.recorrencia_grupo_id || apt.repeatGroupId || apt.recurrence_group_id || '';
            const recurrenceIndex = apt.recurrenceIndex ?? apt.recorrencia_indice ?? apt.repeatIndex ?? null;
            const recurrenceTotal = apt.recurrenceTotal ?? apt.recorrencia_total ?? apt.repeatTotal ?? null;

            return {
                ...apt,
                professionalId: String(professionalId || '').trim(),
                patientId: patientId ? String(patientId).trim() : '',
                roomId: roomId ? String(roomId).trim() : '',
                recurrenceGroupId: recurrenceGroupId ? String(recurrenceGroupId).trim() : '',
                recurrenceIndex,
                recurrenceTotal,
                clientName,
                type,
                date,
                time,
                endTime,
                status: normalizeScheduleStatus(apt.status || 'agendado'),
                lockedBy: apt.lockedBy || apt.cancelado_por_username || null,
                lastAction: apt.lastAction || {
                    user: 'Sistema',
                    timestamp: new Date().toISOString(),
                    action: 'inicializado'
                }
            };
        }

        // Ensure all appointments have normalized keys for professional, date, time and action history
        appointments = appointments.map(normalizeAppointmentRecord);
        
        let currentWeek = new Date();
        let roomsAvailabilityWeek = new Date();
        let scheduleMiniCalendarOpen = false;
        let scheduleMiniCalendarMonth = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), 1);
        let currentView = 'home';
        let selectedProfessional = '';
        let isSavingAppointment = false;
        
        // Hidden system reset variables
        let resetSequence = [];
        let resetSequenceTarget = ['professionals', 'professionals', 'professionals', 'professionals', 'professionals'];
        let resetSequenceTimeout = null;

        let updateCheckIntervalId = null;
        const REFRESH_POLL_INTERVAL_MS = 30000;
        const FULL_REFRESH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
        let pendingServerUpdate = false;
        let lastServerSyncState = null;
        let lastFullServerCheckAt = 0;
        let agendaSyncInFlight = null;
        const DEBUG_LOGS = localStorage.getItem('debugLogs') === 'true';
        function debugLog(...args) {
            if (DEBUG_LOGS) {
                console.log(...args);
            }
        }

        function hasPendingAppointmentSync() {
            return appointments.some(apt => apt && apt.syncStatus === 'pending');
        }

        window.addEventListener('beforeunload', (event) => {
            if (!hasPendingAppointmentSync()) {
                return;
            }
            event.preventDefault();
            event.returnValue = '';
        });

        function showYesNoConfirm({ title, message, yesText = 'Sim', noText = 'N\u00e3o', danger = false }) {
            const modal = document.getElementById('yesNoConfirmModal');
            const titleEl = document.getElementById('yesNoConfirmTitle');
            const messageEl = document.getElementById('yesNoConfirmMessage');
            const yesBtn = document.getElementById('yesNoConfirmYesBtn');
            const noBtn = document.getElementById('yesNoConfirmNoBtn');

            if (!modal || !titleEl || !messageEl || !yesBtn || !noBtn) {
                return Promise.resolve(confirm(`${title || 'Confirmar'}\n\n${message || ''}`));
            }

            titleEl.textContent = title || 'Confirmar';
            messageEl.textContent = message || '';
            yesBtn.textContent = yesText;
            noBtn.textContent = noText;

            yesBtn.className = danger
                ? 'bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium'
                : 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium';
            noBtn.className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium';

            return new Promise(resolve => {
                const finish = (value) => {
                    modal.classList.remove('active');
                    yesBtn.onclick = null;
                    noBtn.onclick = null;
                    document.removeEventListener('keydown', onKeyDown);
                    resolve(value);
                };

                const onKeyDown = (event) => {
                    if (event.key === 'Escape' && modal.classList.contains('active')) {
                        finish(false);
                    }
                };

                yesBtn.onclick = () => finish(true);
                noBtn.onclick = () => finish(false);
                document.addEventListener('keydown', onKeyDown);
                modal.classList.add('active');
                setTimeout(() => noBtn.focus(), 0);
            });
        }

        function refreshActiveScheduleViews() {
            if (currentView === 'weekly') {
                loadWeeklyScheduleGrid();
            } else if (currentView === 'schedule') {
                loadScheduleGrid();
            } else if (currentView === 'dailyPanel') {
                renderDailyPanel();
            } else if (currentView === 'waitlist') {
                renderWaitlist();
            }
        }

        function syncAppointmentsForAgendaView(options = {}) {
            if (agendaSyncInFlight) {
                return agendaSyncInFlight;
            }

            agendaSyncInFlight = fetchAppointmentsFromServer({
                force: options.force === true,
                renderActiveView: true
            }).finally(() => {
                agendaSyncInFlight = null;
            });

            return agendaSyncInFlight;
        }

        // User authentication system
        let currentUser = null;
        let userPermissions = null;
        let patientListCache = [];
        let editingPatientId = null;
        let editingProfessionalId = null;

        // Local cache only mirrors non-sensitive user metadata from the server.
        const defaultUsers = {};

        // Load users from localStorage or use defaults
        let users = JSON.parse(localStorage.getItem('systemUsers') || JSON.stringify(defaultUsers));

        // Permission definitions
        const permissions = {
            admin: {
                canView: true,
                canViewPatients: true,
                canCreate: true,
                canCreateProfessional: true,
                canCreatePatient: true,
                canEdit: true,
                canEditProfessionals: true,
                canEditPatients: true,
                canDelete: true,
                canExport: true,
                canExportReport: true,
                canImport: true,
                canBulkEdit: true,
                canBulkCancel: true,
                canSystemReset: true,
                canManageProfessionals: true,
                canManageUsers: true
            },
            editor: {
                canView: true,
                canViewPatients: true,
                canCreate: true,
                canCreateProfessional: false,
                canCreatePatient: false,
                canEdit: true,
                canEditProfessionals: false,
                canEditPatients: false,
                canDelete: false,
                canExport: true,
                canExportReport: true,
                canImport: true,
                canBulkEdit: true,
                canBulkCancel: false,
                canSystemReset: false,
                canManageProfessionals: true,
                canManageUsers: false
            },
            viewer: {
                canView: true,
                canViewPatients: false,
                canCreate: false,
                canCreateProfessional: false,
                canCreatePatient: false,
                canEdit: false,
                canEditProfessionals: false,
                canEditPatients: false,
                canDelete: false,
                canExport: true,
                canExportReport: false,
                canImport: false,
                canBulkEdit: false,
                canBulkCancel: false,
                canSystemReset: false,
                canManageProfessionals: false,
                canManageUsers: false
            }
        };

        // Initialize the system
        document.addEventListener('DOMContentLoaded', function() {
            checkAuthentication();
        });

        // Authentication functions
        function legacyCheckAuthenticationDisabledOld() {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const userData = JSON.parse(savedUser);

                // Try server authentication first to ensure server-side users are valid
                fetch(apiUrl('/api/authenticate'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: userData.username, password: userData.password })
                })
                .then(res => res.json())
                .then(data => {
                    if (data && data.success && data.user) {
                        const level = (data.user.level || '').toLowerCase();
                        currentUser = { username: userData.username, password: userData.password, level: level, name: data.user.name };
                        if (users[userData.username] && users[userData.username].professionalId) {
                            currentUser.professionalId = users[userData.username].professionalId;
                        }
                        userPermissions = permissions[currentUser.level];
                        // Sync users from server
                        fetchUsersFromServer();
                        initializeSystem();
                        return;
                    } else {
                        // Fallback to local check if server unavailable or auth failed
                        if (users[userData.username] && users[userData.username].password === userData.password) {
                            currentUser = userData;
                            userPermissions = permissions[users[userData.username].level];
                            initializeSystem();
                            return;
                        }
                        document.getElementById('loginModal').classList.add('active');
                    }
                })
                .catch(err => {
                    console.error('Auth fetch error:', err);
                    // Fallback to local check
                    if (users[userData.username] && users[userData.username].password === userData.password) {
                        currentUser = userData;
                        userPermissions = permissions[users[userData.username].level];
                        initializeSystem();
                        return;
                    }
                    document.getElementById('loginModal').classList.add('active');
                });

                return; // wait for async auth
            }
            
            // Show login modal if not authenticated
            document.getElementById('loginModal').classList.add('active');
        }

        function legacyPerformLoginDisabledOld(event) {
            event.preventDefault();
            
            const username = document.getElementById('loginUsername').value.toLowerCase();
            const password = document.getElementById('loginPassword').value;

            // Try server authentication first
            fetch(apiUrl('/api/authenticate'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.user) {
                    // Successful server auth
                    const level = (data.user.level || '').toLowerCase();
                    currentUser = { username: username, password: password, level: level, name: data.user.name };
                    if (users[username] && users[username].professionalId) {
                        currentUser.professionalId = users[username].professionalId;
                    }
                    userPermissions = permissions[currentUser.level];
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));

                    // Sync local cache and UI
                    fetchUsersFromServer();

                    document.getElementById('loginModal').classList.remove('active');
                    initializeSystem();
                    showWelcomeMessage();
                    return;
                }

                // If server says invalid credentials, try local fallback
                if (users[username] && users[username].password === password) {
                    if (users[username].isActive === false) {
                        document.getElementById('loginError').innerHTML = '❌ Usuário inativo! Contate um administrador.';
                        document.getElementById('loginError').classList.remove('hidden');
                        document.getElementById('loginPassword').value = '';
                        setTimeout(() => document.getElementById('loginError').classList.add('hidden'), 5000);
                        return;
                    }

                    users[username].lastLogin = new Date().toISOString();
                    saveUsers();

                    currentUser = { username: username, password: password, level: users[username].level, name: users[username].name };
                    if (users[username] && users[username].professionalId) {
                        currentUser.professionalId = users[username].professionalId;
                    }
                    userPermissions = permissions[users[username].level];
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));

                    document.getElementById('loginModal').classList.remove('active');
                    initializeSystem();
                    showWelcomeMessage();
                    return;
                }

                // Failed login
                document.getElementById('loginError').innerHTML = '❌ Usuário ou senha incorretos!';
                document.getElementById('loginError').classList.remove('hidden');
                document.getElementById('loginPassword').value = '';
                setTimeout(() => document.getElementById('loginError').classList.add('hidden'), 3000);
            })
            .catch(err => {
                console.warn('Auth server error, using local fallback:', err);
                // fallback to local check
                if (users[username] && users[username].password === password) {
                    if (users[username].isActive === false) {
                        document.getElementById('loginError').innerHTML = '❌ Usuário inativo! Contate um administrador.';
                        document.getElementById('loginError').classList.remove('hidden');
                        document.getElementById('loginPassword').value = '';
                        setTimeout(() => document.getElementById('loginError').classList.add('hidden'), 5000);
                        return;
                    }

                    users[username].lastLogin = new Date().toISOString();
                    saveUsers();

                    currentUser = { username: username, password: password, level: users[username].level, name: users[username].name };
                    if (users[username] && users[username].professionalId) {
                        currentUser.professionalId = users[username].professionalId;
                    }
                    userPermissions = permissions[users[username].level];
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));

                    document.getElementById('loginModal').classList.remove('active');
                    initializeSystem();
                    showWelcomeMessage();
                    return;
                }

                document.getElementById('loginError').innerHTML = '❌ Usuário ou senha incorretos!';
                document.getElementById('loginError').classList.remove('hidden');
                document.getElementById('loginPassword').value = '';
                setTimeout(() => document.getElementById('loginError').classList.add('hidden'), 3000);
            });
        }

        function sanitizeSessionUser(user) {
            if (!user) return null;
            const username = String(user.username || '').toLowerCase();
            const level = String(user.level || 'viewer').toLowerCase();
            const sanitized = {
                username,
                level,
                name: user.name || username
            };
            if (user.professionalId || user.profissional_id) {
                sanitized.professionalId = user.professionalId || user.profissional_id;
            } else if (users[username] && users[username].professionalId) {
                sanitized.professionalId = users[username].professionalId;
            }
            return sanitized;
        }

        function applyAuthenticatedUser(user) {
            currentUser = sanitizeSessionUser(user);
            userPermissions = permissions[currentUser.level] || permissions.viewer;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return currentUser;
        }

        function showLoginModal() {
            currentUser = null;
            userPermissions = null;
            localStorage.removeItem('currentUser');
            const userInfo = document.querySelector('.user-info');
            if (userInfo) {
                userInfo.remove();
            }
            document.querySelectorAll('.modal').forEach(modal => {
                if (modal.id !== 'loginModal') {
                    modal.classList.remove('active');
                }
            });
            document.getElementById('loginModal').classList.add('active');
        }

        function checkAuthentication() {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                try {
                    const userData = JSON.parse(savedUser);
                    if (userData && userData.password) {
                        delete userData.password;
                        localStorage.setItem('currentUser', JSON.stringify(userData));
                    }
                } catch (err) {
                    localStorage.removeItem('currentUser');
                }
            }

            fetch(apiUrl('/api/me'))
                .then(res => res.ok ? res.json() : Promise.reject(res))
                .then(data => {
                    if (data && data.success && data.user) {
                        applyAuthenticatedUser(data.user);
                        fetchUsersFromServer();
                        initializeSystem();
                        return;
                    }
                    showLoginModal();
                })
                .catch(() => {
                    showLoginModal();
                });
        }

        function performLogin(event) {
            event.preventDefault();

            const username = document.getElementById('loginUsername').value.toLowerCase();
            const password = document.getElementById('loginPassword').value;

            fetch(apiUrl('/api/authenticate'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.user) {
                    applyAuthenticatedUser(data.user);
                    fetchUsersFromServer();
                    document.getElementById('loginPassword').value = '';
                    document.getElementById('loginModal').classList.remove('active');
                    initializeSystem();
                    showWelcomeMessage();
                    return;
                }

                document.getElementById('loginError').innerHTML = '❌ Usuário ou senha incorretos!';
                document.getElementById('loginError').classList.remove('hidden');
                document.getElementById('loginPassword').value = '';
                setTimeout(() => document.getElementById('loginError').classList.add('hidden'), 3000);
            })
            .catch(err => {
                console.warn('Auth server error:', err);
                document.getElementById('loginError').innerHTML = '❌ Não foi possível autenticar no servidor.';
                document.getElementById('loginError').classList.remove('hidden');
                document.getElementById('loginPassword').value = '';
                setTimeout(() => document.getElementById('loginError').classList.add('hidden'), 3000);
            });
        }

        function showWelcomeMessage() {
            const levelIcons = {
                admin: '👑',
                editor: '✏️',
                viewer: '👁️'
            };
            
            const levelNames = {
                admin: 'Administrador',
                editor: 'Editor',
                viewer: 'Visualizador'
            };
            
            const message = `${levelIcons[currentUser.level]} Bem-vindo, ${currentUser.name}!\nNível: ${levelNames[currentUser.level]}`;
            showSuccessMessage(message);

            // Ensure we have the latest users from server after login
            setTimeout(() => {
                fetchUsersFromServer();
            }, 500);
        }

        function logout() {
            if (confirm('🚪 Deseja realmente sair do sistema?')) {
                fetch(apiUrl('/api/logout'), { method: 'POST' }).catch(() => {});
                // Clear user session
                localStorage.removeItem('currentUser');
                currentUser = null;
                userPermissions = null;
                
                // Clear all sensitive data from UI
                document.getElementById('scheduleGrid').innerHTML = '';
                document.getElementById('weeklyScheduleGrid').innerHTML = '';
                document.getElementById('professionalsList').innerHTML = '';
                document.getElementById('reportsContent').innerHTML = '';
                
                // Clear all form inputs
                const allInputs = document.querySelectorAll('input, select, textarea');
                allInputs.forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else {
                        input.value = '';
                    }
                });
                
                // Close all modals except login
                const allModals = document.querySelectorAll('.modal');
                allModals.forEach(modal => {
                    if (modal.id !== 'loginModal') {
                        modal.classList.remove('active');
                    }
                });
                
                // Clear filters and searches
                document.getElementById('professionalFilter').innerHTML = '<option value="">Todos os Profissionais</option>';
                document.getElementById('weeklyProfessionalFilter').innerHTML = '<option value="">Todos os Profissionais</option>';
                document.getElementById('appointmentProfessional').innerHTML = '<option value="">Selecione o profissional...</option>';
                document.getElementById('mainProfessionalSearch').value = '';
                document.getElementById('professionalSearch').value = '';
                
                // Hide user info and reset to default view
                const userInfo = document.querySelector('.user-info');
                if (userInfo) {
                    userInfo.remove();
                }
                
                // Reset view to home
                hideAllViews();
                document.getElementById('homeView').style.display = 'block';
                currentView = 'home';
                
                // Show login modal
                document.getElementById('loginModal').classList.add('active');
                
                // Reset login form
                document.getElementById('loginUsername').value = '';
                document.getElementById('loginPassword').value = '';
                document.getElementById('loginError').classList.add('hidden');
                
                // Focus on username field
                document.getElementById('loginUsername').focus();
                
                // Show logout success message
                const notification = document.createElement('div');
                notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                notification.innerHTML = '🚪 Logout realizado com sucesso!';
                
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 3000);
            }
        }

        async function initializeSystem() {
            debugLog('[initializeSystem] ===== SYSTEM STARTUP =====');
            debugLog('[initializeSystem] User:', currentUser.name, '(' + currentUser.level + ')');
            
            // Load from localStorage first
            const savedAppointments = localStorage.getItem('appointments');
            if (savedAppointments) {
                try {
                    appointments = JSON.parse(savedAppointments);
                    appointments = appointments.map(normalizeAppointmentRecord);
                    debugLog('[initializeSystem] Loaded ' + appointments.length + ' appointments from localStorage');
                } catch (e) {
                    console.error('[initializeSystem] Error parsing localStorage appointments:', e);
                    appointments = [];
                }
            }
            
            debugLog('[initializeSystem] Updating professional filter...');
            updateProfessionalFilter();
            debugLog('[initializeSystem] Updating room filter...');
            populateRoomSelect();
            debugLog('[initializeSystem] Loading schedule grid from local cache...');
            loadScheduleGrid();
            debugLog('[initializeSystem] Populating time slots...');
            populateTimeSlots();
            debugLog('[initializeSystem] Updating UI based on permissions...');
            updateUIBasedOnPermissions();
            debugLog('[initializeSystem] Updating header...');
            updateHeaderWithUserInfo();
            debugLog('[initializeSystem] Updating sync button...');
            updateSyncButtonVisibility();
            debugLog('[initializeSystem] ===== SYSTEM READY =====');

            scheduleServerUpdateChecks();

            debugLog('[initializeSystem] Syncing server data in background...');
            Promise.all([
                fetchProfessionalsFromServer(),
                fetchRoomsFromServer(),
                fetchAppointmentsFromServer(),
                fetchRemarkConfigFromServer(),
                fetchRemarkRequestsFromServer()
            ])
            .then(() => {
                updateProfessionalFilter();
                populateRoomSelect();
                updateRemarkConfigUi();
                updateRemarkBadges();
                refreshActiveScheduleViews();
                debugLog('[initializeSystem] Background sync completed.');
            })
            .catch(err => {
                console.warn('[initializeSystem] Sincronizacao em segundo plano falhou:', err);
            });
        }

        function scheduleServerUpdateChecks() {
            if (updateCheckIntervalId) {
                clearInterval(updateCheckIntervalId);
            }
            updateCheckIntervalId = setInterval(() => {
                if (!currentUser) return;
                checkServerUpdates();
            }, REFRESH_POLL_INTERVAL_MS);
        }

        function normalizeProfessionalRecord(prof) {
            const specialty = prof.specialty || prof.especialidade || '';
            return {
                id: String(prof.id || prof._id || '').trim(),
                name: prof.name || prof.nome || '',
                specialty,
                specialties: splitProfessionalSpecialties(prof.specialties || prof.especialidades || specialty),
                preference: prof.preference || prof.preferencia || '',
                emergencyContact: prof.emergencyContact || prof.contato_emergencia || '',
                active: typeof prof.active !== 'undefined' ? prof.active : (prof.ativo !== false)
            };
        }

        function normalizeAppointmentForComparison(apt) {
            const normalized = normalizeAppointmentRecord(apt);
            return {
                id: String(normalized.id || '').trim(),
                professionalId: String(normalized.professionalId || '').trim(),
                date: normalizeDate(normalized.date || ''),
                time: normalizeTime(normalized.time || ''),
                endTime: normalizeTime(normalized.endTime || ''),
                quantidade_sessoes: normalized.quantidade_sessoes || 0,
                roomId: String(normalized.roomId || '').trim(),
                clientName: normalized.clientName || '',
                type: normalized.type || '',
                observations: normalized.observations || '',
                status: normalized.status || 'agendado'
            };
        }

        function areAppointmentsDifferent(localList, serverList) {
            const localNormalized = localList.map(normalizeAppointmentForComparison);
            const serverNormalized = serverList.map(normalizeAppointmentForComparison);

            if (localNormalized.length !== serverNormalized.length) {
                return true;
            }

            const sortedLocal = localNormalized.sort((a, b) => (a.id || '').localeCompare(b.id || '') || (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
            const sortedServer = serverNormalized.sort((a, b) => (a.id || '').localeCompare(b.id || '') || (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

            for (let i = 0; i < sortedLocal.length; i++) {
                if (JSON.stringify(sortedLocal[i]) !== JSON.stringify(sortedServer[i])) {
                    return true;
                }
            }
            return false;
        }

        function areProfessionalsDifferent(localList, serverList) {
            const localNormalized = localList.map(normalizeProfessionalRecord);
            const serverNormalized = serverList.map(normalizeProfessionalRecord);

            if (localNormalized.length !== serverNormalized.length) {
                return true;
            }

            const sortedLocal = localNormalized.sort((a, b) => (a.id || '').localeCompare(b.id || '') || (a.name || '').localeCompare(b.name || ''));
            const sortedServer = serverNormalized.sort((a, b) => (a.id || '').localeCompare(b.id || '') || (a.name || '').localeCompare(b.name || ''));

            for (let i = 0; i < sortedLocal.length; i++) {
                if (JSON.stringify(sortedLocal[i]) !== JSON.stringify(sortedServer[i])) {
                    return true;
                }
            }
            return false;
        }

        function normalizeServerSyncState(state) {
            if (!state || !state.success) return null;
            return {
                agendamentos: state.agendamentos || {},
                profissionais: state.profissionais || {},
                configuracoes: state.configuracoes || {},
                remarques: state.remarques || {}
            };
        }

        function areSyncStatesEqual(a, b) {
            return JSON.stringify(a || {}) === JSON.stringify(b || {});
        }

        function isSyncSectionChanged(previousState, nextState, sectionName) {
            return JSON.stringify((previousState && previousState[sectionName]) || {}) !== JSON.stringify((nextState && nextState[sectionName]) || {});
        }

        function hasAgendaSyncStateChanged(previousState, nextState) {
            return isSyncSectionChanged(previousState, nextState, 'agendamentos')
                || isSyncSectionChanged(previousState, nextState, 'profissionais');
        }

        function rerenderOpenAppointmentActions() {
            const appointmentId = document.getElementById('appointmentId')?.value;
            if (!appointmentId) return;
            const openAppointment = getAppointmentById(appointmentId);
            if (openAppointment) {
                showAppointmentActionOptions(openAppointment, { skipRemarkConfigRefresh: true });
            }
        }

        async function refreshLiveStateForServerChanges(previousState, nextState) {
            if (!previousState || !nextState) return;

            const configChanged = isSyncSectionChanged(previousState, nextState, 'configuracoes');
            const remarquesChanged = isSyncSectionChanged(previousState, nextState, 'remarques');
            if (!configChanged && !remarquesChanged) return;

            const refreshTasks = [];
            if (configChanged) {
                refreshTasks.push(fetchRemarkConfigFromServer());
            }
            if (remarquesChanged) {
                refreshTasks.push(fetchRemarkRequestsFromServer({ force: true }));
            }

            await Promise.allSettled(refreshTasks);
            updateRemarkConfigUi();
            updateRemarkBadges();

            if (configChanged) {
                rerenderOpenAppointmentActions();
            }

            const requestsModal = document.getElementById('remarkRequestsModal');
            if (remarquesChanged && requestsModal && requestsModal.classList.contains('active')) {
                renderRemarkRequestsList();
            }
        }

        async function fetchServerSyncState() {
            try {
                const response = await fetch(apiUrl('/api/sync-state'), { cache: 'no-store' });
                return normalizeServerSyncState(await response.json());
            } catch (err) {
                console.warn('[checkServerUpdates] Estado leve indisponivel, usando verificacao completa:', err);
                return null;
            }
        }

        async function checkServerUpdates() {
            const modal = document.getElementById('refreshModal');
            if (modal && modal.classList.contains('active')) {
                return;
            }

            try {
                const now = Date.now();
                const shouldRunFullCheck = !lastFullServerCheckAt || (now - lastFullServerCheckAt) >= FULL_REFRESH_CHECK_INTERVAL_MS;
                const previousServerState = lastServerSyncState;
                const serverState = await fetchServerSyncState();
                if (serverState) {
                    await refreshLiveStateForServerChanges(previousServerState, serverState);
                }
                if (serverState && !shouldRunFullCheck && previousServerState && areSyncStatesEqual(serverState, previousServerState)) {
                    return;
                }
                if (serverState) {
                    lastServerSyncState = serverState;
                }
                if (serverState && !shouldRunFullCheck && previousServerState && !hasAgendaSyncStateChanged(previousServerState, serverState)) {
                    return;
                }

                const [profRes, aptRes] = await Promise.all([
                    fetch(apiUrl('/api/profissionais')),
                    fetch(apiUrl('/api/agendamentos?force=1'))
                ]);
                lastFullServerCheckAt = now;

                const profData = await profRes.json();
                const aptData = await aptRes.json();

                const serverProfessionals = Array.isArray(profData.profissionais) ? profData.profissionais : [];
                const serverAppointments = Array.isArray(aptData.agendamentos) ? aptData.agendamentos : [];

                const hasProfessionalChanges = areProfessionalsDifferent(professionals, serverProfessionals);
                const hasAppointmentChanges = areAppointmentsDifferent(appointments, serverAppointments);

                if (hasProfessionalChanges || hasAppointmentChanges) {
                    debugLog('[checkServerUpdates] Novas alterações detectadas no servidor.', { hasProfessionalChanges, hasAppointmentChanges });
                    pendingServerUpdate = true;
                    showServerRefreshModal();
                }
            } catch (err) {
                console.warn('[checkServerUpdates] Erro ao verificar atualizações do servidor:', err);
            }
        }

        async function refreshFromServer() {
            pendingServerUpdate = false;
            closeModal('refreshModal');
            showLoading('Atualizando dados', 'Buscando alterações no servidor...');
            await fetchProfessionalsFromServer();
            await fetchRoomsFromServer();
            await fetchAppointmentsFromServer({ force: true });
            await fetchRemarkConfigFromServer();
            await fetchRemarkRequestsFromServer({ force: true });
            lastServerSyncState = await fetchServerSyncState();
            lastFullServerCheckAt = Date.now();
            updateRemarkConfigUi();
            updateRemarkBadges();
            refreshActiveScheduleViews();
            hideLoading();
            showSuccessMessage('✅ A agenda foi atualizada com os dados mais recentes do servidor.');
        }

        function dismissServerUpdatePrompt() {
            pendingServerUpdate = false;
            closeModal('refreshModal');
        }

        function showServerRefreshModal() {
            const modal = document.getElementById('refreshModal');
            if (!modal) {
                return;
            }
            pendingServerUpdate = true;
            modal.classList.add('active');
        }

        async function checkServerUpdatesManual() {
            const btn = document.getElementById('refreshHeaderBtn');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '⏳ Verificando...';
            }

            await checkServerUpdates();

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '🔄 Atualizar';
            }
        }

        function updateHeaderWithUserInfo() {
            const headerDiv = document.querySelector('.bg-white.rounded-lg.shadow-lg.p-3.mb-3');
            
            // Remove existing user info if present
            const existingUserInfo = headerDiv.querySelector('.user-info');
            if (existingUserInfo) {
                existingUserInfo.remove();
            }
            
            // Add user info
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info flex justify-between items-center mb-3 bg-blue-50 p-3 rounded-lg';
            
            const levelIcons = {
                admin: '👑',
                editor: '✏️',
                viewer: '👁️'
            };
            
            const levelNames = {
                admin: 'Administrador',
                editor: 'Editor',
                viewer: 'Visualizador'
            };
            
            const levelColors = {
                admin: 'text-red-600',
                editor: 'text-blue-600',
                viewer: 'text-green-600'
            };
            
            userInfo.innerHTML = `
                <div class="flex items-center space-x-3">
                    <span class="text-2xl">${levelIcons[currentUser.level]}</span>
                    <div>
                        <div class="font-bold ${levelColors[currentUser.level]}">${currentUser.name}</div>
                        <div class="text-sm text-gray-600">Nível: ${levelNames[currentUser.level]}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="checkServerUpdatesManual()" id="refreshHeaderBtn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors" title="Verificar atualizações do servidor">
                        🔄 Atualizar
                    </button>
                    <button onclick="logout()" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors">
                        🚪 Sair
                    </button>
                </div>
            `;
            
            // Insert after the logo/header brand.
            const brand = headerDiv.querySelector('.system-header-brand') || headerDiv.querySelector('h1');
            if (brand && brand.parentNode) {
                brand.parentNode.insertBefore(userInfo, brand.nextSibling);
            } else {
                headerDiv.insertBefore(userInfo, headerDiv.firstChild);
            }
        }

        function updateUIBasedOnPermissions() {
            // Get all action buttons
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
                const buttonText = button.textContent.toLowerCase();
                const isPermissionControlled =
                    buttonText.includes('cadastrar') ||
                    buttonText.includes('agendar') ||
                    buttonText.includes('excel') ||
                    buttonText.includes('ediÃ§Ã£o em lote') ||
                    buttonText.includes('profissionais') ||
                    buttonText.includes('pacientes') ||
                    buttonText.includes('gerenciar usuÃ¡rios') ||
                    button.id === 'btnCreateProfessional' ||
                    button.id === 'btnCreatePatient' ||
                    button.id === 'btnBulkCancelAppointments';
                if (isPermissionControlled) {
                    button.style.display = '';
                }
            });
            
            buttons.forEach(button => {
                const buttonText = button.textContent.toLowerCase();
                
                // Hide/show buttons based on permissions
                if (buttonText.includes('cadastrar') && !userPermissions.canCreate) {
                    button.style.display = 'none';
                }
                
                if (buttonText.includes('agendar') && !userPermissions.canCreate) {
                    button.style.display = 'none';
                }
                
                if (button.id === 'btnCreateProfessional' && !userPermissions.canCreateProfessional) {
                    button.style.display = 'none';
                }
                
                if (button.id === 'btnCreatePatient' && !userPermissions.canCreatePatient) {
                    button.style.display = 'none';
                }
                
                if (buttonText.includes('excel') && !userPermissions.canExport) {
                    button.style.display = 'none';
                }
                
                if (buttonText.includes('edição em lote') && !userPermissions.canBulkEdit) {
                    button.style.display = 'none';
                }
                if (button.id === 'btnBulkCancelAppointments' && !userPermissions.canBulkCancel) {
                    button.style.display = 'none';
                }
                
                if (buttonText.includes('profissionais') && !userPermissions.canView) {
                    button.style.display = 'none';
                }
                
                if (buttonText.includes('pacientes') && !userPermissions.canViewPatients) {
                    button.style.display = 'none';
                }
                
                if (buttonText.includes('gerenciar usuários') && !userPermissions.canManageUsers) {
                    button.style.display = 'none';
                }
            });

            const exportReportButton = document.getElementById('exportReportButton');
            if (exportReportButton) {
                exportReportButton.style.display = checkPermission('exportReport') ? 'block' : 'none';
            }
            
            // Always hide reset button initially - only admins can see it through sequence
            const resetButton = document.getElementById('hiddenResetButton');
            if (resetButton) {
                resetButton.style.display = 'none';
            }
            // Show/hide main "Limpar Tudo" button based on permission
            const clearAllBtn = document.getElementById('clearAllButton');
            if (clearAllBtn) {
                if (userPermissions && userPermissions.canSystemReset) {
                    clearAllBtn.style.display = 'inline-block';
                } else {
                    clearAllBtn.style.display = 'none';
                }
            }

            const remarkRequestsButton = document.getElementById('remarkRequestsButton');
            if (remarkRequestsButton) {
                remarkRequestsButton.style.display = canAuthorizeRemarkRequests() ? 'inline-block' : 'none';
            }
            updateRemarkBadges();
            updateRemarkConfigUi();
            
            // Update professional cards based on permissions
            updateProfessionalCardsPermissions();
        }

        // User Management Functions
        function openUserManagementModal() {
            if (!checkPermission('manageUsers')) {
                showPermissionDenied('manageUsers');
                return;
            }
            
            populateUserProfessionalSelects();
            loadUsersTable();
            updateUserStats();
            document.getElementById('userManagementModal').classList.add('active');
        }

        function populateUserProfessionalSelects() {
            const newUserSelect = document.getElementById('newUserProfessional');
            const editUserSelect = document.getElementById('editUserProfessional');
            if (!newUserSelect || !editUserSelect) return;

            const professionalOptions = ['<option value="">Selecione o profissional...</option>'];
            const activeProfessionals = professionals.filter(prof => prof.active !== false);
            activeProfessionals.forEach(prof => {
                professionalOptions.push(`<option value="${prof.id}">${prof.name}</option>`);
            });

            newUserSelect.innerHTML = professionalOptions.join('');
            editUserSelect.innerHTML = professionalOptions.join('');
        }

        function createNewUser(event) {
            event.preventDefault();
            
            if (!checkPermission('manageUsers')) {
                showPermissionDenied('manageUsers');
                return;
            }
            
            const username = document.getElementById('newUsername').value.toLowerCase().trim();
            const name = document.getElementById('newUserName').value.trim();
            const password = document.getElementById('newUserPassword').value;
            const level = document.getElementById('newUserLevel').value;
            const notes = document.getElementById('newUserNotes').value.trim();
            const profissional_id = document.getElementById('newUserProfessional').value || null;

            // Password required
            if (!password || password.trim() === '') {
                alert('❌ Senha é obrigatória!');
                return;
            }
            
            // Validate username format
            if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
                alert('❌ Nome de usuário inválido!\n\nUse apenas letras, números, pontos, hífens e underscores.');
                return;
            }
            
            // Check if username already exists
            if (users[username]) {
                alert('❌ Nome de usuário já existe!\n\nEscolha um nome diferente.');
                return;
            }
            
            // Create new user
            const newUser = {
                level: level,
                name: name,
                professionalId: profissional_id,
                notes: notes || '',
                isDefault: false,
                createdBy: currentUser.username,
                createdAt: new Date().toISOString(),
                lastLogin: null,
                isActive: true
            };
            
            // Save to backend (Flask -> Supabase)
            fetch("http://127.0.0.1:5000/api/usuarios", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    level: level,
                    name: name,
                    profissional_id: profissional_id,
                    notes: notes,
                    createdBy: currentUser ? currentUser.username : 'system'
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success) {
                    // persist locally as well
                    users[username] = newUser;
                    saveUsers();

                    // Clear form and update UI
                    clearNewUserForm();
                    loadUsersTable();
                    updateUserStats();

                    showSuccessMessage(`✅ Usuário "${name}" criado com sucesso e salvo no banco!`);
                } else {
                    console.error('API error:', data);
                    alert('❌ Erro ao salvar usuário no servidor: ' + (data && data.error ? data.error : 'Resposta inválida.'));
                }
            })
            .catch(err => {
                console.error('Fetch error:', err);
                // Fallback: save locally but warn the user
                alert('Erro ao criar usuário no servidor. Tente novamente.');
                return;

                showSuccessMessage(`✅ Usuário "${name}" criado localmente (fallback).\nSincronize manualmente quando a API estiver disponível.`);
            });

            
            
            // Clear form
            clearNewUserForm();
            
            // Reload table and stats
            loadUsersTable();
            updateUserStats();
            
            showSuccessMessage(`✅ Usuário "${name}" criado com sucesso!\nNome de usuário: ${username}\nNível: ${getLevelLabel(level)}`);
        }


        function clearNewUserForm() {
            document.getElementById('newUserName').value = '';
            document.getElementById('newUsername').value = '';
            document.getElementById('newUserPassword').value = '';
            document.getElementById('newUserLevel').value = '';
            document.getElementById('newUserProfessional').value = '';
            document.getElementById('newUserNotes').value = '';
        }

        // Fetch users from backend and merge into local users cache
        function fetchUsersFromServer() {
            fetch(apiUrl('/api/usuarios'))
                .then(res => res.json())
                .then(data => {
                    if (data && data.success && Array.isArray(data.users)) {
                        let changed = false;
                        data.users.forEach(u => {
                            // Only merge non-sensitive metadata from the server
                            if (!users[u.username]) {
                                users[u.username] = {
                                    level: u.level || 'viewer',
                                    name: u.name || '',
                                    professionalId: u.professionalId || null,
                                    notes: '',
                                    createdAt: u.created_at || null,
                                    isDefault: false,
                                    isActive: true
                                };
                                changed = true;
                            } else {
                                // update metadata from server
                                users[u.username].level = u.level || users[u.username].level;
                                users[u.username].name = u.name || users[u.username].name;
                                users[u.username].createdAt = u.created_at || users[u.username].createdAt;
                                if ((u.professionalId || u.profissional_id) && !users[u.username].professionalId) {
                                    users[u.username].professionalId = u.professionalId || u.profissional_id;
                                }
                                changed = true;
                            }
                        });

                        if (changed) {
                            saveUsers();
                        }
                    }
                })
                .catch(err => {
                    console.warn('Não foi possível sincronizar usuários com o servidor:', err);
                });
        }

        function loadUsersTable() {
            const container = document.getElementById('usersTableContainer');
            const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
            const levelFilter = document.getElementById('userLevelFilter').value;
            
            // Filter users
            const filteredUsers = Object.entries(users).filter(([username, user]) => {
                const matchesSearch = !searchTerm || 
                    username.toLowerCase().includes(searchTerm) || 
                    user.name.toLowerCase().includes(searchTerm);
                const matchesLevel = !levelFilter || user.level === levelFilter;
                
                return matchesSearch && matchesLevel;
            });
            
            if (filteredUsers.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <div class="text-4xl mb-3">👥</div>
                        <div class="text-lg font-medium">Nenhum usuário encontrado</div>
                        <div class="text-sm">Ajuste os filtros ou crie um novo usuário</div>
                    </div>
                `;
                return;
            }
            
            let tableHtml = `
                <table class="w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nível</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profissional</th>
                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último Login</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
            `;
            
            filteredUsers.forEach(([username, user]) => {
                const levelIcon = getLevelIcon(user.level);
                const levelLabel = getLevelLabel(user.level);
                const levelColor = getLevelColor(user.level);
                const isCurrentUser = username === currentUser.username;
                const canEdit = !user.isDefault || isCurrentUser;
                const canDelete = !user.isDefault && !isCurrentUser;
                
                const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A';
                const lastLoginDate = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('pt-BR') : 'Nunca';
                
                tableHtml += `
                    <tr class="hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50' : ''}">
                        <td class="px-4 py-3">
                            <div class="font-medium text-gray-900">${username}</div>
                            ${user.notes ? `<div class="text-xs text-gray-500">${user.notes}</div>` : ''}
                            ${isCurrentUser ? '<div class="text-xs text-blue-600 font-medium">👤 Você</div>' : ''}
                        </td>
                        <td class="px-4 py-3 text-gray-900">${user.name}</td>
                        <td class="px-4 py-3">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${levelColor}">
                                ${levelIcon} ${levelLabel}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-gray-900">${getProfessionalLabel(user.professionalId)}</td>
                        <td class="px-4 py-3">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                ${user.isActive !== false ? '✅ Ativo' : '❌ Inativo'}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-500">
                            ${createdDate}
                            ${user.createdBy ? `<div class="text-xs">por ${user.createdBy}</div>` : ''}
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-500">${lastLoginDate}</td>
                        <td class="px-4 py-3">
                            <div class="flex space-x-2">
                                ${canEdit ? `
                                    <button onclick="editUser('${username}')" 
                                            class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs">
                                        ✏️ Editar
                                    </button>
                                ` : ''}
                                ${canDelete ? `
                                    <button onclick="toggleUserStatus('${username}')" 
                                            class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs">
                                        ${user.isActive !== false ? '⏸️ Inativar' : '▶️ Ativar'}
                                    </button>
                                    <button onclick="deleteUser('${username}')" 
                                            class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">
                                        🗑️ Excluir
                                    </button>
                                ` : ''}
                                ${user.isDefault ? `
                                    <span class="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                                        🔒 Sistema
                                    </span>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            tableHtml += '</tbody></table>';
            container.innerHTML = tableHtml;
        }

        function updateUserStats() {
            const container = document.getElementById('userStats');
            
            const totalUsers = Object.keys(users).length;
            const adminCount = Object.values(users).filter(u => u.level === 'admin').length;
            const editorCount = Object.values(users).filter(u => u.level === 'editor').length;
            const viewerCount = Object.values(users).filter(u => u.level === 'viewer').length;
            const activeCount = Object.values(users).filter(u => u.isActive !== false).length;
            
            container.innerHTML = `
                <div class="bg-white p-3 rounded border">
                    <div class="text-2xl font-bold text-blue-600">${totalUsers}</div>
                    <div class="text-sm text-gray-600">Total de Usuários</div>
                </div>
                <div class="bg-white p-3 rounded border">
                    <div class="text-2xl font-bold text-red-600">${adminCount}</div>
                    <div class="text-sm text-gray-600">👑 Administradores</div>
                </div>
                <div class="bg-white p-3 rounded border">
                    <div class="text-2xl font-bold text-blue-600">${editorCount}</div>
                    <div class="text-sm text-gray-600">✏️ Editores</div>
                </div>
                <div class="bg-white p-3 rounded border">
                    <div class="text-2xl font-bold text-green-600">${viewerCount}</div>
                    <div class="text-sm text-gray-600">👁️ Visualizadores</div>
                </div>
            `;
        }

        function filterUsers() {
            loadUsersTable();
        }

        function clearUserFilters() {
            document.getElementById('userSearchInput').value = '';
            document.getElementById('userLevelFilter').value = '';
            loadUsersTable();
        }

        function editUser(username) {
            const user = users[username];
            if (!user) return;
            
            // Only allow editing other users if you have manageUsers permission
            if (username !== currentUser.username && !checkPermission('manageUsers')) {
                showPermissionDenied('manageUsers');
                return;
            }
            
            document.getElementById('editUserId').value = username;
            document.getElementById('editUserName').value = user.name;
            document.getElementById('editUsername').value = username;
            document.getElementById('editUserPassword').value = '';
            document.getElementById('editUserLevel').value = user.level;
            document.getElementById('editUserProfessional').value = user.professionalId || '';
            document.getElementById('editUserNotes').value = user.notes || '';
            
            document.getElementById('editUserModal').classList.add('active');
        }

        function saveUserEdit(event) {
            event.preventDefault();
            
            const username = document.getElementById('editUserId').value;
            const name = document.getElementById('editUserName').value.trim();
            const newPassword = document.getElementById('editUserPassword').value;
            const level = document.getElementById('editUserLevel').value;
            const professionalId = document.getElementById('editUserProfessional').value || null;
            const notes = document.getElementById('editUserNotes').value.trim();
            
            // Editing other users requires manageUsers permission
            if (username !== currentUser.username && !checkPermission('manageUsers')) {
                showPermissionDenied('manageUsers');
                return;
            }
            
            if (!users[username]) {
                alert('❌ Usuário não encontrado!');
                return;
            }
            
            // Update user data
            users[username].name = name;
            users[username].level = level;
            users[username].professionalId = professionalId;
            users[username].notes = notes;
            
            if (username === currentUser.username) {
                currentUser.professionalId = professionalId;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
            
            delete users[username].password;
            
            // Update modification info
            users[username].lastModifiedBy = currentUser.username;
            users[username].lastModifiedAt = new Date().toISOString();
            
            // Update on backend
            fetch(`http://127.0.0.1:5000/api/usuarios/${encodeURIComponent(username)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    password: newPassword || undefined,
                    level: level,
                    professionalId: professionalId,
                    isActive: users[username].isActive !== false
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success) {
                    debugLog('Usuário atualizado no banco:', data);
                } else {
                    console.warn('Atualização no servidor falhou:', data);
                }
            })
            .catch(err => {
                console.error('Erro ao atualizar usuário no servidor:', err);
            });

            
            // If editing current user, update current session
            if (username === currentUser.username) {
                currentUser.name = name;
                currentUser.level = level;
                userPermissions = permissions[level];
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateHeaderWithUserInfo();
                updateUIBasedOnPermissions();
            }
            
            closeModal('editUserModal');
            loadUsersTable();
            updateUserStats();
            
            showSuccessMessage(`✅ Usuário "${name}" atualizado com sucesso!`);
        }

        function toggleUserStatus(username) {
            if (!checkPermission('manageUsers')) {
                showPermissionDenied('manageUsers');
                return;
            }
            const user = users[username];
            if (!user || user.isDefault) {
                alert('❌ Não é possível alterar o status deste usuário!');
                return;
            }
            
            const newStatus = user.isActive === false;
            const action = newStatus ? 'ativar' : 'inativar';
            
            if (confirm(`🔄 Deseja ${action} o usuário "${user.name}"?\n\n${newStatus ? 'O usuário poderá fazer login novamente.' : 'O usuário não poderá mais fazer login.'}`)) {
                // Try to sync with backend
                fetch(`http://127.0.0.1:5000/api/usuarios/${encodeURIComponent(username)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: newStatus })
                })
                .then(res => res.json())
                .then(data => {
                    if (data && data.success) {
                        users[username].isActive = newStatus;
                        users[username].lastModifiedBy = currentUser.username;
                        users[username].lastModifiedAt = new Date().toISOString();
                        saveUsers();
                        loadUsersTable();
                        updateUserStats();
                        const actionPast = newStatus ? 'ativado' : 'inativado';
                        showSuccessMessage(`✅ Usuário "${user.name}" foi ${actionPast} com sucesso!`);
                    } else {
                        console.error('Erro ao atualizar status no servidor:', data);
                        alert('❌ Erro ao atualizar status do usuário no servidor. Veja o console para detalhes.');
                    }
                })
                .catch(err => {
                    console.error('Erro ao atualizar status:', err);
                    // Fallback local change
                    users[username].isActive = newStatus;
                    users[username].lastModifiedBy = currentUser.username;
                    users[username].lastModifiedAt = new Date().toISOString();
                    saveUsers();
                    loadUsersTable();
                    updateUserStats();
                    const actionPast = newStatus ? 'ativado' : 'inativado';
                    showSuccessMessage(`✅ Usuário "${user.name}" foi ${actionPast} localmente (fallback).`);
                });
            }
        }

        function deleteUser(username) {
            if (!checkPermission('manageUsers')) {
                showPermissionDenied('manageUsers');
                return;
            }
            const user = users[username];
            if (!user) return;
            
            if (user.isDefault) {
                alert('❌ Não é possível excluir usuários do sistema!');
                return;
            }
            
            if (username === currentUser.username) {
                alert('❌ Você não pode excluir sua própria conta!');
                return;
            }
            
            const confirmMessage = `🗑️ CONFIRMAR EXCLUSÃO DE USUÁRIO\n\n` +
                `Nome: ${user.name}\n` +
                `Usuário: ${username}\n` +
                `Nível: ${getLevelLabel(user.level)}\n` +
                `Criado em: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A'}\n\n` +
                `⚠️ Esta ação não pode ser desfeita!\n\n` +
                `Deseja realmente excluir este usuário?`;
            
            if (confirm(confirmMessage)) {
                // Try delete on backend first
                fetch(`http://127.0.0.1:5000/api/usuarios/${encodeURIComponent(username)}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                    if (data && data.success) {
                        delete users[username];
                        saveUsers();
                        loadUsersTable();
                        updateUserStats();
                        showSuccessMessage(`🗑️ Usuário "${user.name}" foi excluído permanentemente!`);
                    } else {
                        console.error('Erro ao excluir no servidor:', data);
                        alert('❌ Erro ao excluir usuário no servidor. Veja o console para detalhes.');
                    }
                })
                .catch(err => {
                    console.error('Erro ao excluir usuário:', err);
                    // Fallback to local delete with warning
                    delete users[username];
                    saveUsers();
                    loadUsersTable();
                    updateUserStats();
                    showSuccessMessage(`🗑️ Usuário "${user.name}" excluído localmente (fallback).`);
                });
            }
        }

        function saveUsers() {
            Object.keys(users || {}).forEach(username => {
                if (users[username]) {
                    delete users[username].password;
                }
            });
            localStorage.setItem('systemUsers', JSON.stringify(users));
        }

        // Automated test helper for user management (call from browser console)
        function runUserManagementTests() {
            console.warn('runUserManagementTests desativado nesta versão: usuários e senhas são validados somente no servidor.');
            return [];
            const results = [];
            try {
                // Ensure admin exists
                if (!users.admin) {
                    users.admin = defaultUsers.admin;
                    saveUsers();
                }

                // Set current admin session for the test
                currentUser = { username: 'admin', password: users.admin.password, level: 'admin', name: users.admin.name };
                userPermissions = permissions[currentUser.level];

                const testUsername = 'testuser_' + Date.now().toString().slice(-6);

                // Create user
                const newUser = {
                    password: 'testpass',
                    level: 'editor',
                    name: 'User Test',
                    notes: 'automated test',
                    isDefault: false,
                    createdBy: currentUser.username,
                    createdAt: new Date().toISOString(),
                    lastLogin: null,
                    isActive: true
                };

                users[testUsername] = newUser;
                saveUsers();
                results.push({ step: 'create', success: !!users[testUsername] });

                // Duplicate check (attempt to create same user should leave existing)
                const duplicateBefore = !!users[testUsername];
                // Simulate createNewUser duplicate handling
                if (users[testUsername]) {
                    results.push({ step: 'duplicateCreate', success: true });
                } else {
                    results.push({ step: 'duplicateCreate', success: false });
                }

                // Edit user
                users[testUsername].name = 'User Test Edited';
                users[testUsername].level = 'viewer';
                users[testUsername].password = 'newpass';
                users[testUsername].lastModifiedBy = currentUser.username;
                users[testUsername].lastModifiedAt = new Date().toISOString();
                saveUsers();
                results.push({ step: 'edit', success: users[testUsername].name === 'User Test Edited' && users[testUsername].level === 'viewer' });

                // Toggle status
                users[testUsername].isActive = false; saveUsers();
                results.push({ step: 'deactivate', success: users[testUsername].isActive === false });
                users[testUsername].isActive = true; saveUsers();
                results.push({ step: 'reactivate', success: users[testUsername].isActive === true });

                // Delete user
                delete users[testUsername]; saveUsers();
                results.push({ step: 'delete', success: !users[testUsername] });

                // Refresh UI
                if (typeof loadUsersTable === 'function') loadUsersTable();
                if (typeof updateUserStats === 'function') updateUserStats();

                showSuccessMessage('🔬 Testes de usuário concluídos com sucesso!');
            } catch (err) {
                results.push({ step: 'error', error: err.message });
                console.error(err);
                showSuccessMessage('⚠️ Erro durante testes. Veja o console para detalhes.');
            }

            debugLog('runUserManagementTests results:', results);
            return results;
        }

        function getLevelIcon(level) {
            const icons = {
                admin: '👑',
                editor: '✏️',
                viewer: '👁️'
            };
            return icons[level] || '❓';
        }

        function getLevelLabel(level) {
            const labels = {
                admin: 'Administrador',
                editor: 'Editor',
                viewer: 'Visualizador'
            };
            return labels[level] || 'Desconhecido';
        }

        function getLevelColor(level) {
            const colors = {
                admin: 'bg-red-100 text-red-800',
                editor: 'bg-blue-100 text-blue-800',
                viewer: 'bg-green-100 text-green-800'
            };
            return colors[level] || 'bg-gray-100 text-gray-800';
        }

        function updateProfessionalCardsPermissions() {
            // This will be called when professional cards are loaded
            setTimeout(() => {
                const deleteButtons = document.querySelectorAll('button[onclick*="deleteProfessional"]');
                deleteButtons.forEach(button => {
                    // Only show delete button for users that have delete permission AND are admin-level
                    if (!(userPermissions && userPermissions.canDelete && currentUser && currentUser.level === 'admin')) {
                        button.style.display = 'none';
                    }
                });
            }, 100);
        }

        // Override functions to check permissions
        function checkPermission(action) {
            // If permissions not initialized, deny by default
            if (!userPermissions) return false;
            switch(action) {
                case 'create':
                    return !!userPermissions.canCreate;
                case 'edit':
                    return !!userPermissions.canEdit;
                case 'delete':
                    return !!userPermissions.canDelete;
                case 'export':
                    return !!userPermissions.canExport;
                case 'import':
                    return !!userPermissions.canImport;
                case 'bulkEdit':
                    return !!userPermissions.canBulkEdit;
                case 'bulkCancel':
                    return !!userPermissions.canBulkCancel;
                case 'systemReset':
                    return !!userPermissions.canSystemReset;
                case 'manageProfessionals':
                    return !!userPermissions.canManageProfessionals;
                case 'manageUsers':
                    return !!userPermissions.canManageUsers;
                case 'createProfessional':
                    return !!userPermissions.canCreateProfessional;
                case 'createPatient':
                    return !!userPermissions.canCreatePatient;
                case 'editProfessional':
                    return !!userPermissions.canEditProfessionals;
                case 'editPatient':
                    return !!userPermissions.canEditPatients;
                case 'view':
                    return !!userPermissions.canView;
                case 'viewPatients':
                    return !!userPermissions.canViewPatients;
                case 'exportReport':
                    return !!userPermissions.canExportReport;
                case 'bulkCancel':
                    return !!userPermissions.canBulkCancel;
                default:
                    return false;
            }
        }

        function showPermissionDenied(action) {
            const actionNames = {
                create: 'criar',
                edit: 'editar',
                delete: 'excluir',
                export: 'exportar',
                exportReport: 'exportar relatório de agendamentos',
                import: 'importar',
                bulkEdit: 'edição em lote',
                bulkCancel: 'cancelar agendamentos em massa',
                systemReset: 'resetar sistema',
                manageProfessionals: 'gerenciar profissionais',
                manageUsers: 'gerenciar usuários',
                view: 'visualizar',
                viewPatients: 'visualizar pacientes'
            }; 
            
            const levelNames = {
                admin: 'Administrador',
                editor: 'Editor',
                viewer: 'Visualizador'
            };
            
            alert(`🚫 ACESSO NEGADO\n\nVocê não tem permissão para ${actionNames[action]}.\n\nSeu nível atual: ${levelNames[currentUser.level]}\n\nContate um administrador se precisar de mais permissões.`);
        }

        // View Management
        function showHomeView() {
            hideAllViews();
            document.getElementById('homeView').style.display = 'block';
            currentView = 'home';
        }

        function showScheduleView() {
            hideAllViews();
            document.getElementById('scheduleView').style.display = 'block';
            currentView = 'schedule';
            loadScheduleGrid();
            syncAppointmentsForAgendaView();
        }

        async function showDailyPanelView() {
            hideAllViews();
            const view = document.getElementById('dailyPanelView');
            if (view) {
                view.style.display = 'block';
            }
            currentView = 'dailyPanel';
            const dateInput = document.getElementById('dailyPanelDate');
            if (dateInput && !dateInput.value) {
                dateInput.value = formatDate(new Date());
            }
            await ensureProfessionalsLoaded();
            await ensureRoomsLoaded();
            populateDailyPanelProfessionalFilter();
            renderDailyPanel();
            syncAppointmentsForAgendaView();
        }

        async function showWaitlistView() {
            hideAllViews();
            const view = document.getElementById('waitlistView');
            const accessNote = document.getElementById('waitlistAccessNote');
            const createButton = document.getElementById('waitlistCreateButton');
            if (view) {
                view.style.display = 'block';
            }
            currentView = 'waitlist';
            if (!canManageWaitlist()) {
                if (createButton) createButton.classList.add('hidden');
                if (accessNote) {
                    accessNote.textContent = 'Lista de espera disponivel para Administrador, Editor, ATAC, Recepcao e CEO.';
                    accessNote.classList.remove('hidden');
                }
                renderWaitlist();
                return;
            }
            if (createButton) createButton.classList.remove('hidden');
            if (accessNote) accessNote.classList.add('hidden');
            await Promise.all([ensureProfessionalsLoaded(), ensureRoomsLoaded(), fetchWaitlistOptions()]);
            populateWaitlistFormOptions();
            await refreshWaitlist();
        }

        function showProfessionalsView() {
            if (!checkPermission('manageProfessionals')) {
                showPermissionDenied('manageProfessionals');
                return;
            }
            hideAllViews();
            document.getElementById('professionalsView').style.display = 'block';
            currentView = 'professionals';
            loadProfessionalsList();
        }

        function showReports() {
            hideAllViews();
            document.getElementById('reportsView').style.display = 'block';
            currentView = 'reports';
            generateReports();
        }

        async function showWeeklyView() {
            hideAllViews();
            document.getElementById('weeklyView').style.display = 'block';
            currentView = 'weekly';
            await ensureProfessionalsLoaded();
            updateWeeklyProfessionalFilter();
            selectFirstAvailableWeeklyProfessional();
            loadWeeklyScheduleGrid();
            syncAppointmentsForAgendaView();
            return;
            /*
            const numericId = Number(appointmentId);
            if (!Number.isNaN(numericId) && numericId > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (currentUser && currentUser.username && currentUser.password) {
                    headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                }

                const usuarioAcao = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
                fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        release_lock: true,
                        ultima_acao: usuarioAcao
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (!data || !data.success) {
                        appointment.lockedBy = previousState.lockedBy;
                        appointment.lastAction = previousState.lastAction;
                        localStorage.setItem('appointments', JSON.stringify(appointments));
                        refreshActiveScheduleViews();
                        showAppointmentActionOptions(appointment);
                        alert(`ðŸš« ${data?.error || 'Nao foi possivel liberar o bloqueio no servidor.'}`);
                        return;
                    }

                    fetchAppointmentsFromServer();
                    showAppointmentActionOptions(appointment);
                    showSuccessMessage('âœ… Agendamento liberado para alteraÃ§Ã£o por outros usuÃ¡rios.');
                })
                .catch(err => {
                    appointment.lockedBy = previousState.lockedBy;
                    appointment.lastAction = previousState.lastAction;
                    localStorage.setItem('appointments', JSON.stringify(appointments));
                    refreshActiveScheduleViews();
                    showAppointmentActionOptions(appointment);
                    console.warn('Falha ao liberar bloqueio no servidor, alteracao local revertida:', err);
                    alert('ðŸš« Nao foi possivel liberar o bloqueio no servidor.');
                });
                return;
            }
            */
        }

        function hideAllViews() {
            document.getElementById('homeView').style.display = 'none';
            const dailyPanelView = document.getElementById('dailyPanelView');
            if (dailyPanelView) dailyPanelView.style.display = 'none';
            const waitlistView = document.getElementById('waitlistView');
            if (waitlistView) waitlistView.style.display = 'none';
            document.getElementById('scheduleView').style.display = 'none';
            document.getElementById('professionalsView').style.display = 'none';
            document.getElementById('reportsView').style.display = 'none';
            document.getElementById('weeklyView').style.display = 'none';
        }

        function getCurrentUserProfessionalId() {
            return String(currentUser?.professionalId || currentUser?.profissional_id || '').trim();
        }

        function getDailyPanelAccessMode() {
            if (!currentUser) return 'none';
            const level = String(currentUser.level || '').toLowerCase();
            if (hasFullAppointmentStatusAccess()) return 'all';
            if (level === 'editor') return 'select';
            if (level === 'viewer' && getCurrentUserProfessionalId()) return 'own';
            return 'none';
        }

        function populateDailyPanelProfessionalFilter() {
            const wrapper = document.getElementById('dailyPanelProfessionalFilterWrap');
            const select = document.getElementById('dailyPanelProfessionalFilter');
            const note = document.getElementById('dailyPanelScopeNote');
            if (!wrapper || !select) return;

            const accessMode = getDailyPanelAccessMode();
            const currentValue = select.value;
            const activeProfessionals = professionals
                .filter(prof => prof.active !== false)
                .slice()
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

            if (accessMode === 'own') {
                wrapper.classList.add('hidden');
                if (note) {
                    const professional = professionals.find(prof => String(prof.id) === getCurrentUserProfessionalId());
                    note.textContent = `Visualizando somente seus atendimentos${professional ? `: ${professional.name}` : ''}.`;
                    note.classList.remove('hidden');
                }
                select.innerHTML = '';
                return;
            }

            wrapper.classList.remove('hidden');
            if (note) {
                if (accessMode === 'select') {
                    note.textContent = 'Selecione um profissional para ver o painel do dia.';
                    note.classList.remove('hidden');
                } else {
                    note.textContent = '';
                    note.classList.add('hidden');
                }
            }

            const firstOption = accessMode === 'all'
                ? '<option value="">Todos os Profissionais</option>'
                : '<option value="">Selecione um profissional</option>';
            select.innerHTML = firstOption + activeProfessionals.map(prof => (
                `<option value="${escapeAuditHtml(prof.id)}">${escapeAuditHtml(prof.name || 'Profissional')}</option>`
            )).join('');

            if (currentValue && activeProfessionals.some(prof => String(prof.id) === String(currentValue))) {
                select.value = currentValue;
            }
        }

        const AGENDA_FILTER_FIELDS = {
            dailyPanel: {
                search: 'dailyPanelSearch',
                status: 'dailyPanelStatusFilter',
                room: 'dailyPanelRoomFilter'
            },
            schedule: {
                search: 'scheduleAgendaSearch',
                status: 'scheduleStatusFilter',
                room: 'scheduleRoomFilter'
            },
            weekly: {
                search: 'weeklyAgendaSearch',
                status: 'weeklyStatusFilter',
                room: 'weeklyRoomFilter'
            }
        };

        function normalizeAgendaSearchText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        }

        function getAgendaFilterValue(filterKey, fieldName) {
            const fieldId = AGENDA_FILTER_FIELDS[filterKey]?.[fieldName];
            return fieldId ? (document.getElementById(fieldId)?.value || '') : '';
        }

        function getAppointmentSearchText(appointment) {
            const normalized = normalizeAppointmentRecord(appointment || {});
            const professionalName = getProfessionalLabel(normalized.professionalId);
            const roomName = getRoomName(normalized.roomId);
            const status = normalizeScheduleStatus(normalized.status);
            return normalizeAgendaSearchText([
                normalized.clientName,
                normalized.patientId,
                professionalName,
                roomName,
                getTypeLabel(normalized.type),
                normalized.type,
                getStatusLabel(status),
                status,
                normalized.date,
                formatDateBR(normalized.date),
                normalized.time,
                normalized.endTime
            ].filter(Boolean).join(' '));
        }

        function appointmentMatchesAgendaFilters(appointment, filterKey) {
            const normalized = normalizeAppointmentRecord(appointment || {});
            const search = normalizeAgendaSearchText(getAgendaFilterValue(filterKey, 'search'));
            const rawStatusFilter = getAgendaFilterValue(filterKey, 'status');
            const statusFilter = rawStatusFilter ? normalizeScheduleStatus(rawStatusFilter) : '';
            const roomFilter = String(getAgendaFilterValue(filterKey, 'room') || '').trim();

            if (search && !getAppointmentSearchText(normalized).includes(search)) {
                return false;
            }
            if (statusFilter && normalizeScheduleStatus(normalized.status) !== statusFilter) {
                return false;
            }
            if (roomFilter && String(normalized.roomId || '') !== roomFilter) {
                return false;
            }
            return true;
        }

        function filterAgendaAppointments(items, filterKey) {
            return (items || []).filter(appointment => appointmentMatchesAgendaFilters(appointment, filterKey));
        }

        function applyAgendaFilters() {
            refreshActiveScheduleViews();
        }

        function clearAgendaFilters(filterKey) {
            const fields = AGENDA_FILTER_FIELDS[filterKey];
            if (!fields) return;
            Object.values(fields).forEach(fieldId => {
                const element = document.getElementById(fieldId);
                if (element) element.value = '';
            });
            refreshActiveScheduleViews();
        }

        function populateAgendaRoomFilters() {
            const filterIds = ['dailyPanelRoomFilter', 'scheduleRoomFilter', 'weeklyRoomFilter'];
            filterIds.forEach(filterId => {
                const select = document.getElementById(filterId);
                if (!select) return;
                const currentValue = select.value || '';
                select.innerHTML = '<option value="">Todas as salas</option>';
                rooms
                    .filter(room => room.active !== false)
                    .slice()
                    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
                    .forEach(room => {
                        const option = document.createElement('option');
                        option.value = room.id;
                        option.textContent = room.name;
                        select.appendChild(option);
                    });
                if (currentValue && rooms.some(room => String(room.id) === String(currentValue))) {
                    select.value = currentValue;
                }
            });
        }

        function getDailyPanelFilteredAppointments() {
            const dateValue = document.getElementById('dailyPanelDate')?.value || formatDate(new Date());
            const selectedProfessionalId = document.getElementById('dailyPanelProfessionalFilter')?.value || '';
            const accessMode = getDailyPanelAccessMode();

            if (accessMode === 'none') return [];
            if (accessMode === 'select' && !selectedProfessionalId) return [];

            return filterAgendaAppointments(appointments
                .map(normalizeAppointmentRecord)
                .filter(appointment => {
                    if (!isSameDay(appointment.date, dateValue)) return false;
                    if (accessMode === 'own') {
                        return String(appointment.professionalId) === getCurrentUserProfessionalId();
                    }
                    if (selectedProfessionalId) {
                        return String(appointment.professionalId) === String(selectedProfessionalId);
                    }
                    return true;
                })
                .sort((a, b) => {
                    const timeCompare = timeToMinutes(a.time) - timeToMinutes(b.time);
                    if (timeCompare !== 0) return timeCompare;
                    return String(a.clientName || '').localeCompare(String(b.clientName || ''), 'pt-BR');
                }), 'dailyPanel');
        }

        function isDailyPanelAppointmentActive(appointment) {
            const status = normalizeScheduleStatus(appointment.status);
            return !['cancelado_profissional', 'cancelado_paciente', 'faltou'].includes(status);
        }

        function isDailyPanelAppointmentDelayed(appointment, dateValue) {
            const today = formatDate(new Date());
            if (dateValue !== today) return false;
            const status = normalizeScheduleStatus(appointment.status);
            if (!['agendado', 'pre_atendimento', 'confirmado'].includes(status)) return false;
            const startMinutes = timeToMinutes(appointment.time);
            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            return startMinutes > 0 && startMinutes < nowMinutes;
        }

        function renderDailyPanelSummary(items, dateValue) {
            const summary = document.getElementById('dailyPanelSummary');
            if (!summary) return;
            const counts = {
                total: items.length,
                confirmados: items.filter(item => normalizeScheduleStatus(item.status) === 'confirmado').length,
                presentes: items.filter(item => ['chegou', 'em_atendimento'].includes(normalizeScheduleStatus(item.status))).length,
                finalizados: items.filter(item => normalizeScheduleStatus(item.status) === 'finalizado').length,
                faltas: items.filter(item => normalizeScheduleStatus(item.status) === 'faltou').length,
                atrasos: items.filter(item => isDailyPanelAppointmentDelayed(item, dateValue)).length
            };

            const cards = [
                ['Total', counts.total, 'border-gray-200'],
                ['Confirmados', counts.confirmados, 'border-indigo-200'],
                ['Presentes', counts.presentes, 'border-emerald-200'],
                ['Finalizados', counts.finalizados, 'border-green-200'],
                ['Faltas', counts.faltas, 'border-yellow-200'],
                ['Atrasos', counts.atrasos, 'border-red-200']
            ];

            summary.innerHTML = cards.map(([label, value, borderClass]) => `
                <div class="rounded-lg border ${borderClass} bg-white px-3 py-3">
                    <div class="text-xs font-medium uppercase tracking-wide text-gray-500">${label}</div>
                    <div class="mt-1 text-2xl font-bold text-gray-900">${value}</div>
                </div>
            `).join('');
        }

        function renderDailyPanelAppointments(items, dateValue) {
            const container = document.getElementById('dailyPanelAppointments');
            const hint = document.getElementById('dailyPanelListHint');
            if (!container) return;

            if (hint) {
                hint.textContent = `${formatDateBR(dateValue)} - ${items.length} atendimento(s)`;
            }

            if (!items.length) {
                container.innerHTML = '<div class="px-4 py-8 text-center text-sm text-gray-500">Nenhum atendimento encontrado para este recorte.</div>';
                return;
            }

            container.innerHTML = items.map(appointment => {
                const appointmentId = encodeURIComponent(String(appointment.id || ''));
                const status = normalizeScheduleStatus(appointment.status);
                const professionalName = getProfessionalLabel(appointment.professionalId);
                const roomName = getRoomName(appointment.roomId) || 'Sem sala';
                const delayed = isDailyPanelAppointmentDelayed(appointment, dateValue);
                const statusClass = getStatusColor(status);
                return `
                    <button type="button" onclick="openDailyPanelAppointment('${appointmentId}')" class="block w-full px-4 py-3 text-left hover:bg-gray-50">
                        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-bold text-gray-900">${escapeAuditHtml(formatAppointmentTime(appointment))}</span>
                                    <span class="rounded border px-2 py-0.5 text-xs font-medium ${statusClass}">${escapeAuditHtml(getStatusLabel(status))}</span>
                                    ${delayed ? '<span class="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Atrasado</span>' : ''}
                                </div>
                                <div class="mt-1 truncate font-semibold text-gray-800">${escapeAuditHtml(appointment.clientName || 'Paciente')}</div>
                                <div class="mt-0.5 text-sm text-gray-600">${escapeAuditHtml(professionalName)} - ${escapeAuditHtml(getTypeLabel(appointment.type))}</div>
                            </div>
                            <div class="text-sm text-gray-600 md:text-right">
                                <div>${escapeAuditHtml(roomName)}</div>
                                <div class="text-xs text-gray-500">${escapeAuditHtml(appointment.quantidade_sessoes || '')}${appointment.quantidade_sessoes ? ' sessao(oes)' : ''}</div>
                            </div>
                        </div>
                    </button>
                `;
            }).join('');
        }

        function openDailyPanelAppointment(encodedAppointmentId) {
            const appointmentId = decodeURIComponent(encodedAppointmentId || '');
            const appointment = appointments.find(item => String(item.id) === appointmentId);
            if (appointment) {
                editAppointment(normalizeAppointmentRecord(appointment));
            }
        }

        function renderDailyPanelRooms(items) {
            const container = document.getElementById('dailyPanelRooms');
            if (!container) return;
            const roomCounts = new Map();
            items.filter(isDailyPanelAppointmentActive).forEach(appointment => {
                const roomId = String(appointment.roomId || appointment.sala_id || '').trim();
                const roomName = getRoomName(roomId) || (roomId ? `Sala ${roomId}` : 'Sem sala');
                const current = roomCounts.get(roomName) || 0;
                roomCounts.set(roomName, current + 1);
            });
            const roomsList = Array.from(roomCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
            if (!roomsList.length) {
                container.innerHTML = '<div class="px-4 py-8 text-center text-sm text-gray-500">Nenhuma sala em uso neste recorte.</div>';
                return;
            }
            container.innerHTML = roomsList.map(([name, count]) => `
                <div class="flex items-center justify-between gap-3 px-4 py-3">
                    <div class="min-w-0 truncate text-sm font-medium text-gray-800">${escapeAuditHtml(name)}</div>
                    <div class="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">${count}</div>
                </div>
            `).join('');
        }

        function renderDailyPanel() {
            const dateInput = document.getElementById('dailyPanelDate');
            if (dateInput && !dateInput.value) {
                dateInput.value = formatDate(new Date());
            }
            const dateValue = dateInput?.value || formatDate(new Date());
            const items = getDailyPanelFilteredAppointments();
            renderDailyPanelSummary(items, dateValue);
            renderDailyPanelAppointments(items, dateValue);
            renderDailyPanelRooms(items);
        }

        function refreshDailyPanel() {
            renderDailyPanel();
            syncAppointmentsForAgendaView({ force: true });
        }

        // Professional Management
        const PROFESSIONAL_SPECIALTY_SEPARATOR = '; ';

        function splitProfessionalSpecialties(specialty) {
            if (Array.isArray(specialty)) {
                return specialty.map(item => String(item).trim()).filter(Boolean);
            }

            return String(specialty || '')
                .split(/\s*;\s*/)
                .map(item => item.trim())
                .filter(Boolean);
        }

        function getProfessionalSpecialties(professional) {
            return splitProfessionalSpecialties(professional?.specialties || professional?.especialidades || professional?.specialty || professional?.especialidade);
        }

        function updateProfessionalSpecialtyRemoveButtons() {
            const inputs = document.querySelectorAll('[data-specialty-input="true"]');
            const removeButtons = document.querySelectorAll('[data-specialty-remove="true"]');
            removeButtons.forEach(button => {
                button.classList.toggle('hidden', inputs.length <= 1);
            });
        }

        function addProfessionalSpecialtyInput(value = '') {
            const container = document.getElementById('professionalSpecialtiesFields');
            if (!container) return;

            const row = document.createElement('div');
            row.className = 'flex gap-2';

            const input = document.createElement('input');
            input.type = 'text';
            input.setAttribute('list', 'professionalSpecialties');
            input.setAttribute('data-specialty-input', 'true');
            input.required = true;
            input.placeholder = 'Digite ou selecione uma especialidade';
            input.className = 'w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500';
            input.value = value;

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.textContent = '-';
            removeButton.title = 'Remover especialidade';
            removeButton.setAttribute('data-specialty-remove', 'true');
            removeButton.className = 'w-11 shrink-0 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-xl font-bold';
            removeButton.onclick = () => {
                row.remove();
                updateProfessionalSpecialtyRemoveButtons();
            };

            row.appendChild(input);
            row.appendChild(removeButton);
            container.appendChild(row);
            updateProfessionalSpecialtyRemoveButtons();
            input.focus();
        }

        function setProfessionalSpecialtyInputs(specialties = ['']) {
            const container = document.getElementById('professionalSpecialtiesFields');
            if (!container) return;

            container.innerHTML = '';
            const values = specialties.length ? specialties : [''];
            values.forEach((specialty, index) => {
                if (index === 0) {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.id = 'especialidade';
                    input.setAttribute('list', 'professionalSpecialties');
                    input.setAttribute('data-specialty-input', 'true');
                    input.required = true;
                    input.placeholder = 'Digite ou selecione uma especialidade';
                    input.className = 'w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500';
                    input.value = specialty;
                    container.appendChild(input);
                } else {
                    addProfessionalSpecialtyInput(specialty);
                }
            });
            updateProfessionalSpecialtyRemoveButtons();
        }

        function collectProfessionalSpecialties() {
            const inputs = Array.from(document.querySelectorAll('[data-specialty-input="true"]'));
            return [...new Set(inputs.map(input => input.value.trim()).filter(Boolean))];
        }

        function resetProfessionalForm() {
            editingProfessionalId = null;
            document.getElementById('nomeProfissional').value = '';
            setProfessionalSpecialtyInputs(['']);
            document.getElementById('profPhone').value = '';
            document.getElementById('dataNascimentoProfissional').value = '';
            document.getElementById('profEmail').value = '';
            document.getElementById('profCouncilNumber').value = '';
            document.getElementById('profPreference').value = '';
            document.getElementById('profEmergencyContact').value = '';
            const title = document.getElementById('professionalModalTitle');
            const saveButton = document.getElementById('professionalSaveButton');
            if (title) title.textContent = 'Cadastrar Profissional';
            if (saveButton) saveButton.textContent = 'Salvar';
        }

        function openProfessionalModal() {
            if (!checkPermission('createProfessional')) {
                showPermissionDenied('create');
                return;
            }
            resetProfessionalForm();
            document.getElementById('professionalModal').classList.add('active');
        }

        function openEditProfessionalModal(professionalId) {
            if (!checkPermission('editProfessional')) {
                showPermissionDenied('edit');
                return;
            }

            const prof = professionals.find(p => String(p.id) === String(professionalId));
            if (!prof) {
                alert('Profissional não encontrado. Atualize a lista e tente novamente.');
                return;
            }

            editingProfessionalId = prof.id;
            document.getElementById('nomeProfissional').value = prof.name || '';
            setProfessionalSpecialtyInputs(getProfessionalSpecialties(prof));
            document.getElementById('profPhone').value = prof.phone || prof.telefone || '';
            document.getElementById('dataNascimentoProfissional').value = formatDateForInput(prof.birthdate || prof.data_nascimento || '');
            document.getElementById('profEmail').value = prof.email || '';
            document.getElementById('profCouncilNumber').value = prof.councilNumber || prof.numero_conselho || prof.conselho || '';
            document.getElementById('profPreference').value = prof.preference || prof.preferencia || '';
            document.getElementById('profEmergencyContact').value = prof.emergencyContact || prof.contato_emergencia || '';

            const title = document.getElementById('professionalModalTitle');
            const saveButton = document.getElementById('professionalSaveButton');
            if (title) title.textContent = 'Editar Profissional';
            if (saveButton) saveButton.textContent = 'Salvar Alterações';

            document.getElementById('professionalModal').classList.add('active');
        }

        function saveProfessional(event) {
            event.preventDefault();

            const isEditing = !!editingProfessionalId;
            if (isEditing) {
                if (!checkPermission('edit')) {
                    showPermissionDenied('edit');
                    return;
                }
            } else {
                if (!checkPermission('create')) {
                    showPermissionDenied('create');
                    return;
                }
            }

            const name = document.getElementById('nomeProfissional').value.trim();
            const specialties = collectProfessionalSpecialties();
            const specialty = specialties.join(PROFESSIONAL_SPECIALTY_SEPARATOR);
            const phone = document.getElementById('profPhone').value.trim();
            const birthdate = document.getElementById('dataNascimentoProfissional').value;
            const email = document.getElementById('profEmail').value.trim();
            const councilNumber = document.getElementById('profCouncilNumber').value.trim();
            const preference = document.getElementById('profPreference').value.trim();
            const emergencyContact = document.getElementById('profEmergencyContact').value.trim();
            const tempId = Date.now().toString();

            if (specialties.length === 0) {
                alert('Informe pelo menos uma especialidade.');
                return;
            }

            if (!name) {
                alert('❌ Nome do profissional é obrigatório!');
                return;
            }

            const endpoint = isEditing
                ? `http://127.0.0.1:5000/api/profissionais/${editingProfessionalId}`
                : 'http://127.0.0.1:5000/api/profissionais';
            const method = isEditing ? 'PUT' : 'POST';

            const payload = {
                nome: name,
                especialidade: specialty,
                especialidades: specialties,
                ativo: true,
                telefone: phone || null,
                data_nascimento: birthdate || null,
                email: email || null,
                numero_conselho: councilNumber || null,
                preferencia: preference || null,
                contato_emergencia: emergencyContact || null
            };

            fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.profissional) {
                    const srv = data.profissional;
                    const profObj = {
                        id: String(srv.id),
                        name: srv.nome,
                        specialty: srv.especialidade,
                        specialties: splitProfessionalSpecialties(srv.especialidade),
                        phone: srv.telefone || srv.phone || '',
                        birthdate: srv.data_nascimento || srv.birthdate || '',
                        email: srv.email || '',
                        councilNumber: srv.numero_conselho || srv.conselho || srv.council_number || '',
                        preference: srv.preferencia || srv.preference || '',
                        emergencyContact: srv.contato_emergencia || srv.emergency_contact || '',
                        active: srv.ativo !== false,
                        createdAt: srv.criado_em || new Date().toISOString()
                    };

                    if (isEditing) {
                        const index = professionals.findIndex(p => String(p.id) === String(editingProfessionalId));
                        if (index !== -1) {
                            professionals[index] = { ...professionals[index], ...profObj };
                        } else {
                            professionals.push(profObj);
                        }
                    } else {
                        professionals.push(profObj);
                    }
                    localStorage.setItem('professionals', JSON.stringify(professionals));

                    updateProfessionalFilter();
                    updateAppointmentProfessionals();
                    closeModal('professionalModal');

                    // Reset form
                    document.getElementById('nomeProfissional').value = '';
                    setProfessionalSpecialtyInputs(['']);
                    document.getElementById('profPhone').value = '';
                    document.getElementById('dataNascimentoProfissional').value = '';
                    document.getElementById('profEmail').value = '';
                    document.getElementById('profCouncilNumber').value = '';
                    document.getElementById('profPreference').value = '';
                    document.getElementById('profEmergencyContact').value = '';

                    if (currentView === 'professionals') loadProfessionalsList();

                    showSuccessMessage(`✅ Profissional "${profObj.name}" ${isEditing ? 'atualizado' : 'criado'} e salvo no banco!`);
                    editingProfessionalId = null;
                    return;
                }

                console.warn('API resposta inválida ao criar profissional:', data);
                throw new Error('Resposta inválida do servidor');
            })
            .catch(err => {
                if (isEditing) {
                    console.error('Falha ao atualizar profissional no servidor:', err);
                    closeModal('professionalModal');
                    showErrorMessage('❌ Falha ao salvar profissional no servidor. Atualize a página e tente novamente.');
                    return;
                }
                console.warn('Falha ao salvar profissional no servidor, gravando localmente:', err);
                const professionalData = {
                    id: tempId,
                    name,
                    specialty,
                    specialties,
                    phone,
                    birthdate,
                    email,
                    councilNumber,
                    preference,
                    emergencyContact,
                    active: true
                };
                if (isEditing) {
                    const index = professionals.findIndex(p => String(p.id) === String(editingProfessionalId));
                    if (index !== -1) {
                        professionals[index] = { ...professionals[index], ...professionalData };
                    } else {
                        professionals.push(professionalData);
                    }
                } else {
                    professionals.push(professionalData);
                }
                localStorage.setItem('professionals', JSON.stringify(professionals));

                updateProfessionalFilter();
                updateAppointmentProfessionals();
                closeModal('professionalModal');

                // Reset form
                document.getElementById('nomeProfissional').value = '';
                setProfessionalSpecialtyInputs(['']);
                document.getElementById('profPhone').value = '';
                document.getElementById('dataNascimentoProfissional').value = '';
                document.getElementById('profEmail').value = '';
                document.getElementById('profCouncilNumber').value = '';
                document.getElementById('profPreference').value = '';
                document.getElementById('profEmergencyContact').value = '';

                if (currentView === 'professionals') loadProfessionalsList();

                showSuccessMessage(`✅ Profissional "${name}" ${isEditing ? 'atualizado' : 'criado'} localmente (fallback).`);
                editingProfessionalId = null;
            });
        }

        function openPatientModal() {
            if (!checkPermission('createPatient')) {
                showPermissionDenied('create');
                return;
            }
            resetPatientForm();
            document.getElementById('patientModal').classList.add('active');
        }

        function savePatient(event) {
            event.preventDefault();

            if (!checkPermission('create')) {
                showPermissionDenied('create');
                return;
            }

            const name = document.getElementById('patientName').value.trim();
            const birthdate = document.getElementById('patientBirthdate').value;
            const address = document.getElementById('patientAddress').value.trim();
            const motherName = document.getElementById('patientMother').value.trim();
            const fatherName = document.getElementById('patientFather').value.trim();
            const insurance = document.getElementById('patientInsurance').value.trim();

            if (!name) {
                alert('❌ Nome do paciente é obrigatório!');
                return;
            }

            const patient = {
                nome: name,
                data_nascimento: birthdate || null,
                endereco: address || null,
                nome_mae: motherName || null,
                nome_pai: fatherName || null,
                convenio: insurance || null
            };

            const tempId = Date.now().toString();
            const localPatient = { id: tempId, ...patient };

            fetch('http://127.0.0.1:5000/api/pacientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patient)
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.paciente) {
                    const created = data.paciente;
                    closeModal('patientModal');
                    document.getElementById('patientName').value = '';
                    document.getElementById('patientBirthdate').value = '';
                    document.getElementById('patientAddress').value = '';
                    document.getElementById('patientMother').value = '';
                    document.getElementById('patientFather').value = '';
                    document.getElementById('patientInsurance').value = '';
                    showSuccessMessage(`✅ Paciente "${created.nome}" cadastrado com sucesso!`);
                    loadPatientList();
                    return;
                }

                console.warn('API resposta inválida ao criar paciente:', data);
                throw new Error('Resposta inválida do servidor');
            })
            .catch(err => {
                console.warn('Falha ao salvar paciente no servidor, gravando localmente:', err);
                const patients = JSON.parse(localStorage.getItem('patients') || '[]');
                patients.push(localPatient);
                localStorage.setItem('patients', JSON.stringify(patients));

                closeModal('patientModal');
                document.getElementById('patientName').value = '';
                document.getElementById('patientBirthdate').value = '';
                document.getElementById('patientAddress').value = '';
                document.getElementById('patientMother').value = '';
                document.getElementById('patientFather').value = '';
                document.getElementById('patientInsurance').value = '';
                showSuccessMessage(`✅ Paciente "${name}" cadastrado localmente (fallback).`);
                loadPatientList();
            });
        }

        function openPatientListModal() {
            if (!checkPermission('viewPatients')) {
                showPermissionDenied('viewPatients');
                return;
            }
            document.getElementById('patientSearchInput').value = '';
            loadPatientList();
            document.getElementById('patientListModal').classList.add('active');
        }

        function loadPatientList() {
            const container = document.getElementById('patientListContent');
            const emptyState = document.getElementById('patientListEmpty');
            container.innerHTML = '';
            emptyState.classList.add('hidden');

            const localPatients = JSON.parse(localStorage.getItem('patients') || '[]');

            fetch(apiUrl('/api/pacientes'))
                        .then(res => res.json())
                .then(data => {
                    const patients = (data && data.success && Array.isArray(data.pacientes)) ? data.pacientes : localPatients;
                    patientListCache = patients.length ? patients : localPatients;
                    renderPatientList(patientListCache);
                    updatePatientSuggestions();
                    syncSelectedPatientFromName();
                })
                .catch(() => {
                    patientListCache = localPatients;
                    renderPatientList(localPatients);
                    updatePatientSuggestions();
                    syncSelectedPatientFromName();
                });
        }

        function updatePatientSuggestions() {
            const datalist = document.getElementById('patientSuggestionOptions');
            if (!datalist) return;

            const patients = (patientListCache && patientListCache.length) ? patientListCache : JSON.parse(localStorage.getItem('patients') || '[]');
            const seen = new Set();
            datalist.innerHTML = '';

            patients.forEach(patient => {
                const name = (patient.nome || patient.name || '').trim();
                const patientId = String(patient.id || '').trim();
                const key = normalizePatientLookupText(name);
                if (!name || seen.has(key)) return;
                seen.add(key);

                const option = document.createElement('option');
                option.value = name;
                option.dataset.patientId = patientId;
                if (patientId) {
                    option.label = `${name} - #${patientId}`;
                }
                datalist.appendChild(option);
            });
        }

        function normalizePatientLookupText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toLowerCase();
        }

        function getPatientSources() {
            const fromCache = (patientListCache && patientListCache.length) ? patientListCache : [];
            let fromStorage = [];
            try {
                fromStorage = JSON.parse(localStorage.getItem('patients') || '[]');
            } catch (err) {
                fromStorage = [];
            }
            const byId = new Map();
            [...fromCache, ...fromStorage].forEach(patient => {
                const patientId = String(patient.id || '').trim();
                const name = (patient.nome || patient.name || '').trim();
                if (patientId && name && !byId.has(patientId)) {
                    byId.set(patientId, patient);
                }
            });
            return Array.from(byId.values());
        }

        function findRegisteredPatientByName(name) {
            const target = normalizePatientLookupText(name);
            if (!target) return null;
            return getPatientSources().find(patient => {
                if (patient.ativo === false || patient.active === false) return false;
                return normalizePatientLookupText(patient.nome || patient.name || '') === target;
            }) || null;
        }

        function syncSelectedPatientFromName() {
            const input = document.getElementById('clientName');
            const hidden = document.getElementById('clientPatientId');
            if (!input || !hidden) return null;
            const patient = findRegisteredPatientByName(input.value);
            if (patient) {
                hidden.value = String(patient.id || '').trim();
                const officialName = (patient.nome || patient.name || '').trim();
                if (officialName && input.value.trim() !== officialName) {
                    input.value = officialName;
                }
                return patient;
            }
            hidden.value = '';
            return null;
        }

        function formatDateFromISO(value) {
            if (!value) return null;
            if (typeof value === 'string') {
                const isoMatch = value.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
                if (isoMatch) {
                    const [, year, month, day] = isoMatch;
                    return `${day}/${month}/${year}`;
                }
                const parts = value.split('-');
                if (parts.length === 3) {
                    const [year, month, day] = parts;
                    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
                }
                const slashParts = value.split('/');
                if (slashParts.length === 3) {
                    const [day, month, year] = slashParts;
                    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
                }
            }
            const date = value instanceof Date ? value : new Date(value);
            if (!(date instanceof Date) || isNaN(date)) return value;
            return date.toLocaleDateString('pt-BR');
        }

        function formatarData(value) {
            return formatDateFromISO(value);
        }

        function formatDateForInput(value) {
            if (!value) return '';
            if (typeof value === 'string') {
                const isoMatch = value.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
                if (isoMatch) {
                    const [, year, month, day] = isoMatch;
                    return `${year}-${month}-${day}`;
                }
                const slashParts = value.split('/');
                if (slashParts.length === 3) {
                    const [day, month, year] = slashParts;
                    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
            }
            const date = new Date(value);
            if (!(date instanceof Date) || isNaN(date)) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function calculateAgeFromISO(value) {
            if (!value) return null;
            const birthDate = typeof value === 'string'
                ? new Date(value)
                : value;
            if (!(birthDate instanceof Date) || isNaN(birthDate)) return null;
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDifference = today.getMonth() - birthDate.getMonth();
            if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
                age -= 1;
            }
            return age;
        }

        function renderPatientList(patients) {
            const container = document.getElementById('patientListContent');
            const emptyState = document.getElementById('patientListEmpty');
            container.innerHTML = '';

            if (!patients || patients.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }

            patients.forEach(patient => {
                const formattedDate = formatDateFromISO(patient.data_nascimento);
                const age = calculateAgeFromISO(patient.data_nascimento);
                const birthInfo = patient.data_nascimento
                    ? `Nascimento: ${formattedDate}${age !== null ? ` · ${age} anos` : ''}`
                    : 'Data de nascimento não informada';

                const card = document.createElement('div');
                card.className = 'bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm';
                card.innerHTML = `
                    <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                        <div>
                            <h4 class="text-lg font-semibold text-gray-800">${patient.nome || 'Paciente sem nome'}</h4>
                            <p class="text-sm text-gray-500">${patient.convenio ? `Convênio: ${patient.convenio}` : 'Convênio não informado'}</p>
                        </div>
                        <div class="text-sm text-gray-600">
                            <p>${birthInfo}</p>
                            <p>${patient.endereco ? `Endereço: ${patient.endereco}` : 'Endereço não informado'}</p>
                        </div>
                    </div>
                    <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                        <div><strong>Mãe:</strong> ${patient.nome_mae || 'Não informado'}</div>
                        <div><strong>Pai:</strong> ${patient.nome_pai || 'Não informado'}</div>
                    </div>
                    <div class="mt-4 text-sm text-gray-700"><strong>Telefone:</strong> ${patient.telefone || patient.phone || 'Não informado'}</div>
                `;

                const actions = document.createElement('div');
                actions.className = 'mt-4 flex flex-wrap gap-2 justify-end';

                if (currentUser && currentUser.level === 'admin') {
                    const editButton = document.createElement('button');
                    editButton.type = 'button';
                    editButton.className = 'bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium';
                    editButton.textContent = 'Editar';
                    editButton.onclick = () => openEditPatientModal(patient.id);
                    actions.appendChild(editButton);

                    const inactivateButton = document.createElement('button');
                    inactivateButton.type = 'button';
                    inactivateButton.className = 'bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm font-medium';
                    inactivateButton.textContent = patient.ativo === false ? 'Ativar' : 'Inativar';
                    inactivateButton.onclick = () => togglePatientStatus(patient.id, patient.ativo === false);
                    actions.appendChild(inactivateButton);

                    const deleteButton = document.createElement('button');
                    deleteButton.type = 'button';
                    deleteButton.className = 'bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium';
                    deleteButton.textContent = 'Excluir';
                    deleteButton.onclick = () => deletePatient(patient.id);
                    actions.appendChild(deleteButton);
                } else if (currentUser && currentUser.level === 'editor') {
                    const infoText = document.createElement('div');
                    infoText.className = 'text-xs text-gray-500 italic py-2';
                    infoText.textContent = 'Somente administradores podem editar pacientes.';
                    actions.appendChild(infoText);
                }

                card.appendChild(actions);
                container.appendChild(card);
            });
        }

        function filterPatientModalList() {
            const search = document.getElementById('patientSearchInput').value.toLowerCase().trim();
            const cards = document.querySelectorAll('#patientListContent > div');
            let visible = 0;

            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                if (!search || text.includes(search)) {
                    card.style.display = '';
                    visible += 1;
                } else {
                    card.style.display = 'none';
                }
            });

            const emptyState = document.getElementById('patientListEmpty');
            emptyState.classList.toggle('hidden', visible > 0);
        }

        function loadProfessionalsList() {
            const container = document.getElementById('professionalsList');
            container.innerHTML = '';
            
            if (professionals.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <div class="text-6xl mb-4">👨‍⚕️</div>
                        <h3 class="text-xl font-medium text-gray-600 mb-2">Nenhum profissional cadastrado</h3>
                        <p class="text-gray-500 mb-4">Comece cadastrando seu primeiro profissional</p>
                        ${userPermissions.canCreateProfessional ? `
                            <button onclick="openProfessionalModal()" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium">
                                👨‍⚕️ Cadastrar Primeiro Profissional
                            </button>
                        ` : ''}
                    </div>
                `;
                return;
            }

            // try to fetch latest from server opportunistically (non-blocking)
            // (some pages may call fetchProfessionalsFromServer explicitly already)
            setTimeout(() => {
                fetchProfessionalsFromServer();
            }, 500);

            
            // Separate active and inactive professionals
            const activeProfessionals = professionals.filter(prof => prof.active !== false);
            const inactiveProfessionals = professionals.filter(prof => prof.active === false);
            
            // Active professionals section
            if (activeProfessionals.length > 0) {
                const activeHeader = document.createElement('div');
                activeHeader.className = 'col-span-full mb-4';
                activeHeader.innerHTML = `
                    <h3 class="text-xl font-bold text-green-800 mb-2 flex items-center">
                        ✅ Profissionais Ativos (${activeProfessionals.length})
                    </h3>
                    <div class="h-1 bg-green-200 rounded"></div>
                `;
                container.appendChild(activeHeader);
                
                activeProfessionals.forEach(prof => {
                    const card = createProfessionalCard(prof, true);
                    container.appendChild(card);
                });
            }
            
            // Inactive professionals section
            if (inactiveProfessionals.length > 0) {
                const inactiveHeader = document.createElement('div');
                inactiveHeader.className = 'col-span-full mb-4 mt-8';
                inactiveHeader.innerHTML = `
                    <h3 class="text-xl font-bold text-red-800 mb-2 flex items-center">
                        ❌ Profissionais Inativos (${inactiveProfessionals.length})
                    </h3>
                    <div class="h-1 bg-red-200 rounded"></div>
                `;
                container.appendChild(inactiveHeader);
                
                inactiveProfessionals.forEach(prof => {
                    const card = createProfessionalCard(prof, false);
                    container.appendChild(card);
                });
            }
            
            // Update permissions after loading
            updateProfessionalCardsPermissions();
        }

        function filterProfessionalsList() {
            const searchInput = document.getElementById('professionalsSearchInput');
            const searchTerm = searchInput.value.toLowerCase().trim();
            const cards = document.querySelectorAll('.professional-card');
            let visibleCount = 0;
            
            cards.forEach(card => {
                const cardText = card.textContent.toLowerCase();
                if (cardText.includes(searchTerm) || searchTerm === '') {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
            
            // Show message if no results
            const container = document.getElementById('professionalsList');
            let noResultsMsg = container.querySelector('.no-results-message');
            
            if (visibleCount === 0 && searchTerm !== '') {
                if (!noResultsMsg) {
                    noResultsMsg = document.createElement('div');
                    noResultsMsg.className = 'no-results-message col-span-full text-center py-8';
                    container.appendChild(noResultsMsg);
                }
                noResultsMsg.innerHTML = `
                    <div class="text-4xl mb-2">🔍</div>
                    <p class="text-gray-500">Nenhum profissional encontrado com o termo "<strong>${searchInput.value}</strong>"</p>
                    <button onclick="document.getElementById('professionalsSearchInput').value = ''; filterProfessionalsList()" class="text-blue-600 hover:text-blue-800 mt-2 text-sm font-medium">
                        ✕ Limpar busca
                    </button>
                `;
            } else if (noResultsMsg) {
                noResultsMsg.remove();
            }
        }

        function createProfessionalCard(prof, isActive) {
            const card = document.createElement('div');
            // Use a default color if none specified
            const borderClass = (prof.color && typeof prof.color === 'string') ? prof.color.replace('bg-', 'border-') : 'border-blue-500';
            card.className = `professional-card bg-white rounded-lg shadow-md p-4 border-l-4 ${borderClass} ${!isActive ? 'opacity-60' : ''}`;
            
            let buttonsHtml = '';
            
            if (userPermissions.canView) {
                buttonsHtml += `
                    <button onclick="viewProfessionalSchedule('${prof.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm flex-1">
                        Ver Agenda
                    </button>
                `;
            }
            
            if (userPermissions.canEditProfessionals) {
                buttonsHtml += `
                    <button onclick="openEditProfessionalModal('${prof.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm ml-2">
                        Editar
                    </button>
                `;
                if (isActive) {
                    buttonsHtml += `
                        <button onclick="toggleProfessionalStatus('${prof.id}', false)" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded text-sm ml-2">
                            Inativar
                        </button>
                    `;
                } else {
                    buttonsHtml += `
                        <button onclick="toggleProfessionalStatus('${prof.id}', true)" class="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm ml-2">
                            Ativar
                        </button>
                    `;
                }
            }
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center">
                        <h3 class="font-bold text-gray-800 text-lg">${prof.name}</h3>
                        <span class="ml-3 px-2 py-1 rounded text-xs ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${isActive ? '✅ Ativo' : '❌ Inativo'}
                        </span>
                    </div>
                    ${userPermissions.canDelete ? `
                        <button onclick="deleteProfessional('${prof.id}')" class="text-red-500 hover:text-red-700 text-lg delete-professional-btn">
                            🗑️
                        </button>
                    ` : ''}
                </div>
                <p class="text-gray-600 mb-2">${prof.specialty}</p>
                <div class="grid grid-cols-1 gap-2 text-sm text-gray-700 mb-3">
                    ${(prof.telefone || prof.phone) ? `<div><strong>Telefone:</strong> ${prof.telefone || prof.phone}</div>` : ''}
                    ${prof.email ? `<div><strong>E-mail:</strong> ${prof.email}</div>` : ''}
                    ${(prof.data_nascimento || prof.birthdate) ? `<div><strong>Data de nascimento:</strong> ${formatDateFromISO(prof.data_nascimento || prof.birthdate)}</div>` : ''}
                    ${(prof.numero_conselho || prof.councilNumber || prof.conselho) ? `<div><strong>Conselho:</strong> ${prof.numero_conselho || prof.councilNumber || prof.conselho}</div>` : ''}
                    ${(prof.preferencia || prof.preference) ? `<div><strong>Preferência:</strong> ${prof.preferencia || prof.preference}</div>` : ''}
                    ${(prof.contato_emergencia || prof.emergencyContact) ? `<div><strong>Contato de emergência:</strong> ${prof.contato_emergencia || prof.emergencyContact}</div>` : ''}
                </div>
                <div class="flex gap-2">
                    ${buttonsHtml}
                </div>
            `;
            
            return card;
        }

        function toggleProfessionalStatus(id, newStatus) {
            if (!checkPermission('edit')) {
                showPermissionDenied('edit');
                return;
            }

            const professional = professionals.find(p => p.id === id);
            if (!professional) return;

            const action = newStatus ? 'ativar' : 'inativar';

            let confirmMessage = `🔄 ALTERAR STATUS DO PROFISSIONAL\n\n`;
            confirmMessage += `Profissional: ${professional.name}\n`;
            confirmMessage += `Ação: ${action.toUpperCase()}\n\n`;

            if (!newStatus) {
                // Inactivating - show what will happen
                const professionalAppointments = appointments.filter(apt => apt.professionalId === id);
                confirmMessage += `⚠️ ATENÇÃO:\n`;
                confirmMessage += `• O profissional ficará OCULTO do sistema operacional\n`;
                confirmMessage += `• Não aparecerá em filtros, agendamentos ou seleções\n`;
                confirmMessage += `• ${professionalAppointments.length} agendamentos existentes serão MANTIDOS\n`;
                confirmMessage += `• Dados históricos serão PRESERVADOS\n`;
                confirmMessage += `• Pode ser reativado a qualquer momento\n\n`;
                confirmMessage += `💡 Use "Inativar" em vez de "Excluir" para preservar dados\n\n`;
            } else {
                // Activating
                confirmMessage += `✅ O profissional voltará a aparecer em:\n`;
                confirmMessage += `• Filtros de agenda\n`;
                confirmMessage += `• Seleção para novos agendamentos\n`;
                confirmMessage += `• Todas as funcionalidades do sistema\n\n`;
            }

            confirmMessage += `Deseja ${action} ${professional.name}?`;

            if (confirm(confirmMessage)) {
                const index = professionals.findIndex(p => p.id === id);
                if (index === -1) return;

                // If this professional has a numeric server id, attempt to update server first
                const numericId = Number(professional.id);
                if (!Number.isNaN(numericId) && numericId > 0) {
                    fetch(`http://127.0.0.1:5000/api/profissionais/${numericId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ativo: newStatus })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.success) {
                            professionals[index].active = newStatus;
                            localStorage.setItem('professionals', JSON.stringify(professionals));

                            updateProfessionalFilter();
                            updateAppointmentProfessionals();
                            loadProfessionalsList();
                            refreshActiveScheduleViews();

                            const actionPast = newStatus ? 'ativado' : 'inativado';
                            showSuccessMessage(`✅ ${professional.name} foi ${actionPast} com sucesso!`);
                        } else {
                            console.warn('Falha ao atualizar status no servidor:', data);
                            alert('❌ Erro ao atualizar status no servidor. Operação revertida localmente.');
                        }
                    })
                    .catch(err => {
                        console.error('Erro ao atualizar status no servidor:', err);
                        // Fallback local change
                        professionals[index].active = newStatus;
                        localStorage.setItem('professionals', JSON.stringify(professionals));

                        updateProfessionalFilter();
                        updateAppointmentProfessionals();
                        loadProfessionalsList();
                        refreshActiveScheduleViews();

                        const actionPast = newStatus ? 'ativado' : 'inativado';
                        showSuccessMessage(`✅ ${professional.name} foi ${actionPast} localmente (fallback).`);
                    });
                } else {
                    // No server id - just update locally and the next sync may push it
                    professionals[index].active = newStatus;
                    localStorage.setItem('professionals', JSON.stringify(professionals));

                    updateProfessionalFilter();
                    updateAppointmentProfessionals();
                    loadProfessionalsList();
                    refreshActiveScheduleViews();

                    const actionPast = newStatus ? 'ativado' : 'inativado';
                    showSuccessMessage(`✅ ${professional.name} foi ${actionPast} (local).`);
                }
            }
        }

        function deleteProfessional(id) {
            if (!checkPermission('delete')) {
                showPermissionDenied('delete');
                return;
            }

            // Enforce admin-level on client as well (backend also enforces)
            if (!currentUser || currentUser.level !== 'admin') {
                showPermissionDenied('delete');
                return;
            }

            const professional = professionals.find(p => p.id === id);
            if (!professional) return;

            const professionalAppointments = appointments.filter(apt => apt.professionalId === id);

            let confirmMessage = `🗑️ CONFIRMAR EXCLUSÃO PERMANENTE\n\n`;
            confirmMessage += `👨‍⚕️ Profissional: ${professional.name}\n`;
            confirmMessage += `🏥 Especialidade: ${professional.specialty}\n`;
            confirmMessage += `📊 Status: ${professional.active !== false ? 'Ativo' : 'Inativo'}\n\n`;

            confirmMessage += `📅 AGENDAMENTOS QUE SERÃO PERDIDOS:\n`;
            if (professionalAppointments.length === 0) {
                confirmMessage += `✅ Nenhum agendamento será perdido\n\n`;
            } else {
                confirmMessage += `⚠️ ${professionalAppointments.length} agendamentos serão PERMANENTEMENTE excluídos:\n\n`;

                // Show up to 5 appointments + count
                const displayAppointments = professionalAppointments.slice(0, 5);
                displayAppointments.forEach(apt => {
                    // CORREÇÃO: Usar meio do dia para evitar deslocamento de timezone
                    const date = new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR');
                    confirmMessage += `• ${date} às ${apt.time} - ${apt.clientName} (${getTypeLabel(apt.type)})\n`;
                });

                if (professionalAppointments.length > 5) {
                    confirmMessage += `• ... e mais ${professionalAppointments.length - 5} agendamentos\n`;
                }
                confirmMessage += `\n`;
            }

            confirmMessage += `💡 ALTERNATIVA RECOMENDADA:\n`;
            confirmMessage += `Use "INATIVAR" em vez de "EXCLUIR" para:\n`;
            confirmMessage += `• Ocultar do sistema sem perder dados\n`;
            confirmMessage += `• Preservar histórico de agendamentos\n`;
            confirmMessage += `• Possibilitar reativação futura\n\n`;

            confirmMessage += `⚠️ ATENÇÃO: EXCLUSÃO É PERMANENTE E IRREVERSÍVEL!\n\n`;
            confirmMessage += `Tem CERTEZA que deseja EXCLUIR permanentemente?`;

            if (confirm(confirmMessage)) {
                // Final confirmation for deletion
                const finalConfirm = confirm(`🚨 ÚLTIMA CONFIRMAÇÃO\n\nEsta é sua última chance de cancelar!\n\nExcluir permanentemente ${professional.name} e ${professionalAppointments.length} agendamentos?\n\n⚠️ ESTA AÇÃO NÃO PODE SER DESFEITA!`);

                if (finalConfirm) {
                    // If the professional has a numeric server id, try delete on server
                    const numericId = Number(professional.id);
                    if (!Number.isNaN(numericId) && numericId > 0) {
                        const headers = {};
                        if (currentUser && currentUser.username && currentUser.password) {
                            headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                        }

                        fetch(`http://127.0.0.1:5000/api/profissionais/${numericId}`, { method: 'DELETE', headers })
                        .then(res => {
                            if (!res.ok) {
                                // Propagate status via thrown object
                                const err = new Error('HTTP error');
                                err.status = res.status;
                                return res.json().catch(() => { throw err; }).then(body => { err.body = body; throw err; });
                            }
                            return res.json();
                        })
                        .then(data => {
                            if (data && data.success) {
                                professionals = professionals.filter(p => p.id !== id);
                                appointments = appointments.filter(a => a.professionalId !== id);

                                localStorage.setItem('professionals', JSON.stringify(professionals));
                                localStorage.setItem('appointments', JSON.stringify(appointments));

                                updateProfessionalFilter();
                                updateAppointmentProfessionals();
                                loadProfessionalsList();
                                refreshActiveScheduleViews();

                                showSuccessMessage(`🗑️ ${professional.name} foi excluído permanentemente junto com ${professionalAppointments.length} agendamentos.`);
                            } else {
                                console.warn('Erro ao excluir no servidor:', data);
                                alert('❌ Erro ao excluir no servidor. Operação não concluída. ' + (data && data.error ? '\n\n' + data.error : ''));
                            }
                        })
                        .catch(err => {
                            console.error('Erro ao excluir no servidor:', err);
                            if (err && err.status === 401) {
                                alert('❌ Não autenticado. Verifique suas credenciais e faça login novamente.');
                                return;
                            }
                            if (err && err.status === 403) {
                                alert('🚫 Acesso negado. Apenas Administradores podem excluir profissionais.');
                                return;
                            }

                            // For other errors, show server message if present, otherwise fallback to local deletion
                            const serverMsg = err && err.body && err.body.error ? err.body.error : null;
                            if (serverMsg) {
                                alert('❌ Erro no servidor: ' + serverMsg);
                                return;
                            }

                            // Network or unknown error: fallback to local deletion but warn user
                            professionals = professionals.filter(p => p.id !== id);
                            appointments = appointments.filter(a => a.professionalId !== id);

                            localStorage.setItem('professionals', JSON.stringify(professionals));
                            localStorage.setItem('appointments', JSON.stringify(appointments));

                            updateProfessionalFilter();
                            updateAppointmentProfessionals();
                            loadProfessionalsList();
                            refreshActiveScheduleViews();

                            showSuccessMessage(`🗑️ ${professional.name} foi excluído localmente (fallback).`);
                        });
                    } else {
                        // No server id - local deletion only
                        professionals = professionals.filter(p => p.id !== id);
                        appointments = appointments.filter(a => a.professionalId !== id);

                        localStorage.setItem('professionals', JSON.stringify(professionals));
                        localStorage.setItem('appointments', JSON.stringify(appointments));

                        updateProfessionalFilter();
                        updateAppointmentProfessionals();
                        loadProfessionalsList();
                        refreshActiveScheduleViews();

                        showSuccessMessage(`🗑️ ${professional.name} foi excluído localmente.`);
                    }
                }
            }
        }

        function viewProfessionalSchedule(professionalId) {
            selectedProfessional = professionalId;
            document.getElementById('weeklyProfessionalFilter').value = professionalId;
            showWeeklyView();
        }

        // Fetch professionals from server and merge into local cache
        // Returns a Promise that resolves to an array of server professionals (raw server objects)
        function fetchProfessionalsFromServer(signal) {
            return fetch(apiUrl('/api/profissionais'), signal ? { signal } : undefined)
                .then(res => res.json())
                .then(data => {
                    const serverList = [];
                    if (data && data.success && Array.isArray(data.profissionais)) {
                        let changed = false;
                        data.profissionais.forEach(p => {
                            serverList.push(p);
                            const idStr = String(p.id);
                            // Try to find by id first, otherwise try by exact name+specialty match (case-insensitive)
                            let existing = professionals.find(x => String(x.id) === idStr);
                            if (!existing) {
                                existing = professionals.find(x => x.name && x.specialty && x.name.toLowerCase() === (p.nome||'').toLowerCase() && x.specialty.toLowerCase() === (p.especialidade||'').toLowerCase());
                            }

                            const profObj = {
                                id: idStr,
                                name: p.nome || p.name || '',
                                specialty: p.especialidade || p.specialty || '',
                                specialties: splitProfessionalSpecialties(p.especialidades || p.specialties || p.especialidade || p.specialty),
                                active: p.ativo !== false,
                                createdAt: p.criado_em || null,
                                phone: p.telefone || p.phone || '',
                                email: p.email || '',
                                birthdate: p.data_nascimento || p.birthdate || '',
                                councilNumber: p.numero_conselho || p.conselho || p.council_number || '',
                                preference: p.preferencia || p.preference || '',
                                emergencyContact: p.contato_emergencia || p.emergency_contact || ''
                            };

                            if (!existing) {
                                professionals.push(profObj);
                                changed = true;
                            } else {
                                // If existing entry used a temp id (local-only), replace id with server id
                                if (String(existing.id) !== idStr) {
                                    existing.id = idStr;
                                }

                                // Update fields with server values (do not overwrite local-only fields like appointments)
                                existing.name = profObj.name || existing.name;
                                existing.specialty = profObj.specialty || existing.specialty;
                                existing.specialties = profObj.specialties.length ? profObj.specialties : existing.specialties;
                                existing.active = typeof p.ativo !== 'undefined' ? (p.ativo !== false) : existing.active;
                                existing.createdAt = profObj.createdAt || existing.createdAt;
                                existing.phone = profObj.phone || existing.phone;
                                existing.email = profObj.email || existing.email;
                                existing.birthdate = profObj.birthdate || existing.birthdate;
                                existing.councilNumber = profObj.councilNumber || existing.councilNumber;
                                existing.preference = profObj.preference || existing.preference;
                                existing.emergencyContact = profObj.emergencyContact || existing.emergencyContact;
                                changed = true;
                            }
                        });

                        if (changed) {
                            localStorage.setItem('professionals', JSON.stringify(professionals));
                            if (currentView === 'professionals') loadProfessionalsList();
                            if (currentView === 'weekly') {
                                updateWeeklyProfessionalFilter();
                                selectFirstAvailableWeeklyProfessional();
                                loadWeeklyScheduleGrid();
                            }
                            if (currentView === 'dailyPanel') {
                                populateDailyPanelProfessionalFilter();
                                renderDailyPanel();
                            }
                        }
                    }

                    return serverList;
                })
                .catch(err => {
                    console.warn('Não foi possível sincronizar profissionais com o servidor:', err);
                    return [];
                });
        }

        function ensureProfessionalsLoaded() {
            if (professionals.length === 0) {
                return fetchProfessionalsFromServer().then(() => {
                    updateProfessionalFilter();
                });
            }
            return Promise.resolve();
        }

        function fetchRoomsFromServer() {
            return fetch(apiUrl('/api/salas'))
                .then(res => res.json())
                .then(data => {
                    if (data && data.success && Array.isArray(data.salas)) {
                        rooms = data.salas
                            .map(normalizeRoomRecord)
                            .filter(room => room.id && room.name && !isRemovedRoomName(room.name));
                        localStorage.setItem('rooms', JSON.stringify(rooms));
                        populateRoomSelect();
                        populateAgendaRoomFilters();
                        if (currentView === 'dailyPanel') {
                            renderDailyPanel();
                        }
                    }
                    return rooms;
                })
                .catch(err => {
                    console.warn('Nao foi possivel sincronizar salas com o servidor:', err);
                    populateRoomSelect();
                    populateAgendaRoomFilters();
                    return rooms;
                });
        }

        function ensureRoomsLoaded() {
            if (!rooms.length) {
                return fetchRoomsFromServer();
            }
            populateRoomSelect();
            populateAgendaRoomFilters();
            return Promise.resolve(rooms);
        }

        function getRoomById(roomId) {
            if (!roomId) return null;
            return rooms.find(room => String(room.id) === String(roomId)) || null;
        }

        function getRoomName(roomId) {
            const room = getRoomById(roomId);
            return room ? room.name : '';
        }

        function getReadableTextColor(backgroundColor) {
            const hex = String(backgroundColor || '').replace('#', '').trim();
            if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#111827';
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness < 140 ? '#ffffff' : '#111827';
        }

        function populateRoomSelect(selectedRoomId = '') {
            const select = document.getElementById('appointmentRoom');
            if (!select) return;
            const currentValue = selectedRoomId || select.value || '';
            select.innerHTML = '<option value="">Selecione a sala...</option>';

            rooms
                .filter(room => room.active !== false)
                .forEach(room => {
                    const option = document.createElement('option');
                    option.value = room.id;
                    option.textContent = room.name;
                    if (room.color) {
                        option.style.backgroundColor = room.color;
                        option.style.color = getReadableTextColor(room.color);
                    }
                    select.appendChild(option);
                });

            if (currentValue) {
                select.value = String(currentValue);
            }
            populateAgendaRoomFilters();
        }

        function getRoomsAvailabilityWeekDays() {
            return getWeekDays(roomsAvailabilityWeek).slice(1, 7);
        }

        function getRoomAppointmentsInWeek(roomId, weekDates) {
            return appointments
                .filter(appointment =>
                    isAppointmentUsingRoom(appointment) &&
                    String(appointment.roomId || appointment.sala_id || '') === String(roomId) &&
                    weekDates.includes(String(appointment.date || ''))
                )
                .sort((a, b) => {
                    return String(a.date || '').localeCompare(String(b.date || '')) ||
                        String(a.time || '').localeCompare(String(b.time || ''));
                });
        }

        function renderRoomsAvailability() {
            const list = document.getElementById('roomsAvailabilityList');
            const summary = document.getElementById('roomsAvailabilitySummary');
            const label = document.getElementById('roomsAvailabilityWeekLabel');
            if (!list || !summary || !label) return;

            const weekDays = getRoomsAvailabilityWeekDays();
            const weekDates = weekDays.map(day => formatDate(day));
            const search = normalizeRoomNameText(document.getElementById('roomsAvailabilitySearch')?.value || '');
            const statusFilter = document.getElementById('roomsAvailabilityStatusFilter')?.value || 'all';
            const weekStart = formatDateBR(weekDays[0]);
            const weekEnd = formatDateBR(weekDays[weekDays.length - 1]);

            label.textContent = `Semana ${weekStart} ate ${weekEnd}`;

            const roomRows = rooms
                .filter(room => room.active !== false && !isRemovedRoomName(room.name))
                .map(room => ({
                    room,
                    appointments: getRoomAppointmentsInWeek(room.id, weekDates)
                }))
                .filter(item => !search || normalizeRoomNameText(item.room.name).includes(search))
                .filter(item => {
                    if (statusFilter === 'available') return item.appointments.length === 0;
                    if (statusFilter === 'occupied') return item.appointments.length > 0;
                    return true;
                });

            const totalRooms = rooms.filter(room => room.active !== false && !isRemovedRoomName(room.name)).length;
            const occupiedCount = rooms
                .filter(room => room.active !== false && !isRemovedRoomName(room.name))
                .filter(room => getRoomAppointmentsInWeek(room.id, weekDates).length > 0)
                .length;
            const availableCount = totalRooms - occupiedCount;

            summary.innerHTML = `
                <span class="font-semibold">${roomRows.length}</span> sala(s) exibida(s) |
                <span class="text-green-700 font-semibold">${availableCount}</span> disponivel(is) |
                <span class="text-red-700 font-semibold">${occupiedCount}</span> ocupada(s)
            `;

            if (!roomRows.length) {
                list.innerHTML = '<div class="md:col-span-2 xl:col-span-3 p-6 text-center text-gray-500 bg-gray-50 rounded-lg border">Nenhuma sala encontrada para este filtro.</div>';
                return;
            }

            list.innerHTML = roomRows.map(item => {
                const room = item.room;
                const roomAppointments = item.appointments;
                const occupied = roomAppointments.length > 0;
                const visibleAppointments = roomAppointments.slice(0, 6);
                const hiddenCount = roomAppointments.length - visibleAppointments.length;
                const statusClass = occupied
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-green-50 text-green-700 border-green-200';
                const appointmentLines = visibleAppointments.map(appointment => {
                    const professionalName = getProfessionalLabel(appointment.professionalId);
                    return `
                        <button type="button" onclick="handleAppointmentClick('${escapeAuditHtml(String(appointment.id))}')" class="w-full text-left p-2 rounded border border-gray-200 hover:bg-gray-50">
                            <div class="font-semibold text-gray-900">${escapeAuditHtml(formatDateBR(appointment.date))} ${escapeAuditHtml(formatAppointmentTime(appointment))}</div>
                            <div class="text-xs text-gray-700">${escapeAuditHtml(appointment.clientName || 'Paciente')} - ${escapeAuditHtml(professionalName)}</div>
                            <div class="text-xs text-gray-500">${escapeAuditHtml(getTypeLabel(appointment.type))}</div>
                        </button>
                    `;
                }).join('');

                return `
                    <div class="border rounded-lg p-3 bg-white">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 min-w-0">
                                    <span class="w-4 h-4 rounded border border-gray-300 flex-shrink-0" style="background:${escapeAuditHtml(room.color || '#e5e7eb')}"></span>
                                    <div class="font-bold text-gray-900 truncate">${escapeAuditHtml(room.name)}</div>
                                </div>
                                <div class="text-xs text-gray-500 mt-1">${roomAppointments.length} agendamento(s) na semana</div>
                            </div>
                            <span class="px-2 py-1 rounded-full border text-xs font-bold ${statusClass}">
                                ${occupied ? 'Ocupada' : 'Disponivel'}
                            </span>
                        </div>
                        <div class="mt-3 space-y-2">
                            ${occupied ? appointmentLines : '<div class="p-3 rounded bg-green-50 text-green-700 text-sm font-medium">Sem agendamentos nesta semana.</div>'}
                            ${hiddenCount > 0 ? `<div class="text-xs text-gray-500 text-center">+ ${hiddenCount} outro(s) agendamento(s)</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        async function openRoomsAvailabilityModal() {
            roomsAvailabilityWeek = new Date(currentWeek || new Date());
            document.getElementById('roomsAvailabilityModal').classList.add('active');
            await ensureRoomsLoaded();
            renderRoomsAvailability();
            fetchAppointmentsFromServer()
                .then(() => renderRoomsAvailability())
                .catch(() => {});
        }

        function previousRoomsAvailabilityWeek() {
            roomsAvailabilityWeek = new Date(roomsAvailabilityWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
            renderRoomsAvailability();
        }

        function nextRoomsAvailabilityWeek() {
            roomsAvailabilityWeek = new Date(roomsAvailabilityWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
            renderRoomsAvailability();
        }

        function goToCurrentRoomsAvailabilityWeek() {
            roomsAvailabilityWeek = new Date();
            renderRoomsAvailability();
        }

        // Fetch appointments from server and merge into local cache
        function fetchAppointmentsFromServer(options = {}) {
            debugLog('[fetchAppointmentsFromServer] Starting sync from server...');
            const url = options.force
                ? apiUrl('/api/agendamentos?force=1')
                : apiUrl('/api/agendamentos');
            return fetch(url)
                .then(res => res.json())
                .then(data => {
                    debugLog('[fetchAppointmentsFromServer] Server response received:', data && data.agendamentos ? data.agendamentos.length : 0, 'appointments');
                    if (data && data.success && Array.isArray(data.agendamentos)) {
                        let changed = false;
                        let added = 0;
                        let updated = 0;

                        const appointmentFields = [
                            'id', 'professionalId', 'patientId', 'date', 'time', 'endTime',
                            'quantidade_sessoes', 'roomId', 'clientName', 'type',
                            'observations', 'createdAt', 'status', 'lockedBy',
                            'ultima_acao', 'atualizado_em', 'recurrenceGroupId',
                            'recurrenceIndex', 'recurrenceTotal'
                        ];

                        const buildAppointmentKey = (apt) => {
                            const professionalId = String(apt.professionalId || apt.profissional || '').trim();
                            const date = normalizeDate(apt.date || apt.data || '');
                            const time = normalizeTime(apt.time || apt.hora_inicio || '');
                            return professionalId && date && time ? `${professionalId}|${date}|${time}` : '';
                        };

                        const hasAppointmentFieldChanges = (current, next) => {
                            const scalarChanged = appointmentFields.some(field =>
                                String(current?.[field] ?? '') !== String(next?.[field] ?? '')
                            );
                            if (scalarChanged) return true;
                            return JSON.stringify(current?.lastAction || null) !== JSON.stringify(next?.lastAction || null);
                        };

                        const appointmentsById = new Map();
                        const appointmentsByKey = new Map();
                        appointments.forEach(apt => {
                            const id = String(apt.id || '').trim();
                            if (id) {
                                appointmentsById.set(id, apt);
                            }
                            const key = buildAppointmentKey(apt);
                            if (key && !appointmentsByKey.has(key)) {
                                appointmentsByKey.set(key, apt);
                            }
                        });
                        
                        data.agendamentos.forEach(a => {
                            const idStr = String(a.id);
                            // Normalize server values
                            const srvDate = normalizeDate(a.data);
                            const srvTime = normalizeTime(a.hora_inicio);
                            const srvProf = String(a.profissional_id || a.profissional);

                            // Try to match by server id first, then by exact professional+date+time (normalized)
                            let existing = appointmentsById.get(idStr);
                            if (!existing) {
                                existing = appointmentsByKey.get(`${srvProf}|${srvDate}|${srvTime}`);
                            }

                            const appObj = {
                                id: idStr,
                                professionalId: srvProf,
                                patientId: a.paciente_id ? String(a.paciente_id) : '',
                                date: srvDate,
                                time: srvTime,
                                endTime: normalizeTime(a.hora_fim || a.hora_inicio),
                                quantidade_sessoes: a.quantidade_sessoes !== undefined ? a.quantidade_sessoes : calculateSessionCount(srvTime, normalizeTime(a.hora_fim || a.hora_inicio)),
                                roomId: a.sala_id ? String(a.sala_id) : '',
                                clientName: a.paciente || '',
                                type: a.tipo_atendimento || '',
                                observations: a.observations || '',
                                createdAt: a.criado_em || null,
                                status: normalizeScheduleStatus(a.status || 'agendado'),
                                lockedBy: a.cancelado_por_username || null,
                                ultima_acao: a.ultima_acao || null,
                                atualizado_em: a.atualizado_em || null,
                                recurrenceGroupId: a.recorrencia_grupo_id || a.recurrenceGroupId || '',
                                recurrenceIndex: a.recorrencia_indice ?? a.recurrenceIndex ?? null,
                                recurrenceTotal: a.recorrencia_total ?? a.recurrenceTotal ?? null,
                                syncStatus: null
                            };

                            if (appObj.ultima_acao || appObj.atualizado_em) {
                                appObj.lastAction = {
                                    user: appObj.ultima_acao || 'Sistema',
                                    timestamp: appObj.atualizado_em || appObj.createdAt || new Date().toISOString(),
                                    action: appObj.status || 'agendado'
                                };
                            }

                            if (!existing) {
                                debugLog(`[fetchAppointmentsFromServer] ADD: ${srvDate} ${srvTime} | ${a.paciente} | prof=${srvProf}`);
                                appointments.push(appObj);
                                appointmentsById.set(idStr, appObj);
                                const key = buildAppointmentKey(appObj);
                                if (key) {
                                    appointmentsByKey.set(key, appObj);
                                }
                                changed = true;
                                added++;
                            } else {
                                const mergedObj = {
                                    ...existing,
                                    id: idStr,
                                    professionalId: appObj.professionalId || existing.professionalId,
                                    patientId: appObj.patientId || existing.patientId || '',
                                    date: appObj.date || existing.date,
                                    time: appObj.time || existing.time,
                                    endTime: appObj.endTime || existing.endTime,
                                    quantidade_sessoes: appObj.quantidade_sessoes !== undefined ? appObj.quantidade_sessoes : existing.quantidade_sessoes,
                                    roomId: appObj.roomId || '',
                                    clientName: appObj.clientName || existing.clientName,
                                    type: appObj.type || existing.type,
                                    observations: appObj.observations || existing.observations,
                                    createdAt: appObj.createdAt || existing.createdAt,
                                    status: appObj.status || existing.status,
                                    lockedBy: appObj.lockedBy || null,
                                    ultima_acao: appObj.ultima_acao || null,
                                    atualizado_em: appObj.atualizado_em || null,
                                    recurrenceGroupId: appObj.recurrenceGroupId || '',
                                    recurrenceIndex: appObj.recurrenceIndex,
                                    recurrenceTotal: appObj.recurrenceTotal,
                                    syncStatus: null
                                };
                                if (appObj.lastAction) {
                                    mergedObj.lastAction = appObj.lastAction;
                                }

                                if (hasAppointmentFieldChanges(existing, mergedObj)) {
                                    Object.assign(existing, mergedObj);
                                    changed = true;
                                    updated++;
                                }

                                appointmentsById.set(idStr, existing);
                                const key = buildAppointmentKey(existing);
                                if (key) {
                                    appointmentsByKey.set(key, existing);
                                }
                            }
                        });

                        debugLog(`[fetchAppointmentsFromServer] Sync complete: added=${added}, updated=${updated}, total=${appointments.length}`);
                        if (changed) {
                            localStorage.setItem('appointments', JSON.stringify(appointments));
                            debugLog('[fetchAppointmentsFromServer] Reloading active schedule view');
                            refreshActiveScheduleViews();
                        } else if (options.renderActiveView) {
                            debugLog('[fetchAppointmentsFromServer] Refreshing active schedule view after sync');
                            refreshActiveScheduleViews();
                        }
                    }
                })
                .catch(err => {
                    console.warn('Não foi possível sincronizar agendamentos com o servidor:', err);
                    return null;
                });
        }

        // Schedule Management - UNIFIED WEEKLY SCHEDULE
        function createScheduleWeekHeader(visibleWeekDays) {
            const weekStartDateBR = formatDateBR(visibleWeekDays[0]);
            const weekEndDateBR = formatDateBR(visibleWeekDays[visibleWeekDays.length - 1]);
            const weekHeaderDiv = document.createElement('div');
            weekHeaderDiv.className = 'week-navigation-header mb-4 bg-gray-100 p-3 rounded-lg';
            weekHeaderDiv.innerHTML = `
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-wrap gap-2">
                        <button type="button" onclick="previousWeek()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">Anterior</button>
                        <button type="button" onclick="goToCurrentWeek()" class="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded font-medium">Semana atual</button>
                    </div>
                    <div class="min-w-0 text-center">
                        <div class="text-lg font-bold text-gray-800">Semana ${weekStartDateBR} - ${weekEndDateBR}</div>
                        <div class="text-xs text-gray-500">Segunda a sabado</div>
                    </div>
                    <div class="flex flex-wrap justify-start gap-2 lg:justify-end">
                        <button type="button" onclick="nextWeek()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">Proxima</button>
                        <button type="button" onclick="toggleScheduleMiniCalendar()" class="bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 px-4 py-2 rounded font-medium">Calendario</button>
                    </div>
                </div>
                ${scheduleMiniCalendarOpen ? renderScheduleMiniCalendar() : ''}
            `;
            return weekHeaderDiv;
        }

        function getMiniCalendarAppointmentCount(dateStr) {
            return appointments.filter(appointment => {
                if (!isSameDay(appointment.date, dateStr)) return false;
                if (!selectedProfessional) return true;
                return String(appointment.professionalId) === String(selectedProfessional);
            }).length;
        }

        function renderScheduleMiniCalendar() {
            const monthDate = scheduleMiniCalendarMonth || new Date(currentWeek.getFullYear(), currentWeek.getMonth(), 1);
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const startOffset = (firstDay.getDay() + 6) % 7;
            const gridStart = new Date(year, month, 1 - startOffset);
            const selectedWeekDates = new Set(getWeekDays(currentWeek).slice(1, 7).map(day => formatDate(day)));
            const todayStr = formatDate(new Date());
            const monthLabel = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

            const weekdayHtml = weekdays.map(day => (
                `<div class="text-center text-[11px] font-semibold text-gray-500">${day}</div>`
            )).join('');

            const dayHtml = Array.from({ length: 42 }, (_, index) => {
                const day = new Date(gridStart);
                day.setDate(gridStart.getDate() + index);
                const dateStr = formatDate(day);
                const inCurrentMonth = day.getMonth() === month;
                const inSelectedWeek = selectedWeekDates.has(dateStr);
                const isToday = dateStr === todayStr;
                const count = getMiniCalendarAppointmentCount(dateStr);
                const classes = [
                    'relative',
                    'aspect-square',
                    'min-h-[34px]',
                    'rounded',
                    'border',
                    'text-sm',
                    'font-medium',
                    'transition-colors',
                    'flex',
                    'items-center',
                    'justify-center',
                    inSelectedWeek ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700',
                    inCurrentMonth ? '' : 'text-gray-400 bg-gray-50',
                    isToday ? 'ring-2 ring-emerald-400 ring-offset-1' : ''
                ].filter(Boolean).join(' ');

                return `
                    <button type="button" onclick="selectScheduleMiniCalendarDate('${dateStr}')" class="${classes}" title="${formatDateBR(day)}">
                        <span>${day.getDate()}</span>
                        ${count ? '<span class="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>' : ''}
                    </button>
                `;
            }).join('');

            return `
                <div class="mt-3 max-w-xs rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div class="mb-3 flex items-center justify-between gap-2">
                        <button type="button" onclick="previousScheduleMiniCalendarMonth()" class="h-8 w-8 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">&lt;</button>
                        <div class="text-sm font-bold capitalize text-gray-900">${escapeAuditHtml(monthLabel)}</div>
                        <button type="button" onclick="nextScheduleMiniCalendarMonth()" class="h-8 w-8 rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">&gt;</button>
                    </div>
                    <div class="grid grid-cols-7 gap-1 mb-1">${weekdayHtml}</div>
                    <div class="grid grid-cols-7 gap-1">${dayHtml}</div>
                    <div class="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        <span>Dias com agendamento</span>
                    </div>
                </div>
            `;
        }

        function setMiniCalendarMonthFromCurrentWeek() {
            scheduleMiniCalendarMonth = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), 1);
        }

        function toggleScheduleMiniCalendar() {
            scheduleMiniCalendarOpen = !scheduleMiniCalendarOpen;
            if (scheduleMiniCalendarOpen) {
                setMiniCalendarMonthFromCurrentWeek();
            }
            refreshActiveScheduleViews();
        }

        function previousScheduleMiniCalendarMonth() {
            scheduleMiniCalendarOpen = true;
            scheduleMiniCalendarMonth = new Date(scheduleMiniCalendarMonth.getFullYear(), scheduleMiniCalendarMonth.getMonth() - 1, 1);
            refreshActiveScheduleViews();
        }

        function nextScheduleMiniCalendarMonth() {
            scheduleMiniCalendarOpen = true;
            scheduleMiniCalendarMonth = new Date(scheduleMiniCalendarMonth.getFullYear(), scheduleMiniCalendarMonth.getMonth() + 1, 1);
            refreshActiveScheduleViews();
        }

        function selectScheduleMiniCalendarDate(dateStr) {
            const selectedDate = parseLocalDate(dateStr);
            if (!selectedDate) return;
            currentWeek = selectedDate;
            scheduleMiniCalendarOpen = false;
            setMiniCalendarMonthFromCurrentWeek();
            refreshActiveScheduleViews();
        }

        function loadScheduleGrid() {
            debugLog('[loadScheduleGrid] Called with currentWeek:', currentWeek);
            const grid = document.getElementById('scheduleGrid');
            
            // Remove old week header if exists
            const oldHeader = grid.parentElement.querySelector('.week-navigation-header');
            if (oldHeader) oldHeader.remove();
            
            grid.innerHTML = '';
            
            // Get week days (Monday to Saturday only - skip Sunday)
            const weekDays = getWeekDays(currentWeek);
            const visibleWeekDays = weekDays.slice(1, 7); // Skip Sunday (index 0)
            const weekDatesFormatted = visibleWeekDays.map(d => formatDate(d));
            
            // Create week header with navigation
            const weekHeaderDiv = createScheduleWeekHeader(visibleWeekDays);
            grid.parentElement.insertBefore(weekHeaderDiv, grid);
            
            const defaultStartMinutes = 6 * 60;
            const defaultEndMinutes = 23 * 60;

            // DEBUG: Log week information
            debugLog('[loadScheduleGrid] === DEBUG START ===');
            debugLog('[loadScheduleGrid] currentWeek:', currentWeek.toISOString());
            debugLog('[loadScheduleGrid] Week dates:', weekDatesFormatted);
            debugLog('[loadScheduleGrid] selectedProfessional:', selectedProfessional, '(type:', typeof selectedProfessional + ')');
            debugLog('[loadScheduleGrid] Total appointments in cache:', appointments.length);
            
            // Show ALL appointments with detailed analysis
            if (appointments.length > 0) {
                debugLog('[loadScheduleGrid] ⚠️ ALL appointments with analysis:');
                appointments.forEach((a, idx) => {
                    const dateMatch = weekDatesFormatted.includes(String(a.date));
                    const profMatch = !selectedProfessional || String(a.professionalId) === String(selectedProfessional);
                    const visible = (dateMatch && profMatch) ? '✅ VISIBLE' : '❌ HIDDEN';
                    
                    // Parse date to show weekday
                    let dayName = '?';
                    try {
                        const parts = String(a.date).split('-');
                        if (parts.length === 3) {
                            const year = parseInt(parts[0]);
                            const month = parseInt(parts[1]) - 1;
                            const day = parseInt(parts[2]);
                            const d = new Date(year, month, day);
                            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
                            dayName = days[d.getDay()];
                        }
                    } catch(e) {}
                    
                    debugLog(`  ${visible} [${idx}] ${a.date} (${dayName}) ${a.time} | ${a.clientName} | prof=${a.professionalId} | inWeek=${dateMatch}, matchProf=${profMatch}`);
                });
            }
            
            // Filter appointments by professional if selected
            let visibleAppointments = appointments;
            if (selectedProfessional) {
                visibleAppointments = appointments.filter(a => String(a.professionalId) === String(selectedProfessional));
                debugLog('[loadScheduleGrid] After filter by professional:', visibleAppointments.length);
            }
            
            // Filter by week using normalized day comparison
            const weekAppointments = filterAgendaAppointments(
                visibleAppointments.filter(a => weekDatesFormatted.some(weekDate => isSameDay(a.date, weekDate))),
                'schedule'
            );
            debugLog('[loadScheduleGrid] After filter by week (FINAL VISIBLE):', weekAppointments.length);

            const latestAppointmentEnd = weekAppointments.reduce((max, a) => {
                const endMinutes = timeToMinutes(normalizeTime(a.endTime || a.time));
                return Math.max(max, endMinutes || 0);
            }, defaultEndMinutes);
            const scheduleEndMinutes = Math.min(Math.max(defaultEndMinutes, latestAppointmentEnd), 23 * 60);

            const timeSlots = [];
            for (let minutes = defaultStartMinutes; minutes <= scheduleEndMinutes; minutes += 30) {
                timeSlots.push(minutesToTime(minutes));
            }
            const slotLookup = buildScheduleSlotLookup(weekAppointments, timeSlots);
            
            const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            
            if (weekAppointments.length > 0) {
                weekAppointments.forEach(a => {
                    debugLog(`  ✅ WILL RENDER: ${a.date} ${a.time}: ${a.clientName}`);
                });
            } else if (appointments.length > 0) {
                debugLog('[loadScheduleGrid] ⚠️ WARNING: Found appointments but NONE visible!');
                debugLog('[loadScheduleGrid] Check: selected week, professional filter, or date format');
            }
            debugLog('[loadScheduleGrid] === DEBUG END ===');
            
            // Update grid template to 6 columns + 1 for time labels
            const SLOT_HEIGHT = 24; // Altura de cada slot de 30 minutos
            const numRows = (scheduleEndMinutes - defaultStartMinutes) / 30 + 1;
            const gridTemplateRows = `repeat(${numRows}, ${SLOT_HEIGHT}px)`;
            
            grid.style.gridTemplateColumns = '80px repeat(6, 1fr)';
            grid.style.gridAutoRows = `${SLOT_HEIGHT}px`;
            grid.style.gap = '0';
            grid.style.gridTemplateRows = gridTemplateRows;
            grid.style.display = 'grid';
            grid.style.autoFlow = 'dense';
            
            // Create headers with day names AND dates
            grid.appendChild(createTimeLabel(''));
            visibleWeekDays.forEach((date, idx) => {
                const header = document.createElement('div');
                header.className = `day-header${isSameDay(formatDate(date), formatDate(new Date())) ? ' current-day' : ''}`;
                const dayName = dayNames[idx];
                const dateFormatted = formatDateBR(date).slice(0, 5);
                header.textContent = `${dayName} ${dateFormatted}`;
                grid.appendChild(header);
            });
            
            // Create time slots
            timeSlots.forEach(time => {
                // Time label
                grid.appendChild(createTimeLabel(time));
                
                // Day slots (6 days - Monday to Saturday)
                for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
                    const slot = createTimeSlot(visibleWeekDays[dayIndex], time, SLOT_HEIGHT, defaultStartMinutes, slotLookup);
                     grid.appendChild(slot);
                }
            });
        }

        function createTimeLabel(time) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = time;
            return label;
        }

        function getScheduleSlotKey(dateStr, time) {
            return `${dateStr}|${time}`;
        }

        function buildScheduleSlotLookup(visibleAppointments, timeSlots) {
            const overlappingBySlot = new Map();
            const startingBySlot = new Map();
            const slotMinutes = timeSlots.map(time => ({
                time,
                start: timeToMinutes(time),
                end: timeToMinutes(time) + 30
            }));

            const addToMap = (map, key, appointment) => {
                if (!map.has(key)) {
                    map.set(key, []);
                }
                map.get(key).push(appointment);
            };

            visibleAppointments.forEach(appointment => {
                const dateStr = normalizeDate(appointment.date);
                const appointmentStartMinutes = timeToMinutes(normalizeTime(appointment.time));
                const appointmentEndMinutes = timeToMinutes(normalizeTime(appointment.endTime || appointment.time));
                if (!dateStr || appointmentEndMinutes <= appointmentStartMinutes) return;

                slotMinutes.forEach(slot => {
                    const overlaps = appointmentEndMinutes > slot.start && appointmentStartMinutes < slot.end;
                    if (!overlaps) return;

                    const key = getScheduleSlotKey(dateStr, slot.time);
                    addToMap(overlappingBySlot, key, appointment);
                    if (appointmentStartMinutes === slot.start) {
                        addToMap(startingBySlot, key, appointment);
                    }
                });
            });

            return { overlappingBySlot, startingBySlot };
        }

        function createTimeSlot(date, time, SLOT_HEIGHT = 24, defaultStartMinutes = 6 * 60, slotLookup = null) {
            const slot = document.createElement('div');
            slot.className = 'time-slot appointment-slot';
            slot.style.position = 'relative';
            slot.style.height = `${SLOT_HEIGHT}px`;
            slot.style.display = 'flex';
            slot.style.alignItems = 'center';
            slot.style.justifyContent = 'center';
            slot.style.overflow = 'visible';
            slot.style.borderBottom = '1px solid #e5e7eb';
            
            const dateStr = formatDate(date);
            const slotStartMinutes = timeToMinutes(time);
            const slotEndMinutes = slotStartMinutes + 30;
            
            let overlappingAppointments = [];
            let startingAppointments = [];
            const lookupKey = getScheduleSlotKey(dateStr, time);

            if (slotLookup) {
                overlappingAppointments = slotLookup.overlappingBySlot.get(lookupKey) || [];
                startingAppointments = slotLookup.startingBySlot.get(lookupKey) || [];
            } else {
                overlappingAppointments = appointments.filter(a => {
                    const dateMatch = isSameDay(a.date, dateStr);
                    const appointmentStartMinutes = timeToMinutes(normalizeTime(a.time));
                    const appointmentEndMinutes = timeToMinutes(normalizeTime(a.endTime || a.time));
                    const overlaps = appointmentEndMinutes > slotStartMinutes && appointmentStartMinutes < slotEndMinutes;
                    const profMatch = !selectedProfessional || String(a.professionalId) === String(selectedProfessional);
                    return dateMatch && overlaps && profMatch;
                });

                startingAppointments = overlappingAppointments.filter(appointment => {
                    const appointmentStartMinutes = timeToMinutes(normalizeTime(appointment.time));
                    return appointmentStartMinutes === slotStartMinutes;
                });
            }
            
            if (startingAppointments.length > 0) {
                startingAppointments.forEach((appointment, index) => {
                    const stackCount = startingAppointments.length;
                    const appointmentStartMinutes = timeToMinutes(normalizeTime(appointment.time));
                    const appointmentEndMinutes = timeToMinutes(normalizeTime(appointment.endTime || appointment.time));
                    
                    // ✅ Calcular quantas linhas (slots de 30min) o agendamento ocupa
                    const durationMinutes = appointmentEndMinutes - appointmentStartMinutes;
                    const rowSpan = Math.max(1, Math.ceil(durationMinutes / 30));
                    
                    // ✅ Calcular a linha inicial do agendamento
                    // startRow = (minutos desde o início da agenda / 30) + 1
                    const startRow = Math.floor((appointmentStartMinutes - defaultStartMinutes) / 30) + 1;
                    
                    const colorClass = getAppointmentColor(appointment.type);
                    const statusMeta = getScheduleStatusMeta(appointment.status);
                    const roomName = getRoomName(appointment.roomId);

                    const block = document.createElement('div');
                    block.className = `appointment-block ${colorClass} schedule-appointment-block ${getScheduleTypeClass(appointment.type)} ${getScheduleStatusClass(appointment.status)}`;
                    
                    // ✅ Grid-based positioning com linha inicial precisa
                    block.style.position = 'absolute';
                    block.style.top = '1px';
                    if (stackCount > 1) {
                        block.style.left = `calc(${(index / stackCount) * 100}% + 2px)`;
                        block.style.right = `calc(${((stackCount - index - 1) / stackCount) * 100}% + 2px)`;
                    } else {
                        block.style.left = '4px';
                        block.style.right = '10px';
                    }
                    block.style.height = `${(rowSpan * SLOT_HEIGHT) - 2}px`;
                    block.style.padding = '0';
                    block.style.margin = '0';
                    block.style.fontSize = '12px';
                    block.style.lineHeight = '1.2';
                    block.style.cursor = 'pointer';
                    block.style.boxSizing = 'border-box';
                    block.style.borderRadius = '3px';
                    block.style.overflow = 'hidden';
                    block.style.border = '1px solid rgba(15,23,42,0.08)';
                    block.style.zIndex = String(20 + index);
                    
                    block.onclick = (event) => {
                        event.stopPropagation();
                        handleAppointmentClick(appointment.id);
                    };

                    const statusIndicator = document.createElement('div');
                    statusIndicator.className = 'schedule-appointment-status';
                    statusIndicator.title = statusMeta.label;
                    if (statusMeta.iconHtml) {
                        statusIndicator.innerHTML = statusMeta.iconHtml;
                    } else {
                        statusIndicator.textContent = statusMeta.icon;
                    }

                    const content = document.createElement('div');
                    content.className = 'schedule-appointment-content';
                    const professionalName = getProfessionalLabel(appointment.professionalId);
                    content.title = `${formatAppointmentTime(appointment)} - ${appointment.clientName || 'Paciente'} - ${professionalName} - ${getTypeLabel(appointment.type)}${roomName ? ' - Sala: ' + roomName : ''}${statusMeta.shortLabel ? ' - ' + statusMeta.label : ''}`;

                    const timeDisplay = document.createElement('span');
                    timeDisplay.className = 'schedule-appointment-time';
                    timeDisplay.textContent = normalizeTime(appointment.time);

                    const title = document.createElement('span');
                    title.className = 'schedule-appointment-title';
                    title.textContent = appointment.clientName || 'Paciente';

                    const professional = document.createElement('span');
                    professional.className = 'schedule-appointment-professional';
                    professional.textContent = professionalName;

                    const type = document.createElement('span');
                    type.className = 'schedule-appointment-type';
                    type.textContent = getTypeLabel(appointment.type);

                    const room = document.createElement('span');
                    room.className = 'schedule-appointment-room';
                    room.textContent = roomName || '';
                    
                    // Mostrar tempo apenas se ocupar múltiplos slots
                    content.appendChild(timeDisplay);
                    content.appendChild(title);
                    timeDisplay.textContent = `${appointment.time}${appointment.endTime ? ' → ' + appointment.endTime : ''}`;

                    timeDisplay.textContent = normalizeTime(appointment.time);
                    if (!selectedProfessional && professionalName) {
                        content.appendChild(professional);
                    }
                    content.appendChild(type);
                    if (roomName) {
                        content.appendChild(room);
                    }

                    block.appendChild(statusIndicator);
                    block.appendChild(content);
                    if (statusMeta.shortLabel) {
                        const statusLabel = document.createElement('span');
                        statusLabel.className = 'schedule-appointment-status-label';
                        statusLabel.textContent = statusMeta.shortLabel;
                        content.appendChild(statusLabel);
                    }

                    slot.appendChild(block);
                });

                slot.onclick = null;
                slot.className += ' occupied-slot';

                const firstAppointment = startingAppointments[0];
                if (firstAppointment.type === 'bloqueado') {
                    slot.className += ' blocked-slot';
                    slot.style.backgroundColor = '#f3f4f6';
                }
            } else if (overlappingAppointments.length > 0) {
                // Slot dentro de um agendamento já renderizado
                slot.onclick = null;
                slot.className += ' occupied-slot';
                slot.style.backgroundColor = '#fafafa';
            } else {
                // Slot vazio - pode criar novo agendamento
                slot.onclick = () => newAppointment(dateStr, time);
                slot.style.cursor = 'pointer';
            }
            
            return slot;
        }
        
        // Helper function to safely edit appointment by ID
        function handleAppointmentClick(appointmentId) {
            const appointment = appointments.find(a => a.id === appointmentId);
            if (appointment) {
                editAppointment(appointment);
            } else {
                console.warn('[handleAppointmentClick] Appointment not found:', appointmentId);
            }
        }

        function getScheduleTypeClass(type) {
            const safeType = String(type || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
            return `schedule-type-${safeType}`;
        }

        function getScheduleStatusClass(status) {
            const safeStatus = normalizeScheduleStatus(status).replace(/[^a-zA-Z0-9_-]/g, '_');
            return `schedule-status-${safeStatus}`;
        }

        function getScheduleStatusMeta(status) {
            const normalizedStatus = normalizeScheduleStatus(status);
            const statuses = {
                pre_atendimento: { icon: 'P', label: 'Pre atendimento', shortLabel: 'Pre' },
                confirmado: { icon: 'C', label: 'Confirmado', shortLabel: 'Confirmado' },
                chegou: { icon: '✓', label: 'Chegou', shortLabel: 'Chegou' },
                em_atendimento: { icon: '▶', label: 'Em atendimento', shortLabel: 'Atendendo' },
                agendado: { icon: '○', label: 'Agendado', shortLabel: '' },
                finalizado: { icon: '✓', label: 'Finalizado', shortLabel: 'Finalizado' },
                cancelado_profissional: { icon: '×', label: 'Cancelado pelo profissional', shortLabel: 'Cancelado' },
                cancelado_paciente: { icon: '×', label: 'Cancelado pelo paciente', shortLabel: 'Cancelado' },
                faltou: { icon: '!', label: 'Faltou', shortLabel: 'Faltou' },
                nao_compareceu: { icon: '!', label: 'Faltou', shortLabel: 'Faltou' }
            };
            statuses.cancelado_paciente.iconHtml = '<svg class="schedule-cancel-patient-icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><circle cx="7" cy="5" r="2.7" fill="none" stroke="currentColor" stroke-width="1.7"></circle><path d="M2.8 15c.7-3.1 2.4-4.7 4.2-4.7 1.2 0 2.2.5 3.1 1.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path><path d="M12 5.3l4 4m0-4l-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';
            return statuses[normalizedStatus] || { icon: '○', label: getStatusLabel(normalizedStatus), shortLabel: getStatusLabel(normalizedStatus) };
        }

        function getAppointmentColor(type) {
            const colors = {
                'clinica': 'bg-orange-200 text-orange-800',
                'analise': 'bg-pink-200 text-pink-800',
                'analise_pago': 'bg-gray-200 text-gray-800',
                'discussao': 'bg-blue-200 text-blue-800',
                'cls': 'bg-green-200 text-green-800',
                'cls_pre': 'bg-lime-200 text-lime-800',
                'supervisao': 'bg-yellow-100 text-yellow-800 border border-gray-300',
                'treinamento': 'bg-purple-200 text-purple-800',
                'reuniao_treinamento': 'bg-purple-200 text-purple-800',
                'orientacao': 'bg-yellow-200 text-yellow-800',
                'bloqueado': 'bg-gray-200 text-gray-800'
            };
            return colors[type] || 'bg-gray-200 text-gray-800';
        }

        function getTypeLabel(type) {
            const labels = {
                'clinica': 'Clínica',
                'analise': 'Análise',
                'analise_pago': 'Análise já paga',
                'discussao': 'Discussão',
                'cls': 'CLS',
                'cls_pre': 'CLS do pré atendimento',
                'supervisao': 'Supervisão',
                'treinamento': 'Treinamento',
                'reuniao_treinamento': 'Reunião/Treinamento',
                'orientacao': 'Orient. Parental',
                'bloqueado': 'Bloqueado'
            };
            return labels[type] || type;
        }

        function getStatusLabel(status) {
            status = normalizeScheduleStatus(status);
            const labels = {
                'pre_atendimento': 'Pre atendimento',
                'confirmado': 'Confirmado',
                'chegou': 'Chegou',
                'em_atendimento': 'Em atendimento',
                'faltou': 'Faltou',
                'agendado': '📅 Agendado',
                'finalizado': '✅ Finalizado',
                'cancelado_profissional': '❌ Cancelado (Profissional)',
                'cancelado_paciente': '❌ Cancelado (Paciente)',
                'nao_compareceu': 'Faltou'
            };
            return labels[status] || '📅 Agendado';
        }

        function getProfessionalLabel(professionalId) {
            if (!professionalId) return 'Nenhum profissional';
            const professional = professionals.find(p => String(p.id) === String(professionalId));
            return professional ? professional.name : 'Profissional desconhecido';
        }

        function getStatusColor(status) {
            status = normalizeScheduleStatus(status);
            const colors = {
                'pre_atendimento': 'bg-cyan-50 border-cyan-200',
                'confirmado': 'bg-indigo-50 border-indigo-200',
                'chegou': 'bg-emerald-50 border-emerald-200',
                'em_atendimento': 'bg-teal-50 border-teal-200',
                'faltou': 'bg-yellow-50 border-yellow-200',
                'agendado': 'bg-blue-50 border-blue-200',
                'finalizado': 'bg-green-50 border-green-200',
                'cancelado_profissional': 'bg-red-50 border-red-200',
                'cancelado_paciente': 'bg-orange-50 border-orange-200',
                'nao_compareceu': 'bg-yellow-50 border-yellow-200'
            };
            return colors[status] || 'bg-gray-50 border-gray-200';
        }

        function timeToMinutes(time) {
            if (!time || typeof time !== 'string') return 0;
            const parts = time.split(':').map(part => parseInt(part, 10));
            if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return 0;
            return parts[0] * 60 + parts[1];
        }

        function isValidTime(time) {
            return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
        }

        function minutesToTime(minutes) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        }

        function calculateSessionCount(startTime, endTime) {
            if (!startTime || !endTime) return 0;
            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(endTime);
            const diff = endMinutes - startMinutes;
            return diff > 0 ? diff / 30 : 0;
        }

        function calcularSessoes(inicio, fim) {
            return calculateSessionCount(inicio, fim);
        }

        function updateSessionCountDisplay(startTime, endTime) {
            const countEl = document.getElementById('appointmentSessionCount');
            if (!countEl) return;
            const count = calculateSessionCount(startTime, endTime);
            countEl.textContent = count === 1 ? '1 sessão' : `${count} sessões`;
        }

        function getDefaultEndTime(startTime) {
            if (!startTime) return '';
            const minutes = timeToMinutes(startTime) + 60;
            if (minutes >= 24 * 60) return '';
            return minutesToTime(minutes);
        }

        function formatAppointmentTime(appointment) {
            if (!appointment) return '';
            if (appointment.endTime && appointment.endTime !== appointment.time) {
                return `${appointment.time} - ${appointment.endTime}`;
            }
            return appointment.time || '';
        }

        function parseLocalDate(dateStr) {
            const parts = String(dateStr || '').split('-').map(part => parseInt(part, 10));
            if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }

        function formatLocalDateISO(dateObj) {
            return [
                dateObj.getFullYear(),
                String(dateObj.getMonth() + 1).padStart(2, '0'),
                String(dateObj.getDate()).padStart(2, '0')
            ].join('-');
        }

        function getSelectedRepeatDays() {
            return Array.from(document.querySelectorAll('.appointment-repeat-day:checked'))
                .map(input => parseInt(input.value, 10))
                .filter(day => !Number.isNaN(day));
        }

        function isRepeatEnabled() {
            const checkbox = document.getElementById('appointmentRepeatEnabled');
            return !!(checkbox && checkbox.checked);
        }

        function toggleAppointmentRepeatOptions() {
            const options = document.getElementById('appointmentRepeatOptions');
            if (!options) return;
            const enabled = isRepeatEnabled();
            options.classList.toggle('hidden', !enabled);
            if (enabled && getSelectedRepeatDays().length === 0) {
                const startDate = parseLocalDate(document.getElementById('appointmentDateInput')?.value || '');
                const day = startDate ? startDate.getDay() : null;
                if (day && day >= 1 && day <= 6) {
                    const input = document.querySelector(`.appointment-repeat-day[value="${day}"]`);
                    if (input) input.checked = true;
                }
            }
            updateRepeatPreview();
        }

        function setRepeatControlsVisible(visible) {
            const wrapper = document.getElementById('appointmentRepeatWrapper');
            if (!wrapper) return;
            wrapper.style.display = visible ? 'block' : 'none';
            if (!visible) {
                const checkbox = document.getElementById('appointmentRepeatEnabled');
                if (checkbox) checkbox.checked = false;
                toggleAppointmentRepeatOptions();
            }
        }

        function resetRepeatControls() {
            const checkbox = document.getElementById('appointmentRepeatEnabled');
            if (checkbox) checkbox.checked = false;
            document.querySelectorAll('.appointment-repeat-day').forEach(input => {
                input.checked = false;
            });
            const countInput = document.getElementById('appointmentRepeatCount');
            if (countInput) countInput.value = '1';
            toggleAppointmentRepeatOptions();
        }

        function getRepeatCount() {
            const countInput = document.getElementById('appointmentRepeatCount');
            const count = parseInt(countInput ? countInput.value : '1', 10);
            if (Number.isNaN(count)) return 0;
            const clamped = Math.max(1, Math.min(100, count));
            if (countInput && String(countInput.value) !== String(clamped)) {
                countInput.value = String(clamped);
            }
            return clamped;
        }

        function generateRepeatDates(startDateStr, selectedDays, count) {
            const startDate = parseLocalDate(startDateStr);
            if (!startDate || !selectedDays.length || count < 1) return [];

            const selected = new Set(selectedDays);
            const dates = [];
            const cursor = new Date(startDate);
            let guard = 0;

            while (dates.length < count && guard < 800) {
                const day = cursor.getDay();
                if (selected.has(day)) {
                    dates.push(formatLocalDateISO(cursor));
                }
                cursor.setDate(cursor.getDate() + 1);
                guard += 1;
            }

            return dates;
        }

        function updateRepeatPreview() {
            const preview = document.getElementById('appointmentRepeatPreview');
            if (!preview) return;
            if (!isRepeatEnabled()) {
                preview.textContent = 'Selecione repeticao para criar varios agendamentos.';
                return;
            }

            const selectedDays = getSelectedRepeatDays();
            const count = getRepeatCount();
            const startDate = document.getElementById('appointmentDateInput')?.value || '';

            if (!selectedDays.length) {
                preview.textContent = 'Selecione pelo menos um dia da semana.';
                return;
            }
            if (!startDate) {
                preview.textContent = 'Selecione a data inicial para calcular as repeticoes.';
                return;
            }

            const dates = generateRepeatDates(startDate, selectedDays, count);
            const firstDate = dates[0] ? formatDateBR(parseLocalDate(dates[0])) : '';
            const lastDate = dates[dates.length - 1] ? formatDateBR(parseLocalDate(dates[dates.length - 1])) : '';
            preview.textContent = dates.length === 1
                ? `Sera criado 1 agendamento em ${firstDate}.`
                : `Serao criados ${dates.length} agendamentos de ${firstDate} ate ${lastDate}.`;
        }

        function createRecurrenceGroupId() {
            return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        function getAppointmentRecurrenceGroupId(appointment) {
            return String(
                appointment?.recurrenceGroupId ||
                appointment?.recorrencia_grupo_id ||
                appointment?.repeatGroupId ||
                ''
            ).trim();
        }

        function getRecurrenceSiblings(appointment) {
            const groupId = getAppointmentRecurrenceGroupId(appointment);
            if (!groupId) return [];
            return appointments.filter(item => getAppointmentRecurrenceGroupId(item) === groupId);
        }

        function buildLocalAppointmentFromServer(srv, fallback = {}) {
            const recurrenceGroupId = srv.recorrencia_grupo_id || srv.recurrenceGroupId || fallback.recurrenceGroupId || '';
            return {
                id: String(srv.id),
                professionalId: String(srv.profissional_id || srv.profissional || fallback.professionalId || ''),
                patientId: srv.paciente_id ? String(srv.paciente_id) : (fallback.patientId || ''),
                roomId: srv.sala_id ? String(srv.sala_id) : (fallback.roomId || ''),
                date: normalizeDate(srv.data || fallback.date || ''),
                time: normalizeTime(srv.hora_inicio || fallback.time || ''),
                endTime: normalizeTime(srv.hora_fim || fallback.endTime || fallback.time || ''),
                quantidade_sessoes: srv.quantidade_sessoes !== undefined ? srv.quantidade_sessoes : fallback.quantidade_sessoes,
                clientName: srv.paciente || fallback.clientName || '',
                type: srv.tipo_atendimento || fallback.type || '',
                observations: fallback.observations || srv.observations || '',
                status: normalizeScheduleStatus(srv.status || fallback.status || 'agendado'),
                lockedBy: srv.cancelado_por_username || fallback.lockedBy || null,
                createdBy: srv.created_by || srv.criado_por || fallback.createdBy || (currentUser ? (currentUser.name || currentUser.username) : 'Sistema'),
                createdAt: srv.criado_em || fallback.createdAt || new Date().toISOString(),
                recurrenceGroupId: recurrenceGroupId ? String(recurrenceGroupId) : '',
                recurrenceIndex: srv.recorrencia_indice ?? srv.recurrenceIndex ?? fallback.recurrenceIndex ?? null,
                recurrenceTotal: srv.recorrencia_total ?? srv.recurrenceTotal ?? fallback.recurrenceTotal ?? null,
                syncStatus: null,
                lastAction: fallback.lastAction || {
                    user: currentUser ? currentUser.name : 'Usuario',
                    timestamp: new Date().toISOString(),
                    action: 'criado'
                }
            };
        }

        function upsertConfirmedAppointment(localAppointment, clientTempId = '') {
            const tempId = String(clientTempId || '').trim();
            let index = tempId ? appointments.findIndex(item => String(item.id) === tempId) : -1;
            if (index === -1) {
                index = appointments.findIndex(item => String(item.id) === String(localAppointment.id));
            }
            if (index === -1 && localAppointment.recurrenceGroupId) {
                index = appointments.findIndex(item =>
                    getAppointmentRecurrenceGroupId(item) === localAppointment.recurrenceGroupId &&
                    item.date === localAppointment.date &&
                    item.time === localAppointment.time &&
                    String(item.professionalId) === String(localAppointment.professionalId)
                );
            }

            if (index === -1) {
                appointments.push(localAppointment);
            } else {
                appointments[index] = {
                    ...appointments[index],
                    ...localAppointment
                };
            }
        }

        function populateEndTimeOptions(startTime, selectedEnd = '') {
            const endInput = document.getElementById('appointmentEndInput');
            if (!endInput) return;

            const normalizedStart = normalizeTime(startTime);
            if (isValidTime(normalizedStart)) {
                if (selectedEnd && isValidTime(selectedEnd)) {
                    endInput.value = normalizeTime(selectedEnd);
                } else if (!endInput.value || !isValidTime(endInput.value) || timeToMinutes(endInput.value) <= timeToMinutes(normalizedStart)) {
                    const defaultEnd = getDefaultEndTime(normalizedStart);
                    if (defaultEnd) {
                        endInput.value = defaultEnd;
                    }
                }
            }

            updateSessionCountDisplay(normalizedStart, endInput.value);
            updateRoomAvailabilityHint();
        }

        // Appointment Management
        async function openScheduleModal() {
            if (!checkPermission('create')) {
                showPermissionDenied('create');
                return;
            }
            document.getElementById('scheduleModalTitle').textContent = 'Agendar Consulta';
            document.getElementById('appointmentId').value = '';
            document.getElementById('deleteAppointmentBtn').style.display = 'none';
            clearScheduleForm();
            setAppointmentSavingState(false);
            await ensureProfessionalsLoaded();
            await ensureRoomsLoaded();
            loadPatientList();
            updateProfessionalFilter();
            populateRoomSelect();
            switchAppointmentTab('details');
            document.getElementById('scheduleModal').classList.add('active');
        }

        async function newAppointment(date, time) {
            if (!checkPermission('create')) {
                showPermissionDenied('create');
                return;
            }
            document.getElementById('scheduleModalTitle').textContent = 'Novo Agendamento';
            document.getElementById('appointmentId').value = '';
            document.getElementById('deleteAppointmentBtn').style.display = 'none';
            clearScheduleForm();
            setAppointmentSavingState(false);
            await ensureProfessionalsLoaded();
            await ensureRoomsLoaded();
            loadPatientList();
            updateProfessionalFilter();
            populateRoomSelect();
            document.getElementById('appointmentProfessional').value = selectedProfessional || '';
            // Fill in the date and time AFTER clearing
            document.getElementById('appointmentDateInput').value = date;
            document.getElementById('appointmentTimeInput').value = time;
            document.getElementById('appointmentEndInput').value = getDefaultEndTime(time);
            populateEndTimeOptions(time, document.getElementById('appointmentEndInput').value);
            updateSessionCountDisplay(time, document.getElementById('appointmentEndInput').value);
            updateRoomAvailabilityHint();
            switchAppointmentTab('details');
            document.getElementById('scheduleModal').classList.add('active');
        }

        function editAppointment(appointment) {
            if (currentUser.level === 'viewer') {
                // Viewer users can only access appointments for their linked professional
                if (!currentUser.professionalId || String(appointment.professionalId) !== String(currentUser.professionalId)) {
                    showPermissionDenied('view');
                    return;
                }
            } else if (!checkPermission('edit')) {
                showPermissionDenied('edit');
                return;
            }
            
            document.getElementById('scheduleModalTitle').textContent = 'Visualizar/Editar Agendamento';
            setAppointmentSavingState(false);
            document.getElementById('appointmentId').value = appointment.id;
            document.getElementById('appointmentDateInput').value = appointment.date;
            document.getElementById('appointmentTimeInput').value = appointment.time;
            document.getElementById('appointmentEndInput').value = appointment.endTime || getDefaultEndTime(appointment.time);
            populateEndTimeOptions(appointment.time, document.getElementById('appointmentEndInput').value);
            updateSessionCountDisplay(appointment.time, document.getElementById('appointmentEndInput').value);
            document.getElementById('appointmentProfessional').value = appointment.professionalId;
            populateRoomSelect(appointment.roomId || appointment.sala_id || '');
            document.getElementById('appointmentRoom').value = appointment.roomId || appointment.sala_id || '';
            updateRoomAvailabilityHint(appointment.id);
            document.getElementById('clientName').value = appointment.clientName;
            const patientHidden = document.getElementById('clientPatientId');
            if (patientHidden) {
                patientHidden.value = appointment.patientId || appointment.paciente_id || '';
                if (!patientHidden.value) {
                    syncSelectedPatientFromName();
                }
            }
            document.getElementById('appointmentType').value = appointment.type;
            document.getElementById('observations').value = appointment.observations || '';
            setRepeatControlsVisible(false);

            const isViewer = currentUser.level === 'viewer';
            const submitButton = document.querySelector('#scheduleModal button[type="submit"]');
            const appointmentProfessionalSelect = document.getElementById('appointmentProfessional');
            const appointmentRoomSelect = document.getElementById('appointmentRoom');
            const dateInput = document.getElementById('appointmentDateInput');
            const timeInput = document.getElementById('appointmentTimeInput');
            const clientNameInput = document.getElementById('clientName');
            const appointmentTypeSelect = document.getElementById('appointmentType');

            if (isViewer) {
                submitButton.style.display = 'none';
                appointmentProfessionalSelect.disabled = true;
                appointmentRoomSelect.disabled = true;
                dateInput.disabled = true;
                timeInput.disabled = true;
                clientNameInput.disabled = true;
                appointmentTypeSelect.disabled = true;
                document.getElementById('deleteAppointmentBtn').style.display = 'none';
            } else {
                submitButton.style.display = 'block';
                appointmentProfessionalSelect.disabled = false;
                appointmentRoomSelect.disabled = false;
                dateInput.disabled = false;
                timeInput.disabled = false;
                clientNameInput.disabled = false;
                appointmentTypeSelect.disabled = false;
                document.getElementById('deleteAppointmentBtn').style.display = userPermissions.canDelete ? 'block' : 'none';
            }
            
            // Show additional edit options for imported appointments
            showEditOptions(appointment);
            
            // Show action options section
            showAppointmentActionOptions(appointment);
            updateAppointmentAuditTabVisibility(appointment);
            switchAppointmentTab('details');
            
            document.getElementById('scheduleModal').classList.add('active');
            return;
            /*
            const numericId = Number(appointmentId);
            if (!Number.isNaN(numericId) && numericId > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (currentUser && currentUser.username && currentUser.password) {
                    headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                }

                const usuarioAcao = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
                fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        release_lock: true,
                        ultima_acao: usuarioAcao
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (!data || !data.success) {
                        appointment.lockedBy = previousState.lockedBy;
                        appointment.lastAction = previousState.lastAction;
                        localStorage.setItem('appointments', JSON.stringify(appointments));
                        refreshActiveScheduleViews();
                        showAppointmentActionOptions(appointment);
                        alert(`ðŸš« ${data?.error || 'Nao foi possivel liberar o bloqueio no servidor.'}`);
                        return;
                    }

                    fetchAppointmentsFromServer();
                    showAppointmentActionOptions(appointment);
                    showSuccessMessage('âœ… Agendamento liberado para alteraÃ§Ã£o por outros usuÃ¡rios.');
                })
                .catch(err => {
                    appointment.lockedBy = previousState.lockedBy;
                    appointment.lastAction = previousState.lastAction;
                    localStorage.setItem('appointments', JSON.stringify(appointments));
                    refreshActiveScheduleViews();
                    showAppointmentActionOptions(appointment);
                    console.warn('Falha ao liberar bloqueio no servidor, alteracao local revertida:', err);
                    alert('ðŸš« Nao foi possivel liberar o bloqueio no servidor.');
                });
                return;
            }

            const numericId = Number(appointmentId);
            if (!Number.isNaN(numericId) && numericId > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (currentUser && currentUser.username && currentUser.password) {
                    headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                }

                const usuarioAcao = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
                fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        release_lock: true,
                        ultima_acao: usuarioAcao
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (!data || !data.success) {
                        appointment.lockedBy = previousState.lockedBy;
                        appointment.lastAction = previousState.lastAction;
                        localStorage.setItem('appointments', JSON.stringify(appointments));
                        refreshActiveScheduleViews();
                        showAppointmentActionOptions(appointment);
                        alert(`ðŸš« ${data?.error || 'Nao foi possivel liberar o bloqueio no servidor.'}`);
                        return;
                    }

                    fetchAppointmentsFromServer();
                    showAppointmentActionOptions(appointment);
                    showSuccessMessage('âœ… Agendamento liberado para alteraÃ§Ã£o por outros usuÃ¡rios.');
                })
                .catch(err => {
                    appointment.lockedBy = previousState.lockedBy;
                    appointment.lastAction = previousState.lastAction;
                    localStorage.setItem('appointments', JSON.stringify(appointments));
                    refreshActiveScheduleViews();
                    showAppointmentActionOptions(appointment);
                    console.warn('Falha ao liberar bloqueio no servidor, alteracao local revertida:', err);
                    alert('ðŸš« Nao foi possivel liberar o bloqueio no servidor.');
                });
                return;
            }

            const numericId = Number(appointmentId);
            if (!Number.isNaN(numericId) && numericId > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (currentUser && currentUser.username && currentUser.password) {
                    headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                }

                const usuarioAcao = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
                fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        release_lock: true,
                        ultima_acao: usuarioAcao
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (!data || !data.success) {
                        appointment.lockedBy = previousState.lockedBy;
                        appointment.lastAction = previousState.lastAction;
                        localStorage.setItem('appointments', JSON.stringify(appointments));
                        refreshActiveScheduleViews();
                        showAppointmentActionOptions(appointment);
                        alert(`ðŸš« ${data?.error || 'Nao foi possivel liberar o bloqueio no servidor.'}`);
                        return;
                    }

                    fetchAppointmentsFromServer();
                    showAppointmentActionOptions(appointment);
                    showSuccessMessage('âœ… Agendamento liberado para alteraÃ§Ã£o por outros usuÃ¡rios.');
                })
                .catch(err => {
                    appointment.lockedBy = previousState.lockedBy;
                    appointment.lastAction = previousState.lastAction;
                    localStorage.setItem('appointments', JSON.stringify(appointments));
                    refreshActiveScheduleViews();
                    showAppointmentActionOptions(appointment);
                    console.warn('Falha ao liberar bloqueio no servidor, alteracao local revertida:', err);
                    alert('ðŸš« Nao foi possivel liberar o bloqueio no servidor.');
                });
                return;
            }

            */
            showAppointmentActionOptions(appointment);
            updateAppointmentAuditTabVisibility(appointment);
            switchAppointmentTab('details');
            
            document.getElementById('scheduleModal').classList.add('active');
        }

        function canViewAppointmentAudit(appointment = null) {
            const level = currentUser ? String(currentUser.level || '').toLowerCase() : '';
            if (['admin', 'administrador', 'editor'].includes(level)) return true;
            if (hasFullAppointmentStatusAccess()) return true;
            return level === 'viewer' && userOwnsAppointment(appointment);
        }

        const PROFESSIONAL_STATUS_UPDATE_ALLOWED = new Set(['finalizado', 'cancelado_profissional', 'faltou']);

        function userOwnsAppointment(appointment) {
            if (!currentUser || !appointment) return false;
            const linkedProfessionalId = String(currentUser.professionalId || currentUser.profissional_id || '').trim();
            const appointmentProfessionalId = String(appointment.professionalId || appointment.profissional_id || appointment.profissional || '').trim();
            return !!linkedProfessionalId && !!appointmentProfessionalId && linkedProfessionalId === appointmentProfessionalId;
        }

        function hasFullAppointmentStatusAccess() {
            if (!currentUser) return false;
            const levelOrName = `${currentUser.level || ''} ${currentUser.name || ''} ${currentUser.username || ''}`
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();
            if (currentUser.level === 'admin' || levelOrName.includes('ADMINISTRADOR')) return true;
            if (levelOrName.includes('CEO') || levelOrName.includes('ATAC') || levelOrName.includes('RECEP')) return true;
            const linkedProfessional = getProfessionalById(currentUser.professionalId);
            const specialty = String(linkedProfessional?.specialty || linkedProfessional?.especialidade || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();
            return specialty.includes('ATAC') || specialty.includes('RECEP');
        }

        function canUpdateAppointmentStatus(status = null, appointment = null) {
            if (hasFullAppointmentStatusAccess()) return true;
            const normalizedStatus = status ? normalizeScheduleStatus(status) : null;
            if (!normalizedStatus) {
                return currentUser && currentUser.level === 'viewer' && userOwnsAppointment(appointment);
            }
            return (
                currentUser &&
                currentUser.level === 'viewer' &&
                userOwnsAppointment(appointment) &&
                PROFESSIONAL_STATUS_UPDATE_ALLOWED.has(normalizedStatus)
            );
        }

        function getAllowedAppointmentStatusOptions(appointment) {
            return APPOINTMENT_STATUS_OPTIONS.filter(option => canUpdateAppointmentStatus(option.value, appointment));
        }

        function renderAppointmentStatusOptions(selectedStatus, appointment = null) {
            const selected = normalizeScheduleStatus(selectedStatus);
            const allowedOptions = getAllowedAppointmentStatusOptions(appointment);
            const hasSelected = allowedOptions.some(option => option.value === selected);
            const currentPrefix = hasSelected ? '' : `<option value="" selected disabled>Atual: ${getStatusLabel(selected)}</option>`;
            return currentPrefix + allowedOptions.map(option => {
                const isSelected = option.value === selected ? 'selected' : '';
                return `<option value="${option.value}" ${isSelected}>${option.label}</option>`;
            }).join('');
        }

        function applyAppointmentStatusFromSelect(appointmentId) {
            const select = document.getElementById('appointmentStatusSelect');
            if (!select) return;
            if (!select.value) {
                alert('Selecione um novo status permitido para este perfil.');
                return;
            }
            updateAppointmentStatus(appointmentId, select.value);
        }

        function getAuthenticatedHeaders(includeJson = true) {
            const headers = includeJson ? { 'Content-Type': 'application/json' } : {};
            if (currentUser && currentUser.username && currentUser.password) {
                headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
            }
            return headers;
        }

        function normalizeWaitlistStatus(status) {
            const key = normalizeAgendaSearchText(status || 'aguardando').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
            const aliases = {
                'aguardando': 'aguardando',
                'espera': 'aguardando',
                'em contato': 'em_contato',
                'contato': 'em_contato',
                'encaixado': 'encaixado',
                'encaixe': 'encaixado',
                'cancelado': 'cancelado'
            };
            return aliases[key] || 'aguardando';
        }

        function normalizeWaitlistPriority(priority) {
            const key = normalizeAgendaSearchText(priority || 'normal').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
            const aliases = {
                'urgente': 'urgente',
                'urgencia': 'urgente',
                'alta': 'alta',
                'normal': 'normal',
                'media': 'normal',
                'baixa': 'baixa'
            };
            return aliases[key] || 'normal';
        }

        function getWaitlistStatusLabel(status) {
            const normalized = normalizeWaitlistStatus(status);
            return WAITLIST_STATUS_OPTIONS.find(option => option.value === normalized)?.label || 'Aguardando';
        }

        function getWaitlistPriorityLabel(priority) {
            const normalized = normalizeWaitlistPriority(priority);
            return WAITLIST_PRIORITY_OPTIONS.find(option => option.value === normalized)?.label || 'Normal';
        }

        function getWaitlistStatusClass(status) {
            const classes = {
                aguardando: 'bg-blue-50 border-blue-200 text-blue-800',
                em_contato: 'bg-amber-50 border-amber-200 text-amber-800',
                encaixado: 'bg-green-50 border-green-200 text-green-800',
                cancelado: 'bg-gray-50 border-gray-200 text-gray-700'
            };
            return classes[normalizeWaitlistStatus(status)] || classes.aguardando;
        }

        function getWaitlistPriorityClass(priority) {
            const classes = {
                urgente: 'bg-red-50 border-red-200 text-red-800',
                alta: 'bg-orange-50 border-orange-200 text-orange-800',
                normal: 'bg-slate-50 border-slate-200 text-slate-700',
                baixa: 'bg-gray-50 border-gray-200 text-gray-600'
            };
            return classes[normalizeWaitlistPriority(priority)] || classes.normal;
        }

        function canManageWaitlist() {
            if (!currentUser) return false;
            const level = String(currentUser.level || '').toLowerCase();
            const levelOrName = `${currentUser.level || ''} ${currentUser.name || ''} ${currentUser.username || ''}`
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();
            if (level === 'admin' || level === 'editor' || levelOrName.includes('ADMINISTRADOR')) return true;
            if (levelOrName.includes('CEO') || levelOrName.includes('ATAC') || levelOrName.includes('RECEP')) return true;
            const linkedProfessional = getProfessionalById(currentUser.professionalId);
            const specialties = getProfessionalSpecialties(linkedProfessional).map(item => item
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase());
            return specialties.some(item => item.includes('ATAC') || item.includes('RECEP') || item.includes('CEO'));
        }

        function normalizeWaitlistItem(item) {
            return {
                id: String(item.id || '').trim(),
                patientId: String(item.paciente_id || item.patientId || item.patient_id || '').trim(),
                patientName: item.paciente_nome || item.patientName || item.paciente || '',
                professionalId: item.profissional_id ? String(item.profissional_id).trim() : '',
                professionalName: item.profissional_nome || item.professionalName || '',
                roomId: item.sala_id ? String(item.sala_id).trim() : '',
                roomName: item.sala_nome || item.roomName || '',
                type: item.tipo_atendimento || item.type || '',
                priority: normalizeWaitlistPriority(item.prioridade || item.priority),
                status: normalizeWaitlistStatus(item.status),
                preferredDays: item.preferencia_dias || item.preferredDays || '',
                preferredTimes: item.preferencia_horarios || item.preferredTimes || '',
                observation: item.observacao || item.notes || '',
                createdBy: item.criado_por_nome || item.createdBy || '',
                createdByUsername: item.criado_por_username || item.createdByUsername || '',
                createdAt: item.criado_em || item.createdAt || '',
                updatedAt: item.atualizado_em || item.updatedAt || '',
                encaixadoAt: item.encaixado_em || item.encaixadoAt || '',
                appointmentId: item.encaixado_agendamento_id || item.appointmentId || null
            };
        }

        function saveWaitlistCache() {
            localStorage.setItem('waitlistItems', JSON.stringify(waitlistItems));
        }

        async function fetchWaitlistOptions() {
            if (!canManageWaitlist()) return waitlistOptions;
            if (waitlistOptionsFetchPromise) return waitlistOptionsFetchPromise;
            waitlistOptionsFetchPromise = (async () => {
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/lista-espera/opcoes', {
                        headers: getAuthenticatedHeaders(false)
                    });
                    const data = await response.json();
                    if (data && data.success) {
                        waitlistOptions = {
                            pacientes: Array.isArray(data.pacientes) ? data.pacientes : [],
                            profissionais: Array.isArray(data.profissionais) ? data.profissionais : [],
                            salas: Array.isArray(data.salas) ? data.salas : []
                        };
                        if (waitlistOptions.pacientes.length) {
                            patientListCache = waitlistOptions.pacientes;
                            updatePatientSuggestions();
                        }
                        return waitlistOptions;
                    }
                    console.warn('Falha ao carregar opcoes da lista de espera:', data);
                } catch (err) {
                    console.warn('Nao foi possivel carregar opcoes da lista de espera:', err);
                }

                waitlistOptions = {
                    pacientes: getPatientSources(),
                    profissionais: professionals,
                    salas: rooms
                };
                return waitlistOptions;
            })();
            try {
                return await waitlistOptionsFetchPromise;
            } finally {
                waitlistOptionsFetchPromise = null;
            }
        }

        function populateWaitlistFormOptions(selected = {}) {
            const patientSelect = document.getElementById('waitlistPatientSelect');
            const professionalSelect = document.getElementById('waitlistProfessionalSelect');
            const roomSelect = document.getElementById('waitlistRoomSelect');

            if (patientSelect) {
                const patients = (waitlistOptions.pacientes && waitlistOptions.pacientes.length)
                    ? waitlistOptions.pacientes
                    : getPatientSources();
                patientSelect.innerHTML = '<option value="">Selecione o paciente...</option>' + patients
                    .filter(patient => patient.ativo !== false && patient.active !== false)
                    .map(patient => {
                        const id = String(patient.id || '').trim();
                        const name = patient.nome || patient.name || 'Paciente';
                        const selectedAttr = selected.patientId && String(selected.patientId) === id ? 'selected' : '';
                        return `<option value="${escapeAuditHtml(id)}" data-name="${escapeAuditHtml(name)}" ${selectedAttr}>${escapeAuditHtml(name)}</option>`;
                    }).join('');
            }

            if (professionalSelect) {
                const professionalOptions = (waitlistOptions.profissionais && waitlistOptions.profissionais.length)
                    ? waitlistOptions.profissionais
                    : professionals;
                professionalSelect.innerHTML = '<option value="">Sem preferencia</option>' + professionalOptions
                    .filter(prof => prof.ativo !== false && prof.active !== false)
                    .map(prof => {
                        const id = String(prof.id || '').trim();
                        const name = prof.nome || prof.name || 'Profissional';
                        const selectedAttr = selected.professionalId && String(selected.professionalId) === id ? 'selected' : '';
                        return `<option value="${escapeAuditHtml(id)}" data-name="${escapeAuditHtml(name)}" ${selectedAttr}>${escapeAuditHtml(name)}</option>`;
                    }).join('');
            }

            if (roomSelect) {
                const roomOptions = (waitlistOptions.salas && waitlistOptions.salas.length)
                    ? waitlistOptions.salas
                    : rooms;
                roomSelect.innerHTML = '<option value="">Sem preferencia</option>' + roomOptions
                    .filter(room => room.ativo !== false && room.active !== false)
                    .map(room => {
                        const normalized = normalizeRoomRecord(room);
                        const selectedAttr = selected.roomId && String(selected.roomId) === String(normalized.id) ? 'selected' : '';
                        return `<option value="${escapeAuditHtml(normalized.id)}" ${selectedAttr}>${escapeAuditHtml(normalized.name)}</option>`;
                    }).join('');
            }
        }

        async function fetchWaitlistFromServer() {
            if (!canManageWaitlist()) {
                waitlistItems = [];
                return waitlistItems;
            }
            if (waitlistFetchPromise) return waitlistFetchPromise;
            waitlistFetchPromise = (async () => {
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/lista-espera', {
                        headers: getAuthenticatedHeaders(false)
                    });
                    const data = await response.json();
                    const items = data?.itens || data?.lista_espera;
                    if (data && data.success && Array.isArray(items)) {
                        waitlistItems = items.map(normalizeWaitlistItem);
                        saveWaitlistCache();
                        return waitlistItems;
                    }
                    console.warn('Falha ao carregar lista de espera:', data);
                } catch (err) {
                    console.warn('Nao foi possivel carregar lista de espera do servidor:', err);
                }
                waitlistItems = waitlistItems.map(normalizeWaitlistItem);
                return waitlistItems;
            })();
            try {
                return await waitlistFetchPromise;
            } finally {
                waitlistFetchPromise = null;
            }
        }

        async function refreshWaitlist(force = false) {
            if (force) {
                waitlistFetchPromise = null;
            }
            await fetchWaitlistFromServer();
            renderWaitlist();
        }

        function getWaitlistSearchText(item) {
            return normalizeAgendaSearchText([
                item.patientName,
                item.patientId,
                item.professionalName || getProfessionalLabel(item.professionalId),
                item.roomName || getRoomName(item.roomId),
                getTypeLabel(item.type),
                item.type,
                getWaitlistStatusLabel(item.status),
                getWaitlistPriorityLabel(item.priority),
                item.preferredDays,
                item.preferredTimes,
                item.observation
            ].filter(Boolean).join(' '));
        }

        function getFilteredWaitlistItems() {
            const search = normalizeAgendaSearchText(document.getElementById('waitlistSearch')?.value || '');
            const status = document.getElementById('waitlistStatusFilter')?.value || '';
            const priority = document.getElementById('waitlistPriorityFilter')?.value || '';
            return waitlistItems
                .map(normalizeWaitlistItem)
                .filter(item => {
                    if (status && normalizeWaitlistStatus(item.status) !== status) return false;
                    if (priority && normalizeWaitlistPriority(item.priority) !== priority) return false;
                    if (search && !getWaitlistSearchText(item).includes(search)) return false;
                    return true;
                });
        }

        function renderWaitlistSummary(items) {
            const container = document.getElementById('waitlistSummary');
            if (!container) return;
            const all = waitlistItems.map(normalizeWaitlistItem);
            const counts = {
                aguardando: all.filter(item => item.status === 'aguardando').length,
                em_contato: all.filter(item => item.status === 'em_contato').length,
                encaixado: all.filter(item => item.status === 'encaixado').length,
                cancelado: all.filter(item => item.status === 'cancelado').length
            };
            const cards = [
                { label: 'Aguardando', value: counts.aguardando, className: 'border-blue-200 bg-blue-50 text-blue-800' },
                { label: 'Em contato', value: counts.em_contato, className: 'border-amber-200 bg-amber-50 text-amber-800' },
                { label: 'Encaixado', value: counts.encaixado, className: 'border-green-200 bg-green-50 text-green-800' },
                { label: 'Cancelado', value: counts.cancelado, className: 'border-gray-200 bg-gray-50 text-gray-700' }
            ];
            container.innerHTML = cards.map(card => `
                <div class="rounded-lg border ${card.className} p-3">
                    <div class="text-xs font-medium">${escapeAuditHtml(card.label)}</div>
                    <div class="mt-1 text-2xl font-bold">${card.value}</div>
                </div>
            `).join('');

            const hint = document.getElementById('waitlistHint');
            if (hint) {
                hint.textContent = `${items.length} item(ns) neste filtro, ${all.length} no total.`;
            }
        }

        function formatWaitlistDate(value) {
            const text = String(value || '').trim();
            if (!text) return '';
            const datePart = text.split('T')[0];
            const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})/);
            return match ? `${match[3]}/${match[2]}/${match[1]}` : datePart;
        }

        function renderWaitlist() {
            const container = document.getElementById('waitlistItems');
            if (!container) return;
            if (!canManageWaitlist()) {
                renderWaitlistSummary([]);
                container.innerHTML = '<div class="px-4 py-8 text-center text-sm text-gray-500">Sem permissao para visualizar a lista de espera.</div>';
                return;
            }

            const items = getFilteredWaitlistItems();
            renderWaitlistSummary(items);
            if (!items.length) {
                container.innerHTML = '<div class="px-4 py-8 text-center text-sm text-gray-500">Nenhum item encontrado para este filtro.</div>';
                return;
            }

            container.innerHTML = items.map(item => {
                const professional = item.professionalName || getProfessionalLabel(item.professionalId);
                const roomName = item.roomName || getRoomName(item.roomId);
                const createdAt = formatWaitlistDate(item.createdAt);
                const itemId = encodeURIComponent(item.id);
                const statusOptions = WAITLIST_STATUS_OPTIONS.map(option => {
                    const selected = option.value === item.status ? 'selected' : '';
                    return `<option value="${option.value}" ${selected}>${escapeAuditHtml(option.label)}</option>`;
                }).join('');
                return `
                    <div class="px-4 py-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-semibold text-gray-900">${escapeAuditHtml(item.patientName || 'Paciente')}</span>
                                    <span class="rounded border px-2 py-0.5 text-xs font-medium ${getWaitlistPriorityClass(item.priority)}">${escapeAuditHtml(getWaitlistPriorityLabel(item.priority))}</span>
                                    <span class="rounded border px-2 py-0.5 text-xs font-medium ${getWaitlistStatusClass(item.status)}">${escapeAuditHtml(getWaitlistStatusLabel(item.status))}</span>
                                </div>
                                <div class="mt-1 text-sm text-gray-600">
                                    ${escapeAuditHtml(getTypeLabel(item.type) || 'Sem tipo definido')}
                                    ${professional && professional !== 'Nenhum profissional' ? ` - ${escapeAuditHtml(professional)}` : ''}
                                    ${roomName ? ` - ${escapeAuditHtml(roomName)}` : ''}
                                </div>
                                <div class="mt-1 text-sm text-gray-600">
                                    ${item.preferredDays ? `Dias: ${escapeAuditHtml(item.preferredDays)}` : 'Dias sem preferencia'}
                                    ${item.preferredTimes ? ` | Horarios: ${escapeAuditHtml(item.preferredTimes)}` : ''}
                                </div>
                                ${item.observation ? `<div class="mt-1 text-sm text-gray-700">${escapeAuditHtml(item.observation)}</div>` : ''}
                                <div class="mt-1 text-xs text-gray-500">
                                    ${createdAt ? `Criado em ${escapeAuditHtml(createdAt)}` : ''}
                                    ${item.createdBy ? ` por ${escapeAuditHtml(item.createdBy)}` : ''}
                                </div>
                            </div>
                            <div class="flex flex-col gap-2 sm:flex-row lg:flex-col lg:min-w-[180px]">
                                <select onchange="updateWaitlistStatus('${itemId}', this.value)" class="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-violet-500">
                                    ${statusOptions}
                                </select>
                                <button type="button" onclick="openWaitlistModal('${itemId}')" class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded text-sm font-medium">
                                    Editar
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function clearWaitlistFilters() {
            ['waitlistSearch', 'waitlistStatusFilter', 'waitlistPriorityFilter'].forEach(fieldId => {
                const element = document.getElementById(fieldId);
                if (element) element.value = '';
            });
            renderWaitlist();
        }

        async function openWaitlistModal(encodedItemId = '') {
            if (!canManageWaitlist()) {
                alert('Sem permissao para gerenciar lista de espera.');
                return;
            }
            await fetchWaitlistOptions();
            const itemId = decodeURIComponent(encodedItemId || '');
            const item = itemId ? waitlistItems.find(entry => String(entry.id) === String(itemId)) : null;
            populateWaitlistFormOptions(item || {});

            document.getElementById('waitlistItemId').value = item ? item.id : '';
            document.getElementById('waitlistModalTitle').textContent = item ? 'Editar Item da Lista' : 'Novo Item da Lista';
            document.getElementById('waitlistPatientSelect').value = item ? item.patientId : '';
            document.getElementById('waitlistProfessionalSelect').value = item ? item.professionalId : '';
            document.getElementById('waitlistRoomSelect').value = item ? item.roomId : '';
            document.getElementById('waitlistType').value = item ? item.type : '';
            document.getElementById('waitlistPriority').value = item ? item.priority : 'normal';
            document.getElementById('waitlistStatus').value = item ? item.status : 'aguardando';
            document.getElementById('waitlistPreferredDays').value = item ? item.preferredDays : '';
            document.getElementById('waitlistPreferredTimes').value = item ? item.preferredTimes : '';
            document.getElementById('waitlistObservation').value = item ? item.observation : '';
            document.getElementById('waitlistModal').classList.add('active');
        }

        async function saveWaitlistItem(event) {
            event.preventDefault();
            if (!canManageWaitlist()) {
                alert('Sem permissao para gerenciar lista de espera.');
                return;
            }
            const itemId = document.getElementById('waitlistItemId').value;
            const patientSelect = document.getElementById('waitlistPatientSelect');
            const selectedPatientOption = patientSelect.options[patientSelect.selectedIndex];
            const payload = {
                paciente_id: patientSelect.value,
                paciente_nome: selectedPatientOption ? selectedPatientOption.dataset.name : '',
                profissional_id: document.getElementById('waitlistProfessionalSelect').value || null,
                sala_id: document.getElementById('waitlistRoomSelect').value || null,
                tipo_atendimento: document.getElementById('waitlistType').value || null,
                prioridade: document.getElementById('waitlistPriority').value || 'normal',
                status: document.getElementById('waitlistStatus').value || 'aguardando',
                preferencia_dias: document.getElementById('waitlistPreferredDays').value.trim() || null,
                preferencia_horarios: document.getElementById('waitlistPreferredTimes').value.trim() || null,
                observacao: document.getElementById('waitlistObservation').value.trim() || null
            };

            if (!payload.paciente_id) {
                alert('Selecione um paciente cadastrado.');
                return;
            }

            const endpoint = itemId
                ? `http://127.0.0.1:5000/api/lista-espera/${encodeURIComponent(itemId)}`
                : 'http://127.0.0.1:5000/api/lista-espera';
            const method = itemId ? 'PUT' : 'POST';

            try {
                const response = await fetch(endpoint, {
                    method,
                    headers: getAuthenticatedHeaders(true),
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!data || !data.success || !data.item) {
                    throw new Error(data?.error || 'Nao foi possivel salvar o item.');
                }
                const normalized = normalizeWaitlistItem(data.item);
                const index = waitlistItems.findIndex(item => String(item.id) === String(normalized.id));
                if (index >= 0) {
                    waitlistItems[index] = normalized;
                } else {
                    waitlistItems.push(normalized);
                }
                saveWaitlistCache();
                closeModal('waitlistModal');
                renderWaitlist();
                showSuccessMessage('Item da lista de espera salvo.');
            } catch (err) {
                console.error('Erro ao salvar lista de espera:', err);
                alert(err.message || 'Nao foi possivel salvar o item da lista de espera.');
            }
        }

        async function updateWaitlistStatus(encodedItemId, status) {
            const itemId = decodeURIComponent(encodedItemId || '');
            const item = waitlistItems.find(entry => String(entry.id) === String(itemId));
            if (!item || !status) return;
            const previousStatus = item.status;
            item.status = normalizeWaitlistStatus(status);
            saveWaitlistCache();
            renderWaitlist();
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/lista-espera/${encodeURIComponent(itemId)}`, {
                    method: 'PUT',
                    headers: getAuthenticatedHeaders(true),
                    body: JSON.stringify({ status: item.status })
                });
                const data = await response.json();
                if (!data || !data.success || !data.item) {
                    throw new Error(data?.error || 'Nao foi possivel alterar o status.');
                }
                const normalized = normalizeWaitlistItem(data.item);
                const index = waitlistItems.findIndex(entry => String(entry.id) === String(itemId));
                if (index >= 0) waitlistItems[index] = normalized;
                saveWaitlistCache();
                renderWaitlist();
            } catch (err) {
                item.status = previousStatus;
                saveWaitlistCache();
                renderWaitlist();
                alert(err.message || 'Nao foi possivel alterar o status da lista de espera.');
            }
        }

        function updateAppointmentAuditTabVisibility(appointment) {
            const auditBtn = document.getElementById('appointmentTabAuditBtn');
            const auditTab = document.getElementById('appointmentAuditTab');
            const auditContent = document.getElementById('appointmentAuditContent');
            const canAudit = canViewAppointmentAudit(appointment) && appointment && appointment.id;

            if (auditBtn) {
                auditBtn.classList.toggle('hidden', !canAudit);
            }
            if (!canAudit && auditTab) {
                auditTab.classList.add('hidden');
            }
            if (auditContent) {
                auditContent.innerHTML = canAudit
                    ? '<div class="text-gray-500">Abra a aba Historico para carregar as alteracoes.</div>'
                    : '<div class="text-gray-500">Historico disponivel para administradores, editores e profissionais vinculados ao proprio agendamento.</div>';
            }
        }

        function formatAuditAction(action) {
            const labels = {
                criado: 'Criado',
                editado: 'Editado',
                status_alterado: 'Status alterado',
                status_alterado_lote: 'Status alterado em lote',
                bloqueio_liberado: 'Bloqueio liberado',
                excluido: 'Excluido'
            };
            return labels[action] || action || 'Registro';
        }

        function escapeAuditHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatAuditDate(value) {
            const text = String(value || '').trim();
            const match = text.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
            if (!match) return text || '-';
            return `${match[3]}/${match[2]}/${match[1]}`;
        }

        function formatAuditTime(value) {
            const text = String(value || '').trim();
            const match = text.match(/^(\d{2}):(\d{2})/);
            return match ? `${match[1]}:${match[2]}` : (text || '-');
        }

        function formatAuditValue(field, value) {
            if (field === 'data') return formatAuditDate(value);
            if (field === 'hora_inicio' || field === 'hora_fim') return formatAuditTime(value);
            if (field === 'sala_id') return getRoomName(value) || (value ? `Sala ${value}` : 'Sem sala');
            return value || '-';
        }

        function formatAuditFieldLabel(field) {
            const labels = {
                profissional: 'Profissional',
                paciente: 'Paciente',
                tipo_atendimento: 'Tipo de atendimento',
                data: 'Data',
                sala_id: 'Sala',
                quantidade_sessoes: 'Quantidade de sessoes'
            };
            return labels[field] || field;
        }

        function formatAuditChangeLine(field, change) {
            const before = formatAuditValue(field, change?.antes);
            const after = formatAuditValue(field, change?.depois);
            if (field === 'data') {
                return `Data modificada de ${escapeAuditHtml(before)} para ${escapeAuditHtml(after)}`;
            }
            return `${escapeAuditHtml(formatAuditFieldLabel(field))} modificado de ${escapeAuditHtml(before)} para ${escapeAuditHtml(after)}`;
        }

        function formatAuditDetails(details) {
            if (!details) return '';
            if (typeof details === 'string') return escapeAuditHtml(details);
            if (details.alteracoes) {
                const changes = details.alteracoes;
                const lines = [];
                const timeStart = changes.hora_inicio;
                const timeEnd = changes.hora_fim;

                if (timeStart || timeEnd) {
                    const beforeStart = formatAuditTime(timeStart?.antes);
                    const afterStart = formatAuditTime(timeStart?.depois);
                    const beforeEnd = formatAuditTime(timeEnd?.antes);
                    const afterEnd = formatAuditTime(timeEnd?.depois);

                    if (timeStart && timeEnd) {
                        lines.push(`Horario modificado de ${escapeAuditHtml(beforeStart)} - ${escapeAuditHtml(beforeEnd)} para ${escapeAuditHtml(afterStart)} - ${escapeAuditHtml(afterEnd)}`);
                    } else if (timeStart) {
                        lines.push(`Horario modificado de ${escapeAuditHtml(beforeStart)} para ${escapeAuditHtml(afterStart)}`);
                    } else {
                        lines.push(`Horario de termino modificado de ${escapeAuditHtml(beforeEnd)} para ${escapeAuditHtml(afterEnd)}`);
                    }
                }

                Object.entries(changes).forEach(([field, change]) => {
                    if (field === 'hora_inicio' || field === 'hora_fim') return;
                    lines.push(formatAuditChangeLine(field, change));
                });

                return lines.join('<br>');
            }
            return Object.entries(details).map(([key, value]) => {
                return `${escapeAuditHtml(formatAuditFieldLabel(key))}: ${escapeAuditHtml(formatAuditValue(key, value))}`;
            }).join('<br>');
        }

        function loadAppointmentAudit(appointmentId) {
            const auditContent = document.getElementById('appointmentAuditContent');
            if (!auditContent) return;
            const appointment = appointments.find(a => String(a.id) === String(appointmentId));
            if (!canViewAppointmentAudit(appointment)) {
                auditContent.innerHTML = '<div class="p-3 bg-gray-50 rounded border text-gray-600">Historico disponivel apenas para sua propria agenda ou para perfis autorizados.</div>';
                return;
            }

            const numericId = Number(appointmentId);
            if (Number.isNaN(numericId) || numericId <= 0) {
                if (appointment && appointment.lastAction) {
                    auditContent.innerHTML = `
                        <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div class="font-semibold text-yellow-900">Registro local</div>
                            <div class="text-xs text-yellow-800 mt-1">
                                ${escapeAuditHtml(appointment.lastAction.user || 'Sistema')} em ${new Date(appointment.lastAction.timestamp).toLocaleString('pt-BR')}
                            </div>
                            <div class="mt-2">${escapeAuditHtml(formatAuditAction(appointment.lastAction.action))}</div>
                        </div>
                    `;
                } else {
                    auditContent.innerHTML = '<div class="p-3 bg-gray-50 rounded border text-gray-600">Auditoria sera criada quando o agendamento for salvo no banco.</div>';
                }
                return;
            }

            auditContent.innerHTML = '<div class="p-3 bg-gray-50 rounded border text-gray-600">Carregando auditoria...</div>';
            fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}/auditoria`, {
                headers: getAuthenticatedHeaders(false)
            })
            .then(res => res.json())
            .then(data => {
                if (!data || !data.success) {
                    auditContent.innerHTML = `<div class="p-3 bg-red-50 border border-red-200 rounded text-red-700">${data?.error || 'Nao foi possivel carregar a auditoria.'}</div>`;
                    return;
                }

                const entries = Array.isArray(data.auditoria) ? data.auditoria : [];
                if (!entries.length) {
                    auditContent.innerHTML = '<div class="p-3 bg-gray-50 rounded border text-gray-600">Nenhum registro de auditoria encontrado para este agendamento.</div>';
                    return;
                }

                auditContent.innerHTML = `
                    <div class="space-y-3">
                        ${entries.map(entry => {
                            const statusLine = entry.status_anterior || entry.status_novo
                                ? `<div class="text-xs text-gray-600 mt-1">Status: ${escapeAuditHtml(entry.status_anterior || '-')} -> ${escapeAuditHtml(entry.status_novo || '-')}</div>`
                                : '';
                            const details = formatAuditDetails(entry.detalhes);
                            return `
                                <div class="p-3 bg-white border border-gray-200 rounded-lg">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="font-semibold text-gray-900">${escapeAuditHtml(formatAuditAction(entry.acao))}</div>
                                        <div class="text-xs text-gray-500 whitespace-nowrap">${entry.criado_em ? new Date(entry.criado_em).toLocaleString('pt-BR') : ''}</div>
                                    </div>
                                    <div class="text-xs text-gray-600 mt-1">Por: <strong>${escapeAuditHtml(entry.usuario_nome || entry.usuario_username || 'Sistema')}</strong></div>
                                    ${statusLine}
                                    ${details ? `<div class="text-xs text-gray-600 mt-2">${details}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            })
            .catch(err => {
                console.warn('Erro ao carregar auditoria:', err);
                auditContent.innerHTML = '<div class="p-3 bg-red-50 border border-red-200 rounded text-red-700">Erro ao carregar auditoria.</div>';
            });
        }

        function showAppointmentActionOptions(appointment, options = {}) {
            const status = normalizeScheduleStatus(appointment.status || 'agendado');
            const container = document.getElementById('appointmentActionOptions');
            
            if (!container) {
                console.warn('Elemento appointmentActionOptions não encontrado');
                return;
            }

            const isLocked = status === 'cancelado_profissional' && appointment.lockedBy;
            const isLockedByOther = isLocked && currentUser && appointment.lockedBy !== currentUser.username;
            const isLockedBySelf = isLocked && currentUser && appointment.lockedBy === currentUser.username;
            
            let html = `
                <div class="mt-4 pt-4 border-t border-gray-300">
                    <h4 class="font-bold text-gray-800 mb-3">📋 Status e Ações do Agendamento</h4>
                    
                    <div class="mb-3 p-3 rounded-lg ${getStatusColor(status)} border">
                        <div class="text-sm font-medium">Status: ${getStatusLabel(status)}</div>
            `;
            
            if (appointment.lastAction) {
                html += `
                        <div class="text-xs text-gray-600 mt-1">
                            Última ação: <strong>${appointment.lastAction.user}</strong><br>
                            ${new Date(appointment.lastAction.timestamp).toLocaleString('pt-BR')}
                        </div>
                `;
            }
            
            if (isLocked) {
                html += `
                        <div class="text-xs text-red-700 mt-2">
                            Este agendamento está bloqueado por <strong>${appointment.lockedBy}</strong>.
                        </div>
                `;
            }
            
            html += `
                    </div>
                    
                    <div class="space-y-2">
            `;

            if (isLockedByOther) {
                html += `
                        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                            ❌ <strong>Bloqueado:</strong> somente o usuário que cancelou este agendamento pode liberar a alteração.
                        </div>
                `;
            } else {
                const canManageStatus = canUpdateAppointmentStatus(null, appointment);
                html += `
                        ${remarkRequestsEnabled ? `
                        <button type="button" class="w-full bg-sky-700 hover:bg-sky-800 text-white px-3 py-2 rounded text-sm font-medium" onclick="openRemarkRequestModal('${appointment.id}')">
                            Solicitar remarque
                        </button>
                        ` : `
                        <div class="w-full bg-gray-100 text-gray-500 px-3 py-2 rounded text-sm font-medium border border-gray-200">
                            Solicitacao de remarque desativada
                        </div>
                        `}
                        ${canManageStatus ? `
                        <div class="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                            <select id="appointmentStatusSelect" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                                ${renderAppointmentStatusOptions(status, appointment)}
                            </select>
                            <button type="button" class="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded text-sm font-medium" onclick="applyAppointmentStatusFromSelect('${appointment.id}')">
                                Atualizar
                            </button>
                        </div>
                        ` : `
                        <div class="p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm">
                            Status operacional editado pela recepcao/ATAC. Voce pode acompanhar aqui.
                        </div>
                        `}
                        <div class="hidden">
                        <button type="button" class="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium" onclick="updateAppointmentStatus('${appointment.id}', 'finalizado')">
                            ✅ Finalizar Atendimento
                        </button>
                `;

                if (!isLocked || isLockedBySelf) {
                    html += `
                        <button type="button" class="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium" onclick="updateAppointmentStatus('${appointment.id}', 'cancelado_profissional')">
                            ❌ Cancelar (Profissional)
                        </button>
                    `;
                }

                html += `
                        <button type="button" class="w-full bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-sm font-medium" onclick="updateAppointmentStatus('${appointment.id}', 'cancelado_paciente')">
                            ❌ Cancelar (Paciente)
                        </button>
                        <button type="button" class="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm font-medium" onclick="updateAppointmentStatus('${appointment.id}', 'faltou')">
                            Faltou
                        </button>
                `;

                if (status !== 'agendado') {
                    html += `
                        <button type="button" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium" onclick="updateAppointmentStatus('${appointment.id}', 'agendado')">
                            📅 Voltar para Agendado
                        </button>
                    `;
                }

                html += `</div>`;

                if (isLockedBySelf) {
                    html += `
                        <button type="button" class="w-full bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm font-medium" onclick="releaseAppointmentLock('${appointment.id}')">
                            🔓 Liberar para outros usuários
                        </button>
                    `;
                }
            }

            html += `
                    </div>
                </div>
            `;

            container.innerHTML = html;

            if (!options.skipRemarkConfigRefresh) {
                refreshRemarkConfigForOpenAppointment(appointment);
            }
        }

        function refreshRemarkConfigForOpenAppointment(appointment) {
            const before = remarkRequestsEnabled;
            fetchRemarkConfigFromServer({ force: true })
                .then(() => {
                    const currentAppointmentId = document.getElementById('appointmentId')?.value;
                    if (String(currentAppointmentId || '') !== String(appointment.id || '')) {
                        return;
                    }
                    if (before !== remarkRequestsEnabled) {
                        const latestAppointment = getAppointmentById(appointment.id) || appointment;
                        showAppointmentActionOptions(latestAppointment, { skipRemarkConfigRefresh: true });
                    }
                })
                .catch(() => null);
        }

        function setAppointmentSavingState(isSaving) {
            isSavingAppointment = isSaving;
            const submitButton = document.querySelector('#scheduleModal button[type="submit"]');
            if (!submitButton) return;

            if (!submitButton.dataset.originalText) {
                submitButton.dataset.originalText = submitButton.textContent.trim() || 'Salvar';
            }

            submitButton.disabled = isSaving;
            submitButton.textContent = isSaving ? 'Salvando...' : submitButton.dataset.originalText;
            submitButton.classList.toggle('opacity-60', isSaving);
            submitButton.classList.toggle('cursor-not-allowed', isSaving);
        }

        function updateAppointmentStatus(appointmentId, newStatus) {
            newStatus = normalizeScheduleStatus(newStatus);
            const appointmentIndex = appointments.findIndex(a => a.id === appointmentId);
            if (appointmentIndex === -1) return;
            
            const appointment = appointments[appointmentIndex];
            if (!canUpdateAppointmentStatus(newStatus, appointment)) {
                alert('Voce nao tem permissao para alterar este status do agendamento.');
                return;
            }
            const previousState = {
                status: appointment.status || 'agendado',
                lockedBy: appointment.lockedBy || null,
                lastAction: appointment.lastAction ? { ...appointment.lastAction } : null,
                'excluir': 'ðŸ—‘ï¸ Excluir Definitivamente'
            };
            const isLocked = appointment.status === 'cancelado_profissional' && appointment.lockedBy;
            const isLockedByOther = isLocked && currentUser && appointment.lockedBy !== currentUser.username;

            if (isLockedByOther && newStatus !== appointment.status) {
                alert(`🚫 Este agendamento está bloqueado por ${appointment.lockedBy}. Somente este usuário pode liberar para alteração.`);
                return;
            }

            appointment.status = newStatus;
            appointment.lockedBy = newStatus === 'cancelado_profissional' ? (currentUser ? currentUser.username : null) : null;
            appointment.lastAction = {
                user: currentUser ? currentUser.name : 'Usuário',
                timestamp: new Date().toISOString(),
                action: newStatus
            };
            
            // Update localStorage
            localStorage.setItem('appointments', JSON.stringify(appointments));
            
            // Try to sync with server if it's a server appointment
            const numericId = Number(appointmentId);
            if (!Number.isNaN(numericId) && numericId > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (currentUser && currentUser.username && currentUser.password) {
                    headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                }
                
                // Determinar o usuário para ultima_acao
                const usuarioAcao = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
                
                fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        status: newStatus,
                        ultima_acao: usuarioAcao
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (!data || !data.success) {
                        appointment.status = previousState.status;
                        appointment.lockedBy = previousState.lockedBy;
                        appointment.lastAction = previousState.lastAction;
                        localStorage.setItem('appointments', JSON.stringify(appointments));
                        refreshActiveScheduleViews();
                        alert(`ðŸš« ${data?.error || 'Nao foi possivel atualizar o status no servidor.'}`);
                        return;
                    }

                    fetchAppointmentsFromServer();
                    debugLog('Status atualizado no servidor:', data);
                })
                .catch(err => {
                    appointment.status = previousState.status;
                    appointment.lockedBy = previousState.lockedBy;
                    appointment.lastAction = previousState.lastAction;
                    localStorage.setItem('appointments', JSON.stringify(appointments));
                    refreshActiveScheduleViews();
                    console.warn('Falha ao atualizar status no servidor, alteracao local revertida:', err);
                    alert('ðŸš« Nao foi possivel confirmar a alteracao no servidor. O status foi restaurado.');
                });
            }
            
            // Refresh displays
            refreshActiveScheduleViews();
            closeModal('scheduleModal');
            if (!Number.isNaN(numericId) && numericId > 0) {
                return;
            }
            
            showSuccessMessage(`✅ Status atualizado para ${getStatusLabel(newStatus)}`);
        }

        function releaseAppointmentLock(appointmentId) {
            const appointment = appointments.find(a => String(a.id) === String(appointmentId));
            if (!appointment) return;
            if (!currentUser || appointment.lockedBy !== currentUser.username) {
                alert('🚫 Somente o usuário que cancelou este agendamento pode liberá-lo.');
                return;
            }

            const previousState = {
                lockedBy: appointment.lockedBy || null,
                lastAction: appointment.lastAction ? { ...appointment.lastAction } : null
            };
            appointment.lockedBy = null;
            appointment.lastAction = {
                user: currentUser ? currentUser.name : 'Usuário',
                timestamp: new Date().toISOString(),
                action: 'desbloqueado'
            };

            localStorage.setItem('appointments', JSON.stringify(appointments));
            refreshActiveScheduleViews();
            const numericId = Number(appointmentId);
            if (!Number.isNaN(numericId) && numericId > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (currentUser && currentUser.username && currentUser.password) {
                    headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                }

                const usuarioAcao = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
                fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        release_lock: true,
                        ultima_acao: usuarioAcao
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (!data || !data.success) {
                        appointment.lockedBy = previousState.lockedBy;
                        appointment.lastAction = previousState.lastAction;
                        localStorage.setItem('appointments', JSON.stringify(appointments));
                        refreshActiveScheduleViews();
                        showAppointmentActionOptions(appointment);
                        alert(`ðŸš« ${data?.error || 'Nao foi possivel liberar o bloqueio no servidor.'}`);
                        return;
                    }

                    fetchAppointmentsFromServer();
                    showAppointmentActionOptions(appointment);
                    showSuccessMessage('âœ… Agendamento liberado para alteraÃ§Ã£o por outros usuÃ¡rios.');
                })
                .catch(err => {
                    appointment.lockedBy = previousState.lockedBy;
                    appointment.lastAction = previousState.lastAction;
                    localStorage.setItem('appointments', JSON.stringify(appointments));
                    refreshActiveScheduleViews();
                    showAppointmentActionOptions(appointment);
                    console.warn('Falha ao liberar bloqueio no servidor, alteracao local revertida:', err);
                    alert('ðŸš« Nao foi possivel liberar o bloqueio no servidor.');
                });
                return;
            }
            showAppointmentActionOptions(appointment);
            showSuccessMessage('✅ Agendamento liberado para alteração por outros usuários.');
        }

        async function saveRecurringAppointments(baseAppointment) {
            const selectedDays = getSelectedRepeatDays();
            const repeatCount = getRepeatCount();

            if (!selectedDays.length) {
                alert('Selecione pelo menos um dia da semana para repetir o agendamento.');
                setAppointmentSavingState(false);
                return;
            }
            if (repeatCount < 1 || repeatCount > 100) {
                alert('A quantidade de repeticoes deve ficar entre 1 e 100.');
                setAppointmentSavingState(false);
                return;
            }

            const repeatDates = generateRepeatDates(baseAppointment.date, selectedDays, repeatCount);
            if (!repeatDates.length) {
                alert('Nao foi possivel calcular as datas de repeticao.');
                setAppointmentSavingState(false);
                return;
            }

            const conflicts = [];
            let availableDates = repeatDates.filter(date => {
                const conflict = findAppointmentTimeConflict(
                    baseAppointment.professionalId,
                    date,
                    baseAppointment.time,
                    baseAppointment.endTime || baseAppointment.time
                );
                if (conflict) {
                    conflicts.push({ date, conflict });
                    return false;
                }
                return true;
            });

            const patientRoomConflicts = [];
            availableDates = availableDates.filter(date => {
                const conflict = findPatientRoomTimeConflict({ ...baseAppointment, date });
                if (conflict) {
                    patientRoomConflicts.push({ date, conflict });
                    return false;
                }
                return true;
            });

            if (!availableDates.length) {
                if (patientRoomConflicts.length > 0) {
                    alert('Todos os horarios calculados colocam o mesmo paciente em outra sala no mesmo horario. Nenhum agendamento foi criado.');
                } else {
                    alert('Todos os horarios calculados possuem conflito. Nenhum agendamento foi criado.');
                }
                setAppointmentSavingState(false);
                return;
            }

            if (patientRoomConflicts.length > 0) {
                const preview = patientRoomConflicts.slice(0, 8).map(item => {
                    return `${formatDateBR(item.date)} - ${describePatientRoomConflict(item.conflict)}`;
                }).join('\n');
                const more = patientRoomConflicts.length > 8 ? `\n... e mais ${patientRoomConflicts.length - 8} conflito(s)` : '';
                if (!confirm(`O mesmo paciente ja esta em outra sala em ${patientRoomConflicts.length} horario(s):\n\n${preview}${more}\n\nDeseja criar somente os ${availableDates.length} horario(s) sem esse conflito?`)) {
                    setAppointmentSavingState(false);
                    return;
                }
            }

            if (conflicts.length > 0) {
                const preview = conflicts.slice(0, 8).map(item => {
                    return `${formatDateBR(item.date)} - ${item.conflict.clientName || 'Paciente'}`;
                }).join('\n');
                const more = conflicts.length > 8 ? `\n... e mais ${conflicts.length - 8} conflito(s)` : '';
                if (!confirm(`Foram encontrados ${conflicts.length} conflito(s):\n\n${preview}${more}\n\nDeseja criar somente os ${availableDates.length} horario(s) livre(s)?`)) {
                    setAppointmentSavingState(false);
                    return;
                }
            } else {
                const firstDate = formatDateBR(availableDates[0]);
                const lastDate = formatDateBR(availableDates[availableDates.length - 1]);
                if (!confirm(`Confirmar criacao de ${availableDates.length} agendamento(s) recorrente(s)?\n\nPeriodo: ${firstDate} ate ${lastDate}\nHorario: ${baseAppointment.time} - ${baseAppointment.endTime}`)) {
                    setAppointmentSavingState(false);
                    return;
                }
            }

            if (baseAppointment.roomId) {
                const roomConflicts = availableDates
                    .map(date => ({
                        date,
                        conflict: findRoomTimeConflict(
                            baseAppointment.roomId,
                            date,
                            baseAppointment.time,
                            baseAppointment.endTime || baseAppointment.time
                        )
                    }))
                    .filter(item => item.conflict);

                if (roomConflicts.length > 0) {
                    const roomName = getRoomName(baseAppointment.roomId) || 'Selecionada';
                    const preview = roomConflicts.slice(0, 8).map(item => {
                        return `${formatDateBR(item.date)} - ${describeRoomConflict(item.conflict)}`;
                    }).join('\n');
                    const more = roomConflicts.length > 8 ? `\n... e mais ${roomConflicts.length - 8} conflito(s)` : '';
                    if (!confirm(`Sala ocupada: ${roomName}\n\nForam encontrados ${roomConflicts.length} conflito(s) de sala:\n\n${preview}${more}\n\nDeseja criar mesmo assim e juntar profissionais nesta sala?`)) {
                        setAppointmentSavingState(false);
                        return;
                    }
                }
            }

            const headers = { 'Content-Type': 'application/json' };
            if (currentUser && currentUser.username && currentUser.password) {
                headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
            }

            const recurrenceGroupId = createRecurrenceGroupId();
            const createdBy = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
            const createdAt = new Date().toISOString();
            const optimisticAppointments = availableDates.map((date, index) => ({
                ...baseAppointment,
                id: `tmp-${recurrenceGroupId}-${index + 1}`,
                date,
                recurrenceGroupId,
                recurrenceIndex: index + 1,
                recurrenceTotal: availableDates.length,
                createdBy,
                createdAt,
                syncStatus: 'pending',
                lastAction: {
                    user: currentUser ? currentUser.name : 'Usuario',
                    timestamp: createdAt,
                    action: 'criado'
                }
            }));

            const recurringPayloads = optimisticAppointments.map(appointment => ({
                profissional: appointment.professionalId,
                profissional_id: appointment.professionalId,
                sala_id: appointment.roomId || null,
                paciente: appointment.clientName,
                paciente_id: appointment.patientId,
                tipo_atendimento: appointment.type,
                data: appointment.date,
                hora_inicio: appointment.time,
                hora_fim: appointment.endTime || appointment.time,
                quantidade_sessoes: appointment.quantidade_sessoes,
                recorrencia_grupo_id: recurrenceGroupId,
                recorrencia_indice: appointment.recurrenceIndex,
                recorrencia_total: appointment.recurrenceTotal,
                client_temp_id: appointment.id,
                created_by: createdBy,
                usuario_username: currentUser ? currentUser.username : null
            }));

            appointments.push(...optimisticAppointments);
            localStorage.setItem('appointments', JSON.stringify(appointments));
            refreshActiveScheduleViews();
            closeModal('scheduleModal');
            setAppointmentSavingState(false);
            showSuccessMessage(`${recurringPayloads.length} agendamento(s) ja aparecem na agenda. Salvando no banco em segundo plano...`);

            fetch('http://127.0.0.1:5000/api/agendamentos/batch', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    agendamentos: recurringPayloads,
                    created_by: currentUser ? (currentUser.name || currentUser.username) : 'Sistema',
                    usuario_username: currentUser ? currentUser.username : null
                })
            })
            .then(res => res.json())
            .then(async data => {
                if (!data || !data.success || !Array.isArray(data.agendamentos)) {
                    throw new Error(data?.error || 'Nao foi possivel criar as repeticoes.');
                }

                const confirmedTempIds = new Set();
                const createdAppointments = data.agendamentos.map((srv, index) => {
                    const clientTempId = String(srv.client_temp_id || optimisticAppointments[index]?.id || '');
                    const fallback = optimisticAppointments.find(item => item.id === clientTempId) || optimisticAppointments[index] || baseAppointment;
                    const localAppointment = buildLocalAppointmentFromServer(srv, fallback);
                    return { localAppointment, clientTempId };
                });

                if (!createdAppointments.length) {
                    throw new Error('Nenhuma repeticao foi criada no banco.');
                }

                if (createdAppointments.length) {
                    createdAppointments.forEach(({ localAppointment, clientTempId }) => {
                        if (clientTempId) {
                            confirmedTempIds.add(clientTempId);
                        }
                        upsertConfirmedAppointment(localAppointment, clientTempId);
                    });
                    appointments = appointments.filter(item => !(
                        getAppointmentRecurrenceGroupId(item) === recurrenceGroupId &&
                        item.syncStatus === 'pending' &&
                        !confirmedTempIds.has(String(item.id))
                    ));
                    localStorage.setItem('appointments', JSON.stringify(appointments));
                    refreshActiveScheduleViews();
                    fetchAppointmentsFromServer({ force: true }).catch(err => {
                        console.warn('Nao foi possivel atualizar agenda apos recorrencia:', err);
                    });
                }

                showSuccessMessage(`Agendamentos recorrentes salvos no banco: ${createdAppointments.length}`);
            })
            .catch(err => {
                console.warn('Erro ao criar repeticoes em lote:', err);
                appointments = appointments.filter(item => !(
                    getAppointmentRecurrenceGroupId(item) === recurrenceGroupId &&
                    item.syncStatus === 'pending'
                ));
                localStorage.setItem('appointments', JSON.stringify(appointments));
                refreshActiveScheduleViews();
                showErrorMessage(`Nao foi possivel salvar as repeticoes no banco. ${err.message || ''}`);
                setTimeout(() => {
                    fetchAppointmentsFromServer({ force: true }).catch(() => {});
                }, 1000);
            });
        }

        function saveAppointment(event) {
            event.preventDefault();
            if (isSavingAppointment) {
                return;
            }
            setAppointmentSavingState(true);

            const appointmentId = document.getElementById('appointmentId').value;
            const isEditing = !!appointmentId;

            if (isEditing && !checkPermission('edit')) {
                showPermissionDenied('edit');
                setAppointmentSavingState(false);
                return;
            }

            if (!isEditing && !checkPermission('create')) {
                showPermissionDenied('create');
                setAppointmentSavingState(false);
                return;
            }

            // Get data from form - data is now PRIMARY source
            const newDate = document.getElementById('appointmentDateInput').value;
            const newTime = document.getElementById('appointmentTimeInput').value;
            const newEndTime = document.getElementById('appointmentEndInput').value;
            const newProfessionalId = document.getElementById('appointmentProfessional').value;
            const newRoomId = document.getElementById('appointmentRoom').value;
            const patientHiddenElement = document.getElementById('clientPatientId');
            const previousPatientId = patientHiddenElement?.value || '';
            const selectedPatient = syncSelectedPatientFromName();
            const newPatientId = patientHiddenElement?.value || previousPatientId || '';
            const quantidade_sessoes = calcularSessoes(newTime, newEndTime);

            // Validate date
            if (!newDate || newDate === '') {
                alert('❌ Por favor, selecione uma data!');
                setAppointmentSavingState(false);
                return;
            }

            if (!newTime || newTime === '') {
                alert('❌ Por favor, digite um horário de início no formato HH:MM!');
                setAppointmentSavingState(false);
                return;
            }

            if (!isValidTime(newTime)) {
                alert('❌ Horário de início inválido. Use o formato HH:MM.');
                setAppointmentSavingState(false);
                return;
            }

            if (!newEndTime || newEndTime === '') {
                alert('❌ Por favor, digite um horário de término no formato HH:MM!');
                setAppointmentSavingState(false);
                return;
            }

            if (!isValidTime(newEndTime)) {
                alert('❌ Horário de término inválido. Use o formato HH:MM.');
                setAppointmentSavingState(false);
                return;
            }

            if (timeToMinutes(newEndTime) <= timeToMinutes(newTime)) {
                alert('❌ O horário de término deve ser maior que o horário de início.');
                setAppointmentSavingState(false);
                return;
            }

            if (!newRoomId) {
                alert('Por favor, selecione uma sala para este agendamento.');
                setAppointmentSavingState(false);
                return;
            }

            if (!newPatientId) {
                alert('Selecione um paciente ja cadastrado na lista antes de salvar o agendamento.');
                setAppointmentSavingState(false);
                return;
            }

            // Check for conflicts when changing date/time/professional
            if (appointmentId) {
                const existingAppointment = appointments.find(a => a.id === appointmentId);
                const isDateTimeChanged = existingAppointment && (existingAppointment.date !== newDate || 
                                        existingAppointment.time !== newTime ||
                                        existingAppointment.professionalId !== newProfessionalId);

                if (isDateTimeChanged) {
                    const conflict = appointments.find(a => 
                        a.id !== appointmentId &&
                        a.date === newDate && 
                        a.time === newTime && 
                        a.professionalId === newProfessionalId
                    );

                    if (conflict) {
                        const professional = professionals.find(p => p.id === newProfessionalId);
                        const profName = professional ? professional.name : 'Profissional';

                        if (!confirm(`⚠️ CONFLITO DETECTADO!\n\nJá existe um agendamento para ${profName} em ${newDate} às ${newTime}.\n\nPaciente: ${conflict.clientName}\nTipo: ${getTypeLabel(conflict.type)}\n\nDeseja substituir o agendamento existente?`)) {
                            setAppointmentSavingState(false);
                            return;
                        }

                        // Remove conflicting appointment
                        appointments = appointments.filter(a => a.id !== conflict.id);
                    }
                }
            }

            const appointment = {
                id: appointmentId || Date.now().toString(),
                professionalId: newProfessionalId,
                patientId: newPatientId,
                roomId: newRoomId,
                date: newDate,
                time: newTime,
                endTime: newEndTime,
                quantidade_sessoes: quantidade_sessoes,
                clientName: (selectedPatient?.nome || selectedPatient?.name || document.getElementById('clientName').value || '').trim(),
                type: document.getElementById('appointmentType').value,
                observations: document.getElementById('observations').value,
                status: 'agendado',
                lastAction: {
                    user: currentUser ? currentUser.name : 'Usuário',
                    timestamp: new Date().toISOString(),
                    action: 'criado'
                }
            };

            const patientRoomConflict = findPatientRoomTimeConflict(appointment, appointmentId ? [appointmentId] : []);
            if (patientRoomConflict) {
                alert(`Paciente em duas salas no mesmo horario.\n\nConflito encontrado:\n${describePatientRoomConflict(patientRoomConflict)}\n\nAjuste a sala ou o horario antes de salvar.`);
                setAppointmentSavingState(false);
                return;
            }

            if (!(!isEditing && isRepeatEnabled()) && !confirmRoomConflictIfNeeded(appointment, appointmentId ? [appointmentId] : [])) {
                setAppointmentSavingState(false);
                updateRoomAvailabilityHint(appointmentId);
                return;
            }

            if (!isEditing && isRepeatEnabled()) {
                saveRecurringAppointments(appointment);
                return;
            }

            // If editing an existing appointment with a numeric server id, try to update server first
            if (isEditing) {
                const index = appointments.findIndex(a => a.id === appointmentId);
                const existingAppointment = appointments[index];
                
                debugLog('[saveAppointment] ===== EDIT FLOW START =====');
                debugLog('[saveAppointment] appointmentId:', appointmentId);
                debugLog('[saveAppointment] Index in array:', index);
                if (existingAppointment) {
                    debugLog('[saveAppointment] OLD: date=' + existingAppointment.date + ', time=' + existingAppointment.time + ', prof=' + existingAppointment.professionalId);
                    debugLog('[saveAppointment] NEW: date=' + newDate + ', time=' + newTime + ', prof=' + newProfessionalId);
                }
                
                // Preserve status and lastAction from existing appointment
                if (existingAppointment) {
                    appointment.status = existingAppointment.status || 'agendado';
                    appointment.lastAction = existingAppointment.lastAction || appointment.lastAction;
                }
                
                const numericId = Number(appointmentId);

                if (!Number.isNaN(numericId) && numericId > 0) {
                    // Update on server
                    debugLog('[saveAppointment] Sending PUT to server for id=' + numericId);
                    const headers = { 'Content-Type': 'application/json' };
                    if (currentUser && currentUser.username && currentUser.password) {
                        headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                    }

                    fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({
                            profissional: appointment.professionalId,
                            profissional_id: appointment.professionalId,
                            sala_id: appointment.roomId || null,
                            paciente: appointment.clientName,
                            paciente_id: appointment.patientId,
                            tipo_atendimento: appointment.type,
                            data: appointment.date,
                            hora_inicio: appointment.time,
                            hora_fim: appointment.endTime || appointment.time,
                            quantidade_sessoes: appointment.quantidade_sessoes,
                            ultima_acao: currentUser ? (currentUser.name || currentUser.username) : 'Sistema',
                            usuario_username: currentUser ? currentUser.username : null
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        debugLog('[saveAppointment] Server response:', data.success ? 'SUCCESS' : 'FAILED');
                        if (data && data.success) {
                            debugLog('[saveAppointment] Updating local appointments[' + index + ']');
                            if (index !== -1) {
                                appointments[index] = appointment;
                                debugLog('[saveAppointment] Appointment after update:', {
                                    id: appointments[index].id,
                                    date: appointments[index].date,
                                    time: appointments[index].time,
                                    prof: appointments[index].professionalId,
                                    client: appointments[index].clientName
                                });
                                localStorage.setItem('appointments', JSON.stringify(appointments));
                                debugLog('[saveAppointment] Total appointments in cache:', appointments.length);
                            }
                            debugLog('[saveAppointment] Refreshing active schedule view...');
                            refreshActiveScheduleViews();
                            debugLog('[saveAppointment] ===== EDIT FLOW END (SUCCESS) =====');
                            closeModal('scheduleModal');
                            setAppointmentSavingState(false);
                            showSuccessMessage('✅ Agendamento atualizado com sucesso!');
                        } else {
                            console.warn('Falha ao atualizar agendamento no servidor:', data);
                            setAppointmentSavingState(false);
                            alert(`Erro ao atualizar agendamento no servidor: ${data?.error || 'operacao nao confirmada.'}`);
                            return;
                            alert('❌ Erro ao atualizar agendamento no servidor. Operação atualizada localmente.');
                            if (index !== -1) {
                                debugLog('[saveAppointment] Fallback: Updating locally');
                                appointments[index] = appointment;
                                localStorage.setItem('appointments', JSON.stringify(appointments));
                            }
                            debugLog('[saveAppointment] Refreshing active schedule view [fallback]...');
                            refreshActiveScheduleViews();
                            debugLog('[saveAppointment] ===== EDIT FLOW END (FALLBACK) =====');
                            closeModal('scheduleModal');
                            setAppointmentSavingState(false);
                        }
                    })
                    .catch(err => {
                        console.error('Erro ao atualizar agendamento no servidor:', err);
                        setAppointmentSavingState(false);
                        alert('Nao foi possivel confirmar a alteracao no servidor. O agendamento nao foi alterado.');
                        return;
                        // Fallback local change
                        if (index !== -1) {
                            appointments[index] = appointment;
                            localStorage.setItem('appointments', JSON.stringify(appointments));
                        }
                        debugLog('[saveAppointment] Refreshing active schedule view [error]...');
                        refreshActiveScheduleViews();
                        debugLog('[saveAppointment] ===== EDIT FLOW END (ERROR) =====');
                        closeModal('scheduleModal');
                        setAppointmentSavingState(false);
                        showSuccessMessage('✅ Agendamento atualizado localmente (fallback).');
                    });

                    return;
                } else {
                    // Local-only appointment: update locally
                    setAppointmentSavingState(false);
                    alert('Este agendamento ainda nao esta confirmado no servidor. Atualize a agenda e tente novamente.');
                    return;
                    debugLog('[saveAppointment] Local-only appointment (non-numeric id), updating locally');
                    if (index !== -1) {
                        appointments[index] = appointment;
                        localStorage.setItem('appointments', JSON.stringify(appointments));
                    }
                    debugLog('[saveAppointment] Refreshing active schedule view [local]...');
                    refreshActiveScheduleViews();
                    debugLog('[saveAppointment] ===== EDIT FLOW END (LOCAL) =====');
                    closeModal('scheduleModal');
                    setAppointmentSavingState(false);
                    showSuccessMessage('✅ Agendamento atualizado localmente!');
                    return;
                }
            }

            // Creating new appointment: attempt to save to server first
            const createHeaders = { 'Content-Type': 'application/json' };
            if (currentUser && currentUser.username && currentUser.password) {
                createHeaders['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
            }
            fetch('http://127.0.0.1:5000/api/agendamentos', {
                method: 'POST',
                headers: createHeaders,
                body: JSON.stringify({
                    profissional: appointment.professionalId,
                    profissional_id: appointment.professionalId,
                    sala_id: appointment.roomId || null,
                    paciente: appointment.clientName,
                    paciente_id: appointment.patientId,
                    tipo_atendimento: appointment.type,
                    data: appointment.date,
                    hora_inicio: appointment.time,
                    hora_fim: appointment.endTime || appointment.time,
                    quantidade_sessoes: appointment.quantidade_sessoes,
                    created_by: currentUser ? (currentUser.name || currentUser.username) : 'Sistema',
                    usuario_username: currentUser ? currentUser.username : null
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && data.agendamento) {
                    debugLog('[saveAppointment] Server response:', data);
                    const srv = data.agendamento;
                    const newAppt = {
                        id: String(srv.id),
                        professionalId: String(srv.profissional_id || srv.profissional),
                        patientId: srv.paciente_id ? String(srv.paciente_id) : appointment.patientId,
                        roomId: srv.sala_id ? String(srv.sala_id) : appointment.roomId,
                        date: normalizeDate(srv.data),
                        time: normalizeTime(srv.hora_inicio),
                        endTime: normalizeTime(srv.hora_fim),
                        quantidade_sessoes: srv.quantidade_sessoes !== undefined ? srv.quantidade_sessoes : appointment.quantidade_sessoes,
                        clientName: srv.paciente || appointment.clientName,
                        type: srv.tipo_atendimento || appointment.type,
                        observations: appointment.observations || '',
                        createdBy: srv.created_by || srv.criado_por || (currentUser ? (currentUser.name || currentUser.username) : 'Sistema'),
                        createdAt: srv.criado_em || new Date().toISOString()
                    };

                    debugLog('[saveAppointment] Normalized newAppt:', newAppt);
                    debugLog('[saveAppointment] selectedProfessional:', selectedProfessional);
                    debugLog('[saveAppointment] appointments BEFORE push:', appointments.length);
                    
                    // Remove temporary appointment if present (by temp id)
                    appointments = appointments.filter(a => a.id !== appointment.id);
                    appointments.push(newAppt);
                    debugLog('[saveAppointment] appointments AFTER push:', appointments.length);
                    localStorage.setItem('appointments', JSON.stringify(appointments));

                    refreshActiveScheduleViews();
                    closeModal('scheduleModal');
                    setAppointmentSavingState(false);
                    showSuccessMessage(`✅ Agendamento "${newAppt.clientName}" criado e salvo no banco!`);
                } else {
                    console.warn('Resposta inválida ao criar agendamento:', data);
                    throw new Error(data?.error || 'Resposta invalida do servidor');
                }
            })
            .catch(err => {
                console.warn('Falha ao salvar agendamento no servidor:', err);
                setAppointmentSavingState(false);
                alert(`Nao foi possivel salvar o agendamento no banco. ${err.message || ''}`);
                return;
                // Fallback to local only
                appointment.date = normalizeDate(appointment.date);
                appointment.time = normalizeTime(appointment.time);
                appointments.push(appointment);
                localStorage.setItem('appointments', JSON.stringify(appointments));

                refreshActiveScheduleViews();
                closeModal('scheduleModal');
                setAppointmentSavingState(false);

                showSuccessMessage(`✅ Agendamento "${appointment.clientName}" criado localmente (fallback).`);
            });
        }

        async function deleteAppointment() {
            if (!checkPermission('delete')) {
                showPermissionDenied('delete');
                return;
            }

            const appointmentId = document.getElementById('appointmentId').value;
            const appointment = appointments.find(a => a.id === appointmentId);

            if (!appointment) {
                return;
            }

            const professional = professionals.find(p => p.id === appointment.professionalId);
            const profName = professional ? professional.name : 'Profissional';
            const recurrenceGroupId = getAppointmentRecurrenceGroupId(appointment);
            const recurrenceSiblings = getRecurrenceSiblings(appointment);

            const confirmDelete = await showYesNoConfirm({
                title: 'Confirmar exclusao',
                message:
                `Deseja realmente excluir este agendamento?\n\n` +
                `Profissional: ${profName}\n` +
                `Paciente: ${appointment.clientName}\n` +
                `Data: ${appointment.date}\n` +
                `Horario: ${formatAppointmentTime(appointment)}\n` +
                `Tipo: ${getTypeLabel(appointment.type)}\n\n` +
                `Esta acao nao pode ser desfeita.`,
                yesText: 'Sim',
                noText: 'N\u00e3o',
                danger: true
            });
            if (!confirmDelete) {
                return;
            }

            const deleteRepetitions = recurrenceSiblings.length > 1
                ? await showYesNoConfirm({
                    title: 'Excluir repeticoes?',
                    message: `Este agendamento faz parte de uma repeticao com ${recurrenceSiblings.length} horario(s).\n\nDeseja excluir todas as repeticoes tambem?`,
                    yesText: 'Sim, excluir todas',
                    noText: 'N\u00e3o, s\u00f3 este',
                    danger: true
                })
                : false;
            const idsToRemove = deleteRepetitions
                ? recurrenceSiblings.map(item => String(item.id))
                : [String(appointmentId)];

            const removeAppointmentsLocally = (serverDeletedIds = []) => {
                const deletedIdSet = new Set(serverDeletedIds.map(id => String(id)));
                appointments = appointments.filter(item => {
                    if (deleteRepetitions && recurrenceGroupId) {
                        return getAppointmentRecurrenceGroupId(item) !== recurrenceGroupId;
                    }
                    if (deletedIdSet.size) {
                        return !deletedIdSet.has(String(item.id));
                    }
                    return !idsToRemove.includes(String(item.id));
                });
                localStorage.setItem('appointments', JSON.stringify(appointments));
                refreshActiveScheduleViews();
                closeModal('scheduleModal');
            };

            const numericId = Number(appointmentId);
            if (!Number.isNaN(numericId) && numericId > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (currentUser && currentUser.username && currentUser.password) {
                    headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                }

                fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                    method: 'DELETE',
                    headers,
                    body: JSON.stringify({
                        delete_repetitions: deleteRepetitions
                    })
                })
                .then(res => {
                    if (!res.ok) {
                        const err = new Error('HTTP error');
                        err.status = res.status;
                        return res.json().catch(() => { throw err; }).then(body => { err.body = body; throw err; });
                    }
                    return res.json();
                })
                .then(data => {
                    if (data && data.success) {
                        const serverDeletedIds = Array.isArray(data.deleted_ids) ? data.deleted_ids : [];
                        removeAppointmentsLocally(serverDeletedIds);
                        const deletedCount = data.deleted || (deleteRepetitions ? recurrenceSiblings.length : 1);
                        showSuccessMessage(`${deletedCount} agendamento(s) excluido(s) com sucesso!`);
                    } else {
                        console.warn('Erro ao excluir agendamento no servidor:', data);
                        alert('Erro ao excluir agendamento no servidor: ' + (data && data.error ? '\n\n' + data.error : ''));
                    }
                })
                .catch(err => {
                    console.error('Erro ao excluir agendamento no servidor:', err);
                    if (err && err.status === 401) {
                        alert('Nao autenticado. Verifique suas credenciais e faca login novamente.');
                        return;
                    }
                    if (err && err.status === 403) {
                        alert('Acesso negado. Apenas Administradores podem excluir agendamentos.');
                        return;
                    }

                    const serverMsg = err && err.body && err.body.error ? err.body.error : null;
                    if (serverMsg) {
                        alert('Erro no servidor: ' + serverMsg);
                        return;
                    }

                    removeAppointmentsLocally();
                    showSuccessMessage('Agendamento excluido localmente (fallback).');
                });
            } else {
                removeAppointmentsLocally();
                const deletedCount = deleteRepetitions ? recurrenceSiblings.length : 1;
                showSuccessMessage(`${deletedCount} agendamento(s) excluido(s) localmente.`);
            }
            return;
        }

        function showSuccessMessage(message) {
            // Create temporary success notification
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300';
            notification.style.transform = 'translateX(100%)';
            notification.innerHTML = message;
            
            document.body.appendChild(notification);
            
            // Animate in
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            // Animate out and remove
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }

        function showErrorMessage(message) {
            // Create temporary error notification
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300';
            notification.style.transform = 'translateX(100%)';
            notification.innerHTML = message;
            
            document.body.appendChild(notification);
            
            // Animate in
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            // Animate out and remove
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);
        }

        function showEditOptions(appointment) {
            // Enable all fields for editing
            document.getElementById('appointmentProfessional').disabled = false;
            document.getElementById('appointmentRoom').disabled = false;
            document.getElementById('clientName').disabled = false;
            document.getElementById('appointmentType').disabled = false;
            document.getElementById('appointmentTimeInput').disabled = false;
            document.getElementById('appointmentEndInput').disabled = false;
            document.getElementById('observations').disabled = false;
            
            // Add visual indicator that this is an editable imported appointment
            const modal = document.getElementById('scheduleModal');
            const existingBadge = modal.querySelector('.import-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            // Add badge to show this was imported
            const badge = document.createElement('div');
            badge.className = 'import-badge bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium mb-3 inline-block';
            badge.innerHTML = '📥 Agendamento Importado - Totalmente Editável';
            
            const title = modal.querySelector('h3');
            title.parentNode.insertBefore(badge, title.nextSibling);
        }

        // Toggle display of the analysis date picker when appointment type changes
        document.addEventListener('DOMContentLoaded', function() {
            const typeSelect = document.getElementById('appointmentType');
            const dateBlock = document.getElementById('appointmentDateBlock');
            const dateInput = document.getElementById('appointmentDateInput');

            function updateDateVisibility() {
                const val = typeSelect ? typeSelect.value : '';
                if (dateBlock) {
                    if (val === 'analise') {
                        dateBlock.style.display = 'block';
                    } else {
                        dateBlock.style.display = 'none';
                    }
                }
            }

            if (typeSelect) {
                typeSelect.addEventListener('change', updateDateVisibility);
                updateDateVisibility();
            }

            // Keep hidden appointmentDate in sync when visible date input changes
            if (dateInput) {
                dateInput.addEventListener('change', () => {
                    if (document.getElementById('appointmentDate')) document.getElementById('appointmentDate').value = dateInput.value;
                    updateRepeatPreview();
                    updateRoomAvailabilityHint();
                });
            }

            const startTimeInput = document.getElementById('appointmentTimeInput');
            const endTimeInput = document.getElementById('appointmentEndInput');
            if (startTimeInput) startTimeInput.addEventListener('change', () => updateRoomAvailabilityHint());
            if (endTimeInput) endTimeInput.addEventListener('change', () => updateRoomAvailabilityHint());

            loadPatientList();
        });

        function clearScheduleForm() {
            document.getElementById('appointmentId').value = '';
            document.getElementById('appointmentDateInput').value = '';
            document.getElementById('appointmentTimeInput').value = '';
            document.getElementById('appointmentEndInput').value = '';
            document.getElementById('appointmentSessionCount').textContent = '0 sessões';
            document.getElementById('appointmentProfessional').value = '';
            document.getElementById('appointmentRoom').value = '';
            updateRoomAvailabilityHint();
            document.getElementById('clientName').value = '';
            const patientHidden = document.getElementById('clientPatientId');
            if (patientHidden) patientHidden.value = '';
            document.getElementById('appointmentType').value = '';
            document.getElementById('observations').value = '';
            resetRepeatControls();
            setRepeatControlsVisible(true);
            
            // Remove import badge if exists
            const modal = document.getElementById('scheduleModal');
            const existingBadge = modal.querySelector('.import-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            // Enable all fields
            document.getElementById('appointmentProfessional').disabled = false;
            document.getElementById('appointmentRoom').disabled = false;
            document.getElementById('clientName').disabled = false;
            document.getElementById('appointmentDateInput').disabled = false;
            document.getElementById('appointmentType').disabled = false;
            document.getElementById('appointmentTimeInput').disabled = false;
            document.getElementById('observations').disabled = false;
            updateAppointmentAuditTabVisibility(null);
            updatePatientSuggestions();
        }

        // Filter Functions
        function filterByProfessional() {
            selectedProfessional = document.getElementById('professionalFilter').value;
            loadScheduleGrid();
        }

        function searchMainProfessionals() {
            const searchTerm = document.getElementById('mainProfessionalSearch').value.toLowerCase();
            const select = document.getElementById('professionalFilter');
            
            // Clear and rebuild options
            select.innerHTML = '<option value="">Todos os Profissionais</option>';
            
            const filteredProfessionals = professionals.filter(prof => 
                prof.name.toLowerCase().includes(searchTerm)
            );
            
            filteredProfessionals.forEach(prof => {
                const option = document.createElement('option');
                option.value = prof.id;
                option.textContent = prof.name;
                select.appendChild(option);
            });
            
            // If only one result, auto-select it
            if (filteredProfessionals.length === 1) {
                select.value = filteredProfessionals[0].id;
                filterByProfessional();
            }
        }

        function updateProfessionalFilter() {
            const select = document.getElementById('professionalFilter');
            const appointmentSelect = document.getElementById('appointmentProfessional');
            
            // Clear existing options (except first)
            select.innerHTML = '<option value="">Todos os Profissionais</option>';
            appointmentSelect.innerHTML = '<option value="">Selecione o profissional...</option>';
            
            // Only show active professionals in operational filters
            const activeProfessionals = professionals.filter(prof => prof.active !== false);
            
            activeProfessionals.forEach(prof => {
                const option1 = document.createElement('option');
                option1.value = prof.id;
                option1.textContent = prof.name;
                select.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = prof.id;
                option2.textContent = prof.name;
                appointmentSelect.appendChild(option2);
            });

            if (currentUser.level === 'viewer' && currentUser.professionalId) {
                selectedProfessional = currentUser.professionalId;
                select.value = selectedProfessional;
                select.disabled = true;
                appointmentSelect.value = selectedProfessional;
                appointmentSelect.disabled = true;
                updateSelectedProfessionalInfo();
            } else {
                select.disabled = false;
                appointmentSelect.disabled = false;
            }
        }

        function clearMainProfessionalSelection() {
            selectedProfessional = '';
            document.getElementById('professionalFilter').value = '';
            document.getElementById('mainProfessionalSearch').value = '';
            updateProfessionalFilter();
            clearAgendaFilters('schedule');
        }

        function updateAppointmentProfessionals() {
            updateProfessionalFilter();
        }

        function updateWeeklyProfessionalFilter() {
            const select = document.getElementById('weeklyProfessionalFilter');
            
            // Clear existing options (except first)
            select.innerHTML = '<option value="">Todos os Profissionais</option>';
            
            // Only show active professionals in weekly view
            const activeProfessionals = professionals.filter(prof => prof.active !== false);
            
            activeProfessionals.forEach(prof => {
                const option = document.createElement('option');
                option.value = prof.id;
                option.textContent = prof.name;
                select.appendChild(option);
            });

            if (currentUser && currentUser.level === 'viewer' && currentUser.professionalId) {
                select.value = currentUser.professionalId;
                select.disabled = true;
                selectedProfessional = currentUser.professionalId;
                updateSelectedProfessionalInfo();
            } else {
                select.disabled = false;
                if (!selectedProfessional && activeProfessionals.length === 1) {
                    selectedProfessional = activeProfessionals[0].id;
                    select.value = selectedProfessional;
                    updateSelectedProfessionalInfo();
                }
            }
        }

        function filterWeeklyByProfessional() {
            selectedProfessional = document.getElementById('weeklyProfessionalFilter').value;
            updateSelectedProfessionalInfo();
            loadWeeklyScheduleGrid();
        }

        function selectFirstAvailableWeeklyProfessional() {
            const weeklySelect = document.getElementById('weeklyProfessionalFilter');
            if (!weeklySelect) return;
            if (currentUser && currentUser.level === 'viewer' && currentUser.professionalId) {
                selectedProfessional = currentUser.professionalId;
                weeklySelect.value = selectedProfessional;
                updateSelectedProfessionalInfo();
            }
        }

        function searchProfessionals() {
            const searchTerm = document.getElementById('professionalSearch').value.toLowerCase();
            const select = document.getElementById('weeklyProfessionalFilter');
            
            // Clear and rebuild options
            select.innerHTML = '<option value="">Todos os Profissionais</option>';
            
            const filteredProfessionals = professionals.filter(prof => 
                prof.name.toLowerCase().includes(searchTerm)
            );
            
            filteredProfessionals.forEach(prof => {
                const option = document.createElement('option');
                option.value = prof.id;
                option.textContent = prof.name;
                select.appendChild(option);
            });
            
            // If only one result, auto-select it
            if (filteredProfessionals.length === 1) {
                select.value = filteredProfessionals[0].id;
                filterWeeklyByProfessional();
            }
        }

        function updateSelectedProfessionalInfo() {
            const infoDiv = document.getElementById('selectedProfessionalInfo');
            const nameSpan = document.getElementById('selectedProfessionalName');
            const specialtySpan = document.getElementById('selectedProfessionalSpecialty');
            
            if (selectedProfessional) {
                const prof = professionals.find(p => String(p.id) === String(selectedProfessional));
                if (prof) {
                    nameSpan.textContent = prof.name;
                    specialtySpan.textContent = `(${prof.specialty})`;
                    infoDiv.classList.remove('hidden');
                }
            } else {
                infoDiv.classList.add('hidden');
            }
        }

        function clearProfessionalSelection() {
            selectedProfessional = '';
            document.getElementById('weeklyProfessionalFilter').value = '';
            document.getElementById('professionalSearch').value = '';
            ['weeklyAgendaSearch', 'weeklyStatusFilter', 'weeklyRoomFilter'].forEach(fieldId => {
                const element = document.getElementById(fieldId);
                if (element) element.value = '';
            });
            document.getElementById('selectedProfessionalInfo').classList.add('hidden');
            updateWeeklyProfessionalFilter();
            loadWeeklyScheduleGrid();
        }

        function loadWeeklyScheduleGrid() {
            debugLog('[loadWeeklyScheduleGrid] Called with selectedProfessional:', selectedProfessional);
            const grid = document.getElementById('weeklyScheduleGrid');
            const emptyState = document.getElementById('weeklyEmptyState');
            const oldHeader = grid.parentElement.querySelector('.week-navigation-header');
            if (oldHeader) oldHeader.remove();
            
            const viewingAllProfessionals = !selectedProfessional;
            if (viewingAllProfessionals) {
                document.getElementById('selectedProfessionalInfo')?.classList.add('hidden');
            } else {
                updateSelectedProfessionalInfo();
            }
            
            // Hide empty state and show grid
            emptyState.classList.add('hidden');
            grid.style.display = 'grid';
            
            grid.innerHTML = '';
            
            // Get week days (Monday to Saturday only - skip Sunday)
            const weekDays = getWeekDays(currentWeek);
            const visibleWeekDays = weekDays.slice(1, 7); // Skip Sunday (index 0)
            const weekDatesFormatted = visibleWeekDays.map(d => formatDate(d));
            
            // Create week header with navigation
            const weekHeaderDiv = createScheduleWeekHeader(visibleWeekDays);
            grid.parentElement.insertBefore(weekHeaderDiv, grid);
            
            const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            
            // 📊 ENHANCED DEBUG LOGGING
            debugLog('[loadWeeklyScheduleGrid] === RENDERING WEEKLY SCHEDULE ===');
            debugLog('[loadWeeklyScheduleGrid] Week dates:', weekDatesFormatted);
            debugLog('[loadWeeklyScheduleGrid] Selected professional ID:', selectedProfessional, '(type:', typeof selectedProfessional + ')');
            debugLog('[loadWeeklyScheduleGrid] Total appointments in cache:', appointments.length);
            
            // Count appointments by filtering stage
            const profAppointments = viewingAllProfessionals
                ? appointments
                : appointments.filter(a => String(a.professionalId) === String(selectedProfessional));
            debugLog('[loadWeeklyScheduleGrid] ✅ Appointments FOR THIS PROFESSIONAL:', profAppointments.length);
            
            const weekAppointments = filterAgendaAppointments(
                profAppointments.filter(a => weekDatesFormatted.some(weekDate => isSameDay(a.date, weekDate))),
                'weekly'
            );
            debugLog('[loadWeeklyScheduleGrid] ✅ Appointments FOR THIS WEEK:', weekAppointments.length);
            
            const defaultStartMinutes = 6 * 60;
            const defaultEndMinutes = 23 * 60;
            const latestAppointmentEnd = weekAppointments.reduce((max, a) => {
                const endMinutes = timeToMinutes(normalizeTime(a.endTime || a.time));
                return Math.max(max, endMinutes || 0);
            }, defaultEndMinutes);
            const scheduleEndMinutes = Math.min(Math.max(defaultEndMinutes, latestAppointmentEnd), 23 * 60);

            const timeSlots = [];
            for (let minutes = defaultStartMinutes; minutes <= scheduleEndMinutes; minutes += 30) {
                timeSlots.push(minutesToTime(minutes));
            }
            const slotLookup = buildScheduleSlotLookup(weekAppointments, timeSlots);
            
            // Detailed breakdown by day
            const appointmentsByDay = {};
            weekDatesFormatted.forEach(date => {
                appointmentsByDay[date] = weekAppointments.filter(a => isSameDay(a.date, date));
            });
            
            debugLog('[loadWeeklyScheduleGrid] 📅 Breakdown by day:');
            Object.entries(appointmentsByDay).forEach(([date, apts]) => {
                const dayNum = dayNames[weekDatesFormatted.indexOf(date)];
                debugLog(`  ${dayNum} (${date}): ${apts.length} appointments`);
                if (apts.length > 0) {
                    apts.forEach(a => {
                        debugLog(`    - ${a.time}: ${a.clientName} (type: ${a.type})`);
                    });
                }
            });
            
            // Count by time slot
            const slotCounts = {};
            weekAppointments.forEach(a => {
                const key = `${a.date} ${a.time}`;
                slotCounts[key] = (slotCounts[key] || 0) + 1;
            });
            
            const multiSlots = Object.entries(slotCounts).filter(([_, count]) => count > 1);
            if (multiSlots.length > 0) {
                debugLog('[loadWeeklyScheduleGrid] ⚠️ TIME SLOTS WITH MULTIPLE APPOINTMENTS:');
                multiSlots.forEach(([slot, count]) => {
                    debugLog(`  ${slot}: ${count} appointments`);
                });
            }
            
            debugLog('[loadWeeklyScheduleGrid] === END DEBUG ===');
            
            // Update grid template to 6 columns + 1 for time labels
            grid.style.gridTemplateColumns = '80px repeat(6, 1fr)';
            grid.style.gridAutoRows = '24px';
            grid.style.gap = '0';
            
            // Create headers with day names AND dates
            grid.appendChild(createTimeLabel(''));
            visibleWeekDays.forEach((date, idx) => {
                const header = document.createElement('div');
                header.className = `day-header${isSameDay(formatDate(date), formatDate(new Date())) ? ' current-day' : ''}`;
                const dayName = dayNames[idx];
                const dateFormatted = formatDateBR(date).slice(0, 5);
                header.textContent = `${dayName} ${dateFormatted}`;
                grid.appendChild(header);
            });
            
            // Create time slots
            timeSlots.forEach(time => {
                // Time label
                grid.appendChild(createTimeLabel(time));
                
                // Day slots (6 days - Monday to Saturday)
                for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
                    const slot = createTimeSlot(visibleWeekDays[dayIndex], time, 24, defaultStartMinutes, slotLookup);
                    grid.appendChild(slot);
                }
            });
        }

        function populateTimeSlots() {
            const startInput = document.getElementById('appointmentTimeInput');
            const endInput = document.getElementById('appointmentEndInput');
            if (!startInput || !endInput) return;

            startInput.addEventListener('input', () => {
                updateSessionCountDisplay(startInput.value, endInput.value);
            });

            startInput.addEventListener('blur', () => {
                const normalized = normalizeTime(startInput.value.trim());
                if (startInput.value !== normalized) {
                    startInput.value = normalized;
                }
                populateEndTimeOptions(startInput.value, endInput.value);
                updateSessionCountDisplay(startInput.value, endInput.value);
            });

            endInput.addEventListener('input', () => {
                updateSessionCountDisplay(startInput.value, endInput.value);
            });

            endInput.addEventListener('blur', () => {
                const normalized = normalizeTime(endInput.value.trim());
                if (endInput.value !== normalized) {
                    endInput.value = normalized;
                }
                updateSessionCountDisplay(startInput.value, endInput.value);
            });

            populateEndTimeOptions(startInput.value, endInput.value);
        }

        // Reports
        function generateReports() {
            const container = document.getElementById('reportsContent');
            
            // General Statistics
            const totalAppointments = appointments.length;
            const totalProfessionals = professionals.length;
            
            // Type statistics
            const typeStats = {};
            appointments.forEach(apt => {
                typeStats[apt.type] = (typeStats[apt.type] || 0) + 1;
            });
            
            // Professional statistics
            const profStats = {};
            appointments.forEach(apt => {
                const prof = professionals.find(p => p.id === apt.professionalId);
                if (prof) {
                    profStats[prof.name] = (profStats[prof.name] || 0) + 1;
                }
            });
            
            container.innerHTML = `
                <div class="bg-blue-50 p-6 rounded-lg">
                    <h3 class="font-bold text-blue-800 mb-4 text-lg">📊 Estatísticas Gerais</h3>
                    <div class="space-y-2">
                        <div>Total de Agendamentos: <strong>${totalAppointments}</strong></div>
                        <div>Total de Profissionais: <strong>${totalProfessionals}</strong></div>
                        <div class="mt-4">
                            <div class="font-medium mb-2">Por Tipo de Atendimento:</div>
                            ${Object.entries(typeStats).map(([type, count]) => 
                                `<div class="ml-4">${getTypeLabel(type)}: <strong>${count}</strong></div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="bg-green-50 p-6 rounded-lg">
                    <h3 class="font-bold text-green-800 mb-4 text-lg">👥 Por Profissional</h3>
                    <div class="space-y-2">
                        ${Object.entries(profStats).map(([name, count]) => 
                            `<div>${name}: <strong>${count}</strong> agendamentos</div>`
                        ).join('') || '<div>Nenhum agendamento encontrado</div>'}
                    </div>
                </div>
            `;
        }

        // Export/Import Functions
        let selectedFile = null;

        function openExportModal() {
            if (!checkPermission('export')) {
                showPermissionDenied('export');
                return;
            }
            document.getElementById('exportModal').classList.add('active');
        }

        function exportScheduleFromModal() {
            if (!checkPermission('export')) {
                showPermissionDenied('export');
                return;
            }
            
            if (appointments.length === 0) {
                alert('Não há agendamentos para exportar!');
                return;
            }

            // Tentar usar a API do servidor primeiro
            showLoading('Exportando Agendamentos', 'Preparando arquivo Excel...');
            
            // Usar endpoint de download direto para desktop app
            fetch('http://127.0.0.1:5000/api/export/download')
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Erro: ${res.status}`);
                    }
                    return res.blob();
                })
                .then(blob => {
                    hideLoading();
                    // Criar link de download
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    link.download = `agendamentos_${timestamp}.xlsx`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    showSuccessMessage('✅ Arquivo exportado com sucesso!');
                    closeModal('exportModal');
                })
                .catch(err => {
                    console.error('[EXPORT] Erro ao conectar:', err);
                    hideLoading();
                    // Fallback: tentar método original
                    fetch('http://127.0.0.1:5000/api/export/agendamentos')
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                alert(`✅ Arquivo exportado com sucesso!\n\nLocalização: ${data.path}`);
                                closeModal('exportModal');
                            } else {
                                alert(`⚠️ Erro ao exportar: ${data.error}`);
                            }
                        })
                        .catch(() => {
                            alert('⚠️ Erro na conexão com o servidor.');
                        });
                });
        }

        function exportReportFromModal() {
            if (!checkPermission('exportReport')) {
                showPermissionDenied('exportReport');
                return;
            }

            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;
            const includeType = document.getElementById('reportIncludeType')?.checked !== false;
            const includeSessions = document.getElementById('reportIncludeSessions')?.checked !== false;

            if (!startDate || !endDate) {
                alert('Selecione a data inicial e final do relatório antes de exportar.');
                return;
            }

            showLoading('Exportando Relatório', 'Gerando arquivo Excel...');

            const headers = {};
            if (currentUser && currentUser.username && currentUser.password) {
                headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
            }

            const params = new URLSearchParams({
                start_date: startDate,
                end_date: endDate,
                include_type: includeType ? 'true' : 'false',
                include_sessions: includeSessions ? 'true' : 'false',
                use_api: 'true',
                user: (currentUser && currentUser.username) || 'usuario'
            });

            const queryUrl = `http://127.0.0.1:5000/api/relatorio/agendamentos?${params.toString()}`;

            fetch(queryUrl, {
                method: 'GET',
                headers: headers
            })
                .then(async res => {
                    if (!res.ok) {
                        const contentType = res.headers.get('content-type') || '';
                        if (contentType.includes('application/json')) {
                            const data = await res.json();
                            throw new Error(data.error || 'Erro ao gerar relatório');
                        }
                        throw new Error(`Erro de rede: ${res.status}`);
                    }
                    const data = await res.json();
                    return data;
                })
                .then(data => {
                    hideLoading();

                    if (data.success && data.content && data.filename) {
                        // Tentar usar a API do pywebview para salvar e abrir o arquivo
                        if (window.pywebview && window.pywebview.api) {
                            // Usar a API do pywebview para salvar o arquivo
                            window.pywebview.api.salvar_arquivo({
                                filename: data.filename,
                                content: data.content
                            }).then(result => {
                                if (result.success && result.temp_path) {
                                    // Abrir o arquivo com o aplicativo padrão
                                    window.pywebview.api.abrir_arquivo(result.temp_path)
                                        .then(() => {
                                            showSuccessMessage('✅ Relatório exportado e aberto com sucesso!');
                                        })
                                        .catch(err => {
                                            console.error('[RELATORIO] Erro ao abrir arquivo:', err);
                                            showSuccessMessage('✅ Relatório exportado com sucesso!');
                                        });
                                } else {
                                    alert('⚠️ O arquivo foi gerado, mas não foi possível salvá-lo.');
                                }
                                closeModal('exportModal');
                            }).catch(err => {
                                console.error('[RELATORIO] Erro ao salvar via pywebview:', err);
                                alert('⚠️ Não foi possível salvar o arquivo.');
                                closeModal('exportModal');
                            });
                        } else {
                            // Fallback para navegador: decodificar base64 e usar método tradicional
                            const byteCharacters = atob(data.content);
                            const byteNumbers = new Array(byteCharacters.length);
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                            }
                            const byteArray = new Uint8Array(byteNumbers);
                            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                            
                            const downloadUrl = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = data.filename;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            URL.revokeObjectURL(downloadUrl);
                            showSuccessMessage('✅ Relatório exportado com sucesso!');
                            closeModal('exportModal');
                        }
                    } else {
                        throw new Error(data.error || 'Erro ao gerar relatório');
                    }
                })
                .catch(err => {
                    hideLoading();
                    console.error('[RELATORIO] Erro:', err);
                    alert(`⚠️ Não foi possível exportar o relatório: ${err.message}`);
                });
        }

        function exportReportDirect() {
            if (!checkPermission('exportReport')) {
                showPermissionDenied('exportReport');
                return;
            }
            openExportModal();
        }

        function exportScheduleLocal() {
            try {
                const data = appointments.map(apt => {
                    const prof = professionals.find(p => p.id === apt.professionalId);
                    // CORREÇÃO: Usar meio do dia para evitar deslocamento de timezone
                    const aptDate = new Date(apt.date + 'T12:00:00');
                    return {
                        'Data': aptDate.toLocaleDateString('pt-BR'),
                        'Horário': apt.time,
                        'Profissional': prof ? prof.name : 'N/A',
                        'Especialidade': prof ? prof.specialty : 'N/A',
                        'Paciente': apt.clientName,
                        'Tipo': getTypeLabel(apt.type),
                        'Observações': apt.observations || ''
                    };
                });
                
                // Sort by date and time
                data.sort((a, b) => {
                    const dateA = new Date(a.Data.split('/').reverse().join('-') + 'T' + a.Horário);
                    const dateB = new Date(b.Data.split('/').reverse().join('-') + 'T' + b.Horário);
                    return dateA - dateB;
                });
                
                const ws = XLSX.utils.json_to_sheet(data);
                
                // Set column widths
                const colWidths = [
                    { wch: 12 }, // Data
                    { wch: 8 },  // Horário
                    { wch: 20 }, // Profissional
                    { wch: 20 }, // Especialidade
                    { wch: 20 }, // Paciente
                    { wch: 15 }, // Tipo
                    { wch: 30 }  // Observações
                ];
                ws['!cols'] = colWidths;
                
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
                
                const fileName = `agendamentos_clinica_aba_${new Date().toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, fileName);
                
                alert('✅ Arquivo Excel exportado com sucesso!');
                closeModal('exportModal');
            } catch (error) {
                console.error('Erro ao exportar:', error);
                alert('Erro ao exportar arquivo Excel. Verifique se há agendamentos cadastrados.');
            }
        }

        function downloadTemplate() {
            showLoading('Exportando Modelo', 'Preparando arquivo de modelo...');
            
            fetch('http://127.0.0.1:5000/api/export/modelo')
                .then(res => {
                    debugLog('[MODELO] Status:', res.status);
                    return res.json();
                })
                .then(data => {
                    debugLog('[MODELO] Resposta:', data);
                    hideLoading();
                    if (data.success) {
                        alert(`✅ Modelo exportado com sucesso!\n\nLocalização: ${data.path}\n\nAbra a pasta Downloads para acessar o arquivo.`);
                    } else {
                        console.warn('API export falhou:', data.error);
                        alert(`⚠️ Erro ao exportar: ${data.error}\n\nTentando método alternativo...`);
                        downloadTemplateLocal();
                    }
                })
                .catch(err => {
                    console.error('[MODELO] Erro ao conectar:', err);
                    hideLoading();
                    alert('⚠️ Erro na conexão com o servidor.\n\nTentando método alternativo...');
                    downloadTemplateLocal();
                });
        }

        function downloadTemplateLocal() {
            const templateData = [
                {
                    'Data': '01/01/2024',
                    'Horário': '09:00',
                    'Profissional': 'Nome do Profissional',
                    'Paciente': 'Nome do Paciente',
                    'Tipo': 'Clínica',
                    'Observações': 'Observações opcionais'
                }
            ];
            
            const ws = XLSX.utils.json_to_sheet(templateData);
            
            // Set column widths
            const colWidths = [
                { wch: 12 }, // Data
                { wch: 8 },  // Horário
                { wch: 20 }, // Profissional
                { wch: 20 }, // Paciente
                { wch: 15 }, // Tipo
                { wch: 30 }  // Observações
            ];
            ws['!cols'] = colWidths;
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
            
            XLSX.writeFile(wb, 'modelo_agendamentos_clinica_aba.xlsx');
            alert('✅ Modelo de planilha baixado com sucesso!');
        }

        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                selectedFile = file;
                document.getElementById('fileName').textContent = `Arquivo selecionado: ${file.name}`;
                document.getElementById('fileInfo').classList.remove('hidden');
            }
        }

        function clearFileSelection() {
            selectedFile = null;
            document.getElementById('importFile').value = '';
            document.getElementById('fileInfo').classList.add('hidden');
        }

        let importPreviewData = null;
        let originalImportPreviewData = null;

        function importSchedule() {
            if (!checkPermission('import')) {
                showPermissionDenied('import');
                return;
            }
            
            if (!selectedFile) {
                alert('Por favor, selecione um arquivo primeiro!');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    if (!selectedFile.name.endsWith('.xlsx')) {
                        alert('Por favor, selecione apenas arquivos Excel (.xlsx)');
                        return;
                    }

                    // Read Excel workbook
                    const workbook = XLSX.read(e.target.result, { type: 'binary' });
                    
                    const newAppointments = [];
                    const newProfessionals = [];
                    const errors = [];

                    // Show loading modal for processing sheets
                    showLoading('Processando planilha', `Aguardando...`);

                    // Process each sheet with progress updates
                    const sheetNames = workbook.SheetNames || [];
                    const totalSheets = sheetNames.length || 1;

                    for (let s = 0; s < sheetNames.length; s++) {
                        if (importCancelled) {
                            showSuccessMessage('⚠️ Importação cancelada pelo usuário.');
                            hideLoading();
                            return;
                        }

                        const sheetName = sheetNames[s];
                        try {
                            updateLoading(Math.round((s / totalSheets) * 100), `Processando aba ${s+1}/${totalSheets}: ${sheetName}`);

                            const worksheet = workbook.Sheets[sheetName];
                            
                            // Read professional name from B1 only
                            const nameCell = worksheet['B1'];
                            let professionalName = '';
                            
                            if (nameCell && nameCell.v) {
                                professionalName = nameCell.v.toString().trim();
                                
                                // Skip sheets without valid names or with "Horario" or similar
                                if (!professionalName || 
                                    professionalName.toLowerCase().includes('horario') ||
                                    professionalName.toLowerCase().includes('horário') ||
                                    professionalName.toLowerCase().includes('hora') ||
                                    professionalName.toLowerCase().includes('time') ||
                                    professionalName.toLowerCase() === 'sheet1' ||
                                    professionalName.toLowerCase() === 'planilha1' ||
                                    professionalName.length < 2) {
                                    continue; // Skip this sheet
                                }
                            } else {
                                continue; // Skip sheets without name in B1
                            }
                            
                            // Read days from C2 to H2
                            const days = [];
                            for (let col = 'C'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                                const cellRef = col + '2';
                                const cell = worksheet[cellRef];
                                if (cell && cell.v) {
                                    days.push(cell.v.toString().trim());
                                }
                            }

                            // Read times from B3 to B16 (13 time slots: 7:00 to 19:00)
                            const times = [];
                            for (let row = 3; row <= 16; row++) {
                                const cellRef = 'B' + row;
                                const cell = worksheet[cellRef];
                                if (cell && cell.v) {
                                    let timeStr = cell.v.toString().trim();
                                    // Convert '13h' format to '13:00'
                                    if (timeStr.includes('h')) {
                                        timeStr = timeStr.replace('h', ':00');
                                    }
                                    times.push(timeStr);
                                } else {
                                    // If no time in cell, generate based on row (7:00 + row-3)
                                    const hour = 7 + (row - 3);
                                    if (hour <= 19) {
                                        times.push(`${hour.toString().padStart(2, '0')}:00`);
                                    }
                                }
                            }

                            // Process appointments from C3 to H16 (Monday to Saturday only)
                            // C = Segunda, D = Terça, E = Quarta, F = Quinta, G = Sexta, H = Sábado
                            const dayColumns = ['C', 'D', 'E', 'F', 'G', 'H']; // Skip Sunday
                            const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                            
                            for (let colIndex = 0; colIndex < dayColumns.length; colIndex++) {
                                const col = dayColumns[colIndex];
                                const dayName = dayNames[colIndex];
                                
                                for (let rowIndex = 0; rowIndex < times.length; rowIndex++) {
                                    const row = rowIndex + 3;
                                    const cellRef = col + row;
                                    const cell = worksheet[cellRef];
                                    
                                    if (cell && cell.v) {
                                        const cellValue = cell.v.toString().trim();
                                        
                                        // Skip empty cells
                                        if (!cellValue) continue;

                                        // Detect appointment type based on cell color and content
                                        let appointmentType = 'clinica'; // default (laranja)
                                        let clientName = cellValue;
                                        
                                        // Check cell background color
                                        if (cell.s && cell.s.fill && cell.s.fill.bgColor) {
                                            const bgColor = cell.s.fill.bgColor;
                                            appointmentType = detectAppointmentTypeByColor(bgColor, cellValue);
                                        } else {
                                            // If no color, try to detect by content
                                            appointmentType = detectAppointmentTypeByContent(cellValue);
                                        }
                                        
                                        // Set appropriate client name for blocked slots
                                        if (appointmentType === 'bloqueado') {
                                            if (cellValue.toLowerCase().includes('almoço') || 
                                                cellValue.toLowerCase().includes('almoco')) {
                                                clientName = 'Almoço';
                                            } else if (cellValue.toLowerCase().includes('deslocamento')) {
                                                clientName = 'Deslocamento';
                                            } else {
                                                clientName = 'Horário Bloqueado';
                                            }
                                        }

                                        // Find or create professional (use name from B1)
                                        let professional = professionals.find(p => 
                                            p.name.toLowerCase() === professionalName.toLowerCase()
                                        );
                                        
                                        if (!professional) {
                                            // Check if already in newProfessionals
                                            professional = newProfessionals.find(p => 
                                                p.name.toLowerCase() === professionalName.toLowerCase()
                                            );
                                            
                                            if (!professional) {
                                                professional = {
                                                    id: Date.now().toString() + '_' + newProfessionals.length,
                                                    name: professionalName,
                                                    specialty: 'Terapeuta ABA',
                                                    color: getRandomColor()
                                                };
                                                newProfessionals.push(professional);
                                            }
                                        }

                                        // Calculate date based on current week and day
                                        const appointmentDate = calculateDateFromDay(dayName);
                                        
                                        if (appointmentDate) {
                                            const appointment = {
                                                id: Date.now().toString() + '_' + newAppointments.length,
                                                professionalId: professional.id,
                                                date: appointmentDate,
                                                time: times[rowIndex],
                                                clientName: clientName,
                                                type: appointmentType,
                                                observations: ''
                                            };
                                            
                                            newAppointments.push(appointment);
                                        }
                                    }
                                }
                            }
                        } catch (sheetError) {
                            errors.push(`Erro na aba "${sheetName}": ${sheetError.message}`);
                        }
                    }

                    // Hide loading modal after processing
                    hideLoading();
                    if (errors.length > 0) {
                        alert('Erros encontrados:\n\n' + errors.join('\n'));
                        return;
                    }

                    // Store preview data
                    importPreviewData = {
                        appointments: newAppointments,
                        professionals: newProfessionals
                    };

                    // Store original preview data for offset calculations
                    originalImportPreviewData = JSON.parse(JSON.stringify(importPreviewData));

                    // Show confirmation dialog
                    showImportConfirmation(newProfessionals.length, newAppointments.length);
                    
                } catch (error) {
                    console.error('Erro na importação:', error);
                    alert('Erro ao processar arquivo Excel. Verifique se o formato está correto.');
                }
            };

            reader.readAsBinaryString(selectedFile);
        }

        function detectAppointmentTypeByColor(bgColor, cellValue) {
            let colorCode = '';
            
            // First check content for specific keywords and names
            const content = cellValue.toLowerCase();
            if (content.includes('sup') || content.includes('clarissa') || content.includes('reinaldo')) {
                return 'supervisao';
            } else if (content.includes('trein') || content.includes('reun')) {
                return 'treinamento';
            } else if (content.includes('almoço') || content.includes('almoco') || 
                      content.includes('deslocamento') || content.includes('bloqueado')) {
                return 'bloqueado';
            }
            
            // Extract RGB color code
            if (bgColor.rgb) {
                colorCode = bgColor.rgb.toUpperCase();
            } else if (bgColor.indexed) {
                // Handle indexed colors (Excel default palette)
                const indexedColors = {
                    43: 'FFA500', // Orange (Atendimento Clínica)
                    45: 'FFC0CB', // Pink (Análise)
                    41: '0000FF', // Blue (Discussão de Caso)
                    50: '008000', // Green (CLS)
                    36: 'FFFF99', // Light Yellow (Supervisão)
                    53: '800080', // Purple (Treinamento)
                    44: 'FFD700', // Gold/Yellow (Orientação Parental)
                    48: 'C0C0C0', // Gray (Bloqueado)
                    15: 'C0C0C0', // Gray (Bloqueado)
                    22: 'C0C0C0'  // Gray (Bloqueado)
                };
                colorCode = indexedColors[bgColor.indexed] || '';
            }
            
            // Detect type by color ranges
            if (isColorInRange(colorCode, ['FFA500', 'FF8C00', 'FF7F00', 'FFA000', 'FF6600'])) {
                return 'clinica'; // Laranja - Atendimento Clínica
            } else if (isColorInRange(colorCode, ['FFC0CB', 'FFB6C1', 'FF69B4', 'FF1493', 'FFCCCB'])) {
                return 'analise'; // Rosa - Análise
            } else if (isColorInRange(colorCode, ['0000FF', '0066FF', '3366FF', '6699FF', '4169E1'])) {
                return 'discussao'; // Azul - Discussão de Caso
            } else if (isColorInRange(colorCode, ['008000', '00FF00', '32CD32', '90EE90', '00CC00'])) {
                return 'cls'; // Verde - CLS
            } else if (isColorInRange(colorCode, ['FFFF99', 'FFFFCC', 'F0F8FF', 'FFFACD', 'FFFFE0'])) {
                return 'supervisao'; // Amarelo claro - Supervisão
            } else if (isColorInRange(colorCode, ['800080', '9932CC', 'BA55D3', 'DDA0DD', '8B008B'])) {
                return 'treinamento'; // Roxo - Treinamento
            } else if (isColorInRange(colorCode, ['FFD700', 'FFFF00', 'FFF700', 'FFED4E', 'GOLD'])) {
                return 'orientacao'; // Amarelo gema - Orientação Parental
            } else if (isColorInRange(colorCode, ['C0C0C0', 'CCCCCC', '808080', 'A9A9A9', 'D3D3D3', 'DCDCDC'])) {
                return 'bloqueado'; // Cinza - Bloqueado/Almoço/Deslocamento
            }
            
            // Default to content-based detection if color doesn't match
            return detectAppointmentTypeByContent(cellValue);
        }

        function isColorInRange(colorCode, colorRange) {
            if (!colorCode) return false;
            return colorRange.some(color => {
                // Check if colors are similar (allowing for slight variations)
                const diff = Math.abs(parseInt(colorCode, 16) - parseInt(color, 16));
                return diff < 0x111111; // Allow some tolerance
            });
        }

        function detectAppointmentTypeByContent(cellValue) {
            const content = cellValue.toLowerCase();
            
            // Check for specific keywords and names
            if (content.includes('sup') || content.includes('clarissa') || content.includes('reinaldo')) {
                return 'supervisao';
            } else if (content.includes('trein') || content.includes('reun')) {
                return 'treinamento';
            } else if (content.includes('análise') || content.includes('analise')) {
                return 'analise';
            } else if (content.includes('discussão') || content.includes('discussao') || content.includes('caso')) {
                return 'discussao';
            } else if (content.includes('cls')) {
                return 'cls';
            } else if (content.includes('supervisão') || content.includes('supervisao') || content.includes('super')) {
                return 'supervisao';
            } else if (content.includes('treinamento') || content.includes('treino')) {
                return 'treinamento';
            } else if (content.includes('orientação') || content.includes('orientacao') || content.includes('parental')) {
                return 'orientacao';
            } else if (content.includes('almoço') || content.includes('almoco') || 
                      content.includes('deslocamento') || content.includes('bloqueado')) {
                return 'bloqueado';
            }
            
            // Default to clinic appointment
            return 'clinica';
        }

        function getRandomColor() {
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 
                          'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
            return colors[Math.floor(Math.random() * colors.length)];
        }

        function calculateDateFromDay(dayName) {
            const dayMap = {
                'Segunda': 1, 'Seg': 1, 'Monday': 1,
                'Terça': 2, 'Ter': 2, 'Tuesday': 2,
                'Quarta': 3, 'Qua': 3, 'Wednesday': 3,
                'Quinta': 4, 'Qui': 4, 'Thursday': 4,
                'Sexta': 5, 'Sex': 5, 'Friday': 5,
                'Sábado': 6, 'Sab': 6, 'Saturday': 6,
                'Domingo': 0, 'Dom': 0, 'Sunday': 0
            };

            const targetDay = dayMap[dayName];
            if (targetDay === undefined) return null;

            const today = new Date();
            const currentDay = today.getDay();
            const diff = targetDay - currentDay;
            
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + diff);
            
            return formatDate(targetDate);
        }

        function showImportConfirmation(professionalsCount, appointmentsCount) {
            document.getElementById('professionalsCount').innerHTML = 
                `👨‍⚕️ <span class="font-bold">${professionalsCount}</span> profissionais adicionados`;
            document.getElementById('appointmentsCount').innerHTML = 
                `📅 <span class="font-bold">${appointmentsCount}</span> agendamentos totais`;
            
            // Display week info
            updateWeekDisplay();
            
            // Default to server target
            const serverRadio = document.getElementById('importTargetServer');
            const localRadio = document.getElementById('importTargetLocal');
            if (serverRadio) serverRadio.checked = true;
            if (localRadio) localRadio.checked = false;

            closeModal('exportModal');
            document.getElementById('importConfirmationModal').classList.add('active');
        }

        function shiftAppointmentWeek(days) {
            if (!importPreviewData || !importPreviewData.appointments) return;
            
            // Shift all appointment dates by the specified number of days
            importPreviewData.appointments.forEach(apt => {
                const [year, month, day] = apt.date.split("-");
                const currentDate = new Date(year, month - 1, day);
                currentDate.setDate(currentDate.getDate() + days);
                
                // Format back to YYYY-MM-DD
                const newYear = currentDate.getFullYear();
                const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
                const newDay = String(currentDate.getDate()).padStart(2, '0');
                apt.date = `${newYear}-${newMonth}-${newDay}`;
            });
            
            // Update the display
            updateWeekDisplay();
        }

        function updateWeekDisplay() {
            if (!importPreviewData || !importPreviewData.appointments || importPreviewData.appointments.length === 0) {
                document.getElementById('appointmentsWeekInfo').classList.add('hidden');
                return;
            }
            
            const appointmentDates = importPreviewData.appointments.map(apt => apt.date).filter(date => date);
            
            const parsedAppointmentDates = appointmentDates
                .map(date => parseDateSafe(formatDate(date)))
                .filter(date => date instanceof Date && !isNaN(date));
            
            if (parsedAppointmentDates.length > 0) {
                // Get min and max dates
                const minDate = new Date(Math.min(...parsedAppointmentDates.map(date => date.getTime())));
                const maxDate = new Date(Math.max(...parsedAppointmentDates.map(date => date.getTime())));
                
                // Format dates for display (dd/mm/yyyy)
                const formatDisplayDate = (date) => {
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                };
                
                // Get day names
                const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                const minDayName = dayNames[minDate.getDay()];
                const maxDayName = dayNames[maxDate.getDay()];
                
                // Update the display
                const weekRangeDiv = document.getElementById('weekDateRange');
                weekRangeDiv.textContent = `${formatDisplayDate(minDate)} (${minDayName}) → ${formatDisplayDate(maxDate)} (${maxDayName})`;
            }
        }

        function applyWeekOffset(targetDateStr) {
            if (!originalImportPreviewData || !originalImportPreviewData.appointments) return;
            
            if (!targetDateStr) {
                // Reset to original if no date selected
                resetWeekOffset();
                return;
            }
            
            // Parse target date (should be a Monday - segunda-feira)
            const [targetYear, targetMonth, targetDay] = targetDateStr.split("-");
            const targetMonday = new Date(targetYear, targetMonth - 1, targetDay);
            
            // Recalculate all appointments based on offset from original week
            importPreviewData.appointments = originalImportPreviewData.appointments.map(apt => {
                // Parse original appointment date
                const [origYear, origMonth, origDay] = apt.date.split("-");
                const originalDate = new Date(origYear, origMonth - 1, origDay);
                
                // Get day of week for original date (0 = Sunday, 1 = Monday, etc)
                const dayOfWeek = originalDate.getDay();
                
                // Calculate offset from Monday (1) of original week
                // If original is Monday (1), offset is 0
                // If original is Tuesday (2), offset is +1
                // If original is Sunday (0), offset is +6 (or -1)
                let offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                
                // Apply offset to target Monday
                const newDate = new Date(targetMonday);
                newDate.setDate(newDate.getDate() + offset);
                
                // Format back to YYYY-MM-DD
                const newYear = newDate.getFullYear();
                const newMonth = String(newDate.getMonth() + 1).padStart(2, '0');
                const newDay = String(newDate.getDate()).padStart(2, '0');
                
                return {
                    ...apt,
                    date: `${newYear}-${newMonth}-${newDay}`
                };
            });
            
            // Show info message
            document.getElementById('weekOffsetInfo').classList.remove('hidden');
            
            // Update the display
            updateWeekDisplay();
        }

        function resetWeekOffset() {
            if (!originalImportPreviewData) return;
            
            // Restore original appointments
            importPreviewData.appointments = JSON.parse(JSON.stringify(originalImportPreviewData.appointments));
            
            // Clear the date picker
            document.getElementById('targetWeekDatePicker').value = '';
            
            // Hide info message
            document.getElementById('weekOffsetInfo').classList.add('hidden');
            
            // Update the display
            updateWeekDisplay();
        }
        // Loading / Progress helper functions
        let importAbortController = null;
        let importCancelled = false;

        function showLoading(title = 'Carregando...', message = 'Aguarde...') {
            const modal = document.getElementById('loadingModal');
            if (!modal) return;
            // reset abort controller and cancelled flag
            importCancelled = false;
            try {
                importAbortController = new AbortController();
            } catch (e) {
                importAbortController = null;
            }

            document.getElementById('loadingTitle').textContent = title;
            document.getElementById('loadingMessage').textContent = message;
            updateLoading(0, message);
            // enable cancel button
            const btn = document.getElementById('loadingCancelBtn');
            if (btn) btn.disabled = false;
            modal.classList.add('active');
        }

        function updateLoading(percent = 0, message = '') {
            const bar = document.getElementById('loadingBar');
            const pct = document.getElementById('loadingPercent');
            const msg = document.getElementById('loadingMessage');
            if (bar) bar.style.width = `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
            if (pct) pct.textContent = `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
            if (msg && message) msg.textContent = message;
        }

        function hideLoading() {
            const modal = document.getElementById('loadingModal');
            if (!modal) return;
            modal.classList.remove('active');
            updateLoading(0, 'Concluído');
            // disable cancel button and clear controller
            const btn = document.getElementById('loadingCancelBtn');
            if (btn) btn.disabled = true;
            importCancelled = false;
            importAbortController = null;
        }

        function cancelImportInProgress() {
            importCancelled = true;
            if (importAbortController && importAbortController.abort) {
                try { importAbortController.abort(); } catch (e) { /* ignore */ }
            }
            updateLoading(0, 'Cancelando...');
            setTimeout(() => {
                hideLoading();
                showSuccessMessage('⚠️ Importação cancelada pelo usuário. Podem existir dados parciais salvos no servidor.');
            }, 250);
        }

        // Normalize names for robust matching (strip accents, lowercase, collapse spaces)
        function normalizeName(name) {
            return (name || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
        }

        async function confirmImport() {
            if (!importPreviewData) return;

            const toCreateProfessionals = importPreviewData.professionals || [];
            const toCreateAppointments = importPreviewData.appointments || [];

            // Show loading modal and calculate total steps (fetch + each professional + each appointment)
            const totalSteps = 1 + toCreateProfessionals.length + toCreateAppointments.length;
            let completedSteps = 0;
            showLoading('Importando dados', 'Preparando importação...');
            updateLoading(0, 'Preparando importação...');

            // Add professionals locally right away
            toCreateProfessionals.forEach(prof => professionals.push(prof));
            localStorage.setItem('professionals', JSON.stringify(professionals));
            updateProfessionalFilter();

            // If user chose local-only, do a fast local save and skip server calls
            const localOnlyRadio = document.getElementById('importTargetLocal') && document.getElementById('importTargetLocal').checked;
            const localOnly = (importPreviewData && importPreviewData.localOnly) || localOnlyRadio;
            if (localOnly) {
                updateLoading(20, 'Salvando localmente...');

                // Mark imported objects as local-only to avoid any accidental sync
                toCreateProfessionals.forEach(p => { p.localOnly = true; });
                toCreateAppointments.forEach(a => { a.localOnly = true; });

                // Save appointments and professionals locally only
                appointments = toCreateAppointments.map(a => ({ ...a }));
                localStorage.setItem('appointments', JSON.stringify(appointments));
                localStorage.setItem('professionals', JSON.stringify(professionals));

                refreshActiveScheduleViews();

                importPreviewData = null;
                clearFileSelection();
                closeModal('importConfirmationModal');

                updateLoading(100, 'Concluído (somente local)');
                setTimeout(() => hideLoading(), 250);

                showSuccessMessage(`✅ Import concluída localmente — Profissionais: ${toCreateProfessionals.length}, Agendamentos: ${toCreateAppointments.length} (não enviados ao servidor)`);
                return;
            }

            // Step 1: Fetch server professionals to detect duplicates by normalized name
            const serverList = await fetchProfessionalsFromServer(importAbortController ? importAbortController.signal : undefined).catch((err) => { if (err && err.name === 'AbortError') throw err; return []; });
            if (importCancelled) { cancelImportInProgress(); return; }
            completedSteps++;
            updateLoading((completedSteps / totalSteps) * 100, `Obtendo profissionais do servidor (${completedSteps}/${totalSteps})`);

            const serverNameMap = {};
            serverList.forEach(p => {
                const key = normalizeName(p.nome || p.name || '');
                if (key) serverNameMap[key] = String(p.id);
            });

            const profIdMap = {}; // tempId -> serverId
            let profSavedServer = 0;
            let profAlreadyExistsOnServer = 0;

            // Detect existing server matches and map them (avoid POST if match found)
            toCreateProfessionals.forEach(prof => {
                const key = normalizeName(prof.name);
                if (key && serverNameMap[key]) {
                    const sid = serverNameMap[key];
                    profIdMap[prof.id] = sid;

                    // replace local temp entry with server id (or remove duplicate temp)
                    const localIndex = professionals.findIndex(p => p.id === prof.id);
                    const existsWithServerId = professionals.findIndex(p => String(p.id) === sid);
                    if (localIndex !== -1) {
                        if (existsWithServerId === -1) {
                            professionals[localIndex].id = sid;
                        } else {
                            professionals.splice(localIndex, 1);
                        }
                    }

                    profAlreadyExistsOnServer++;
                }
            });

            // POST professionals that did not exist on server — use batch endpoint for speed
            const toPost = toCreateProfessionals.filter(p => !profIdMap[p.id]);
            if (toPost.length > 0) {
                try {
                    updateLoading((completedSteps / totalSteps) * 100, 'Enviando profissionais em lote...');
                    const payload = { professionals: toPost.map(p => ({ tempId: p.id, nome: p.name, especialidade: p.specialty, ativo: p.active })) };
                    const res = await fetch('http://127.0.0.1:5000/api/profissionais/batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: importAbortController ? importAbortController.signal : undefined
                    });
                    const data = await res.json();
                    if (data && data.success && data.mapping) {
                        Object.keys(data.mapping).forEach(temp => {
                            profIdMap[temp] = data.mapping[temp];
                            // update local entry id if present
                            const p = professionals.find(x => x.id === temp);
                            if (p) p.id = data.mapping[temp];
                            profSavedServer++;
                        });
                    } else {
                        console.warn('Resposta inválida no batch de profissionais, fallback para envio sequencial', data);
                        // fallback: sequential POST
                        for (const prof of toPost) {
                            if (importCancelled) break;
                            try {
                                const res2 = await fetch('http://127.0.0.1:5000/api/profissionais', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ nome: prof.name, especialidade: prof.specialty, ativo: prof.active }),
                                    signal: importAbortController ? importAbortController.signal : undefined
                                });
                                const d2 = await res2.json();
                                if (d2 && d2.success && d2.profissional) {
                                    const sid = String(d2.profissional.id);
                                    profIdMap[prof.id] = sid;
                                    const p = professionals.find(x => x.id === prof.id);
                                    if (p) p.id = sid;
                                    profSavedServer++;
                                }
                            } catch (err) {
                                if (err && err.name === 'AbortError') {
                                    console.warn('Import canceled during professional fallback post');
                                    break;
                                }
                                console.warn('Fallback - não foi possível salvar profissional no servidor (local):', prof.name, err);
                            }
                        }
                    }

                    if (importCancelled) { cancelImportInProgress(); return; }
                } catch (err) {
                    console.warn('Batch POST falhou, fallback sequencial:', err);
                    // Fallback sequential posting
                    for (const prof of toPost) {
                        try {
                            const res2 = await fetch('http://127.0.0.1:5000/api/profissionais', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ nome: prof.name, especialidade: prof.specialty, ativo: prof.active })
                            });
                            const d2 = await res2.json();
                            if (d2 && d2.success && d2.profissional) {
                                const sid = String(d2.profissional.id);
                                profIdMap[prof.id] = sid;
                                const p = professionals.find(x => x.id === prof.id);
                                if (p) p.id = sid;
                                profSavedServer++;
                            }
                        } catch (err2) {
                            console.warn('Fallback sequencial - erro:', err2);
                        }
                    }
                }
            }

            // mark progress after professionals
            completedSteps++;
            updateLoading((completedSteps / totalSteps) * 100, `Profissionais convergidos (${completedSteps}/${totalSteps})`);

            // Now create appointments using mapped professional ids when available — use batch endpoint
            const apptResults = { serverSaved: 0, localSaved: 0 };
            const finalAppointments = [];

            // Build payloads: map professional IDs when possible
            const apptPayloads = toCreateAppointments.map(appt => {
                let mappedProfId = profIdMap[appt.professionalId];
                if (!mappedProfId) {
                    const localProf = professionals.find(x => x.id === appt.professionalId || normalizeName(x.name) === normalizeName(professionals.find(p => p.id === appt.professionalId)?.name || ''));
                    if (localProf) mappedProfId = String(localProf.id);
                }
                return {
                    profissional: mappedProfId || appt.professionalId,
                    paciente: appt.clientName || appt.patient || '',
                    tipo_atendimento: appt.type || appt.tipo || '',
                    data: appt.date,
                    hora_inicio: appt.time,
                    hora_fim: appt.endTime || appt.time,
                    __tempId: appt.id
                };
            });

            if (apptPayloads.length > 0) {
                try {
                    updateLoading((completedSteps / totalSteps) * 100, 'Enviando agendamentos em lote...');
                    const res = await fetch('http://127.0.0.1:5000/api/agendamentos/batch', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ agendamentos: apptPayloads }),
                        signal: importAbortController ? importAbortController.signal : undefined
                    });
                    const data = await res.json();
                    if (data && data.success && Array.isArray(data.agendamentos)) {
                        data.agendamentos.forEach(srv => {
                            finalAppointments.push({
                                id: String(srv.id),
                                professionalId: String(srv.profissional),
                                date: srv.data,
                                time: normalizeTime(srv.hora_inicio),
                                endTime: normalizeTime(srv.hora_fim),
                                clientName: srv.paciente,
                                type: srv.tipo_atendimento,
                                observations: '',
                                createdAt: srv.criado_em || new Date().toISOString()
                            });
                            apptResults.serverSaved++;
                        });
                    } else {
                        console.warn('Resposta inválida no batch de agendamentos, fallback para envio sequencial', data);
                        for (const appt of toCreateAppointments) {
                            if (importCancelled) break;
                            const mappedProfId = profIdMap[appt.professionalId] || (professionals.find(x => x.id === appt.professionalId) ? String(professionals.find(x => x.id === appt.professionalId).id) : appt.professionalId);
                            const payload = {
                                profissional: mappedProfId,
                                paciente: appt.clientName || appt.patient || '',
                                tipo_atendimento: appt.type || appt.tipo || '',
                                data: appt.date,
                                hora_inicio: appt.time,
                                hora_fim: appt.endTime || appt.time
                            };

                            try {
                                const res2 = await fetch('http://127.0.0.1:5000/api/agendamentos', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload),
                                    signal: importAbortController ? importAbortController.signal : undefined
                                });
                                const d2 = await res2.json();
                                if (d2 && d2.success && d2.agendamento) {
                                    const srv = d2.agendamento;
                                    finalAppointments.push({
                                        id: String(srv.id),
                                        professionalId: String(srv.profissional),
                                        date: srv.data,
                                        time: normalizeTime(srv.hora_inicio),
                                        endTime: normalizeTime(srv.hora_fim),
                                        clientName: srv.paciente || payload.paciente,
                                        type: srv.tipo_atendimento || payload.tipo_atendimento,
                                        observations: appt.observations || '',
                                        createdAt: srv.criado_em || new Date().toISOString()
                                    });
                                    apptResults.serverSaved++;
                                } else {
                                    finalAppointments.push({ ...appt });
                                    apptResults.localSaved++;
                                }
                            } catch (err) {
                                if (err && err.name === 'AbortError') {
                                    console.warn('Import canceled during appointment fallback post');
                                    break;
                                }
                                finalAppointments.push({ ...appt });
                                apptResults.localSaved++;
                            }
                        }
                    }

                    if (importCancelled) { cancelImportInProgress(); return; }
                } catch (err) {
                    console.warn('Batch POST agendamentos falhou, fallback sequencial:', err);
                    for (const appt of toCreateAppointments) {
                        const mappedProfId = profIdMap[appt.professionalId] || (professionals.find(x => x.id === appt.professionalId) ? String(professionals.find(x => x.id === appt.professionalId).id) : appt.professionalId);
                        const payload = {
                            profissional: mappedProfId,
                            paciente: appt.clientName || appt.patient || '',
                            tipo_atendimento: appt.type || appt.tipo || '',
                            data: appt.date,
                            hora_inicio: appt.time,
                            hora_fim: appt.endTime || appt.time
                        };

                        try {
                            const res2 = await fetch('http://127.0.0.1:5000/api/agendamentos', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            const d2 = await res2.json();
                            if (d2 && d2.success && d2.agendamento) {
                                const srv = d2.agendamento;
                                finalAppointments.push({
                                    id: String(srv.id),
                                    professionalId: String(srv.profissional),
                                    date: srv.data,
                                    time: normalizeTime(srv.hora_inicio),
                                    endTime: normalizeTime(srv.hora_fim),
                                    clientName: srv.paciente || payload.paciente,
                                    type: srv.tipo_atendimento || payload.tipo_atendimento,
                                    observations: appt.observations || '',
                                    createdAt: srv.criado_em || new Date().toISOString()
                                });
                                apptResults.serverSaved++;
                            } else {
                                finalAppointments.push({ ...appt });
                                apptResults.localSaved++;
                            }
                        } catch (err2) {
                            finalAppointments.push({ ...appt });
                            apptResults.localSaved++;
                        }
                    }
                }
            } else {
                // nothing to send
            }

            // Replace appointments and persist
            appointments = finalAppointments;
            localStorage.setItem('appointments', JSON.stringify(appointments));
            localStorage.setItem('professionals', JSON.stringify(professionals));

            refreshActiveScheduleViews();

            importPreviewData = null;
            clearFileSelection();
            closeModal('importConfirmationModal');

            // Finish and hide loading
            updateLoading(100, 'Finalizando...');
            setTimeout(() => hideLoading(), 300);

            showSuccessMessage(`✅ Import concluída — Profissionais: ${toCreateProfessionals.length} (existentes no servidor: ${profAlreadyExistsOnServer}, novos salvos no servidor: ${profSavedServer}), Agendamentos: ${toCreateAppointments.length} (servidor: ${apptResults.serverSaved}, local: ${apptResults.localSaved})`);
        }

        function cancelImport() {
            importPreviewData = null;
            closeModal('importConfirmationModal');
        }

        // Upload selected file to server and ask server to parse + save (or parse only if target=local)
        async function uploadAndImportServer() {
            if (!selectedFile) {
                alert('Por favor, selecione um arquivo primeiro!');
                return;
            }

            const target = (document.getElementById('importTargetLocal') && document.getElementById('importTargetLocal').checked) ? 'local' : 'server';

            const form = new FormData();
            form.append('file', selectedFile);
            form.append('target', target);

            try {
                showLoading('Enviando arquivo', 'Upload em progresso...');
                updateLoading(5, 'Enviando arquivo...');

                const res = await fetch('http://127.0.0.1:5000/api/import/upload', {
                    method: 'POST',
                    body: form,
                    signal: importAbortController ? importAbortController.signal : undefined
                });

                updateLoading(50, 'Processando no servidor...');
                const data = await res.json();

                if (data && data.success) {
                    if (target === 'local') {
                        // Show parsed preview and allow user to accept (populate importPreviewData)
                        importPreviewData = { professionals: data.professionals || [], appointments: data.appointments || [], localOnly: true };
                        showImportConfirmation((importPreviewData.professionals||[]).length, (importPreviewData.appointments||[]).length);
                        updateLoading(100, 'Pronto (somente parse)');
                        setTimeout(() => hideLoading(), 300);
                        showSuccessMessage('✅ Arquivo processado no servidor e disponível para confirmação (somente local).');
                    } else {
                        updateLoading(100, 'Importação concluída no servidor');
                        setTimeout(() => hideLoading(), 500);
                        showSuccessMessage(`✅ Import concluída no servidor — Profissionais: ${data.professionals_count||0}, Agendamentos: ${data.appointments_count||data.created_appointments||0}`);

                        // Refresh local caches from server
                        fetchProfessionalsFromServer().then(() => fetchAppointmentsFromServer()).catch(() => {});
                    }
                } else {
                    hideLoading();
                    alert('Erro no servidor: ' + (data && data.error ? data.error : 'Resposta inválida'));
                }
            } catch (err) {
                hideLoading();
                console.error('Erro no upload/import:', err);
                alert('Erro ao enviar ou processar o arquivo no servidor. Veja o console para detalhes.');
            }
        }

        // Open sync modal and populate counts
        function openSyncModalOld() {
            const prosToSync = professionals.filter(p => !p.localOnly);
            const apptsToSync = appointments.filter(a => !a.localOnly);
            document.getElementById('syncProfessionalsCount').querySelector('span').textContent = prosToSync.length;
            document.getElementById('syncAppointmentsCount').querySelector('span').textContent = apptsToSync.length;
            showModal('syncModal');
        }

        // Perform full sync: send local data to /api/sync which will upsert and skip duplicates
        async function performFullSync() {
            const prosToSync = professionals.filter(p => !p.localOnly).map(p => ({ id: p.id, name: p.name, specialty: p.specialty, active: p.active }));
            const apptsToSync = appointments.filter(a => !a.localOnly).map(a => ({
                professionalId: a.professionalId || a.professional || a.professionalId,
                profissional_id: a.professionalId || a.profissional_id || a.professional_id,
                patientId: a.patientId || a.paciente_id || a.patient_id || '',
                paciente_id: a.patientId || a.paciente_id || a.patient_id || '',
                roomId: a.roomId || a.sala_id || a.salaId || '',
                sala_id: a.roomId || a.sala_id || a.salaId || '',
                clientName: a.clientName || a.paciente,
                type: a.type || a.tipo,
                date: a.date,
                time: a.time,
                endTime: a.endTime || a.hora_fim || a.time,
                observations: a.observations || ''
            }));

            if (prosToSync.length === 0 && apptsToSync.length === 0) {
                alert('Nada para sincronizar (itens locais estão vazios ou marcados como "Somente nesta máquina").');
                return;
            }

            if (!confirm(`🔁 Confirma sincronizar ${prosToSync.length} profissionais e ${apptsToSync.length} agendamentos com o servidor?`)) return;

            showLoading('Sincronizando', 'Enviando dados para o servidor...');
            updateLoading(5, 'Enviando dados...');

            try {
                const payload = { professionals: prosToSync, appointments: apptsToSync };
                const res = await fetch('http://127.0.0.1:5000/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: importAbortController ? importAbortController.signal : undefined
                });

                const data = await res.json();
                if (data && data.success) {
                    updateLoading(80, 'Sincronizando respondedores...');

                    // Apply mapping: update local professionals ids if server created new ones
                    const mapping = data.mapping || {};
                    Object.keys(mapping).forEach(temp => {
                        const sid = String(mapping[temp]);
                        const local = professionals.find(p => String(p.id) === String(temp));
                        if (local) {
                            local.id = sid;
                        }
                    });

                    // Save local storage and refresh caches
                    localStorage.setItem('professionals', JSON.stringify(professionals));
                    updateProfessionalFilter();

                    updateLoading(95, 'Atualizando cache local...');
                    await fetchProfessionalsFromServer();
                    await fetchAppointmentsFromServer();

                    updateLoading(100, 'Sincronização concluída');
                    setTimeout(() => hideLoading(), 400);
                    closeModal('syncModal');

                    const profCreated = (data.created_professionals || []).length;
                    const profUpdated = (data.updated_professionals || []).length;
                    const apptsCreated = (data.created_appointments || []).length;

                    showSuccessMessage(`✅ Sincronização concluída — Profissionais criados: ${profCreated}, atualizados: ${profUpdated}; Agendamentos criados: ${apptsCreated}`);
                } else {
                    hideLoading();
                    alert('Erro na sincronização: ' + (data && data.error ? data.error : 'Resposta inválida'));
                }
            } catch (err) {
                hideLoading();
                if (err && err.name === 'AbortError') {
                    showSuccessMessage('⚠️ Sincronização cancelada.');
                    return;
                }
                console.error('Erro na sincronização:', err);
                alert('Erro ao sincronizar: veja o console para detalhes.');
            }
        }

        // Run server-side benchmark to measure insert speed
        async function runImportBenchmark() {
            const n = parseInt(prompt('Número de profissionais de teste (ex: 200):', '200'), 10) || 200;
            const m = parseInt(prompt('Agendamentos por profissional (ex: 20):', '20'), 10) || 20;

            try {
                showLoading('Benchmark', 'Executando benchmark no servidor...');
                updateLoading(10, 'Iniciando...');
                const res = await fetch('http://127.0.0.1:5000/api/import/benchmark', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ n_professionals: n, appointments_per_professional: m }),
                    signal: importAbortController ? importAbortController.signal : undefined
                });
                updateLoading(50, 'Aguardando resultado...');
                const data = await res.json();
                updateLoading(100, 'Concluído');
                setTimeout(() => hideLoading(), 300);

                if (data && data.success) {
                    showSuccessMessage(`⚡ Benchmark concluído — Prof: ${data.prof_inserts}, Agend: ${data.appt_inserts}. Tempos (s): total=${(data.times && data.times.total)||'n/a'}, prof_batch=${(data.times && data.times.prof_batch)||'n/a'}, appt_batch=${(data.times && data.times.appt_batch)||'n/a'}`);
                } else {
                    alert('Erro no benchmark: ' + (data && data.error ? data.error : 'Resposta inválida'));
                }
            } catch (err) {
                hideLoading();
                console.error('Erro benchmark:', err);
                alert('Erro ao executar benchmark no servidor. Veja o console para detalhes.');
            }
        }

        // Legacy export function for compatibility
        function exportSchedule() {
            openExportModal();
        }

        // Utility Functions
        function getWeekDays(date) {
            const week = [];
            const startOfWeek = new Date(date);
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day;
            startOfWeek.setDate(diff);
            
            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek);
                day.setDate(startOfWeek.getDate() + i);
                week.push(day);
            }
            
            debugLog('[getWeekDays] Week dates:', week.map(d => formatDate(d) + ' (' + ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][d.getDay()] + ')').join(', '));
            return week;
        }

        function formatDate(date) {
            if (!date) return '';
            if (typeof date === 'string') {
                const value = date.trim();
                const dateOnlyMatch = value.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
                if (dateOnlyMatch) return dateOnlyMatch[1];

                const parsed = new Date(value);
                if (!isNaN(parsed)) return formatDate(parsed);
                return '';
            }
            if (!(date instanceof Date) || isNaN(date)) return '';
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        function formatDateBR(date) {
            if (!date) return '';
            if (typeof date === 'string') {
                const normalized = formatDate(date);
                const parts = normalized.split('-');
                if (parts.length === 3) {
                    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                }
            }
            if (date instanceof Date && !isNaN(date)) {
                return date.toLocaleDateString('pt-BR');
            }
            const parsed = new Date(date);
            return parsed instanceof Date && !isNaN(parsed) ? parsed.toLocaleDateString('pt-BR') : '';
        }

        // Normalize time strings to HH:MM (e.g., "07:00:00" -> "07:00")
        function normalizeTime(t) {
            if (!t) return '';
            let value = String(t).trim();

            // Allow simple hour-only or compact numeric entries for faster typing
            const digits = value.replace(/[^0-9]/g, '');
            if (digits.length === 1 || digits.length === 2) {
                const hour = digits.padStart(2, '0');
                return `${hour}:00`;
            }
            if (digits.length === 3) {
                const hour = digits.slice(0, 1).padStart(2, '0');
                const minutes = digits.slice(1).padStart(2, '0');
                return `${hour}:${minutes}`;
            }
            if (digits.length === 4) {
                const hour = digits.slice(0, 2);
                const minutes = digits.slice(2, 4);
                return `${hour}:${minutes}`;
            }

            const parts = value.split(':');
            if (parts.length >= 2) {
                return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
            }
            return value;
        }

        // Normalize date to YYYY-MM-DD regardless of incoming format
        function normalizeDate(d) {
            if (!d) return '';
            if (typeof d === 'string') {
                const value = d.trim();
                // If ISO with time, split
                if (value.indexOf('T') !== -1) return value.split('T')[0];
                // If already YYYY-MM-DD
                const m = value.match(/\d{4}-\d{2}-\d{2}/);
                if (m) return m[0];
                const dt = new Date(value);
                if (!isNaN(dt)) return formatDate(dt);
                return value;
            }
            if (d instanceof Date) return formatDate(d);
            return String(d);
        }

        // ⚠️ SAFE DATE PARSING: Avoid timezone issues with new Date("YYYY-MM-DD")
        // Instead parse YYYY-MM-DD format to Year, Month, Day components
        function parseDateSafe(dateStr) {
            if (!dateStr || typeof dateStr !== 'string') return null;
            const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return null;
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;  // JavaScript month is 0-indexed
            const day = parseInt(match[3], 10);
            if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
            const parsed = new Date(year, month, day);
            if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) return null;
            return parsed;
        }

        function formatDayHeader(date) {
            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            return `${days[date.getDay()]}\n${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        function formatSimpleDayHeader(date) {
            const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            return days[date.getDay()];
        }

// Helper: Compare two dates by day, accepting strings or Date objects.
        function isSameDay(dateStr1, dateStr2) {
            if (!dateStr1 || !dateStr2) return false;

            const normalize = (value) => {
                if (value instanceof Date && !isNaN(value)) {
                    return formatDate(value);
                }
                const str = String(value).trim();
                if (!str) return '';

                // ISO strings and strings with time part
                const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
                if (isoMatch) {
                    return isoMatch[1];
                }

                const parsed = new Date(str);
                if (!isNaN(parsed)) {
                    return formatDate(parsed);
                }

                return str;
            };

            return normalize(dateStr1) === normalize(dateStr2);
        }

        // Modal Management
        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        function switchAppointmentTab(tabName) {
            const detailsTab = document.getElementById('appointmentDetailsTab');
            const actionsTab = document.getElementById('appointmentActionsTab');
            const auditTab = document.getElementById('appointmentAuditTab');
            const detailsBtn = document.getElementById('appointmentTabDetailsBtn');
            const actionsBtn = document.getElementById('appointmentTabActionsBtn');
            const auditBtn = document.getElementById('appointmentTabAuditBtn');

            if (detailsTab && actionsTab && auditTab && detailsBtn && actionsBtn && auditBtn) {
                const appointment = getAppointmentById(document.getElementById('appointmentId')?.value || '');
                if (tabName === 'audit' && !canViewAppointmentAudit(appointment)) {
                    tabName = 'details';
                }

                detailsTab.classList.toggle('hidden', tabName !== 'details');
                actionsTab.classList.toggle('hidden', tabName !== 'actions');
                auditTab.classList.toggle('hidden', tabName !== 'audit');

                [detailsBtn, actionsBtn, auditBtn].forEach(btn => {
                    btn.classList.remove('bg-blue-600', 'text-white');
                    btn.classList.add('bg-gray-200', 'text-gray-800');
                });

                const activeBtn = tabName === 'actions' ? actionsBtn : (tabName === 'audit' ? auditBtn : detailsBtn);
                activeBtn.classList.remove('bg-gray-200', 'text-gray-800');
                activeBtn.classList.add('bg-blue-600', 'text-white');

                if (tabName === 'audit') {
                    loadAppointmentAudit(document.getElementById('appointmentId').value);
                }
            }
        }

        function saveRemarkRequests() {
            localStorage.setItem('remarkRequests', JSON.stringify(remarkRequests));
            updateRemarkBadges();
        }

        function getRemarkSeenStorageKey() {
            const username = currentUser ? String(currentUser.username || '').toLowerCase() : 'anonimo';
            return `remarkNotificationsSeen:${username}`;
        }

        function getSeenRemarkNotificationSet() {
            try {
                return new Set(JSON.parse(localStorage.getItem(getRemarkSeenStorageKey()) || '[]'));
            } catch (err) {
                return new Set();
            }
        }

        function getRemarkNotificationKey(request) {
            const decisionAt = request.approvedAt || request.rejectedAt || request.requestedAt || '';
            return `${request.id}:${request.status}:${decisionAt}`;
        }

        function getCurrentUserRemarkNotifications() {
            const username = currentUser ? String(currentUser.username || '').toLowerCase() : '';
            if (!username) return [];
            return remarkRequests.filter(request =>
                String(request.requestedByUsername || '').toLowerCase() === username &&
                (request.status === 'aprovado' || request.status === 'reprovado')
            );
        }

        function getUnreadRemarkNotifications() {
            const seen = getSeenRemarkNotificationSet();
            return getCurrentUserRemarkNotifications().filter(request => !seen.has(getRemarkNotificationKey(request)));
        }

        function formatRemarkBadgeCount(count) {
            if (!count || count <= 0) return '';
            return count > 99 ? '99+' : String(count);
        }

        function setRemarkBadge(badgeId, count) {
            const badge = document.getElementById(badgeId);
            if (!badge) return;
            const label = formatRemarkBadgeCount(count);
            if (!label) {
                badge.classList.add('hidden');
                badge.textContent = '';
                return;
            }
            badge.textContent = label;
            badge.classList.remove('hidden');
        }

        function updateRemarkBadges() {
            const canAuthorize = canAuthorizeRemarkRequests();
            const pendingCount = canAuthorize
                ? remarkRequests.filter(request => request.status === 'pendente').length
                : 0;
            setRemarkBadge('remarkRequestsBadge', pendingCount);
            setRemarkBadge('remarkNotificationsBadge', getUnreadRemarkNotifications().length);
        }

        function markRemarkNotificationsSeen() {
            const seen = getSeenRemarkNotificationSet();
            getCurrentUserRemarkNotifications().forEach(request => {
                seen.add(getRemarkNotificationKey(request));
            });
            localStorage.setItem(getRemarkSeenStorageKey(), JSON.stringify([...seen]));
            updateRemarkBadges();
        }

        let remarkRequestsLastFetchAt = 0;
        let remarkRequestsFetchPromise = null;
        const remarkDecisionInFlight = new Set();
        const REMARK_REQUESTS_CACHE_MS = 15000;

        function getRemarkAuthHeaders() {
            const headers = { 'Content-Type': 'application/json' };
            if (currentUser && currentUser.username && currentUser.password) {
                headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
            }
            return headers;
        }

        function formatDateTimeBR(value) {
            if (!value) return 'N/A';
            const parsed = value instanceof Date ? value : new Date(value);
            if (!(parsed instanceof Date) || isNaN(parsed)) return String(value);
            return parsed.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function canManageRemarkConfig() {
            if (!currentUser) return false;
            if (remarkCanManageConfigFromServer === true) return true;
            const levelOrName = `${currentUser.level || ''} ${currentUser.name || ''} ${currentUser.username || ''}`.toUpperCase();
            if (levelOrName.includes('CEO') || levelOrName.includes('ATAC') || levelOrName.includes('FINANCEIRO')) return true;
            const linkedProfessional = getProfessionalById(currentUser.professionalId);
            const specialties = getProfessionalSpecialties(linkedProfessional).map(item => item.toUpperCase());
            return specialties.some(item => item === 'ATAC' || item === 'FINANCEIRO' || item === 'CEO');
        }

        function updateRemarkConfigUi() {
            const toggleBtn = document.getElementById('remarkToggleButton');
            const statusEl = document.getElementById('remarkConfigStatus');
            if (statusEl) {
                statusEl.textContent = remarkRequestsEnabled
                    ? 'Solicitacoes de remarque ativas.'
                    : 'Solicitacoes de remarque desativadas.';
                statusEl.className = remarkRequestsEnabled
                    ? 'text-xs text-green-700 mt-1'
                    : 'text-xs text-red-700 mt-1';
            }
            if (!toggleBtn) return;
            if (!canManageRemarkConfig()) {
                toggleBtn.style.display = 'none';
                return;
            }
            toggleBtn.style.display = 'inline-block';
            toggleBtn.textContent = remarkRequestsEnabled ? 'Desativar remarque' : 'Ativar remarque';
            toggleBtn.className = remarkRequestsEnabled
                ? 'bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium'
                : 'bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium';
        }

        async function fetchRemarkConfigFromServer() {
            try {
                const response = await fetch(apiUrl(`/api/remarques/config?_=${Date.now()}`), {
                    headers: getRemarkAuthHeaders(),
                    cache: 'no-store'
                });
                const data = await response.json();
                if (data && data.success) {
                    remarkRequestsEnabled = data.enabled !== false;
                    remarkCanManageConfigFromServer = !!data.can_manage;
                    localStorage.setItem('remarkRequestsEnabled', remarkRequestsEnabled ? 'true' : 'false');
                    updateRemarkConfigUi();
                    return { success: true, enabled: remarkRequestsEnabled, canManage: remarkCanManageConfigFromServer };
                }
            } catch (err) {
                console.warn('Nao foi possivel carregar configuracao de remarque:', err);
            }
            updateRemarkConfigUi();
            return { success: false, enabled: remarkRequestsEnabled, canManage: canManageRemarkConfig() };
        }

        async function toggleRemarkRequestsEnabled() {
            if (!canManageRemarkConfig()) {
                alert('Somente ATAC, FINANCEIRO ou CEO podem ativar ou desativar solicitacoes de remarque.');
                return;
            }
            const nextEnabled = !remarkRequestsEnabled;
            const confirmMessage = nextEnabled
                ? 'Deseja ativar as solicitacoes de remarque para os usuarios?'
                : 'Deseja desativar as solicitacoes de remarque para os usuarios?';
            const confirmed = await showYesNoConfirm({
                title: nextEnabled ? 'Ativar remarque' : 'Desativar remarque',
                message: confirmMessage,
                yesText: 'Sim',
                noText: 'N\u00e3o',
                danger: !nextEnabled
            });
            if (!confirmed) {
                return;
            }
            const toggleBtn = document.getElementById('remarkToggleButton');
            if (toggleBtn) {
                toggleBtn.disabled = true;
                toggleBtn.textContent = 'Salvando...';
            }
            try {
                const response = await fetch('http://127.0.0.1:5000/api/remarques/config', {
                    method: 'PUT',
                    headers: getRemarkAuthHeaders(),
                    body: JSON.stringify({ enabled: nextEnabled })
                });
                const data = await response.json();
                if (!data || !data.success) {
                    throw new Error(data?.error || 'Nao foi possivel salvar a configuracao.');
                }
                remarkRequestsEnabled = data.enabled !== false;
                remarkCanManageConfigFromServer = !!data.can_manage;
                localStorage.setItem('remarkRequestsEnabled', remarkRequestsEnabled ? 'true' : 'false');
                updateRemarkConfigUi();
                refreshActiveScheduleViews();
                const openAppointment = getAppointmentById(document.getElementById('appointmentId')?.value);
                if (openAppointment) {
                    showAppointmentActionOptions(openAppointment);
                }
                showSuccessMessage(remarkRequestsEnabled ? 'Solicitacoes de remarque ativadas.' : 'Solicitacoes de remarque desativadas.');
            } catch (err) {
                alert(err.message || 'Erro ao alterar configuracao de remarque.');
                updateRemarkConfigUi();
            } finally {
                if (toggleBtn) {
                    toggleBtn.disabled = false;
                }
            }
        }

        function normalizeRemarkRequest(item) {
            return {
                id: String(item.id),
                appointmentId: String(item.appointmentId || item.agendamento_id || ''),
                professionalId: String(item.professionalId || item.profissional_id || ''),
                originalDate: item.originalDate || item.original_data,
                originalTime: item.originalTime || item.original_hora_inicio,
                originalEndTime: item.originalEndTime || item.original_hora_fim,
                newDate: item.newDate || item.nova_data,
                newTime: item.newTime || item.nova_hora_inicio,
                newEndTime: item.newEndTime || item.nova_hora_fim,
                invertTimes: !!(item.invertTimes || item.inverter_horarios),
                conflictAppointmentId: item.conflictAppointmentId || item.conflito_agendamento_id,
                conflictNewDate: item.conflictNewDate || item.conflito_nova_data || '',
                conflictNewTime: item.conflictNewTime || item.conflito_nova_hora_inicio || '',
                conflictNewEndTime: item.conflictNewEndTime || item.conflito_nova_hora_fim || '',
                conflictRelocations: item.conflictRelocations || item.conflito_realocacoes || [],
                reason: item.reason || item.observacao || '',
                status: item.status || 'pendente',
                requestedBy: item.requestedBy || item.solicitado_por || 'Sistema',
                requestedByUsername: item.requestedByUsername || item.solicitado_por_username || null,
                requestedAt: item.requestedAt || item.solicitado_em || new Date().toISOString(),
                approvedBy: item.approvedBy || item.autorizado_por || '',
                approvedAt: item.approvedAt || item.autorizado_em || '',
                rejectedBy: item.rejectedBy || item.rejeitado_por || '',
                rejectedAt: item.rejectedAt || item.rejeitado_em || '',
                rejectionReason: item.rejectionReason || item.motivo_reprovacao || '',
                decidedBySector: item.decidedBySector || item.decidido_por_setor || '',
                patientName: item.patientName || item.paciente_nome || '',
                patientInsurance: item.patientInsurance || item.paciente_convenio || ''
            };
        }

        async function fetchRemarkRequestsFromServer(options = {}) {
            if (!options.force && Date.now() - remarkRequestsLastFetchAt <= REMARK_REQUESTS_CACHE_MS) {
                updateRemarkBadges();
                return { success: true, canAuthorize: canAuthorizeRemarkRequests(), fromCache: true };
            }
            if (remarkRequestsFetchPromise) return remarkRequestsFetchPromise;
            remarkRequestsFetchPromise = (async () => {
            try {
                const url = options.force
                    ? apiUrl('/api/remarques?force=1')
                    : apiUrl('/api/remarques');
                const response = await fetch(url, {
                    headers: getRemarkAuthHeaders(),
                    cache: 'no-store'
                });
                const data = await response.json();
                if (data && data.success && Array.isArray(data.remarques)) {
                    remarkRequests = data.remarques.map(normalizeRemarkRequest);
                    remarkCanAuthorizeFromServer = !!data.can_authorize;
                    remarkCanManageConfigFromServer = !!data.can_manage_config;
                    remarkRequestsEnabled = data.requests_enabled !== false;
                    localStorage.setItem('remarkRequestsEnabled', remarkRequestsEnabled ? 'true' : 'false');
                    remarkRequestsLastFetchAt = Date.now();
                    saveRemarkRequests();
                    updateRemarkConfigUi();
                    return { success: true, canAuthorize: remarkCanAuthorizeFromServer };
                }
            } catch (err) {
                console.warn('Nao foi possivel carregar remarques do servidor:', err);
            }
            return { success: false, canAuthorize: canAuthorizeRemarkRequests() };
            })();
            try {
                return await remarkRequestsFetchPromise;
            } finally {
                remarkRequestsFetchPromise = null;
            }
        }

        async function checkPendingRemarkForAppointment(appointmentId) {
            if (!appointmentId) return false;
            try {
                const params = new URLSearchParams({ agendamento_id: String(appointmentId) });
                const response = await fetch(`http://127.0.0.1:5000/api/remarques/check-pendente?${params.toString()}`, {
                    headers: getRemarkAuthHeaders()
                });
                const data = await response.json();
                if (data && data.success) return !!data.has_pending;
            } catch (err) {
                console.warn('Nao foi possivel checar remarque pendente:', err);
            }
            return remarkRequests.some(request =>
                String(request.appointmentId) === String(appointmentId) &&
                request.status === 'pendente'
            );
        }

        function getAppointmentById(appointmentId) {
            return appointments.find(apt => String(apt.id) === String(appointmentId));
        }

        function getProfessionalById(professionalId) {
            return professionals.find(prof => String(prof.id) === String(professionalId));
        }

        function normalizePatientMatchText(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toLowerCase();
        }

        function findPatientByAppointment(appointment) {
            if (!appointment) return null;
            const patients = [
                ...((patientListCache && patientListCache.length) ? patientListCache : []),
                ...JSON.parse(localStorage.getItem('patients') || '[]')
            ];
            const patientId = normalizePatientMatchText(appointment.patientId || appointment.paciente_id || '');
            const patientName = normalizePatientMatchText(appointment.clientName || appointment.paciente || '');
            return patients.find(patient => {
                const id = normalizePatientMatchText(patient.id);
                const name = normalizePatientMatchText(patient.nome || patient.name);
                return (patientId && id === patientId) || (patientName && name === patientName);
            }) || null;
        }

        function getPatientInsuranceForAppointment(appointment) {
            const patient = findPatientByAppointment(appointment);
            return patient ? (patient.convenio || patient.insurance || patient.plano || '') : '';
        }

        function canAuthorizeRemarkRequests() {
            if (!currentUser) return false;
            if (remarkCanAuthorizeFromServer === true) return true;
            const levelOrName = `${currentUser.level || ''} ${currentUser.name || ''} ${currentUser.username || ''}`.toUpperCase();
            if (currentUser.level === 'admin' || levelOrName.includes('ADMINISTRADOR')) return true;
            if (levelOrName.includes('CEO')) return true;

            const linkedProfessional = getProfessionalById(currentUser.professionalId);
            const specialties = getProfessionalSpecialties(linkedProfessional).map(item => item.toUpperCase());
            return specialties.some(item => item === 'ATAC' || item === 'FINANCEIRO');
        }

        function getRemarkDecisionSectorFallback() {
            if (!currentUser) return 'SETOR';
            const levelOrName = `${currentUser.level || ''} ${currentUser.name || ''} ${currentUser.username || ''}`.toUpperCase();
            const linkedProfessional = getProfessionalById(currentUser.professionalId);
            const specialties = getProfessionalSpecialties(linkedProfessional).map(item => item.toUpperCase());
            if (levelOrName.includes('ATAC') || specialties.includes('ATAC')) return 'ATAC';
            if (levelOrName.includes('FINANCEIRO') || specialties.includes('FINANCEIRO')) return 'FINANCEIRO';
            if (levelOrName.includes('CEO')) return 'CEO';
            if (currentUser.level === 'admin' || levelOrName.includes('ADMINISTRADOR')) return 'ADMINISTRADOR';
            return 'SETOR';
        }

        function appointmentsOverlap(aStart, aEnd, bStart, bEnd) {
            return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
        }

        const MAX_REMARK_CONFLICT_RELOCATIONS = 3;

        function findRemarkTargetConflict(appointment, newDate, newTime, newEndTime) {
            if (!appointment || !newDate || !newTime || !newEndTime || !isValidTime(newTime) || !isValidTime(newEndTime)) {
                return null;
            }

            return findAppointmentTimeConflict(appointment.professionalId, newDate, newTime, newEndTime, [appointment.id]);
        }

        function findAppointmentTimeConflict(professionalId, date, startTime, endTime, excludeIds = []) {
            if (!professionalId || !date || !startTime || !endTime || !isValidTime(startTime) || !isValidTime(endTime)) {
                return null;
            }

            const excluded = excludeIds.map(id => String(id));
            return appointments.find(apt =>
                !excluded.includes(String(apt.id)) &&
                String(apt.professionalId) === String(professionalId) &&
                apt.date === date &&
                appointmentsOverlap(startTime, endTime, apt.time, apt.endTime || getDefaultEndTime(apt.time))
            ) || null;
        }

        function isAppointmentUsingRoom(appointment) {
            const status = normalizeScheduleStatus(appointment.status || 'agendado');
            return !['cancelado_profissional', 'cancelado_paciente', 'faltou'].includes(status);
        }

        function findRoomTimeConflict(roomId, date, startTime, endTime, excludeIds = []) {
            if (!roomId || !date || !startTime || !endTime || !isValidTime(startTime) || !isValidTime(endTime)) {
                return null;
            }

            const excluded = excludeIds.map(id => String(id));
            return appointments.find(apt =>
                !excluded.includes(String(apt.id)) &&
                isAppointmentUsingRoom(apt) &&
                String(apt.roomId || apt.sala_id || '') === String(roomId) &&
                apt.date === date &&
                appointmentsOverlap(startTime, endTime, apt.time, apt.endTime || getDefaultEndTime(apt.time))
            ) || null;
        }

        function getPatientConflictKey(appointment) {
            const normalized = normalizeAppointmentRecord(appointment || {});
            const patientId = String(normalized.patientId || appointment?.paciente_id || appointment?.patient_id || '').trim();
            if (patientId) return `id:${patientId}`;
            const patientName = normalizePatientMatchText(normalized.clientName || appointment?.paciente || appointment?.patient || '');
            return patientName ? `name:${patientName}` : '';
        }

        function findPatientRoomTimeConflict(appointment, excludeIds = []) {
            const normalized = normalizeAppointmentRecord(appointment || {});
            const patientKey = getPatientConflictKey(normalized);
            const roomId = String(normalized.roomId || '').trim();
            const startTime = normalized.time;
            const endTime = normalized.endTime || normalized.time;
            if (!patientKey || !roomId || !normalized.date || !startTime || !endTime || !isValidTime(startTime) || !isValidTime(endTime)) {
                return null;
            }

            const excluded = excludeIds.map(id => String(id));
            return appointments
                .map(normalizeAppointmentRecord)
                .find(apt =>
                    !excluded.includes(String(apt.id)) &&
                    isAppointmentUsingRoom(apt) &&
                    getPatientConflictKey(apt) === patientKey &&
                    String(apt.roomId || '') !== roomId &&
                    apt.date === normalized.date &&
                    appointmentsOverlap(startTime, endTime, apt.time, apt.endTime || getDefaultEndTime(apt.time))
                ) || null;
        }

        function describePatientRoomConflict(appointment) {
            if (!appointment) return 'agendamento encontrado';
            const roomName = getRoomName(appointment.roomId || appointment.sala_id) || 'sala diferente';
            return `${appointment.clientName || 'Paciente'} - ${roomName} - ${formatAppointmentTime(appointment)}`;
        }

        function describeRoomConflict(appointment) {
            if (!appointment) return 'Agendamento encontrado';
            const professionalName = getProfessionalLabel(appointment.professionalId);
            return `${appointment.clientName || 'Paciente'} - ${professionalName} - ${formatAppointmentTime(appointment)}`;
        }

        function updateRoomAvailabilityHint(excludeAppointmentId = null) {
            const hint = document.getElementById('appointmentRoomAvailability');
            if (!hint) return;

            const roomId = document.getElementById('appointmentRoom')?.value || '';
            const date = document.getElementById('appointmentDateInput')?.value || '';
            const startTime = normalizeTime(document.getElementById('appointmentTimeInput')?.value || '');
            const endTime = normalizeTime(document.getElementById('appointmentEndInput')?.value || '');
            const appointmentId = excludeAppointmentId || document.getElementById('appointmentId')?.value || '';

            hint.className = 'text-xs text-gray-500 mt-1';

            if (!roomId) {
                hint.textContent = 'Selecione uma sala para verificar disponibilidade.';
                return;
            }
            if (!date || !isValidTime(startTime) || !isValidTime(endTime)) {
                hint.textContent = 'Selecione data e horario para verificar disponibilidade.';
                return;
            }

            const conflict = findRoomTimeConflict(roomId, date, startTime, endTime, appointmentId ? [appointmentId] : []);
            if (conflict) {
                hint.className = 'text-xs text-red-600 mt-1 font-medium';
                hint.textContent = `Sala ocupada por ${describeRoomConflict(conflict)}.`;
                return;
            }

            hint.className = 'text-xs text-green-600 mt-1 font-medium';
            hint.textContent = 'Sala disponivel neste horario.';
        }

        function confirmRoomConflictIfNeeded(appointment, excludeIds = []) {
            if (!appointment || !appointment.roomId) return true;
            const conflict = findRoomTimeConflict(
                appointment.roomId,
                appointment.date,
                appointment.time,
                appointment.endTime || appointment.time,
                excludeIds
            );
            if (!conflict) return true;

            const roomName = getRoomName(appointment.roomId) || 'Selecionada';
            return confirm(`Sala ocupada: ${roomName}\n\nJa existe um agendamento nesta sala:\n${describeRoomConflict(conflict)}\n\nDeseja salvar mesmo assim e juntar os profissionais nesta sala?`);
        }

        function getRemarkRelocationFieldValues(index) {
            if (index === 0) {
                return {
                    newDate: document.getElementById('remarkConflictNewDate')?.value || '',
                    newTime: document.getElementById('remarkConflictNewTime')?.value || '',
                    newEndTime: document.getElementById('remarkConflictNewEndTime')?.value || ''
                };
            }
            return {
                newDate: document.getElementById(`remarkChainDate${index}`)?.value || '',
                newTime: document.getElementById(`remarkChainTime${index}`)?.value || '',
                newEndTime: document.getElementById(`remarkChainEndTime${index}`)?.value || ''
            };
        }

        function ensureRemarkChainRows(count) {
            const container = document.getElementById('remarkConflictChainContainer');
            if (!container) return;

            for (let index = 1; index < count; index += 1) {
                if (document.getElementById(`remarkChainRow${index}`)) continue;
                const row = document.createElement('div');
                row.id = `remarkChainRow${index}`;
                row.className = 'border-t pt-3';
                row.innerHTML = `
                    <div id="remarkChainTitle${index}" class="text-sm font-semibold text-gray-800 mb-3">Realocar próximo conflito</div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block text-sm font-medium mb-2">Data:</label>
                            <input type="date" id="remarkChainDate${index}" onchange="checkRemarkTargetConflict()" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-sky-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Início:</label>
                            <input type="text" id="remarkChainTime${index}" onchange="checkRemarkTargetConflict()" placeholder="HH:MM" list="timeSuggestions" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-sky-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Término:</label>
                            <input type="text" id="remarkChainEndTime${index}" onchange="checkRemarkTargetConflict()" placeholder="HH:MM" list="timeSuggestions" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-sky-500">
                        </div>
                    </div>
                `;
                container.appendChild(row);
                const chainLabels = row.querySelectorAll('label');
                if (chainLabels[1]) chainLabels[1].textContent = 'Inicio:';
                if (chainLabels[2]) chainLabels[2].textContent = 'Termino:';
                const chainStart = document.getElementById(`remarkChainTime${index}`);
                const chainEnd = document.getElementById(`remarkChainEndTime${index}`);
                [chainStart, chainEnd].forEach(input => {
                    if (!input) return;
                    input.type = 'time';
                    input.step = '60';
                    input.removeAttribute('list');
                    input.removeAttribute('placeholder');
                });
                const chainTitle = document.getElementById(`remarkChainTitle${index}`);
                if (chainTitle && chainTitle.textContent.includes('pr')) {
                    chainTitle.textContent = 'Realocar proximo conflito';
                }
            }

            [...container.children].forEach(row => {
                const index = Number(row.id.replace('remarkChainRow', ''));
                const hasUserValue = !!(
                    document.getElementById(`remarkChainDate${index}`)?.value ||
                    document.getElementById(`remarkChainTime${index}`)?.value ||
                    document.getElementById(`remarkChainEndTime${index}`)?.value
                );
                if (index >= count && !hasUserValue) row.remove();
            });
        }

        function buildRemarkConflictRelocations(appointment, firstConflict) {
            const relocations = [];
            if (!appointment || !firstConflict) return relocations;

            const blockedIds = [String(appointment.id)];
            let currentConflict = firstConflict;
            for (let index = 0; index < MAX_REMARK_CONFLICT_RELOCATIONS && currentConflict; index += 1) {
                blockedIds.push(String(currentConflict.id));
                ensureRemarkChainRows(index + 1);
                const values = getRemarkRelocationFieldValues(index);
                relocations.push({
                    appointmentId: String(currentConflict.id),
                    clientName: currentConflict.clientName || '',
                    newDate: values.newDate,
                    newTime: values.newTime,
                    newEndTime: values.newEndTime
                });

                const title = index === 0
                    ? document.getElementById('remarkConflictRelocationTitle')
                    : document.getElementById(`remarkChainTitle${index}`);
                if (title) title.textContent = `Realocar ${currentConflict.clientName || 'agendamento conflitante'} para outra data`;

                if (!values.newDate || !isValidTime(values.newTime) || !isValidTime(values.newEndTime)) break;

                const nextConflict = findAppointmentTimeConflict(
                    currentConflict.professionalId,
                    values.newDate,
                    values.newTime,
                    values.newEndTime,
                    blockedIds
                );
                if (!nextConflict) break;
                if (index === MAX_REMARK_CONFLICT_RELOCATIONS - 1) {
                    relocations.push({
                        appointmentId: String(nextConflict.id),
                        clientName: nextConflict.clientName || '',
                        overflow: true
                    });
                    break;
                }
                currentConflict = nextConflict;
            }
            ensureRemarkChainRows(Math.min(relocations.length, MAX_REMARK_CONFLICT_RELOCATIONS));
            return relocations;
        }

        async function openRemarkRequestModal(appointmentId) {
            const config = await fetchRemarkConfigFromServer();
            if (config.enabled === false || !remarkRequestsEnabled) {
                alert('Solicitacoes de remarque estao desativadas no momento.');
                refreshActiveScheduleViews();
                return;
            }
            const appointment = getAppointmentById(appointmentId);
            if (!appointment) {
                alert('Agendamento não encontrado para solicitar remarque.');
                return;
            }

            const professional = getProfessionalById(appointment.professionalId);
            document.getElementById('remarkAppointmentId').value = appointment.id;
            document.getElementById('remarkConflictAppointmentId').value = '';
            document.getElementById('remarkNewDate').value = appointment.date || '';
            document.getElementById('remarkNewTime').value = appointment.time || '';
            document.getElementById('remarkNewEndTime').value = appointment.endTime || getDefaultEndTime(appointment.time);
            document.getElementById('remarkReason').value = '';
            document.getElementById('remarkInvertTimes').checked = false;
            document.getElementById('remarkConflictNewDate').value = '';
            document.getElementById('remarkConflictNewTime').value = '';
            document.getElementById('remarkConflictNewEndTime').value = '';
            const chainContainer = document.getElementById('remarkConflictChainContainer');
            if (chainContainer) chainContainer.innerHTML = '';
            document.getElementById('remarkAppointmentSummary').innerHTML = `
                <div><strong>Paciente:</strong> ${appointment.clientName || 'N/A'}</div>
                <div><strong>Profissional:</strong> ${professional ? professional.name : 'N/A'}</div>
                <div><strong>Atual:</strong> ${formatDateBR(appointment.date)} ${formatAppointmentTime(appointment)}</div>
            `;
            checkRemarkTargetConflict();
            document.getElementById('remarkRequestModal').classList.add('active');
        }

        function checkRemarkTargetConflict() {
            const appointment = getAppointmentById(document.getElementById('remarkAppointmentId')?.value);
            const newDate = document.getElementById('remarkNewDate')?.value;
            const newTime = document.getElementById('remarkNewTime')?.value;
            const newEndTime = document.getElementById('remarkNewEndTime')?.value;
            const warning = document.getElementById('remarkConflictWarning');
            const invertWrapper = document.getElementById('remarkInvertWrapper');
            const conflictInput = document.getElementById('remarkConflictAppointmentId');
            const invertInput = document.getElementById('remarkInvertTimes');
            const relocationWrapper = document.getElementById('remarkConflictRelocationWrapper');
            const relocationTitle = document.getElementById('remarkConflictRelocationTitle');
            const relocationWarning = document.getElementById('remarkConflictRelocationWarning');
            const conflict = findRemarkTargetConflict(appointment, newDate, newTime, newEndTime);

            if (!warning || !invertWrapper || !conflictInput) return null;

            if (!conflict) {
                warning.classList.add('hidden');
                invertWrapper.classList.add('hidden');
                invertWrapper.classList.remove('flex');
                if (relocationWrapper) relocationWrapper.classList.add('hidden');
                if (relocationWarning) {
                    relocationWarning.classList.add('hidden');
                    relocationWarning.textContent = '';
                }
                ensureRemarkChainRows(0);
                conflictInput.value = '';
                return null;
            }

            conflictInput.value = conflict.id;
            warning.classList.remove('hidden');
            invertWrapper.classList.remove('hidden');
            invertWrapper.classList.add('flex');
            if (relocationTitle) {
                relocationTitle.textContent = `Realocar ${conflict.clientName || 'agendamento conflitante'} para outra data`;
            }
            warning.innerHTML = `
                Já existe agendamento neste horário: <strong>${conflict.clientName || 'Paciente não informado'}</strong>,
                ${formatDateBR(conflict.date)} ${formatAppointmentTime(conflict)}.
                Marque a opção de inversão ou informe abaixo para onde este agendamento deve ir.
            `;
            if (relocationWrapper) {
                warning.innerHTML += '<div class="mt-2">Voce pode marcar inversao ou preencher o novo destino do agendamento conflitante.</div>';
                if (invertInput && invertInput.checked) {
                    relocationWrapper.classList.add('hidden');
                } else {
                    relocationWrapper.classList.remove('hidden');
                }
            }

            if (relocationWarning) {
                relocationWarning.classList.add('hidden');
                relocationWarning.textContent = '';
                if (invertInput && !invertInput.checked) {
                    const relocations = buildRemarkConflictRelocations(appointment, conflict);
                    const overflow = relocations.find(item => item.overflow);
                    if (overflow) {
                        relocationWarning.textContent = `O terceiro destino ainda encontra ${overflow.clientName || 'outro paciente'}. Escolha outro destino para o terceiro ou solicite estes ajustes em etapas e aguarde o retorno antes de continuar.`;
                        relocationWarning.classList.remove('hidden');
                    }
                }
            }
            return conflict;
        }

        async function submitRemarkRequest() {
            const config = await fetchRemarkConfigFromServer();
            if (config.enabled === false || !remarkRequestsEnabled) {
                alert('Solicitacoes de remarque estao desativadas no momento.');
                closeModal('remarkRequestModal');
                refreshActiveScheduleViews();
                return;
            }
            const appointment = getAppointmentById(document.getElementById('remarkAppointmentId').value);
            const newDate = document.getElementById('remarkNewDate').value;
            const newTime = document.getElementById('remarkNewTime').value;
            const newEndTime = document.getElementById('remarkNewEndTime').value;
            const reason = document.getElementById('remarkReason').value.trim();
            const invertTimes = document.getElementById('remarkInvertTimes').checked;
            const conflict = checkRemarkTargetConflict();
            const conflictNewDate = document.getElementById('remarkConflictNewDate')?.value || '';
            const conflictNewTime = document.getElementById('remarkConflictNewTime')?.value || '';
            const conflictNewEndTime = document.getElementById('remarkConflictNewEndTime')?.value || '';
            const conflictRelocations = conflict && !invertTimes ? buildRemarkConflictRelocations(appointment, conflict) : [];

            if (!appointment || !newDate || !isValidTime(newTime) || !isValidTime(newEndTime)) {
                alert('Informe nova data, horário de início e horário de término válidos.');
                return;
            }
            if (await checkPendingRemarkForAppointment(appointment.id)) {
                alert('A solicitacao de remarque deste agendamento ja foi solicitada e esta pendente.');
                return;
            }
            if (timeToMinutes(newEndTime) <= timeToMinutes(newTime)) {
                alert('O horário de término deve ser maior que o horário de início.');
                return;
            }
            const today = formatDate(new Date());
            if (newDate < today) {
                alert('Nao e possivel solicitar remarque para uma data passada.');
                return;
            }
            if (conflict && !invertTimes) {
                const overflow = conflictRelocations.find(item => item.overflow);
                if (overflow) {
                    alert(`O terceiro destino ainda encontra ${overflow.clientName || 'outro paciente'}. Escolha outro destino para o terceiro ou solicite estes ajustes em etapas e aguarde o retorno antes de continuar.`);
                    return;
                }
                const occupiedByMove = [{ date: newDate, time: newTime, endTime: newEndTime, label: 'remarque principal' }];
                for (const relocation of conflictRelocations) {
                    if (!relocation.newDate || !isValidTime(relocation.newTime) || !isValidTime(relocation.newEndTime)) {
                        alert(`Informe para onde vai ${relocation.clientName || 'o agendamento que esta impedindo o remarque'}.`);
                        return;
                    }
                    if (timeToMinutes(relocation.newEndTime) <= timeToMinutes(relocation.newTime)) {
                        alert(`O horario de termino de ${relocation.clientName || 'um agendamento realocado'} deve ser maior que o inicio.`);
                        return;
                    }
                    if (relocation.newDate < today) {
                        alert('Nao e possivel realocar agendamento conflitante para uma data passada.');
                        return;
                    }
                    const sameMoveConflict = occupiedByMove.find(item =>
                        item.date === relocation.newDate &&
                        appointmentsOverlap(relocation.newTime, relocation.newEndTime, item.time, item.endTime)
                    );
                    if (sameMoveConflict) {
                        alert(`O destino de ${relocation.clientName || 'um agendamento realocado'} conflita com ${sameMoveConflict.label}.`);
                        return;
                    }
                    occupiedByMove.push({
                        date: relocation.newDate,
                        time: relocation.newTime,
                        endTime: relocation.newEndTime,
                        label: relocation.clientName || 'outro agendamento realocado'
                    });
                }
            }
            const requestPayload = {
                id: Date.now().toString(),
                appointmentId: String(appointment.id),
                professionalId: String(appointment.professionalId),
                originalDate: appointment.date,
                originalTime: appointment.time,
                originalEndTime: appointment.endTime || getDefaultEndTime(appointment.time),
                newDate,
                newTime,
                newEndTime,
                reason,
                invertTimes,
                conflictAppointmentId: conflict ? String(conflict.id) : null,
                conflictNewDate: conflict && !invertTimes ? conflictNewDate : '',
                conflictNewTime: conflict && !invertTimes ? conflictNewTime : '',
                conflictNewEndTime: conflict && !invertTimes ? conflictNewEndTime : '',
                conflictRelocations,
                status: 'pendente',
                requestedBy: currentUser ? (currentUser.name || currentUser.username) : 'Sistema',
                requestedByUsername: currentUser ? currentUser.username : null,
                requestedAt: new Date().toISOString(),
                patientName: appointment.clientName || '',
                patientInsurance: getPatientInsuranceForAppointment(appointment) || ''
            };

            try {
                const response = await fetch('http://127.0.0.1:5000/api/remarques', {
                    method: 'POST',
                    headers: getRemarkAuthHeaders(),
                    body: JSON.stringify(requestPayload)
                });
                const data = await response.json();
                if (data && data.success) {
                    requestPayload.id = String(data.id || requestPayload.id);
                } else {
                    throw new Error(data?.error || 'Erro ao salvar no servidor');
                }
            } catch (err) {
                console.warn('Falha ao salvar remarque no servidor, mantendo fallback local:', err);
            }

            remarkRequests.push(requestPayload);
            saveRemarkRequests();
            closeModal('remarkRequestModal');
            showSuccessMessage('Solicitação de remarque enviada para autorização.');
        }

        async function openRemarkRequestsModal() {
            const serverState = { canAuthorize: canAuthorizeRemarkRequests() || remarkCanAuthorizeFromServer === true };
            if (!serverState.canAuthorize && !canAuthorizeRemarkRequests()) {
                alert('Apenas ATAC, FINANCEIRO ou CEO podem abrir as solicitações de remarque.');
                return;
            }
            document.getElementById('remarkRequestsModal').classList.add('active');
            fetchRemarkConfigFromServer().catch(() => updateRemarkConfigUi());
            const shouldFetch = Date.now() - remarkRequestsLastFetchAt > REMARK_REQUESTS_CACHE_MS;
            renderRemarkRequestsList({ loading: shouldFetch });
            if (shouldFetch) {
                fetchRemarkRequestsFromServer()
                    .then(() => renderRemarkRequestsList())
                    .catch(() => renderRemarkRequestsList());
            }
        }

        function renderRemarkRequestsList(options = {}) {
            const container = document.getElementById('remarkRequestsList');
            if (!container) return;
            const canAuthorize = canAuthorizeRemarkRequests();
            const sortedRequests = [...remarkRequests].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
            const loadingHtml = '<div class="p-4 text-center text-sky-700 bg-sky-50 border border-sky-100 rounded-lg">Carregando solicitações de remarque...</div>';

            if (options.loading && sortedRequests.length === 0) {
                container.innerHTML = loadingHtml;
                return;
            }

            if (sortedRequests.length === 0) {
                container.innerHTML = '<div class="p-6 text-center text-gray-500 border rounded-lg">Nenhuma solicitação de remarque registrada.</div>';
                return;
            }

            const listHtml = sortedRequests.map(request => {
                const appointment = getAppointmentById(request.appointmentId);
                const professional = getProfessionalById(request.professionalId);
                const conflict = request.conflictAppointmentId ? getAppointmentById(request.conflictAppointmentId) : null;
                const patientName = request.patientName || (appointment ? appointment.clientName : '');
                const patientInsurance = request.patientInsurance || getPatientInsuranceForAppointment(appointment) || 'Nao informado';
                const requestedAtText = formatDateTimeBR(request.requestedAt);
                const relocations = Array.isArray(request.conflictRelocations) && request.conflictRelocations.length
                    ? request.conflictRelocations
                    : (conflict && request.conflictNewDate ? [{
                        appointmentId: request.conflictAppointmentId,
                        newDate: request.conflictNewDate,
                        newTime: request.conflictNewTime,
                        newEndTime: request.conflictNewEndTime
                    }] : []);
                const relocationText = relocations.length
                    ? relocations.map(item => {
                        const moved = getAppointmentById(item.appointmentId);
                        return `${moved ? moved.clientName : 'Agendamento'} -> ${formatDateBR(item.newDate)} ${item.newTime} - ${item.newEndTime}`;
                    }).join('<br>')
                    : 'N/A';
                const statusClass = request.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' : request.status === 'aprovado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                const decisionInfo = request.status === 'aprovado'
                    ? `<div><strong>Autorizado por:</strong> ${request.approvedBy || 'N/A'}</div>`
                    : request.status === 'reprovado'
                        ? `<div><strong>Reprovado por:</strong> ${request.rejectedBy || 'N/A'}</div><div><strong>Motivo da reprovacao:</strong> ${request.rejectionReason || 'Sem motivo informado'}</div>`
                        : '';
                const isDeciding = remarkDecisionInFlight.has(String(request.id));
                const buttons = canAuthorize && request.status === 'pendente' ? `
                    <div class="flex gap-2 mt-3">
                        <button type="button" onclick="approveRemarkRequest('${request.id}')" ${isDeciding ? 'disabled' : ''} class="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-3 py-2 rounded text-sm font-medium">${isDeciding ? 'Autorizando...' : 'Autorizar'}</button>
                        <button type="button" onclick="rejectRemarkRequest('${request.id}')" ${isDeciding ? 'disabled' : ''} class="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-3 py-2 rounded text-sm font-medium">${isDeciding ? 'Aguarde...' : 'Reprovar'}</button>
                    </div>
                ` : '';

                return `
                    <div class="border rounded-lg p-4">
                        <div class="flex flex-wrap justify-between gap-2 mb-2">
                            <div class="font-bold text-gray-800">${appointment ? appointment.clientName : 'Agendamento não encontrado'}</div>
                            <span class="px-2 py-1 rounded text-xs font-medium ${statusClass}">${request.status}</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                            <div><strong>Profissional:</strong> ${professional ? professional.name : 'N/A'}</div>
                            <div><strong>Solicitado por:</strong> ${request.requestedBy}</div>
                            <div><strong>Solicitado em:</strong> ${requestedAtText}</div>
                            <div><strong>Convenio:</strong> ${patientInsurance}</div>
                            <div><strong>Atual:</strong> ${formatDateBR(request.originalDate)} ${request.originalTime} - ${request.originalEndTime}</div>
                            <div><strong>Novo:</strong> ${formatDateBR(request.newDate)} ${request.newTime} - ${request.newEndTime}</div>
                            <div><strong>Destino do conflito:</strong> ${relocationText}</div>
                            <div><strong>Inversão:</strong> ${request.invertTimes ? `Sim${conflict ? `, com ${conflict.clientName}` : ''}` : 'Não'}</div>
                            <div><strong>Observação:</strong> ${request.reason || 'Sem observação'}</div>
                            ${decisionInfo}
                        </div>
                        ${!canAuthorize && request.status === 'pendente' ? '<div class="mt-3 text-sm text-gray-500">Aguardando autorização de ATAC, FINANCEIRO ou CEO.</div>' : ''}
                        ${buttons}
                    </div>
                `;
            }).join('');
            container.innerHTML = options.loading ? `${loadingHtml}${listHtml}` : listHtml;
        }

        async function openRemarkNotificationsModal() {
            document.getElementById('remarkNotificationsModal').classList.add('active');
            const shouldFetch = Date.now() - remarkRequestsLastFetchAt > REMARK_REQUESTS_CACHE_MS;
            renderRemarkNotificationsList({ loading: shouldFetch });
            if (shouldFetch) {
                fetchRemarkRequestsFromServer()
                    .then(() => {
                        renderRemarkNotificationsList();
                        markRemarkNotificationsSeen();
                    })
                    .catch(() => {
                        renderRemarkNotificationsList();
                        markRemarkNotificationsSeen();
                    });
            } else {
                markRemarkNotificationsSeen();
            }
        }

        function renderRemarkNotificationsList(options = {}) {
            const container = document.getElementById('remarkNotificationsList');
            if (!container) return;
            const username = currentUser ? String(currentUser.username || '').toLowerCase() : '';
            const notifications = remarkRequests
                .filter(request => String(request.requestedByUsername || '').toLowerCase() === username)
                .filter(request => request.status === 'aprovado' || request.status === 'reprovado')
                .sort((a, b) => new Date(b.approvedAt || b.rejectedAt || b.requestedAt) - new Date(a.approvedAt || a.rejectedAt || a.requestedAt));

            const loadingHtml = '<div class="p-4 text-center text-rose-700 bg-rose-50 border border-rose-100 rounded-lg">Carregando notificações de remarque...</div>';
            if (options.loading && !notifications.length) {
                container.innerHTML = loadingHtml;
                return;
            }

            if (!notifications.length) {
                container.innerHTML = '<div class="p-6 text-center text-gray-500 border rounded-lg">Nenhuma notificacao de remarque.</div>';
                return;
            }

            const listHtml = notifications.map(request => {
                const appointment = getAppointmentById(request.appointmentId);
                const isApproved = request.status === 'aprovado';
                const statusClass = isApproved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                const sector = request.decidedBySector || 'SETOR';
                const message = isApproved
                    ? `Aprovado pelo setor ${sector}.`
                    : `Reprovado pelo setor ${sector}. Motivo: ${request.rejectionReason || 'Sem motivo informado'}`;
                return `
                    <div class="border rounded-lg p-4">
                        <div class="flex flex-wrap justify-between gap-2 mb-2">
                            <div class="font-bold text-gray-800">${appointment ? appointment.clientName : 'Solicitacao de remarque'}</div>
                            <span class="px-2 py-1 rounded text-xs font-medium ${statusClass}">${request.status}</span>
                        </div>
                        <div class="text-sm text-gray-700 space-y-1">
                            <div>${message}</div>
                            <div><strong>Solicitado:</strong> ${formatDateBR(request.originalDate)} ${request.originalTime} - ${request.originalEndTime}</div>
                            <div><strong>Novo:</strong> ${formatDateBR(request.newDate)} ${request.newTime} - ${request.newEndTime}</div>
                        </div>
                    </div>
                `;
            }).join('');
            container.innerHTML = options.loading ? `${loadingHtml}${listHtml}` : listHtml;
        }

        async function persistRemarkAppointmentUpdate(appointment) {
            const numericId = Number(appointment.id);
            if (Number.isNaN(numericId) || numericId <= 0) return true;
            const headers = { 'Content-Type': 'application/json' };
            if (currentUser && currentUser.username && currentUser.password) {
                headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
            }
            const response = await fetch(`http://127.0.0.1:5000/api/agendamentos/${numericId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    data: appointment.date,
                    hora_inicio: appointment.time,
                    hora_fim: appointment.endTime,
                    ultima_acao: currentUser ? (currentUser.name || currentUser.username) : 'Sistema'
                })
            });
            const data = await response.json();
            return !!(data && data.success);
        }

        async function approveRemarkRequest(requestId) {
            if (!canAuthorizeRemarkRequests()) {
                alert('Somente ATAC, FINANCEIRO ou CEO podem autorizar remarque.');
                return;
            }
            const request = remarkRequests.find(item => String(item.id) === String(requestId));
            const appointment = request ? getAppointmentById(request.appointmentId) : null;
            if (!request || !appointment) {
                alert('Solicitação ou agendamento não encontrado.');
                return;
            }

            const requestKey = String(request.id);
            if (remarkDecisionInFlight.has(requestKey)) return;
            remarkDecisionInFlight.add(requestKey);
            renderRemarkRequestsList();

            try {
                const response = await fetch(`http://127.0.0.1:5000/api/remarques/${request.id}/approve`, {
                    method: 'PUT',
                    headers: getRemarkAuthHeaders()
                });
                const data = await response.json();
                if (data && data.success) {
                    request.status = 'aprovado';
                    request.approvedBy = data.autorizado_por || (currentUser ? (currentUser.name || currentUser.username) : 'Sistema');
                    request.decidedBySector = data.decidido_por_setor || getRemarkDecisionSectorFallback();
                    request.approvedAt = new Date().toISOString();
                    saveRemarkRequests();
                    await fetchAppointmentsFromServer();
                    await fetchRemarkRequestsFromServer({ force: true });
                    refreshActiveScheduleViews();
                    remarkDecisionInFlight.delete(requestKey);
                    renderRemarkRequestsList();
                    showSuccessMessage('Remarque autorizado e aplicado.');
                    return;
                }
            } catch (err) {
                console.warn('Falha ao aprovar remarque no servidor, tentando fallback local:', err);
            }

            const conflict = request.conflictAppointmentId ? getAppointmentById(request.conflictAppointmentId) : null;

            const originalDate = appointment.date;
            const originalTime = appointment.time;
            const originalEndTime = appointment.endTime || getDefaultEndTime(appointment.time);
            appointment.date = request.newDate;
            appointment.time = request.newTime;
            appointment.endTime = request.newEndTime;
            appointment.lastAction = { user: currentUser ? currentUser.name : 'Sistema', timestamp: new Date().toISOString(), action: 'remarque_autorizado' };

            if (request.invertTimes && conflict) {
                conflict.date = originalDate;
                conflict.time = originalTime;
                conflict.endTime = originalEndTime;
                conflict.lastAction = { user: currentUser ? currentUser.name : 'Sistema', timestamp: new Date().toISOString(), action: 'remarque_invertido' };
            } else if (conflict && request.conflictNewDate && request.conflictNewTime && request.conflictNewEndTime) {
                conflict.date = request.conflictNewDate;
                conflict.time = request.conflictNewTime;
                conflict.endTime = request.conflictNewEndTime;
                conflict.lastAction = { user: currentUser ? currentUser.name : 'Sistema', timestamp: new Date().toISOString(), action: 'remarque_realocado' };
            }

            const fallbackRelocations = Array.isArray(request.conflictRelocations) && request.conflictRelocations.length
                ? request.conflictRelocations
                : [];
            if (!request.invertTimes && fallbackRelocations.length) {
                fallbackRelocations.forEach(relocation => {
                    const moved = getAppointmentById(relocation.appointmentId);
                    if (!moved) return;
                    moved.date = relocation.newDate;
                    moved.time = relocation.newTime;
                    moved.endTime = relocation.newEndTime;
                    moved.lastAction = { user: currentUser ? currentUser.name : 'Sistema', timestamp: new Date().toISOString(), action: 'remarque_realocado' };
                });
            }

            const savedMain = await persistRemarkAppointmentUpdate(appointment);
            const savedConflict = conflict && request.invertTimes ? await persistRemarkAppointmentUpdate(conflict) : true;
            const savedRelocations = fallbackRelocations.length
                ? await Promise.all(fallbackRelocations.map(relocation => {
                    const moved = getAppointmentById(relocation.appointmentId);
                    return moved ? persistRemarkAppointmentUpdate(moved) : Promise.resolve(false);
                }))
                : [];
            if (!savedMain || !savedConflict || savedRelocations.some(success => !success)) {
                remarkDecisionInFlight.delete(requestKey);
                renderRemarkRequestsList();
                alert('Não foi possível salvar a autorização no banco. Atualize e tente novamente.');
                return;
            }

            request.status = 'aprovado';
            request.approvedBy = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
            request.decidedBySector = getRemarkDecisionSectorFallback();
            request.approvedAt = new Date().toISOString();
            localStorage.setItem('appointments', JSON.stringify(appointments));
            saveRemarkRequests();
            refreshActiveScheduleViews();
            remarkDecisionInFlight.delete(requestKey);
            renderRemarkRequestsList();
            showSuccessMessage('Remarque autorizado e aplicado.');
        }

        async function rejectRemarkRequest(requestId) {
            if (!canAuthorizeRemarkRequests()) {
                alert('Somente ATAC, FINANCEIRO ou CEO podem reprovar remarque.');
                return;
            }
            const request = remarkRequests.find(item => String(item.id) === String(requestId));
            if (!request) return;
            const requestKey = String(request.id);
            if (remarkDecisionInFlight.has(requestKey)) return;
            const rejectionReason = prompt('Informe o motivo da reprovação:');
            if (!rejectionReason || !rejectionReason.trim()) {
                alert('O motivo da reprovação é obrigatório.');
                return;
            }
            remarkDecisionInFlight.add(requestKey);
            renderRemarkRequestsList();
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/remarques/${request.id}/reject`, {
                    method: 'PUT',
                    headers: getRemarkAuthHeaders(),
                    body: JSON.stringify({ reason: rejectionReason.trim() })
                });
                const data = await response.json();
                if (data && data.success) {
                    request.rejectedBy = data.rejeitado_por || (currentUser ? (currentUser.name || currentUser.username) : 'Sistema');
                    request.decidedBySector = data.decidido_por_setor || getRemarkDecisionSectorFallback();
                    request.rejectionReason = data.motivo_reprovacao || rejectionReason.trim();
                } else {
                    throw new Error(data?.error || 'Falha ao reprovar remarque');
                }
            } catch (err) {
                console.warn('Falha ao reprovar remarque no servidor:', err);
                request.rejectedBy = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
                request.decidedBySector = getRemarkDecisionSectorFallback();
                request.rejectionReason = rejectionReason.trim();
            }
            request.status = 'reprovado';
            request.rejectedAt = new Date().toISOString();
            saveRemarkRequests();
            await fetchRemarkRequestsFromServer({ force: true }).catch(() => null);
            remarkDecisionInFlight.delete(requestKey);
            renderRemarkRequestsList();
            showSuccessMessage('Remarque reprovado com motivo registrado.');
        }

        // Bulk Edit Functions
        let filteredBulkAppointments = [];
        let selectedBulkAppointments = [];

        function openSmartReschedulingModal() {
            if (!checkPermission('bulkEdit')) {
                showPermissionDenied('bulkEdit');
                return;
            }
            
            // Populate professional filters
            const leavingProfessional = document.getElementById('leavingProfessional');
            const replacementProfessional = document.getElementById('replacementProfessional');
            const absentProfessional = document.getElementById('absentProfessional');
            
            leavingProfessional.innerHTML = '<option value="">Selecione o profissional...</option>';
            replacementProfessional.innerHTML = '<option value="">Selecione o substituto...</option>';
            absentProfessional.innerHTML = '<option value="">Selecione o profissional...</option>';
            
            // Only show active professionals in smart rescheduling
            const activeProfessionals = professionals.filter(prof => prof.active !== false);
            
            activeProfessionals.forEach(prof => {
                const option3 = document.createElement('option');
                option3.value = prof.id;
                option3.textContent = `${prof.name} (${prof.specialty})`;
                leavingProfessional.appendChild(option3);
                
                const option4 = document.createElement('option');
                option4.value = prof.id;
                option4.textContent = `${prof.name} (${prof.specialty})`;
                replacementProfessional.appendChild(option4);
                
                const option5 = document.createElement('option');
                option5.value = prof.id;
                option5.textContent = `${prof.name} (${prof.specialty})`;
                absentProfessional.appendChild(option5);
            });
            
            document.getElementById('smartReschedulingModal').classList.add('active');
        }

        function openBulkCancelModal() {
            if (!checkPermission('bulkCancel')) {
                showPermissionDenied('bulkCancel');
                return;
            }

            selectedBulkAppointments = [];
            filteredBulkAppointments = [...appointments];

            const startDateInput = document.getElementById('bulkFilterStartDate');
            const endDateInput = document.getElementById('bulkFilterEndDate');
            const professionalSelect = document.getElementById('bulkFilterProfessional');
            const typeSelect = document.getElementById('bulkFilterType');
            const statusSelect = document.getElementById('bulkFilterStatus');
            const changeStatusSelect = document.getElementById('bulkChangeStatus');
            const clientInput = document.getElementById('bulkFilterClient');

            if (startDateInput) startDateInput.value = '';
            if (endDateInput) endDateInput.value = '';
            if (professionalSelect) {
                professionalSelect.innerHTML = '<option value="">Todos os Profissionais</option>';
                professionals.forEach(prof => {
                    const option = document.createElement('option');
                    option.value = prof.id;
                    option.textContent = prof.name;
                    professionalSelect.appendChild(option);
                });
                professionalSelect.value = '';
            }

            if (typeSelect) {
                typeSelect.value = '';
            }
            if (statusSelect) {
                statusSelect.value = '';
            }
            if (changeStatusSelect) {
                changeStatusSelect.value = '';
            }
            if (clientInput) {
                clientInput.value = '';
            }

            filterBulkAppointments();
            document.getElementById('bulkCancelModal').classList.add('active');
        }

        async function confirmBulkStatusSelected() {
            if (selectedBulkAppointments.length === 0) {
                alert('⚠️ Selecione pelo menos um agendamento para alterar.');
                return;
            }

            const newStatus = document.getElementById('bulkChangeStatus').value;
            if (!newStatus) {
                alert('⚠️ Selecione o novo status para aplicar em massa.');
                return;
            }

            if (!confirm(`🔄 Confirmar a alteração de ${selectedBulkAppointments.length} agendamento(s) para o status ${getStatusLabel(newStatus)}?`)) {
                return;
            }

            if (newStatus === 'excluir') {
                openBulkDeleteConfirmModal();
                return;
            }

            await applyBulkStatusChange(newStatus);
        }

        async function applyBulkStatusChange(newStatus) {
            if (selectedBulkAppointments.length === 0) {
                return;
            }

            const now = new Date().toISOString();
            const headers = { 'Content-Type': 'application/json' };
            if (currentUser && currentUser.username && currentUser.password) {
                headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
            }

            let cancelledCount = 0;
            const previousStates = new Map();
            selectedBulkAppointments.forEach(appointmentId => {
                const index = appointments.findIndex(a => String(a.id) === String(appointmentId));
                if (index === -1) {
                    return;
                }

                const appointment = appointments[index];
                previousStates.set(String(appointmentId), {
                    status: appointment.status || 'agendado',
                    lockedBy: appointment.lockedBy || null,
                    lastAction: appointment.lastAction ? { ...appointment.lastAction } : null
                });
                appointment.status = newStatus;
                appointment.lockedBy = newStatus === 'cancelado_profissional' ? (currentUser ? currentUser.username : null) : null;
                appointment.lastAction = {
                    user: currentUser ? currentUser.name : 'Sistema',
                    timestamp: now,
                    action: newStatus
                };
                cancelledCount += 1;
            });

            const serverAppointmentIds = selectedBulkAppointments
                .map(id => Number(id))
                .filter(id => !Number.isNaN(id) && id > 0);

            let serverSuccess = false;
            let serverError = null;

            if (serverAppointmentIds.length > 0) {
                const usuarioAcao = currentUser ? (currentUser.name || currentUser.username) : 'Sistema';
                
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/agendamentos/bulk-status', {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({
                            appointmentIds: serverAppointmentIds,
                            status: newStatus,
                            ultima_acao: usuarioAcao
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data && data.success) {
                        debugLog('[applyBulkStatusChange] Status atualizado no servidor:', data.updated, 'agendamentos');
                        serverSuccess = true;
                    } else {
                        serverError = data?.error || 'Erro desconhecido';
                        console.warn('[applyBulkStatusChange] Falha ao atualizar status no servidor:', data);
                    }
                } catch (err) {
                    serverError = err.message;
                    console.warn('[applyBulkStatusChange] Erro de rede ao atualizar status:', err);
                }
            }

            if (!serverSuccess && serverError) {
                selectedBulkAppointments.forEach(appointmentId => {
                    const index = appointments.findIndex(a => String(a.id) === String(appointmentId));
                    const previousState = previousStates.get(String(appointmentId));
                    if (index === -1 || !previousState) {
                        return;
                    }

                    appointments[index].status = previousState.status;
                    appointments[index].lockedBy = previousState.lockedBy;
                    appointments[index].lastAction = previousState.lastAction;
                });
            }

            localStorage.setItem('appointments', JSON.stringify(appointments));
            
            // Recarregar dados do servidor para confirmar sincronização
            if (serverSuccess) {
                showLoading('Sincronizando', 'Atualizando dados...');
                await fetchAppointmentsFromServer();
                hideLoading();
            }
            
            refreshActiveScheduleViews();
            selectedBulkAppointments = [];
            filterBulkAppointments();
            closeModal('bulkCancelModal');
            
            if (serverSuccess) {
                showSuccessMessage(`✅ ${cancelledCount} agendamento(s) atualizados para ${getStatusLabel(newStatus)} e salvos no banco de dados!`);
            } else if (serverError) {
                alert(`⚠️ Alteração aplicada localmente, mas houve erro ao salvar no banco de dados:\n${serverError}\n\nOs dados serão sincronizados na próxima conexão.`);
            } else {
                showSuccessMessage(`✅ ${cancelledCount} agendamento(s) atualizados para ${getStatusLabel(newStatus)} com sucesso.`);
            }
        }

        // Smart Professional Replacement Functions
        let currentReplacementAnalysis = null;
        let conflictResolutions = [];

        function analyzeProfessionalReplacement() {
            const leavingProfId = document.getElementById('leavingProfessional').value;
            if (!leavingProfId) {
                document.getElementById('replacementAnalysis').classList.add('hidden');
                return;
            }

            const leavingProf = professionals.find(p => p.id === leavingProfId);
            // Only consider 'discussao' and 'clinica' appointments for replacement
            const leavingAppointments = appointments.filter(apt => 
                apt.professionalId === leavingProfId && 
                (apt.type === 'discussao' || apt.type === 'clinica')
            );
            
            if (leavingAppointments.length === 0) {
                document.getElementById('analysisResults').innerHTML = `
                    <div class="bg-green-100 p-3 rounded-lg text-green-800">
                        ✅ O profissional <strong>${leavingProf.name}</strong> não possui agendamentos de <strong>Discussão de Caso</strong> ou <strong>Atendimento Clínica</strong> para substituir.
                        <div class="text-sm mt-2 text-green-700">
                            💡 <strong>Nota:</strong> Apenas agendamentos de Discussão e Clínica são considerados para substituição inteligente.
                        </div>
                    </div>
                `;
                document.getElementById('replacementAnalysis').classList.remove('hidden');
                return;
            }

            // Analyze appointments by type
            const appointmentsByType = {};
            leavingAppointments.forEach(apt => {
                if (!appointmentsByType[apt.type]) {
                    appointmentsByType[apt.type] = [];
                }
                appointmentsByType[apt.type].push(apt);
            });

            let analysisHtml = `
                <div class="mb-4">
                    <h6 class="font-bold text-gray-800 mb-2">👨‍⚕️ Profissional: ${leavingProf.name} (${leavingProf.specialty})</h6>
                    <div class="text-sm text-gray-600">Total de agendamentos: <strong>${leavingAppointments.length}</strong></div>
                </div>
                <div class="space-y-3">
            `;

            Object.entries(appointmentsByType).forEach(([type, typeAppointments]) => {
                const typeLabel = getTypeLabel(type);
                const typeColor = getAppointmentColor(type);
                
                analysisHtml += `
                    <div class="border rounded-lg p-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="px-2 py-1 rounded text-xs ${typeColor}">${typeLabel}</span>
                            <span class="text-sm font-medium">${typeAppointments.length} agendamentos</span>
                        </div>
                        <div class="text-xs text-gray-600 space-y-1">
                `;
                
                typeAppointments.forEach(apt => {
                    const date = formatDateBR(apt.date);
                    analysisHtml += `
                        <div>📅 ${date} às ${formatAppointmentTime(apt)} - ${apt.clientName}</div>
                    `;
                });
                
                analysisHtml += `</div></div>`;
            });

            analysisHtml += '</div>';
            
            document.getElementById('analysisResults').innerHTML = analysisHtml;
            document.getElementById('replacementAnalysis').classList.remove('hidden');
            
            // Store analysis for later use
            currentReplacementAnalysis = {
                leavingProfId: leavingProfId,
                leavingProf: leavingProf,
                appointments: leavingAppointments,
                appointmentsByType: appointmentsByType
            };
        }

        function checkReplacementCompatibility() {
            const replacementProfId = document.getElementById('replacementProfessional').value;
            if (!replacementProfId || !currentReplacementAnalysis) return;

            const replacementProf = professionals.find(p => p.id === replacementProfId);
            const replacementAppointments = appointments.filter(apt => apt.professionalId === replacementProfId);
            
            // Check for time conflicts
            const conflicts = [];
            const compatibleReplacements = [];
            const problematicTypes = [];

            currentReplacementAnalysis.appointments.forEach(leavingApt => {
                const conflict = replacementAppointments.find(replApt => 
                    replApt.date === leavingApt.date && replApt.time === leavingApt.time
                );
                
                if (conflict) {
                    conflicts.push({
                        leaving: leavingApt,
                        replacement: conflict,
                        date: leavingApt.date,
                        time: leavingApt.time
                    });
                } else {
                    // Check if replacement professional can handle this type of appointment
                    const canHandle = checkProfessionalCompatibility(replacementProf, leavingApt.type);
                    if (canHandle) {
                        compatibleReplacements.push(leavingApt);
                    } else {
                        problematicTypes.push(leavingApt);
                    }
                }
            });

            // Update analysis with compatibility results
            let compatibilityHtml = `
                <div class="mt-4 border-t pt-4">
                    <h6 class="font-bold text-gray-800 mb-3">🔄 Análise de Compatibilidade com ${replacementProf.name}</h6>
            `;

            if (compatibleReplacements.length > 0) {
                compatibilityHtml += `
                    <div class="mb-3 bg-green-50 p-3 rounded-lg">
                        <div class="font-medium text-green-800 mb-2">✅ Substituições Diretas Possíveis (${compatibleReplacements.length})</div>
                        <div class="text-xs text-green-700 space-y-1">
                `;
                compatibleReplacements.forEach(apt => {
                    const date = formatDateBR(apt.date);
                    compatibilityHtml += `<div>📅 ${date} às ${apt.time} - ${apt.clientName} (${getTypeLabel(apt.type)})</div>`;
                });
                compatibilityHtml += '</div></div>';
            }

            if (conflicts.length > 0) {
                compatibilityHtml += `
                    <div class="mb-3 bg-red-50 p-3 rounded-lg">
                        <div class="font-medium text-red-800 mb-2">⚠️ Conflitos de Horário (${conflicts.length})</div>
                        <div class="text-xs text-red-700 space-y-1">
                `;
                conflicts.forEach(conflict => {
                    const date = formatDateBR(conflict.date);
                    compatibilityHtml += `
                        <div class="border-l-2 border-red-300 pl-2">
                            📅 ${date} às ${conflict.time}:<br>
                            • Saindo: ${conflict.leaving.clientName} (${getTypeLabel(conflict.leaving.type)})<br>
                            • Conflito: ${conflict.replacement.clientName} (${getTypeLabel(conflict.replacement.type)})
                        </div>
                    `;
                });
                compatibilityHtml += '</div></div>';
            }

            if (problematicTypes.length > 0) {
                compatibilityHtml += `
                    <div class="mb-3 bg-yellow-50 p-3 rounded-lg">
                        <div class="font-medium text-yellow-800 mb-2">⚠️ Incompatibilidade de Especialidade (${problematicTypes.length})</div>
                        <div class="text-xs text-yellow-700 space-y-1">
                `;
                problematicTypes.forEach(apt => {
                    const date = formatDateBR(apt.date);
                    compatibilityHtml += `<div>📅 ${date} às ${apt.time} - ${apt.clientName} (${getTypeLabel(apt.type)})</div>`;
                });
                compatibilityHtml += '</div></div>';
            }

            compatibilityHtml += '</div>';
            
            document.getElementById('analysisResults').innerHTML += compatibilityHtml;
            
            // Store conflict data for resolution
            currentReplacementAnalysis.conflicts = conflicts;
            currentReplacementAnalysis.compatibleReplacements = compatibleReplacements;
            currentReplacementAnalysis.problematicTypes = problematicTypes;
            currentReplacementAnalysis.replacementProf = replacementProf;
        }

        function checkProfessionalCompatibility(professional, appointmentType) {
            // For smart replacement, only consider 'discussao' and 'clinica' types
            if (appointmentType !== 'discussao' && appointmentType !== 'clinica') {
                return false;
            }
            
            // Define compatibility rules based on specialty and appointment type
            const compatibilityRules = {
                'PSICO ABA': ['clinica', 'discussao'],
                'PSICO COMUM': ['clinica', 'discussao'],
                'ATAC': ['clinica'],
                'ATM': ['clinica'],
                'ATs': ['clinica'],
                'FONO': ['clinica', 'discussao'],
                'T.O': ['clinica', 'discussao'],
                'NEUROPSI': ['clinica', 'discussao'],
                'MUSICOTERAPIA': ['clinica'],
                'PSICOMOTRICIDADE': ['clinica']
            };

            const specialties = getProfessionalSpecialties(professional);
            if (specialties.length === 0) {
                return appointmentType === 'clinica';
            }

            return specialties.some(specialty => {
                const allowedTypes = compatibilityRules[specialty] || ['clinica'];
                return allowedTypes.includes(appointmentType);
            });
        }

        function executeSmartReplacement() {
            if (!currentReplacementAnalysis || !currentReplacementAnalysis.replacementProf) {
                alert('⚠️ Selecione primeiro o profissional substituto!');
                return;
            }

            const { conflicts, compatibleReplacements, problematicTypes } = currentReplacementAnalysis;
            
            if (conflicts.length > 0 || problematicTypes.length > 0) {
                alert(`⚠️ Existem ${conflicts.length} conflitos de horário e ${problematicTypes.length} incompatibilidades de especialidade que precisam ser resolvidos primeiro.\n\nClique em "Resolver Conflitos" para ver as opções.`);
                return;
            }

            if (compatibleReplacements.length === 0) {
                alert('⚠️ Não há agendamentos compatíveis para substituição direta!');
                return;
            }

            const confirmMessage = `🔄 CONFIRMAR SUBSTITUIÇÃO INTELIGENTE\n\n` +
                `Profissional saindo: ${currentReplacementAnalysis.leavingProf.name}\n` +
                `Novo profissional: ${currentReplacementAnalysis.replacementProf.name}\n\n` +
                `Serão substituídos ${compatibleReplacements.length} agendamentos compatíveis.\n\n` +
                `⚠️ Esta ação não pode ser desfeita!\n\nDeseja continuar?`;

            if (confirm(confirmMessage)) {
                let replacedCount = 0;
                
                compatibleReplacements.forEach(apt => {
                    const index = appointments.findIndex(a => a.id === apt.id);
                    if (index !== -1) {
                        appointments[index].professionalId = currentReplacementAnalysis.replacementProf.id;
                        replacedCount++;
                    }
                });

                localStorage.setItem('appointments', JSON.stringify(appointments));
                refreshActiveScheduleViews();
                
                // Clear analysis
                currentReplacementAnalysis = null;
                document.getElementById('leavingProfessional').value = '';
                document.getElementById('replacementProfessional').value = '';
                document.getElementById('replacementAnalysis').classList.add('hidden');
                
                showSuccessMessage(`✅ Substituição concluída! ${replacedCount} agendamentos foram transferidos com sucesso.`);
            }
        }

        function showConflictResolution() {
            if (!currentReplacementAnalysis || !currentReplacementAnalysis.conflicts) {
                alert('⚠️ Nenhum conflito detectado para resolver!');
                return;
            }

            const { conflicts, problematicTypes, replacementProf } = currentReplacementAnalysis;
            
            // Generate conflict resolution suggestions
            conflictResolutions = [];
            let conflictsHtml = '';
            let suggestionsHtml = '';

            // Handle time conflicts
            conflicts.forEach((conflict, index) => {
                const date = formatDateBR(conflict.date);
                conflictsHtml += `
                    <div class="bg-white p-3 rounded-lg border border-red-200">
                        <div class="font-medium text-red-800 mb-2">⚠️ Conflito ${index + 1}: ${date} às ${conflict.time}</div>
                        <div class="text-sm space-y-1">
                            <div class="text-red-700">🔄 Saindo: ${conflict.leaving.clientName} (${getTypeLabel(conflict.leaving.type)})</div>
                            <div class="text-red-700">❌ Conflito: ${conflict.replacement.clientName} (${getTypeLabel(conflict.replacement.type)})</div>
                        </div>
                    </div>
                `;

                // Find alternative time slots
                const alternatives = findAlternativeTimeSlots(conflict.leaving, replacementProf.id);
                if (alternatives.length > 0) {
                    suggestionsHtml += `
                        <div class="bg-white p-3 rounded-lg border border-blue-200 mb-3">
                            <div class="font-medium text-blue-800 mb-2">💡 Sugestões para: ${conflict.leaving.clientName}</div>
                            <div class="space-y-2">
                    `;
                    
                    alternatives.slice(0, 3).forEach((alt, altIndex) => {
                        const altDate = formatDateBR(alt.date);
                        const resolutionId = `conflict_${index}_alt_${altIndex}`;
                        
                        suggestionsHtml += `
                            <label class="flex items-center space-x-2 text-sm">
                                <input type="radio" name="conflict_${index}" value="${resolutionId}" 
                                       onchange="selectResolution('${resolutionId}', ${JSON.stringify(conflict).replace(/"/g, '&quot;')}, ${JSON.stringify(alt).replace(/"/g, '&quot;')})">
                                <span>📅 ${altDate} às ${alt.time}</span>
                            </label>
                        `;
                        
                        conflictResolutions.push({
                            id: resolutionId,
                            type: 'reschedule',
                            original: conflict.leaving,
                            newSlot: alt
                        });
                    });
                    
                    // Option to cancel the appointment
                    const cancelId = `conflict_${index}_cancel`;
                    suggestionsHtml += `
                        <label class="flex items-center space-x-2 text-sm text-red-600">
                            <input type="radio" name="conflict_${index}" value="${cancelId}" 
                                   onchange="selectResolution('${cancelId}', ${JSON.stringify(conflict).replace(/"/g, '&quot;')}, null)">
                            <span>🗑️ Cancelar este agendamento</span>
                        </label>
                    `;
                    
                    conflictResolutions.push({
                        id: cancelId,
                        type: 'cancel',
                        original: conflict.leaving
                    });
                    
                    suggestionsHtml += '</div></div>';
                } else {
                    suggestionsHtml += `
                        <div class="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-3">
                            <div class="font-medium text-yellow-800 mb-2">⚠️ ${conflict.leaving.clientName}</div>
                            <div class="text-sm text-yellow-700">Não foram encontrados horários alternativos disponíveis.</div>
                            <label class="flex items-center space-x-2 text-sm text-red-600 mt-2">
                                <input type="radio" name="conflict_${index}" value="conflict_${index}_cancel" 
                                       onchange="selectResolution('conflict_${index}_cancel', ${JSON.stringify(conflict).replace(/"/g, '&quot;')}, null)">
                                <span>🗑️ Cancelar este agendamento</span>
                            </label>
                        </div>
                    `;
                }
            });

            // Handle problematic types
            problematicTypes.forEach((apt, index) => {
                const date = formatDateBR(apt.date);
                conflictsHtml += `
                    <div class="bg-white p-3 rounded-lg border border-yellow-200">
                        <div class="font-medium text-yellow-800 mb-2">⚠️ Incompatibilidade: ${date} às ${apt.time}</div>
                        <div class="text-sm text-yellow-700">
                            ${apt.clientName} (${getTypeLabel(apt.type)}) - ${replacementProf.name} não pode realizar este tipo de atendimento
                        </div>
                    </div>
                `;

                // Find compatible professionals for this type
                const compatibleProfs = findCompatibleProfessionals(apt.type, apt.date, apt.time);
                if (compatibleProfs.length > 0) {
                    suggestionsHtml += `
                        <div class="bg-white p-3 rounded-lg border border-green-200 mb-3">
                            <div class="font-medium text-green-800 mb-2">💡 Profissionais compatíveis para: ${apt.clientName}</div>
                            <div class="space-y-2">
                    `;
                    
                    compatibleProfs.forEach((prof, profIndex) => {
                        const resolutionId = `incompatible_${index}_prof_${profIndex}`;
                        
                        suggestionsHtml += `
                            <label class="flex items-center space-x-2 text-sm">
                                <input type="radio" name="incompatible_${index}" value="${resolutionId}" 
                                       onchange="selectResolution('${resolutionId}', ${JSON.stringify(apt).replace(/"/g, '&quot;')}, ${JSON.stringify(prof).replace(/"/g, '&quot;')})">
                                <span>👨‍⚕️ ${prof.name} (${prof.specialty})</span>
                            </label>
                        `;
                        
                        conflictResolutions.push({
                            id: resolutionId,
                            type: 'reassign',
                            original: apt,
                            newProfessional: prof
                        });
                    });
                    
                    suggestionsHtml += '</div></div>';
                }
            });

            document.getElementById('conflictsList').innerHTML = conflictsHtml;
            document.getElementById('resolutionSuggestions').innerHTML = suggestionsHtml;
            document.getElementById('conflictResolutionModal').classList.add('active');
        }

        function findAlternativeTimeSlots(appointment, professionalId) {
            const alternatives = [];
            const currentDate = parseDateSafe(formatDate(appointment.date));
            if (!currentDate) return alternatives;
            
            // Check same day, different times
            const timeSlots = [];
            for (let hour = 6; hour <= 23; hour++) {
                timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
            }
            
            timeSlots.forEach(time => {
                if (time !== appointment.time) {
                    const conflict = appointments.find(apt => 
                        apt.date === appointment.date && 
                        apt.time === time && 
                        apt.professionalId === professionalId
                    );
                    
                    if (!conflict) {
                        alternatives.push({
                            date: appointment.date,
                            time: time
                        });
                    }
                }
            });
            
            // Check next 7 days, same time
            for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
                const checkDate = new Date(currentDate);
                checkDate.setDate(currentDate.getDate() + dayOffset);
                
                // Skip Sundays
                if (checkDate.getDay() === 0) continue;
                
                const checkDateStr = formatDate(checkDate);
                const conflict = appointments.find(apt => 
                    apt.date === checkDateStr && 
                    apt.time === appointment.time && 
                    apt.professionalId === professionalId
                );
                
                if (!conflict) {
                    alternatives.push({
                        date: checkDateStr,
                        time: appointment.time
                    });
                }
            }
            
            return alternatives;
        }

        function findCompatibleProfessionals(appointmentType, date, time) {
            const compatibleProfs = [];
            
            professionals.forEach(prof => {
                if (checkProfessionalCompatibility(prof, appointmentType)) {
                    // Check if professional is available at this time
                    const conflict = appointments.find(apt => 
                        apt.date === date && 
                        apt.time === time && 
                        apt.professionalId === prof.id
                    );
                    
                    if (!conflict) {
                        compatibleProfs.push(prof);
                    }
                }
            });
            
            return compatibleProfs;
        }

        let selectedResolutions = {};

        function selectResolution(resolutionId, original, newOption) {
            selectedResolutions[resolutionId] = {
                resolution: conflictResolutions.find(r => r.id === resolutionId),
                original: original,
                newOption: newOption
            };
        }

        function applyConflictResolutions() {
            const resolutionCount = Object.keys(selectedResolutions).length;
            const totalConflicts = (currentReplacementAnalysis.conflicts?.length || 0) + 
                                 (currentReplacementAnalysis.problematicTypes?.length || 0);
            
            if (resolutionCount < totalConflicts) {
                alert(`⚠️ Selecione uma resolução para todos os ${totalConflicts} conflitos antes de continuar!`);
                return;
            }

            if (confirm(`🔄 APLICAR RESOLUÇÕES\n\nSerão aplicadas ${resolutionCount} resoluções de conflitos.\n\n⚠️ Esta ação não pode ser desfeita!\n\nDeseja continuar?`)) {
                let appliedCount = 0;
                
                Object.values(selectedResolutions).forEach(({ resolution }) => {
                    const aptIndex = appointments.findIndex(a => a.id === resolution.original.id);
                    
                    if (aptIndex !== -1) {
                        switch (resolution.type) {
                            case 'reschedule':
                                appointments[aptIndex].date = resolution.newSlot.date;
                                appointments[aptIndex].time = resolution.newSlot.time;
                                appointments[aptIndex].professionalId = currentReplacementAnalysis.replacementProf.id;
                                appliedCount++;
                                break;
                                
                            case 'cancel':
                                appointments.splice(aptIndex, 1);
                                appliedCount++;
                                break;
                                
                            case 'reassign':
                                appointments[aptIndex].professionalId = resolution.newProfessional.id;
                                appliedCount++;
                                break;
                        }
                    }
                });

                localStorage.setItem('appointments', JSON.stringify(appointments));
                refreshActiveScheduleViews();
                
                closeModal('conflictResolutionModal');
                
                // Clear analysis and selections
                selectedResolutions = {};
                currentReplacementAnalysis = null;
                document.getElementById('leavingProfessional').value = '';
                document.getElementById('replacementProfessional').value = '';
                document.getElementById('replacementAnalysis').classList.add('hidden');
                
                showSuccessMessage(`✅ Resoluções aplicadas! ${appliedCount} conflitos foram resolvidos com sucesso.`);
            }
        }

        function filterBulkAppointments() {
            const startDateFilter = document.getElementById('bulkFilterStartDate').value;
            const endDateFilter = document.getElementById('bulkFilterEndDate').value;
            const professionalFilter = document.getElementById('bulkFilterProfessional').value;
            const typeFilter = document.getElementById('bulkFilterType').value;
            const statusFilter = document.getElementById('bulkFilterStatus').value;
            const clientFilter = document.getElementById('bulkFilterClient').value.toLowerCase();
            
            filteredBulkAppointments = appointments.filter(apt => {
                const professional = professionals.find(p => p.id === apt.professionalId);
                
                // Filtro de data
                let dateMatch = true;
                if (startDateFilter || endDateFilter) {
                    const aptDate = new Date(apt.date + 'T12:00:00');
                    if (startDateFilter) {
                        const startDate = new Date(startDateFilter + 'T12:00:00');
                        dateMatch = dateMatch && aptDate >= startDate;
                    }
                    if (endDateFilter) {
                        const endDate = new Date(endDateFilter + 'T12:00:00');
                        dateMatch = dateMatch && aptDate <= endDate;
                    }
                }
                
                const profMatch = !professionalFilter || String(apt.professionalId) === String(professionalFilter);
                const typeMatch = !typeFilter || apt.type === typeFilter;
                const statusMatch = !statusFilter || apt.status === statusFilter;
                const clientMatch = !clientFilter || apt.clientName.toLowerCase().includes(clientFilter);
                
                return dateMatch && profMatch && typeMatch && statusMatch && clientMatch;
            });
            
            // Sort by date and time
            filteredBulkAppointments.sort((a, b) => {
                const dateA = new Date(a.date + 'T' + a.time);
                const dateB = new Date(b.date + 'T' + b.time);
                return dateA - dateB;
            });
            
            displayBulkAppointments();
        }

        function displayBulkAppointments() {
            const container = document.getElementById('bulkAppointmentsList');
            const countSpan = document.getElementById('bulkResultsCount');
            
            countSpan.textContent = `${filteredBulkAppointments.length} agendamentos`;
            
            if (filteredBulkAppointments.length === 0) {
                container.innerHTML = '<div class="p-8 text-center text-gray-500">Nenhum agendamento encontrado com os filtros aplicados</div>';
                return;
            }
            
            container.innerHTML = filteredBulkAppointments.map(apt => {
                const professional = professionals.find(p => p.id === apt.professionalId);
                const profName = professional ? professional.name : 'N/A';
                const isSelected = selectedBulkAppointments.includes(String(apt.id));
                
                return `
                    <div class="flex items-center p-3 border-b hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}">
                        <input type="checkbox" 
                               id="bulk_${apt.id}" 
                               ${isSelected ? 'checked' : ''} 
                               onchange="toggleBulkSelection('${apt.id}')"
                               class="mr-3">
                        <div class="flex-1 grid grid-cols-1 md:grid-cols-7 gap-2 text-sm">
                            <div><strong>Data:</strong> ${new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                            <div><strong>Horário:</strong> ${apt.time}</div>
                            <div><strong>Profissional:</strong> ${profName}</div>
                            <div><strong>Paciente:</strong> ${apt.clientName}</div>
                            <div><strong>Tipo:</strong> <span class="px-2 py-1 rounded text-xs ${getAppointmentColor(apt.type)}">${getTypeLabel(apt.type)}</span></div>
                            <div><strong>Status:</strong> ${getStatusLabel(apt.status)}</div>
                            <div class="flex gap-1">
                                <button onclick="editAppointment(${JSON.stringify(apt).replace(/"/g, '&quot;')})" 
                                        class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs">
                                    ✏️ Editar
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function toggleBulkSelection(appointmentId) {
            const normalizedId = String(appointmentId);
            const index = selectedBulkAppointments.indexOf(normalizedId);
            if (index > -1) {
                selectedBulkAppointments.splice(index, 1);
            } else {
                selectedBulkAppointments.push(normalizedId);
            }
            displayBulkAppointments();
        }

        function selectAllFiltered() {
            selectedBulkAppointments = [...new Set([...selectedBulkAppointments, ...filteredBulkAppointments.map(apt => String(apt.id))])];
            displayBulkAppointments();
        }

        function deselectAll() {
            selectedBulkAppointments = [];
            displayBulkAppointments();
        }

        function clearBulkFilters() {
            document.getElementById('bulkFilterStartDate').value = '';
            document.getElementById('bulkFilterEndDate').value = '';
            document.getElementById('bulkFilterProfessional').value = '';
            document.getElementById('bulkFilterType').value = '';
            document.getElementById('bulkFilterStatus').value = '';
            document.getElementById('bulkFilterClient').value = '';
            selectedBulkAppointments = [];
            filterBulkAppointments();
        }

        function applyBulkChanges() {
            if (selectedBulkAppointments.length === 0) {
                alert('⚠️ Selecione pelo menos um agendamento para aplicar as alterações!');
                return;
            }
            
            const newType = document.getElementById('bulkChangeType').value;
            const newProfessionalId = document.getElementById('bulkChangeProfessional').value;
            
            if (!newType && !newProfessionalId) {
                alert('⚠️ Selecione pelo menos uma alteração para aplicar (Tipo ou Profissional)!');
                return;
            }
            
            let changeDescription = [];
            if (newType) changeDescription.push(`Tipo: ${getTypeLabel(newType)}`);
            if (newProfessionalId) {
                const prof = professionals.find(p => p.id === newProfessionalId);
                changeDescription.push(`Profissional: ${prof ? prof.name : 'N/A'}`);
            }
            
            if (confirm(`🔄 CONFIRMAR ALTERAÇÕES EM LOTE\n\nSerão alterados ${selectedBulkAppointments.length} agendamentos:\n\n${changeDescription.join('\n')}\n\n⚠️ Esta ação não pode ser desfeita!\n\nDeseja continuar?`)) {
                let updatedCount = 0;
                
                selectedBulkAppointments.forEach(appointmentId => {
                    const index = appointments.findIndex(a => a.id === appointmentId);
                    if (index !== -1) {
                        if (newType) appointments[index].type = newType;
                        if (newProfessionalId) appointments[index].professionalId = newProfessionalId;
                        updatedCount++;
                    }
                });
                
                localStorage.setItem('appointments', JSON.stringify(appointments));
                refreshActiveScheduleViews();
                
                // Clear selections and refresh
                selectedBulkAppointments = [];
                document.getElementById('bulkChangeType').value = '';
                document.getElementById('bulkChangeProfessional').value = '';
                filterBulkAppointments();
                closeModal('bulkCancelModal');
                closeModal('bulkCancelModal');

                showSuccessMessage(`✅ ${updatedCount} agendamentos atualizados com sucesso!`);
            }
        }

        function openBulkDeleteConfirmModal() {
            if (selectedBulkAppointments.length === 0) {
                alert('Selecione pelo menos um agendamento para excluir!');
                return;
            }

            const countElement = document.getElementById('bulkDeleteSelectedCount');
            const listElement = document.getElementById('bulkDeleteSelectedList');
            const modal = document.getElementById('bulkDeleteConfirmModal');

            if (countElement) {
                countElement.textContent = selectedBulkAppointments.length;
            }

            if (listElement) {
                const selectedDetails = selectedBulkAppointments
                    .map(id => appointments.find(apt => String(apt.id) === String(id)))
                    .filter(Boolean);

                listElement.innerHTML = selectedDetails.slice(0, 20).map(apt => {
                    const professional = professionals.find(p => String(p.id) === String(apt.professionalId));
                    const profName = professional ? professional.name : 'N/A';
                    const appointmentDate = apt.date ? new Date(apt.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Data nao informada';
                    const appointmentTime = apt.time || apt.startTime || 'Horario nao informado';

                    return `
                        <div class="p-3 text-sm">
                            <div class="font-semibold text-gray-800">${appointmentDate} as ${appointmentTime}</div>
                            <div class="text-gray-600">${apt.clientName || 'Paciente nao informado'} - ${profName} - ${getTypeLabel(apt.type)}</div>
                        </div>
                    `;
                }).join('');

                if (selectedDetails.length > 20) {
                    listElement.innerHTML += `<div class="p-3 text-sm font-medium text-gray-600">E mais ${selectedDetails.length - 20} agendamento(s) selecionado(s).</div>`;
                }
            }

            if (modal) {
                modal.classList.add('active');
            }
        }

        function closeBulkDeleteConfirmModal() {
            const modal = document.getElementById('bulkDeleteConfirmModal');
            if (modal) {
                modal.classList.remove('active');
            }
        }

        async function confirmBulkDeleteSelected() {
            await executeBulkDeleteSelected();
        }

        async function executeBulkDeleteSelected() {
            if (selectedBulkAppointments.length === 0) {
                alert('Selecione pelo menos um agendamento para excluir!');
                closeBulkDeleteConfirmModal();
                return;
            }

            const appointmentIdsToDelete = [...selectedBulkAppointments];
            const serverAppointmentIds = appointmentIdsToDelete
                .map(id => Number(id))
                .filter(id => !Number.isNaN(id) && id > 0);

            let serverSuccess = false;
            let serverError = null;

            if (serverAppointmentIds.length > 0) {
                const headers = { 'Content-Type': 'application/json' };
                if (currentUser && currentUser.username && currentUser.password) {
                    headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                }

                try {
                    const response = await fetch('http://127.0.0.1:5000/api/agendamentos/bulk-delete', {
                        method: 'DELETE',
                        headers,
                        body: JSON.stringify({
                            appointmentIds: serverAppointmentIds
                        })
                    });

                    const data = await response.json();
                    if (data && data.success) {
                        debugLog('[executeBulkDeleteSelected] Agendamentos excluidos no servidor:', data.deleted);
                        serverSuccess = true;
                    } else {
                        serverError = data?.error || 'Erro desconhecido';
                        console.warn('[executeBulkDeleteSelected] Falha ao excluir no servidor:', data);
                    }
                } catch (err) {
                    serverError = err.message;
                    console.warn('[executeBulkDeleteSelected] Erro de rede ao excluir em massa:', err);
                }
            }

            if (serverAppointmentIds.length > 0 && !serverSuccess) {
                alert(`Nao foi possivel excluir no banco de dados:\n${serverError || 'Erro desconhecido'}`);
                return;
            }

            appointments = appointments.filter(apt => !appointmentIdsToDelete.includes(String(apt.id)));
            localStorage.setItem('appointments', JSON.stringify(appointments));
            
            refreshActiveScheduleViews();
            
            const deletedCount = appointmentIdsToDelete.length;
            selectedBulkAppointments = [];
            filterBulkAppointments();
            closeBulkDeleteConfirmModal();
            closeModal('bulkCancelModal');
            if (serverSuccess) {
                await fetchAppointmentsFromServer();
                showSuccessMessage(`Excluidos ${deletedCount} agendamentos no sistema e no banco de dados!`);
                return;
            }
            
            showSuccessMessage(`${deletedCount} agendamentos excluidos com sucesso!`);
        }

        async function deleteBulkSelected() {
            if (selectedBulkAppointments.length === 0) {
                alert('⚠️ Selecione pelo menos um agendamento para excluir!');
                return;
            }
            
            if (confirm(`🗑️ CONFIRMAR EXCLUSÃO EM LOTE\n\nSerão excluídos ${selectedBulkAppointments.length} agendamentos selecionados.\n\n⚠️ Esta ação não pode ser desfeita!\n\nDeseja continuar?`)) {
                const appointmentIdsToDelete = [...selectedBulkAppointments];
                const serverAppointmentIds = appointmentIdsToDelete
                    .map(id => Number(id))
                    .filter(id => !Number.isNaN(id) && id > 0);

                let serverSuccess = false;
                let serverError = null;

                if (serverAppointmentIds.length > 0) {
                    const headers = { 'Content-Type': 'application/json' };
                    if (currentUser && currentUser.username && currentUser.password) {
                        headers['Authorization'] = `Bearer ${currentUser.username}:${currentUser.password}`;
                    }

                    try {
                        const response = await fetch('http://127.0.0.1:5000/api/agendamentos/bulk-delete', {
                            method: 'DELETE',
                            headers,
                            body: JSON.stringify({
                                appointmentIds: serverAppointmentIds
                            })
                        });

                        const data = await response.json();
                        if (data && data.success) {
                            debugLog('[deleteBulkSelected] Agendamentos excluidos no servidor:', data.deleted);
                            serverSuccess = true;
                        } else {
                            serverError = data?.error || 'Erro desconhecido';
                            console.warn('[deleteBulkSelected] Falha ao excluir no servidor:', data);
                        }
                    } catch (err) {
                        serverError = err.message;
                        console.warn('[deleteBulkSelected] Erro de rede ao excluir em massa:', err);
                    }
                }

                if (serverAppointmentIds.length > 0 && !serverSuccess) {
                    alert(`âš ï¸ Nao foi possivel excluir no banco de dados:\n${serverError || 'Erro desconhecido'}`);
                    return;
                }

                appointments = appointments.filter(apt => !appointmentIdsToDelete.includes(String(apt.id)));
                localStorage.setItem('appointments', JSON.stringify(appointments));
                
                refreshActiveScheduleViews();
                
                // Clear selections and refresh
                const deletedCount = appointmentIdsToDelete.length;
                selectedBulkAppointments = [];
                filterBulkAppointments();
                closeModal('bulkCancelModal');
                if (serverSuccess) {
                    await fetchAppointmentsFromServer();
                    showSuccessMessage(`Excluidos ${deletedCount} agendamentos no sistema e no banco de dados!`);
                    return;
                }
                
                showSuccessMessage(`🗑️ ${deletedCount} agendamentos excluídos com sucesso!`);
            }
        }

        // Absence Replacement Functions
        let currentAbsenceAnalysis = null;
        let selectedAbsenceReplacements = [];

        function analyzeAbsenceReplacement() {
            const absentProfId = document.getElementById('absentProfessional').value;
            const absenceDateInput = document.getElementById('absenceDay').value;
            
            if (!absentProfId || !absenceDateInput) {
                document.getElementById('absenceAnalysis').classList.add('hidden');
                return;
            }

            // Convert date input to show day name for display only
            const [year, month, day] = absenceDateInput.split("-");
            const absenceDate = new Date(year, month - 1, day);
            const absenceDayIndex = absenceDate.getDay();

            const absentProf = professionals.find(p => p.id === absentProfId);
            const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
            const selectedDayName = dayNames[absenceDayIndex];
            
            // Find appointments for this professional on this EXACT DATE (not day of week)
            const absentAppointments = appointments.filter(apt => {
                if (apt.professionalId !== absentProfId) return false;
                
                // Compare full date as string - this is the source of truth
                return apt.date === absenceDateInput;
            });
            
            if (absentAppointments.length === 0) {
                document.getElementById('absenceResults').innerHTML = `
                    <div class="bg-green-100 p-3 rounded-lg text-green-800">
                        ✅ O profissional <strong>${absentProf.name}</strong> não possui agendamentos em <strong>${selectedDayName}, ${day}/${month}/${year}</strong>.
                    </div>
                `;
                document.getElementById('absenceAnalysis').classList.remove('hidden');
                return;
            }

            // Analyze each appointment and find replacements by priority
            const replacementOptions = [];
            
            absentAppointments.forEach(apt => {
                const options = findReplacementsByPriority(apt, absenceDateInput);
                replacementOptions.push({
                    appointment: apt,
                    options: options
                });
            });

            // Display analysis results
            let analysisHtml = `
                <div class="mb-4">
                    <h6 class="font-bold text-gray-800 mb-2">👨‍⚕️ Profissional Ausente: ${absentProf.name} (${absentProf.specialty})</h6>
                    <div class="text-sm text-gray-600">Dia da semana: <strong>${selectedDayName}</strong></div>
                    <div class="text-sm text-gray-600">Agendamentos afetados: <strong>${absentAppointments.length}</strong></div>
                </div>
                <div class="space-y-4">
            `;

            replacementOptions.forEach((item, index) => {
                const apt = item.appointment;
                const options = item.options;
                
                analysisHtml += `
                    <div class="border rounded-lg p-3 ${options.length > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
                        <div class="flex items-center justify-between mb-3">
                            <div class="cursor-pointer hover:bg-blue-100 p-2 rounded transition-colors" onclick="showTimeSlotOptions(${index})">
                                <span class="font-medium text-blue-600 underline">${apt.time} - ${apt.clientName}</span>
                                <span class="ml-2 px-2 py-1 rounded text-xs ${getAppointmentColor(apt.type)}">${getTypeLabel(apt.type)}</span>
                                <span class="ml-2 text-xs text-blue-500">👆 Clique para ver opções</span>
                            </div>
                            <div class="text-sm ${options.length > 0 ? 'text-green-600' : 'text-red-600'}">
                                ${options.length > 0 ? `${options.length} opções encontradas` : 'Nenhuma opção disponível'}
                            </div>
                        </div>
                `;

                if (options.length > 0) {
                    analysisHtml += `<div class="space-y-2">`;
                    
                    // Show top 3 options by priority
                    options.slice(0, 3).forEach((option, optIndex) => {
                        const priorityIcon = getPriorityIcon(option.priority);
                        const priorityLabel = getPriorityLabel(option.priority);
                        
                        analysisHtml += `
                            <div class="flex items-center justify-between bg-white p-2 rounded border">
                                <div class="flex items-center space-x-2">
                                    <span class="text-lg">${priorityIcon}</span>
                                    <span class="font-medium">${option.professional.name}</span>
                                    <span class="text-sm text-gray-600">(${option.professional.specialty})</span>
                                </div>
                                <div class="text-xs">
                                    <span class="px-2 py-1 rounded ${getPriorityColor(option.priority)}">${priorityLabel}</span>
                                    ${option.currentActivity ? `<span class="ml-1 text-gray-500">• ${getTypeLabel(option.currentActivity)}</span>` : ''}
                                </div>
                            </div>
                        `;
                    });
                    
                    if (options.length > 3) {
                        analysisHtml += `<div class="text-xs text-gray-500 text-center cursor-pointer hover:text-blue-600" onclick="showTimeSlotOptions(${index})">+ ${options.length - 3} outras opções disponíveis - Clique para ver todas</div>`;
                    }
                    
                    analysisHtml += `</div>`;
                } else {
                    analysisHtml += `
                        <div class="text-sm text-red-600 bg-white p-2 rounded border border-red-200">
                            ⚠️ Nenhum profissional disponível ou compatível encontrado para este horário
                        </div>
                    `;
                }
                
                analysisHtml += `</div>`;
            });

            analysisHtml += '</div>';
            
            document.getElementById('absenceResults').innerHTML = analysisHtml;
            document.getElementById('absenceAnalysis').classList.remove('hidden');
            
            // Store analysis for later use
            currentAbsenceAnalysis = {
                absentProfId: absentProfId,
                absentProf: absentProf,
                absenceDay: absenceDay,
                selectedDayName: selectedDayName,
                appointments: absentAppointments,
                replacementOptions: replacementOptions
            };
        }

        function findReplacementsByPriority(appointment, absenceDate) {
            const options = [];
            
            // Get all professionals except the absent one
            const availableProfessionals = professionals.filter(p => p.id !== appointment.professionalId);
            
            availableProfessionals.forEach(prof => {
                // Check if professional is compatible with appointment type
                if (!checkProfessionalCompatibility(prof, appointment.type)) {
                    return; // Skip incompatible professionals
                }
                
                // Find appointments for this professional on the same DATE and time (not just day of week)
                const currentAppointments = appointments.filter(apt => {
                    if (apt.professionalId !== prof.id || apt.time !== appointment.time) return false;
                    
                    // Compare full date - this is the source of truth
                    return apt.date === absenceDate;
                });
                
                let priority = 5; // Default: completely free
                let currentActivity = null;
                let currentAppointment = null;
                
                if (currentAppointments.length > 0) {
                    // Use the first appointment found (they should all be the same time/day pattern)
                    currentAppointment = currentAppointments[0];
                    currentActivity = currentAppointment.type;
                    
                    // Set priority based on current activity (lower number = higher priority)
                    switch (currentAppointment.type) {
                        case 'cls':
                            priority = 1; // Highest priority
                            break;
                        case 'analise':
                            priority = 2;
                            break;
                        case 'supervisao':
                            priority = 3;
                            break;
                        case 'discussao':
                            priority = 4;
                            break;
                        case 'bloqueado':
                            return; // Skip blocked slots
                        default:
                            return; // Skip other types (clinica, etc.) as they can't be easily moved
                    }
                }
                
                options.push({
                    professional: prof,
                    priority: priority,
                    currentActivity: currentActivity,
                    currentAppointment: currentAppointment,
                    affectedAppointments: currentAppointments // All appointments that would be affected
                });
            });
            
            // Sort by priority (lower number = higher priority)
            options.sort((a, b) => a.priority - b.priority);
            
            return options;
        }

        function getPriorityIcon(priority) {
            const icons = {
                1: '🥇', // CLS
                2: '🥈', // Análise
                3: '🥉', // Supervisão
                4: '🏅', // Discussão
                5: '📋'  // Livre
            };
            return icons[priority] || '📋';
        }

        function getPriorityLabel(priority) {
            const labels = {
                1: '1ª Prioridade (CLS)',
                2: '2ª Prioridade (Análise)',
                3: '3ª Prioridade (Supervisão)',
                4: '4ª Prioridade (Discussão)',
                5: 'Horário Livre'
            };
            return labels[priority] || 'Horário Livre';
        }

        function getPriorityColor(priority) {
            const colors = {
                1: 'bg-green-100 text-green-800',
                2: 'bg-blue-100 text-blue-800',
                3: 'bg-yellow-100 text-yellow-800',
                4: 'bg-orange-100 text-orange-800',
                5: 'bg-gray-100 text-gray-800'
            };
            return colors[priority] || 'bg-gray-100 text-gray-800';
        }

        function executeAbsenceReplacement() {
            if (!currentAbsenceAnalysis) {
                alert('⚠️ Nenhuma análise de falta disponível!');
                return;
            }

            // Auto-select best options (priority 1-3 only)
            const autoReplacements = [];
            
            currentAbsenceAnalysis.replacementOptions.forEach(item => {
                const bestOption = item.options.find(opt => opt.priority <= 3);
                if (bestOption) {
                    autoReplacements.push({
                        appointment: item.appointment,
                        replacement: bestOption
                    });
                }
            });

            if (autoReplacements.length === 0) {
                alert('⚠️ Não há substituições automáticas disponíveis. Use "Ver Todas as Opções" para escolher manualmente.');
                return;
            }

            const confirmMessage = `🚨 SUBSTITUIÇÃO DE EMERGÊNCIA\n\n` +
                `Profissional ausente: ${currentAbsenceAnalysis.absentProf.name}\n` +
                `Dia: ${currentAbsenceAnalysis.selectedDayName}\n\n` +
                `Serão aplicadas ${autoReplacements.length} substituições automáticas (apenas prioridades altas).\n\n` +
                `⚠️ Esta ação não pode ser desfeita!\n\nDeseja continuar?`;

            if (confirm(confirmMessage)) {
                let replacedCount = 0;
                let canceledCount = 0;
                
                // Make a deep copy to avoid reference issues
                const updatedAppointments = JSON.parse(JSON.stringify(appointments));
                
                autoReplacements.forEach(replacement => {
                    // Update the absent professional's appointment
                    const aptIndex = updatedAppointments.findIndex(a => a.id === replacement.appointment.id);
                    if (aptIndex !== -1 && replacement.replacement && replacement.replacement.professional) {
                        updatedAppointments[aptIndex].professionalId = replacement.replacement.professional.id;
                        
                        // If replacement professional had appointments, remove them all
                        if (replacement.replacement.affectedAppointments && replacement.replacement.affectedAppointments.length > 0) {
                            replacement.replacement.affectedAppointments.forEach(affectedApt => {
                                const currentIndex = updatedAppointments.findIndex(a => a.id === affectedApt.id);
                                if (currentIndex !== -1) {
                                    updatedAppointments.splice(currentIndex, 1);
                                    canceledCount++;
                                }
                            });
                        }
                        
                        replacedCount++;
                    }
                });

                // Update the global appointments array
                while (appointments.length > 0) {
                    appointments.pop();
                }
                updatedAppointments.forEach(apt => {
                    appointments.push(apt);
                });
                
                localStorage.setItem('appointments', JSON.stringify(appointments));
                
                // Close the smart rescheduling modal
                closeModal('smartReschedulingModal');
                
                // Reload the UI
                refreshActiveScheduleViews();
                
                // Clear analysis
                currentAbsenceAnalysis = null;
                document.getElementById('absentProfessional').value = '';
                document.getElementById('absenceDay').value = '';
                document.getElementById('absenceAnalysis').classList.add('hidden');
                
                let message = `🚨 Substituição de emergência concluída! ${replacedCount} agendamentos foram transferidos.`;
                if (canceledCount > 0) {
                    message += `\n🗑️ ${canceledCount} agendamentos conflitantes foram cancelados.`;
                }
                
                showSuccessMessage(message);
            }
        }

        function showAbsenceOptions() {
            if (!currentAbsenceAnalysis) {
                alert('⚠️ Nenhuma análise de falta disponível!');
                return;
            }

            const { absentProf, absenceDate, replacementOptions } = currentAbsenceAnalysis;
            
            // Set header
            document.getElementById('absenceOptionsHeader').innerHTML = `
                👨‍⚕️ Profissional Ausente: ${absentProf.name} | 📅 Dia: ${currentAbsenceAnalysis.selectedDayName}
            `;
            
            // Generate options content
            let optionsHtml = '';
            selectedAbsenceReplacements = [];
            
            replacementOptions.forEach((item, itemIndex) => {
                const apt = item.appointment;
                const options = item.options;
                
                optionsHtml += `
                    <div class="bg-white border rounded-lg p-4">
                        <div class="flex items-center justify-between mb-4 pb-3 border-b">
                            <div>
                                <span class="font-bold text-lg">${apt.time} - ${apt.clientName}</span>
                                <span class="ml-3 px-3 py-1 rounded ${getAppointmentColor(apt.type)}">${getTypeLabel(apt.type)}</span>
                            </div>
                            <div class="text-sm text-gray-600">
                                ${options.length} opções disponíveis
                            </div>
                        </div>
                `;
                
                if (options.length > 0) {
                    optionsHtml += `<div class="space-y-2">`;
                    
                    options.forEach((option, optIndex) => {
                        const optionId = `absence_${itemIndex}_${optIndex}`;
                        const priorityIcon = getPriorityIcon(option.priority);
                        const priorityLabel = getPriorityLabel(option.priority);
                        const isRecommended = option.priority <= 3;
                        
                        optionsHtml += `
                            <label class="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-gray-50 ${isRecommended ? 'border-green-300 bg-green-50' : 'border-gray-200'}">
                                <div class="flex items-center space-x-3">
                                    <input type="radio" name="absence_${itemIndex}" value="${optionId}" 
                                           onchange="selectAbsenceReplacement('${optionId}', ${itemIndex}, ${optIndex})"
                                           ${isRecommended && optIndex === 0 ? 'checked' : ''}>
                                    <span class="text-xl">${priorityIcon}</span>
                                    <div>
                                        <div class="font-medium">${option.professional.name}</div>
                                        <div class="text-sm text-gray-600">${option.professional.specialty}</div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs px-2 py-1 rounded ${getPriorityColor(option.priority)}">${priorityLabel}</div>
                                    ${option.currentActivity ? `<div class="text-xs text-gray-500 mt-1">Atual: ${getTypeLabel(option.currentActivity)}</div>` : ''}
                                </div>
                            </label>
                        `;
                        
                        // Auto-select first recommended option
                        if (isRecommended && optIndex === 0) {
                            selectedAbsenceReplacements[itemIndex] = {
                                appointment: apt,
                                replacement: option
                            };
                        }
                    });
                    
                    // Option to not replace
                    optionsHtml += `
                        <label class="flex items-center justify-between p-3 border border-red-200 rounded cursor-pointer hover:bg-red-50">
                            <div class="flex items-center space-x-3">
                                <input type="radio" name="absence_${itemIndex}" value="no_replace_${itemIndex}" 
                                       onchange="selectAbsenceReplacement('no_replace_${itemIndex}', ${itemIndex}, -1)">
                                <span class="text-xl">🚫</span>
                                <div>
                                    <div class="font-medium text-red-600">Não substituir</div>
                                    <div class="text-sm text-red-500">Cancelar este agendamento</div>
                                </div>
                            </div>
                        </label>
                    `;
                    
                    optionsHtml += `</div>`;
                } else {
                    optionsHtml += `
                        <div class="text-center py-4 text-red-600">
                            <span class="text-2xl">⚠️</span>
                            <div class="mt-2">Nenhuma opção de substituição disponível</div>
                            <div class="text-sm mt-1">Este agendamento precisará ser cancelado</div>
                        </div>
                    `;
                }
                
                optionsHtml += `</div>`;
            });
            
            document.getElementById('absenceOptionsContent').innerHTML = optionsHtml;
            document.getElementById('absenceOptionsModal').classList.add('active');
        }

        function selectAbsenceReplacement(optionId, itemIndex, optIndex) {
            if (optIndex === -1) {
                // No replacement selected
                selectedAbsenceReplacements[itemIndex] = null;
            } else {
                const item = currentAbsenceAnalysis.replacementOptions[itemIndex];
                selectedAbsenceReplacements[itemIndex] = {
                    appointment: item.appointment,
                    replacement: item.options[optIndex]
                };
            }
        }

        function selectAllAbsenceOptions() {
            if (!currentAbsenceAnalysis) return;
            
            currentAbsenceAnalysis.replacementOptions.forEach((item, index) => {
                if (item.options.length > 0) {
                    const bestOption = item.options[0]; // First option (highest priority)
                    selectedAbsenceReplacements[index] = {
                        appointment: item.appointment,
                        replacement: bestOption
                    };
                    
                    // Update radio button
                    const radio = document.querySelector(`input[name="absence_${index}"][value="absence_${index}_0"]`);
                    if (radio) radio.checked = true;
                }
            });
        }

        function deselectAllAbsenceOptions() {
            selectedAbsenceReplacements = [];
            
            // Clear all radio buttons
            const radios = document.querySelectorAll('#absenceOptionsContent input[type="radio"]');
            radios.forEach(radio => radio.checked = false);
        }

        function applySelectedAbsenceReplacements() {
            const validReplacements = selectedAbsenceReplacements.filter(r => r !== null && r !== undefined);
            
            if (validReplacements.length === 0) {
                alert('⚠️ Selecione pelo menos uma substituição para aplicar!');
                return;
            }

            const confirmMessage = `🚨 APLICAR SUBSTITUIÇÕES SELECIONADAS\n\n` +
                `Serão aplicadas ${validReplacements.length} substituições.\n\n` +
                `⚠️ Esta ação não pode ser desfeita!\n\nDeseja continuar?`;

            if (confirm(confirmMessage)) {
                let replacedCount = 0;
                   let canceledCount = 0;
               
                   // Make a deep copy to avoid reference issues
                   const updatedAppointments = JSON.parse(JSON.stringify(appointments));
                validReplacements.forEach(replacement => {
                    // Update the absent professional's appointment
                       const aptIndex = updatedAppointments.findIndex(a => a.id === replacement.appointment.id);
                       if (aptIndex !== -1 && replacement.replacement && replacement.replacement.professional) {
                           updatedAppointments[aptIndex].professionalId = replacement.replacement.professional.id;
                        
                        // If replacement professional had appointments, remove them all
                        if (replacement.replacement.affectedAppointments && replacement.replacement.affectedAppointments.length > 0) {
                            replacement.replacement.affectedAppointments.forEach(affectedApt => {
                                   const currentIndex = updatedAppointments.findIndex(a => a.id === affectedApt.id);
                                if (currentIndex !== -1) {
                                       updatedAppointments.splice(currentIndex, 1);
                                       canceledCount++;
                                }
                            });
                        }
                        
                        replacedCount++;
                    }
                });

                // Handle appointments that were not replaced (cancel them)
                const canceledAppointments = currentAbsenceAnalysis.appointments.filter(apt => 
                    !validReplacements.some(r => r.appointment.id === apt.id)
                );
                
                canceledAppointments.forEach(apt => {
                       const index = updatedAppointments.findIndex(a => a.id === apt.id);
                    if (index !== -1) {
                           updatedAppointments.splice(index, 1);
                           canceledCount++;
                    }
                });

                   // Update the global appointments array
                   while (appointments.length > 0) {
                       appointments.pop();
                   }
                   updatedAppointments.forEach(apt => {
                       appointments.push(apt);
                   });
               
                localStorage.setItem('appointments', JSON.stringify(appointments));
                
                   // Close both modals
                   closeModal('absenceOptionsModal');
                   closeModal('smartReschedulingModal');
               
                   // Reload the UI
                   refreshActiveScheduleViews();
                
                // Clear analysis
                currentAbsenceAnalysis = null;
                selectedAbsenceReplacements = [];
                document.getElementById('absentProfessional').value = '';
                document.getElementById('absenceDay').value = '';
                document.getElementById('absenceAnalysis').classList.add('hidden');
                
                let message = `✅ ${replacedCount} substituições aplicadas com sucesso!`;
                if (canceledCount > 0) {
                    message += `\n🗑️ ${canceledCount} agendamentos foram cancelados.`;
                }
                
                showSuccessMessage(message);
            }
        }

        // Time Slot Options Functions
        function showTimeSlotOptions(itemIndex) {
            if (!currentAbsenceAnalysis || !currentAbsenceAnalysis.replacementOptions[itemIndex]) {
                alert('⚠️ Dados de análise não encontrados!');
                return;
            }

            const item = currentAbsenceAnalysis.replacementOptions[itemIndex];
            const apt = item.appointment;
            const options = item.options;
            const absentProf = currentAbsenceAnalysis.absentProf;
            const selectedDayName = currentAbsenceAnalysis.selectedDayName;

            // Set header
            document.getElementById('timeSlotHeader').innerHTML = `
                🕐 <strong>${apt.time}</strong> - ${apt.clientName} (${getTypeLabel(apt.type)})<br>
                👨‍⚕️ Profissional Ausente: ${absentProf.name} | 📅 Dia: ${selectedDayName}
            `;

            // Generate options content
            let optionsHtml = '';

            if (options.length === 0) {
                optionsHtml = `
                    <div class="text-center py-8 text-red-600">
                        <span class="text-4xl">⚠️</span>
                        <div class="mt-3 text-lg font-medium">Nenhuma opção de substituição disponível</div>
                        <div class="text-sm mt-2">Este agendamento precisará ser cancelado ou reagendado manualmente</div>
                    </div>
                `;
            } else {
                optionsHtml = options.map((option, optIndex) => {
                    const priorityIcon = getPriorityIcon(option.priority);
                    const priorityLabel = getPriorityLabel(option.priority);
                    const isRecommended = option.priority <= 3;
                    
                    return `
                        <div class="border rounded-lg p-4 hover:shadow-md transition-shadow ${isRecommended ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center space-x-3">
                                    <span class="text-2xl">${priorityIcon}</span>
                                    <div>
                                        <div class="font-bold text-lg">${option.professional.name}</div>
                                        <div class="text-sm text-gray-600">${option.professional.specialty}</div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="px-3 py-1 rounded text-sm font-medium ${getPriorityColor(option.priority)}">${priorityLabel}</div>
                                    ${isRecommended ? '<div class="text-xs text-green-600 mt-1">✅ Recomendado</div>' : ''}
                                </div>
                            </div>
                            
                            ${option.currentActivity ? `
                                <div class="mb-3 bg-yellow-50 p-3 rounded border border-yellow-200">
                                    <div class="font-medium text-yellow-800 mb-1">📋 Agendamento Atual do Substituto:</div>
                                    <div class="text-sm text-yellow-700">
                                        ${option.currentAppointment ? option.currentAppointment.clientName : 'Paciente não identificado'} - ${getTypeLabel(option.currentActivity)}
                                    </div>
                                    <div class="text-xs text-yellow-600 mt-1">
                                        ⚠️ Este agendamento será ${option.currentActivity === 'cls' || option.currentActivity === 'analise' || option.currentActivity === 'supervisao' || option.currentActivity === 'discussao' ? 'cancelado' : 'transferido'}
                                    </div>
                                </div>
                            ` : `
                                <div class="mb-3 bg-green-50 p-3 rounded border border-green-200">
                                    <div class="text-sm text-green-700">
                                        ✅ <strong>Horário completamente livre</strong> - Nenhum conflito
                                    </div>
                                </div>
                            `}
                            
                            <div class="flex gap-2">
                                <button onclick="executeTimeSlotReplacement(${itemIndex}, ${optIndex})" 
                                        class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors">
                                    🔄 Executar Substituição
                                </button>
                                ${option.currentActivity ? `
                                    <button onclick="showReplacementDetails(${itemIndex}, ${optIndex})" 
                                            class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm transition-colors">
                                        👁️ Detalhes
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }

            document.getElementById('timeSlotOptionsContent').innerHTML = optionsHtml;
            document.getElementById('timeSlotOptionsModal').classList.add('active');
        }

        function executeTimeSlotReplacement(itemIndex, optionIndex) {
            if (!currentAbsenceAnalysis || !currentAbsenceAnalysis.replacementOptions[itemIndex]) {
                alert('⚠️ Dados de análise não encontrados!');
                return;
            }

            const item = currentAbsenceAnalysis.replacementOptions[itemIndex];
            const apt = item.appointment;
            const option = item.options[optionIndex];
            const absentProf = currentAbsenceAnalysis.absentProf;

            // Prepare confirmation message
            let confirmMessage = `🔄 CONFIRMAR SUBSTITUIÇÃO\n\n`;
            confirmMessage += `📅 Horário: ${apt.time}\n`;
            confirmMessage += `👨‍⚕️ Saindo: ${absentProf.name}\n`;
            confirmMessage += `👨‍⚕️ Entrando: ${option.professional.name}\n\n`;
            confirmMessage += `📋 Agendamento: ${apt.clientName} (${getTypeLabel(apt.type)})\n\n`;

            if (option.currentActivity) {
                confirmMessage += `⚠️ ATENÇÃO: ${option.professional.name} possui agendamento neste horário:\n`;
                confirmMessage += `• ${option.currentAppointment ? option.currentAppointment.clientName : 'Paciente'} (${getTypeLabel(option.currentActivity)})\n`;
                confirmMessage += `• Este agendamento será CANCELADO\n\n`;
            } else {
                confirmMessage += `✅ ${option.professional.name} está livre neste horário\n\n`;
            }

            confirmMessage += `⚠️ Esta ação não pode ser desfeita!\n\nDeseja continuar?`;

            if (confirm(confirmMessage)) {
                // Execute the replacement
               // Make a deep copy to avoid reference issues
               const updatedAppointments = JSON.parse(JSON.stringify(appointments));
               let canceledCount = 0;
               
               const aptIndex = updatedAppointments.findIndex(a => a.id === apt.id);
               if (aptIndex !== -1 && option && option.professional) {
                   // Update the absent professional's appointment to the new professional
                   updatedAppointments[aptIndex].professionalId = option.professional.id;
                    
                    // Remove conflicting appointments from the replacement professional
                    if (option.affectedAppointments && option.affectedAppointments.length > 0) {
                        option.affectedAppointments.forEach(affectedApt => {
                           const currentIndex = updatedAppointments.findIndex(a => a.id === affectedApt.id);
                            if (currentIndex !== -1) {
                               updatedAppointments.splice(currentIndex, 1);
                               canceledCount++;
                            }
                        });
                    }

                   // Update the global appointments array
                   while (appointments.length > 0) {
                       appointments.pop();
                   }
                   updatedAppointments.forEach(apt => {
                       appointments.push(apt);
                   });
                   
                    // Save changes
                    localStorage.setItem('appointments', JSON.stringify(appointments));
                    
                    closeModal('timeSlotOptionsModal');
                   closeModal('smartReschedulingModal');
                   
                   // Reload the UI
                   refreshActiveScheduleViews();
                    
                    let successMessage = `✅ Substituição executada com sucesso!\n\n`;
                    successMessage += `${apt.clientName} agora será atendido por ${option.professional.name}`;
                    
                    if (option.currentActivity) {
                        successMessage += `\n\n🗑️ O agendamento conflitante foi cancelado`;
                    }
                    
                    showSuccessMessage(successMessage);
                    
                   // Clear and reset analysis
                   currentAbsenceAnalysis = null;
                   selectedAbsenceReplacements = [];
                   document.getElementById('absentProfessional').value = '';
                   document.getElementById('absenceDay').value = '';
                   document.getElementById('absenceAnalysis').classList.add('hidden');
                } else {
                    alert('❌ Erro: Agendamento não encontrado!');
                }
            }
        }

        function showReplacementDetails(itemIndex, optionIndex) {
            if (!currentAbsenceAnalysis || !currentAbsenceAnalysis.replacementOptions[itemIndex]) {
                return;
            }

            const item = currentAbsenceAnalysis.replacementOptions[itemIndex];
            const option = item.options[optionIndex];
            
            let details = `📋 DETALHES DA SUBSTITUIÇÃO\n\n`;
            details += `👨‍⚕️ Profissional: ${option.professional.name}\n`;
            details += `🏥 Especialidade: ${option.professional.specialty}\n`;
            details += `🏆 Prioridade: ${getPriorityLabel(option.priority)}\n\n`;
            
            if (option.currentActivity) {
                details += `📅 Agendamento Atual:\n`;
                details += `• Paciente: ${option.currentAppointment ? option.currentAppointment.clientName : 'N/A'}\n`;
                details += `• Tipo: ${getTypeLabel(option.currentActivity)}\n`;
                details += `• Ação: Este agendamento será cancelado\n\n`;
                
                if (option.affectedAppointments && option.affectedAppointments.length > 1) {
                    details += `⚠️ Outros agendamentos afetados: ${option.affectedAppointments.length - 1}\n`;
                }
            } else {
                details += `✅ Profissional está completamente livre neste horário\n`;
            }
            
            details += `\n💡 Esta substituição é ${option.priority <= 3 ? 'RECOMENDADA' : 'possível, mas não prioritária'}`;
            
            alert(details);
        }

        // Hidden System Reset Functions
        function trackResetSequence(buttonType) {
            // Only allow admins to activate reset sequence
            if (!currentUser || currentUser.level !== 'admin') {
                return;
            }
            
            // Clear any existing timeout
            if (resetSequenceTimeout) {
                clearTimeout(resetSequenceTimeout);
            }
            
            // Add button to sequence
            resetSequence.push(buttonType);
            
            // Keep only the last 5 clicks
            if (resetSequence.length > 5) {
                resetSequence.shift();
            }
            
            // Check if sequence matches target
            if (resetSequence.length === 5 && 
                JSON.stringify(resetSequence) === JSON.stringify(resetSequenceTarget)) {
                
                // Show hidden reset button
                const resetButton = document.getElementById('hiddenResetButton');
                resetButton.style.display = 'inline-block';
                resetButton.classList.add('animate-pulse');
                
                // Add visual feedback
                resetButton.style.animation = 'pulse 1s infinite';
                
                // Auto-hide after 10 seconds
                setTimeout(() => {
                    resetButton.style.display = 'none';
                    resetButton.classList.remove('animate-pulse');
                    resetSequence = [];
                }, 10000);
                
                // Show subtle notification
                showResetActivatedMessage();
            }
            
            // Reset sequence after 5 seconds of inactivity
            resetSequenceTimeout = setTimeout(() => {
                resetSequence = [];
            }, 5000);
        }

        function showResetActivatedMessage() {
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 left-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
            notification.innerHTML = '🔥 MODO ADMINISTRADOR: Botão de Reset Total ativado por 10 segundos';
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }

        function executeSystemReset() {
            if (!checkPermission('systemReset')) {
                showPermissionDenied('systemReset');
                return;
            }
            
            const confirmMessage = `🔥 ATENÇÃO: FORMATAÇÃO COMPLETA DO SISTEMA\n\n` +
                `Esta ação irá FORMATAR COMPLETAMENTE o programa:\n\n` +
                `💥 EXCLUSÃO TOTAL E PERMANENTE:\n` +
                `• TODOS os profissionais (${professionals.length} cadastrados)\n` +
                `• TODOS os agendamentos (${appointments.length} registros)\n` +
                `• TODAS as planilhas importadas\n` +
                `• TODOS os dados salvos no navegador\n` +
                `• TODAS as configurações e filtros\n` +
                `• TODO o histórico de ações\n` +
                `• TODOS os dados de login salvos\n\n` +
                `🔄 RESTAURAÇÃO:\n` +
                `• Sistema volta ao estado inicial (zero dados)\n` +
                `• Como se fosse a primeira vez usando\n` +
                `• Nenhum dado será recuperável\n` +
                `• Todas as importações serão perdidas\n\n` +
                `⚠️ ESTA AÇÃO É IRREVERSÍVEL E PERMANENTE!\n` +
                `⚠️ NÃO HÁ COMO DESFAZER ESTA OPERAÇÃO!\n` +
                `⚠️ APENAS ADMINISTRADORES PODEM EXECUTAR!\n\n` +
                `Digite exatamente "CONFIRMAR RESET" para continuar:`;

            const userInput = prompt(confirmMessage);
            
            if (userInput === "CONFIRMAR RESET") {
                const finalConfirm = confirm(`🚨 ÚLTIMA CONFIRMAÇÃO - FORMATAÇÃO TOTAL\n\n` +
                    `Você está prestes a FORMATAR COMPLETAMENTE o sistema!\n\n` +
                    `📊 Dados que serão PERDIDOS PARA SEMPRE:\n` +
                    `• ${professionals.length} profissionais cadastrados\n` +
                    `• ${appointments.length} agendamentos salvos\n` +
                    `• Todas as importações realizadas\n` +
                    `• Todo o histórico de trabalho\n\n` +
                    `💀 ESTA É SUA ÚLTIMA CHANCE DE CANCELAR!\n\n` +
                    `Tem ABSOLUTA CERTEZA que deseja FORMATAR TUDO?`);
                
                if (finalConfirm) {
                    // Show formatting progress
                    const formatNotification = document.createElement('div');
                    formatNotification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-800 text-white px-8 py-6 rounded-lg shadow-2xl z-50 text-center';
                    formatNotification.innerHTML = `
                        <div class="text-4xl mb-3">🔥</div>
                        <div class="text-xl font-bold mb-2">FORMATANDO SISTEMA...</div>
                        <div class="text-sm">Apagando todos os dados...</div>
                        <div class="animate-pulse text-xs mt-2">Por favor aguarde...</div>
                    `;
                    document.body.appendChild(formatNotification);
                    
                    // Simulate formatting delay for dramatic effect
                    setTimeout(() => {
                        // COMPLETE SYSTEM WIPE - Clear ALL possible data
                        
                        // 1. Clear localStorage completely
                        localStorage.clear();
                        
                        // 2. Clear sessionStorage as well
                        sessionStorage.clear();
                        
                        // 3. Reset ALL global variables to initial state
                        professionals = [];
                        appointments = [];
                        selectedProfessional = '';
                        currentWeek = new Date();
                        currentView = 'home';
                        
                        // 4. Clear all analysis data and imported data
                        currentAbsenceAnalysis = null;
                        currentReplacementAnalysis = null;
                        selectedAbsenceReplacements = [];
                        selectedBulkAppointments = [];
                        filteredBulkAppointments = [];
                        conflictResolutions = [];
                        selectedResolutions = {};
                        importPreviewData = null;
                        selectedFile = null;
                        
                        // 4.1. Clear any cached or temporary data
                        if (window.importedData) delete window.importedData;
                        if (window.exportedData) delete window.exportedData;
                        
                        // 5. Reset sequence tracking
                        resetSequence = [];
                        if (resetSequenceTimeout) {
                            clearTimeout(resetSequenceTimeout);
                            resetSequenceTimeout = null;
                        }
                        
                        // 6. Clear all form inputs
                        const allInputs = document.querySelectorAll('input, select, textarea');
                        allInputs.forEach(input => {
                            if (input.type === 'checkbox' || input.type === 'radio') {
                                input.checked = false;
                            } else {
                                input.value = '';
                            }
                        });
                        
                        // 7. Close all modals
                        const allModals = document.querySelectorAll('.modal');
                        allModals.forEach(modal => {
                            modal.classList.remove('active');
                        });
                        
                        // 8. Hide reset button
                        document.getElementById('hiddenResetButton').style.display = 'none';
                        
                        // 9. Clear all dynamic content
                        document.getElementById('scheduleGrid').innerHTML = '';
                        document.getElementById('weeklyScheduleGrid').innerHTML = '';
                        document.getElementById('professionalsList').innerHTML = '';
                        document.getElementById('reportsContent').innerHTML = '';
                        document.getElementById('bulkAppointmentsList').innerHTML = '';
                        
                        // 10. Reset all filters and searches
                        document.getElementById('professionalFilter').innerHTML = '<option value="">Todos os Profissionais</option>';
                        document.getElementById('weeklyProfessionalFilter').innerHTML = '<option value="">Todos os Profissionais</option>';
                        document.getElementById('appointmentProfessional').innerHTML = '<option value="">Selecione o profissional...</option>';
                        document.getElementById('mainProfessionalSearch').value = '';
                        document.getElementById('professionalSearch').value = '';
                        
                        // 11. Hide selected professional info
                        document.getElementById('selectedProfessionalInfo').classList.add('hidden');
                        document.getElementById('weeklyEmptyState').classList.remove('hidden');
                        
                        // 12. Reset bulk edit filters
                        clearBulkFilters();
                        
                        // 13. Force reload all UI components
                        updateProfessionalFilter();
                        updateWeeklyProfessionalFilter();
                        refreshActiveScheduleViews();
                        
                        // Remove formatting notification
                        if (formatNotification.parentNode) {
                            formatNotification.parentNode.removeChild(formatNotification);
                        }
                        
                        // Show dramatic success message
                        const successNotification = document.createElement('div');
                        successNotification.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-600 text-white px-10 py-8 rounded-lg shadow-2xl z-50 text-center max-w-md';
                        successNotification.innerHTML = `
                            <div class="text-6xl mb-4">✅</div>
                            <div class="text-2xl font-bold mb-3">SISTEMA FORMATADO!</div>
                            <div class="text-sm mb-2">🔥 Formatação completa realizada com sucesso</div>
                            <div class="text-sm mb-2">💾 Todos os dados foram permanentemente removidos</div>
                            <div class="text-sm mb-4">🆕 Sistema restaurado ao estado inicial</div>
                            <div class="text-xs bg-green-700 px-3 py-2 rounded">
                                O programa está agora como se fosse a primeira vez sendo usado
                            </div>
                        `;
                        
                        document.body.appendChild(successNotification);
                        
                        // Auto-remove success notification after 8 seconds
                        setTimeout(() => {
                            if (successNotification.parentNode) {
                                successNotification.parentNode.removeChild(successNotification);
                            }
                        }, 8000);
                        
                        // Force return to home view (clean state)
                        showHomeView();
                        
                        // Optional: Force page reload for complete reset (uncomment if needed)
                        // setTimeout(() => {
                        //     window.location.reload();
                        // }, 3000);
                        
                    }, 2000); // 2 second delay for dramatic effect
                    
                } else {
                    alert('❌ Formatação cancelada pelo usuário');
                }
            } else {
                alert('❌ Texto de confirmação incorreto. Formatação cancelada por segurança.\n\nVocê deve digitar exatamente: CONFIRMAR RESET');
            }
            
            // Hide reset button after use (regardless of outcome)
            document.getElementById('hiddenResetButton').style.display = 'none';
            resetSequence = [];
        }

        // Clear All Data Function
        function clearAllData() {
            // Enforce permission: only users with systemReset permission (admins) can perform this
            if (!checkPermission('systemReset')) {
                showPermissionDenied('systemReset');
                return;
            }
            const confirmMessage = `🗑️ LIMPAR TODOS OS DADOS\n\nDeseja apagar tudo?\n\n⚠️ Esta ação irá remover:\n• Todos os profissionais cadastrados (${professionals.length})\n• Todos os agendamentos (${appointments.length})\n• Todas as configurações\n• Todos os dados importados\n\n⚠️ Esta ação não pode ser desfeita!\n\nTem certeza?`;
            
            if (confirm(confirmMessage)) {
                // Clear all data
                professionals = [];
                appointments = [];
                selectedProfessional = '';
                currentWeek = new Date();
                currentView = 'home';
                
                // Clear localStorage
                localStorage.removeItem('professionals');
                localStorage.removeItem('appointments');
                
                // Clear all analysis data
                currentAbsenceAnalysis = null;
                currentReplacementAnalysis = null;
                selectedAbsenceReplacements = [];
                selectedBulkAppointments = [];
                filteredBulkAppointments = [];
                conflictResolutions = [];
                selectedResolutions = {};
                importPreviewData = null;
                selectedFile = null;
                
                // Clear all form inputs
                const allInputs = document.querySelectorAll('input, select, textarea');
                allInputs.forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else {
                        input.value = '';
                    }
                });
                
                // Close all modals
                const allModals = document.querySelectorAll('.modal');
                allModals.forEach(modal => {
                    modal.classList.remove('active');
                });
                
                // Clear all dynamic content
                document.getElementById('scheduleGrid').innerHTML = '';
                document.getElementById('weeklyScheduleGrid').innerHTML = '';
                document.getElementById('professionalsList').innerHTML = '';
                document.getElementById('reportsContent').innerHTML = '';
                document.getElementById('bulkAppointmentsList').innerHTML = '';
                
                // Reset all filters
                document.getElementById('professionalFilter').innerHTML = '<option value="">Todos os Profissionais</option>';
                document.getElementById('weeklyProfessionalFilter').innerHTML = '<option value="">Todos os Profissionais</option>';
                document.getElementById('appointmentProfessional').innerHTML = '<option value="">Selecione o profissional...</option>';
                document.getElementById('mainProfessionalSearch').value = '';
                document.getElementById('professionalSearch').value = '';
                
                // Hide selected professional info
                document.getElementById('selectedProfessionalInfo').classList.add('hidden');
                document.getElementById('weeklyEmptyState').classList.remove('hidden');
                
                // Reset bulk edit filters
                clearBulkFilters();
                
                // Update UI
                updateProfessionalFilter();
                updateWeeklyProfessionalFilter();
                refreshActiveScheduleViews();
                
                // Show success message
                showSuccessMessage('🗑️ Todos os dados foram apagados com sucesso! Sistema limpo.');
                
                // Return to home view
                showHomeView();
            }
        }

        // Close modals when clicking outside, but keep the login modal locked until successful login
        document.addEventListener('click', function(event) {
            if (event.target.classList.contains('modal') && event.target.id !== 'loginModal') {
                event.target.classList.remove('active');
            }
        });
        if (window.pywebview) {
    window.pywebview.api.ping()
        .then(res => debugLog("PYTHON RESPONDEU:", res))
        .catch(err => console.error("ERRO PYTHON:", err));
} else {
    debugLog("pywebview ainda não carregou");
}

async function criarProfissional() {
    const nome = document.getElementById("nomeProfissional").value;
    const especialidades = typeof collectProfessionalSpecialties === 'function'
        ? collectProfessionalSpecialties()
        : [document.getElementById("especialidade").value].filter(Boolean);
    const especialidade = especialidades.join('; ');
    const dataNascimento = document.getElementById("dataNascimentoProfissional").value;

    const res = await fetch("/api/profissionais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nome,
            especialidade,
            especialidades,
            data_nascimento: dataNascimento
        })
    });

    const data = await res.json();

    if (data && data.success) {
        alert("Profissional cadastrado!");
        carregarProfissionais();
        // Also refresh local cache
        fetchProfessionalsFromServer();
    } else {
        alert("Erro ao salvar profissional: " + (data && data.error ? data.error : 'Resposta inválida'));
    }
}
async function carregarProfissionais() {
    const res = await fetch("/api/profissionais");
    const data = await res.json();

    const select = document.getElementById("listaProfissionais");
    select.innerHTML = "";

    let lista = [];
    if (data) {
        if (Array.isArray(data)) lista = data;
        else if (data.success && Array.isArray(data.profissionais)) lista = data.profissionais;
        else if (data.profissionais && Array.isArray(data.profissionais)) lista = data.profissionais;
    }

    lista.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        const nascimento = p.data_nascimento ? ` - ${formatarData(p.data_nascimento)}` : '';
        option.textContent = `${p.nome || p.name} (${p.especialidade || p.specialty})${nascimento}`;
        select.appendChild(option);
    });
}
// ===========================
// SINCRONIZAÇÃO COM SUPABASE
// ===========================

function openSyncModal() {
    // Atualizar contadores
    document.getElementById('supaSyncProfCount').textContent = professionals.length || 0;
    document.getElementById('supaSyncAptCount').textContent = appointments.length || 0;
    document.getElementById('supaSyncUserCount').textContent = Object.keys(users).length || 0;
    document.getElementById('supaSyncStatus').textContent = 'Aguardando';
    document.getElementById('supaSyncStatus').className = 'text-xl font-bold text-purple-600';
    
    // Resetar progresso
    document.getElementById('supaSyncProgress').classList.add('hidden');
    document.getElementById('supaSyncLog').innerHTML = '';
    document.getElementById('supaSyncProgressBar').style.width = '0%';
    
    document.getElementById('supabaseSyncModal').classList.add('active');
}

function addSyncLog(message) {
    const logDiv = document.getElementById('supaSyncLog');
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const logEntry = document.createElement('div');
    logEntry.className = 'text-xs text-gray-700';
    logEntry.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> ${message}`;
    logDiv.appendChild(logEntry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

function updateSyncProgress(percent, label) {
    document.getElementById('supaSyncProgressBar').style.width = percent + '%';
    document.getElementById('supaSyncProgressPercent').textContent = Math.round(percent) + '%';
    if (label) {
        document.getElementById('supaSyncProgressLabel').textContent = label;
    }
}

async function startSupabaseSyncWithAllData() {
    const syncProfessionals = document.getElementById('syncProfessionals').checked;
    const syncAppointments = document.getElementById('syncAppointments').checked;
    const syncUsers = document.getElementById('syncUsers').checked;

    if (!syncProfessionals && !syncAppointments && !syncUsers) {
        showErrorMessage('❌ Selecione pelo menos um tipo de dado para sincronizar!');
        return;
    }

    // Mostrar progresso
    document.getElementById('supaSyncProgress').classList.remove('hidden');
    document.getElementById('startSupaSyncBtn').disabled = true;
    document.getElementById('closeSupaSyncBtn').disabled = true;
    document.getElementById('supaSyncStatus').textContent = 'Sincronizando...';
    document.getElementById('supaSyncStatus').className = 'text-xl font-bold text-blue-600';
    document.getElementById('supaSyncLog').innerHTML = '';

    try {
        let totalItems = 0;
        let processedItems = 0;

        if (syncProfessionals) totalItems += professionals.length;
        if (syncAppointments) totalItems += appointments.length;
        if (syncUsers) totalItems += Object.keys(users).length;

        if (totalItems === 0) {
            showErrorMessage('❌ Nenhum dado para sincronizar!');
            document.getElementById('startSupaSyncBtn').disabled = false;
            document.getElementById('closeSupaSyncBtn').disabled = false;
            return;
        }

        // Preparar dados
        const syncData = {};

        if (syncProfessionals) {
            addSyncLog('📊 Preparando ' + professionals.length + ' profissionais...');
            syncData.professionals = professionals;
            processedItems += professionals.length;
            updateSyncProgress((processedItems / totalItems) * 100, 'Profissionais preparados');
        }

        if (syncAppointments) {
            addSyncLog('📅 Preparando ' + appointments.length + ' agendamentos...');
            syncData.appointments = appointments;
            processedItems += appointments.length;
            updateSyncProgress((processedItems / totalItems) * 100, 'Agendamentos preparados');
        }

        if (syncUsers) {
            addSyncLog('👥 Preparando ' + Object.keys(users).length + ' usuários...');
            syncData.users = users;
            processedItems += Object.keys(users).length;
            updateSyncProgress((processedItems / totalItems) * 100, 'Usuários preparados');
        }

        // Enviar para sincronização
        addSyncLog('☁️ Enviando para Supabase...');
        updateSyncProgress(70, 'Enviando dados');

        const response = await fetch('http://127.0.0.1:5000/api/sync/supabase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(syncData)
        });

        const result = await response.json();

        if (result.success) {
            addSyncLog('✅ Sincronização concluída com sucesso!');
            document.getElementById('supaSyncStatus').textContent = 'Concluído!';
            document.getElementById('supaSyncStatus').className = 'text-xl font-bold text-green-600';
            updateSyncProgress(100, 'Sincronização Completa');

            // Adicionar resumo
            if (result.summary) {
                addSyncLog('📊 Resumo: ' + JSON.stringify(result.summary));
            }

            showSuccessMessage('✅ Dados sincronizados com sucesso com a nuvem!');

            // Fechar modal após 2 segundos
            setTimeout(() => {
                closeModal('supabaseSyncModal');
                document.getElementById('startSupaSyncBtn').disabled = false;
                document.getElementById('closeSupaSyncBtn').disabled = false;
            }, 2000);
        } else {
            addSyncLog('❌ Erro: ' + (result.error || 'Erro desconhecido'));
            document.getElementById('supaSyncStatus').textContent = 'Erro!';
            document.getElementById('supaSyncStatus').className = 'text-xl font-bold text-red-600';
            showErrorMessage('❌ Erro na sincronização: ' + (result.error || 'Tente novamente'));
            document.getElementById('startSupaSyncBtn').disabled = false;
            document.getElementById('closeSupaSyncBtn').disabled = false;
        }
    } catch (error) {
        console.error('Erro na sincronização:', error);
        addSyncLog('❌ Erro: ' + error.message);
        document.getElementById('supaSyncStatus').textContent = 'Erro!';
        document.getElementById('supaSyncStatus').className = 'text-xl font-bold text-red-600';
        showErrorMessage('❌ Erro na sincronização: ' + error.message);
        document.getElementById('startSupaSyncBtn').disabled = false;
        document.getElementById('closeSupaSyncBtn').disabled = false;
    }
}

function resetPatientForm() {
    editingPatientId = null;
    document.getElementById('nomePaciente').value = '';
    document.getElementById('telefone').value = '';
    document.getElementById('dataNascimento').value = '';
    document.getElementById('endereco').value = '';
    document.getElementById('nomeMae').value = '';
    document.getElementById('nomePai').value = '';
    document.getElementById('convenio').value = '';
    const title = document.getElementById('patientModalTitle');
    const saveButton = document.getElementById('patientSaveButton');
    if (title) title.textContent = 'Cadastrar Paciente';
    if (saveButton) saveButton.textContent = 'Salvar';
}

function openEditPatientModal(patientId) {
    if (!checkPermission('edit') || currentUser.level !== 'admin') {
        showPermissionDenied('edit');
        return;
    }

    const patient = (patientListCache || []).find(p => String(p.id) === String(patientId));
    if (!patient) {
        alert('Paciente não encontrado para edição. Atualize a lista e tente novamente.');
        return;
    }

    editingPatientId = patient.id;
    document.getElementById('nomePaciente').value = patient.nome || '';
    document.getElementById('telefone').value = patient.telefone || patient.phone || '';
    document.getElementById('dataNascimento').value = patient.data_nascimento || '';
    document.getElementById('endereco').value = patient.endereco || '';
    document.getElementById('nomeMae').value = patient.nome_mae || '';
    document.getElementById('nomePai').value = patient.nome_pai || '';
    document.getElementById('convenio').value = patient.convenio || '';

    const title = document.getElementById('patientModalTitle');
    const saveButton = document.getElementById('patientSaveButton');
    if (title) title.textContent = 'Editar Paciente';
    if (saveButton) saveButton.textContent = 'Salvar Alterações';

    closeModal('patientListModal');
    document.getElementById('patientModal').classList.add('active');
}

// ===============================
// SALVAR PACIENTE NO SUPABASE
// ===============================
async function salvarPaciente() {
    const nome = document.getElementById("nomePaciente").value;
    const nascimento = document.getElementById("dataNascimento").value;
    const endereco = document.getElementById("endereco").value;
    const telefone = document.getElementById("telefone").value;
    const mae = document.getElementById("nomeMae").value;
    const pai = document.getElementById("nomePai").value;
    const convenio = document.getElementById("convenio").value;

    const payload = {
        nome: nome,
        telefone: telefone || null,
        data_nascimento: nascimento,
        endereco: endereco,
        nome_mae: mae,
        nome_pai: pai,
        convenio: convenio
    };

    const endpoint = editingPatientId ? `http://127.0.0.1:5000/api/pacientes/${editingPatientId}` : "http://127.0.0.1:5000/api/pacientes";
    const method = editingPatientId ? 'PUT' : 'POST';

    try {
        const res = await fetch(endpoint, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success) {
            alert(editingPatientId ? "✅ Paciente atualizado com sucesso!" : "✅ Paciente salvo com sucesso!");
            closeModal('patientModal');
            resetPatientForm();
            loadPatientList();
        } else {
            alert("❌ Erro ao salvar paciente");
            console.error(data.error);
        }

    } catch (erro) {
        console.error("Erro na requisição:", erro);
        alert("Erro de conexão com o servidor");
    }
}

async function togglePatientStatus(patientId, activate) {
    if (!currentUser || currentUser.level !== 'admin') {
        if (typeof showPermissionDenied === 'function') {
            showPermissionDenied('edit');
        }
        return;
    }

    const action = activate ? 'ativar' : 'inativar';
    if (!confirm(`Deseja ${action} este paciente?`)) {
        return;
    }

    try {
        const res = await fetch(`http://127.0.0.1:5000/api/pacientes/${patientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ativo: activate })
        });
        const data = await res.json();
        if (data.success) {
            alert(`✅ Paciente ${activate ? 'ativado' : 'inativado'} com sucesso!`);
            loadPatientList();
        } else {
            alert(`❌ Erro ao ${action} paciente: ${data.error || 'Erro desconhecido'}`);
        }
    } catch (error) {
        console.error('Erro ao atualizar status do paciente:', error);
        alert('Erro de conexão ao tentar atualizar o paciente.');
    }
}

async function deletePatient(patientId) {
    if (!currentUser || currentUser.level !== 'admin') {
        if (typeof showPermissionDenied === 'function') {
            showPermissionDenied('delete');
        }
        return;
    }

    if (!confirm('Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const res = await fetch(`http://127.0.0.1:5000/api/pacientes/${patientId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ Paciente excluído com sucesso!');
            loadPatientList();
        } else {
            alert(`❌ Erro ao excluir paciente: ${data.error || 'Erro desconhecido'}`);
        }
    } catch (error) {
        console.error('Erro ao excluir paciente:', error);
        alert('Erro de conexão ao tentar excluir o paciente.');
    }
}

// Week Navigation Functions
function previousWeek() {
    debugLog('[previousWeek] Function called successfully');
    debugLog('[previousWeek] Called, currentWeek before:', currentWeek, 'selectedProfessional:', selectedProfessional);
    currentWeek = new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    setMiniCalendarMonthFromCurrentWeek();
    debugLog('[previousWeek] currentWeek after:', currentWeek);
    refreshActiveScheduleViews();
}

function nextWeek() {
    debugLog('[nextWeek] Function called successfully');
    debugLog('[nextWeek] Called, currentWeek before:', currentWeek, 'selectedProfessional:', selectedProfessional);
    currentWeek = new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
    setMiniCalendarMonthFromCurrentWeek();
    debugLog('[nextWeek] currentWeek after:', currentWeek);
    refreshActiveScheduleViews();
}

function goToCurrentWeek() {
    currentWeek = new Date();
    setMiniCalendarMonthFromCurrentWeek();
    refreshActiveScheduleViews();
}

window.applyAgendaFilters = applyAgendaFilters;
window.clearAgendaFilters = clearAgendaFilters;

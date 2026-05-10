(function () {
    "use strict";

    const PROFESSIONAL_STATUS_UPDATE_ALLOWED = new Set(["finalizado", "cancelado_profissional", "faltou"]);
    const DEFAULT_LOCAL_API_BASE = "http://127.0.0.1:5000";
    const STATUS_LABELS = {
        agendado: "Agendado",
        pre_atendimento: "Pre atendimento",
        confirmado: "Confirmado",
        chegou: "Chegou",
        em_atendimento: "Em atendimento",
        finalizado: "Finalizado",
        cancelado_profissional: "Cancelado pelo profissional",
        cancelado_paciente: "Cancelado pelo paciente",
        faltou: "Faltou"
    };

    const state = {
        user: null,
        professionals: [],
        appointments: [],
        remarks: [],
        selectedAppointment: null,
        canAuthorizeRemarks: false,
        agendaMode: "day",
        agendaRange: null,
        lastAgendaUpdatedAt: null,
        apiBase: getInitialApiBase(),
        authHeader: sessionStorage.getItem("mobileAuthHeader") || ""
    };

    const els = {};

    document.addEventListener("DOMContentLoaded", () => {
        cacheElements();
        wireEvents();
        setDefaultDate();
        syncApiConfigUi();
        if (needsApiSetup()) {
            showLogin();
            openApiConfig("Configure a API para continuar.");
            setLoginMessage("Configure a conexao antes de entrar.", true);
            return;
        }
        restoreSession();
    });

    function cacheElements() {
        [
            "loginView", "appView", "loginForm", "loginMessage", "usernameInput", "passwordInput",
            "logoutButton", "userSummary", "agendaDateInput", "professionalFilter",
            "agendaStatusFilter", "refreshAgendaButton", "previousDayButton", "todayAgendaButton", "weekAgendaButton",
            "nextDayButton", "agendaRangeLabel", "agendaLastUpdated", "agendaSummary", "agendaList", "remarkStatusFilter",
            "refreshRemarksButton", "remarkList", "agendaTab", "remarquesTab",
            "appointmentSheet", "sheetTime", "sheetPatient", "sheetMeta", "sheetStatus",
            "remarkForm", "remarkDateInput", "remarkStartInput", "remarkEndInput",
            "remarkReasonInput", "sheetMessage", "apiConfigToggle", "appApiConfigButton",
            "apiConfigSheet", "apiConfigForm", "apiBaseInput", "saveApiBaseButton",
            "testApiBaseButton", "apiConfigMessage", "apiConfigSummary", "clearMobileCacheButton",
            "mobileCacheMessage"
        ].forEach((id) => {
            els[id] = document.getElementById(id);
        });
    }

    function wireEvents() {
        els.loginForm.addEventListener("submit", handleLogin);
        els.logoutButton.addEventListener("click", handleLogout);
        els.refreshAgendaButton.addEventListener("click", () => loadAgenda({ force: true }));
        els.refreshRemarksButton.addEventListener("click", () => loadRemarks({ force: true }));
        els.previousDayButton.addEventListener("click", () => moveAgendaDay(-1));
        els.todayAgendaButton.addEventListener("click", showTodayAgenda);
        els.weekAgendaButton.addEventListener("click", showCurrentWeekAgenda);
        els.nextDayButton.addEventListener("click", () => moveAgendaDay(1));
        els.agendaDateInput.addEventListener("change", () => {
            state.agendaMode = "day";
            loadAgenda({ force: true });
        });
        els.professionalFilter.addEventListener("change", () => loadAgenda({ force: true }));
        els.agendaStatusFilter.addEventListener("change", renderAgenda);
        els.remarkStatusFilter.addEventListener("change", renderRemarks);
        els.remarkForm.addEventListener("submit", handleRemarkSubmit);
        els.apiConfigToggle.addEventListener("click", () => openApiConfig());
        els.appApiConfigButton.addEventListener("click", () => openApiConfig());
        els.apiConfigForm.addEventListener("submit", handleApiConfigSave);
        els.testApiBaseButton.addEventListener("click", handleApiConfigTest);
        els.clearMobileCacheButton.addEventListener("click", clearMobileCache);

        document.querySelectorAll("[data-tab]").forEach((button) => {
            button.addEventListener("click", () => showTab(button.dataset.tab));
        });

        document.querySelectorAll("[data-close-api-config]").forEach((node) => {
            node.addEventListener("click", closeApiConfig);
        });

        document.querySelectorAll("[data-close-sheet]").forEach((node) => {
            node.addEventListener("click", closeSheet);
        });

        document.querySelectorAll("[data-status-action]").forEach((button) => {
            button.addEventListener("click", () => handleStatusUpdate(button.dataset.statusAction, button));
        });
    }

    function getInitialApiBase() {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get("api");
        if (fromQuery) {
            try {
                const normalized = normalizeApiBase(fromQuery, { allowBlank: true });
                persistApiBase(normalized);
                return normalized;
            } catch (err) {
                return "";
            }
        }
        try {
            const explicitApiBase = window.MOBILE_API_BASE_URL || "";
            if (explicitApiBase) {
                return normalizeApiBase(explicitApiBase, { allowBlank: true });
            }
            if (isWebServerOrigin()) {
                localStorage.removeItem("mobileApiBase");
                return "";
            }
            return normalizeApiBase(localStorage.getItem("mobileApiBase") || getDefaultApiBase(), { allowBlank: true });
        } catch (err) {
            localStorage.removeItem("mobileApiBase");
            return getDefaultApiBase();
        }
    }

    function getDefaultApiBase() {
        return isWebServerOrigin() ? "" : DEFAULT_LOCAL_API_BASE;
    }

    function normalizeApiBase(value, options = {}) {
        const allowBlank = options.allowBlank !== false;
        const trimmed = String(value || "").trim().replace(/\/+$/, "");
        if (!trimmed) {
            if (allowBlank) return "";
            throw new Error("Informe o endereco da API.");
        }
        if (!/^https?:\/\//i.test(trimmed)) {
            throw new Error("Use um endereco iniciado por http:// ou https://.");
        }
        return trimmed;
    }

    function persistApiBase(value) {
        if (value) {
            localStorage.setItem("mobileApiBase", value);
            return;
        }
        localStorage.removeItem("mobileApiBase");
    }

    function isWebServerOrigin() {
        return window.location.protocol === "http:" || window.location.protocol === "https:";
    }

    function needsApiSetup() {
        return !state.apiBase && !isWebServerOrigin();
    }

    function shouldShowApiConnectionFields() {
        return needsApiSetup() || !isWebServerOrigin() || !!state.apiBase;
    }

    function syncApiConfigUi() {
        const showApiFields = shouldShowApiConnectionFields();
        if (els.apiConfigForm) {
            els.apiConfigForm.classList.toggle("hidden", !showApiFields);
        }
        if (els.apiBaseInput) {
            els.apiBaseInput.value = state.apiBase;
        }
        if (els.apiConfigSummary) {
            els.apiConfigSummary.textContent = showApiFields
                ? (state.apiBase || "Mesmo servidor")
                : "";
        }
    }

    function openApiConfig(message) {
        syncApiConfigUi();
        setApiConfigMessage(message || "");
        els.apiConfigSheet.classList.remove("hidden");
        if (shouldShowApiConnectionFields()) {
            setTimeout(() => els.apiBaseInput.focus(), 0);
        }
    }

    function closeApiConfig() {
        els.apiConfigSheet.classList.add("hidden");
        setApiConfigMessage("");
    }

    function clearMobileAuth() {
        state.authHeader = "";
        sessionStorage.removeItem("mobileAuthHeader");
    }

    function handleApiConfigSave(event) {
        event.preventDefault();
        try {
            const nextApiBase = normalizeApiBase(els.apiBaseInput.value, { allowBlank: isWebServerOrigin() });
            if (nextApiBase !== state.apiBase) {
                state.apiBase = nextApiBase;
                persistApiBase(nextApiBase);
                clearMobileAuth();
                state.user = null;
                state.appointments = [];
                state.remarks = [];
                showLogin();
            }
            syncApiConfigUi();
            setLoginMessage("");
            setApiConfigMessage("Conexao salva.", false, true);
            if (!state.user && !needsApiSetup()) {
                restoreSession();
            }
        } catch (err) {
            setApiConfigMessage(err.message || "Nao foi possivel salvar.", true);
        }
    }

    async function handleApiConfigTest() {
        let previousApiBase = state.apiBase;
        try {
            const testApiBase = normalizeApiBase(els.apiBaseInput.value, { allowBlank: isWebServerOrigin() });
            state.apiBase = testApiBase;
            setBusy(els.testApiBaseButton, true);
            setApiConfigMessage("Testando conexao...");
            await apiFetch("/api/teste", { skipAuth: true });
            setApiConfigMessage("API respondendo.", false, true);
        } catch (err) {
            setApiConfigMessage(err.message || "API nao respondeu.", true);
        } finally {
            state.apiBase = previousApiBase;
            setBusy(els.testApiBaseButton, false);
        }
    }

    async function clearMobileCache() {
        const confirmed = window.confirm("Limpar cache deste celular?\n\nIsso nao apaga profissionais, pacientes ou agendamentos do sistema. Voce precisara entrar novamente.");
        if (!confirmed) return;

        setBusy(els.clearMobileCacheButton, true);
        setMobileCacheMessage("Limpando cache...");
        try {
            await apiFetch("/api/cache/clear", { method: "POST" }).catch(() => null);
            await apiFetch("/api/logout", { method: "POST", skipAuth: true }).catch(() => null);
            await clearBrowserCacheStorage().catch(() => null);
            expireVisibleCookies();

            const savedApiBase = state.apiBase;
            localStorage.clear();
            sessionStorage.clear();
            if (savedApiBase) {
                localStorage.setItem("mobileApiBase", savedApiBase);
            }

            clearMobileAuth();
            state.user = null;
            state.professionals = [];
            state.appointments = [];
            state.remarks = [];
            state.lastAgendaUpdatedAt = null;
            setMobileCacheMessage("Cache limpo. Recarregando...", false, true);
            setTimeout(reloadWithoutCache, 800);
        } catch (err) {
            setMobileCacheMessage(err.message || "Nao foi possivel limpar o cache.", true);
            setBusy(els.clearMobileCacheButton, false);
        }
    }

    async function clearBrowserCacheStorage() {
        if ("caches" in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }
        if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
        }
    }

    function expireVisibleCookies() {
        document.cookie.split(";").forEach((cookie) => {
            const name = cookie.split("=")[0].trim();
            if (!name) return;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        });
    }

    function reloadWithoutCache() {
        const url = new URL(window.location.href);
        url.searchParams.set("_cache", String(Date.now()));
        window.location.replace(url.toString());
    }

    function setDefaultDate() {
        if (!els.agendaDateInput.value) {
            els.agendaDateInput.value = toDateInputValue(new Date());
        }
    }

    async function restoreSession() {
        if (needsApiSetup()) {
            showLogin();
            setLoginMessage("Configure a conexao antes de entrar.", true);
            return;
        }
        setLoginMessage("Verificando sessao...");
        try {
            const data = await apiFetch("/api/me");
            if (data.success) {
                state.user = data.user;
                await enterApp();
                return;
            }
        } catch (err) {
            showLogin();
        }
        setLoginMessage("");
    }

    async function handleLogin(event) {
        event.preventDefault();
        if (needsApiSetup()) {
            openApiConfig("Configure a API para continuar.");
            setLoginMessage("Configure a conexao antes de entrar.", true);
            return;
        }
        const username = els.usernameInput.value.trim();
        const password = els.passwordInput.value;
        setLoginMessage("Entrando...");
        setBusy(els.loginForm, true);
        try {
            const data = await apiFetch("/api/authenticate", {
                method: "POST",
                skipAuth: true,
                body: {
                    username,
                    password
                }
            });
            if (!data.success) {
                throw new Error(data.error || "Nao foi possivel entrar.");
            }
            state.user = data.user;
            state.authHeader = `Bearer ${username}:${password}`;
            sessionStorage.setItem("mobileAuthHeader", state.authHeader);
            els.passwordInput.value = "";
            await enterApp();
        } catch (err) {
            setLoginMessage(err.message || "Falha no login.", true);
        } finally {
            setBusy(els.loginForm, false);
        }
    }

    async function handleLogout() {
        await apiFetch("/api/logout", { method: "POST", skipAuth: true }).catch(() => null);
        clearMobileAuth();
        state.user = null;
        state.appointments = [];
        state.remarks = [];
        showLogin();
    }

    async function enterApp() {
        showApp();
        els.userSummary.textContent = `${state.user.name || state.user.username} - ${getRoleLabel(state.user.level)}`;
        await loadProfessionals();
        applyUserDefaultProfessional();
        await Promise.all([
            loadAgenda({ force: true }),
            loadRemarks({ force: true })
        ]);
    }

    function showLogin() {
        els.loginView.classList.remove("hidden");
        els.appView.classList.add("hidden");
    }

    function showApp() {
        els.loginView.classList.add("hidden");
        els.appView.classList.remove("hidden");
        setLoginMessage("");
    }

    function showTab(tabName) {
        const isAgenda = tabName === "agenda";
        els.agendaTab.classList.toggle("hidden", !isAgenda);
        els.remarquesTab.classList.toggle("hidden", isAgenda);
        document.querySelectorAll("[data-tab]").forEach((button) => {
            button.classList.toggle("active", button.dataset.tab === tabName);
        });
        if (!isAgenda) {
            loadRemarks({ force: false });
        }
    }

    async function loadProfessionals() {
        try {
            const data = await apiFetch("/api/profissionais?active=1&limit=1000");
            state.professionals = Array.isArray(data.profissionais)
                ? data.profissionais.map(normalizeProfessional)
                : [];
            renderProfessionalFilter();
        } catch (err) {
            state.professionals = [];
            renderProfessionalFilter();
        }
    }

    function renderProfessionalFilter() {
        const selected = els.professionalFilter.value;
        els.professionalFilter.innerHTML = '<option value="">Todos</option>';
        state.professionals
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
            .forEach((professional) => {
                const option = document.createElement("option");
                option.value = professional.id;
                option.textContent = professional.name;
                els.professionalFilter.appendChild(option);
            });
        if ([...els.professionalFilter.options].some((option) => option.value === selected)) {
            els.professionalFilter.value = selected;
        }
    }

    function applyUserDefaultProfessional() {
        const professionalId = String(state.user && (state.user.professionalId || state.user.profissional_id) || "").trim();
        if (professionalId && [...els.professionalFilter.options].some((option) => option.value === professionalId)) {
            els.professionalFilter.value = professionalId;
        }
    }

    async function loadAgenda(options = {}) {
        const date = getSelectedAgendaDateValue();
        state.agendaRange = getAgendaRange(date);
        const params = new URLSearchParams({
            start_date: state.agendaRange.start,
            end_date: state.agendaRange.end,
            limit: state.agendaMode === "week" ? "2000" : "500"
        });
        if (options.force) {
            params.set("force", "1");
        }
        if (els.professionalFilter.value) {
            params.set("professionalId", els.professionalFilter.value);
        }

        renderAgendaLoading();
        try {
            const data = await apiFetch(`/api/agendamentos?${params.toString()}`);
            state.appointments = Array.isArray(data.agendamentos)
                ? data.agendamentos.map(normalizeAppointment).sort(compareAppointments)
                : [];
            state.lastAgendaUpdatedAt = new Date();
            renderAgenda();
        } catch (err) {
            els.agendaList.innerHTML = `<div class="empty-state">${escapeHtml(err.message || "Nao foi possivel carregar a agenda.")}</div>`;
            els.agendaSummary.innerHTML = "";
            updateAgendaModeUi();
        }
    }

    function renderAgendaLoading() {
        updateAgendaModeUi();
        els.agendaSummary.innerHTML = "";
        els.agendaList.innerHTML = '<div class="empty-state">Carregando agenda...</div>';
    }

    function renderAgenda() {
        updateAgendaModeUi();
        updateAgendaLastUpdated();

        const appointments = getFilteredAppointments();
        const activeCount = appointments.filter((apt) => isOpenStatus(apt.status)).length;
        const finishedCount = appointments.filter((apt) => apt.status === "finalizado").length;
        els.agendaSummary.innerHTML = [
            summaryItem(appointments.length, "Total"),
            summaryItem(activeCount, "Em aberto"),
            summaryItem(finishedCount, "Finalizados")
        ].join("");

        if (!appointments.length) {
            const hasStatusFilter = !!els.agendaStatusFilter.value;
            els.agendaList.innerHTML = `<div class="empty-state">${
                hasStatusFilter
                    ? "Nenhum atendimento encontrado para este filtro."
                    : (state.agendaMode === "week" ? "Nenhum atendimento nesta semana." : "Nenhum atendimento para esta data.")
            }</div>`;
            return;
        }

        els.agendaList.innerHTML = "";
        let currentDate = "";
        appointments.forEach((appointment) => {
            if (state.agendaMode === "week" && appointment.date !== currentDate) {
                currentDate = appointment.date;
                const divider = document.createElement("div");
                divider.className = "day-divider";
                divider.textContent = formatWeekdayDate(currentDate);
                els.agendaList.appendChild(divider);
            }

            const card = document.createElement("button");
            card.type = "button";
            card.className = "appointment-card";
            card.innerHTML = `
                <div class="card-topline">
                    <span class="card-time">${escapeHtml(formatAgendaCardTime(appointment))}</span>
                    <span class="status-pill status-${escapeHtml(appointment.status)}">${escapeHtml(getStatusLabel(appointment.status))}</span>
                </div>
                <p class="card-title">${escapeHtml(appointment.patientName || "Paciente")}</p>
                <p class="card-subtitle">${escapeHtml(getProfessionalName(appointment.professionalId))}</p>
                <p class="card-subtitle">${escapeHtml(appointment.type || "Atendimento")}</p>
            `;
            card.addEventListener("click", () => openAppointmentSheet(appointment));
            els.agendaList.appendChild(card);
        });
    }

    function getFilteredAppointments() {
        const statusFilter = els.agendaStatusFilter.value;
        if (!statusFilter) {
            return state.appointments;
        }
        if (statusFilter === "open") {
            return state.appointments.filter((appointment) => isOpenStatus(appointment.status));
        }
        if (statusFilter === "cancelado") {
            return state.appointments.filter((appointment) => ["cancelado_paciente", "cancelado_profissional"].includes(appointment.status));
        }
        return state.appointments.filter((appointment) => appointment.status === statusFilter);
    }

    function isOpenStatus(status) {
        return !["finalizado", "faltou", "cancelado_paciente", "cancelado_profissional"].includes(normalizeStatus(status));
    }

    function updateAgendaLastUpdated() {
        if (!els.agendaLastUpdated) return;
        if (!state.lastAgendaUpdatedAt) {
            els.agendaLastUpdated.textContent = "";
            return;
        }
        els.agendaLastUpdated.textContent = `Atualizado às ${formatClockTime(state.lastAgendaUpdatedAt)}`;
    }

    function getSelectedAgendaDateValue() {
        const date = els.agendaDateInput.value || toDateInputValue(new Date());
        els.agendaDateInput.value = date;
        return date;
    }

    function moveAgendaDay(delta) {
        const next = addDays(parseDateInput(getSelectedAgendaDateValue()), delta);
        state.agendaMode = "day";
        els.agendaDateInput.value = toDateInputValue(next);
        loadAgenda({ force: true });
    }

    function showTodayAgenda() {
        state.agendaMode = "day";
        els.agendaDateInput.value = toDateInputValue(new Date());
        loadAgenda({ force: true });
    }

    function showCurrentWeekAgenda() {
        state.agendaMode = "week";
        els.agendaDateInput.value = toDateInputValue(new Date());
        loadAgenda({ force: true });
    }

    function getAgendaRange(dateValue) {
        if (state.agendaMode !== "week") {
            return {
                start: dateValue,
                end: dateValue,
                label: `Dia ${formatDateBR(dateValue)}`
            };
        }
        const start = startOfWeek(parseDateInput(dateValue));
        const end = addDays(start, 6);
        const startValue = toDateInputValue(start);
        const endValue = toDateInputValue(end);
        return {
            start: startValue,
            end: endValue,
            label: `Semana atual: ${formatDateBR(startValue)} a ${formatDateBR(endValue)}`
        };
    }

    function updateAgendaModeUi() {
        const range = state.agendaRange || getAgendaRange(getSelectedAgendaDateValue());
        els.agendaRangeLabel.textContent = range.label;
        const today = toDateInputValue(new Date());
        const isToday = state.agendaMode === "day" && els.agendaDateInput.value === today;
        els.todayAgendaButton.classList.toggle("active", isToday);
        els.weekAgendaButton.classList.toggle("active", state.agendaMode === "week");
        els.weekAgendaButton.setAttribute("aria-pressed", state.agendaMode === "week" ? "true" : "false");
    }

    async function loadRemarks(options = {}) {
        const params = new URLSearchParams();
        if (options.force) {
            params.set("force", "1");
        }
        const suffix = params.toString() ? `?${params.toString()}` : "";
        if (!state.remarks.length) {
            els.remarkList.innerHTML = '<div class="empty-state">Carregando remarques...</div>';
        }
        try {
            const data = await apiFetch(`/api/remarques${suffix}`);
            state.remarks = Array.isArray(data.remarques)
                ? data.remarques.map(normalizeRemark)
                : [];
            state.canAuthorizeRemarks = !!data.can_authorize;
            renderRemarks();
        } catch (err) {
            els.remarkList.innerHTML = `<div class="empty-state">${escapeHtml(err.message || "Nao foi possivel carregar remarques.")}</div>`;
        }
    }

    function renderRemarks() {
        const filter = els.remarkStatusFilter.value;
        const remarks = state.remarks
            .filter((remark) => !filter || remark.status === filter)
            .sort((a, b) => String(b.requestedAt || "").localeCompare(String(a.requestedAt || "")));

        if (!remarks.length) {
            els.remarkList.innerHTML = '<div class="empty-state">Nenhuma solicitacao encontrada.</div>';
            return;
        }

        els.remarkList.innerHTML = "";
        remarks.forEach((remark) => {
            const card = document.createElement("article");
            card.className = "remark-card";
            const actions = state.canAuthorizeRemarks && remark.status === "pendente"
                ? `<div class="action-grid">
                    <button class="primary-button" type="button" data-remark-action="approve" data-remark-id="${escapeHtml(remark.id)}">Aprovar</button>
                    <button class="danger-button" type="button" data-remark-action="reject" data-remark-id="${escapeHtml(remark.id)}">Reprovar</button>
                </div>`
                : "";
            card.innerHTML = `
                <div class="card-topline">
                    <span class="status-pill">${escapeHtml(getRemarkStatusLabel(remark.status))}</span>
                    <span class="card-subtitle">${escapeHtml(formatDateBR(remark.requestedAt))}</span>
                </div>
                <p class="card-title">${escapeHtml(remark.patientName || `Agendamento ${remark.appointmentId}`)}</p>
                <p class="card-subtitle">Atual: ${escapeHtml(formatDateBR(remark.originalDate))} ${escapeHtml(formatTime(remark.originalTime))} - ${escapeHtml(formatTime(remark.originalEndTime))}</p>
                <p class="card-subtitle">Novo: ${escapeHtml(formatDateBR(remark.newDate))} ${escapeHtml(formatTime(remark.newTime))} - ${escapeHtml(formatTime(remark.newEndTime))}</p>
                ${remark.reason ? `<p class="card-subtitle">${escapeHtml(remark.reason)}</p>` : ""}
                ${actions}
            `;
            card.querySelectorAll("[data-remark-action]").forEach((button) => {
                button.addEventListener("click", () => handleRemarkDecision(button.dataset.remarkId, button.dataset.remarkAction, button));
            });
            els.remarkList.appendChild(card);
        });
    }

    function openAppointmentSheet(appointment) {
        state.selectedAppointment = appointment;
        setSheetMessage("");
        els.sheetTime.textContent = `${formatDateBR(appointment.date)} - ${formatAppointmentTime(appointment)}`;
        els.sheetPatient.textContent = appointment.patientName || "Paciente";
        els.sheetMeta.textContent = `${getProfessionalName(appointment.professionalId)} - ${appointment.type || "Atendimento"}`;
        els.sheetStatus.textContent = getStatusLabel(appointment.status);
        els.sheetStatus.className = `status-pill status-${appointment.status}`;
        els.remarkDateInput.value = appointment.date || els.agendaDateInput.value || toDateInputValue(new Date());
        els.remarkStartInput.value = appointment.time || "";
        els.remarkEndInput.value = appointment.endTime || suggestEndTime(appointment.time);
        els.remarkReasonInput.value = "";
        updateStatusActionButtons(appointment);
        els.appointmentSheet.classList.remove("hidden");
    }

    function closeSheet() {
        els.appointmentSheet.classList.add("hidden");
        state.selectedAppointment = null;
    }

    function updateStatusActionButtons(appointment) {
        document.querySelectorAll("[data-status-action]").forEach((button) => {
            const status = button.dataset.statusAction;
            button.disabled = !canUpdateAppointmentStatus(status, appointment) || appointment.status === status;
        });
    }

    async function handleStatusUpdate(status, button) {
        const appointment = state.selectedAppointment;
        if (!appointment || !canUpdateAppointmentStatus(status, appointment)) {
            setSheetMessage("Sem permissao para alterar este status.", true);
            return;
        }
        setBusy(button, true);
        setSheetMessage("Atualizando status...");
        try {
            const data = await apiFetch(`/api/agendamentos/${encodeURIComponent(appointment.id)}`, {
                method: "PUT",
                body: {
                    status,
                    ultima_acao: state.user ? (state.user.name || state.user.username) : "Mobile"
                }
            });
            if (!data.success) {
                throw new Error(data.error || "Nao foi possivel atualizar.");
            }
            appointment.status = normalizeStatus(status);
            setSheetMessage("Status atualizado.", false, true);
            await loadAgenda({ force: true });
            const refreshed = state.appointments.find((item) => String(item.id) === String(appointment.id)) || appointment;
            openAppointmentSheet(refreshed);
        } catch (err) {
            setSheetMessage(err.message || "Nao foi possivel atualizar o status.", true);
        } finally {
            setBusy(button, false);
        }
    }

    async function handleRemarkSubmit(event) {
        event.preventDefault();
        const appointment = state.selectedAppointment;
        if (!appointment) {
            return;
        }
        const payload = {
            appointmentId: appointment.id,
            newDate: els.remarkDateInput.value,
            newTime: els.remarkStartInput.value,
            newEndTime: els.remarkEndInput.value,
            reason: els.remarkReasonInput.value.trim()
        };
        if (!payload.newDate || !payload.newTime || !payload.newEndTime) {
            setSheetMessage("Informe nova data, inicio e termino.", true);
            return;
        }
        if (payload.newEndTime <= payload.newTime) {
            setSheetMessage("O termino precisa ser maior que o inicio.", true);
            return;
        }

        setBusy(els.remarkForm, true);
        setSheetMessage("Enviando remarque...");
        try {
            const data = await apiFetch("/api/remarques", {
                method: "POST",
                body: payload
            });
            if (!data.success) {
                throw new Error(data.error || "Nao foi possivel enviar remarque.");
            }
            setSheetMessage("Remarque enviado para aprovacao.", false, true);
            els.remarkReasonInput.value = "";
            await loadRemarks({ force: true });
        } catch (err) {
            setSheetMessage(err.message || "Nao foi possivel enviar remarque.", true);
        } finally {
            setBusy(els.remarkForm, false);
        }
    }

    async function handleRemarkDecision(remarkId, action, button) {
        const isReject = action === "reject";
        let reason = "";
        if (isReject) {
            reason = window.prompt("Informe o motivo da reprovacao:") || "";
            if (!reason.trim()) {
                return;
            }
        }
        setBusy(button, true);
        try {
            const data = await apiFetch(`/api/remarques/${encodeURIComponent(remarkId)}/${action}`, {
                method: "PUT",
                body: isReject ? { reason } : {}
            });
            if (!data.success) {
                throw new Error(data.error || "Nao foi possivel decidir o remarque.");
            }
            await Promise.all([
                loadRemarks({ force: true }),
                loadAgenda({ force: true })
            ]);
        } catch (err) {
            window.alert(err.message || "Nao foi possivel decidir o remarque.");
        } finally {
            setBusy(button, false);
        }
    }

    async function apiFetch(path, options = {}) {
        const headers = Object.assign({ Accept: "application/json" }, options.headers || {});
        if (state.authHeader && !options.skipAuth) {
            headers.Authorization = state.authHeader;
        }
        const init = {
            method: options.method || "GET",
            credentials: state.apiBase ? "omit" : "include",
            headers
        };
        if (options.body !== undefined) {
            init.body = JSON.stringify(options.body);
            init.headers["Content-Type"] = "application/json";
        }

        let response;
        try {
            response = await fetch(buildApiUrl(path), init);
        } catch (err) {
            throw new Error("Nao foi possivel conectar ao servidor. Verifique a internet ou abra Config.");
        }
        let data = null;
        try {
            data = await response.json();
        } catch (err) {
            data = null;
        }
        if (!response.ok) {
            throw new Error((data && data.error) || `Erro HTTP ${response.status}`);
        }
        return data || {};
    }

    function buildApiUrl(path) {
        if (/^https?:\/\//i.test(path)) {
            return path;
        }
        return `${state.apiBase}${path}`;
    }

    function normalizeProfessional(professional) {
        return {
            id: String(professional.id || "").trim(),
            name: professional.nome || professional.name || "Profissional",
            specialty: professional.especialidade || professional.specialty || ""
        };
    }

    function normalizeAppointment(appointment) {
        const professionalId = appointment.professionalId || appointment.profissional_id || appointment.professional_id || appointment.profissional || "";
        return {
            id: String(appointment.id),
            professionalId: String(professionalId || "").trim(),
            patientName: appointment.clientName || appointment.paciente || appointment.patient || "",
            type: appointment.type || appointment.tipo || appointment.tipo_atendimento || "",
            date: normalizeDate(appointment.date || appointment.data || ""),
            time: normalizeTime(appointment.time || appointment.hora_inicio || ""),
            endTime: normalizeTime(appointment.endTime || appointment.hora_fim || ""),
            status: normalizeStatus(appointment.status || "agendado")
        };
    }

    function normalizeRemark(remark) {
        return {
            id: String(remark.id || ""),
            appointmentId: String(remark.appointmentId || remark.agendamento_id || ""),
            originalDate: normalizeDate(remark.originalDate || remark.original_data || ""),
            originalTime: normalizeTime(remark.originalTime || remark.original_hora_inicio || ""),
            originalEndTime: normalizeTime(remark.originalEndTime || remark.original_hora_fim || ""),
            newDate: normalizeDate(remark.newDate || remark.nova_data || ""),
            newTime: normalizeTime(remark.newTime || remark.nova_hora_inicio || ""),
            newEndTime: normalizeTime(remark.newEndTime || remark.nova_hora_fim || ""),
            reason: remark.reason || remark.observacao || "",
            status: String(remark.status || "pendente"),
            requestedAt: remark.requestedAt || remark.solicitado_em || "",
            patientName: remark.patientName || remark.paciente_nome || ""
        };
    }

    function normalizeStatus(status) {
        const raw = String(status || "agendado").trim().toLowerCase().replace(/-/g, "_");
        const key = raw.replace(/\s+/g, "_");
        const aliases = {
            "pre_atendimento": "pre_atendimento",
            "em_atendimento": "em_atendimento",
            "cancelado_pelo_profissional": "cancelado_profissional",
            "cancelado_profissional": "cancelado_profissional",
            "cancelado_pelo_paciente": "cancelado_paciente",
            "cancelado_paciente": "cancelado_paciente"
        };
        return aliases[key] || key || "agendado";
    }

    function normalizeDate(value) {
        if (!value) return "";
        return String(value).split("T")[0];
    }

    function normalizeTime(value) {
        if (!value) return "";
        const text = String(value);
        const match = text.match(/(\d{1,2}):(\d{2})/);
        if (!match) return text;
        return `${match[1].padStart(2, "0")}:${match[2]}`;
    }

    function compareAppointments(a, b) {
        return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    }

    function getProfessionalName(id) {
        const professional = state.professionals.find((item) => String(item.id) === String(id));
        return professional ? professional.name : (id ? `Profissional ${id}` : "Profissional");
    }

    function getStatusLabel(status) {
        return STATUS_LABELS[normalizeStatus(status)] || "Agendado";
    }

    function getRemarkStatusLabel(status) {
        const labels = {
            pendente: "Pendente",
            aprovado: "Aprovado",
            reprovado: "Reprovado"
        };
        return labels[status] || status || "Pendente";
    }

    function hasFullAppointmentStatusAccess() {
        if (!state.user) return false;
        const text = `${state.user.level || ""} ${state.user.name || ""} ${state.user.username || ""}`
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();
        if (state.user.level === "admin" || text.includes("ADMINISTRADOR")) return true;
        if (text.includes("CEO") || text.includes("ATAC") || text.includes("RECEP")) return true;
        const linked = String(state.user.professionalId || state.user.profissional_id || "");
        const professional = state.professionals.find((item) => String(item.id) === linked);
        const specialty = String((professional && professional.specialty) || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase();
        return specialty.includes("ATAC") || specialty.includes("RECEP");
    }

    function userOwnsAppointment(appointment) {
        const linked = String(state.user && (state.user.professionalId || state.user.profissional_id) || "").trim();
        return !!linked && !!appointment && linked === String(appointment.professionalId || "").trim();
    }

    function canUpdateAppointmentStatus(status, appointment) {
        if (hasFullAppointmentStatusAccess()) return true;
        return !!state.user
            && state.user.level === "viewer"
            && userOwnsAppointment(appointment)
            && PROFESSIONAL_STATUS_UPDATE_ALLOWED.has(normalizeStatus(status));
    }

    function summaryItem(value, label) {
        return `<div class="summary-item"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
    }

    function formatAppointmentTime(appointment) {
        const start = formatTime(appointment.time);
        const end = formatTime(appointment.endTime);
        return end ? `${start} - ${end}` : start;
    }

    function formatAgendaCardTime(appointment) {
        const time = formatAppointmentTime(appointment);
        if (state.agendaMode !== "week") return time;
        return `${getWeekdayShort(appointment.date)} ${formatDateShortBR(appointment.date)} - ${time}`;
    }

    function formatTime(value) {
        return normalizeTime(value);
    }

    function formatClockTime(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return "";
        }
        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }

    function formatDateBR(value) {
        const date = normalizeDate(value);
        if (!date) return "";
        const parts = date.split("-");
        if (parts.length !== 3) return date;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function formatDateShortBR(value) {
        const date = normalizeDate(value);
        if (!date) return "";
        const parts = date.split("-");
        if (parts.length !== 3) return date;
        return `${parts[2]}/${parts[1]}`;
    }

    function formatWeekdayDate(value) {
        return `${getWeekdayShort(value)}, ${formatDateBR(value)}`;
    }

    function getWeekdayShort(value) {
        const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
        return labels[parseDateInput(value).getDay()] || "";
    }

    function toDateInputValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function parseDateInput(value) {
        const parts = String(value || "").split("-").map(Number);
        if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
            return new Date();
        }
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function addDays(date, amount) {
        const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        next.setDate(next.getDate() + amount);
        return next;
    }

    function startOfWeek(date) {
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        return addDays(date, diff);
    }

    function suggestEndTime(start) {
        const normalized = normalizeTime(start);
        if (!normalized) return "";
        const parts = normalized.split(":").map(Number);
        const date = new Date(2000, 0, 1, parts[0], parts[1] + 50);
        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }

    function setBusy(target, busy) {
        if (!target) return;
        if (target.tagName === "BUTTON") {
            target.disabled = busy;
            return;
        }
        target.querySelectorAll("button, input, select, textarea").forEach((node) => {
            node.disabled = busy;
        });
    }

    function setLoginMessage(message, isError) {
        els.loginMessage.textContent = message || "";
        els.loginMessage.classList.toggle("error", !!isError);
        els.loginMessage.classList.toggle("success", false);
    }

    function setApiConfigMessage(message, isError, isSuccess) {
        els.apiConfigMessage.textContent = message || "";
        els.apiConfigMessage.classList.toggle("error", !!isError);
        els.apiConfigMessage.classList.toggle("success", !!isSuccess);
    }

    function setMobileCacheMessage(message, isError, isSuccess) {
        els.mobileCacheMessage.textContent = message || "";
        els.mobileCacheMessage.classList.toggle("error", !!isError);
        els.mobileCacheMessage.classList.toggle("success", !!isSuccess);
    }

    function setSheetMessage(message, isError, isSuccess) {
        els.sheetMessage.textContent = message || "";
        els.sheetMessage.classList.toggle("error", !!isError);
        els.sheetMessage.classList.toggle("success", !!isSuccess);
    }

    function getRoleLabel(level) {
        const labels = {
            admin: "Administrador",
            editor: "Editor",
            viewer: "Profissional"
        };
        return labels[level] || level || "Usuario";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();

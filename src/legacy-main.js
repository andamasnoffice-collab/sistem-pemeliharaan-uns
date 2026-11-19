import { createApp } from "vue";
import * as XLSX from "xlsx";
import { getServiceInterval } from "./domain/service-rules.js";
import { mapVehicleRecord, mapDriverRecord, mapServiceLogRecord } from "./domain/record-mappers.js";
import { trackSubscription, disposeSubscriptions } from "./services/subscription-registry.js";
import { dataPath } from "./services/paths.js";
import { createFleetRepository } from "./repositories/fleet-repository.js";
import { createSettingsRepository } from "./repositories/settings-repository.js";
import { appId, db, auth } from "./services/firebase";
import {
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword
} from "firebase/auth";
import { createAuthService } from "./services/auth-service.js";
import { createNotificationTokenRepository } from "./repositories/notification-token-repository.js";
import { createRealtimeReferences } from "./repositories/realtime-references.js";
import {
  ref,
  set,
  remove,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  update
} from "firebase/database";

const fleetRepository = createFleetRepository({
  database: db,
  ref,
  update,
  remove,
  dataPath
});

const settingsRepository = createSettingsRepository({
  database: db,
  ref,
  update,
  dataPath
});

const authService = createAuthService({
  auth,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  sendPasswordResetEmail,
  updatePassword
});

const notificationTokenRepository = createNotificationTokenRepository({
  database: db,
  ref,
  set,
  dataPath
});

function safeGetRawStorage(key, fallback = '') {
            try {
                const item = localStorage.getItem(key);
                return (item !== null && item !== undefined) ? item : fallback;
            } catch (e) {
                return fallback;
            }
        }

        function safeGetStorage(key, fallback = null) {
            try {
                const item = localStorage.getItem(key);
                if (!item || item === 'undefined' || item === 'null') return fallback;
                return JSON.parse(item);
            } catch (e) {
                return fallback;
            }
        }

        function safeSetStorage(key, val) {
            try {
                localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            } catch (e) {
                console.warn('Gagal menyimpan ke localStorage:', e);
            }
        }

        // Konfigurasi DIKUNCI ke project fleet baru.
        // Jangan mengambil __app_id / __firebase_config dari launcher atau host lain,
        // karena file HTML hasil download harus selalu menunjuk ke uns-fleet-service.
        const vueApp = createApp({
            data() {
                return {
                    currentTab: 'dashboard',
                    isAdmin: false,
                    adminEmailInput: safeGetRawStorage('uns_admin_email', ''),
                    adminPasswordInput: '',
                    showAdminPwd: false,
                    showSheetsUrl: false,
                    showGeminiKey: false,
                    showTgToken: false,

                    pwdForm: { currentPwd: '', newPwd: '', confirmPwd: '' },
                    activePasswordModal: false,

                    searchQuery: '',
                    categoryFilter: 'ALL',
                    statusFilter: 'ALL',
                    vehicleSortOption: 'URGENT_FIRST',
                    showHiddenVehicles: false,

                    logVehicleFilter: 'ALL',
                    logWorkshopFilter: 'ALL',
                    logMonthFilter: 'ALL',
                    logYearFilter: 'ALL',
                    logSortOption: 'DATE_DESC',

                    recapYear: 2026,
                    selectedRecapMonth: 1,

                    activeAdminModal: false,
                    activeInServiceModal: false,
                    activeVehicleDrawer: false,
                    activeMasterDataModal: false,
                    activeNewServiceModal: false,
                    activeVehicleModal: false,
                    activeInvoiceModal: false,
                    activeDeleteModal: false,
                    activeMonthDetailModal: false,
                    activeImportModal: false,
                    activeCloudModal: false,
                    activeUpdateKmModal: false,
                    activeSheetsModal: false,
                    activeNotifModal: false,
                    activeDamageNotesModal: false,
                    selectedDamageVehicle: null,
                    damageNoteInput: '',
                    damageReporterInput: '',

                    geminiApiKey: safeGetRawStorage('uns_gemini_api_key', ''),
                    waNumber: safeGetRawStorage('uns_wa_number', '6282294949474'),
                    waGatewayUrl: safeGetRawStorage('uns_wa_gateway_url', ''),
                    telegramBotToken: safeGetRawStorage('uns_telegram_token', ''),
                    telegramChatId: safeGetRawStorage('uns_telegram_chat_id', ''),
                    enableWaNotification: safeGetStorage('uns_enable_wa_notif', true),
                    enableTelegramNotification: safeGetStorage('uns_enable_tg_notif', true),

                    sheetsWebhookUrl: safeGetRawStorage('uns_sheets_webhook_url', ''),
                    autoSyncSheets: safeGetStorage('uns_auto_sync_sheets', true),
                    isSheetsSyncing: false,
                    isAskingGemini: false,
                    geminiAiReasoning: '',

                    selectedDrawerVehicle: null,
                    vehicleToDelete: null,
                    selectedLog: null,
                    editingLogId: null,
                    logToDeleteId: null,
                    deleteType: 'single',

                    selectedLogIds: [],
                    masterDataTab: 'vehicles',

                    cloudStatus: 'loading',
                    cloudErrorMessage: '',
                    firebaseAuthResolved: false,
                    firebaseAuthTimer: null,
                    firebaseAppId: appId,
                    firebaseUserId: '',
                    firebaseAuthProvider: '',
                    firebaseAuthErrorCode: '',
                    firebaseAuthErrorMessage: '',
                    currentUser: null,
                    _realtimeListenersAttached: false,
                    _realtimeUnsubs: [],
                    _settingsUnsub: null,

                    toast: { show: false, message: '', type: 'success' },

                    updateKmForm: { vehicleId: '', currentKm: 0, newKm: 0 },
                    inServiceForm: { vehicleId: '', workshop: '', date: new Date().toISOString().substring(0, 10), km: '', notes: '' },
                    vehicleForm: { id: null, plate: '', model: '', driver: '', category: 'Operasional', currentKm: 0, isUnderService: false, isHidden: false },
                    serviceForm: {
                        vehicleId: '',
                        workshop: 'Nasmoco',
                        date: new Date().toISOString().substring(0, 10),
                        km: 0,
                        invoiceNo: '',
                        isRoutine: true,
                        items: [{ name: 'Servis Berkala & Maintenance', cost: 0 }],
                        replacedComponents: [],
                        invoiceImage: null
                    },

                    quickSparepartSuggestions: [
                        { name: 'Oli Mesin 0W-20 TGO Full Synthetic', cost: 450000 },
                        { name: 'Oli Mesin 5W-30 Synthetic', cost: 400000 },
                        { name: 'Filter Oli Genuine', cost: 85000 },
                        { name: 'Oli Transmisi Matic ATF / CVT', cost: 650000 },
                        { name: 'Aki GS Astra Hybrid / MF Kering', cost: 1150000 },
                        { name: 'Kampas Rem Depan (Brake Pad Genuine)', cost: 450000 },
                        { name: 'Busi Iridium Genuine Set', cost: 450000 },
                        { name: 'Ganti Ban (Bridgestone/Dunlop/GT Radial)', cost: 1100000 },
                        { name: 'Spooring 4 Roda & Balancing Roda', cost: 250000 }
                    ],

                    vehicles: (safeGetStorage('uns_vehicles', []) || []).filter(Boolean),
                    drivers: [],
                    serviceLogs: (safeGetStorage('uns_logs', []) || []).filter(Boolean)
                };
            },

            created() {
                try {
                    // Firebase adalah source-of-truth. LocalStorage hanya cache/offline fallback.
                    this.normalizeDamageNotesAll();
                    this.initFirebase();
                } catch (e) {
                    console.warn("Error inside created hook:", e);
                }
            },

            beforeUnmount() {
                this.disposeRealtimeListeners();
            },

            computed: {
                logsByVehicleId() {
                    const map = {};
                    const logs = (this.serviceLogs || []).filter(Boolean);
                    const vehicles = (this.vehicles || []).filter(Boolean);

                    const parseTime = (dateStr) => {
                        const d = this.parseLocalDate(dateStr);
                        return d ? d.getTime() : 0;
                    };

                    vehicles.forEach(v => {
                        if (v) {
                            if (v.id) map[v.id] = [];
                            if (v.plate && !map[v.plate]) map[v.plate] = [];
                        }
                    });

                    for (let i = 0; i < logs.length; i++) {
                        const l = logs[i];
                        if (!l || !l.vehicleId) continue;
                        
                        const car = vehicles.find(v => v && (v.id === l.vehicleId || v.plate === l.vehicleId));
                        if (car) {
                            if (car.id) {
                                if (!map[car.id]) map[car.id] = [];
                                if (!map[car.id].includes(l)) map[car.id].push(l);
                            }
                            if (car.plate) {
                                if (!map[car.plate]) map[car.plate] = [];
                                if (!map[car.plate].includes(l)) map[car.plate].push(l);
                            }
                        } else {
                            if (!map[l.vehicleId]) map[l.vehicleId] = [];
                            if (!map[l.vehicleId].includes(l)) map[l.vehicleId].push(l);
                        }
                    }

                    for (const key in map) {
                        map[key].sort((a, b) => {
                            const tA = parseTime(a.date);
                            const tB = parseTime(b.date);
                            if (tB !== tA) return tB - tA;

                            const kmA = Number(a.km) || 0;
                            const kmB = Number(b.km) || 0;
                            if (kmB !== kmA) return kmB - kmA;

                            return String(b.id || '').localeCompare(String(a.id || ''));
                        });
                    }
                    return map;
                },

                processedVehicles() {
                    const logsMap = this.logsByVehicleId;
                    const today = new Date();
                    today.setHours(0,0,0,0);

                    return (this.vehicles || []).filter(car => car && this.isVehicleEligibleForService(car)).map(car => {
                        if (!car) return null;

                        const vLogs = logsMap[car.id] || logsMap[car.plate] || [];
                        const routineLogs = vLogs.filter(l => l && this.isRoutineItem(l) && Number(l.km) > 0);

                        let lastServiceKm = 0;
                        let lastServiceDateStr = null;

                        if (routineLogs.length > 0) {
                            lastServiceKm = Number(routineLogs[0].km) || 0;
                            lastServiceDateStr = routineLogs[0].date;
                        } else if (car.lastServiceKm !== undefined && car.lastServiceKm !== null && Number(car.lastServiceKm) > 0) {
                            lastServiceKm = Number(car.lastServiceKm);
                            lastServiceDateStr = car.lastServiceDate || null;
                        } else {
                            lastServiceKm = Number(car.currentKm) || 0;
                            lastServiceDateStr = car.lastServiceDate || null;
                        }

                        // Bengkel penentu interval HARUS mengikuti servis rutin terakhir,
                        // bukan transaksi terakhir secara umum. Perbaikan non-rutin tidak
                        // boleh mengubah interval servis berkala.
                        const lastRoutineLog = routineLogs.length > 0 ? routineLogs[0] : null;
                        const lastWorkshop = (lastRoutineLog && lastRoutineLog.workshop)
                            ? String(lastRoutineLog.workshop).trim()
                            : String(car.targetWorkshop || 'Belum Ada').trim();

                        // ATURAN SERVIS RESMI AUT0MAN:
                        // - Nasmoco = 10.000 KM
                        // - Selain Nasmoco = 7.000 KM
                        const { intervalKm, intervalRule } = getServiceInterval(lastWorkshop);

                        const currentKm = Number(car.currentKm) || 0;
                        const diffKm = Math.max(0, currentKm - lastServiceKm);
                        const remainingKm = intervalKm - (currentKm - lastServiceKm);
                        const kmPercent = Math.min(100, Math.round((diffKm / intervalKm) * 100));

                        let isDateDanger = false, isDateWarning = false, daysRemaining = null, datePercent = 0;
                        let nextServiceDateStr = '-';

                        if (lastServiceDateStr) {
                            const lastD = this.parseLocalDate(lastServiceDateStr);
                            if (lastD) {
                                const nextD = new Date(lastD.getFullYear(), lastD.getMonth() + 6, lastD.getDate());
                                nextD.setHours(0,0,0,0);
                                nextServiceDateStr = `${String(nextD.getDate()).padStart(2, '0')}-${String(nextD.getMonth() + 1).padStart(2, '0')}-${nextD.getFullYear()}`;
                                
                                daysRemaining = Math.ceil((nextD.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                if (daysRemaining <= 0) {
                                    isDateDanger = true;
                                    datePercent = 100;
                                } else if (daysRemaining <= 30) {
                                    isDateWarning = true;
                                    datePercent = Math.min(100, Math.round(((180 - daysRemaining) / 180) * 100));
                                } else {
                                    datePercent = Math.min(100, Math.round(((180 - daysRemaining) / 180) * 100));
                                }
                            }
                        }

                        let remainingKmStr = '';
                        if (remainingKm > 0) remainingKmStr = `Sisa ${remainingKm.toLocaleString('id-ID')} KM`;
                        else if (remainingKm === 0) remainingKmStr = '0 KM';
                        else remainingKmStr = `Lewat ${Math.abs(remainingKm).toLocaleString('id-ID')} KM`;

                        let daysRemainingStr = '';
                        if (daysRemaining === null) daysRemainingStr = '-';
                        else if (daysRemaining > 0) daysRemainingStr = `Sisa ${daysRemaining} Hari`;
                        else if (daysRemaining === 0) daysRemainingStr = 'Jatuh Tempo Hari Ini';
                        else daysRemainingStr = `Lewat ${Math.abs(daysRemaining)} Hari`;

                        let routineStatus = { label: `Sisa ${(intervalKm - diffKm).toLocaleString('id-ID')} KM`, type: 'safe', percent: Math.max(kmPercent, datePercent) };

                        if (diffKm >= intervalKm || isDateDanger) {
                            let labelText = '';
                            if (diffKm >= intervalKm && daysRemaining !== null && daysRemaining < 0) {
                                labelText = `Lewat ${(diffKm - intervalKm).toLocaleString('id-ID')} KM / ${Math.abs(daysRemaining)} Hari`;
                            } else if (diffKm >= intervalKm) {
                                labelText = `Lewat ${(diffKm - intervalKm).toLocaleString('id-ID')} KM`;
                            } else if (daysRemaining !== null && daysRemaining < 0) {
                                labelText = `Lewat ${Math.abs(daysRemaining)} Hari`;
                            } else {
                                labelText = 'Jatuh Tempo Waktu';
                            }
                            routineStatus = { label: labelText, type: 'danger', percent: 100 };
                        } else if (diffKm >= (intervalKm - 1500) || isDateWarning) {
                            let labelText = `Sisa ${(intervalKm - diffKm).toLocaleString('id-ID')} KM`;
                            if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30) {
                                labelText = `Sisa ${daysRemaining} Hari`;
                            }
                            routineStatus = { label: labelText, type: 'warning', percent: Math.max(kmPercent, datePercent) };
                        }

                        let urgencyScore = -9999;
                        if (!car.isUnderService) {
                            const kmRatio = diffKm / intervalKm;
                            let timeRatio = 0;
                            if (lastServiceDateStr) {
                                const lastD = this.parseLocalDate(lastServiceDateStr);
                                if (lastD) {
                                    const daysElapsed = Math.max(0, Math.ceil((today.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24)));
                                    timeRatio = daysElapsed / 180;
                                }
                            }
                            urgencyScore = Math.max(kmRatio, timeRatio);
                        }

                        return {
                            ...car,
                            _logs: vLogs,
                            _lastServiceKm: lastServiceKm,
                            _lastServiceDateStr: lastServiceDateStr,
                            _lastWorkshop: lastWorkshop,
                            _serviceIntervalKm: intervalKm,
                            _serviceIntervalRule: intervalRule,
                            _routineStatus: routineStatus,
                            _remainingKm: remainingKm,
                            _remainingKmStr: remainingKmStr,
                            _daysRemaining: daysRemaining,
                            _daysRemainingStr: daysRemainingStr,
                            _urgencyScore: urgencyScore,
                            _nextServiceKm: lastServiceKm + intervalKm,
                            _nextServiceDateStr: nextServiceDateStr
                        };
                    }).filter(Boolean);
                },

                activeOperationalVehicles() { return (this.vehicles || []).filter(v => this.isVehicleOperational(v) && this.isDriverOperational(v)); },
                visibleVehicles() { return (this.processedVehicles || []).filter(v => v && this.isVehicleOperational(v) && this.isDriverOperational(v) && !v.isHidden); },
                hiddenVehiclesCount() { return (this.processedVehicles || []).filter(v => v && this.isVehicleOperational(v) && this.isDriverOperational(v) && v.isHidden).length; },
                routineVehiclesCount() { return (this.processedVehicles || []).filter(v => v && this.isVehicleOperational(v) && this.isDriverOperational(v) && !v.isHidden && !v.isUnderService && v._routineStatus.type === 'safe').length; },
                urgentVehiclesCount() { return (this.processedVehicles || []).filter(v => v && this.isVehicleOperational(v) && this.isDriverOperational(v) && !v.isHidden && !v.isUnderService && v._routineStatus.type === 'warning').length; },
                expiredVehiclesCount() { return (this.processedVehicles || []).filter(v => v && this.isVehicleOperational(v) && this.isDriverOperational(v) && !v.isHidden && !v.isUnderService && v._routineStatus.type === 'danger').length; },
                inServiceVehiclesCount() { return (this.processedVehicles || []).filter(v => v && this.isVehicleOperational(v) && this.isDriverOperational(v) && !v.isHidden && v.isUnderService).length; },
                
                filteredVehicles() {
                    let list = (this.processedVehicles || []).filter(car => {
                        if (!car || !this.isVehicleOperational(car) || !this.isDriverOperational(car)) return false;
                        if (this.statusFilter === 'HIDDEN') {
                            if (!car.isHidden) return false;
                        } else if (!this.showHiddenVehicles && car.isHidden) {
                            return false;
                        }
                        const q = this.searchQuery ? this.searchQuery.toLowerCase() : '';
                        const matchesSearch = !q || (car.plate && car.plate.toLowerCase().includes(q)) || 
                                              (car.model && car.model.toLowerCase().includes(q)) || 
                                              (car.driver && car.driver.toLowerCase().includes(q));
                        const matchesCategory = this.categoryFilter === 'ALL' || car.category === this.categoryFilter;
                        let matchesStatus = true;
                        if (this.statusFilter === 'IN_SERVICE') matchesStatus = car.isUnderService;
                        else if (this.statusFilter === 'JATUH_TEMPO') matchesStatus = !car.isUnderService && car._routineStatus.type === 'danger';
                        else if (this.statusFilter === 'SEGERA') matchesStatus = !car.isUnderService && car._routineStatus.type === 'warning';
                        else if (this.statusFilter === 'AMAN') matchesStatus = !car.isUnderService && car._routineStatus.type === 'safe';
                        return matchesSearch && matchesCategory && matchesStatus;
                    });

                    list.sort((a, b) => {
                        if (this.vehicleSortOption === 'URGENT_FIRST' || this.vehicleSortOption === 'URGENT_LAST') {
                            return this.vehicleSortOption === 'URGENT_FIRST' ? (b._urgencyScore - a._urgencyScore) : (a._urgencyScore - b._urgencyScore);
                        } else if (this.vehicleSortOption === 'PLATE_ASC') {
                            return (a.plate || '').localeCompare(b.plate || '');
                        } else if (this.vehicleSortOption === 'KM_DESC') {
                            return (Number(b.currentKm) || 0) - (Number(a.currentKm) || 0);
                        }
                        return 0;
                    });
                    return list;
                },

                filteredServiceLogs() {
                    let logs = [...(this.serviceLogs || []).filter(Boolean)];
                    if (this.logVehicleFilter !== 'ALL') logs = logs.filter(l => l && (l.vehicleId === this.logVehicleFilter || l.vehicleId === this.getVehiclePlate(this.logVehicleFilter)));
                    if (this.logWorkshopFilter !== 'ALL') logs = logs.filter(l => l && l.workshop === this.logWorkshopFilter);
                    if (this.logMonthFilter !== 'ALL') {
                        const targetM = Number(this.logMonthFilter);
                        logs = logs.filter(l => {
                            if (!l || !l.date) return false;
                            const d = this.parseLocalDate(l.date);
                            return d && (d.getMonth() + 1) === targetM;
                        });
                    }
                    if (this.logYearFilter !== 'ALL') {
                        const targetY = Number(this.logYearFilter);
                        logs = logs.filter(l => {
                            if (!l || !l.date) return false;
                            const d = this.parseLocalDate(l.date);
                            return d && d.getFullYear() === targetY;
                        });
                    }
                    if (this.logSortOption === 'DATE_DESC') logs.sort((a, b) => (this.parseLocalDate(b.date) || 0) - (this.parseLocalDate(a.date) || 0));
                    else if (this.logSortOption === 'DATE_ASC') logs.sort((a, b) => (this.parseLocalDate(a.date) || 0) - (this.parseLocalDate(b.date) || 0));
                    else if (this.logSortOption === 'COST_DESC') logs.sort((a, b) => (Number(b.totalCost) || 0) - (Number(a.totalCost) || 0));
                    else if (this.logSortOption === 'COST_ASC') logs.sort((a, b) => (Number(a.totalCost) || 0) - (Number(b.totalCost) || 0));
                    else if (this.logSortOption === 'KM_DESC') logs.sort((a, b) => (Number(b.km) || 0) - (Number(a.km) || 0));
                    return logs;
                },

                filteredLogsSubtotal() { return this.filteredServiceLogs.reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0); },
                isAllFilteredLogsSelected() {
                    if (!this.filteredServiceLogs.length) return false;
                    return this.filteredServiceLogs.every(l => l && this.selectedLogIds.includes(l.id));
                },

                annualRecapStats() {
                    const yearNum = Number(this.recapYear);
                    const logs = (this.serviceLogs || []).filter(l => {
                        if (!l || !l.date) return false;
                        const d = this.parseLocalDate(l.date);
                        return d && d.getFullYear() === yearNum;
                    });
                    const totalCost = logs.reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0);
                    const totalCount = logs.length;
                    const averageMonthly = Math.round(totalCost / 12);
                    return { totalCost, totalCount, averageMonthly };
                }
            },

            methods: {
                // Helper berparameter harus berada di methods, bukan computed Vue.
                isVehicleOperational(car) {
                    return !!car && car.isActive !== false && String(car.status || '').toUpperCase() !== 'OFF';
                },
                isDriverOperational(car) {
                    if (!car) return false;
                    const driverId = String(car.driverId || '').trim();
                    const driverName = String(car.driver || '').trim().toLowerCase();
                    const master = (this.drivers || []).find(d =>
                        (driverId && String(d.id || d._fbKey || '') === driverId) ||
                        (driverName && String(d.name || '').trim().toLowerCase() === driverName)
                    );
                    // Kendaraan tanpa penugasan driver boleh tampil. Jika ada nama/ID driver,
                    // master wajib ditemukan dan berstatus aktif; driver yatim tidak boleh dipakai.
                    const hasAssignment = Boolean(driverId || (driverName && driverName !== '-'));
                    if (!hasAssignment) return true;
                    return Boolean(master) &&
                        String(master.status || 'AKTIF').toUpperCase() !== 'NONAKTIF' &&
                        master.isActive !== false;
                },
                initFirebase() {
                    if (!auth || !db) {
                        this.cloudStatus = 'error';
                        this.cloudErrorMessage = 'Firebase tidak dapat diinisialisasi.';
                        return;
                    }
                    try {
                        // Tunggu Auth selesai sebelum memasang listener RTDB. Ini penting
                        // untuk file HTML yang dibuka langsung dari Download, karena listener
                        // yang dipasang sebelum anonymous sign-in dapat lebih dulu menerima
                        // permission-denied lalu terlihat seperti aplikasi offline.
                        if (this.firebaseAuthTimer) clearTimeout(this.firebaseAuthTimer);
                        this.firebaseAuthResolved = false;
                        this.firebaseAuthErrorCode = '';
                        this.firebaseAuthErrorMessage = '';
                        this._realtimeListenersAttached = false;
                        this.firebaseAuthTimer = setTimeout(() => {
                            if (!this.firebaseAuthResolved) {
                                this.cloudStatus = 'error';
                                this.firebaseAuthErrorCode = 'auth/timeout';
                                this.firebaseAuthErrorMessage = 'onAuthStateChanged tidak menyelesaikan autentikasi dalam 15 detik.';
                                this.cloudErrorMessage = 'Firebase Auth timeout. Periksa internet, Anonymous Authentication, dan akses browser untuk file HTML ini.';
                            }
                        }, 15000);

                        onAuthStateChanged(auth, (user) => {
                            this.firebaseAuthResolved = true;
                            if (this.firebaseAuthTimer) {
                                clearTimeout(this.firebaseAuthTimer);
                                this.firebaseAuthTimer = null;
                            }

                            if (user) {
                                this.currentUser = user;
                                this.firebaseUserId = user.uid;
                                this.firebaseAuthProvider = user.isAnonymous ? 'anonymous' : (user.providerData?.[0]?.providerId || 'password');
                                this.firebaseAuthErrorCode = '';
                                this.firebaseAuthErrorMessage = '';
                                this.isAdmin = !user.isAnonymous;
                                this.cloudStatus = 'connected';
                                this.cloudErrorMessage = '';
                                this.setupRealtimeListeners();
                                if (this.isAdmin && typeof this._attachAdminSettingsListener === 'function') {
                                    this._attachAdminSettingsListener();
                                }
                                return;
                            }

                            authService.signInAnonymously().then((cred) => {
                                this.currentUser = cred.user;
                                this.firebaseUserId = cred.user.uid;
                                this.firebaseAuthProvider = 'anonymous';
                                this.firebaseAuthErrorCode = '';
                                this.firebaseAuthErrorMessage = '';
                                this.isAdmin = false;
                                this.cloudStatus = 'connected';
                                this.cloudErrorMessage = '';
                                this.setupRealtimeListeners();
                            }).catch((err) => {
                                console.warn('Anonymous Auth fallback error:', err);
                                this.currentUser = null;
                                this.firebaseUserId = '';
                                this.firebaseAuthProvider = '';
                                this.firebaseAuthErrorCode = String(err?.code || 'unknown');
                                this.firebaseAuthErrorMessage = String(err?.message || '');
                                this.isAdmin = false;
                                this.cloudStatus = 'error';
                                this.cloudErrorMessage = this.explainFirebaseError(err, 'Login anonim Firebase gagal.');
                            });
                        }, (err) => {
                            console.warn('Firebase Auth state error:', err);
                            this.firebaseAuthResolved = true;
                            if (this.firebaseAuthTimer) {
                                clearTimeout(this.firebaseAuthTimer);
                                this.firebaseAuthTimer = null;
                            }
                            this.cloudStatus = 'error';
                            this.firebaseAuthErrorCode = String(err?.code || 'unknown');
                            this.firebaseAuthErrorMessage = String(err?.message || '');
                            this.cloudErrorMessage = this.explainFirebaseError(err, 'Firebase Auth gagal.');
                        });
                    } catch (e) {
                        console.warn('Firebase initialization error:', e);
                        this.cloudStatus = 'error';
                        this.cloudErrorMessage = this.explainFirebaseError(e, 'Firebase gagal diinisialisasi.');
                    }
                },

                explainFirebaseError(err, fallback = 'Koneksi Firebase gagal.') {
                    const code = String(err?.code || '');
                    const msg = String(err?.message || '');
                    if (code.includes('permission-denied') || /permission[_ -]?denied/i.test(msg)) {
                        return 'Akses Firebase ditolak oleh Rules. Data publik belum diizinkan untuk aplikasi AutomAn.';
                    }
                    if (code.includes('auth/operation-not-allowed')) {
                        return 'Anonymous Authentication belum diaktifkan di Firebase Authentication.';
                    }
                    if (code.includes('auth/unauthorized-domain')) {
                        return 'Domain/asal halaman ini ditolak Firebase Authentication. Untuk file Download, browser dapat membatasi konteks lokal. Cek Authorized domains atau gunakan file ini dari browser yang mengizinkan Firebase Auth.';
                    }
                    if (code.includes('auth/configuration-not-found')) {
                        return 'Konfigurasi Firebase Authentication untuk project uns-fleet-service belum tersedia.';
                    }
                    if (code.includes('auth/network-request-failed')) {
                        return 'Jaringan gagal menghubungi Firebase Authentication.';
                    }
                    return fallback + (msg ? ` (${msg})` : '');
                },

                showToast(message, type = 'success') {
                    this.toast = { show: true, message, type };
                    setTimeout(() => { this.toast.show = false; }, 3500);
                },

                openCloudSetupModal() {
                    this.activeCloudModal = true;
                },

                async saveSettingsToCloud() {
                    const settingsObj = {
                        geminiApiKey: this.geminiApiKey || '',
                        waNumber: this.waNumber || '',
                        waGatewayUrl: this.waGatewayUrl || '',
                        telegramBotToken: this.telegramBotToken || '',
                        telegramChatId: this.telegramChatId || '',
                        enableWaNotification: Boolean(this.enableWaNotification),
                        enableTelegramNotification: Boolean(this.enableTelegramNotification),
                        sheetsWebhookUrl: this.sheetsWebhookUrl || '',
                        autoSyncSheets: Boolean(this.autoSyncSheets),
                        updatedAt: new Date().toISOString()
                    };

                    safeSetStorage('uns_gemini_api_key', settingsObj.geminiApiKey);
                    safeSetStorage('uns_wa_number', settingsObj.waNumber);
                    safeSetStorage('uns_wa_gateway_url', settingsObj.waGatewayUrl);
                    safeSetStorage('uns_telegram_token', settingsObj.telegramBotToken);
                    safeSetStorage('uns_telegram_chat_id', settingsObj.telegramChatId);
                    safeSetStorage('uns_enable_wa_notif', settingsObj.enableWaNotification);
                    safeSetStorage('uns_enable_tg_notif', settingsObj.enableTelegramNotification);
                    safeSetStorage('uns_sheets_webhook_url', settingsObj.sheetsWebhookUrl);
                    safeSetStorage('uns_auto_sync_sheets', settingsObj.autoSyncSheets);

                    if (!db || !this.isAdmin) return false;

                    const telegramConfig = {
                        botToken: settingsObj.telegramBotToken,
                        chatId: settingsObj.telegramChatId,
                        enabled: settingsObj.enableTelegramNotification,
                        updatedAt: settingsObj.updatedAt
                    };
                    try {
                        await Promise.all([
                            settingsRepository.updateSettings(settingsObj),
                            settingsRepository.updateTelegramConfig(telegramConfig)
                        ]);
                        return true;
                    } catch (e) {
                        console.warn('Gagal menyimpan settings Telegram/Firebase:', e);
                        return false;
                    }
                },

                async saveNotifSettings() {
                    const saved = await this.saveSettingsToCloud();
                    if (!saved) {
                        this.showToast('Gagal menyimpan pengaturan ke Firebase. Periksa koneksi dan hak akses, lalu coba lagi.', 'error');
                        return;
                    }
                    this.activeNotifModal = false;
                    this.showToast('Pengaturan Notifikasi & Cloud Sync berhasil disimpan ke Firebase.', 'success');
                },

                async loginAdmin() {
                    const email = (this.adminEmailInput || '').trim();
                    const pwd = (this.adminPasswordInput || '').trim();
                    if (!email || !pwd) {
                        this.showToast('Masukkan email dan password admin!', 'error');
                        return;
                    }
                    try {
                        await authService.signInWithEmailAndPassword(email, pwd);
                        safeSetStorage('uns_admin_email', email);
                        this.activeAdminModal = false;
                        this.adminPasswordInput = '';
                        this.showToast('Login Admin Berhasil (Firebase Auth)!', 'success');
                    } catch (e) {
                        let msg = 'Gagal login. Periksa email dan password Anda!';
                        if (e.code === 'auth/invalid-email') msg = 'Format email tidak valid!';
                        else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = 'Email atau password salah!';
                        else if (e.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan. Coba beberapa saat lagi!';
                        this.showToast(msg, 'error');
                    }
                },

                async logoutAdmin() {
                    try {
                        if (typeof this._settingsUnsub === 'function') {
                            const unsubscribe = this._settingsUnsub;
                            try { unsubscribe(); } catch (e) {}
                            this._realtimeUnsubs = (this._realtimeUnsubs || []).filter(fn => fn !== unsubscribe);
                            this._settingsUnsub = null;
                        }
                        await authService.signOut();
                        this.isAdmin = false;
                        this.currentTab = 'dashboard';
                        this.showToast('Admin berhasil keluar. Mode Publik aktif.', 'success');
                    } catch (e) {
                        this.showToast('Gagal logout: ' + e.message, 'error');
                    }
                },

                async changeAdminPassword() {
                    if (this.pwdForm.newPwd !== this.pwdForm.confirmPwd) {
                        this.showToast('Konfirmasi password baru tidak cocok!', 'error');
                        return;
                    }
                    if (!auth || !auth.currentUser) {
                        this.showToast('Sesi login tidak ditemukan. Silakan login kembali!', 'error');
                        return;
                    }
                    try {
                        await authService.updatePassword(auth.currentUser, this.pwdForm.newPwd);
                        this.activePasswordModal = false;
                        this.pwdForm = { currentPwd: '', newPwd: '', confirmPwd: '' };
                        this.showToast('Password Admin berhasil diubah via Firebase Auth!', 'success');
                    } catch (e) {
                        if (e.code === 'auth/requires-recent-login') {
                            this.showToast('Sesi keamanan telah berakhir. Silakan logout & login ulang terlebih dahulu.', 'error');
                        } else {
                            this.showToast('Gagal mengubah password: ' + (e.message || 'Error terjadi'), 'error');
                        }
                    }
                },

                async resetAdminPasswordFromLogin() {
                    const email = (this.adminEmailInput || '').trim();
                    if (!email) {
                        this.showToast('Isi email admin terlebih dahulu untuk reset password!', 'error');
                        return;
                    }
                    try {
                        await authService.sendPasswordResetEmail(email);
                        this.showToast(`Email reset password telah dikirim ke ${email}`, 'success');
                    } catch (e) {
                        let msg = 'Gagal mengirim email reset password.';
                        if (e.code === 'auth/user-not-found') msg = 'Email tidak terdaftar di Firebase!';
                        else if (e.code === 'auth/invalid-email') msg = 'Format email tidak valid!';
                        this.showToast(msg, 'error');
                    }
                },

                disposeRealtimeListeners() {
                    disposeSubscriptions(this._realtimeUnsubs, error => {
                        console.warn('Gagal melepas listener Firebase:', error);
                    });
                    this._settingsUnsub = null;
                    this._attachAdminSettingsListener = null;
                    this._realtimeListenersAttached = false;
                },

                setupRealtimeListeners() {
                    if (!db || !this.currentUser) return;
                    if (this._realtimeListenersAttached) return;
                    this._realtimeListenersAttached = true;

                    try {
                        // Semua subscription disimpan agar dapat dilepas saat aplikasi dihancurkan.
                        const trackListener = (subscribe, ...args) =>
                            trackSubscription(this._realtimeUnsubs, subscribe, ...args);
                        const trackedOnValue = (...args) => trackListener(onValue, ...args);
                        const trackedOnChildAdded = (...args) => trackListener(onChildAdded, ...args);
                        const trackedOnChildChanged = (...args) => trackListener(onChildChanged, ...args);
                        const trackedOnChildRemoved = (...args) => trackListener(onChildRemoved, ...args);
                        const {
                            vehicles: vehiclesRef,
                            drivers: driversRef,
                            logs: logsRef,
                            settings: settingsRef,
                            telegramConfig: telegramConfigRef,
                            connected: connectedRef
                        } = createRealtimeReferences({ database: db, ref, dataPath });

                        // Pantau koneksi saja. Jangan menghapus cache lokal hanya karena
                        // .info/connected=true: status online tidak berarti Rules mengizinkan
                        // pembacaan /vehicles dan /logs. Cache dibersihkan setelah listener
                        // berhasil menerima data Firebase.
                        let vehicleCloudSynced = false;
                        let logCloudSynced = false;
                        trackedOnValue(connectedRef, snap => {
                            if (snap.val() === true && this.cloudStatus !== 'error') {
                                this.cloudStatus = 'connected';
                                this.cloudErrorMessage = '';
                            }
                        }, err => {
                            console.warn('RTDB connection monitor warning:', err);
                        });

                        // Armada: incremental child listeners agar perubahan 1 kendaraan
                        // tidak mengunduh ulang seluruh koleksi.
                        const upsertVehicle = (key, val) => {
                            if (!val || typeof val !== 'object') return;
                            const normalized = mapVehicleRecord(key, val, value => this.normalizeDamageNotes(value));
                            if (!normalized) return;
                            const idx = (this.vehicles || []).findIndex(v =>
                                v && (v.id === normalized.id || v._fbKey === key)
                            );
                            if (idx >= 0) this.vehicles.splice(idx, 1, normalized);
                            else this.vehicles.push(normalized);
                            safeSetStorage('uns_vehicles', this.vehicles);
                        };

                        const removeVehicle = (key) => {
                            this.vehicles = (this.vehicles || []).filter(v =>
                                v && v._fbKey !== key && v.id !== key
                            );
                            safeSetStorage('uns_vehicles', this.vehicles);
                        };

                        trackedOnChildAdded(vehiclesRef, snap => {
                            if (!vehicleCloudSynced) {
                                vehicleCloudSynced = true;
                                this.vehicles = [];
                            }
                            this.cloudStatus = 'connected';
                            this.cloudErrorMessage = '';
                            upsertVehicle(snap.key, snap.val());
                        }, err => {
                            console.warn('RTDB vehicles listener warning:', err);
                            this.cloudStatus = 'error';
                            this.cloudErrorMessage = this.explainFirebaseError(err, 'Gagal membaca data armada dari Firebase.');
                        });

                        trackedOnChildChanged(vehiclesRef, snap => {
                            this.cloudStatus = 'connected';
                            this.cloudErrorMessage = '';
                            upsertVehicle(snap.key, snap.val());
                        }, err => {
                            console.warn('RTDB vehicles change warning:', err);
                            this.cloudStatus = 'error';
                            this.cloudErrorMessage = this.explainFirebaseError(err, 'Gagal memantau perubahan armada.');
                        });

                        trackedOnChildRemoved(vehiclesRef, snap => {
                            this.cloudStatus = 'connected';
                            this.cloudErrorMessage = '';
                            removeVehicle(snap.key);
                        }, err => {
                            console.warn('RTDB vehicles remove warning:', err);
                            this.cloudStatus = 'error';
                            this.cloudErrorMessage = this.explainFirebaseError(err, 'Gagal memantau penghapusan armada.');
                        });

                        // Master driver: listener incremental agar perubahan ON/OFF langsung berlaku.
                        let driverCloudSynced = false;
                        const upsertDriver = (key, val) => {
                            if (!val || typeof val !== 'object') return;
                            const item = mapDriverRecord(key, val);
                            if (!item) return;
                            const idx = (this.drivers || []).findIndex(d => d && (d._fbKey === key || d.id === item.id));
                            if (idx >= 0) this.drivers.splice(idx, 1, item); else this.drivers.push(item);
                        };
                        trackedOnChildAdded(driversRef, snap => {
                            if (!driverCloudSynced) { driverCloudSynced = true; this.drivers = []; }
                            upsertDriver(snap.key, snap.val());
                        }, err => console.warn('RTDB drivers listener warning:', err));
                        trackedOnChildChanged(driversRef, snap => upsertDriver(snap.key, snap.val()), err => console.warn('RTDB drivers change warning:', err));
                        trackedOnChildRemoved(driversRef, snap => { this.drivers = (this.drivers || []).filter(d => d && d._fbKey !== snap.key); }, err => console.warn('RTDB drivers remove warning:', err));

                        // Log servis: incremental juga.
                        const upsertLog = (key, val) => {
                            if (!val || typeof val !== 'object') return;
                            const normalized = mapServiceLogRecord(key, val);
                            if (!normalized) return;
                            const idx = (this.serviceLogs || []).findIndex(l =>
                                l && (l.id === normalized.id || l._fbKey === key)
                            );
                            if (idx >= 0) this.serviceLogs.splice(idx, 1, normalized);
                            else this.serviceLogs.push(normalized);
                            safeSetStorage('uns_logs', this.serviceLogs);
                        };

                        const removeLog = (key) => {
                            this.serviceLogs = (this.serviceLogs || []).filter(l =>
                                l && l._fbKey !== key && l.id !== key
                            );
                            safeSetStorage('uns_logs', this.serviceLogs);
                        };

                        trackedOnChildAdded(logsRef, snap => {
                            if (!logCloudSynced) {
                                logCloudSynced = true;
                                this.serviceLogs = [];
                            }
                            this.cloudStatus = 'connected';
                            this.cloudErrorMessage = '';
                            upsertLog(snap.key, snap.val());
                        }, err => {
                            console.warn('RTDB logs listener warning:', err);
                            this.cloudStatus = 'error';
                            this.cloudErrorMessage = this.explainFirebaseError(err, 'Gagal membaca log servis dari Firebase.');
                        });

                        trackedOnChildChanged(logsRef, snap => {
                            this.cloudStatus = 'connected';
                            this.cloudErrorMessage = '';
                            upsertLog(snap.key, snap.val());
                        }, err => {
                            console.warn('RTDB logs change warning:', err);
                            this.cloudStatus = 'error';
                            this.cloudErrorMessage = this.explainFirebaseError(err, 'Gagal memantau perubahan log servis.');
                        });

                        trackedOnChildRemoved(logsRef, snap => {
                            this.cloudStatus = 'connected';
                            this.cloudErrorMessage = '';
                            removeLog(snap.key);
                        }, err => {
                            console.warn('RTDB logs remove warning:', err);
                            this.cloudStatus = 'error';
                            this.cloudErrorMessage = this.explainFirebaseError(err, 'Gagal memantau penghapusan log servis.');
                        });

                        // Konfigurasi Telegram sengaja dibaca semua perangkat internal.
                        // Tombol simpan tetap dibatasi Admin. Ini memudahkan semua perangkat
                        // mengirim notifikasi tanpa harus login Admin.
                        trackedOnValue(telegramConfigRef, snap => {
                            const cfg = snap.val();
                            if (!cfg) return;
                            if (cfg.botToken !== undefined) this.telegramBotToken = String(cfg.botToken || '');
                            if (cfg.chatId !== undefined) this.telegramChatId = String(cfg.chatId || '');
                            if (cfg.enabled !== undefined) this.enableTelegramNotification = Boolean(cfg.enabled);
                        }, err => console.warn("RTDB public Telegram config warning:", err));

                        const attachAdminSettingsListener = () => {
                            if (!this.isAdmin) return;
                            if (typeof this._settingsUnsub === 'function') return;
                            this._settingsUnsub = trackedOnValue(settingsRef, snap => {
                                const cloudSettings = snap.val();
                                if (!cloudSettings) return;
                                if (cloudSettings.geminiApiKey !== undefined) this.geminiApiKey = cloudSettings.geminiApiKey;
                                if (cloudSettings.waNumber !== undefined) this.waNumber = cloudSettings.waNumber;
                                if (cloudSettings.waGatewayUrl !== undefined) this.waGatewayUrl = cloudSettings.waGatewayUrl;
                                if (cloudSettings.telegramBotToken !== undefined) this.telegramBotToken = cloudSettings.telegramBotToken;
                                if (cloudSettings.telegramChatId !== undefined) this.telegramChatId = cloudSettings.telegramChatId;
                                if (cloudSettings.enableWaNotification !== undefined) this.enableWaNotification = cloudSettings.enableWaNotification;
                                if (cloudSettings.enableTelegramNotification !== undefined) this.enableTelegramNotification = cloudSettings.enableTelegramNotification;
                                if (cloudSettings.sheetsWebhookUrl !== undefined) this.sheetsWebhookUrl = cloudSettings.sheetsWebhookUrl;
                                if (cloudSettings.autoSyncSheets !== undefined) this.autoSyncSheets = cloudSettings.autoSyncSheets;
                            }, err => console.warn("RTDB admin settings warning:", err));
                        };

                        // Jalankan setelah auth state sudah tersedia.
                        if (this.isAdmin) attachAdminSettingsListener();

                        // Simpan helper agar auth callback dapat memasang listener
                        // setelah admin login tanpa membuat listener kendaraan/log baru.
                        this._attachAdminSettingsListener = attachAdminSettingsListener;
                    } catch (e) {
                        console.warn("Setup realtime listeners error:", e);
                        this.disposeRealtimeListeners();
                        this.cloudStatus = 'error';
                        this.cloudErrorMessage = this.explainFirebaseError(e, 'Gagal memasang listener Firebase.');
                    }
                },

                isVehicleActive(car) {
                    return !!car && car.isActive !== false && String(car.status || '').toUpperCase() !== 'OFF';
                },
                isDriverActive(driver) {
                    return !!driver && String(driver.status || 'AKTIF').toUpperCase() !== 'NONAKTIF' && driver.isActive !== false;
                },
                isVehicleEligibleForService(car) {
                    if (!this.isVehicleActive(car)) return false;
                    const driverId = String(car.driverId || '').trim();
                    const driverName = String(car.driver || '').trim().toLowerCase();
                    if (!driverId && (!driverName || driverName === '-')) return true;
                    const driver = (this.drivers || []).find(d =>
                        (driverId && (String(d.id || '') === driverId || String(d._fbKey || '') === driverId)) ||
                        (driverName && String(d.name || '').trim().toLowerCase() === driverName)
                    );
                    // Jangan izinkan service baru bila assignment menunjuk driver yang tidak terdaftar.
                    return Boolean(driver) && this.isDriverActive(driver);
                },
                activeVehiclesForService() {
                    return (this.vehicles || []).filter(car => this.isVehicleEligibleForService(car));
                },
                cleanFirebaseKey(str) {
                    return String(str || '').trim().replace(/[\/\.\#\$\[\]]/g, '_');
                },

                async syncVehicleToCloud(car) {
                    if (!db || !car || !(car._fbKey || car.id)) return false;
                    try {
                        const targetKey = this.cleanFirebaseKey(car._fbKey || car.id);
                        // Aplikasi operasional hanya boleh memperbarui field operasional.
                        // Master kendaraan (plat, model, driver, kategori, ON/OFF) dikelola Admin.
                        await fleetRepository.updateVehicleOperational(targetKey, {
                            currentKm: Number(car.currentKm) || 0,
                            isUnderService: Boolean(car.isUnderService),
                            targetWorkshop: car.targetWorkshop || '',
                            inServiceDate: car.inServiceDate || '',
                            inServiceNotes: car.inServiceNotes || '',
                            damageNotes: Array.isArray(car.damageNotes) ? car.damageNotes : []
                        });
                        return true;
                    } catch(e) {
                        console.warn("Gagal menyinkronkan armada ke cloud:", e);
                        return false;
                    }
                },

                async removeVehicleFromCloud(carOrId) {
                    if (!db || !carOrId) return false;
                    try {
                        const car = typeof carOrId === 'object'
                            ? carOrId
                            : (this.vehicles || []).find(v => v && (v.id === carOrId || v.plate === carOrId));
                        const targetKey = this.cleanFirebaseKey((car && car._fbKey) || (car && car.id) || carOrId);
                        await fleetRepository.deleteVehicle(targetKey);
                        return true;
                    } catch(e) {
                        console.warn('Gagal menghapus armada dari cloud:', e);
                        return false;
                    }
                },

                async syncLogToCloud(log) {
                    if (!db || !log || !(log._fbKey || log.id)) return false;
                    try {
                        const targetKey = this.cleanFirebaseKey(log._fbKey || log.id);
                        await fleetRepository.updateServiceLog(targetKey, log);
                        return true;
                    } catch(e) {
                        console.warn('Gagal menyinkronkan log ke cloud:', e);
                        return false;
                    }
                },

                async removeLogFromCloud(logId) {
                    if (!db || !logId) return false;
                    try {
                        const targetKey = this.cleanFirebaseKey(logId);
                        await fleetRepository.deleteServiceLog(targetKey);
                        return true;
                    } catch(e) {
                        console.warn('Gagal menghapus log dari cloud:', e);
                        return false;
                    }
                },

                async syncToGoogleSheetsAuto() {
                    if (!this.autoSyncSheets || !this.sheetsWebhookUrl) return;
                    try {
                        this.isSheetsSyncing = true;
                        const payload = {
                            action: 'syncAll',
                            vehicles: (this.vehicles || []).filter(Boolean),
                            logs: (this.serviceLogs || []).filter(Boolean)
                        };
                        await fetch(this.sheetsWebhookUrl, {
                            method: 'POST',
                            mode: 'no-cors',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } catch (e) {
                        console.warn('Auto sync Google Sheets error:', e);
                    } finally {
                        this.isSheetsSyncing = false;
                    }
                },

                getVehiclePlate(vId) { const car = (this.vehicles || []).find(v => v && (v.id === vId || v.plate === vId)); return car ? car.plate : (vId || '-'); },
                getVehicleModel(vId) { const car = (this.vehicles || []).find(v => v && (v.id === vId || v.plate === vId)); return car ? car.model : '-'; },
                
                isRoutineItem(log) { 
                    if (!log) return false;
                    if (log.isRoutine === true || log.isRoutine === 'true') return true;
                    if (typeof log.isRoutine === 'string') {
                        const val = log.isRoutine.trim().toLowerCase();
                        return val === 'ya' || val === 'yes' || val === 'rutin' || val === 'true';
                    }
                    return false;
                },

                maskMoney(amount, forceShow = false) {
                    const num = Number(amount) || 0;
                    if (this.isAdmin || forceShow) return 'Rp ' + num.toLocaleString('id-ID');
                    return 'Rp ***.***';
                },

                openVehicleDrawer(car) {
                    this.selectedDrawerVehicle = car;
                    this.activeVehicleDrawer = true;
                },

                toggleHideVehicle(car) {
                    if (!car) return;
                    car.isHidden = !car.isHidden;
                    safeSetStorage('uns_vehicles', this.vehicles);
                    this.syncVehicleToCloud(car);
                    this.syncToGoogleSheetsAuto();
                    this.showToast(`Armada ${car.plate} ${car.isHidden ? 'disembunyikan' : 'ditampilkan'}`, 'success');
                },

                getMonthName(m) {
                    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                    return months[m - 1] || '';
                },
                getMonthNameShort(m) {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
                    return months[m - 1] || '';
                },
                getServicedVehiclesForMonth(m, year) {
                    const logs = (this.serviceLogs || []).filter(l => {
                        if (!l || !l.date) return false;
                        const d = this.parseLocalDate(l.date);
                        return d && (d.getMonth() + 1) === m && d.getFullYear() === Number(year);
                    });
                    const totalCost = logs.reduce((acc, curr) => acc + (Number(curr.totalCost) || 0), 0);
                    return { logs, totalCost };
                },

                loadSampleData() {
                    this.vehicles = [
                        { id: 'AD 1001 ZA', plate: 'AD 1001 ZA', model: 'Toyota Innova Zenix 2.0 HV', driver: 'Pak Bambang', category: 'Pimpinan', currentKm: 14200, lastServiceKm: 12000, lastServiceDate: '2026-05-10', isUnderService: false, isHidden: false },
                        { id: 'AD 7002 GA', plate: 'AD 7002 GA', model: 'Toyota HiAce Commuter 2.5', driver: 'Pak Joko', category: 'Operasional', currentKm: 85200, lastServiceKm: 76000, lastServiceDate: '2025-11-15', isUnderService: false, isHidden: false },
                        { id: 'AD 1362 XA', plate: 'AD 1362 XA', model: 'Isuzu Panther Grand Royal', driver: 'Pak Sumpono', category: 'Operasional', currentKm: 198500, lastServiceKm: 185000, lastServiceDate: '2025-06-20', isUnderService: false, isHidden: false }
                    ];
                    this.serviceLogs = [
                        { id: 'LOG-101', vehicleId: 'AD 1001 ZA', workshop: 'Nasmoco', date: '2026-05-10', km: 12000, invoiceNo: 'INV-8821', isRoutine: true, items: [{ name: 'Oli Mesin TGO 0W-20', cost: 450000 }], replacedComponents: ['filterOli'], totalCost: 450000 },
                        { id: 'LOG-102', vehicleId: 'AD 7002 GA', workshop: 'Nasmoco', date: '2025-11-15', km: 76000, invoiceNo: 'INV-7712', isRoutine: true, items: [{ name: 'Oli Mesin TGO 10W-30', cost: 500000 }], replacedComponents: ['filterOli'], totalCost: 500000 },
                        { id: 'LOG-103', vehicleId: 'AD 1362 XA', workshop: 'Montecarlo', date: '2025-06-20', km: 185000, invoiceNo: 'INV-5501', isRoutine: true, items: [{ name: 'Oli Mesin Diesel 15W-40', cost: 380000 }], replacedComponents: ['filterOli'], totalCost: 380000 }
                    ];
                    safeSetStorage('uns_vehicles', this.vehicles);
                    safeSetStorage('uns_logs', this.serviceLogs);
                    this.vehicles.forEach(v => this.syncVehicleToCloud(v));
                    this.serviceLogs.forEach(l => this.syncLogToCloud(l));
                    this.showToast('Data uji coba dimuat secara manual. Data ini tidak lagi dimuat otomatis saat aplikasi dibuka.', 'success');
                },

                getComponentWear(car, compKey) {
                    if (!car) return { text: 'Belum tercatat', percent: null, lastRecord: 'Belum tercatat' };

                    // Interval komponen tetap sebagai acuan keausan setelah komponen
                    // benar-benar ditemukan di riwayat servis. Matriks TIDAK memakai
                    // servis terakhir kendaraan sebagai pengganti histori komponen.
                    const vitalSpecs = {
                        filterOli: { km: 10000, months: 12 },
                        aki: { km: 50000, months: 30 },
                        oliMatic: { km: 40000, months: 24 },
                        ban: { km: 40000, months: 36 },
                        oliGardan: { km: 40000, months: 24 },
                        ac: { km: 25000, months: 18 },
                        kampasRem: { km: 30000, months: 24 },
                        busi: { km: 40000, months: 30 }
                    };

                    const keywordMap = {
                        filterOli: [
                            'filter oli', 'oil filter', 'oil-filter', 'saringan oli',
                            'filter engine oil', 'filter mesin'
                        ],
                        aki: [
                            'aki', 'accu', 'aki 12v',
                            'aki kering', 'aki basah', 'aki mf',
                            // Beberapa merek aki umum yang dapat muncul di uraian servis.
                            // 'battery' dan 'baterai' sengaja TIDAK dimasukkan agar tidak
                            // mengklasifikasikan istilah umum tersebut sebagai Aki 12V.
                            'gs astra', 'gs battery', 'gs aki', 'yuasa', 'incoe',
                            'bosch', 'amaron', 'ns battery', 'furukawa', 'delkor'
                        ],
                        oliMatic: [
                            'oli matic', 'oli transmisi', 'transmisi', 'atf', 'cv t', 'cvt',
                            'gear oil automatic', 'automatic transmission fluid', 'flush transmisi'
                        ],
                        ban: [
                            'ban', 'tire', 'tires', 'tyre', 'roda', 'velg ban',
                            'ban depan', 'ban belakang', 'ban luar', 'ban dalam'
                        ],
                        oliGardan: [
                            'oli gardan', 'gardan', 'differential', 'differential oil',
                            'final gear', 'gear oil gardan'
                        ],
                        ac: [
                            'ac', 'a/c', 'air conditioner', 'air conditioning', 'evaporator',
                            'kondensor', 'condenser', 'freon', 'refrigerant', 'kompresor ac',
                            'compressor ac', 'blower ac'
                        ],
                        kampasRem: [
                            'kampas rem', 'brake pad', 'brake pads', 'brake shoe', 'brake shoes',
                            'kampas brake', 'pad rem', 'sepatu rem', 'cakram rem', 'disc brake',
                            'rem depan', 'rem belakang'
                        ],
                        busi: [
                            'busi', 'spark plug', 'spark plugs', 'plug busi', 'busi iridium',
                            'busi platinum', 'busi mesin'
                        ]
                    };

                    const spec = vitalSpecs[compKey] || { km: 20000, months: 12 };
                    const kws = keywordMap[compKey] || [];
                    const rawLogs = Array.isArray(car._logs) && car._logs.length
                        ? car._logs
                        : this.getVehicleLogs(car.id);
                    const vLogs = Array.isArray(rawLogs) ? rawLogs.filter(Boolean) : [];

                    // Ambil log TERBARU yang benar-benar menyebut/mengindikasikan
                    // komponen tersebut. Sumber deteksi: replacedComponents + seluruh
                    // teks item/uraian log servis.
                    const normalize = value => String(value ?? '')
                        .toLowerCase()
                        .normalize('NFKD')
                        .replace(/[\u0300-\u036f]/g, '');

                    const logText = log => {
                        const parts = [];
                        if (log && Array.isArray(log.replacedComponents)) parts.push(log.replacedComponents.join(' '));
                        if (log && typeof log.replacedComponents === 'string') parts.push(log.replacedComponents);
                        if (log && Array.isArray(log.items)) {
                            log.items.forEach(it => {
                                if (it) parts.push(it.name, it.description, it.note, it.notes, it.detail);
                            });
                        } else if (log && typeof log.items === 'string') {
                            parts.push(log.items);
                        }
                        if (log) {
                            parts.push(
                                log.description, log.notes, log.note, log.detail, log.keterangan,
                                log.serviceDescription, log.workDescription, log.uraian,
                                log.complaint, log.problem, log.damage
                            );
                        }
                        return normalize(parts.filter(v => v !== undefined && v !== null).join(' '));
                    };

                    const matches = vLogs.filter(log => {
                        const explicit = Array.isArray(log.replacedComponents)
                            ? log.replacedComponents.some(x => normalize(x) === normalize(compKey))
                            : normalize(log.replacedComponents).split(/[;,|]/).some(x => normalize(x).trim() === normalize(compKey));
                        const text = logText(log);
                        const keywordHit = kws.some(kw => {
                            const needle = normalize(kw);
                            if (!needle) return false;
                            // Untuk "ac", gunakan batas kata agar kata seperti "macet"
                            // tidak salah dianggap sebagai servis AC.
                            if (needle === 'ac') return /(^|[^a-z0-9])ac([^a-z0-9]|$)/.test(text);
                            return text.includes(needle);
                        });
                        return explicit || keywordHit;
                    });

                    matches.sort((a, b) => {
                        const da = this.parseLocalDate(a.date)?.getTime() || 0;
                        const db = this.parseLocalDate(b.date)?.getTime() || 0;
                        if (db !== da) return db - da;
                        return (Number(b.km) || 0) - (Number(a.km) || 0);
                    });

                    const lastLog = matches[0] || null;

                    // Belum pernah ada histori komponen -> jangan mengarang persentase
                    // berdasarkan servis umum kendaraan.
                    if (!lastLog) {
                        return {
                            text: 'Belum tercatat',
                            percent: null,
                            lastRecord: 'Belum tercatat'
                        };
                    }

                    const currentKm = Number(car.currentKm) || 0;
                    const lastKm = Number(lastLog.km) || 0;
                    const usedKm = Math.max(0, currentKm - lastKm);
                    const kmPercent = Math.round((usedKm / spec.km) * 100);

                    let refDate = this.parseLocalDate(lastLog.date);
                    if (!refDate) refDate = new Date();
                    const now = new Date();
                    const diffMonths = Math.max(0,
                        (now.getFullYear() - refDate.getFullYear()) * 12 +
                        (now.getMonth() - refDate.getMonth())
                    );
                    const monthPercent = Math.round((diffMonths / spec.months) * 100);
                    const finalPercent = Math.max(kmPercent, monthPercent);
                    // Tampilkan juga bengkel dari log service terakhir yang mendeteksi komponen.
                    // Mendukung beberapa nama field agar kompatibel dengan log lama/baru.
                    const workshopName = String(
                        lastLog.workshop ||
                        lastLog.workshopName ||
                        lastLog.bengkel ||
                        lastLog.vendor ||
                        lastLog.serviceWorkshop ||
                        lastLog.targetWorkshop ||
                        ''
                    ).trim();
                    const lastRecordStr = `${this.formatDateWib(lastLog.date)} (${lastKm.toLocaleString('id-ID')} KM)${workshopName ? ` (${workshopName})` : ''}`;

                    return {
                        text: `${usedKm.toLocaleString('id-ID')} KM / ${diffMonths} Bln`,
                        percent: Math.min(100, finalPercent),
                        lastRecord: lastRecordStr
                    };
                },

                getComponentNameLabelShort(key) {
                    const map = { filterOli: 'Filter Oli', aki: 'Aki 12V', oliMatic: 'Oli Transmisi', ban: 'Ban Roda', oliGardan: 'Oli Gardan', ac: 'Sistem AC', kampasRem: 'Kampas Rem', busi: 'Busi' };
                    return map[key] || key;
                },

                getVehicleLogs(vId) {
                    return this.logsByVehicleId[vId] || [];
                },

                formatDateWib(dateStr) {
                    const d = this.parseLocalDate(dateStr);
                    if (!d) return dateStr || '-';
                    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                },

                parseLocalDate(dateStr) {
                    if (!dateStr) return null;
                    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
                    const s = String(dateStr).trim();
                    if (!s) return null;
                    if (s.length === 10 && s[4] === '-' && s[7] === '-') {
                        return new Date(Number(s.substring(0, 4)), Number(s.substring(5, 7)) - 1, Number(s.substring(8, 10)));
                    }
                    if (s.length === 10 && s[2] === '-' && s[5] === '-') {
                        return new Date(Number(s.substring(6, 10)), Number(s.substring(3, 5)) - 1, Number(s.substring(0, 2)));
                    }
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? null : d;
                },

                getVehicleLastServiceKm(carOrId) {
                    const car = typeof carOrId === 'object' && carOrId !== null ? carOrId : (this.vehicles || []).find(v => v && (v.id === carOrId || v.plate === carOrId));
                    if (!car) return 0;
                    return car._lastServiceKm || Number(car.lastServiceKm) || Number(car.currentKm) || 0;
                },

                getVehicleLastServiceDate(carOrId) {
                    const car = typeof carOrId === 'object' && carOrId !== null ? carOrId : (this.vehicles || []).find(v => v && (v.id === carOrId || v.plate === carOrId));
                    if (!car) return null;
                    return car._lastServiceDateStr || car.lastServiceDate || null;
                },

                recalculateVehicleLastService(car) {
                    if (!car) return;
                    const vLogs = this.getVehicleLogs(car.id);
                    const routineLogs = vLogs.filter(l => l && this.isRoutineItem(l) && Number(l.km) > 0);
                    if (routineLogs.length > 0) {
                        car.lastServiceKm = Number(routineLogs[0].km);
                        car.lastServiceDate = routineLogs[0].date;
                    } else {
                        // Reset fallback jika log rutin dihapus
                        car.lastServiceKm = 0;
                        car.lastServiceDate = '';
                    }
                },

                openInServiceModal(car) {
                    let targetCar = car || (this.vehicles && this.vehicles.length ? this.vehicles[0] : null);
                    if (targetCar) {
                        const carLogs = this.getVehicleLogs(targetCar.id);
                        const defaultWs = (carLogs && carLogs.length > 0 && carLogs[0].workshop) ? carLogs[0].workshop : 'Nasmoco';
                        
                        let initialNotes = '';
                        const activeNotes = this.getActiveDamageNotes(targetCar);
                        if (activeNotes.length > 0) {
                            initialNotes = 'Catatan Keluhan Driver:\n' + activeNotes.map((n, i) => `${i + 1}. ${this.getDamageNoteText(n)}`).join('\n');
                        }

                        this.inServiceForm = {
                            vehicleId: targetCar.id,
                            workshop: defaultWs,
                            date: new Date().toISOString().substring(0, 10),
                            km: Number(targetCar.currentKm) || 0,
                            notes: initialNotes
                        };
                    }
                    this.activeInServiceModal = true;
                },

                onInServiceVehicleChange() {
                    const car = (this.vehicles || []).find(v => v && (v.id === this.inServiceForm.vehicleId || v.plate === this.inServiceForm.vehicleId));
                    if (car) {
                        this.inServiceForm.km = Number(car.currentKm) || 0;
                        const carLogs = this.getVehicleLogs(car.id);
                        if (carLogs && carLogs.length > 0 && carLogs[0].workshop) {
                            this.inServiceForm.workshop = carLogs[0].workshop;
                        }

                        const activeNotes = this.getActiveDamageNotes(car);
                        if (activeNotes.length > 0 && !this.inServiceForm.notes) {
                            this.inServiceForm.notes = 'Catatan Keluhan Driver:\n' + activeNotes.map((n, i) => `${i + 1}. ${this.getDamageNoteText(n)}`).join('\n');
                        }
                    }
                },

                normalizeDamageNotes(rawNotes) {
                    const notes = Array.isArray(rawNotes)
                        ? rawNotes
                        : (rawNotes && typeof rawNotes === 'object' ? Object.values(rawNotes).filter(Boolean) : []);
                    return notes.filter(Boolean).map(n => ({
                        ...n,
                        text: String(
                            n.text ?? n.description ?? n.complaint ?? n.issue ?? n.problem ??
                            n.note ?? n.notes ?? n.damage ?? n.keluhan ?? n.uraian ?? n.detail ?? ''
                        ).trim(),
                        reporter: String(n.reporter ?? n.reportedBy ?? n.driver ?? 'Driver').trim(),
                        date: n.date || n.createdAt || n.timestamp || '',
                        isResolved: Boolean(n.isResolved)
                    }));
                },

                getDamageNoteText(note) {
                    if (!note) return '⚠ Uraian belum diisi oleh pelapor.';
                    const text = String(
                        note.text ?? note.description ?? note.complaint ?? note.issue ?? note.problem ??
                        note.note ?? note.notes ?? note.damage ?? note.keluhan ?? note.uraian ?? note.detail ?? ''
                    ).trim();
                    return text || '⚠ Uraian belum diisi oleh pelapor.';
                },

                getActiveDamageNotes(car) {
                    if (!car) return [];
                    const notes = Array.isArray(car.damageNotes) ? car.damageNotes : (car.damageNotes ? Object.values(car.damageNotes).filter(Boolean) : []);
                    return notes.filter(n => n && !n.isResolved);
                },

                normalizeDamageNotesAll() {
                    if (!Array.isArray(this.vehicles)) return;
                    this.vehicles.forEach(car => {
                        if (car && car.damageNotes && !Array.isArray(car.damageNotes)) {
                            car.damageNotes = Object.values(car.damageNotes).filter(Boolean);
                        }
                    });
                },

                getInServiceActiveNotes() {
                    if (!this.inServiceForm.vehicleId) return [];
                    const car = (this.vehicles || []).find(v => v && (v.id === this.inServiceForm.vehicleId || v.plate === this.inServiceForm.vehicleId));
                    return this.getActiveDamageNotes(car);
                },

                insertSingleDamageNote(text) {
                    if (!text) return;
                    if (this.inServiceForm.notes) {
                        this.inServiceForm.notes += `\n• ${text}`;
                    } else {
                        this.inServiceForm.notes = `• ${text}`;
                    }
                    this.showToast('Keluhan ditambahkan ke catatan', 'success');
                },

                insertAllDamageNotesIntoForm() {
                    const notes = this.getInServiceActiveNotes();
                    if (!notes.length) return;
                    const combined = notes.map((n, i) => `${i + 1}. ${n.text}`).join('\n');
                    if (this.inServiceForm.notes) {
                        this.inServiceForm.notes += `\n\nCatatan Driver:\n${combined}`;
                    } else {
                        this.inServiceForm.notes = `Catatan Driver:\n${combined}`;
                    }
                    this.showToast('Semua keluhan driver disalin ke form', 'success');
                },

                openDamageNotesModal(car) {
                    this.selectedDamageVehicle = car;
                    this.selectedDamageVehicle.damageNotes = this.normalizeDamageNotes(this.selectedDamageVehicle.damageNotes);
                    this.damageNoteInput = '';
                    this.damageReporterInput = (car && car.driver) ? car.driver : '';
                    this.activeDamageNotesModal = true;
                },

                async addDamageNote() {
                    if (!this.selectedDamageVehicle || !this.damageNoteInput.trim()) {
                        this.showToast('Isi uraian kendala kerusakan terlebih dahulu!', 'error');
                        return;
                    }

                    if (!Array.isArray(this.selectedDamageVehicle.damageNotes)) {
                        this.selectedDamageVehicle.damageNotes = this.selectedDamageVehicle.damageNotes ? Object.values(this.selectedDamageVehicle.damageNotes).filter(Boolean) : [];
                    }

                    const noteObj = {
                        id: 'DMG-' + Date.now(),
                        text: this.damageNoteInput.trim(),
                        reporter: (this.damageReporterInput || '').trim() || (this.selectedDamageVehicle.driver || 'Driver UNS'),
                        date: new Date().toISOString().substring(0, 10),
                        isResolved: false
                    };

                    this.selectedDamageVehicle.damageNotes.unshift(noteObj);
                    safeSetStorage('uns_vehicles', this.vehicles);
                    
					const cloudSaved = await this.syncVehicleToCloud(this.selectedDamageVehicle);
this.syncToGoogleSheetsAuto();

const notifDetails =
    `🚘 *Plat*: ${this.selectedDamageVehicle.plate} (${this.selectedDamageVehicle.model})\n` +
    `👤 *Pelapor*: ${noteObj.reporter}\n` +
    `⚠️ *Kerusakan*: ${noteObj.text}`;

if (cloudSaved) {

    // Telegram
    await this.dispatchSystemNotification(
        'CATATAN KERUSAKAN BARU DARI DRIVER',
        notifDetails
    );

    // FCM Android
    await this.sendAutomanFcmBridge(
        'COMPLAINT',
        'Keluhan Kendaraan Baru',
        `${this.selectedDamageVehicle.plate} memiliki keluhan baru: ${noteObj.text}`,
        {
            vehicleId: String(this.selectedDamageVehicle.id || ''),
            plate: String(this.selectedDamageVehicle.plate || ''),
            model: String(this.selectedDamageVehicle.model || ''),
            driver: String(this.selectedDamageVehicle.driver || ''),
            reporter: String(noteObj.reporter || ''),
            complaint: String(noteObj.text || ''),
            complaintId: String(noteObj.id || '')
        }
    );

} else {
    this.showToast(
        'Keluhan tersimpan lokal, tetapi Firebase gagal menyimpan. Notifikasi tidak dikirim; coba sinkronkan kembali.',
        'error'
    );
    return;
}

                    this.damageNoteInput = '';
                    this.showToast('Catatan kerusakan berhasil disimpan dan dikonfirmasi Firebase!', 'success');
                },

                async toggleResolveDamageNote(noteId) {
                    if (!this.selectedDamageVehicle || !Array.isArray(this.selectedDamageVehicle.damageNotes)) return;
                    const note = this.selectedDamageVehicle.damageNotes.find(n => n && n.id === noteId);
                    if (!note) return;
                    note.isResolved = !note.isResolved;
                    safeSetStorage('uns_vehicles', this.vehicles);
                    const cloudSaved = await this.syncVehicleToCloud(this.selectedDamageVehicle);
                    if (cloudSaved) {
                        this.syncToGoogleSheetsAuto();
                        this.showToast(`Status catatan diperbarui menjadi: ${note.isResolved ? 'Selesai' : 'Aktif'} dan dikonfirmasi Firebase.`, 'success');
                    } else {
                        this.showToast('Perubahan status tersimpan di perangkat, tetapi Firebase belum mengonfirmasi.', 'error');
                    }
                },

                async deleteDamageNote(noteId) {
                    if (!this.selectedDamageVehicle || !Array.isArray(this.selectedDamageVehicle.damageNotes)) return;
                    this.selectedDamageVehicle.damageNotes = this.selectedDamageVehicle.damageNotes.filter(n => n && n.id !== noteId);
                    safeSetStorage('uns_vehicles', this.vehicles);
                    const cloudSaved = await this.syncVehicleToCloud(this.selectedDamageVehicle);
                    if (cloudSaved) {
                        this.syncToGoogleSheetsAuto();
                        this.showToast('Catatan kerusakan dihapus dan dikonfirmasi Firebase.', 'success');
                    } else {
                        this.showToast('Penghapusan tersimpan di perangkat, tetapi Firebase belum mengonfirmasi.', 'error');
                    }
                },

                openUpdateKmModal(car) {
                    const targetCar = car || (this.vehicles && this.vehicles.length ? this.vehicles[0] : null);
                    this.updateKmForm = {
                        vehicleId: targetCar ? targetCar.id : '',
                        currentKm: targetCar ? (Number(targetCar.currentKm) || 0) : 0,
                        newKm: targetCar ? (Number(targetCar.currentKm) || 0) : 0
                    };
                    this.activeUpdateKmModal = true;
                },

                onUpdateKmVehicleChange() {
                    const car = (this.vehicles || []).find(v => v && (v.id === this.updateKmForm.vehicleId || v.plate === this.updateKmForm.vehicleId));
                    if (car) {
                        this.updateKmForm.currentKm = Number(car.currentKm) || 0;
                        this.updateKmForm.newKm = Number(car.currentKm) || 0;
                    }
                },

                addKmToForm(amount) {
                    this.updateKmForm.newKm = (Number(this.updateKmForm.newKm) || 0) + amount;
                },

                async saveUpdateKm() {
                    if (!this.updateKmForm.vehicleId) {
                        this.showToast('Pilih armada terlebih dahulu!', 'error');
                        return;
                    }
                    const car = (this.vehicles || []).find(v => v && (v.id === this.updateKmForm.vehicleId || v.plate === this.updateKmForm.vehicleId));
                    if (car) {
                        const newKmVal = Number(this.updateKmForm.newKm);
                        if (isNaN(newKmVal) || newKmVal < 0) {
                            this.showToast('Input Odometer tidak valid!', 'error');
                            return;
                        }
                        const oldKmVal = Number(car.currentKm) || 0;
                        car.currentKm = newKmVal;
                        safeSetStorage('uns_vehicles', this.vehicles);
                        const cloudSaved = await this.syncVehicleToCloud(car);

                        const notifDetails = `🚘 *Plat*: ${car.plate} (${car.model})\n👤 *Sopir*: ${car.driver || 'Sopir UNS'}\n📍 *Odometer Lama*: ${oldKmVal.toLocaleString('id-ID')} KM\n📈 *Odometer Baru*: ${newKmVal.toLocaleString('id-ID')} KM`;
                        if (cloudSaved) {
    // Telegram tetap berjalan seperti sebelumnya
    await this.dispatchSystemNotification(
        'UPDATE ODOMETER KENDARAAN',
        notifDetails
    );

    // FCM Android
    await this.sendAutomanFcmBridge(
        'ODOMETER',
        'Odometer Kendaraan Diperbarui',
        `${car.plate} diperbarui dari ${oldKmVal.toLocaleString('id-ID')} KM menjadi ${newKmVal.toLocaleString('id-ID')} KM.`,
        {
            vehicleId: String(car.id || ''),
            plate: String(car.plate || ''),
            model: String(car.model || ''),
            driver: String(car.driver || ''),
            oldKm: String(oldKmVal),
            newKm: String(newKmVal)
        }
    ); 
    } else {
                            this.showToast('Odometer tersimpan di perangkat, tetapi Firebase belum mengonfirmasi. Modal tetap terbuka; coba lagi setelah koneksi pulih.', 'error');
                        }
                        if (cloudSaved) {
                            this.syncToGoogleSheetsAuto();
                            this.showToast(`Odometer ${car.plate} diperbarui ke ${car.currentKm.toLocaleString('id-ID')} KM dan dikonfirmasi Firebase.`, 'success');
                            this.activeUpdateKmModal = false;
                        }
                    } else {
                        this.showToast('Data armada tidak ditemukan!', 'error');
                    }
                },

                async saveInService() {
                    const f = this.inServiceForm;
                    if (!f.vehicleId || !f.workshop || f.km === '' || !f.date || !f.notes) {
                        this.showToast('Harap lengkapi semua keterangan pengajuan servis!', 'error');
                        return;
                    }
                    const car = (this.vehicles || []).find(v => v && (v.id === f.vehicleId || v.plate === f.vehicleId));
                    if (car) {
                        car.isUnderService = true;
                        car.targetWorkshop = f.workshop;
                        car.inServiceDate = f.date;
                        car.inServiceNotes = f.notes;
                        if (Number(f.km) > (Number(car.currentKm) || 0)) car.currentKm = Number(f.km);
                        safeSetStorage('uns_vehicles', this.vehicles);
                        const cloudSaved = await this.syncVehicleToCloud(car);
                        const notifDetails = `🚘 *Plat*: ${car.plate} (${car.model})\n👤 *Sopir*: ${car.driver || 'Sopir UNS'}\n🏬 *Bengkel*: ${f.workshop}\n📍 *Odometer*: ${Number(f.km).toLocaleString('id-ID')} KM\n📝 *Keluhan*: ${f.notes}`;
                        if (cloudSaved) {
                            this.syncToGoogleSheetsAuto();
                            await this.dispatchSystemNotification('PENGAJUAN SERVIS BARU', notifDetails);
                            this.showToast(`Pengajuan servis ${car.plate} berhasil dikirim dan dikonfirmasi Firebase!`, 'success');
                            this.activeInServiceModal = false;
                        } else {
                            this.showToast('Pengajuan tersimpan di perangkat, tetapi Firebase belum mengonfirmasi. Modal tetap terbuka; coba lagi setelah koneksi pulih.', 'error');
                        }
                    }
                },
				async sendAutomanFcmBridge(type, title, body, data = {}) {
    const FCM_BRIDGE_URL =
        'https://script.google.com/macros/s/AKfycbzJXaz6AbvzMfW7x9YulUhKqiEeJW_UN2IZYtwlEnbKDFfdcJOjS2DE9jSXfChN9Z8rfw/exec';

    try {
        const payload = {
            action: 'FCM_NOTIFY',
            type: String(type || 'GENERAL'),
            title: String(title || 'AUTOMAN UNS'),
            body: String(body || ''),
            data: {
                ...data,
                source: 'AUTOMAN',
                timestamp: String(Date.now())
            }
        };

        const response = await fetch(FCM_BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        let result = null;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.warn('[FCM] Response bukan JSON:', text);
        }

        console.log(
    '[FCM] Bridge response:',
    JSON.stringify(result || text, null, 2)
);

        return !!(
            response.ok &&
            result &&
            result.status === 'success'
        );

    } catch (error) {
        console.warn('[FCM] Bridge gagal:', error);
        return false;
    }
},
async sendAutomanFcmBridge(type, title, body, data = {}) {
    const FCM_BRIDGE_URL =
        'https://script.google.com/macros/s/AKfycbzJXaz6AbvzMfW7x9YulUhKqiEeJW_UN2IZYtwlEnbKDFfdcJOjS2DE9jSXfChN9Z8rfw/exec';

    try {
        const payload = {
            action: 'FCM_NOTIFY',
            type: String(type || 'GENERAL'),
            title: String(title || 'AUTOMAN UNS'),
            body: String(body || ''),
            data: {
                ...data,
                source: 'AUTOMAN',
                timestamp: String(Date.now())
            }
        };

        const response = await fetch(FCM_BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        let result = null;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.warn('[FCM] Response bukan JSON:', text);
        }

        console.log('[FCM] BRIDGE RAW: ' + text);

        return !!(
            response.ok &&
            result &&
            result.status === 'success'
        );

    } catch (error) {
        console.warn('[FCM] Bridge gagal:', error);
        return false;
    }
},
                async dispatchSystemNotification(eventTitle, detailText) {
                    const fullText = `🚗 *AUTOMAN UNS NOTIFICATION*\n\n📌 *${eventTitle}*\n${detailText}\n\n⏱️ _${new Date().toLocaleString('id-ID')}_`;

                    if (this.enableTelegramNotification) {
                        await this.sendTelegramMessage(fullText);
                    }

                    if (this.enableWaNotification && (this.waGatewayUrl || this.waNumber)) {
                        this.sendWaMessage(fullText);
                    }
                },

                async sendTelegramMessage(text) {
                    // Gunakan jalur Telegram langsung yang sudah terbukti berjalan pada
                    // aplikasi GarasiKu: POST application/x-www-form-urlencoded ke Bot API.
                    // Semua perangkat membaca botToken/chatId dari data_v2/telegramConfig.
                    try {
                        const token = String(this.telegramBotToken || '').trim();
                        const chatId = String(this.telegramChatId || '').trim();
                        if (!token || !chatId || !text) {
                            console.warn('Telegram tidak dikirim: token/chatId/pesan kosong.');
                            return false;
                        }

                        const controller = new AbortController();
                        const timer = setTimeout(() => controller.abort(), 12000);
                        try {
                            const params = new URLSearchParams();
                            params.set('chat_id', chatId);
                            // Kirim sebagai plain text agar karakter Markdown dari pesan
                            // tidak menyebabkan Telegram menolak format pesan.
                            params.set('text', String(text).replace(/[*_`]/g, ''));

                            const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                                body: params,
                                signal: controller.signal,
                                cache: 'no-store'
                            });

                            let data = null;
                            try { data = await res.json(); } catch (_) {
                                throw new Error(`Respons Telegram bukan JSON (HTTP ${res.status}).`);
                            }

                            if (!res.ok || !data?.ok) {
                                throw new Error(data?.description || `Telegram HTTP ${res.status}`);
                            }

                            return true;
                        } finally {
                            clearTimeout(timer);
                        }
                    } catch (e) {
                        console.error('Telegram gagal:', e);
                        const msg = String(e?.message || e || 'Kesalahan Telegram');
                        if (/401|unauthorized/i.test(msg)) {
                            this.showToast('Telegram gagal: Bot Token tidak valid.', 'error');
                        } else if (/403|forbidden/i.test(msg)) {
                            this.showToast('Telegram gagal: Bot tidak memiliki izin ke Chat ID tersebut.', 'error');
                        } else if (/400|bad request/i.test(msg)) {
                            this.showToast(`Telegram gagal: ${msg}`, 'error');
                        } else if (e?.name === 'AbortError') {
                            this.showToast('Telegram gagal: koneksi timeout.', 'error');
                        }
                        return false;
                    }
                },

                async sendWaMessage(text) {
                    if (this.waGatewayUrl) {
                        try {
                            await fetch(this.waGatewayUrl.trim(), {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    target: this.waNumber,
                                    message: text
                                }),
                                mode: 'no-cors'
                            });
                            return true;
                        } catch (e) {
                            console.warn('Gagal mengirim ke WA Gateway:', e);
                        }
                    }
                    return true;
                },

                async testTelegramNotif() {
                    if (!this.enableTelegramNotification) {
                        this.showToast('Notifikasi Telegram sedang OFF.', 'error');
                        return;
                    }
                    this.showToast('Mengirim tes pesan Telegram...', 'success');
                    const testMsg = `🔔 *TES NOTIFIKASI AUTOMAN UNS*\n\nSistem Notifikasi Telegram Bot berhasil terhubung secara realtime dengan Cloud Firebase.`;
                    const ok = await this.sendTelegramMessage(testMsg);
                    if (ok) {
                        this.showToast('Pesan Telegram berhasil terkirim!', 'success');
                    } else {
                        this.showToast('Gagal terkirim. Periksa Token & Chat ID Telegram!', 'error');
                    }
                },

                async testWaNotif() {
                    if (!this.waNumber) {
                        this.showToast('Isi Nomor WhatsApp Admin terlebih dahulu!', 'error');
                        return;
                    }
                    const text = encodeURIComponent(`🔔 *TES NOTIFIKASI WHATSAPP AUTOMAN UNS*\nSistem Notifikasi WhatsApp terhubung.`);
                    if (this.waGatewayUrl) {
                        this.sendWaMessage(`🔔 TES NOTIFIKASI WHATSAPP AUTOMAN UNS`);
                        this.showToast('Notifikasi dikirim via Gateway WhatsApp!', 'success');
                    } else {
                        window.open(`https://wa.me/${this.waNumber.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
                        this.showToast('Membuka aplikasi WhatsApp...', 'success');
                    }
                },

                cancelInService(carId) {
                    const car = (this.vehicles || []).find(v => v && (v.id === carId || v.plate === carId));
                    if (car) {
                        car.isUnderService = false;
                        car.targetWorkshop = '';
                        car.inServiceNotes = '';
                        safeSetStorage('uns_vehicles', this.vehicles);
                        this.syncVehicleToCloud(car);
                        this.showToast(`Status pengajuan ${car.plate} dibatalkan`, 'success');
                    }
                },

                completeInServiceAndOpenServiceModal(car) {
                    const targetWs = car.targetWorkshop || 'Nasmoco';
                    this.cancelInService(car.id);
                    this.openQuickServiceForCar(car);
                    if (targetWs) {
                        this.serviceForm.workshop = targetWs;
                    }
                },

                openAddVehicleModal() {
                    this.vehicleForm = { id: null, plate: '', model: '', driver: '', category: 'Operasional', currentKm: 0, isUnderService: false, isHidden: false };
                    this.activeVehicleModal = true;
                },

                openEditVehicleModal(car) {
                    this.vehicleForm = { ...car };
                    this.activeVehicleModal = true;
                },

                saveVehicle() {
                    if (!this.vehicleForm.plate || !this.vehicleForm.model) {
                        this.showToast('Plat dan Model wajib diisi!', 'error');
                        return;
                    }
                    let carToSync = null;
                    const cleanPlate = this.vehicleForm.plate.toUpperCase().trim();

                    if (this.vehicleForm.id) {
                        const idx = this.vehicles.findIndex(v => v && v.id === this.vehicleForm.id);
                        if (idx !== -1) {
                            this.vehicles[idx] = { ...this.vehicleForm, plate: cleanPlate };
                            carToSync = this.vehicles[idx];
                        }
                    } else {
                        const newCar = {
                            ...this.vehicleForm,
                            id: cleanPlate,
                            plate: cleanPlate,
                            lastServiceKm: 0,
                            lastServiceDate: ''
                        };
                        this.vehicles.push(newCar);
                        carToSync = newCar;
                    }
                    safeSetStorage('uns_vehicles', this.vehicles);
                    if (carToSync) {
                        this.syncVehicleToCloud(carToSync);
                    }
                    this.syncToGoogleSheetsAuto();
                    this.activeVehicleModal = false;
                    this.showToast('Data armada berhasil disimpan!', 'success');
                },

                openDeleteVehicleModal(car) {
                    this.vehicleToDelete = car;
                    this.deleteType = 'vehicle';
                    this.activeDeleteModal = true;
                },

                openMasterDataModal() {
                    this.activeMasterDataModal = true;
                },

                openNewServiceModal() {
                    this.editingLogId = null;
                    const activeCars = this.activeOperationalVehicles;
                    const firstCar = activeCars.length ? activeCars[0] : null;
                    if (!firstCar) { this.showToast('Tidak ada kendaraan/driver berstatus ON untuk transaksi servis baru.', 'error'); return; }
                    this.serviceForm = {
                        vehicleId: firstCar ? firstCar.id : '',
                        workshop: 'Nasmoco',
                        date: new Date().toISOString().substring(0, 10),
                        km: firstCar ? (Number(firstCar.currentKm) || 0) : 0,
                        invoiceNo: 'INV-' + Math.floor(1000 + Math.random() * 9000),
                        isRoutine: true,
                        items: [{ name: 'Servis Berkala & Maintenance', cost: 0 }],
                        replacedComponents: []
                    };
                    this.activeNewServiceModal = true;
                },

                openQuickServiceForCar(car) {
                    if (!this.isVehicleOperational(car) || !this.isDriverOperational(car)) { this.showToast('Kendaraan atau driver sedang OFF. Servis baru tidak dapat dibuat.', 'error'); return; }
                    this.editingLogId = null;
                    this.serviceForm = {
                        vehicleId: car.id,
                        workshop: 'Nasmoco',
                        date: new Date().toISOString().substring(0, 10),
                        km: Number(car.currentKm) || 0,
                        invoiceNo: 'INV-' + Math.floor(1000 + Math.random() * 9000),
                        isRoutine: true,
                        items: [{ name: 'Servis Berkala & Maintenance', cost: 0 }],
                        replacedComponents: []
                    };
                    this.activeNewServiceModal = true;
                },

                openEditServiceModal(log) {
                    this.editingLogId = log.id;
                    this.serviceForm = JSON.parse(JSON.stringify(log));
                    this.activeNewServiceModal = true;
                },

                addServiceItem() {
                    this.serviceForm.items.push({ name: '', cost: 0 });
                },

                removeServiceItem(idx) {
                    this.serviceForm.items.splice(idx, 1);
                },

                addQuickItem(item) {
                    this.serviceForm.items.push({ name: item.name, cost: item.cost });
                },

                calcServiceFormTotal() {
                    return (this.serviceForm.items || []).reduce((sum, i) => sum + (Number(i.cost) || 0), 0);
                },

                async saveServiceLog() {
                    const f = this.serviceForm;
                    if (!f.vehicleId || !f.workshop || !f.date) {
                        this.showToast('Lengkapi data kendaraan, bengkel, dan tanggal!', 'error');
                        return;
                    }

                    const car = (this.vehicles || []).find(v => v && (v.id === f.vehicleId || v.plate === f.vehicleId));
                    if (!this.editingLogId && (!car || !this.isVehicleOperational(car) || !this.isDriverOperational(car))) {
                        this.showToast('Kendaraan atau driver sudah OFF. Transaksi servis baru dibatalkan.', 'error');
                        return;
                    }
                    const totalCost = this.calcServiceFormTotal();
                    f.isRoutine = (f.isRoutine === true || f.isRoutine === 'true');

                    let savedLogObj = null;
                    if (this.editingLogId) {
                        const idx = this.serviceLogs.findIndex(l => l && l.id === this.editingLogId);
                        if (idx !== -1) {
                            savedLogObj = { ...f, totalCost, id: this.editingLogId };
                            this.serviceLogs[idx] = savedLogObj;
                        }
                    } else {
                        savedLogObj = {
                            ...f,
                            id: 'LOG-' + Date.now(),
                            totalCost
                        };
                        this.serviceLogs.unshift(savedLogObj);
                    }

                    const cloudWrites = [];
                    if (car) {
                        if (Number(f.km) > (Number(car.currentKm) || 0)) {
                            car.currentKm = Number(f.km);
                        }
                        car.isUnderService = false;
                        this.recalculateVehicleLastService(car);
                        safeSetStorage('uns_vehicles', this.vehicles);
                        cloudWrites.push(this.syncVehicleToCloud(car));
                    }

                    safeSetStorage('uns_logs', this.serviceLogs);
                    if (savedLogObj) cloudWrites.push(this.syncLogToCloud(savedLogObj));
                    const results = await Promise.all(cloudWrites);
                    if (!results.length || !results.every(result => result === true)) {
                        this.showToast('Nota servis tersimpan di perangkat, tetapi Firebase belum mengonfirmasi seluruh perubahan. Periksa koneksi/hak akses lalu coba sinkronkan kembali.', 'error');
                        return;
                    }

                    this.syncToGoogleSheetsAuto();
                    if (car) {
                        const notifText = `🚘 *Plat*: ${car.plate}\n🏢 *Bengkel*: ${f.workshop}\n🧾 *No Invoice*: ${f.invoiceNo || '-'}\n💰 *Total Biaya*: Rp ${totalCost.toLocaleString('id-ID')}\n📍 *Odometer*: ${Number(f.km).toLocaleString('id-ID')} KM`;
                        await this.dispatchSystemNotification('PENYELESAIAN SERVIS / NOTA DITERBITKAN', notifText);
                    }

                    this.activeNewServiceModal = false;
                    this.showToast(f.isRoutine ? 'Nota servis rutin dikonfirmasi tersimpan di Firebase. Status jadwal disetel ulang!' : 'Nota perbaikan insidental dikonfirmasi tersimpan di Firebase (tanpa mereset jadwal rutin).', 'success');
                },

                openInvoiceModal(log) {
                    this.selectedLog = log;
                    this.activeInvoiceModal = true;
                },

                printInvoice() {
                    window.print();
                },

                openDeleteServiceModal(logId) {
                    this.logToDeleteId = logId;
                    this.deleteType = 'log';
                    this.activeDeleteModal = true;
                },

                openBulkDeleteModal(mode) {
                    this.deleteType = mode;
                    this.activeDeleteModal = true;
                },

                async confirmDelete() {
                    if (this.deleteType === 'vehicle' && this.vehicleToDelete) {
                        const vehicle = this.vehicleToDelete;
                        const cloudDeleted = await this.removeVehicleFromCloud(vehicle);
                        if (!cloudDeleted) {
                            this.showToast('Armada belum terhapus di Firebase. Data lokal dipertahankan.', 'error');
                            return;
                        }
                        this.vehicles = this.vehicles.filter(v => v && v.id !== vehicle.id);
                        safeSetStorage('uns_vehicles', this.vehicles);
                        this.showToast(`Armada ${vehicle.plate} berhasil dihapus dan dikonfirmasi Firebase.`, 'success');
                    } else if (this.deleteType === 'log' && this.logToDeleteId) {
                        const deletedLog = this.serviceLogs.find(l => l && l.id === this.logToDeleteId);
                        const cloudDeleted = await this.removeLogFromCloud(this.logToDeleteId);
                        if (!cloudDeleted) {
                            this.showToast('Catatan servis belum terhapus di Firebase. Data lokal dipertahankan.', 'error');
                            return;
                        }
                        this.serviceLogs = this.serviceLogs.filter(l => l && l.id !== this.logToDeleteId);
                        safeSetStorage('uns_logs', this.serviceLogs);
                        if (deletedLog) {
                            const car = (this.vehicles || []).find(v => v && (v.id === deletedLog.vehicleId || v.plate === deletedLog.vehicleId));
                            if (car) {
                                this.recalculateVehicleLastService(car);
                                safeSetStorage('uns_vehicles', this.vehicles);
                                const vehicleSaved = await this.syncVehicleToCloud(car);
                                if (!vehicleSaved) {
                                    this.showToast('Catatan servis terhapus di Firebase, tetapi pembaruan ringkasan kendaraan belum terkonfirmasi.', 'error');
                                    this.activeDeleteModal = false;
                                    return;
                                }
                            }
                        }
                        this.showToast('Catatan servis berhasil dihapus dan dikonfirmasi Firebase.', 'success');
                    } else if (this.deleteType === 'selected' || this.deleteType === 'filtered') {
                        const idsToRemove = this.deleteType === 'selected'
                            ? [...this.selectedLogIds]
                            : this.filteredServiceLogs.map(log => log.id);
                        const uniqueIds = [...new Set(idsToRemove.filter(Boolean))];
                        if (!uniqueIds.length) {
                            this.showToast('Tidak ada transaksi yang dipilih untuk dihapus.', 'error');
                            return;
                        }

                        const results = await Promise.all(uniqueIds.map(async id => ({
                            id,
                            deleted: await this.removeLogFromCloud(id)
                        })));
                        const deletedIds = results.filter(result => result.deleted).map(result => result.id);
                        const failedIds = results.filter(result => !result.deleted).map(result => result.id);

                        if (deletedIds.length) {
                            const removedLogs = this.serviceLogs.filter(log => log && deletedIds.includes(log.id));
                            this.serviceLogs = this.serviceLogs.filter(log => log && !deletedIds.includes(log.id));
                            safeSetStorage('uns_logs', this.serviceLogs);

                            const affectedVehicleIds = [...new Set(removedLogs.map(log => log.vehicleId).filter(Boolean))];
                            for (const vehicleId of affectedVehicleIds) {
                                const car = (this.vehicles || []).find(vehicle => vehicle && (vehicle.id === vehicleId || vehicle.plate === vehicleId));
                                if (!car) continue;
                                this.recalculateVehicleLastService(car);
                                const vehicleSaved = await this.syncVehicleToCloud(car);
                                if (!vehicleSaved) {
                                    failedIds.push(`ringkasan kendaraan ${car.plate || vehicleId}`);
                                }
                            }
                            safeSetStorage('uns_vehicles', this.vehicles);
                        }

                        if (this.deleteType === 'selected') {
                            this.selectedLogIds = failedIds.length
                                ? uniqueIds.filter(id => failedIds.includes(id))
                                : [];
                        }

                        if (failedIds.length) {
                            this.showToast(`${deletedIds.length} transaksi terhapus di Firebase; ${failedIds.length} penghapusan/pembaruan belum terkonfirmasi dan perlu diperiksa.`, 'error');
                        } else {
                            this.showToast(`${deletedIds.length} transaksi berhasil dihapus dan dikonfirmasi Firebase.`, 'success');
                        }
                    }
                    this.activeDeleteModal = false;
                    this.syncToGoogleSheetsAuto();
                },

                toggleSelectAllLogs() {
                    if (this.isAllFilteredLogsSelected) {
                        this.selectedLogIds = [];
                    } else {
                        this.selectedLogIds = this.filteredServiceLogs.map(l => l.id);
                    }
                },

                openMonthDetailModal(m) {
                    this.selectedRecapMonth = m;
                    this.activeMonthDetailModal = true;
                },

                exportLogsToExcel() {
                    try {
                        const dataToExport = this.filteredServiceLogs.map(l => ({
                            Tanggal: this.formatDateWib(l.date),
                            Plat: this.getVehiclePlate(l.vehicleId),
                            Model: this.getVehicleModel(l.vehicleId),
                            Bengkel: l.workshop,
                            Invoice: l.invoiceNo || '-',
                            OdometerKM: Number(l.km) || 0,
                            TotalBiaya: Number(l.totalCost) || 0,
                            Rutin: l.isRoutine ? 'Ya' : 'Tidak'
                        }));
                        const ws = XLSX.utils.json_to_sheet(dataToExport);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "RiwayatServis");
                        XLSX.writeFile(wb, `Rekap_Servis_UNS_${new Date().toISOString().substring(0,10)}.xlsx`);
                        this.showToast('File Excel berhasil diunduh!', 'success');
                    } catch (e) {
                        this.showToast('Gagal memproses ekspor Excel', 'error');
                    }
                },

                openImportModal() {
                    this.activeImportModal = true;
                },

                importLogsFromExcel(event) {
                    const file = event.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                            
                            let importedCount = 0;
                            jsonData.forEach(row => {
                                if (row.Plat && row.TotalBiaya) {
                                    let dateStr = new Date().toISOString().substring(0, 10);
                                    if (row.Tanggal) {
                                        const parsed = this.parseLocalDate(row.Tanggal);
                                        if (parsed) dateStr = parsed.toISOString().substring(0, 10);
                                    }
                                    const logObj = {
                                        id: 'LOG-IMP-' + Math.random().toString(36).substr(2, 9),
                                        vehicleId: String(row.Plat).toUpperCase().trim(),
                                        workshop: row.Bengkel || 'Nasmoco',
                                        date: dateStr,
                                        km: Number(row.OdometerKM) || 0,
                                        invoiceNo: row.Invoice || '',
                                        isRoutine: true,
                                        items: [{ name: 'Imported Item', cost: Number(row.TotalBiaya) || 0 }],
                                        totalCost: Number(row.TotalBiaya) || 0
                                    };
                                    this.serviceLogs.unshift(logObj);
                                    this.syncLogToCloud(logObj);
                                    importedCount++;
                                }
                            });
                            
                            this.vehicles.forEach(car => {
                                this.recalculateVehicleLastService(car);
                                this.syncVehicleToCloud(car);
                            });

                            safeSetStorage('uns_logs', this.serviceLogs);
                            safeSetStorage('uns_vehicles', this.vehicles);
                            this.activeImportModal = false;
                            this.showToast(`Berhasil mengimpor ${importedCount} data log!`, 'success');
                        } catch (err) {
                            this.showToast('Gagal membaca file Excel', 'error');
                        }
                    };
                    reader.readAsArrayBuffer(file);
                },

                saveSheetsSettings() {
                    this.saveSettingsToCloud();
                    this.activeSheetsModal = false;
                    this.syncToGoogleSheetsAuto();
                    this.showToast('Pengaturan Google Sheets tersimpan', 'success');
                },

                saveLocalStorageManual() {
                    try {
                        safeSetStorage('uns_vehicles', this.vehicles);
                        safeSetStorage('uns_logs', this.serviceLogs);
                        this.vehicles.filter(Boolean).forEach(v => this.syncVehicleToCloud(v));
                        this.serviceLogs.filter(Boolean).forEach(l => this.syncLogToCloud(l));
                        this.saveSettingsToCloud();
                        this.syncToGoogleSheetsAuto();
                        this.showToast('Semua data tersimpan di Local Storage & Cloud!', 'success');
                    } catch (e) {
                        this.showToast('Gagal menyimpan ke Local Storage.', 'error');
                    }
                },

                loadLocalStorageManual() {
                    try {
                        const localV = safeGetStorage('uns_vehicles', null);
                        const localL = safeGetStorage('uns_logs', null);
                        if (localV) this.vehicles = localV.filter(Boolean);
                        if (localL) this.serviceLogs = localL.filter(Boolean);
                        this.showToast('Data berhasil dimuat dari Local Storage browser!', 'success');
                    } catch (e) {
                        this.showToast('Gagal memuat data dari Local Storage.', 'error');
                    }
                },

                exportBackupJson() {
                    try {
                        const backupData = {
                            app: 'AUTOMAN UNS',
                            exportedAt: new Date().toISOString(),
                            vehicles: this.vehicles,
                            serviceLogs: this.serviceLogs,
                            settings: {
                                waNumber: this.waNumber,
                                waGatewayUrl: this.waGatewayUrl,
                                telegramBotToken: this.telegramBotToken,
                                telegramChatId: this.telegramChatId,
                                enableWaNotification: this.enableWaNotification,
                                enableTelegramNotification: this.enableTelegramNotification,
                                sheetsWebhookUrl: this.sheetsWebhookUrl,
                                autoSyncSheets: this.autoSyncSheets
                            }
                        };
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
                        const downloadAnchor = document.createElement('a');
                        downloadAnchor.setAttribute("href", dataStr);
                        downloadAnchor.setAttribute("download", `AUTOMAN_UNS_Backup_${new Date().toISOString().substring(0, 10)}.json`);
                        document.body.appendChild(downloadAnchor);
                        downloadAnchor.click();
                        downloadAnchor.remove();
                        this.showToast('File backup JSON berhasil diunduh!', 'success');
                    } catch (e) {
                        this.showToast('Gagal mengunduh file backup JSON.', 'error');
                    }
                },

                importBackupJson(event) {
                    const file = event.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            const backup = JSON.parse(e.target.result);
                            if (!backup || (!backup.vehicles && !backup.serviceLogs)) {
                                throw new Error('Format file backup JSON tidak valid!');
                            }

                            const cloudWrites = [];
                            if (Array.isArray(backup.vehicles)) {
                                this.vehicles = backup.vehicles.filter(Boolean);
                                safeSetStorage('uns_vehicles', this.vehicles);
                                cloudWrites.push(...this.vehicles.map(vehicle => this.syncVehicleToCloud(vehicle)));
                            }
                            if (Array.isArray(backup.serviceLogs)) {
                                this.serviceLogs = backup.serviceLogs.filter(Boolean);
                                safeSetStorage('uns_logs', this.serviceLogs);
                                cloudWrites.push(...this.serviceLogs.map(log => this.syncLogToCloud(log)));
                            }
                            if (backup.settings) {
                                if (backup.settings.waNumber !== undefined) this.waNumber = backup.settings.waNumber;
                                if (backup.settings.waGatewayUrl !== undefined) this.waGatewayUrl = backup.settings.waGatewayUrl;
                                if (backup.settings.telegramBotToken !== undefined) this.telegramBotToken = backup.settings.telegramBotToken;
                                if (backup.settings.telegramChatId !== undefined) this.telegramChatId = backup.settings.telegramChatId;
                                if (backup.settings.sheetsWebhookUrl !== undefined) this.sheetsWebhookUrl = backup.settings.sheetsWebhookUrl;
                                cloudWrites.push(this.saveSettingsToCloud());
                            }

                            const results = await Promise.all(cloudWrites);
                            const cloudSaved = results.every(result => result === true);
                            this.syncToGoogleSheetsAuto();
                            if (cloudSaved) {
                                this.showToast('Data backup JSON berhasil dipulihkan dan dikonfirmasi Firebase!', 'success');
                            } else {
                                this.showToast('Data backup dimuat ke perangkat, tetapi sebagian/seluruh perubahan belum terkonfirmasi Firebase. Periksa koneksi dan hak akses.', 'error');
                            }
                            event.target.value = '';
                        } catch (err) {
                            this.showToast('Gagal memuat file backup: ' + err.message, 'error');
                        }
                    };
                    reader.readAsText(file);
                },

                async askGeminiForComplaintSuggestion() {
                    const car = (this.vehicles || []).find(v => v && (v.id === this.inServiceForm.vehicleId || v.plate === this.inServiceForm.vehicleId));
                    if (!car) {
                        this.showToast('Pilih kendaraan terlebih dahulu!', 'error');
                        return;
                    }

                    const currentKm = Number(this.inServiceForm.km) || Number(car.currentKm) || 0;
                    const vLogs = this.getVehicleLogs(car.id) || [];

                    const vitalKeys = ['filterOli', 'aki', 'oliMatic', 'ban', 'oliGardan', 'ac', 'kampasRem', 'busi'];
                    const vitalStatus = vitalKeys.map(k => {
                        const wear = this.getComponentWear(car, k);
                        const wearPct = wear.percent === null ? 'belum tercatat' : `${wear.percent}%`;
                        return `- ${this.getComponentNameLabelShort(k)}: Keausan ${wearPct} (${wear.text}), Terakhir: ${wear.lastRecord}`;
                    }).join('\n');

                    const recentLogs = vLogs.slice(0, 5).map(l => {
                        const itemsList = (l && l.items || []).map(i => i.name).join(', ');
                        return `* Tgl ${this.formatDateWib(l.date)} (${(Number(l.km) || 0).toLocaleString('id-ID')} KM @ ${l.workshop}): ${itemsList || 'Servis'}`;
                    }).join('\n') || 'Belum ada catatan riwayat servis sebelumnya.';

                    const lastServKm = this.getVehicleLastServiceKm(car);
                    const lastServDate = this.getVehicleLastServiceDate(car);
                    const diffKmSinceLastService = currentKm - lastServKm;

                    const prompt = `Anda adalah Master Specialist Diagnostik Otomotif & Pengelola Armada Utama Universitas Sebelas Maret (UNS).
Tugas Anda: Lakukan analisis teknis mendalam dan susun instruksi perintah kerja (Work Order) yang SPESIFIK, NATURAL, BERDASARKAN KONDISI REAL & DOKUMEN HISTORIS, TANPA KALIMAT BASA-BASI TEMPLATE.

[PROFIL KENDARAAN FLEET UNS]
- Plat Nomor / Model: ${car.plate} - ${car.model}
- Kategori Operasional: ${car.category || 'Operasional'} | Penanggung Jawab: ${car.driver || 'Sopir UNS'}
- Odometer Terkini: ${currentKm.toLocaleString('id-ID')} KM
- Odometer Servis Rutin Terakhir: ${lastServKm.toLocaleString('id-ID')} KM
- Jarak Tempuh Sejak Servis Rutin Terakhir: ${diffKmSinceLastService.toLocaleString('id-ID')} KM
- Tanggal Servis Rutin Terakhir: ${this.formatDateWib(lastServDate) || 'Belum tercatat'}

[STATUS KEAUSAN MATRIKS 8 KOMPONEN VITAL]
${vitalStatus}

[RIWAYAT DOKUMEN BENGKEL TERDAHULU]
${recentLogs}

Susun dalam format poin bertingkat yang rapi, ringkas, tegas, dan mudah dibaca oleh pengemudi maupun mekanik bengkel mitra.`;

                    this.isAskingGemini = true;
                    this.geminiAiReasoning = '';
                    this.showToast('🚀 Menghubungkan ke Gemini AI API...', 'success');

                    try {
                        const apiKey = (this.geminiApiKey || '').trim();
                        if (!apiKey) {
                            throw new Error('API Key Gemini belum diisi. Atur di menu Bot Notif & AI.');
                        }

                        const modelName = 'gemini-3-flash-preview';
                        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                        const payload = { 
                            contents: [{ parts: [{ text: prompt }] }],
                            systemInstruction: {
                                parts: [{ text: "Anda adalah pakar senior manajemen pemeliharaan armada kendaraan operasional kampus UNS. Berikan hasil analisa spesifik dan aksi pengerjaan servis tanpa kata pembuka/penutup." }]
                            }
                        };

                        let res, result;
                        let retries = 3;
                        let delay = 1000;
                        for (let i = 0; i < retries; i++) {
                            try {
                                res = await fetch(apiUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                });
                                const textRes = await res.text();
                                if (res.ok) {
                                    result = textRes ? JSON.parse(textRes) : {};
                                    break;
                                } else {
                                    let errJson = {};
                                    try { errJson = textRes ? JSON.parse(textRes) : {}; } catch(e) {}
                                    const errMsg = errJson.error?.message || `HTTP ${res.status}`;
                                    if (i === retries - 1) throw new Error(errMsg);
                                }
                            } catch (err) {
                                if (i === retries - 1) throw err;
                            }
                            await new Promise(r => setTimeout(r, delay));
                            delay *= 2;
                        }

                        if (result && result.error) {
                            throw new Error(result.error.message || 'Respons error dari Gemini API');
                        }

                        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            const cleanedText = text.trim();
                            this.inServiceForm.notes = cleanedText;
                            this.geminiAiReasoning = cleanedText;
                            this.showToast('✨ Diagnostik AI Gemini Berhasil!', 'success');
                        } else {
                            throw new Error('Respons dari Gemini API kosong');
                        }
                    } catch (e) {
                        console.warn('Gagal memanggil Gemini API:', e);
                        this.showToast(`⚠️ API Gemini Gagal: ${e.message}. Menggunakan Diagnostik SOP Lokal.`, 'error');
                        this.applyLocalSopRecommendation(car, currentKm, e.message);
                    } finally {
                        this.isAskingGemini = false;
                    }
                },

                applyLocalSopRecommendation(car, currentKm, errorReason = '') {
                    const vitalKeys = ['filterOli', 'aki', 'oliMatic', 'ban', 'oliGardan', 'ac', 'kampasRem', 'busi'];
                    const criticalComponents = [];
                    
                    vitalKeys.forEach(k => {
                        const wear = this.getComponentWear(car, k);
                        const label = this.getComponentNameLabelShort(k);
                        if (wear.percent >= 80) {
                            criticalComponents.push(`${label} (Keausan ${wear.percent}%)`);
                        }
                    });

                    const lastServKm = this.getVehicleLastServiceKm(car);
                    const diffKm = currentKm - lastServKm;
                    const modelLower = (car.model || '').toLowerCase();
                    let recommendations = [];

                    if (diffKm >= 35000) {
                        recommendations.push(`• [MAJOR SERVICE KM ${currentKm.toLocaleString('id-ID')}] Kuras total: Oli mesin, filter oli, oli transmisi/matic, oli gardan, minyak rem, & coolant radiator.`);
                    } else {
                        recommendations.push(`• [SERVIS RUTIN MAINTENANCE] Ganti oli mesin & filter oli, pembersihan saringan udara, serta inspeksi sistem pengereman.`);
                    }

                    if (modelLower.includes('hiace') || modelLower.includes('commuter') || modelLower.includes('diesel') || modelLower.includes('l300')) {
                        if (currentKm >= 120000) {
                            recommendations.push(`• [KHUSUS DIESEL/HIACE] Wajib ganti Tensioner Belt, Drive Belt/Fan Belt Set, inspeksi Water Pump, & kalibrasi/cleaning injektor diesel.`);
                        }
                    }

                    if (currentKm >= 100000) {
                        recommendations.push(`• [INSPEKSI KM TINGGI] Ganti Seal Dek Klep (Gasket Valve Cover) untuk cegah rembesan oli ke ruang busi/mesin, serta periksa Bushing Arm, Shockbreaker, & Engine Mounting.`);
                    }

                    if (criticalComponents.length > 0) {
                        recommendations.push(`• [REKOMENDASI GANTI] ${criticalComponents.join(', ')}.`);
                    }

                    const resultNote = recommendations.join('\n');
                    this.inServiceForm.notes = resultNote;
                    this.geminiAiReasoning = resultNote;
                }
            }
        });

        vueApp.mount('#app');

        setTimeout(() => {
            const appEl = document.getElementById('app');
            if (appEl && appEl.hasAttribute('v-cloak')) {
                appEl.removeAttribute('v-cloak');
            }
        }, 1200);
		        // ============================================================
        // FCM TEST - AUTONMAN APK
        // Hanya untuk APK di C:\AUTOMAN_APK
        // Belum menyimpan token ke Firebase.
        // ============================================================
        async function initAutomanFCMTest() {
            try {
                const capacitor = window.Capacitor;
                const PushNotifications =
                    capacitor?.Plugins?.PushNotifications;

                if (!PushNotifications) {
                    console.log(
                        '[FCM TEST] PushNotifications plugin belum tersedia.'
                    );
                    return;
                }

                console.log(
                    '[FCM TEST] PushNotifications plugin ditemukan.'
                );

                await PushNotifications.addListener(
                    'registration',
                    async token => {
					console.log(
						'[FCM TEST] RAW TOKEN OBJECT:',
						JSON.stringify(token)
						);
                        const fcmToken =
                            String(token?.value || '').trim();

                        if (!fcmToken) {
                            console.error(
                                '[FCM TEST] Token FCM kosong.'
                            );
                            return;
                        }

                        console.log(
                            '=========================================='
                        );
                        console.log(
                            '[FCM TEST] FCM TOKEN:'
                        );
                        console.log(fcmToken);
                        console.log(
                            '=========================================='
                        );

                        // Hanya menyimpan sementara di HP test.
                        localStorage.setItem(
                            'automan_test_fcm_token',
                            fcmToken
                        );

                        window.__AUTOMAN_FCM_TOKEN = fcmToken;
						try {
  let currentUser = auth?.currentUser || null;

// Tunggu Firebase Authentication selesai maksimal 15 detik.
for (let i = 0; i < 30 && !currentUser; i++) {
  await new Promise(resolve => setTimeout(resolve, 500));
  currentUser = auth?.currentUser || null;
}

if (!currentUser) {
  console.warn(
    '[FCM TEST] Firebase user belum tersedia setelah menunggu 15 detik. Token tidak disimpan.'
  );
  return;
}

console.log('[FCM TEST] Firebase user siap:', currentUser.uid);

  const tokenBytes = new TextEncoder().encode(fcmToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  const tokenId = hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32);

  await notificationTokenRepository.saveToken(tokenId, {
    token: fcmToken,
    uid: currentUser.uid,
    app: 'automan',
    platform: 'android',
    deviceName: 'Google Pixel 8',
    updatedAt: Date.now(),
    enabled: true
  });

  console.log('[FCM TEST] Token berhasil disimpan ke Firebase.');
} catch (firebaseError) {
  console.error(
    '[FCM TEST] Gagal menyimpan token ke Firebase:',
    firebaseError
  );
}
                    }
                );

                await PushNotifications.addListener(
                    'registrationError',
                    error => {
                        console.error(
                            '[FCM TEST] Registration error:',
                            error
                        );
                    }
                );

                await PushNotifications.addListener(
                    'pushNotificationReceived',
                    notification => {
                        console.log(
                            '[FCM TEST] Notification received:',
                            notification
                        );
                    }
                );

                await PushNotifications.addListener(
                    'pushNotificationActionPerformed',
                    notification => {
                        console.log(
                            '[FCM TEST] Notification action:',
                            notification
                        );
                    }
                );

                // Notification channel Android.
                try {
                    await PushNotifications.createChannel({
                        id: 'automan_default',
                        name: 'Automan',
                        description:
                            'Notifikasi sistem Automan UNS',
                        importance: 5,
                        visibility: 1,
                        sound: 'default'
                    });

                    console.log(
                        '[FCM TEST] Notification channel siap.'
                    );
                } catch (channelError) {
                    console.warn(
                        '[FCM TEST] Channel warning:',
                        channelError
                    );
                }

                let permission =
                    await PushNotifications.checkPermissions();

                console.log(
                    '[FCM TEST] Permission awal:',
                    permission
                );

                if (permission.receive === 'prompt') {
                    permission =
                        await PushNotifications.requestPermissions();

                    console.log(
                        '[FCM TEST] Permission setelah request:',
                        permission
                    );
                }

                if (permission.receive !== 'granted') {
                    console.warn(
                        '[FCM TEST] Izin notifikasi ditolak.'
                    );
                    return;
                }

                await PushNotifications.register();

                console.log(
                    '[FCM TEST] Register FCM berhasil dipanggil.'
                );

            } catch (error) {
                console.error(
                    '[FCM TEST] Init error:',
                    error
                );
            }
        }

        // Beri waktu Capacitor native bridge selesai dimuat.
        setTimeout(() => {
            initAutomanFCMTest();
        }, 2000);
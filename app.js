class FinanceApp {
    constructor() {
        // Carga inicial desde localStorage (caché local)
        const savedData = localStorage.getItem('financeData');
        this.data = savedData ? JSON.parse(savedData) : this.getInitialData();
        this.currentYear = localStorage.getItem('currentYear') || "2023";
        this.months = [
            'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ];
        this.showOnlyDataMonths = false;
        this.saveTimeout = null;

        this.init();
        this.initFirestore();
    }

    // ─── FIREBASE ────────────────────────────────────────────────────────────

    initFirestore() {
        const docRef = db.collection('contabilidad').doc('datos');

        // Escucha en tiempo real: actualiza la app cuando hay cambios desde otro dispositivo
        docRef.onSnapshot((doc) => {
            // Si el cambio viene de este mismo dispositivo (todavía pendiente de sync), ignorar
            if (doc.metadata.hasPendingWrites) return;

            if (doc.exists) {
                const remote = doc.data();
                this.data = remote.financeData;
                this.currentYear = remote.currentYear || this.currentYear;

                // Actualizar caché local
                localStorage.setItem('financeData', JSON.stringify(this.data));
                localStorage.setItem('currentYear', this.currentYear);
                this.render();
                this.setSyncStatus('synced');
            } else {
                // Si no existe nada en la nube todavía (primera vez), 
                // pero tenemos datos locales que no son los de ejemplo, los subimos.
                const isInitialDefault = JSON.stringify(this.data) === JSON.stringify(this.getInitialData());
                if (!isInitialDefault) {
                    console.log('Detectados datos locales. Inicializando servidor...');
                    this.save();
                } else {
                    this.setSyncStatus('synced');
                }
            }
        }, (error) => {
            console.error('Error Firestore:', error);
            this.setSyncStatus('error');
        });
    }

    setSyncStatus(status) {
        const el = document.getElementById('syncIndicator');
        if (!el) return;
        const states = {
            syncing: { text: '🔄 Guardando...', cls: 'sync-indicator syncing' },
            synced:  { text: '☁️ Sincronizado',  cls: 'sync-indicator synced' },
            error:   { text: '⚠️ Sin conexión',  cls: 'sync-indicator error' }
        };
        const s = states[status] || states.error;
        el.textContent = s.text;
        el.className = s.cls;
    }

    // ─── CORE ────────────────────────────────────────────────────────────────

    getInitialData() {
        return {
            "2023": {
                accounts: {
                    "CUENTA NOMINA ING": [5267.72, 5728.32, 5993.77, 6025.0, 3810.89, 4327.11, 4761.82, 5229.91, 5882.81, 6561.87, 2754.72, 4358.78],
                    "CUENTA NARANJA ING": [16714.88, 16914.88, 17122.23, 17330.48, 17541.96, 17753.96, 17968.65, 18184.02, 18399.57, 18614.8, 16830.72, 17049.07],
                    "FONDO INVERSION ING": [5931.64, 5810.88, 5812.26, 5812.01, 6011.47, 6031.09, 6226.14, 6136.84, 5982.51, 5817.52, 6153.41, 6344.86],
                    "CUENTA CORRIENTE OPEN": [1.14, 9.91, 19.32, 19.49, 5.27, 0.2, 38.71, 98.07, 27.82, 100.64, 9.49, 23.97],
                    "CUENTA AHORRO OPEN": [2725.46, 2825.46, 2905.55, 3505.65, 3995.76, 3995.88, 4066.01, 4066.15, 4066.29, 4066.43, 651.57, 551.69],
                    "RAISIN": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10000.0, 10000.0],
                    "INVERSION DE GIRO": [2394.13, 2317.5, 2323.01, 2323.46, 2384.34, 2469.45, 2531.08, 2513.39, 2474.24, 2390.75, 2525.58, 2621.61]
                }
            }
        };
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.render();
    }

    cacheDOM() {
        this.yearList = document.getElementById('yearList');
        this.addYearBtn = document.getElementById('addYearBtn');
        this.currentYearTitle = document.getElementById('currentYearTitle');
        this.addAccountBtn = document.getElementById('addAccountBtn');
        this.toggleMonthsBtn = document.getElementById('toggleMonthsBtn');
        this.menuToggle = document.getElementById('menuToggle');
        this.sidebar = document.getElementById('sidebar');
        this.tableHeader = document.getElementById('tableHeader');
        this.tableBody = document.getElementById('tableBody');
        this.tableFooter = document.getElementById('tableFooter');

        // Modal
        this.accountModal = document.getElementById('accountModal');
        this.accountNameInput = document.getElementById('accountName');
        this.saveAccountBtn = document.getElementById('saveAccount');
        this.cancelModalBtn = document.getElementById('cancelModal');
    }

    bindEvents() {
        this.addYearBtn.onclick = () => this.addNewYear();
        this.addAccountBtn.onclick = () => this.showModal();
        this.menuToggle.onclick = () => this.toggleSidebar();
        this.toggleMonthsBtn.onclick = () => this.toggleMonthVisibility();
        this.cancelModalBtn.onclick = () => this.hideModal();
        this.saveAccountBtn.onclick = () => this.addAccount();

        window.onclick = (event) => {
            if (event.target == this.accountModal) this.hideModal();
        };
    }

    save() {
        // Limpiar cualquier timeout pendiente de guardado debounced
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        
        this._performSave();
    }

    // Guardado con debounce para mejorar el rendimiento de la sincronización
    saveDebounced() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this._performSave();
        }, 800); // 800ms de espera antes de subir a la nube
    }

    _performSave() {
        // 1. Guardar en localStorage (caché local)
        localStorage.setItem('financeData', JSON.stringify(this.data));
        localStorage.setItem('currentYear', this.currentYear);

        // 2. Guardar en Firestore (nube)
        this.setSyncStatus('syncing');
        db.collection('contabilidad').doc('datos').set({
            financeData: this.data,
            currentYear: this.currentYear,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            this.setSyncStatus('synced');
        }).catch((err) => {
            console.error('Error guardando en Firestore:', err);
            this.setSyncStatus('error');
        });
    }

    render() {
        this.currentYearTitle.innerText = `Dashboard ${this.currentYear}`;
        this.renderYearList();
        this.renderTable();
    }

    renderYearList() {
        this.yearList.innerHTML = '';
        Object.keys(this.data).sort().reverse().forEach(year => {
            const li = document.createElement('li');
            li.innerText = year;
            if (year === this.currentYear) li.classList.add('active');
            li.onclick = () => {
                this.currentYear = year;
                this.render();
                this.save();
                this.sidebar.classList.remove('active');
            };
            this.yearList.appendChild(li);
        });
    }

    addNewYear() {
        const year = prompt('Introduce el año:');
        if (year && !this.data[year]) {
            const prevYear = Object.keys(this.data).sort().reverse()[0];
            const accounts = this.data[prevYear] ? Object.keys(this.data[prevYear].accounts) : [];

            this.data[year] = { accounts: {} };
            accounts.forEach(acc => {
                this.data[year].accounts[acc] = new Array(12).fill(0);
            });

            this.currentYear = year;
            this.render();
            this.save();
        }
    }

    showModal() {
        this.accountModal.style.display = 'flex';
        this.accountNameInput.focus();
    }

    hideModal() {
        this.accountModal.style.display = 'none';
        this.accountNameInput.value = '';
    }

    addAccount() {
        const name = this.accountNameInput.value.trim();
        if (name) {
            if (!this.data[this.currentYear].accounts[name]) {
                this.data[this.currentYear].accounts[name] = new Array(12).fill(0);
                this.hideModal();
                this.render();
                this.save();
            } else {
                alert('Esa cuenta ya existe.');
            }
        }
    }

    toggleMonthVisibility() {
        this.showOnlyDataMonths = !this.showOnlyDataMonths;
        this.toggleMonthsBtn.innerText = this.showOnlyDataMonths ? 'Mostrar todos los meses' : 'Ocultar meses con datos';
        this.render();
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('active');
    }

    renderTable() {
        const accounts = Object.keys(this.data[this.currentYear].accounts);

        const visibleMonthIndices = [];
        if (this.showOnlyDataMonths) {
            for (let mIdx = 0; mIdx < 12; mIdx++) {
                const hasData = accounts.some(acc => this.data[this.currentYear].accounts[acc][mIdx] > 0);
                if (!hasData) visibleMonthIndices.push(mIdx);
            }
            if (visibleMonthIndices.length === 0) {
                for (let i = 0; i < 12; i++) visibleMonthIndices.push(i);
            }
        } else {
            for (let i = 0; i < 12; i++) visibleMonthIndices.push(i);
        }

        // Header
        this.tableHeader.innerHTML = '<th>Cuenta</th>';
        visibleMonthIndices.forEach(mIdx => {
            const th = document.createElement('th');
            th.innerText = this.months[mIdx];
            this.tableHeader.appendChild(th);
        });

        // Body
        this.tableBody.innerHTML = '';
        accounts.forEach(acc => {
            const tr = document.createElement('tr');

            const tdName = document.createElement('td');
            tdName.className = 'account-name-cell';
            tdName.innerHTML = `<span>${acc}</span> <span class="delete-acc" title="Eliminar cuenta">×</span>`;
            tdName.querySelector('.delete-acc').onclick = () => this.deleteAccount(acc);
            tr.appendChild(tdName);

            visibleMonthIndices.forEach(mIdx => {
                const val = this.data[this.currentYear].accounts[acc][mIdx];
                const td = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'finance-input';
                input.value = this.formatNumber(val);
                input.placeholder = '0,00';

                input.onfocus = (e) => {
                    const rawVal = this.data[this.currentYear].accounts[acc][mIdx];
                    e.target.value = rawVal === 0 ? '' : rawVal.toString().replace('.', ',');
                };

                input.onchange = (e) => {
                    this.updateValue(acc, mIdx, e.target.value);
                };

                td.appendChild(input);
                tr.appendChild(td);
            });

            this.tableBody.appendChild(tr);
        });

        this.renderFooter(accounts, visibleMonthIndices);
    }

    renderFooter(accounts, visibleMonthIndices) {
        this.tableFooter.innerHTML = '<td><strong>TOTAL MENSUAL</strong></td>';

        const monthlyTotals = new Array(12).fill(0);
        accounts.forEach(acc => {
            this.data[this.currentYear].accounts[acc].forEach((val, mIdx) => {
                monthlyTotals[mIdx] += val;
            });
        });

        visibleMonthIndices.forEach(mIdx => {
            const mTotal = monthlyTotals[mIdx];
            const td = document.createElement('td');
            td.innerHTML = `<strong>${this.formatCurrency(mTotal)}</strong>`;
            this.tableFooter.appendChild(td);
        });
    }

    updateValue(acc, monthIdx, value) {
        const numVal = this.parseNumber(value);
        this.data[this.currentYear].accounts[acc][monthIdx] = numVal;
        this.render();
        this.saveDebounced();
    }

    deleteAccount(name) {
        if (confirm(`¿Eliminar la cuenta "${name}"?`)) {
            delete this.data[this.currentYear].accounts[name];
            this.render();
            this.save();
        }
    }

    formatNumber(val) {
        if (val === 0) return '';
        return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    }

    parseNumber(str) {
        if (!str) return 0;
        const cleanStr = str.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(cleanStr) || 0;
    }

    formatCurrency(val) {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(val);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new FinanceApp();
});

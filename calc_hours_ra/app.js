// calc_hours_ra/app.js
// Helpers
const $ = id => document.getElementById(id);

function parseDate(s) {
    if (!s) return null;
    // If format is dd/mm/yyyy, parse accordingly
    const dmy = s.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/);
    if (dmy) {
        const day = Number(dmy[1]), month = Number(dmy[2]), year = Number(dmy[3]);
        const dd = new Date(year, month - 1, day);
        if (isNaN(dd)) return null; return dd;
    }
    // Accept ISO-like YYYY-MM-DD (from <input type=date>)
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d)) return null; return d;
}

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function fmtISO(d) { if (!d) return '—'; const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}` }

// Formato de salida dd/mm/yy
function fmtDisplay(d) { if (!d) return '—'; const day = String(d.getDate()).padStart(2, '0'); const month = String(d.getMonth() + 1).padStart(2, '0'); const year = String(d.getFullYear()).slice(-2); return `${day}/${month}/${year}` }

// Parse vacations: single date or range. Ranges can use ':' or '-' as separator.
function parseVacations(text) {
    const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
    const set = new Set();
    for (const line of lines) {
        // look for ISO dates (YYYY-MM-DD) or DMY dates (dd/mm/yyyy)
        const isoFound = line.match(/\d{4}-\d{2}-\d{2}/g) || [];
        const dmyFound = line.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
        if ((isoFound.length + dmyFound.length) === 1) {
            const s = (isoFound[0] || dmyFound[0]); const d = parseDate(s); if (d) set.add(fmtISO(d));
            continue;
        }
        if ((isoFound.length + dmyFound.length) >= 2) {
            const s1 = (isoFound[0] || dmyFound[0]);
            const s2 = (isoFound[1] || dmyFound[1]);
            const a = parseDate(s1), b = parseDate(s2);
            if (a && b) { let cur = a; while (cur <= b) { set.add(fmtISO(cur)); cur = addDays(cur, 1); } }
            continue;
        }
        // fallback: split by ':' or '-' (with spaces) tokens
        let sep = null;
        if (line.includes(':')) sep = ':'; else if (line.includes(' - ')) sep = ' - '; else if (line.includes('-') && line.split('-').length === 3) sep = ' - ';
        if (sep) {
            const parts = line.split(sep).map(p => p.trim());
            const left = parts[0], right = parts[parts.length - 1];
            const a = parseDate(left), b = parseDate(right);
            if (a && b) { let cur = a; while (cur <= b) { set.add(fmtISO(cur)); cur = addDays(cur, 1); } }
            continue;
        }
        // if nothing matched, skip
    }
    return set;
}

// RA list UI
const raList = $('raList');

function addRARow(name = '', hours = '') {
    const div = document.createElement('div'); div.className = 'ra-row';
    div.innerHTML = `<input class="ra-name" placeholder="Nom RA" value="${escapeHtml(name)}"> <input class="ra-hours" placeholder="Hores totals" type="number" min="0" step="0.5" value="${hours}"> <button class="remove">Eliminar</button>`;
    raList.appendChild(div);
    div.querySelector('.remove').addEventListener('click', () => div.remove());
}

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

$('addRA').addEventListener('click', () => addRARow());
$('clearRAs').addEventListener('click', () => { if (confirm('Netejar totes les RAs?')) raList.innerHTML = ''; });

// Gather and set state (for export/import)
function gatherState() {
    const start = $('startDate').value; const end = $('endDate').value;
    const vac = $('vacations').value;
    const week = [];
    for (let i = 0; i < 7; i++) week.push(Number($('w' + i).value) || 0);
    const ras = [];
    document.querySelectorAll('.ra-row').forEach(r => {
        const name = r.querySelector('.ra-name').value || 'RA';
        const hrs = Number(r.querySelector('.ra-hours').value) || 0;
        ras.push({ name, hrs });
    });
    return { start, end, vac, week, ras };
}

function setState(state) {
    $('startDate').value = state.start || '';
    $('endDate').value = state.end || '';
    $('vacations').value = state.vac || '';
    if (state.week && state.week.length === 7) { for (let i = 0; i < 7; i++) $('w' + i).value = state.week[i]; }
    raList.innerHTML = '';
    if (state.ras && Array.isArray(state.ras)) { for (const r of state.ras) addRARow(r.name, r.hrs); }
}

// Export/import
$('exportBtn').addEventListener('click', () => {
    const data = gatherState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ra_schedule.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

$('importFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const text = await f.text();
    try {
        const parsed = JSON.parse(text);
        setState(parsed);
        alert('Importat correctament');
    } catch (err) { alert('Error llegint el fitxer: ' + err.message); }
});

// Make import button open the hidden file input
const importBtn = $('importBtn');
if (importBtn) { importBtn.addEventListener('click', () => { const f = $('importFile'); if (f) f.click(); }); }

// Reset
$('reset').addEventListener('click', () => {
    if (!confirm('Netejar tota la informació?')) return;
    $('startDate').value = ''; $('endDate').value = ''; $('vacations').value = ''; for (let i = 0; i < 7; i++) $('w' + i).value = '0'; raList.innerHTML = ''; $('results').hidden = true; document.querySelector('#resultTable tbody').innerHTML = '';
});

// Build list of class days (exclude vacations), returns array of {date:Date, hours:Number}
function buildClassDays(start, end, weekHours, vacationsSet) {
    const a = parseDate(start); const b = parseDate(end);
    if (!a || !b || a > b) return [];
    const days = [];
    let cur = a;
    while (cur <= b) {
        const key = fmtISO(cur);
        if (!vacationsSet.has(key)) {
            // JS getDay: 0=Sun,1=Mon... Map Monday->idx0
            let jsDay = cur.getDay();
            const idx = (jsDay === 0) ? 6 : (jsDay - 1);
            const hours = Number(weekHours[idx]) || 0;
            if (hours > 0) days.push({ date: new Date(cur), hours });
        }
        cur = addDays(cur, 1);
    }
    return days;
}

// Calculation: sequentially assign RA hours to classDays
function calculateSchedule() {
    const state = gatherState();
    if (!state.start || !state.end) { alert('Introdueix dates d\'inici i fi'); return; }
    if (state.ras.length === 0) { alert('Afegeix almenys una RA'); return; }
    const vacSet = parseVacations(state.vac || '');
    const classDays = buildClassDays(state.start, state.end, state.week, vacSet);
    if (classDays.length === 0) { alert('No hi ha dies de classe dins l\'interval (o hores per dia = 0)'); return; }

    const results = [];
    let dayIndex = 0;
    for (const ra of state.ras) {
        let remaining = Number(ra.hrs || 0);
        let startDate = null; let endDate = null; let daysUsed = 0;
        while (remaining > 0 && dayIndex < classDays.length) {
            const day = classDays[dayIndex];
            if (day.hours > 0) {
                if (!startDate) startDate = new Date(day.date);
                const used = Math.min(day.hours, remaining);
                remaining -= used;
                daysUsed += (used > 0) ? 1 : 0;
                if (remaining > 0) dayIndex++;
                else { endDate = new Date(day.date); dayIndex++; }
            } else {
                dayIndex++;
            }
        }
        let comment = '';
        if (remaining > 0) comment = `No s'ha completat: falten ${remaining} h dins l'interval`;
        results.push({ name: ra.name, hours: ra.hrs, start: startDate ? fmtDisplay(startDate) : '—', end: endDate ? fmtDisplay(endDate) : (startDate ? fmtDisplay(startDate) : '—'), daysUsed, comment });
    }

    // Show results
    ShowResuls(results);
}

function ShowResuls(results) {
    const tbody = document.querySelector('#resultTable tbody'); tbody.innerHTML = '';
    for (const r of results) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escapeHtml(r.name)}</td><td>${r.hours}</td><td>${r.start}</td><td>${r.end}</td><td>${r.daysUsed}</td><td>${escapeHtml(r.comment)}</td>`;
        tbody.appendChild(tr);
    }
    $('results').hidden = false;
}

$('calculate').addEventListener('click', calculateSchedule);

// add one example row to start
addRARow('RA1', '20');




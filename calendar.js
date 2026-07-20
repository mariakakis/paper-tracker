let pickerOverlay = null;
let calTooltipEl = null;

function showCustomDatePicker(anchor, currentDate, onSelect) {
    dismissDatePicker();

    const container = anchor.closest('dialog') || document.body;

    const overlay = document.createElement('div');
    overlay.className = 'date-picker-overlay';

    const popup = document.createElement('div');
    popup.className = 'date-picker-popup';

    let year = currentDate ? parseInt(currentDate.split('-')[0]) : new Date().getFullYear();
    let month = currentDate ? parseInt(currentDate.split('-')[1]) - 1 : new Date().getMonth();

    function renderPicker() {
        popup.innerHTML = '';
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

        const header = document.createElement('div');
        header.className = 'dp-header';

        const prev = document.createElement('button');
        prev.className = 'dp-nav-btn';
        prev.innerHTML = '\u25C0';
        prev.addEventListener('click', (e) => { e.stopPropagation(); month--; if (month < 0) { month = 11; year--; } renderPicker(); });

        const title = document.createElement('span');
        title.className = 'dp-title';
        title.textContent = monthNames[month] + ' ' + year;

        const next = document.createElement('button');
        next.className = 'dp-nav-btn';
        next.innerHTML = '\u25B6';
        next.addEventListener('click', (e) => { e.stopPropagation(); month++; if (month > 11) { month = 0; year++; } renderPicker(); });

        header.appendChild(prev);
        header.appendChild(title);
        header.appendChild(next);
        popup.appendChild(header);

        const dayHeaders = document.createElement('div');
        dayHeaders.className = 'dp-days-row dp-header-row';
        ['S','M','T','W','T','F','S'].forEach(d => {
            const el = document.createElement('span');
            el.className = 'dp-day-header';
            el.textContent = d;
            dayHeaders.appendChild(el);
        });
        popup.appendChild(dayHeaders);

        const grid = document.createElement('div');
        grid.className = 'dp-days-row dp-days-grid';

        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement('span'));
        }

        const todayStr = getTodayString();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const el = document.createElement('span');
            el.className = 'dp-day';
            if (dateStr === todayStr) el.classList.add('dp-today');
            if (dateStr === currentDate) el.classList.add('dp-selected');
            el.textContent = day;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                onSelect(dateStr);
                dismissDatePicker();
            });
            grid.appendChild(el);
        }

        popup.appendChild(grid);

        const todayBtn = document.createElement('button');
        todayBtn.className = 'dp-today-btn';
        todayBtn.textContent = 'Today';
        todayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelect(todayStr);
            dismissDatePicker();
        });
        popup.appendChild(todayBtn);
    }

    renderPicker();
    overlay.appendChild(popup);
    container.appendChild(overlay);

    const rect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + popupRect.width > window.innerWidth - 8) left = window.innerWidth - popupRect.width - 8;
    if (top + popupRect.height > window.innerHeight - 8) top = rect.top - popupRect.height - 4;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) dismissDatePicker();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dismissDatePicker();
    });

    pickerOverlay = overlay;
}

function dismissDatePicker() {
    if (pickerOverlay) {
        pickerOverlay.remove();
        pickerOverlay = null;
    }
}

function showCalTooltip(anchor, papers) {
    hideCalTooltip();
    const el = document.createElement('div');
    el.className = 'cal-tooltip';
    papers.forEach(p => {
        const row = document.createElement('div');
        row.className = 'cal-tooltip-row';
        row.textContent = p;
        el.appendChild(row);
    });
    const container = document.getElementById('calendarBody');
    container.appendChild(el);

    const rect = anchor.getBoundingClientRect();
    const tipRect = el.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    let left = rect.left - contRect.left + rect.width / 2 - tipRect.width / 2;
    let top = rect.bottom - contRect.top + 4;
    if (left < 4) left = 4;
    if (left + tipRect.width > contRect.width - 4) left = contRect.width - tipRect.width - 4;
    if (top + tipRect.height > contRect.height - 4) top = rect.top - contRect.top - tipRect.height - 6;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    calTooltipEl = el;
}

function hideCalTooltip() {
    if (calTooltipEl) {
        calTooltipEl.remove();
        calTooltipEl = null;
    }
}

function showCalendarView() {
    const modal = document.getElementById('calendarModal');
    const body = document.getElementById('calendarBody');
    body.innerHTML = '';

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const deadlineMap = {};
    getItems().forEach(p => {
        if (!p.deadline_date) return;
        if (!deadlineMap[p.deadline_date]) deadlineMap[p.deadline_date] = [];
        deadlineMap[p.deadline_date].push(p.name);
    });

    const monthsWrapper = document.createElement('div');
    monthsWrapper.className = 'calendar-months-row';

    for (let offset = 0; offset < 4; offset++) {
        const m = currentMonth + offset;
        const year = currentYear + Math.floor(m / 12);
        const month = m % 12;
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

        const monthBlock = document.createElement('div');
        monthBlock.className = 'calendar-month';

        const title = document.createElement('div');
        title.className = 'calendar-month-title';
        title.textContent = monthNames[month] + ' ' + year;
        monthBlock.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'calendar-grid';

        ['S','M','T','W','T','F','S'].forEach(d => {
            const h = document.createElement('div');
            h.className = 'calendar-day-header';
            h.textContent = d;
            grid.appendChild(h);
        });

        for (let i = 0; i < firstDay; i++) {
            grid.appendChild(document.createElement('div'));
        }

        const todayStr = getTodayString();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            if (dateStr === todayStr) cell.classList.add('today');
            const dayNum = document.createElement('span');
            dayNum.className = 'calendar-day-num';
            dayNum.textContent = day;
            cell.appendChild(dayNum);
            if (deadlineMap[dateStr]) {
                cell.classList.add('has-deadline');
                cell.dataset.papers = deadlineMap[dateStr].join('\n');
                const dotsRow = document.createElement('div');
                dotsRow.className = 'cal-dots-row';
                deadlineMap[dateStr].forEach(() => {
                    const dot = document.createElement('span');
                    dot.className = 'cal-dot';
                    dotsRow.appendChild(dot);
                });
                cell.appendChild(dotsRow);

                cell.addEventListener('mouseenter', () => {
                    showCalTooltip(cell, deadlineMap[dateStr]);
                });
                cell.addEventListener('mouseleave', () => {
                    hideCalTooltip();
                });
            }
            grid.appendChild(cell);
        }

        monthBlock.appendChild(grid);
        monthsWrapper.appendChild(monthBlock);
    }

    body.appendChild(monthsWrapper);
    modal.showModal();
}

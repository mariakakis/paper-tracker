let editingPaperIndex = null;

const ICONS = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="16" y2="14"></line><line x1="8" y1="18" x2="16" y2="18"></line></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
    archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'
};

function renderDashboard() {
    const container = document.getElementById('boardContainer');
    container.innerHTML = '';
    container.className = 'board-grid paper-columns-layout';
    renderPaperColumns(container);
    updateArchiveBadge();
}

function renderPaperColumns(container) {
    getItems().forEach((paper, pIdx) => {
        const column = createColumnElement(paper, pIdx);
        container.appendChild(column);
    });
    setupColumnDragDrop(container);
}

function createColumnElement(paper, pIdx) {
    const column = document.createElement('div');
    column.className = 'board-column';
    column.dataset.paperIndex = pIdx;

    column.appendChild(createColumnWithSubheader(paper, pIdx));

    const cardsContainer = createCardsContainer(paper, pIdx);
    column.appendChild(cardsContainer);

    const addBtn = document.createElement('button');
    addBtn.className = 'add-card-btn';
    addBtn.innerHTML = ICONS.add + ' Add Section';
    addBtn.addEventListener('click', () => createNewSection(pIdx));
    column.appendChild(addBtn);

    return column;
}

function createColumnWithSubheader(paper, pIdx) {
    const header = document.createElement('div');
    header.className = 'column-header';

    const headerTop = document.createElement('div');
    headerTop.className = 'column-header-top';

    const title = document.createElement('h3');
    title.textContent = paper.name;
    title.title = paper.name;
    enableInlineEdit(title, (newName) => {
        getItems()[pIdx].name = newName;
        saveToLocalStorage();
        renderDashboard();
    });

    const headerActions = document.createElement('div');
    headerActions.className = 'column-header-actions';

    const noteBtn = createPaperNoteButton(pIdx);
    headerActions.appendChild(noteBtn);

    const archiveBtn = createArchivePaperButton(pIdx);
    headerActions.appendChild(archiveBtn);

    const dragHandle = createDragHandle(pIdx);
    headerActions.appendChild(dragHandle);

    headerTop.appendChild(title);
    headerTop.appendChild(headerActions);
    header.appendChild(headerTop);

    const subheader = createColumnSubheader(paper);
    header.appendChild(subheader);

    return header;
}

function createPaperNoteButton(pIdx) {
    const paper = getItems()[pIdx];
    const btn = document.createElement('button');
    btn.className = 'card-action-btn note-btn';
    btn.title = paper.notes || 'Paper notes';
    btn.innerHTML = ICONS.edit;
    if (paper.notes) {
        const badge = document.createElement('span');
        badge.className = 'note-badge-dot';
        btn.appendChild(badge);
    }
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPaperNoteEditor(pIdx);
    });
    return btn;
}

function createArchivePaperButton(pIdx) {
    const btn = document.createElement('button');
    btn.className = 'card-action-btn';
    btn.title = 'Archive paper';
    btn.innerHTML = ICONS.archive;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        archivePaper(pIdx);
    });
    return btn;
}

function createDragHandle(pIdx) {
    const handle = document.createElement('span');
    handle.className = 'column-drag-handle';
    handle.innerHTML = ICONS.menu;
    handle.title = 'Drag to reorder';
    handle.draggable = true;

    handle.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        const col = handle.closest('.board-column');
        col.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'column:' + col.dataset.paperIndex);
    });

    handle.addEventListener('dragend', (e) => {
        e.stopPropagation();
        const col = handle.closest('.board-column');
        if (col) col.classList.remove('dragging');
        document.querySelectorAll('.board-column').forEach(c => c.classList.remove('drag-over'));
    });

    return handle;
}

function createColumnSubheader(paper) {
    const subheader = document.createElement('div');
    subheader.className = 'column-subheader';

    const deadInfo = getPaperDeadlineStatus(paper);

    const deadlineEl = document.createElement('span');
    deadlineEl.className = `deadline-indicator ${deadInfo.class}`;
    deadlineEl.innerHTML = deadInfo.text;

    const dateLike = document.createElement('span');
    dateLike.className = 'card-date';
    dateLike.innerHTML = formatDisplayDate(paper.deadline_date);
    dateLike.style.cursor = 'pointer';
    dateLike.addEventListener('click', (e) => {
        e.stopPropagation();
        showCustomDatePicker(dateLike, paper.deadline_date || getTodayString(), (val) => {
            paper.deadline_date = val;
            saveToLocalStorage();
            renderDashboard();
        });
    });

    let unstartedCount = 0, overdueCount = 0, needsReviewCount = 0, upToDateCount = 0;
    paper.sections.forEach(sec => {
        const urg = getSectionUrgency(sec);
        if (urg === 'unstarted') unstartedCount++;
        else if (urg === 'overdue') overdueCount++;
        else if (urg === 'needsreview') needsReviewCount++;
        else if (urg === 'uptodate') upToDateCount++;
    });

    const statusEl = document.createElement('span');
    statusEl.className = 'column-status-summary';
    const parts = [];
    if (unstartedCount) parts.push(`<span class="status-dot-gray"></span>${unstartedCount}`);
    if (overdueCount) parts.push(`<span class="status-dot-red"></span>${overdueCount}`);
    if (needsReviewCount) parts.push(`<span class="status-dot-yellow"></span>${needsReviewCount}`);
    if (upToDateCount) parts.push(`<span class="status-dot-green"></span>${upToDateCount}`);
    statusEl.innerHTML = parts.join('') || '';

    const leftGroup = document.createElement('div');
    leftGroup.className = 'column-subheader-left';
    leftGroup.appendChild(dateLike);
    leftGroup.appendChild(deadlineEl);
    subheader.appendChild(leftGroup);
    subheader.appendChild(statusEl);

    return subheader;
}

function createCardsContainer(paper, pIdx) {
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'column-cards';
    cardsContainer.dataset.paperIndex = pIdx;

    setupCardsDragDrop(cardsContainer);

    paper.sections.forEach((section, sIdx) => {
        const cardEl = createCardElement(section, pIdx, sIdx);
        cardsContainer.appendChild(cardEl);
    });

    return cardsContainer;
}

function setupCardsDragDrop(cardsContainer) {
    cardsContainer.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('text/plain')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        clearDragTargets(cardsContainer);

        const cards = [...cardsContainer.querySelectorAll('.kanban-card:not(.dragging)')];
        const afterCard = cards.find(card => {
            const box = card.getBoundingClientRect();
            return e.clientY < box.top + box.height / 2;
        });
        if (afterCard) {
            afterCard.classList.add('drag-target');
            afterCard.style.boxShadow = 'inset 0 3px 0 0 #818cf8, 0 0 0 2px rgba(129,140,248,0.3)';
            afterCard.style.background = 'rgba(129,140,248,0.12)';
        }
    });

    cardsContainer.addEventListener('drop', (e) => {
        const dataStr = e.dataTransfer.getData('text/plain');
        if (!dataStr || dataStr.startsWith('column:')) return;
        e.preventDefault();

        const data = JSON.parse(dataStr);
        const sourcePaperIdx = parseInt(data.paperIndex);
        const sourceSectionIdx = parseInt(data.sectionIndex);
        const targetPaperIdx = parseInt(cardsContainer.dataset.paperIndex);
        if (sourcePaperIdx !== targetPaperIdx) return;

        const targetCard = cardsContainer.querySelector('.kanban-card.drag-target');
        clearDragTargets(cardsContainer);

        const movingSection = getItems()[sourcePaperIdx].sections.splice(sourceSectionIdx, 1)[0];

        if (targetCard) {
            const cards = [...cardsContainer.querySelectorAll('.kanban-card:not(.dragging)')];
            const targetIdx = cards.indexOf(targetCard);
            getItems()[sourcePaperIdx].sections.splice(targetIdx, 0, movingSection);
        } else {
            getItems()[sourcePaperIdx].sections.push(movingSection);
        }
        saveToLocalStorage();
        renderDashboard();
    });
}

function clearDragTargets(container) {
    container.querySelectorAll('.kanban-card.drag-target').forEach(c => {
        c.classList.remove('drag-target');
        c.style.boxShadow = '';
        c.style.background = '';
    });
}

function setupColumnDragDrop(container) {
    container.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('text/plain')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.board-column.drag-over').forEach(c => c.classList.remove('drag-over'));
        const columns = [...container.querySelectorAll('.board-column')];
        const draggedEl = columns.find(c => c.classList.contains('dragging'));
        if (!draggedEl) return;
        const afterEl = columns.find(c => {
            if (c === draggedEl) return false;
            const rect = c.getBoundingClientRect();
            return e.clientX < rect.left + rect.width / 2;
        });
        if (afterEl) afterEl.classList.add('drag-over');
    });

    container.addEventListener('drop', (e) => {
        const dataStr = e.dataTransfer.getData('text/plain');
        if (!dataStr || !dataStr.startsWith('column:')) return;
        e.preventDefault();
        const columns = [...container.querySelectorAll('.board-column')];
        const draggedEl = columns.find(c => c.classList.contains('dragging'));
        const targetEl = columns.find(c => c.classList.contains('drag-over'));
        if (draggedEl && targetEl && draggedEl !== targetEl) {
            container.insertBefore(draggedEl, targetEl);
        }
        container.querySelectorAll('.board-column.drag-over').forEach(c => c.classList.remove('drag-over'));
        const newOrder = [...container.querySelectorAll('.board-column')].map(c => parseInt(c.dataset.paperIndex));
        setItems(newOrder.map(idx => getItems()[idx]));
        saveToLocalStorage();
        renderDashboard();
    });
}

function createCardElement(section, pIdx, sIdx) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.paperIndex = pIdx;
    card.dataset.sectionIndex = sIdx;

    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            paperIndex: card.dataset.paperIndex,
            sectionIndex: card.dataset.sectionIndex
        }));
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.kanban-card.drag-target').forEach(c => {
            c.classList.remove('drag-target');
            c.style.boxShadow = '';
            c.style.background = '';
        });
    });

    const urgency = getSectionUrgency(section);
    const isDeadline = section.name.toLowerCase().includes('deadline');
    const elapsed = calculateDaysElapsed(section.date_last_reviewed, isDeadline);

    const headerRow = document.createElement('div');
    headerRow.className = 'card-header-row';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = section.name;
    enableInlineEdit(title, (newName) => {
        getItems()[pIdx].sections[sIdx].name = newName;
        saveToLocalStorage();
        renderDashboard();
    });
    headerRow.appendChild(title);
    card.appendChild(headerRow);

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const badgeInfo = getCardBadgeInfo(section, urgency, isDeadline, elapsed);
    if (badgeInfo.text) {
        const badge = document.createElement('span');
        badge.className = `card-badge ${badgeInfo.className}`;
        badge.textContent = badgeInfo.text;
        footer.appendChild(badge);
    }

    const dateArea = createCardDateArea(section, pIdx, sIdx);
    footer.appendChild(dateArea);

    const cardActions = createCardActions(pIdx, sIdx);
    footer.appendChild(cardActions);
    card.appendChild(footer);

    return card;
}

function getCardBadgeInfo(section, urgency, isDeadline, elapsed) {
    if (isDeadline) {
        let cls = urgency === 'overdue' ? 'status-red' : 'status-green';
        if (!section.date_last_reviewed) {
            return { text: 'No Deadline', className: 'status-gray' };
        } else if (elapsed >= 0) {
            return { text: `${elapsed}d left`, className: cls };
        } else {
            return { text: `${Math.abs(elapsed)}d overdue`, className: 'status-red' };
        }
    } else {
        if (urgency === 'unstarted') {
            return { text: '', className: '' };
        } else {
            const cls = urgency === 'uptodate' ? 'status-green' : (urgency === 'needsreview' ? 'status-yellow' : 'status-red');
            return { text: `${elapsed}d`, className: cls };
        }
    }
}

function createCardDateArea(section, pIdx, sIdx) {
    const dateArea = document.createElement('div');
    dateArea.className = 'card-date';
    dateArea.style.cursor = 'pointer';
    dateArea.innerHTML = formatDisplayDate(section.date_last_reviewed);
    dateArea.addEventListener('click', (e) => {
        e.stopPropagation();
        showCustomDatePicker(dateArea, section.date_last_reviewed || getTodayString(), (val) => {
            section.date_last_reviewed = val;
            saveToLocalStorage();
            renderDashboard();
        });
    });
    return dateArea;
}

function createCardActions(pIdx, sIdx) {
    const group = document.createElement('div');
    group.className = 'card-actions';

    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'card-action-btn review-btn';
    reviewBtn.title = 'Mark as reviewed today';
    reviewBtn.innerHTML = ICONS.check;
    reviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickReviewToday(pIdx, sIdx, reviewBtn);
    });

    const noteBtn = document.createElement('button');
    noteBtn.className = 'card-action-btn note-btn';
    const section = getItems()[pIdx].sections[sIdx];
    noteBtn.title = section.notes || 'Add a note';
    noteBtn.innerHTML = ICONS.edit;
    if (section.notes) {
        const badge = document.createElement('span');
        badge.className = 'note-badge-dot';
        noteBtn.appendChild(badge);
    }
    noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openNoteEditor(pIdx, sIdx);
    });

    group.appendChild(reviewBtn);
    group.appendChild(noteBtn);
    return group;
}

function enableInlineEdit(el, onSave) {
    el.style.cursor = 'pointer';
    el.addEventListener('dblclick', () => {
        const currentText = el.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'inline-edit-input';
        input.style.width = Math.max(currentText.length * 0.8 + 2, 4) + 'rem';

        el.replaceWith(input);
        input.focus();
        input.select();

        const finish = () => {
            const newVal = input.value.trim() || currentText;
            onSave(newVal);
            input.replaceWith(el);
        };

        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = currentText;
                input.blur();
            }
        });
    });
}

function createNoteEditorOverlay(titleText, initialNotes, placeholder, onSave, onDelete) {
    const existing = document.querySelector('.note-editor-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'note-editor-overlay';

    const popup = document.createElement('div');
    popup.className = 'note-editor-popup';

    const title = document.createElement('div');
    title.className = 'note-editor-title';
    title.textContent = titleText;
    popup.appendChild(title);

    const textarea = document.createElement('textarea');
    textarea.value = initialNotes || '';
    textarea.placeholder = placeholder;
    textarea.rows = 4;

    const btnRow = document.createElement('div');
    btnRow.className = 'note-editor-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'modal-btn danger-outline';
    deleteBtn.addEventListener('click', () => {
        overlay.remove();
        if (onDelete) onDelete();
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'modal-btn primary';
    saveBtn.addEventListener('click', () => {
        onSave(textarea.value.trim() || null);
        overlay.remove();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'modal-btn secondary';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const leftGroup = document.createElement('div');
    leftGroup.className = 'note-editor-left-btn';
    leftGroup.appendChild(deleteBtn);

    const rightGroup = document.createElement('div');
    rightGroup.className = 'note-editor-right-btns';
    rightGroup.appendChild(saveBtn);
    rightGroup.appendChild(cancelBtn);

    btnRow.appendChild(leftGroup);
    btnRow.appendChild(rightGroup);
    popup.appendChild(textarea);
    popup.appendChild(btnRow);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    textarea.focus();

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') overlay.remove();
    });
}

function openNoteEditor(pIdx, sIdx) {
    const section = getItems()[pIdx].sections[sIdx];
    const titleText = `Notes: ${getItems()[pIdx].name} > ${section.name}`;
    createNoteEditorOverlay(
        titleText,
        section.notes,
        'Add a note...',
        (val) => {
            section.notes = val;
            saveToLocalStorage();
            renderDashboard();
        },
        () => {
            triggerDeleteConfirmation(pIdx, sIdx);
            renderDashboard();
        }
    );
}

function openPaperNoteEditor(pIdx) {
    const paper = getItems()[pIdx];
    const titleText = `Notes: ${paper.name}`;
    createNoteEditorOverlay(
        titleText,
        paper.notes,
        'Add a note about this paper...',
        (val) => {
            paper.notes = val;
            saveToLocalStorage();
            renderDashboard();
        },
        () => {
            triggerDeletePaperConfirmation(pIdx);
            renderDashboard();
        }
    );
}

function openCardEditor(pIdx, sIdx) {
    editingCard.paperIndex = pIdx;
    editingCard.sectionIndex = sIdx;

    const paper = getItems()[pIdx];
    const isNew = editingCard.isNew;
    const section = isNew ? null : paper.sections[sIdx];

    document.getElementById('modalTitle').textContent = isNew
        ? `New Section for ${paper.name}`
        : `Edit Section: ${section.name}`;

    document.getElementById('deleteCardBtn').style.display = isNew ? 'none' : '';
    document.getElementById('closeModalBtn').style.display = isNew ? 'none' : '';
    document.getElementById('editSectionName').value = isNew ? '' : section.name;

    document.getElementById('cardModal').showModal();
}

function saveCardEdits() {
    const pIdx = editingCard.paperIndex;
    if (pIdx === null) return;
    const name = document.getElementById('editSectionName').value.trim();

    if (editingCard.isNew) {
        const sIdx = getItems()[pIdx].sections.length;
        editingCard.sectionIndex = sIdx;
        getItems()[pIdx].sections.push({
            name,
            date_last_reviewed: null,
            notes: ""
        });
    } else {
        const sIdx = editingCard.sectionIndex;
        if (sIdx === null) return;
        getItems()[pIdx].sections[sIdx].name = name;
    }

    editingCard.isNew = false;
    saveToLocalStorage();
    renderDashboard();
    document.getElementById('cardModal').close();
}

function savePaperEdits() {
    const name = document.getElementById('editPaperName').value.trim();
    const deadline = document.getElementById('editPaperDeadlineDate').value || null;

    if (editingPaperIndex === null) {
        getItems().push({
            name,
            deadline_date: deadline,
            sections: []
        });
    } else {
        const paper = getItems()[editingPaperIndex];
        paper.name = name;
        paper.deadline_date = deadline;
    }

    saveToLocalStorage();
    renderDashboard();
    document.getElementById('paperModal').close();
}

function addNewPaper() {
    editingPaperIndex = null;
    document.getElementById('editPaperName').value = '';
    document.getElementById('editPaperDeadlineDate').value = '';
    document.getElementById('paperModal').showModal();
}

function quickReviewToday(pIdx, sIdx, btnEl) {
    const section = getItems()[pIdx].sections[sIdx];
    section.date_last_reviewed = getTodayString();
    saveToLocalStorage();

    btnEl.classList.add('review-success');
    setTimeout(() => {
        renderDashboard();
    }, 400);
}

function createNewSection(pIdx) {
    editingCard.isNew = true;
    openCardEditor(pIdx, null);
}

function triggerDeleteConfirmation(pIdx, sIdx) {
    if (pIdx === null || sIdx === null) return;
    const sectionName = getItems()[pIdx].sections[sIdx].name;
    const paperName = getItems()[pIdx].name;

    document.getElementById('cardModal').close();

    showConfirmation(
        "Delete Section?",
        `Are you sure you want to delete "${sectionName}" from "${paperName}"?`,
        () => {
            getItems()[pIdx].sections.splice(sIdx, 1);
            saveToLocalStorage();
            renderDashboard();
        }
    );
}

function triggerDeletePaperConfirmation(pIdx) {
    if (pIdx === null) return;
    const paperName = getItems()[pIdx].name;

    document.getElementById('paperModal').close();

    showConfirmation(
        'Delete Paper?',
        `Are you sure you want to delete "${paperName}" and all its sections? This cannot be undone.`,
        () => {
            getItems().splice(pIdx, 1);
            saveToLocalStorage();
            renderDashboard();
        }
    );
}

function archivePaper(pIdx) {
    if (pIdx === null || pIdx === undefined) return;
    const paper = getItems()[pIdx];
    if (!paper) return;
    showConfirmation(
        'Archive Paper?',
        `Move "${paper.name}" to the archive?`,
        () => {
            getArchivedItems().push(JSON.parse(JSON.stringify(getItems()[pIdx])));
            getItems().splice(pIdx, 1);
            saveToLocalStorage();
            renderDashboard();
        }
    );
}

function updateArchiveBadge() {
    const archiveBadge = document.getElementById('archiveCount');
    if (archiveBadge) {
        const count = (getArchivedItems() || []).length;
        archiveBadge.textContent = count > 0 ? count : '';
    }
    const deadlineBadge = document.getElementById('deadlineCount');
    if (deadlineBadge) {
        const count = getItems().filter(p => p.deadline_date).length;
        deadlineBadge.textContent = count > 0 ? count : '';
    }
}

function showArchiveModal() {
    const existing = document.getElementById('archiveModal');
    if (existing) {
        existing.showModal();
        return;
    }

    const dialog = document.createElement('dialog');
    dialog.id = 'archiveModal';
    dialog.className = 'glass-modal';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleArea = document.createElement('div');
    titleArea.className = 'modal-title-area';
    const title = document.createElement('h2');
    title.textContent = state.mode === 'grants' ? 'Archived Grants' : 'Archived Papers';
    titleArea.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-modal-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => dialog.close());

    header.appendChild(titleArea);
    header.appendChild(closeBtn);
    content.appendChild(header);

    const body = document.createElement('div');
    body.style.padding = '1rem';

    if (getArchivedItems().length === 0) {
        const empty = document.createElement('p');
        empty.style.color = 'var(--text-muted)';
        empty.style.textAlign = 'center';
        empty.textContent = state.mode === 'grants' ? 'No archived grants.' : 'No archived papers.';
        body.appendChild(empty);
    } else {
        const sortedArchived = [...getArchivedItems()].sort((a, b) => {
            if (!a.deadline_date && !b.deadline_date) return a.name.localeCompare(b.name);
            if (!a.deadline_date) return 1;
            if (!b.deadline_date) return -1;
            const cmp = a.deadline_date.localeCompare(b.deadline_date);
            if (cmp !== 0) return cmp;
            return a.name.localeCompare(b.name);
        });
        sortedArchived.forEach((paper, idx) => {
            const row = document.createElement('div');
            row.className = 'archive-row';

            const name = document.createElement('span');
            name.className = 'archive-row-name';
            name.textContent = paper.name;

            const deadline = document.createElement('span');
            deadline.className = 'archive-row-deadline';
            deadline.textContent = paper.deadline_date ? formatDisplayDate(paper.deadline_date) : 'No deadline';

            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'modal-btn primary';
            restoreBtn.textContent = 'Restore';
            restoreBtn.addEventListener('click', () => {
                getItems().push(JSON.parse(JSON.stringify(paper)));
                getArchivedItems().splice(idx, 1);
                saveToLocalStorage();
                dialog.close();
                renderDashboard();
            });

            row.appendChild(name);
            row.appendChild(deadline);
            row.appendChild(restoreBtn);
            body.appendChild(row);
        });
    }

    content.appendChild(body);
    dialog.appendChild(content);

    dialog.addEventListener('close', () => {
        document.body.removeChild(dialog);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
}

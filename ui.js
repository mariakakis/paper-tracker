// Rendering, drag-and-drop, modals, inline editing, notes, CRUD operations

let dragSourceColumnIdx = null;

let editingPaperIndex = null;

function renderDashboard() {
    const container = document.getElementById('boardContainer');
    container.innerHTML = '';
    container.className = 'board-grid paper-columns-layout';
    renderPaperColumns(container);
    updateArchiveBadge();
}

function shouldShowCard(card, paperName) {
    return true;
}

function renderPaperColumns(container) {
    state.papers.forEach((paper, pIdx) => {
        const column = document.createElement('div');
        column.className = 'board-column';
        column.dataset.paperIndex = pIdx;

        const header = document.createElement('div');
        header.className = 'column-header';

        const headerTop = document.createElement('div');
        headerTop.className = 'column-header-top';

        const title = document.createElement('h3');
        title.textContent = paper.name;
        title.title = paper.name;
        enableInlineEdit(title, (newName) => {
            state.papers[pIdx].name = newName;
            saveToLocalStorage();
            renderDashboard();
        });

        const headerActions = document.createElement('div');
        headerActions.className = 'column-header-actions';

        const dragHandle = document.createElement('span');
        dragHandle.className = 'column-drag-handle';
        dragHandle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="16" y2="14"></line><line x1="8" y1="18" x2="16" y2="18"></line></svg>`;
        dragHandle.title = 'Drag to reorder';

        const paperNoteBtn = document.createElement('button');
        paperNoteBtn.className = 'card-action-btn note-btn';
        paperNoteBtn.title = paper.notes || 'Paper notes';
        paperNoteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
        if (paper.notes) {
            const badge = document.createElement('span');
            badge.className = 'note-badge-dot';
            paperNoteBtn.appendChild(badge);
        }
        paperNoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPaperNoteEditor(pIdx);
        });

        headerActions.appendChild(paperNoteBtn);

        const archivePaperBtn = document.createElement('button');
        archivePaperBtn.className = 'card-action-btn';
        archivePaperBtn.title = 'Archive paper';
        archivePaperBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
        archivePaperBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            archivePaper(pIdx);
        });
        headerActions.appendChild(archivePaperBtn);

        dragHandle.draggable = true;
        dragHandle.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            const col = dragHandle.closest('.board-column');
            col.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', 'column:' + col.dataset.paperIndex);
        });
        dragHandle.addEventListener('dragend', (e) => {
            e.stopPropagation();
            dragSourceColumnIdx = null;
            const col = dragHandle.closest('.board-column');
            if (col) col.classList.remove('dragging');
            container.querySelectorAll('.board-column').forEach(c => c.classList.remove('drag-over'));
        });
        headerActions.appendChild(dragHandle);
        headerTop.appendChild(title);
        headerTop.appendChild(headerActions);
        header.appendChild(headerTop);

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

        let unstartedCount = 0;
        let overdueCount = 0;
        let needsReviewCount = 0;
        let upToDateCount = 0;
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
        header.appendChild(subheader);
        column.appendChild(header);

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'column-cards';
        cardsContainer.dataset.paperIndex = pIdx;

        cardsContainer.addEventListener('dragover', (e) => {
            if (!e.dataTransfer.types.includes('text/plain')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            cardsContainer.querySelectorAll('.kanban-card.drag-target').forEach(c => {
                c.classList.remove('drag-target');
                c.style.boxShadow = '';
                c.style.background = '';
            });
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
            cardsContainer.querySelectorAll('.kanban-card.drag-target').forEach(c => {
                c.classList.remove('drag-target');
                c.style.boxShadow = '';
                c.style.background = '';
            });

            const movingSection = state.papers[sourcePaperIdx].sections.splice(sourceSectionIdx, 1)[0];

            if (targetCard) {
                const cards = [...cardsContainer.querySelectorAll('.kanban-card:not(.dragging)')];
                const targetIdx = cards.indexOf(targetCard);
                state.papers[sourcePaperIdx].sections.splice(targetIdx, 0, movingSection);
            } else {
                state.papers[sourcePaperIdx].sections.push(movingSection);
            }
            saveToLocalStorage();
            renderDashboard();
        });

        paper.sections.forEach((section, sIdx) => {
            if (shouldShowCard(section, paper.name)) {
                const cardEl = createCardElement(section, pIdx, sIdx);
                cardsContainer.appendChild(cardEl);
            }
        });

        column.appendChild(cardsContainer);

        const addBtn = document.createElement('button');
        addBtn.className = 'add-card-btn';
        addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add Section`;
        addBtn.addEventListener('click', () => createNewSection(pIdx));
        column.appendChild(addBtn);

        container.appendChild(column);
    });

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
        if (afterEl) {
            afterEl.classList.add('drag-over');
        }
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
        state.papers = newOrder.map(idx => state.papers[idx]);
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
    const sectionNameLower = section.name.toLowerCase();
    const isDeadline = sectionNameLower.includes('deadline');
    const elapsed = calculateDaysElapsed(section.date_last_reviewed, isDeadline);

    const headerRow = document.createElement('div');
    headerRow.className = 'card-header-row';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = section.name;
    enableInlineEdit(title, (newName) => {
        state.papers[pIdx].sections[sIdx].name = newName;
        saveToLocalStorage();
        renderDashboard();
    });
    headerRow.appendChild(title);

    let badgeText = '';
    let badgeClass = '';

    if (isDeadline) {
        badgeClass = urgency === 'overdue' ? 'status-red' : 'status-green';
        if (!section.date_last_reviewed) {
            badgeText = 'No Deadline';
            badgeClass = 'status-gray';
        } else if (elapsed >= 0) {
            badgeText = `${elapsed}d left`;
        } else {
            badgeText = `${Math.abs(elapsed)}d overdue`;
        }
    } else {
        if (urgency === 'unstarted') {
            badgeText = '';
            badgeClass = '';
        } else if (urgency === 'uptodate') {
            badgeText = `${elapsed}d`;
            badgeClass = 'status-green';
        } else if (urgency === 'needsreview') {
            badgeText = `${elapsed}d`;
            badgeClass = 'status-yellow';
        } else {
            badgeText = `${elapsed}d`;
            badgeClass = 'status-red';
        }
    }

    card.appendChild(headerRow);

    const footer = document.createElement('div');
    footer.className = 'card-footer';

    if (badgeText) {
        const badge = document.createElement('span');
        badge.className = `card-badge ${badgeClass}`;
        badge.textContent = badgeText;
        footer.appendChild(badge);
    }

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
    footer.appendChild(dateArea);

    const cardActions = document.createElement('div');
    cardActions.className = 'card-actions';

    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'card-action-btn review-btn';
    reviewBtn.title = 'Mark as reviewed today';
    reviewBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    reviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickReviewToday(pIdx, sIdx, reviewBtn);
    });

    const noteBtn = document.createElement('button');
    noteBtn.className = 'card-action-btn note-btn';
    noteBtn.title = section.notes || 'Add a note';
    noteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
    if (section.notes) {
        const badge = document.createElement('span');
        badge.className = 'note-badge-dot';
        noteBtn.appendChild(badge);
    }
    noteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openNoteEditor(pIdx, sIdx);
    });

    cardActions.appendChild(reviewBtn);
    cardActions.appendChild(noteBtn);
    footer.appendChild(cardActions);

    card.appendChild(footer);

    return card;
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
            el.textContent = newVal;
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

function openNoteEditor(pIdx, sIdx) {
    const existing = document.querySelector('.note-editor-overlay');
    if (existing) existing.remove();

    const section = state.papers[pIdx].sections[sIdx];

    const overlay = document.createElement('div');
    overlay.className = 'note-editor-overlay';

    const popup = document.createElement('div');
    popup.className = 'note-editor-popup';

    const title = document.createElement('div');
    title.className = 'note-editor-title';
    const paperName = state.papers[pIdx].name;
    title.textContent = `Notes: ${paperName} > ${section.name}`;
    popup.appendChild(title);

    const textarea = document.createElement('textarea');
    textarea.value = section.notes || '';
    textarea.placeholder = 'Add a note...';
    textarea.rows = 4;

    const btnRow = document.createElement('div');
    btnRow.className = 'note-editor-actions';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'modal-btn primary';
    saveBtn.addEventListener('click', () => {
        section.notes = textarea.value.trim() || null;
        saveToLocalStorage();
        overlay.remove();
        renderDashboard();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'modal-btn secondary';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete Section';
    deleteBtn.className = 'modal-btn danger-outline';
    deleteBtn.addEventListener('click', () => {
        overlay.remove();
        triggerDeleteConfirmation(pIdx, sIdx);
    });

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

function openPaperNoteEditor(pIdx) {
    const existing = document.querySelector('.note-editor-overlay');
    if (existing) existing.remove();

    const paper = state.papers[pIdx];

    const overlay = document.createElement('div');
    overlay.className = 'note-editor-overlay';

    const popup = document.createElement('div');
    popup.className = 'note-editor-popup';

    const title = document.createElement('div');
    title.className = 'note-editor-title';
    title.textContent = `Notes: ${paper.name}`;
    popup.appendChild(title);

    const textarea = document.createElement('textarea');
    textarea.value = paper.notes || '';
    textarea.placeholder = 'Add a note about this paper...';
    textarea.rows = 4;

    const btnRow = document.createElement('div');
    btnRow.className = 'note-editor-actions';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'modal-btn primary';
    saveBtn.addEventListener('click', () => {
        paper.notes = textarea.value.trim() || null;
        saveToLocalStorage();
        overlay.remove();
        renderDashboard();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'modal-btn secondary';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete Paper';
    deleteBtn.className = 'modal-btn danger-outline';
    deleteBtn.addEventListener('click', () => {
        overlay.remove();
        triggerDeletePaperConfirmation(pIdx);
    });

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

function openPaperEditor(pIdx) {
    editingPaperIndex = pIdx;
    const paper = state.papers[pIdx];

    document.getElementById('editPaperName').value = paper.name;
    const dateInput = document.getElementById('editPaperDeadlineDate');
    dateInput.value = paper.deadline_date || '';
    document.getElementById('paperModal').showModal();
}

function savePaperEdits() {
    const name = document.getElementById('editPaperName').value.trim();
    const deadline = document.getElementById('editPaperDeadlineDate').value || null;

    if (editingPaperIndex === null) {
        state.papers.push({
            name,
            deadline_date: deadline,
            sections: []
        });
    } else {
        const paper = state.papers[editingPaperIndex];
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

function triggerDeletePaperConfirmation(pIdx) {
    if (pIdx === null) return;
    const paperName = state.papers[pIdx].name;

    document.getElementById('paperModal').close();

    showConfirmation(
        'Delete Paper?',
        `Are you sure you want to delete "${paperName}" and all its sections? This cannot be undone.`,
        () => {
            state.papers.splice(pIdx, 1);
            saveToLocalStorage();
            renderDashboard();
        }
    );
}

function quickReviewToday(pIdx, sIdx, btnEl) {
    const section = state.papers[pIdx].sections[sIdx];
    section.date_last_reviewed = getTodayString();
    saveToLocalStorage();

    btnEl.classList.add('review-success');
    setTimeout(() => {
        renderDashboard();
    }, 400);
}

function openCardEditor(pIdx, sIdx) {
    editingCard.paperIndex = pIdx;
    editingCard.sectionIndex = sIdx;

    const paper = state.papers[pIdx];
    const isNew = editingCard.isNew;
    const section = isNew ? null : paper.sections[sIdx];

    if (isNew) {
        document.getElementById('modalTitle').textContent = `New Section for ${paper.name}`;
    } else {
        document.getElementById('modalTitle').textContent = `Edit Section: ${section.name}`;
    }

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
        const sIdx = state.papers[pIdx].sections.length;
        editingCard.sectionIndex = sIdx;
        state.papers[pIdx].sections.push({
            name,
            date_last_reviewed: null,
            notes: ""
        });
    } else {
        const sIdx = editingCard.sectionIndex;
        if (sIdx === null) return;
        state.papers[pIdx].sections[sIdx].name = name;
    }

    editingCard.isNew = false;
    saveToLocalStorage();
    renderDashboard();
    document.getElementById('cardModal').close();
}

function triggerDeleteConfirmation(pIdx, sIdx) {
    if (pIdx === null || sIdx === null) return;
    const sectionName = state.papers[pIdx].sections[sIdx].name;
    const paperName = state.papers[pIdx].name;

    document.getElementById('cardModal').close();

    showConfirmation(
        "Delete Section?",
        `Are you sure you want to delete "${sectionName}" from "${paperName}"?`,
        () => {
            state.papers[pIdx].sections.splice(sIdx, 1);
            saveToLocalStorage();
            renderDashboard();
        }
    );
}

function createNewSection(pIdx) {
    editingCard.isNew = true;
    openCardEditor(pIdx, null);
}

function archivePaper(pIdx) {
    if (pIdx === null || pIdx === undefined) return;
    const paper = state.papers[pIdx];
    if (!paper) return;
    showConfirmation(
        'Archive Paper?',
        `Move "${paper.name}" to the archive?`,
        () => {
            if (!state.archivedPapers) state.archivedPapers = [];
            state.archivedPapers.push(JSON.parse(JSON.stringify(state.papers[pIdx])));
            state.papers.splice(pIdx, 1);
            saveToLocalStorage();
            renderDashboard();
        }
    );
}

function updateArchiveBadge() {
    const archiveBadge = document.getElementById('archiveCount');
    if (archiveBadge) {
        const count = (state.archivedPapers || []).length;
        archiveBadge.textContent = count > 0 ? count : '';
    }
    const deadlineBadge = document.getElementById('deadlineCount');
    if (deadlineBadge) {
        const count = state.papers.filter(p => p.deadline_date).length;
        deadlineBadge.textContent = count > 0 ? count : '';
    }
}

function showArchiveModal() {
    if (!state.archivedPapers) state.archivedPapers = [];

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
    title.textContent = 'Archived Papers';

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

    if (state.archivedPapers.length === 0) {
        const empty = document.createElement('p');
        empty.style.color = 'var(--text-muted)';
        empty.style.textAlign = 'center';
        empty.textContent = 'No archived papers.';
        body.appendChild(empty);
    } else {
        state.archivedPapers.forEach((paper, idx) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '0.75rem';
            row.style.padding = '0.5rem 0.75rem';
            row.style.border = '1px solid var(--border-color)';
            row.style.borderRadius = 'var(--radius-sm)';
            row.style.marginBottom = '0.5rem';
            row.style.background = 'var(--bg-input)';

            const name = document.createElement('span');
            name.style.flex = '1';
            name.style.fontWeight = '600';
            name.textContent = paper.name;

            const deadline = document.createElement('span');
            deadline.style.color = 'var(--text-secondary)';
            deadline.style.fontSize = '0.8rem';
            deadline.textContent = paper.deadline_date ? formatDisplayDate(paper.deadline_date) : 'No deadline';

            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'modal-btn primary';
            restoreBtn.textContent = 'Restore';
            restoreBtn.addEventListener('click', () => {
                state.papers.push(JSON.parse(JSON.stringify(paper)));
                state.archivedPapers.splice(idx, 1);
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

function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function calculateDaysElapsed(dateStr, isDeadline = false) {
    if (!dateStr) return null;
    const targetDate = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = today - targetDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (isDeadline) {
        return -diffDays;
    }
    return diffDays;
}

function getSectionUrgency(section) {
    const name = section.name.toLowerCase();
    const isDeadline = name.includes('deadline');
    const days = calculateDaysElapsed(section.date_last_reviewed, isDeadline);
    if (!section.date_last_reviewed) {
        return 'unstarted';
    }
    if (isDeadline) {
        return days <= 0 ? 'overdue' : 'uptodate';
    }
    if (days <= 7) {
        return 'uptodate';
    } else if (days <= 30) {
        return 'needsreview';
    } else {
        return 'overdue';
    }
}

function getPaperDeadlineStatus(paper) {
    if (!paper.deadline_date) {
        return { text: 'No deadline set', class: 'status-gray', days: null };
    }
    const days = calculateDaysElapsed(paper.deadline_date, true);
    if (days >= 0) {
        return { text: `${days}d left`, class: days <= 3 ? 'status-red' : (days <= 7 ? 'status-yellow' : 'status-green'), days: days };
    } else {
        return { text: `-${Math.abs(days)}d`, class: 'status-red', days: days };
    }
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return 'Never Reviewed';
    try {
        const date = new Date(dateStr + "T00:00:00");
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
}

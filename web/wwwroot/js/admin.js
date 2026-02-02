/**
 * Admin Panel Utilities
 */

// Update admin username in header
document.addEventListener('DOMContentLoaded', function() {
    const user = TokenManager.getUser();
    if (user) {
        const usernameEl = document.getElementById('admin-username');
        if (usernameEl) {
            usernameEl.textContent = user.fullName || user.username;
        }
    }
});

// Common utility functions for admin pages
const AdminUtils = {
    // Format date to readable string
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    },

    // Format datetime with time
    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    },

    // Show toast notification
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span class="material-symbols-outlined toast__icon">${type === 'success' ? 'check_circle' : 'error'}</span>
            <span class="toast__message">${message}</span>
            <button class="toast__close" onclick="this.parentElement.remove()">
                <span class="material-symbols-outlined icon-sm">close</span>
            </button>
        `;
        container.appendChild(toast);
        
        setTimeout(() => toast.remove(), 5000);
    },

    // Escape HTML for safe display
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Debounce function for search inputs
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Export to window
window.AdminUtils = AdminUtils;

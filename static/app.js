const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const resultsSection = document.getElementById('resultsSection');
const loadingState = document.getElementById('loadingState');
const dropZoneContent = document.querySelector('.drop-zone-content');
const markdownOutput = document.getElementById('markdownOutput');
const structureOutput = document.getElementById('structureOutput');
const resetBtn = document.getElementById('resetBtn'); // Keep if present, or ignore
const newChatBtn = document.getElementById('newChatBtn');
const sessionListEl = document.getElementById('sessionList');

let currentData = null; // Store current response data
let allFilesData = [];
let currentFileIndex = 0;
let allSessions = []; // Store sessions globally for filtering
let currentSearchQuery = ''; // Store current search query for highlighting

// ==================== UTILITY FUNCTIONS ====================

// Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        warning: '⚠'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Get file type icon based on extension
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();

    const icons = {
        pdf: `<svg xmlns="http://www.w3.org/2000/svg" class="doc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M10 12h4"></path>
            <path d="M10 16h4"></path>
        </svg>`,

        docx: `<svg xmlns="http://www.w3.org/2000/svg" class="doc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <line x1="10" y1="9" x2="8" y2="9"></line>
        </svg>`,

        pptx: `<svg xmlns="http://www.w3.org/2000/svg" class="doc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
            <line x1="7" y1="12" x2="17" y2="12"></line>
            <line x1="12" y1="7" x2="12" y2="17"></line>
        </svg>`,

        png: `<svg xmlns="http://www.w3.org/2000/svg" class="doc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
        </svg>`,

        jpg: `<svg xmlns="http://www.w3.org/2000/svg" class="doc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
        </svg>`,

        jpeg: `<svg xmlns="http://www.w3.org/2000/svg" class="doc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
        </svg>`
    };

    // Default document icon
    const defaultIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="doc-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>`;

    return icons[ext] || defaultIcon;
}

// Highlight matched text in search results
function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Copy message content to clipboard
function copyMessage(button) {
    const messageDiv = button.closest('.chat-message');
    const textContent = messageDiv.textContent.replace('Copy', '').trim();

    navigator.clipboard.writeText(textContent).then(() => {
        showToast('Message copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy message', 'error');
        console.error('Copy failed:', err);
    });
}

// Play message as audio using Web Speech API
function playAudio(messageDiv) {
    const textContent = messageDiv.textContent.replace(/Copy|Audio/g, '').trim();

    if ('speechSynthesis' in window) {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(textContent);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        window.speechSynthesis.speak(utterance);
        showToast('Playing audio...', 'info');
    } else {
        showToast('Text-to-speech not supported in your browser', 'error');
    }
}

// Create action buttons for AI messages
function createActionButtons(messageDiv) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'message-actions';

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    `;
    copyBtn.onclick = function (e) {
        e.stopPropagation();
        copyMessage(messageDiv);
    };

    // Audio button
    const audioBtn = document.createElement('button');
    audioBtn.className = 'action-btn';
    audioBtn.title = 'Listen';
    audioBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>
    `;
    audioBtn.onclick = function (e) {
        e.stopPropagation();
        playAudio(messageDiv);
    };

    actionsContainer.appendChild(copyBtn);
    actionsContainer.appendChild(audioBtn);

    return actionsContainer;
}

// ==================== END UTILITY FUNCTIONS ====================


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSessions();

    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // Search Logic
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase();
            currentSearchQuery = query;

            // Filter sessions by filename and message content
            const filtered = allSessions.filter(s => {
                // Check filename
                if (s.filename.toLowerCase().includes(query)) return true;

                // Check if session has messages (we'll need to fetch them)
                // For now, just filter by filename
                // TODO: Could enhance by fetching messages and searching content
                return false;
            });

            renderSessionList(filtered, query);
        });

        // Auto-expand sidebar on focus
        searchInput.addEventListener('focus', () => {
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
            }
        });
    }

    // Chat Input Enter Key
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChat();
            }
        });
    }

    // Settings Icon Click
    const settingsIcon = document.getElementById('settingsIcon');
    if (settingsIcon) {
        settingsIcon.addEventListener('click', () => {
            const themeModal = document.getElementById('themeModal');
            if (themeModal) themeModal.classList.remove('hidden');
        });
    }

    // Initialize theme
    initializeTheme();

    // Theme radio buttons
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            setTheme(e.target.value);
        });
    });

    // Initialize resizable panes
    initResizers();
});

// --- Resizable Panes ---
function initResizers() {
    const resizerStructure = document.getElementById('resizerStructure');
    const resizerChat = document.getElementById('resizerChat');
    const structurePane = document.getElementById('pane-structure');
    const outputPane = document.getElementById('pane-output');
    const chatPane = document.getElementById('pane-chat');
    const container = document.getElementById('resultsSection');

    // Helper for resizing
    const makeResizable = (resizer, leftPane, rightPane) => {
        if (!resizer || !leftPane || !rightPane) return;

        let x = 0;
        let leftWidth = 0;
        let rightWidth = 0;

        const onMouseDown = (e) => {
            x = e.clientX;
            const leftRect = leftPane.getBoundingClientRect();
            const rightRect = rightPane.getBoundingClientRect();
            leftWidth = leftRect.width;
            rightWidth = rightRect.width;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; // Prevent text selection
        };

        const onMouseMove = (e) => {
            const dx = e.clientX - x;
            const newLeftWidth = ((leftWidth + dx) / container.offsetWidth) * 100;
            const newRightWidth = ((rightWidth - dx) / container.offsetWidth) * 100;

            // Optional: Limit minimum width
            if (newLeftWidth > 5 && newRightWidth > 5) {
                leftPane.style.width = `${newLeftWidth}%`;
                // We typically adjust flex or width. Here panes use flex:1 sometimes, so we might need to be careful.
                // The split view implementation might need adjustment to use strict widths or flex-basis.
                // Let's assume style.width works because flex items respect width if flex-basis is auto.
                // However, middle pane is flex:1. So changing left pane width strictly should work if middle adjusts?
                // Actually, if we are residing the first resizer (between structure and output), 
                // we technically change the structure pane width, and the output pane (which is flex:1) takes the rest.
                // If we resize the second resizer (between output and chat), we change chat pane width, and output pane takes rest.

                // Let's simplify:
                // Structure pane has explicit width initially (20%).
                // Chat pane has explicit width initially (25%).
                // Output pane is flex: 1.

                // So for resizerStructure: ONLY adjust structurePane width. outputPane absorbs change.
                if (leftPane === structurePane) {
                    leftPane.style.width = `${newLeftWidth}%`;
                }
                // For resizerChat: ONLY adjust chatPane width. outputPane absorbs change.
                // Note: resizerChat is to the LEFT of Chat Pane. Dragging left increases Chat Pane? No, decreases Output.
                // Wait.
                // [Structure] [Resizer1] [Output] [Resizer2] [Chat]

                // Handling Resizer1 (Structure <-> Output):
                // Dragging moves the boundary.
                // Increasing Structure width decreases Output width (since Output is flex:1).

                // Handling Resizer2 (Output <-> Chat):
                // Output is on left, Chat is on right. 
                // But Chat pane is width: 25%.
                // Dragging Resizer2 changes Chat pane width.
                // If I drag left, Chat pane gets bigger? Yes.
                // dx is negative (left). 
                // newRightWidth = rightWidth - dx (minus negative = plus) -> Bigger. Correct.

                if (rightPane === chatPane) {
                    rightPane.style.width = `${newRightWidth}%`;
                }
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        const onTouchStart = (e) => {
            x = e.touches[0].clientX;
            const leftRect = leftPane.getBoundingClientRect();
            const rightRect = rightPane.getBoundingClientRect();
            leftWidth = leftRect.width;
            rightWidth = rightRect.width;

            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);
            resizer.classList.add('resizing');
        }

        const onTouchMove = (e) => {
            const dx = e.touches[0].clientX - x;
            // Same logic as mouse move
            const newLeftWidth = ((leftWidth + dx) / container.offsetWidth) * 100;
            const newRightWidth = ((rightWidth - dx) / container.offsetWidth) * 100;

            if (newLeftWidth > 5 && newRightWidth > 5) {
                if (leftPane === structurePane) leftPane.style.width = `${newLeftWidth}%`;
                if (rightPane === chatPane) rightPane.style.width = `${newRightWidth}%`;
            }
        }

        const onTouchEnd = () => {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            resizer.classList.remove('resizing');
        }


        resizer.addEventListener('mousedown', onMouseDown);
        resizer.addEventListener('touchstart', onTouchStart);
    };

    // Resizer 1: Between Structure and Output
    // Structure is left, Output is right. But we only really need to control Structure width.
    makeResizable(resizerStructure, structurePane, outputPane);

    // Resizer 2: Between Output and Chat
    // Output is left, Chat is right. But we only really need to control Chat width.
    makeResizable(resizerChat, outputPane, chatPane);
}
if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // Handle click on drop zone to trigger file input
    dropZone.addEventListener('click', (e) => {
        if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT' || e.target.closest('.convert-options') || e.target === fileInput) {
            return;
        }
        fileInput.click();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });
}

// New Chat / Reset
function resetView() {
    currentData = null;
    allFilesData = [];
    currentFileIndex = 0;
    if (fileInput) fileInput.value = '';

    if (resultsSection) {
        resultsSection.classList.add('hidden');
        resultsSection.style.display = 'none';
    }
    if (uploadSection) {
        uploadSection.style.display = 'flex'; // Use flex for centering
    }

    if (markdownOutput) markdownOutput.innerHTML = '';
    if (structureOutput) structureOutput.innerHTML = '';

    // Clear chat history
    const chatHistory = document.getElementById('chatHistory');
    if (chatHistory) {
        chatHistory.innerHTML = `
            <div class="chat-message system">
                Ask questions about your document!
            </div>
        `;
    }

    // Clear active state in sidebar
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
}

if (newChatBtn) {
    newChatBtn.addEventListener('click', resetView);
}
// Keep resetBtn for header if it exists
if (resetBtn) {
    resetBtn.addEventListener('click', resetView);
    resetBtn.style.display = 'none'; // Initially hidden
}


// --- Session Management ---

async function loadSessions() {
    try {
        const response = await fetch('/sessions');
        const data = await response.json();
        allSessions = data.sessions; // Store globally
        renderSessionList(allSessions);
    } catch (error) {
        console.error('Failed to load sessions:', error);
    }
}

function renderSessionList(sessions, query = '') {
    if (!sessionListEl) return;
    sessionListEl.innerHTML = '';
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';

        // Get appropriate icon for file type
        const icon = getFileIcon(session.filename);

        // Highlight search query in filename
        const displayName = query ? highlightText(session.filename, query) : session.filename;

        item.innerHTML = `
            ${icon}
            <span>${displayName}</span>
        `;
        item.onclick = () => loadSession(session.id);

        // Mark active if matches current
        if (currentData && currentData.session_id === session.id) {
            item.classList.add('active');
        }

        sessionListEl.appendChild(item);
    });
}

async function loadSession(sessionId) {
    try {
        const response = await fetch(`/sessions/${sessionId}`);
        if (!response.ok) throw new Error('Failed to load session');
        const data = await response.json();

        // Set current data structure to match what we expect
        currentData = {
            session_id: data.session.id,
            filename: data.session.filename,
            markdown: data.session.markdown_content,
            json: null, // We might not store JSON in DB, can be optional
            file_url: data.session.file_path ? `/static/uploads/${data.session.filename}` : null // Reconstruct URL if possible
        };

        // Populate Chat History
        const chatHistory = document.getElementById('chatHistory');
        if (chatHistory) {
            chatHistory.innerHTML = ''; // Clear default

            if (data.messages.length === 0) {
                chatHistory.innerHTML = `
                    <div class="chat-message system">
                        Ask questions about your document!
                    </div>
                `;
            } else {
                data.messages.forEach(msg => {
                    const div = document.createElement('div');
                    div.className = `chat-message ${msg.role}`;
                    div.innerHTML = msg.role === 'ai' ? marked.parse(msg.content) : msg.content;

                    // Add action buttons for AI messages
                    if (msg.role === 'ai') {
                        div.appendChild(createActionButtons(div));
                    }

                    chatHistory.appendChild(div);
                });
            }
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }

        // Render View
        renderOutput(currentData.markdown);
        renderStructure(null); // Structure parsing usually needs the JSON or fresh parse

        // Switch Views
        if (uploadSection) uploadSection.style.display = 'none';
        if (resultsSection) {
            resultsSection.classList.remove('hidden');
            resultsSection.style.display = 'flex';
        }

        // Update Sidebar Active State
        document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
        // We might want to re-render to catch active state visually if we just clicked
        // Optimistically set active without full reload:
        const activeItem = Array.from(sessionListEl.children).find(child => child.innerText.includes(data.session.filename)); // Rough match
        if (activeItem) activeItem.classList.add('active');

    } catch (error) {
        console.error(error);
        showToast('Failed to load session. Please try again.', 'error');
    }
}


// --- File Handling ---

async function handleFiles(fileList) {
    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.html', '.htm', '.png', '.jpg', '.jpeg'];
    const files = Array.from(fileList).filter(file => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        return allowedExtensions.includes(ext);
    });

    if (files.length === 0) {
        showToast('Please upload supported file types (PDF, DOCX, PPTX, HTML, Images)', 'warning');
        return;
    }

    // Show loading
    if (dropZoneContent) dropZoneContent.classList.add('hidden');
    if (loadingState) loadingState.classList.remove('hidden');

    try {
        await uploadFilesBatch(files);
    } catch (e) {
        console.error(e);
        showToast('Processing failed: ' + e.message, 'error');
        if (dropZoneContent) dropZoneContent.classList.remove('hidden');
        if (loadingState) loadingState.classList.add('hidden');
    }
}

async function uploadFilesBatch(files) {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const ocrOption = document.getElementById('ocrOption');
    const tableOption = document.getElementById('tableOption');

    formData.append('ocr_enabled', ocrOption ? ocrOption.checked : false);
    formData.append('table_extraction', tableOption ? tableOption.checked : true);

    // Show progress bar
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercentage = document.querySelector('.progress-percentage');
    const dropZoneContent = document.getElementById('dropZoneContent');

    if (dropZoneContent) dropZoneContent.classList.add('hidden');
    if (uploadProgress) {
        uploadProgress.classList.remove('hidden');
        uploadProgress.style.display = 'block'; // Reset display
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                if (progressBarFill) progressBarFill.style.width = percentComplete + '%';
                if (progressPercentage) progressPercentage.textContent = percentComplete + '%';
            }
        });


        xhr.upload.addEventListener('load', () => {
            // Upload complete, show processing state immediately
            if (uploadProgress) {
                uploadProgress.classList.add('hidden');
                uploadProgress.style.display = 'none'; // Brute force hide
            }
            const loadingState = document.getElementById('loadingState');
            if (loadingState) {
                loadingState.classList.remove('hidden');
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    const results = data.results;

                    if (results.length === 0) {
                        reject(new Error("No files processed successfully."));
                        return;
                    }

                    const lastResult = results[results.length - 1];

                    if (lastResult.status === 'error') {
                        reject(new Error(lastResult.error));
                        return;
                    }

                    // Refresh sidebar to show new sessions
                    loadSessions().then(() => {
                        // Load the session
                        return loadSession(lastResult.session_id);
                    }).then(() => {
                        resolve(data);
                    }).catch(err => {
                        reject(err);
                    });

                } catch (error) {
                    reject(new Error('Failed to parse response: ' + error.message));
                }
            } else {
                reject(new Error('Upload failed with status: ' + xhr.status));
            }
        });

        xhr.addEventListener('error', () => {
            if (uploadProgress) uploadProgress.classList.add('hidden');
            if (dropZoneContent) dropZoneContent.classList.remove('hidden');
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            if (uploadProgress) uploadProgress.classList.add('hidden');
            if (dropZoneContent) dropZoneContent.classList.remove('hidden');
            reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/convert/batch');
        xhr.send(formData);
    });
}

// --- Utils ---

function renderOutput(markdown) {
    if (markdownOutput) {
        // Parse markdown and add IDs to headings
        let html = marked.parse(markdown);

        // Add IDs to headings for navigation
        let headingIndex = 0;
        html = html.replace(/<h([1-3])>/g, (match, level) => {
            return `<h${level} id="heading-${headingIndex++}">`;
        });

        markdownOutput.innerHTML = html;
    }
}

function renderStructure(jsonData) {
    // Simple Header Parsing if JSON is missing (DB load)
    if (!currentData || !currentData.markdown) return;

    const headers = currentData.markdown.match(/^#{1,3} .+/gm) || [];
    let html = '';
    headers.forEach((header, index) => {
        const level = header.match(/^#+/)[0].length;
        const text = header.replace(/^#+ /, '');
        const id = `heading-${index}`;
        let icon = level === 1 ? '📑' : (level === 2 ? '🔖' : '🔹');
        html += `<div class="structure-item level-${level}" data-heading-id="${id}">
            <span class="structure-icon">${icon}</span>
            <span class="structure-text">${text}</span>
        </div>`;
    });

    if (headers.length === 0) {
        html = '<div style="padding:1rem;color:var(--text-secondary)">No structure detected</div>';
    }

    if (structureOutput) {
        structureOutput.innerHTML = html;

        // Add click handlers for navigation
        structureOutput.querySelectorAll('.structure-item').forEach(item => {
            item.addEventListener('click', () => {
                const headingId = item.dataset.headingId;
                const targetElement = document.getElementById(headingId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Highlight the item briefly
                    item.style.background = 'rgba(56, 189, 248, 0.2)';
                    setTimeout(() => {
                        item.style.background = '';
                    }, 1000);
                }
            });
        });
    }
}

function viewOriginalFile() {
    if (currentData && currentData.file_url) {
        window.open(currentData.file_url, '_blank');
    } else {
        showToast('No file available to view. File might be local only.', 'warning');
    }
}

window.viewOriginalFile = viewOriginalFile;
window.sendChat = sendChat;
window.downloadOutput = downloadOutput;
window.copyMarkdown = copyMarkdown;

// Theme Management Functions
function setTheme(theme) {
    // Prevent unnecessary updates and toasts if theme is unchanged
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === theme) return;

    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update radio button
    if (theme === 'light') {
        document.getElementById('lightTheme').checked = true;
    } else {
        document.getElementById('darkTheme').checked = true;
    }

    showToast(`Switched to ${theme === 'light' ? '☀️ Light' : '🌙 Dark'} mode`, 'success');
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Set radio button without toast
    if (savedTheme === 'light') {
        const lightTheme = document.getElementById('lightTheme');
        if (lightTheme) lightTheme.checked = true;
    } else {
        const darkTheme = document.getElementById('darkTheme');
        if (darkTheme) darkTheme.checked = true;
    }
}

function closeThemeModal() {
    const themeModal = document.getElementById('themeModal');
    if (themeModal) themeModal.classList.add('hidden');
}

window.setTheme = setTheme;
window.closeThemeModal = closeThemeModal;

// Initialize on page load - merged with top listener
// document.addEventListener('DOMContentLoaded', function () { ... });


function downloadOutput(format) {
    if (!currentData) return;
    let content = '', mimeType = '', ext = '';

    if (format === 'markdown') { content = currentData.markdown; mimeType = 'text/markdown'; ext = 'md'; }
    else if (format === 'json') { content = JSON.stringify({ markdown: currentData.markdown }, null, 2); mimeType = 'application/json'; ext = 'json'; }
    else if (format === 'html') { content = marked.parse(currentData.markdown); mimeType = 'text/html'; ext = 'html'; }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentData.filename || 'document'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function copyMarkdown() {
    navigator.clipboard.writeText(currentData.markdown).then(() => showToast('Markdown copied to clipboard!', 'success'));
}

// --- Chat ---

async function sendChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    if (!input) return;

    const query = input.value.trim();

    if (!query) return;

    // Display User Message
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-message user';
    userDiv.textContent = query;
    if (history) {
        history.appendChild(userDiv);
        history.scrollTop = history.scrollHeight;
    }

    input.value = '';

    // Send to Backend
    try {
        const endpoint = currentData ? `/sessions/${currentData.session_id}/chat` : '/chat'; // Fallback if no session
        const body = currentData ? { query: query } : { query: query, local_file_path: null }; // Adjust payload

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        // Display AI Response
        const aiDiv = document.createElement('div');
        aiDiv.className = 'chat-message ai';
        aiDiv.innerHTML = marked.parse(data.response);

        // Add action buttons to new AI message
        aiDiv.appendChild(createActionButtons(aiDiv));

        if (history) {
            history.appendChild(aiDiv);
            history.scrollTop = history.scrollHeight;
        }

    } catch (error) {
        console.error(error);
        showToast('Error getting response from AI', 'error');
    }
}

// Wait for page to fully load before attaching event listeners
window.addEventListener('load', function () {
    // Initialize theme on page load
    initializeTheme();

    // Settings icon click handler 
    const settingsIcon = document.getElementById('settingsIcon');
    if (settingsIcon) {
        settingsIcon.addEventListener('click', function () {
            const themeModal = document.getElementById('themeModal');
            if (themeModal) themeModal.classList.remove('hidden');
        });
    }

    // Theme radio button change handlers
    const darkThemeRadio = document.getElementById('darkTheme');
    const lightThemeRadio = document.getElementById('lightTheme');

    if (darkThemeRadio) {
        darkThemeRadio.addEventListener('change', function () {
            if (this.checked) setTheme('dark');
        });
    }

    if (lightThemeRadio) {
        lightThemeRadio.addEventListener('change', function () {
            if (this.checked) setTheme('light');
        });
    }
});

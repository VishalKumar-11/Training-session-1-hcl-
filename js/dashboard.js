/**
 * DocLocker — Dashboard, Upload, Documents & Backup Script (js/dashboard.js)
 * Manages protected session state, document storage in localStorage,
 * KPI metrics, Backup & Restore simulation, file validation & upload progress,
 * and document search, filtering, preview, download, and deletion.
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    SESSION: 'doclocker_active_session',
    USERS: 'doclocker_users',
    DOCS_PREFIX: 'doclocker_docs_',
    BACKUP_PREFIX: 'doclocker_backup_',
  };

  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  const MAX_VAULT_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB demo quota
  const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
  const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

  let currentSession = null;
  let pendingDeleteDocId = null;
  let pendingPreviewDocId = null;
  let currentCategory = 'All';
  let currentSearch = '';
  let currentViewMode = 'grid';

  document.addEventListener('DOMContentLoaded', function () {
    currentSession = requireActiveSession();
    if (!currentSession) return;

    ensureInitialSeedData();
    initSidebarAndTopbar();
    initDeleteModal();

    if (document.getElementById('recentUploadsList')) {
      initDashboardPage();
    }

    if (document.getElementById('uploadDropzone')) {
      initUploadPage();
    }

    if (document.getElementById('documentsContainer')) {
      initDocumentsPage();
    }
  });

  /* ========================================================================
     SESSION & STORAGE HELPERS
     ======================================================================== */
  function requireActiveSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!raw) {
        window.location.href = 'login.html?auth=required';
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.userId) {
        window.location.href = 'login.html?auth=required';
        return null;
      }
      return parsed;
    } catch (err) {
      window.location.href = 'login.html?auth=required';
      return null;
    }
  }

  function getDocsKey() {
    return STORAGE_KEYS.DOCS_PREFIX + currentSession.userId.toLowerCase();
  }

  function getBackupKey() {
    return STORAGE_KEYS.BACKUP_PREFIX + currentSession.userId.toLowerCase();
  }

  function getDocuments() {
    try {
      const parsed = JSON.parse(localStorage.getItem(getDocsKey()) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveDocuments(docs) {
    try {
      localStorage.setItem(getDocsKey(), JSON.stringify(docs));
      return true;
    } catch (err) {
      // Fallback if localStorage quota is exceeded by large data URLs
      const trimmed = docs.map(function (doc, idx) {
        if (idx === 0 && doc.dataUrl && doc.dataUrl.length > 200000) {
          return Object.assign({}, doc, {
            dataUrl: null,
            storageNote: 'File metadata stored (preview omitted due to browser localStorage limit).',
          });
        }
        return doc;
      });
      try {
        localStorage.setItem(getDocsKey(), JSON.stringify(trimmed));
        showToast('Saved metadata (file binary exceeded browser localStorage quota).', 'info');
        return true;
      } catch (e2) {
        showToast('Browser storage quota is full. Delete old files first.', 'error');
        return false;
      }
    }
  }

  function getBackupSnapshot() {
    try {
      const raw = localStorage.getItem(getBackupKey());
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Seed sample demo documents and an initial backup snapshot on first visit
   * so the dashboard immediately demonstrates realistic non-sensitive records.
   */
  function ensureInitialSeedData() {
    const existingRaw = localStorage.getItem(getDocsKey());
    if (existingRaw !== null) return;

    const sampleDocs = [
      {
        id: 'doc_sample_1',
        name: 'Aadhaar_Card_Sample.pdf',
        category: 'Aadhaar',
        ext: 'pdf',
        size: 251000,
        uploadedAt: '2026-11-18T09:30:00.000Z',
        isSample: true,
        dataUrl: null,
      },
      {
        id: 'doc_sample_2',
        name: '10th_Marksheet_Sample.jpg',
        category: 'Marksheets',
        ext: 'jpg',
        size: 1258291,
        uploadedAt: '2026-11-16T14:20:00.000Z',
        isSample: true,
        dataUrl: null,
      },
      {
        id: 'doc_sample_3',
        name: 'PAN_Card_Sample.png',
        category: 'PAN',
        ext: 'png',
        size: 420864,
        uploadedAt: '2026-11-14T11:10:00.000Z',
        isSample: true,
        dataUrl: null,
      },
      {
        id: 'doc_sample_4',
        name: 'Degree_Certificate_Sample.pdf',
        category: 'Certificates',
        ext: 'pdf',
        size: 890880,
        uploadedAt: '2026-11-10T16:45:00.000Z',
        isSample: true,
        dataUrl: null,
      },
    ];

    saveDocuments(sampleDocs);

    const initialBackup = {
      createdAt: '2026-11-18T09:35:00.000Z',
      documents: sampleDocs,
    };
    localStorage.setItem(getBackupKey(), JSON.stringify(initialBackup));
  }

  /* ========================================================================
     SIDEBAR, TOPBAR & LOGOUT
     ======================================================================== */
  function initSidebarAndTopbar() {
    const nameEl = document.getElementById('topbarUserName');
    const initialEl = document.getElementById('topbarUserInitial');
    const displayName = currentSession.fullName || currentSession.userId;

    if (nameEl) nameEl.textContent = displayName;
    if (initialEl) initialEl.textContent = displayName.charAt(0).toUpperCase();

    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const closeBtn = document.getElementById('sidebarCloseBtn');

    function openSidebar() {
      if (sidebar) sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    }

    function closeSidebar() {
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    }

    if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    // Highlight hash sections on dashboard.html
    if (document.getElementById('recentUploadsList')) {
      syncSidebarHashActive();
      window.addEventListener('hashchange', syncSidebarHashActive);
      document.querySelectorAll('.sidebar-link[data-nav]').forEach(function (link) {
        link.addEventListener('click', function () {
          closeSidebar();
        });
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        window.location.href = 'login.html?loggedout=1';
      });
    }
  }

  function syncSidebarHashActive() {
    const hash = window.location.hash;
    const navLinks = document.querySelectorAll('.sidebar-link[data-nav]');
    let targetNav = 'dashboard';
    if (hash === '#backup') targetNav = 'backup';
    if (hash === '#profile') targetNav = 'profile';

    navLinks.forEach(function (link) {
      if (link.getAttribute('data-nav') === targetNav) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /* ========================================================================
     DASHBOARD OVERVIEW, BACKUP & RESTORE, PROFILE
     ======================================================================== */
  function initDashboardPage() {
    const welcomeNameEl = document.getElementById('welcomeUserName');
    if (welcomeNameEl) {
      welcomeNameEl.textContent = currentSession.fullName || currentSession.userId;
    }

    refreshDashboardMetricsAndRecent();
    initBackupAndRestoreControls();
    initProfileEditor();
  }

  function refreshDashboardMetricsAndRecent() {
    const docs = getDocuments();
    const totalCountEl = document.getElementById('kpiTotalDocs');
    const storageUsedEl = document.getElementById('kpiStorageUsed');
    const storageFillEl = document.getElementById('storageBarFill');
    const recentContainer = document.getElementById('recentUploadsList');

    const totalBytes = docs.reduce(function (sum, d) {
      return sum + (Number(d.size) || 0);
    }, 0);

    if (totalCountEl) totalCountEl.textContent = String(docs.length);
    if (storageUsedEl) {
      storageUsedEl.textContent = formatFileSize(totalBytes) + ' / 1 GB';
    }
    if (storageFillEl) {
      const pct = Math.min(100, Math.max(docs.length > 0 ? 2 : 0, (totalBytes / MAX_VAULT_QUOTA_BYTES) * 100));
      storageFillEl.style.width = pct.toFixed(1) + '%';
    }

    if (!recentContainer) return;

    if (docs.length === 0) {
      recentContainer.innerHTML =
        '<div class="empty-state">' +
        '<h3>No documents uploaded yet</h3>' +
        '<p>Upload a sample PDF or image to see your recent activity here.</p>' +
        '<a href="upload.html" class="btn btn-primary btn-sm">Upload First Document</a>' +
        '</div>';
      return;
    }

    const sorted = docs
      .slice()
      .sort(function (a, b) {
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      })
      .slice(0, 4);

    recentContainer.innerHTML = sorted.map(renderDocumentRowHtml).join('');
    bindDocumentActionButtons(recentContainer);
  }

  function initBackupAndRestoreControls() {
    const createBtn = document.getElementById('createBackupBtn');
    const downloadBtn = document.getElementById('downloadBackupBtn');
    const restoreBtn = document.getElementById('restoreBackupBtn');

    renderBackupStats();

    if (createBtn) {
      createBtn.addEventListener('click', function () {
        const docs = getDocuments();
        const snapshot = {
          createdAt: new Date().toISOString(),
          userId: currentSession.userId,
          documents: docs,
        };
        localStorage.setItem(getBackupKey(), JSON.stringify(snapshot));
        renderBackupStats();
        showToast('Backup snapshot updated (' + docs.length + ' files).', 'success');
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        const snapshot = getBackupSnapshot() || {
          createdAt: new Date().toISOString(),
          userId: currentSession.userId,
          documents: getDocuments(),
        };
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
          type: 'application/json',
        });
        triggerBlobDownload(blob, 'DocLocker_Backup_' + currentSession.userId + '.json');
        showToast('Backup archive (.json) downloaded.', 'success');
      });
    }

    if (restoreBtn) {
      restoreBtn.addEventListener('click', function () {
        const snapshot = getBackupSnapshot();
        if (!snapshot || !Array.isArray(snapshot.documents) || snapshot.documents.length === 0) {
          showToast('No backup snapshot found to restore.', 'error');
          return;
        }
        saveDocuments(snapshot.documents);
        refreshDashboardMetricsAndRecent();
        showToast('Restored ' + snapshot.documents.length + ' files from your latest backup.', 'success');
      });
    }
  }

  function renderBackupStats() {
    const statusEl = document.getElementById('backupStatusValue');
    const lastTimeEl = document.getElementById('lastBackupTime');
    const countEl = document.getElementById('backupFilesCount');
    if (!statusEl || !lastTimeEl || !countEl) return;

    const snapshot = getBackupSnapshot();
    if (!snapshot) {
      statusEl.textContent = 'No Snapshot Yet';
      lastTimeEl.textContent = 'Never';
      countEl.textContent = '0 files';
      return;
    }

    const docCount = Array.isArray(snapshot.documents) ? snapshot.documents.length : 0;
    statusEl.textContent = 'Local Snapshot Ready';
    lastTimeEl.textContent = formatDate(snapshot.createdAt);
    countEl.textContent = docCount + ' file' + (docCount === 1 ? '' : 's');
  }

  function initProfileEditor() {
    const form = document.getElementById('profileForm');
    const nameInput = document.getElementById('profileFullName');
    const emailInput = document.getElementById('profileEmail');
    const userIdInput = document.getElementById('profileUserId');
    const joinedInput = document.getElementById('profileJoinedDate');
    const saveNote = document.getElementById('profileSaveNote');

    if (!form) return;

    nameInput.value = currentSession.fullName || '';
    emailInput.value = currentSession.email || '';
    userIdInput.value = currentSession.userId || '';
    joinedInput.value = currentSession.createdAt ? formatDate(currentSession.createdAt) : 'Nov 2026';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const newName = nameInput.value.trim();
      const newEmail = emailInput.value.trim();
      if (newName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        showToast('Enter a valid full name and email address.', 'error');
        return;
      }

      currentSession.fullName = newName;
      currentSession.email = newEmail;
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentSession));

      // Also update stored user directory record
      try {
        const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
        const idx = users.findIndex(function (u) {
          return u.userId.toLowerCase() === currentSession.userId.toLowerCase();
        });
        if (idx !== -1) {
          users[idx].fullName = newName;
          users[idx].email = newEmail;
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      } catch (err) {
        // Ignore directory update issue
      }

      const welcomeEl = document.getElementById('welcomeUserName');
      const topNameEl = document.getElementById('topbarUserName');
      const topInitialEl = document.getElementById('topbarUserInitial');
      if (welcomeEl) welcomeEl.textContent = newName;
      if (topNameEl) topNameEl.textContent = newName;
      if (topInitialEl) topInitialEl.textContent = newName.charAt(0).toUpperCase();

      if (saveNote) {
        saveNote.classList.remove('hidden');
        setTimeout(function () {
          saveNote.classList.add('hidden');
        }, 2500);
      }
      showToast('Profile details saved.', 'success');
    });
  }

  /* ========================================================================
     UPLOAD PAGE (DRAG & DROP, VALIDATION, PROGRESS UI)
     ======================================================================== */
  function initUploadPage() {
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('fileInput');
    const chooseBtn = document.getElementById('chooseFileBtn');
    const categorySelect = document.getElementById('docCategorySelect');
    const previewBox = document.getElementById('filePreviewBox');
    const previewBadge = document.getElementById('previewTypeBadge');
    const previewName = document.getElementById('previewFileName');
    const previewSize = document.getElementById('previewFileSize');
    const clearBtn = document.getElementById('clearSelectedFileBtn');
    const startUploadBtn = document.getElementById('startUploadBtn');
    const progressBox = document.getElementById('uploadProgressBox');
    const progressFill = document.getElementById('uploadProgressFill');
    const progressPct = document.getElementById('uploadProgressPct');
    const progressLabel = document.getElementById('uploadProgressLabel');
    const errorAlert = document.getElementById('uploadErrorAlert');
    const errorText = document.getElementById('uploadErrorText');
    const successAlert = document.getElementById('uploadSuccessAlert');

    let selectedFile = null;
    let isUploading = false;

    chooseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!isUploading) fileInput.click();
    });

    dropzone.addEventListener('click', function () {
      if (!isUploading) fileInput.click();
    });

    dropzone.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
        e.preventDefault();
        fileInput.click();
      }
    });

    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (isUploading) return;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFileSelection(fileInput.files[0]);
      }
    });

    clearBtn.addEventListener('click', function () {
      resetSelection();
    });

    startUploadBtn.addEventListener('click', function () {
      if (!selectedFile || isUploading) return;
      beginSimulatedUpload(selectedFile);
    });

    function handleFileSelection(file) {
      hideAlerts();
      const ext = getFileExtension(file.name);

      if (ALLOWED_EXTENSIONS.indexOf(ext) === -1 && ALLOWED_MIMES.indexOf(file.type) === -1) {
        showUploadError('Unsupported file format. Please choose a PDF, JPG, JPEG, or PNG file.');
        resetSelection(true);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        showUploadError(
          'File size (' + formatFileSize(file.size) + ') exceeds the maximum 10 MB limit.'
        );
        resetSelection(true);
        return;
      }

      selectedFile = file;
      previewBadge.textContent = ext.toUpperCase();
      previewBadge.className = 'file-type-badge ' + ext;
      previewName.textContent = file.name;
      previewSize.textContent = formatFileSize(file.size);
      previewBox.classList.remove('hidden');
      progressBox.classList.add('hidden');
    }

    function beginSimulatedUpload(file) {
      isUploading = true;
      hideAlerts();
      startUploadBtn.disabled = true;
      clearBtn.disabled = true;
      progressBox.classList.remove('hidden');
      progressFill.style.width = '0%';
      progressPct.textContent = '0%';
      progressLabel.textContent = 'Uploading ' + file.name + '...';

      // Read small files (<1.5 MB) as Data URLs for real in-browser preview & download
      let fileDataUrlPromise;
      if (file.size <= 1500000) {
        fileDataUrlPromise = new Promise(function (resolve) {
          const reader = new FileReader();
          reader.onload = function () {
            resolve(typeof reader.result === 'string' ? reader.result : null);
          };
          reader.onerror = function () {
            resolve(null);
          };
          reader.readAsDataURL(file);
        });
      } else {
        fileDataUrlPromise = Promise.resolve(null);
      }

      let pct = 0;
      const timer = setInterval(function () {
        pct = Math.min(100, pct + 18);
        progressFill.style.width = pct + '%';
        progressPct.textContent = pct + '%';

        if (pct >= 100) {
          clearInterval(timer);
          fileDataUrlPromise.then(function (dataUrl) {
            const docs = getDocuments();
            const ext = getFileExtension(file.name) || 'pdf';
            const newDoc = {
              id: 'doc_' + Date.now(),
              name: file.name,
              category: categorySelect.value || 'Other',
              ext: ext,
              size: file.size,
              uploadedAt: new Date().toISOString(),
              isSample: false,
              dataUrl: dataUrl,
            };

            docs.unshift(newDoc);
            const saved = saveDocuments(docs);

            isUploading = false;
            startUploadBtn.disabled = false;
            clearBtn.disabled = false;

            if (saved) {
              progressLabel.textContent = 'Upload complete';
              successAlert.classList.remove('hidden');
              showToast('"' + file.name + '" uploaded to ' + newDoc.category + '.', 'success');
              resetSelection(true);
            }
          });
        }
      }, 110);
    }

    function resetSelection(keepSuccess) {
      selectedFile = null;
      fileInput.value = '';
      previewBox.classList.add('hidden');
      if (!keepSuccess) {
        progressBox.classList.add('hidden');
        hideAlerts();
      }
    }

    function showUploadError(msg) {
      errorText.textContent = msg;
      errorAlert.classList.remove('hidden');
    }

    function hideAlerts() {
      errorAlert.classList.add('hidden');
      successAlert.classList.add('hidden');
    }
  }

  /* ========================================================================
     MY DOCUMENTS PAGE (SEARCH, CATEGORY FILTERS, PREVIEW, DOWNLOAD, DELETE)
     ======================================================================== */
  function initDocumentsPage() {
    const searchInput = document.getElementById('docSearchInput');
    const filterTabs = document.querySelectorAll('.filter-tab[data-category]');
    const gridBtn = document.getElementById('viewToggleGridBtn');
    const listBtn = document.getElementById('viewToggleListBtn');

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        currentSearch = searchInput.value.trim().toLowerCase();
        renderDocumentsList();
      });
    }

    filterTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        currentCategory = tab.getAttribute('data-category') || 'All';
        filterTabs.forEach(function (t) {
          const active = t === tab;
          t.classList.toggle('active', active);
          t.setAttribute('aria-selected', String(active));
        });
        renderDocumentsList();
      });
    });

    if (gridBtn && listBtn) {
      gridBtn.addEventListener('click', function () {
        currentViewMode = 'grid';
        gridBtn.className = 'btn btn-outline btn-sm';
        listBtn.className = 'btn btn-ghost btn-sm';
        gridBtn.setAttribute('aria-pressed', 'true');
        listBtn.setAttribute('aria-pressed', 'false');
        renderDocumentsList();
      });

      listBtn.addEventListener('click', function () {
        currentViewMode = 'list';
        listBtn.className = 'btn btn-outline btn-sm';
        gridBtn.className = 'btn btn-ghost btn-sm';
        listBtn.setAttribute('aria-pressed', 'true');
        gridBtn.setAttribute('aria-pressed', 'false');
        renderDocumentsList();
      });
    }

    initPreviewModal();
    renderDocumentsList();
  }

  function renderDocumentsList() {
    const container = document.getElementById('documentsContainer');
    if (!container) return;

    const allDocs = getDocuments();
    const filtered = allDocs.filter(function (doc) {
      const matchesCat = currentCategory === 'All' || doc.category === currentCategory;
      const matchesSearch =
        !currentSearch ||
        doc.name.toLowerCase().indexOf(currentSearch) !== -1 ||
        doc.category.toLowerCase().indexOf(currentSearch) !== -1;
      return matchesCat && matchesSearch;
    });

    if (filtered.length === 0) {
      const hasAny = allDocs.length > 0;
      container.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-state-icon" aria-hidden="true">' +
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>' +
        '</svg></div>' +
        '<h3>' +
        (hasAny ? 'No matching documents found' : 'Your vault has no documents') +
        '</h3>' +
        '<p>' +
        (hasAny
          ? 'Try clearing your search term or switching category tabs.'
          : 'Upload a PDF, JPG, or PNG file to start organizing your documents.') +
        '</p>' +
        (hasAny
          ? '<button type="button" class="btn btn-outline btn-sm" id="resetDocFiltersBtn">Reset Filters</button>'
          : '<a href="upload.html" class="btn btn-primary btn-sm">Upload Document</a>') +
        '</div>';

      const resetBtn = document.getElementById('resetDocFiltersBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          currentCategory = 'All';
          currentSearch = '';
          const searchEl = document.getElementById('docSearchInput');
          if (searchEl) searchEl.value = '';
          document.querySelectorAll('.filter-tab').forEach(function (t) {
            const isAll = t.getAttribute('data-category') === 'All';
            t.classList.toggle('active', isAll);
            t.setAttribute('aria-selected', String(isAll));
          });
          renderDocumentsList();
        });
      }
      return;
    }

    if (currentViewMode === 'list') {
      container.innerHTML =
        '<div class="panel-card" style="padding: 12px 18px;"><div class="doc-list">' +
        filtered.map(renderDocumentRowHtml).join('') +
        '</div></div>';
    } else {
      container.innerHTML =
        '<div class="docs-grid">' + filtered.map(renderDocumentCardHtml).join('') + '</div>';
    }

    bindDocumentActionButtons(container);
  }

  function renderDocumentRowHtml(doc) {
    const ext = escapeHtml((doc.ext || 'pdf').toLowerCase());
    const safeName = escapeHtml(doc.name);
    const safeCat = escapeHtml(doc.category || 'Other');
    const dateStr = formatDate(doc.uploadedAt);
    const sizeStr = formatFileSize(doc.size);

    return (
      '<div class="doc-row" data-doc-id="' +
      escapeHtml(doc.id) +
      '">' +
      '<div class="doc-row-left">' +
      '<div class="file-type-badge ' +
      ext +
      '">' +
      ext.toUpperCase() +
      '</div>' +
      '<div class="doc-meta-info">' +
      '<div class="doc-name" title="' +
      safeName +
      '">' +
      safeName +
      '</div>' +
      '<div class="doc-submeta tabular-nums">' +
      '<span>' +
      safeCat +
      '</span>' +
      '<span aria-hidden="true">&middot;</span>' +
      '<span>Uploaded ' +
      dateStr +
      '</span>' +
      '<span aria-hidden="true">&middot;</span>' +
      '<span>' +
      sizeStr +
      '</span>' +
      '</div></div></div>' +
      '<div class="doc-actions">' +
      (document.getElementById('previewModal')
        ? '<button type="button" class="icon-action-btn" data-action="preview" data-id="' +
          escapeHtml(doc.id) +
          '" title="Preview document" aria-label="Preview ' +
          safeName +
          '">' +
          getEyeIconSvg() +
          '</button>'
        : '') +
      '<button type="button" class="icon-action-btn" data-action="download" data-id="' +
      escapeHtml(doc.id) +
      '" title="Download document" aria-label="Download ' +
      safeName +
      '">' +
      getDownloadIconSvg() +
      '</button>' +
      '<button type="button" class="icon-action-btn delete" data-action="delete" data-id="' +
      escapeHtml(doc.id) +
      '" title="Delete document" aria-label="Delete ' +
      safeName +
      '">' +
      getTrashIconSvg() +
      '</button>' +
      '</div></div>'
    );
  }

  function renderDocumentCardHtml(doc) {
    const ext = escapeHtml((doc.ext || 'pdf').toLowerCase());
    const safeName = escapeHtml(doc.name);
    const safeCat = escapeHtml(doc.category || 'Other');
    const dateStr = formatDate(doc.uploadedAt);
    const sizeStr = formatFileSize(doc.size);

    return (
      '<article class="doc-grid-card" data-doc-id="' +
      escapeHtml(doc.id) +
      '">' +
      '<div class="doc-card-top">' +
      '<div class="file-type-badge ' +
      ext +
      '">' +
      ext.toUpperCase() +
      '</div>' +
      '<div class="doc-meta-info">' +
      '<div class="doc-name" title="' +
      safeName +
      '">' +
      safeName +
      '</div>' +
      '<div class="doc-submeta tabular-nums">' +
      '<span>' +
      safeCat +
      '</span>' +
      '<span aria-hidden="true">&middot;</span>' +
      '<span>' +
      sizeStr +
      '</span>' +
      '</div>' +
      '<div class="doc-submeta tabular-nums" style="margin-top: 4px;">Uploaded ' +
      dateStr +
      '</div>' +
      '</div></div>' +
      '<div class="doc-card-footer">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="preview" data-id="' +
      escapeHtml(doc.id) +
      '">Preview</button>' +
      '<div class="doc-actions">' +
      '<button type="button" class="icon-action-btn" data-action="download" data-id="' +
      escapeHtml(doc.id) +
      '" title="Download ' +
      safeName +
      '" aria-label="Download ' +
      safeName +
      '">' +
      getDownloadIconSvg() +
      '</button>' +
      '<button type="button" class="icon-action-btn delete" data-action="delete" data-id="' +
      escapeHtml(doc.id) +
      '" title="Delete ' +
      safeName +
      '" aria-label="Delete ' +
      safeName +
      '">' +
      getTrashIconSvg() +
      '</button>' +
      '</div></div></article>'
    );
  }

  function bindDocumentActionButtons(rootEl) {
    rootEl.querySelectorAll('[data-action="download"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        downloadDocumentById(btn.getAttribute('data-id'));
      });
    });

    rootEl.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openDeleteModal(btn.getAttribute('data-id'));
      });
    });

    rootEl.querySelectorAll('[data-action="preview"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openPreviewModal(btn.getAttribute('data-id'));
      });
    });
  }

  function downloadDocumentById(docId) {
    const doc = getDocuments().find(function (d) {
      return d.id === docId;
    });
    if (!doc) return;

    if (doc.dataUrl) {
      const link = document.createElement('a');
      link.href = doc.dataUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Downloading "' + doc.name + '".', 'success');
      return;
    }

    // Generate a clean sample file download for pre-seeded or oversized demo items
    const summaryText =
      'DocLocker Prototype Document Copy\n' +
      '================================\n' +
      'File Name: ' +
      doc.name +
      '\n' +
      'Category: ' +
      doc.category +
      '\n' +
      'Uploaded: ' +
      formatDate(doc.uploadedAt) +
      '\n' +
      'Recorded Size: ' +
      formatFileSize(doc.size) +
      '\n\n' +
      'Note: This is a sample/prototype file generated by DocLocker frontend storage.\n';

    const blob = new Blob([summaryText], { type: 'text/plain;charset=utf-8' });
    const downloadName = doc.isSample ? doc.name + '.txt' : doc.name;
    triggerBlobDownload(blob, downloadName);
    showToast('Downloaded demo copy of "' + doc.name + '".', 'success');
  }

  /* ========================================================================
     PREVIEW & DELETE MODALS
     ======================================================================== */
  function initPreviewModal() {
    const modal = document.getElementById('previewModal');
    const closeBtn = document.getElementById('closePreviewModal');
    const closeFooterBtn = document.getElementById('closePreviewFooterBtn');
    const dlBtn = document.getElementById('previewDownloadBtn');
    if (!modal) return;

    function closeModal() {
      modal.classList.add('hidden');
      pendingPreviewDocId = null;
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        if (pendingPreviewDocId) downloadDocumentById(pendingPreviewDocId);
      });
    }
  }

  function openPreviewModal(docId) {
    const modal = document.getElementById('previewModal');
    const titleEl = document.getElementById('previewModalTitle');
    const metaEl = document.getElementById('previewModalMeta');
    const bodyEl = document.getElementById('previewModalBody');
    if (!modal || !bodyEl) return;

    const doc = getDocuments().find(function (d) {
      return d.id === docId;
    });
    if (!doc) return;

    pendingPreviewDocId = doc.id;
    titleEl.textContent = doc.name;
    metaEl.textContent =
      doc.category + ' · Uploaded ' + formatDate(doc.uploadedAt) + ' · ' + formatFileSize(doc.size);

    if (doc.dataUrl && doc.dataUrl.indexOf('data:image/') === 0) {
      bodyEl.innerHTML = '<img src="' + doc.dataUrl + '" alt="' + escapeHtml(doc.name) + '">';
    } else if (doc.dataUrl && doc.dataUrl.indexOf('data:application/pdf') === 0) {
      bodyEl.innerHTML =
        '<iframe src="' +
        doc.dataUrl +
        '" title="' +
        escapeHtml(doc.name) +
        '" style="width:100%; height:360px; border:none; border-radius:8px;"></iframe>';
    } else {
      bodyEl.innerHTML =
        '<div style="padding: 24px 12px;">' +
        '<div class="file-type-badge ' +
        escapeHtml(doc.ext || 'pdf') +
        '" style="margin: 0 auto 14px; width: 56px; height: 56px; font-size: 0.9rem;">' +
        escapeHtml((doc.ext || 'pdf').toUpperCase()) +
        '</div>' +
        '<h3 style="font-size: 1.05rem; margin-bottom: 6px;">' +
        escapeHtml(doc.name) +
        '</h3>' +
        '<p style="color: var(--color-text-muted); font-size: 0.9rem; max-width: 420px; margin: 0 auto;">' +
        (doc.isSample
          ? 'Sample placeholder document pre-loaded for UI demonstration. Click "Download File" below to save a sample copy.'
          : 'Binary preview omitted because this file exceeded browser localStorage preview size limits.') +
        '</p></div>';
    }

    modal.classList.remove('hidden');
  }

  function initDeleteModal() {
    const modal = document.getElementById('confirmDeleteModal');
    const closeBtn = document.getElementById('closeDeleteModal');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (!modal) return;

    function closeModal() {
      modal.classList.add('hidden');
      pendingDeleteDocId = null;
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (!pendingDeleteDocId) return;
        const docs = getDocuments();
        const removed = docs.find(function (d) {
          return d.id === pendingDeleteDocId;
        });
        const remaining = docs.filter(function (d) {
          return d.id !== pendingDeleteDocId;
        });
        saveDocuments(remaining);
        closeModal();

        if (document.getElementById('recentUploadsList')) {
          refreshDashboardMetricsAndRecent();
        }
        if (document.getElementById('documentsContainer')) {
          renderDocumentsList();
        }
        if (removed) {
          showToast('Deleted "' + removed.name + '".', 'info');
        }
      });
    }
  }

  function openDeleteModal(docId) {
    const modal = document.getElementById('confirmDeleteModal');
    const nameEl = document.getElementById('deleteDocName');
    const doc = getDocuments().find(function (d) {
      return d.id === docId;
    });
    if (!modal || !doc) return;

    pendingDeleteDocId = doc.id;
    if (nameEl) nameEl.textContent = doc.name;
    modal.classList.remove('hidden');
  }

  /* ========================================================================
     UTILITIES & TOASTS
     ======================================================================== */
  function triggerBlobDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3400);
  }

  function formatFileSize(bytes) {
    const num = Number(bytes) || 0;
    if (num < 1024) return num + ' B';
    if (num < 1024 * 1024) return (num / 1024).toFixed(0) + ' KB';
    return (num / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function formatDate(isoStr) {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return 'Recent';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function getFileExtension(name) {
    const parts = String(name || '').split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getEyeIconSvg() {
    return (
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
      '<circle cx="12" cy="12" r="3"></circle>' +
      '</svg>'
    );
  }

  function getDownloadIconSvg() {
    return (
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
      '<polyline points="7 10 12 15 17 10"></polyline>' +
      '<line x1="12" y1="15" x2="12" y2="3"></line>' +
      '</svg>'
    );
  }

  function getTrashIconSvg() {
    return (
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="3 6 5 6 21 6"></polyline>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
      '</svg>'
    );
  }
})();

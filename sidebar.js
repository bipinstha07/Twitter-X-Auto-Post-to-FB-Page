// Global state
let uploadedVideoData = null;
let currentPostIdForUpload = null;
let fbCredentialsSet = false;
let fbGroupsList = [];

// Mark sidebar as open and establish heartbeat
chrome.storage.local.set({ sidebarOpen: true });

// Load initial state
function loadInitialState() {
  chrome.storage.local.get(['lastSubmittedTweet', 'uploadedVideoData', 'uploadedVideoPostId', 'fbPageId', 'fbAccessToken', 'showCredit', 'fbGroups'], (result) => {
    // Check for credentials first
    if (result.fbPageId && result.fbAccessToken) {
      fbCredentialsSet = true;
      document.getElementById('fbPageId').value = result.fbPageId;
      document.getElementById('fbAccessToken').value = result.fbAccessToken;
      showView('mainView');
    } else {
      fbCredentialsSet = false;
      document.getElementById('configTitle').innerText = "Initial Setup";
      document.getElementById('backBtn').style.display = 'none';
      showView('configView');
    }

    fbGroupsList = result.fbGroups || [];
    renderConfigGroupsList();
    renderMainPostToGroups();
    initMainPostToGroupsListeners();

    if (result.uploadedVideoPostId) {
      currentPostIdForUpload = result.uploadedVideoPostId;
    }
    if (result.uploadedVideoData) {
      uploadedVideoData = result.uploadedVideoData;
    }
    if (result.lastSubmittedTweet) {
      displayTweetData(result.lastSubmittedTweet);
    } else {
      displayTweetData(null);
    }

    // Show credit setting (default: off)
    const showCreditEl = document.getElementById('showCredit');
    if (showCreditEl) showCreditEl.checked = result.showCredit === true;
  });
}

// View Management
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  
  // Show all nav buttons on every tab: Home, FB Groups, Settings
  document.getElementById('homeBtn').style.display = 'block';
  document.getElementById('groupsBtn').style.display = 'block';
  document.getElementById('settingsBtn').style.display = 'block';
  if (viewId === 'groupsView') renderConfigGroupsList();
  if (viewId === 'mainView') renderMainPostToGroups();
}

// Navigation Event Listeners
document.getElementById('homeBtn').addEventListener('click', () => {
  if (fbCredentialsSet) {
    showView('mainView');
  } else {
    showView('configView');
  }
});

document.getElementById('groupsBtn').addEventListener('click', () => {
  showView('groupsView');
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('configTitle').innerText = "Facebook Configuration";
  document.getElementById('backBtn').style.display = 'block';
  showView('configView');
});

document.getElementById('backBtn').addEventListener('click', () => {
  if (fbCredentialsSet) {
    showView('mainView');
  }
});

document.getElementById('groupsBackBtn').addEventListener('click', () => {
  showView(fbCredentialsSet ? 'mainView' : 'configView');
});

// Toggle Token Visibility
document.getElementById('toggleToken')?.addEventListener('click', () => {
  const tokenInput = document.getElementById('fbAccessToken');
  const eyeIcon = document.getElementById('eyeIcon');
  
  if (tokenInput.type === 'password') {
    tokenInput.type = 'text';
    // Eye off icon
    eyeIcon.innerHTML = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92C21.27 15.39 23 12 23 12c-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.73 10.15 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';
  } else {
    tokenInput.type = 'password';
    // Eye on icon
    eyeIcon.innerHTML = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
  }
});

// Guide Button
document.getElementById('guideBtn')?.addEventListener('click', () => {
  showView('guideView');
});

document.getElementById('closeGuideBtn')?.addEventListener('click', () => {
  showView('configView');
});

// Save "Show credit" when checkbox is toggled (no need to click Save Credentials)
document.getElementById('showCredit')?.addEventListener('change', () => {
  const showCredit = document.getElementById('showCredit').checked;
  chrome.storage.local.set({ showCredit });
});

document.getElementById('saveConfigBtn').addEventListener('click', () => {
  const pageId = document.getElementById('fbPageId').value.trim();
  const token = document.getElementById('fbAccessToken').value.trim();
  const btn = document.getElementById('saveConfigBtn');

  if (!pageId || !token) {
    alert('Please enter both Page ID and Access Token');
    return;
  }

  btn.disabled = true;
  btn.innerText = 'Saving...';

  const showCredit = document.getElementById('showCredit')?.checked === true;
  chrome.storage.local.set({
    fbPageId: pageId,
    fbAccessToken: token,
    showCredit: showCredit
  }, () => {
    fbCredentialsSet = true;
    
    // Brief success state on button
    btn.innerText = 'Settings Saved! ✓';
    btn.style.background = 'var(--success-green)';
    btn.style.borderColor = 'var(--success-green)';
    
    setTimeout(() => {
      btn.disabled = false;
      btn.innerText = 'Save Credentials';
      btn.style.background = ''; // Revert to CSS default
      btn.style.borderColor = '';
      showView('mainView');
    }, 1200);
  });
});

// Normalize Facebook group URL for storage and opening
function normalizeGroupUrl(url) {
  const s = (url || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, '');
    if ((host === 'facebook.com' || host === 'm.facebook.com') && u.pathname.indexOf('/groups/') === 0) {
      const path = u.pathname.replace(/\/$/, '');
      return u.origin + path;
    }
  } catch (_) {}
  return '';
}

function parseGroupIdFromLink(link) {
  if (!link || typeof link !== 'string') return null;
  const trimmed = link.trim();
  const match = trimmed.match(/facebook\.com\/groups\/(\d+)/i) || trimmed.match(/fb\.com\/groups\/(\d+)/i) || trimmed.match(/^(\d+)$/);
  return match ? match[1] : null;
}

function renderConfigGroupsList() {
  const listEl = document.getElementById('fbGroupsList');
  if (!listEl) return;
  if (fbGroupsList.length === 0) {
    listEl.innerHTML = '<li class="fb-groups-empty">No groups added. Add a group link above.</li>';
    return;
  }
  listEl.innerHTML = fbGroupsList.map((g) => `
    <li>
      <span class="group-name-ref" data-group-link="${escapeHtml(g.link)}" title="Click to edit name">${g.name ? escapeHtml(g.name) : '—'}</span>
      <a href="${escapeHtml(g.link)}" target="_blank" rel="noopener" class="group-link" title="${escapeHtml(g.link)}">${escapeHtml(g.id)}</a>
      <button type="button" class="remove-group" data-group-link="${escapeHtml(g.link)}">Remove</button>
    </li>
  `).join('');
  listEl.querySelectorAll('.remove-group').forEach((btn) => {
    btn.addEventListener('click', () => {
      const link = btn.getAttribute('data-group-link');
      fbGroupsList = fbGroupsList.filter((g) => g.link !== link);
      chrome.storage.local.set({ fbGroups: fbGroupsList });
      renderConfigGroupsList();
    });
  });
  listEl.querySelectorAll('.group-name-ref').forEach((span) => {
    span.addEventListener('click', (e) => {
      e.preventDefault();
      const link = span.getAttribute('data-group-link');
      const g = fbGroupsList.find((x) => x.link === link);
      if (!g) return;
      const currentName = g.name || '';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'group-name-edit';
      input.value = currentName;
      input.placeholder = 'Name for reference';
      span.replaceWith(input);
      input.focus();
      input.select();
      let onKey;
      input.addEventListener('blur', function onBlur() {
        const newName = input.value.trim() || null;
        g.name = newName;
        chrome.storage.local.set({ fbGroups: fbGroupsList });
        input.removeEventListener('blur', onBlur);
        input.removeEventListener('keydown', onKey);
        renderConfigGroupsList();
      });
      onKey = function (ev) {
        if (ev.key === 'Enter') {
          input.blur();
        } else if (ev.key === 'Escape') {
          input.value = currentName;
          input.blur();
        }
      };
      input.addEventListener('keydown', onKey);
    });
  });
}

document.getElementById('fbAddGroupBtn').addEventListener('click', () => {
  const nameInput = document.getElementById('fbGroupNameInput');
  const linkInput = document.getElementById('fbGroupLinkInput');
  const raw = linkInput?.value?.trim();
  if (!raw) {
    alert('Please enter a group link (e.g. https://www.facebook.com/groups/123456789/)');
    return;
  }
  const link = normalizeGroupUrl(raw);
  if (!link) {
    alert('Please enter a valid Facebook group URL (e.g. https://www.facebook.com/groups/123456789)');
    return;
  }
  if (fbGroupsList.some((g) => g.link === link)) {
    alert('This group is already in the list.');
    return;
  }
  const id = parseGroupIdFromLink(link) || link;
  const name = nameInput?.value?.trim() || null;
  fbGroupsList.push({ id, link, name: name || `Group ${id}` });
  chrome.storage.local.set({ fbGroups: fbGroupsList });
  renderConfigGroupsList();
  linkInput.value = '';
  if (nameInput) nameInput.value = '';
});

// Establish a connection to background script to detect when sidebar is closed
const port = chrome.runtime.connect({ name: "sidebar" });

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

let mainPostToGroupsListenersInitialized = false;

function renderMainPostToGroups() {
  const checklistEl = document.getElementById('mainFbGroupsChecklist');
  if (!checklistEl) return;
  if (fbGroupsList.length === 0) {
    checklistEl.innerHTML = '<div class="fb-groups-empty" style="padding: 8px 0; color: var(--text-gray); font-size: 12px;">No groups added. Add groups in <strong>FB Groups</strong>.</div>';
    return;
  }
  const groupsCheckboxes = fbGroupsList.map((g) => `
    <label class="fb-group-check-item">
      <input type="checkbox" class="fb-group-check" data-group-link="${escapeHtml(g.link)}" checked>
      <span class="fb-group-check-label">${escapeHtml(g.name || g.id)}</span>
    </label>
  `).join('');
  checklistEl.innerHTML = groupsCheckboxes;
}

function initMainPostToGroupsListeners() {
  if (mainPostToGroupsListenersInitialized) return;
  mainPostToGroupsListenersInitialized = true;
  const mainChecklistEl = document.getElementById('mainFbGroupsChecklist');
  const mainMarkAllBtn = document.getElementById('mainMarkAllGroupsBtn');
  const mainUnmarkAllBtn = document.getElementById('mainUnmarkAllGroupsBtn');
  const mainShareBtn = document.getElementById('mainShareToGroupsBtn');
  if (mainMarkAllBtn && mainChecklistEl) {
    mainMarkAllBtn.addEventListener('click', () => {
      mainChecklistEl.querySelectorAll('.fb-group-check').forEach((cb) => { cb.checked = true; });
    });
  }
  if (mainUnmarkAllBtn && mainChecklistEl) {
    mainUnmarkAllBtn.addEventListener('click', () => {
      mainChecklistEl.querySelectorAll('.fb-group-check').forEach((cb) => { cb.checked = false; });
    });
  }
  if (mainShareBtn && mainChecklistEl) {
    mainShareBtn.addEventListener('click', () => {
      const linkInput = document.getElementById('mainGroupPostLinkInput');
      const linkToPaste = linkInput ? linkInput.value.trim() : '';
      const currentText = document.getElementById('tweetTextEdit')?.value || '';
      const checked = mainChecklistEl.querySelectorAll('.fb-group-check:checked');
      const groupUrls = Array.from(checked).map((cb) => cb.getAttribute('data-group-link')).filter(Boolean);
      const statusEl = document.getElementById('mainShareToGroupsStatus');
      if (!linkToPaste) {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Enter a link to paste in groups.'; statusEl.style.color = '#f4212e'; }
        return;
      }
      if (groupUrls.length === 0) {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Select at least one group.'; statusEl.style.color = '#f4212e'; }
        return;
      }
      if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Opening group tabs...'; statusEl.style.color = '#536471'; }
      mainShareBtn.disabled = true;
      chrome.runtime.sendMessage({
        action: 'postToAll',
        groups: groupUrls,
        link: linkToPaste,
        text: currentText
      }, (res) => {
        mainShareBtn.disabled = false;
        if (statusEl) {
          if (chrome.runtime.lastError) {
            statusEl.textContent = 'Error: ' + chrome.runtime.lastError.message;
            statusEl.style.color = '#f4212e';
          } else if (res && res.ok) {
            statusEl.textContent = 'Opened ' + res.count + ' group tab(s).';
            statusEl.style.color = '#0966FF';
          } else {
            statusEl.textContent = (res && res.error) ? res.error : 'Something went wrong.';
            statusEl.style.color = '#f4212e';
          }
        }
      });
    });
  }
}

function displayTweetData(tweetData) {
  const container = document.getElementById('tweetDisplay');
  console.log('Displaying tweet data:', tweetData);
  
  if (!tweetData) {
    container.innerHTML = 'No tweets collected yet.<br>Click "Preview" on any post to start.';
    container.className = 'no-data';
    return;
  }

  // If this is a DIFFERENT post than the one we have an uploaded video for, clear the upload
  if (tweetData.postId !== currentPostIdForUpload) {
    uploadedVideoData = null;
    currentPostIdForUpload = tweetData.postId;
    chrome.storage.local.remove(['uploadedVideoData', 'uploadedVideoPostId']);
  }

  container.className = ''; // Remove no-data class
  
  const text = escapeHtml(tweetData.text || '');
  const submittedAt = escapeHtml(tweetData.submittedAt || 'Unknown');
  const postId = tweetData.postId || '';
  
  // Format the post time if available, otherwise fallback to submission time
  let displayTime = submittedAt;
  if (tweetData.postTime) {
    try {
      const date = new Date(tweetData.postTime);
      displayTime = date.toLocaleString();
    } catch (e) {
      console.error('Error formatting post time:', e);
    }
  }

  let html = `
    <div class="tweet-card">
      <div class="section-label">Post Information</div>
      <div class="meta-info">
        <span><strong>Time:</strong> ${displayTime}</span>
        ${postId ? `<span><strong>ID:</strong> ${postId}</span>` : ''}
      </div>
      
      ${tweetData.savedFolderPath ? `
        <div class="section-label">Downloaded To</div>
        <div class="meta-info">
          <div style="font-size: 10px; color: var(--success-green); font-weight: bold; margin-bottom: 4px;">✅ Files saved automatically!</div>
          <div class="path-badge" style="background: #e8f5fd; color: #1d9bf0; padding: 6px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 9px; line-height: 1.2;">
            ${escapeHtml(tweetData.savedFolderPath)}
          </div>
        </div>
      ` : ''}

      <hr class="divider">

      <div class="section-label">Tweet Content </div>
      <textarea id="tweetTextEdit" class="tweet-text-edit">${text}</textarea>
  `;

  // Display media if present
  if ((tweetData.images && tweetData.images.length > 0) || tweetData.video || tweetData.hasVideo) {
    html += `<div class="section-label">Media</div>`;
    
    if (tweetData.images && tweetData.images.length > 0) {
      html += `<div class="media-grid">`;
      tweetData.images.forEach((imgUrl) => {
        const escapedUrl = escapeHtml(imgUrl);
        html += `
          <div class="media-item">
            <img src="${escapedUrl}" onerror="this.parentElement.style.display='none'" />
          </div>
        `;
      });
      html += `</div>`;
    }

    if (tweetData.video) {
      console.log('Rendering video preview. URL length:', tweetData.video.length);
      const videoSrc = tweetData.video; 
      const isDirect = tweetData.videoIsDirect;
      const isBlob = !isDirect && videoSrc.startsWith('blob:');
      const isData = videoSrc.startsWith('data:');
      
      html += `
        <div class="video-preview" style="margin-bottom: 16px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: #000; position: relative; max-width: 240px; margin-left: auto; margin-right: auto;">
          <video id="previewVideo" src="${videoSrc}" controls crossorigin="anonymous" style="width: 100%; display: block; max-height: 150px;" poster="${tweetData.images && tweetData.images.length > 0 ? tweetData.images[0] : ''}"></video>
          <div id="videoError" style="display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); color: white; display: flex; align-items: center; justify-content: center; font-size: 10px; padding: 10px; text-align: center; z-index: 10;"></div>
          
          <div class="video-info-box" style="padding: 8px; background: rgba(255,255,255,0.95); border-top: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 10px;">🎥</span>
                <span style="font-size: 10px; font-weight: bold; color: var(--text-main);">Video Source</span>
              </div>
              <span id="videoTypeTag" style="font-size: 8px; color: white; background: ${isDirect ? '#00d4be' : (isData ? '#1d9bf0' : '#f4212e')}; padding: 1px 4px; border-radius: 3px; font-weight: 800;">
                ${isDirect ? 'DIRECT' : (isData ? 'DATA' : 'BLOB')}
              </span>
            </div>
            
            ${isBlob ? `<div style="color: #f4212e; font-size: 9px; margin-bottom: 2px; font-weight: bold;">⚠️ Blob URLs often cannot play here.</div>` : ''}
            
            <div class="path-badge" style="font-size: 8px; padding: 4px; background: #f8f9fa; color: #1d9bf0; border: 1px solid var(--border-color); border-radius: 4px; word-break: break-all; max-height: 35px; overflow-y: auto; font-family: monospace; line-height: 1.1;" title="Click to copy full URL">
              ${escapeHtml(videoSrc)}
            </div>
            
            <div style="margin-top: 6px; display: flex; gap: 4px;">
              <a href="${escapeHtml(videoSrc)}" target="_blank" style="flex: 1; text-decoration: none; font-size: 9px; background: #eee; color: #333; padding: 4px; text-align: center; border-radius: 4px; font-weight: bold; border: 1px solid #ccc;">Open File</a>
              <a href="https://snaptwitt.com/#url=https://x.com/i/status/${postId}" target="_blank" style="flex: 1; text-decoration: none; font-size: 9px; background: #1d9bf0; color: white; padding: 4px; text-align: center; border-radius: 4px; font-weight: bold;">Manual DL</a>
            </div>
          </div>
        </div>
      `;
    }

    if (tweetData.video || tweetData.hasVideo) {
      html += `
        <div class="upload-section">
          <label class="upload-label">Upload Video for Facebook:</label>
          <input type="file" id="localVideoUpload" accept="video/*">
          <video id="localVideoPreview" class="video-preview-local" controls style="${uploadedVideoData ? 'display:block;' : 'display:none;'}"></video>
        </div>
      `;
    }
  }

  html += `
      <div class="button-group">
        <button class="btn-clear" id="clearBtn">Clear</button>
        <button class="btn-facebook" id="postFbBtn">Post to Facebook</button>
      </div>
      <div id="fbStatus" style="display: none;"></div>
      <div id="fbPostInfo" class="fb-post-info" style="display: none;"></div>
    </div>
  `;

  container.innerHTML = html;

  // Edit Text Logic - Save as user types
  const textEdit = document.getElementById('tweetTextEdit');
  if (textEdit) {
    textEdit.addEventListener('input', (e) => {
      const newText = e.target.value;
      chrome.storage.local.get(['lastSubmittedTweet'], (result) => {
        if (result.lastSubmittedTweet) {
          const updated = { ...result.lastSubmittedTweet, text: newText };
          chrome.storage.local.set({ lastSubmittedTweet: updated });
        }
      });
    });
  }

  // Local Video Upload Logic
  const uploadInput = document.getElementById('localVideoUpload');
  const localPreview = document.getElementById('localVideoPreview');
  
  // Restore preview if data exists
  if (uploadedVideoData && localPreview) {
    localPreview.src = uploadedVideoData;
  }

  if (uploadInput) {
    uploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          uploadedVideoData = event.target.result;
          currentPostIdForUpload = tweetData.postId;
          localPreview.src = uploadedVideoData;
          localPreview.style.display = 'block';
          console.log('Local video uploaded and ready for FB post');
          // Save to storage so it survives sidebar close
          chrome.storage.local.set({ 
            uploadedVideoData: uploadedVideoData,
            uploadedVideoPostId: tweetData.postId
          });
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Video error handling
  const videoElement = document.getElementById('previewVideo');
  const errorOverlay = document.getElementById('videoError');
  if (videoElement && errorOverlay) {
    videoElement.onerror = () => {
      errorOverlay.style.display = 'flex';
      errorOverlay.innerText = 'Unable to play this source. Please upload the downloaded video below.';
    };
  }

  // Facebook Button Logic
  document.getElementById('postFbBtn').addEventListener('click', async () => {
    const btn = document.getElementById('postFbBtn');
    const status = document.getElementById('fbStatus');
    
    btn.disabled = true;
    btn.innerText = 'Posting...';
    status.style.display = 'block';
    status.innerText = 'Posting to Facebook...';
    status.style.background = '#f0f2f5';
    status.style.color = '#536471';

    // Use current text from textarea and uploaded video if available
    const currentText = document.getElementById('tweetTextEdit')?.value || tweetData.text;
    const finalVideoUrl = uploadedVideoData || tweetData.video || null;
    const isBlob = uploadedVideoData ? true : (tweetData.videoIsBlob || false);

    chrome.runtime.sendMessage({
      type: 'POST_TO_FACEBOOK',
      payload: {
        message: currentText,
        imageUrls: tweetData.images && tweetData.images.length > 0 ? tweetData.images : [],
        videoUrl: finalVideoUrl,
        videoIsBlob: isBlob
      }
    }, (response) => {
      btn.disabled = false;
      btn.innerText = 'Post to Facebook';
      const postInfoEl = document.getElementById('fbPostInfo');

      if (response && response.success) {
        status.innerText = 'Successfully posted!';
        status.style.background = 'rgba(0, 186, 124, 0.1)';
        status.style.color = '#00d4be';
        setTimeout(() => { status.style.display = 'none'; }, 5000);

        if (postInfoEl) {
          postInfoEl.style.display = 'block';
          let inner = '';
          if (response.feedPost) {
            const fp = response.feedPost;
            const permalink = fp.permalink_url || '';
            // Update main "Post to groups" link field with Facebook post link
            const mainLinkInput = document.getElementById('mainGroupPostLinkInput');
            if (mainLinkInput) mainLinkInput.value = permalink;
            inner += `
              <div class="fb-post-info-inner">
                <div class="fb-post-info-label">Posted on Facebook</div>
                <a href="${escapeHtml(permalink)}" target="_blank" rel="noopener" class="fb-permalink">View post →</a>
              </div>
            `;
          }
          postInfoEl.innerHTML = inner || '<div class="fb-post-info-inner"><div class="fb-post-info-label">Posted</div></div>';
        }
      } else {
        status.innerText = 'Error: ' + (response?.error || 'Unknown error');
        status.style.background = 'rgba(244, 33, 46, 0.1)';
        status.style.color = '#f4212e';
        if (postInfoEl) postInfoEl.style.display = 'none';
      }
    });
  });

  // Clear Button Logic
  document.getElementById('clearBtn').addEventListener('click', () => {
    uploadedVideoData = null; 
    currentPostIdForUpload = null;
    chrome.storage.local.remove(['lastSubmittedTweet', 'uploadedVideoData', 'uploadedVideoPostId'], () => {
      displayTweetData(null);
    });
  });
}

loadInitialState();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.lastSubmittedTweet) {
    const newVal = changes.lastSubmittedTweet.newValue;
    const oldVal = changes.lastSubmittedTweet.oldValue;
    const textEdit = document.getElementById('tweetTextEdit');
    
    // 1. If it's a completely new post (different ID), always re-render
    if (!oldVal || newVal.postId !== oldVal.postId) {
      displayTweetData(newVal);
      return;
    }

    // 2. If it's the same post but the video was just found (background script update)
    if (newVal.video && !oldVal.video) {
      // We need to re-render to show the video, but let's save the cursor position
      const selectionStart = textEdit ? textEdit.selectionStart : null;
      const selectionEnd = textEdit ? textEdit.selectionEnd : null;
      const isFocused = document.activeElement === textEdit;
      
      displayTweetData(newVal);
      
      // Restore focus and cursor if we were editing
      if (isFocused && textEdit) {
        const newTextEdit = document.getElementById('tweetTextEdit');
        if (newTextEdit) {
          newTextEdit.focus();
          newTextEdit.setSelectionRange(selectionStart, selectionEnd);
        }
      }
      return;
    }

    // 3. If only the text changed and we ARE currently typing in the textarea,
    // DO NOT re-render. Re-rendering causes the lose-focus/one-letter-at-a-time bug.
    if (document.activeElement === textEdit) {
      console.log('Skipping re-render because user is typing...');
      return;
    }

    // 4. Otherwise (textarea not focused), update the display
    displayTweetData(newVal);
  }
});

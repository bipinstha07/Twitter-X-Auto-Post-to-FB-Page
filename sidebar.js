// Global state
let uploadedVideoData = null;
let currentPostIdForUpload = null;
let fbCredentialsSet = false;

// Mark sidebar as open and establish heartbeat
chrome.storage.local.set({ sidebarOpen: true });

// Load initial state
function loadInitialState() {
  chrome.storage.local.get(['lastSubmittedTweet', 'uploadedVideoData', 'uploadedVideoPostId', 'fbPageId', 'fbAccessToken'], (result) => {
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
  });
}

// View Management
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  
  // Toggle settings button visibility
  document.getElementById('settingsBtn').style.display = viewId === 'configView' ? 'none' : 'block';
}

// Settings Event Listeners
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

document.getElementById('saveConfigBtn').addEventListener('click', () => {
  const pageId = document.getElementById('fbPageId').value.trim();
  const token = document.getElementById('fbAccessToken').value.trim();

  if (!pageId || !token) {
    alert('Please enter both Page ID and Access Token');
    return;
  }

  chrome.storage.local.set({
    fbPageId: pageId,
    fbAccessToken: token
  }, () => {
    fbCredentialsSet = true;
    alert('Credentials saved successfully!');
    showView('mainView');
  });
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
              <span id="videoTypeTag" style="font-size: 8px; color: white; background: ${isDirect ? '#00ba7c' : (isData ? '#1d9bf0' : '#f4212e')}; padding: 1px 4px; border-radius: 3px; font-weight: 800;">
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
      
      if (response && response.success) {
        status.innerText = 'Successfully posted!';
        status.style.background = 'rgba(0, 186, 124, 0.1)';
        status.style.color = '#00ba7c';
        setTimeout(() => { status.style.display = 'none'; }, 5000);
      } else {
        status.innerText = 'Error: ' + (response?.error || 'Unknown error');
        status.style.background = 'rgba(244, 33, 46, 0.1)';
        status.style.color = '#f4212e';
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

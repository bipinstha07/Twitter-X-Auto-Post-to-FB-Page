// Sidebar script for X post Auto to Fb

// Mark sidebar as open and establish heartbeat
chrome.storage.local.set({ sidebarOpen: true });

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

  container.className = ''; // Remove no-data class
  
  const text = escapeHtml(tweetData.text || '');
  const submittedAt = escapeHtml(tweetData.submittedAt || 'Unknown');
  const postId = tweetData.postId || '';

  let html = `
    <div class="tweet-card">
      <div class="section-label">Post Information</div>
      <div class="meta-info">
        <span><strong>Time:</strong> ${submittedAt}</span>
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

      <div class="section-label">Tweet Content</div>
      <div class="tweet-text">${text}</div>
  `;

  // Display media if present
  if ((tweetData.images && tweetData.images.length > 0) || tweetData.video) {
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
        <div class="video-preview" style="margin-bottom: 16px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); background: #000; position: relative;">
          <video id="previewVideo" src="${videoSrc}" controls crossorigin="anonymous" style="width: 100%; display: block; max-height: 300px;" poster="${tweetData.images && tweetData.images.length > 0 ? tweetData.images[0] : ''}"></video>
          <div id="videoError" style="display: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; padding: 15px; text-align: center; z-index: 10;"></div>
          
          <div class="video-info-box" style="padding: 10px; background: rgba(255,255,255,0.95); border-top: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>🎥</span>
                <span style="font-size: 11px; font-weight: bold; color: var(--text-main);">Video Source</span>
              </div>
              <span id="videoTypeTag" style="font-size: 9px; color: white; background: ${isDirect ? '#00ba7c' : (isData ? '#1d9bf0' : '#f4212e')}; padding: 2px 6px; border-radius: 4px; font-weight: 800;">
                ${isDirect ? 'DIRECT' : (isData ? 'DATA' : 'BLOB')}
              </span>
            </div>
            
            ${isBlob ? `<div style="color: #f4212e; font-size: 10px; margin-bottom: 4px; font-weight: bold;">⚠️ Blob URLs often cannot play here.</div>` : ''}
            
            <div style="font-size: 10px; color: var(--text-gray); margin-bottom: 4px; font-weight: 600;">URL:</div>
            <div class="path-badge" style="font-size: 9px; padding: 6px; background: #f8f9fa; color: #1d9bf0; border: 1px solid var(--border-color); border-radius: 4px; word-break: break-all; max-height: 50px; overflow-y: auto; font-family: monospace; line-height: 1.2;" title="Click to copy full URL">
              ${escapeHtml(videoSrc)}
            </div>
            
            <div style="margin-top: 8px; display: flex; gap: 6px;">
              <a href="${escapeHtml(videoSrc)}" target="_blank" style="flex: 1; text-decoration: none; font-size: 10px; background: #eee; color: #333; padding: 6px; text-align: center; border-radius: 4px; font-weight: bold; border: 1px solid #ccc;">Open File</a>
              <a href="https://snaptwitt.com/#url=https://x.com/i/status/${postId}" target="_blank" style="flex: 1; text-decoration: none; font-size: 10px; background: #1d9bf0; color: white; padding: 6px; text-align: center; border-radius: 4px; font-weight: bold;">Manual DL</a>
            </div>
          </div>
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

  // Video error handling
  const videoElement = document.getElementById('previewVideo');
  const errorOverlay = document.getElementById('videoError');
  if (videoElement && errorOverlay) {
    videoElement.onerror = () => {
      errorOverlay.style.display = 'flex';
      errorOverlay.innerText = 'Unable to play this source. Click "Open URL" or "SnapTwitt" to download manually.';
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

    chrome.runtime.sendMessage({
      type: 'POST_TO_FACEBOOK',
      payload: {
        message: tweetData.text,
        imageUrls: tweetData.images && tweetData.images.length > 0 ? tweetData.images : [],
        videoUrl: tweetData.video || null,
        videoIsBlob: tweetData.videoIsBlob || false
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
    chrome.storage.local.remove('lastSubmittedTweet', () => {
      displayTweetData(null);
    });
  });
}

function loadTweetData() {
  chrome.storage.local.get(['lastSubmittedTweet'], (result) => {
    if (result.lastSubmittedTweet) {
      displayTweetData(result.lastSubmittedTweet);
    } else {
      displayTweetData(null);
    }
  });
}

loadTweetData();

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs?.[0]?.url) {
    const url = tabs[0].url;
    const statusEl = document.getElementById('status');
    if (url.includes('twitter.com') || url.includes('x.com')) {
      statusEl.textContent = 'Active on X.com';
      statusEl.classList.add('active');
    } else {
      statusEl.textContent = 'Navigate to X.com to start';
      statusEl.classList.remove('active');
    }
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.lastSubmittedTweet) {
    displayTweetData(changes.lastSubmittedTweet.newValue);
  }
});

setInterval(loadTweetData, 2000);

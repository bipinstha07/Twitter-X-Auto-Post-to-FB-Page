// Worker script for SnapTwitt.com automation
(async () => {
  console.log('SnapTwitt Worker: Started at', window.location.href);

  // 1. Extract and Clean URL from Hash or Storage
  const getUrlFromHash = () => {
    const hash = window.location.hash;
    console.log('SnapTwitt Worker: Raw Hash:', hash);
    if (!hash || !hash.includes('url=')) return '';
    
    // Split by 'url=' and take everything after
    const parts = hash.split('url=');
    if (parts.length < 2) return '';
    
    let raw = parts[1];
    
    // Decode the URL (handling potential multiple encoding)
    let decoded = raw;
    try {
      // First pass
      decoded = decodeURIComponent(decoded);
      // Second pass (in case of double encoding)
      if (decoded.includes('%3A') || decoded.includes('%2F')) {
        decoded = decodeURIComponent(decoded);
      }
    } catch (e) {
      console.warn('SnapTwitt Worker: Decoding error', e);
    }
    
    // Manual final cleanup for common characters
    return decoded.replace(/%3A/gi, ':').replace(/%2F/gi, '/').replace(/%3F/gi, '?').replace(/%3D/gi, '=');
  };

  let tweetUrl = getUrlFromHash();
  
  if (tweetUrl) {
    sessionStorage.setItem('currentSnapTwittUrl', tweetUrl);
  } else {
    tweetUrl = sessionStorage.getItem('currentSnapTwittUrl') || '';
  }

  if (!tweetUrl) {
    console.log('SnapTwitt Worker: No URL found in hash or storage');
    return;
  }

  console.log('SnapTwitt Worker: Clean URL to use:', tweetUrl);

  // Function to try clicking the download button if we're on the homepage
  const tryInitialDownload = () => {
    // Look for the specific input by name, then fallback to general selectors
    const input = document.querySelector('input[name="url"]') || 
                  document.querySelector('input[type="text"]') || 
                  document.querySelector('.form-control');

    if (input) {
      console.log('SnapTwitt Worker: Input found, current value:', input.value);
      
      // Force the value regardless of what was there
      input.value = tweetUrl;
      
      // Trigger events to make sure the site's JavaScript notices the change
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      
      const downloadBtn = document.querySelector('button[type="submit"]') || 
                          document.querySelector('.btn-download') || 
                          document.querySelector('#submit') ||
                          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download'));
      
      if (downloadBtn) {
        console.log('SnapTwitt Worker: Clicking download button');
        downloadBtn.click();
        return true;
      }
    }
    return false;
  };

  tryInitialDownload();

  // 3. Wait for results or intermediate buttons
  let attempts = 0;
  const maxAttempts = 40; // 40 seconds
  
  const checkResult = setInterval(() => {
    attempts++;
    console.log('SnapTwitt Worker: Checking for results (attempt ' + attempts + ')');
    
    // 1. Look for final download links (.mp4)
    const links = Array.from(document.querySelectorAll('a[href*=".mp4"], a[href*="video"]')).filter(a => !a.href.includes('snaptwitt.com/?source'));
    
    if (links.length > 0) {
      clearInterval(checkResult);
      sessionStorage.removeItem('currentSnapTwittUrl');
      const bestLink = links[0].href;
      console.log('SnapTwitt Worker: Found final video link:', bestLink);
      
      chrome.runtime.sendMessage({
        type: 'SNAPTWITT_RESULT',
        payload: { success: true, videoUrl: bestLink }
      });
      // Fallback: close the tab from here if background fails
      setTimeout(() => {
        console.log('SnapTwitt Worker: Self-closing attempt...');
        window.close();
      }, 6000);
      return;
    }

    // 2. Look for intermediate download buttons (The one with source=twitter)
    const intermediateBtns = Array.from(document.querySelectorAll('a.btn[href*="source=twitter"], a.ff-goh4, a.btn-secondary'))
      .filter(a => a.innerText.toLowerCase().includes('download') || a.href.includes('source=twitter'));

    if (intermediateBtns.length > 0) {
      const btn = intermediateBtns[0];
      console.log('SnapTwitt Worker: Found intermediate button, clicking after short delay...');
      
      clearInterval(checkResult);
      
      // Wait a moment to ensure site is ready
      setTimeout(() => {
        // Remove target="_blank" so the download/navigation happens in THIS tab
        btn.removeAttribute('target');
        console.log('SnapTwitt Worker: Executing click on:', btn.href);
        btn.click();
        
        // Fallback: if click doesn't work, navigate manually
        setTimeout(() => {
          if (window.location.href !== btn.href) {
            window.location.href = btn.href;
          }
        }, 500);
      }, 1000);
      return;
    }

    // 3. Try homepage logic again if we're still on homepage but somehow didn't click
    if (attempts % 5 === 0) {
      tryInitialDownload();
    }

    if (attempts >= maxAttempts) {
      clearInterval(checkResult);
      sessionStorage.removeItem('currentSnapTwittUrl');
      console.error('SnapTwitt Worker: Timeout waiting for results');
      chrome.runtime.sendMessage({
        type: 'SNAPTWITT_RESULT',
        payload: { success: false, error: 'Timeout' }
      });
      setTimeout(() => window.close(), 1000);
    }
    
    // Check for error messages on the page
    const errorMsg = document.querySelector('.alert-danger, .error-message');
    if (errorMsg && errorMsg.offsetParent !== null) {
      clearInterval(checkResult);
      sessionStorage.removeItem('currentSnapTwittUrl');
      console.error('SnapTwitt Worker: Site error:', errorMsg.innerText);
      chrome.runtime.sendMessage({
        type: 'SNAPTWITT_RESULT',
        payload: { success: false, error: errorMsg.innerText }
      });
      setTimeout(() => window.close(), 1000);
    }
  }, 1000);

})();

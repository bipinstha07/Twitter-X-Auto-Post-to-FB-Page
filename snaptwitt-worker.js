// Worker script for SnapTwitt.com automation
(async () => {
  console.log('SnapTwitt Worker: Started at', window.location.href);

  // Check if we have a URL in the hash OR if we're on a results page
  const hash = window.location.hash;
  let tweetUrl = '';
  
  if (hash.startsWith('#url=')) {
    // Decode the URL from the hash (handling potential double encoding)
    let rawUrl = hash.substring(5);
    try {
      tweetUrl = decodeURIComponent(rawUrl);
      // If it still looks encoded (contains %3A for :), decode again
      if (tweetUrl.includes('%3A')) {
        tweetUrl = decodeURIComponent(tweetUrl);
      }
    } catch (e) {
      tweetUrl = rawUrl;
    }
    // Save it to session storage so it persists across navigations on this site
    sessionStorage.setItem('currentSnapTwittUrl', tweetUrl);
  } else {
    tweetUrl = sessionStorage.getItem('currentSnapTwittUrl');
  }

  if (!tweetUrl) {
    console.log('SnapTwitt Worker: No tweet URL found, waiting for hash or storage...');
    return;
  }

  console.log('SnapTwitt Worker: Processing Clean URL:', tweetUrl);

  // Function to try clicking the download button if we're on the homepage
  const tryInitialDownload = () => {
    const input = document.querySelector('input[type="text"]') || document.querySelector('.form-control');
    if (input && !input.value) {
      console.log('SnapTwitt Worker: Filling homepage input');
      input.value = tweetUrl;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      const downloadBtn = document.querySelector('button[type="submit"]') || document.querySelector('.btn-download') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download'));
      if (downloadBtn) {
        console.log('SnapTwitt Worker: Clicking initial download');
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
      return;
    }

    // 2. Look for intermediate download buttons
    const intermediateBtns = Array.from(document.querySelectorAll('a.btn[href*="source=twitter"]'));
    if (intermediateBtns.length > 0) {
      const nextUrl = intermediateBtns[0].href;
      console.log('SnapTwitt Worker: Found intermediate download link, navigating to:', nextUrl);
      clearInterval(checkResult);
      window.location.href = nextUrl; 
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
    }
  }, 1000);

})();

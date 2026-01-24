// Content script to inject submit buttons on Twitter/X posts
// Only active when sidebar is open

let isSidebarOpen = false;
let extensionContextValid = true;

// Check if extension context is still valid
function isExtensionContextValid() {
  try {
    // Try to access chrome.runtime.id - if it throws, context is invalid
    return chrome.runtime && chrome.runtime.id !== undefined;
  } catch (e) {
    return false;
  }
}

// Check if sidebar is open
function checkSidebarStatus() {
  if (!isExtensionContextValid()) {
    extensionContextValid = false;
    console.warn('Extension context invalidated. Please reload the page.');
    return;
  }

  try {
    chrome.storage.local.get(['sidebarOpen'], (result) => {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          extensionContextValid = false;
          console.warn('Extension context invalidated. Please reload the page.');
          return;
        }
        console.error('Error getting storage:', chrome.runtime.lastError);
        return;
      }

      const wasOpen = isSidebarOpen;
      isSidebarOpen = result.sidebarOpen === true;
      
      console.log('Sidebar status check - wasOpen:', wasOpen, 'isOpen:', isSidebarOpen);
      
      // If sidebar was just closed, remove all buttons
      if (!isSidebarOpen) {
        removeAllButtons();
      }
      // If sidebar is open, scan for tweets
      else {
        scanTweets();
      }
    });
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      extensionContextValid = false;
      console.warn('Extension context invalidated. Please reload the page.');
    } else {
      console.error('Error in checkSidebarStatus:', error);
    }
  }
}

// Listen for sidebar status changes
try {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!isExtensionContextValid()) {
      extensionContextValid = false;
      return;
    }
    
    console.log('Storage changed:', areaName, changes);
    
    if (areaName === 'local' && changes.sidebarOpen) {
      console.log('Sidebar state changed:', changes.sidebarOpen);
      // Immediately check and update
      checkSidebarStatus();
    }
  });
} catch (error) {
  console.error('Error setting up storage listener:', error);
}

// Initial check
if (isExtensionContextValid()) {
  checkSidebarStatus();
}

// Periodically check sidebar status (in case storage listener doesn't work)
const statusCheckInterval = setInterval(() => {
  if (!isExtensionContextValid()) {
    clearInterval(statusCheckInterval);
    return;
  }
  checkSidebarStatus();
}, 1000);

function removeAllButtons() {
  // Remove button wrappers (which contain the buttons)
  const wrappers = document.querySelectorAll('.my-submit-btn-wrapper');
  wrappers.forEach(wrapper => wrapper.remove());
  
  // Also remove any standalone buttons (fallback)
  const buttons = document.querySelectorAll('.my-submit-btn');
  buttons.forEach(btn => {
    // Only remove if not inside a wrapper (wrapper removal should handle it)
    if (!btn.closest('.my-submit-btn-wrapper')) {
      btn.remove();
    }
  });
  
  console.log('All submit buttons removed');
}

// Handle extension context invalidation
function handleContextInvalidation() {
  extensionContextValid = false;
  const buttons = document.querySelectorAll('.my-submit-btn');
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.innerText = "Extension Reloaded";
    btn.style.background = "#ef4444";
    btn.style.cursor = "not-allowed";
    btn.title = "Extension was reloaded. Please refresh the page.";
  });
}

function extractTweetData(tweet) {
  let text =
    tweet.querySelector('[data-testid="tweetText"]')?.innerText || "";

  // Extract post/tweet ID and Username from links or data attributes
  let postId = null;
  let username = null;
  
  // Try to find post ID and username from status links (format: /username/status/1234567890)
  const statusLinks = tweet.querySelectorAll('a[href*="/status/"]');
  for (const link of statusLinks) {
    const href = link.getAttribute('href');
    if (href) {
      const match = href.match(/\/([^\/]+)\/status\/(\d+)/);
      if (match) {
        if (!username) username = match[1];
        if (!postId) postId = match[2];
        if (username && postId) break;
      }
    }
  }
  
  // If username not found in links, try to get from data-testid="User-Name"
  if (!username) {
    const userNameElement = tweet.querySelector('[data-testid="User-Name"]');
    if (userNameElement) {
      // Look for the span that starts with @
      const spans = userNameElement.querySelectorAll('span');
      for (const span of spans) {
        if (span.innerText && span.innerText.startsWith('@')) {
          username = span.innerText.substring(1);
          break;
        }
      }
      
      // Fallback: Find the link inside that contains the username
      if (!username) {
        const links = userNameElement.querySelectorAll('a');
        for (const link of links) {
          const href = link.getAttribute('href');
          if (href && !href.includes('/status/') && href !== '/') {
            username = href.replace('/', '');
            break;
          }
        }
      }
    }
  }

  // Append credit if username found
  if (username) {
    text += `\n\nCredit from X.com: @${username}`;
  }

  // If not found in links, try to get from tweet article's data attributes
  if (!postId) {
    // Check for data-tweet-id or similar attributes
    for (const attr of tweet.attributes) {
      if (attr.name.includes('tweet') && attr.name.includes('id') && attr.value) {
        postId = attr.value;
        break;
      }
    }
  }
  
  // Last resort: try to extract from any URL in the tweet
  if (!postId) {
    const allLinks = tweet.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const href = link.getAttribute('href');
      if (href && href.includes('/status/')) {
        const match = href.match(/\/status\/(\d+)/);
        if (match && match[1]) {
          postId = match[1];
          break;
        }
      }
    }
  }

  // Get images from tweet - only actual tweet media, not emojis or profile images
  const images = Array.from(
    tweet.querySelectorAll('img[src*="twimg"]')
  )
    .map(img => img.src)
    .filter(src => {
      if (!src) return false;
      // Exclude profile images
      if (src.includes('profile_images')) return false;
      // Exclude emoji SVGs
      if (src.includes('/emoji/v2/svg/')) return false;
      // Exclude emoji PNGs
      if (src.includes('/emoji/')) return false;
      // Only include actual media images (usually from pbs.twimg.com/media/)
      // or verified media URLs
      return src.includes('/media/') || src.includes('pbs.twimg.com');
    });

  // Get video element and extract video URL (including blob URLs which we'll handle later)
  let video = null;
  
  // 1. Look for all video elements in the tweet
  const videoElements = tweet.querySelectorAll("video");
  console.log(`Found ${videoElements.length} video elements in tweet`);
  
  for (const videoElement of videoElements) {
    const src = videoElement.src;
    const firstSource = videoElement.querySelector("source")?.src;
    const foundSrc = src || firstSource;
    
    if (foundSrc && foundSrc !== '') {
      video = foundSrc;
      console.log('Detected video source:', video);
      break;
    }
  }
  
  // 2. Fallback: Look for data-testid="videoComponent" or "videoPlayer"
  if (!video) {
    const videoContainers = tweet.querySelectorAll('[data-testid="videoComponent"], [data-testid="videoPlayer"], [data-testid="tweetPhoto"]');
    for (const container of videoContainers) {
      // Look for video tag inside
      const internalVideo = container.querySelector('video');
      if (internalVideo && (internalVideo.src || internalVideo.querySelector('source')?.src)) {
        video = internalVideo.src || internalVideo.querySelector('source')?.src;
        console.log('Detected video from container inner video:', video);
        break;
      }
      
      // Look for attributes that might contain the source
      for (const attr of container.attributes) {
        if (attr.value && (attr.value.includes('video.twimg.com') || attr.value.includes('blob:https://x.com') || attr.value.includes('.mp4'))) {
          video = attr.value;
          console.log('Detected video from container attribute:', attr.name, video);
          break;
        }
      }
      if (video) break;
    }
  }
  
  // 3. Last Resort: Look for any element with a video-like source in a data attribute
  if (!video) {
    const allElements = tweet.querySelectorAll('*');
    for (const el of allElements) {
      for (const attr of el.attributes) {
        if (attr.value && attr.value.startsWith('blob:https://x.com')) {
          video = attr.value;
          console.log('Detected video from deep scan:', attr.name, video);
          break;
        }
      }
      if (video) break;
    }
  }

  return { text, images, video, postId, username };
}

function injectButton(tweet) {
  // Check if button already exists (check both in tweet and in wrapper)
  if (tweet.querySelector(".my-submit-btn") || tweet.querySelector(".my-submit-btn-wrapper")) {
    return;
  }

  const btn = document.createElement("button");
  btn.innerText = "Preview";
  btn.className = "my-submit-btn";
  btn.style.cssText = `
    margin-top: 6px;
    padding: 6px 12px;
    background: #1d9bf0;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: background 0.2s;
  `;

  // Hover effect
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#1a8cd8";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#1d9bf0";
  });

  btn.onclick = async (e) => {
    e.stopPropagation();
    
    // Check if extension context is valid
    if (!isExtensionContextValid()) {
      btn.innerText = "Extension Reloaded - Refresh Page";
      btn.style.background = "#ef4444";
      alert('Extension context invalidated. Please reload the page to continue using the extension.');
      return;
    }

    btn.disabled = true;
    btn.innerText = "Previewing...";
    btn.style.opacity = "0.6";
    btn.style.cursor = "not-allowed";

    try {
      let data = extractTweetData(tweet);
      const hasVideo = !!data.video;
      console.log("Extracted tweet data:", data, "Has video:", hasVideo);
      
      // 1. IMMEDIATELY send text/images to sidebar
      chrome.runtime.sendMessage(
        {
          type: "SUBMIT_TWEET",
          payload: { ...data, video: null, hasVideo: hasVideo } // Send without video URL initially but flag it has a video
        },
        (response) => {
          console.log("Immediate text preview response:", response);
          if (response && response.success) {
            btn.innerText = hasVideo ? "Extracting Video..." : "Previewed ✓";
            if (hasVideo) {
              btn.style.background = "#fbbf24"; // Orange for extraction
            } else {
              btn.style.background = "#10b981";
              btn.style.opacity = "1";
              setTimeout(() => {
                btn.innerText = "Preview";
                btn.style.background = "#1d9bf0";
                btn.disabled = false;
              }, 2000);
            }
          }
        }
      );

      // 2. If there's a video, start background extraction without blocking
      if (hasVideo && data.postId) {
        const tweetUrl = `https://x.com/i/status/${data.postId}`;
        console.log("Starting SnapTwitt automation for:", tweetUrl);
        
        chrome.runtime.sendMessage({
          type: "FETCH_SNAPTWITT_VIDEO",
          payload: { url: tweetUrl, updateExisting: true, tweetData: { ...data, hasVideo: true } }
        }, (response) => {
          if (response && response.success) {
            btn.innerText = "Previewed ✓";
            btn.style.background = "#10b981";
            btn.style.opacity = "1";
            setTimeout(() => {
              btn.innerText = "Preview";
              btn.style.background = "#1d9bf0";
              btn.disabled = false;
            }, 2000);
          } else {
            btn.innerText = "Video Failed";
            btn.style.background = "#ef4444";
            setTimeout(() => {
              btn.innerText = "Preview";
              btn.style.background = "#1d9bf0";
              btn.disabled = false;
            }, 2000);
          }
        });
      }
    } catch (error) {
      console.error("Error extracting tweet data:", error);
      btn.innerText = "Error";
      btn.style.background = "#ef4444";
      btn.disabled = false;
    }
  };

  // Find a good place to inject the button
  // Try to find the action buttons group first (best location)
  const tweetActions = tweet.querySelector('[role="group"]');
  const tweetText = tweet.querySelector('[data-testid="tweetText"]');
  
  if (tweetActions) {
    // Insert button right before the action buttons group
    const actionsContainer = tweetActions.parentElement;
    if (actionsContainer) {
      // Create a wrapper div for our button
      const buttonWrapper = document.createElement('div');
      buttonWrapper.className = 'my-submit-btn-wrapper';
      buttonWrapper.style.cssText = 'margin: 8px 0; padding: 0 16px;';
      buttonWrapper.appendChild(btn);
      actionsContainer.insertBefore(buttonWrapper, tweetActions);
      console.log('Button injected before action buttons');
    } else {
      // Fallback: append to actions group
      tweetActions.parentElement?.insertBefore(btn, tweetActions);
    }
  } else if (tweetText) {
    // Insert after the tweet text container
    const textContainer = tweetText.parentElement;
    if (textContainer) {
      const buttonWrapper = document.createElement('div');
      buttonWrapper.className = 'my-submit-btn-wrapper';
      buttonWrapper.style.cssText = 'margin: 8px 0; padding: 0 16px;';
      buttonWrapper.appendChild(btn);
      textContainer.appendChild(buttonWrapper);
      console.log('Button injected after tweet text');
    } else {
      tweet.appendChild(btn);
    }
  } else {
    // Last resort: append to tweet
    console.log('Button injected at end of tweet (fallback)');
    tweet.appendChild(btn);
  }
}

function scanTweets() {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    handleContextInvalidation();
    return;
  }
  
  // Only scan if sidebar is open
  if (!isSidebarOpen) {
    console.log('Sidebar is closed, skipping scan');
    return;
  }
  
  console.log('Scanning for tweets...');
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  console.log(`Found ${tweets.length} tweets`);
  
  tweets.forEach((tweet, index) => {
    try {
      injectButton(tweet);
    } catch (error) {
      console.error(`Error injecting button in tweet ${index}:`, error);
    }
  });
  
  console.log('Tweet scan complete');
}

// Twitter/X is a SPA → observe DOM changes
const observer = new MutationObserver(() => {
  if (!isExtensionContextValid()) {
    return;
  }
  if (isSidebarOpen) {
    scanTweets();
  }
});

// Start observing
observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});

// Initial scan (only if sidebar is open)
if (isSidebarOpen) {
  scanTweets();
}

// Also scan when page navigation happens (Twitter uses client-side routing)
let lastUrl = location.href;
new MutationObserver(() => {
  if (!isExtensionContextValid()) {
    return;
  }
  const url = location.href;
  if (url !== lastUrl && isSidebarOpen) {
    lastUrl = url;
    setTimeout(scanTweets, 1000); // Delay to let new content load
  }
}).observe(document, { subtree: true, childList: true });

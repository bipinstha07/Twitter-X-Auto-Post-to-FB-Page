// Background service worker to store tweet data, save files and handle Facebook posting

// Helper functions for downloading files
function downloadFile(url, folderPath, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: url,
      filename: `${folderPath}/${filename}`,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        chrome.downloads.search({ id: downloadId }, (items) => {
          if (items && items[0]) {
            resolve({ id: downloadId, path: items[0].filename, filename: filename });
          } else {
            resolve({ id: downloadId, filename: filename });
          }
        });
      }
    });
  });
}

async function saveTweetFiles(tweetData) {
  try {
    if (!tweetData.video) {
      console.log('No video to download, skipping save.');
      return { success: false, reason: 'no_video' };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folderName = `Tweet_${timestamp}`;
    const baseFolder = `X_Posts/${folderName}`;
    
    console.log(`Downloading video to: ${baseFolder}`);
    
    const ext = tweetData.video.includes('.mp4') ? 'mp4' : 'mov';
    const videoInfo = await downloadFile(tweetData.video, baseFolder, `video.${ext}`);
    
    console.log('Video download started:', videoInfo);
    
    return { success: true, folderPath: baseFolder };
  } catch (error) {
    console.error('Error saving video file:', error);
    return { success: false, error: error.message };
  }
}

// Facebook API Configuration
const FB_GRAPH_API_URL = "https://graph.facebook.com/v19.0/";

// Helper to get FB credentials from storage
async function getFBCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['fbPageId', 'fbAccessToken'], (result) => {
      resolve({
        pageId: result.fbPageId,
        accessToken: result.fbAccessToken
      });
    });
  });
}

// Post to Facebook logic
async function postToFacebook(message, imageUrls, videoUrl, videoIsBlob) {
  console.log("SENDING TO FACEBOOK >>>", { message, imageUrls, videoUrl, videoIsBlob });

  const { pageId, accessToken } = await getFBCredentials();
  
  if (!pageId || !accessToken) {
    throw new Error("Facebook Page ID or Access Token is missing. Please set them in settings.");
  }

  try {
    // Case 1: Video post (Prioritize video if exists)
    if (videoUrl) {
      console.log("Posting video to Facebook...");
      const url = `${FB_GRAPH_API_URL}${pageId}/videos`;
      const formData = new FormData();
      formData.append("description", message);
      formData.append("access_token", accessToken);

      if (videoIsBlob && videoUrl.startsWith('data:')) {
        // Convert base64 data URL to Blob
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        // IMPORTANT: Specify a filename like 'video.mp4' so Facebook knows the format
        formData.append("source", blob, "video.mp4");
      } else {
        formData.append("file_url", videoUrl);
      }

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Facebook Video API Error:", data);
        throw new Error(data.error?.message || "Failed to post video to Facebook");
      }

      console.log("Facebook Video Post Successful:", data);
      return { success: true, data };
    }

    // Case 2: Images or Text-only post
    if (!imageUrls || imageUrls.length === 0) {
      // Case 1: Text-only post
      const url = `${FB_GRAPH_API_URL}${pageId}/feed`;
      const formData = new URLSearchParams();
      formData.append("message", message);
      formData.append("access_token", accessToken);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Failed to post text to Facebook");
      return { success: true, data };
    } 
    
    if (imageUrls.length === 1) {
      // Case 2: Single photo post
      const url = `${FB_GRAPH_API_URL}${pageId}/photos`;
      const formData = new URLSearchParams();
      formData.append("message", message);
      formData.append("url", imageUrls[0]);
      formData.append("access_token", accessToken);
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Failed to post photo to Facebook");
      return { success: true, data };
    }

    // Case 3: Multiple photos post
    console.log(`Uploading ${imageUrls.length} photos to Facebook...`);
    
    // 1. Upload each photo individually as 'unpublished'
    const uploadPromises = imageUrls.map(async (url, index) => {
      const uploadUrl = `${FB_GRAPH_API_URL}${pageId}/photos`;
      const formData = new URLSearchParams();
      formData.append("url", url);
      formData.append("published", "false"); // Don't publish yet
      formData.append("access_token", accessToken);
      
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      
      const data = await response.json();
      if (!response.ok) {
        console.error(`Error uploading photo ${index + 1}:`, data);
        throw new Error(data.error?.message || `Failed to upload photo ${index + 1}`);
      }
      return data.id;
    });

    const photoIds = await Promise.all(uploadPromises);
    console.log("All photos uploaded, photo IDs:", photoIds);

    // 2. Create a feed post attaching all uploaded photos
    const postUrl = `${FB_GRAPH_API_URL}${pageId}/feed`;
    const postData = new URLSearchParams();
    postData.append("message", message);
    postData.append("access_token", accessToken);
    
    // attached_media must be a JSON array of objects: [{"media_fbid":"id1"}, {"media_fbid":"id2"}]
    const attachedMedia = photoIds.map(id => ({ media_fbid: id }));
    postData.append("attached_media", JSON.stringify(attachedMedia));

    const finalResponse = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postData.toString(),
    });

    const finalData = await finalResponse.json();
    if (!finalResponse.ok) {
      console.error("Error creating multi-photo post:", finalData);
      throw new Error(finalData.error?.message || "Failed to create multi-photo post on Facebook");
    }

    console.log("Multi-photo Facebook Post Successful:", finalData);
    return { success: true, data: finalData };
    
  } catch (error) {
    console.error("Error in postToFacebook:", error);
    return { success: false, error: error.message };
  }
}

// Track active snaptwitt requests
let pendingSnapTwittRequest = null;

// Listen for sidebar connection/disconnection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidebar") {
    console.log("Sidebar connected");
    chrome.storage.local.set({ sidebarOpen: true });
    
    port.onDisconnect.addListener(() => {
      console.log("Sidebar disconnected (closed)");
      chrome.storage.local.set({ sidebarOpen: false });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle result from SnapTwitt worker
  if (message.type === "SNAPTWITT_RESULT") {
    console.log("Received SnapTwitt result:", message.payload);
    if (pendingSnapTwittRequest) {
      pendingSnapTwittRequest.resolve(message.payload);
      pendingSnapTwittRequest = null;
    }
    // Close the worker tab
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id);
    }
    return;
  }

  if (message.type === "FETCH_SNAPTWITT_VIDEO") {
    const tweetUrl = message.payload.url;
    const shouldUpdate = message.payload.updateExisting;
    const initialData = message.payload.tweetData;
    
    console.log("Fetching SnapTwitt video for:", tweetUrl, "shouldUpdate:", shouldUpdate);

    (async () => {
      try {
        if (pendingSnapTwittRequest) {
          pendingSnapTwittRequest.reject(new Error("New request started"));
        }

        const tab = await chrome.tabs.create({
          url: `https://snaptwitt.com/#url=${encodeURIComponent(tweetUrl)}`,
          active: false,
          pinned: true
        });

        const result = await new Promise((resolve, reject) => {
          pendingSnapTwittRequest = { resolve, reject };
          setTimeout(() => {
            if (pendingSnapTwittRequest) {
              chrome.tabs.remove(tab.id);
              reject(new Error("Timeout waiting for SnapTwitt"));
              pendingSnapTwittRequest = null;
            }
          }, 45000);
        });

        if (result && result.success && result.videoUrl && shouldUpdate) {
          console.log("SnapTwitt Success, checking if current tweet matches...");
          
          // Get current stored tweet
          chrome.storage.local.get(['lastSubmittedTweet'], async (store) => {
            const currentTweet = store.lastSubmittedTweet;
            
            // ONLY update if the postId matches the one we started extracting for
            if (currentTweet && currentTweet.postId === initialData.postId) {
              console.log("Post ID matches, updating stored tweet with video...");
              
              // Download the video
              const videoDataForDownload = { ...initialData, video: result.videoUrl };
              const saveResult = await saveTweetFiles(videoDataForDownload);
              
              const updatedTweet = {
                ...currentTweet,
                video: result.videoUrl,
                videoIsDirect: true,
                hasVideo: true, // Ensure this is set
                savedFolderPath: saveResult.success ? saveResult.folderPath : (currentTweet.savedFolderPath || null)
              };
              chrome.storage.local.set({ lastSubmittedTweet: updatedTweet });
            } else {
              console.log("Post ID mismatch or tweet changed, skipping storage update for video link.");
              // Still download the video though, since the user clicked preview on it earlier
              const videoDataForDownload = { ...initialData, video: result.videoUrl };
              await saveTweetFiles(videoDataForDownload);
            }
          });
        }

        sendResponse(result);
      } catch (error) {
        console.error("Error in SnapTwitt flow:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; 
  }

  if (message.type === "POST_TO_FACEBOOK") {
    postToFacebook(
      message.payload.message, 
      message.payload.imageUrls, 
      message.payload.videoUrl,
      message.payload.videoIsBlob
    )
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (message.type === "SUBMIT_TWEET") {
    (async () => {
      try {
        // Store the tweet data with timestamp
        const tweetData = {
          ...message.payload,
          timestamp: new Date().toISOString(),
          submittedAt: new Date().toLocaleString()
        };
        
        // Save files to local machine
        const saveResult = await saveTweetFiles(tweetData);
        if (saveResult.success) {
          tweetData.savedFolderPath = saveResult.folderPath;
        }
        
        // Store in chrome.storage for sidebar to display
        chrome.storage.local.set({ lastSubmittedTweet: tweetData }, () => {
          console.log("Tweet data stored and files downloaded:", tweetData);
          
          sendResponse({ 
            success: true, 
            data: tweetData,
            downloaded: saveResult.success
          });
        });
      } catch (error) {
        console.error("Error processing tweet:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

// Open sidebar when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  try {
    // Check if sidePanel API is available
    if (chrome.sidePanel && chrome.sidePanel.open) {
      // Check if we're on Twitter/X
      if (tab.url && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
        chrome.sidePanel.open({ windowId: tab.windowId })
          .then(() => {
            // Mark sidebar as open
            chrome.storage.local.set({ sidebarOpen: true });
          })
          .catch((err) => {
            console.error('Error opening sidePanel:', err);
          });
      } else {
        // If not on Twitter/X, navigate to X.com first
        chrome.tabs.update(tab.id, { url: 'https://x.com' }, () => {
          // Wait a bit for the page to load, then open sidebar
          setTimeout(() => {
            chrome.sidePanel.open({ windowId: tab.windowId })
              .then(() => {
                chrome.storage.local.set({ sidebarOpen: true });
              })
              .catch((err) => {
                // Ignore errors related to user closing panel early
              });
          }, 1000);
        });
      }
    } else {
      console.error('SidePanel API is not available. Make sure you are using a compatible browser version.');
    }
  } catch (error) {
    console.error('Error in action.onClicked:', error);
  }
});

// Optional: Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("X post Auto to Fb extension installed");
    // Set default sidebar state
    chrome.storage.local.set({ sidebarOpen: false });
  }
});

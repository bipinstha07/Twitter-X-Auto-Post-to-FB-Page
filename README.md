# X post Auto to Fb - Chrome Extension

A Chrome extension that adds a "Preview" button to each tweet on Twitter/X, allowing you to collect post data (text and images) and post them to Facebook.

## Features

- ✅ Automatically injects a "Preview" button on every tweet visible on the page (skips posts with videos)
- ✅ Extracts tweet text and images
- ✅ Saves data locally in organized folders
- ✅ Works with Twitter's dynamic content loading (SPA)
- ✅ Modern, minimal sidebar UI
- ✅ Post directly to Facebook from the sidebar
- ✅ Optional credit attribution (@username) — enable in Settings if desired

## Installation

### Load as Unpacked Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select this project folder (`Client-X-Post`)
5. The extension should now be installed!

## Usage

1. Visit Twitter/X in your browser
2. Click the extension icon to open the sidebar
3. You'll see a blue "Preview" button on each tweet (if it doesn't have a video)
4. Click the button to collect the tweet data
5. The button will show:
   - "Previewing..." while processing
   - "Previewed ✓" on success (green)
   - "Failed" or "Error" on failure (red)
6. View the collected data in the sidebar and click "Post to Facebook" to share it.

## API Endpoint Format

Your API endpoint should accept POST requests with the following JSON format:

```json
{
  "text": "Tweet text content...",
  "images": ["https://pbs.twimg.com/...", "https://pbs.twimg.com/..."],
  "video": "https://video.twimg.com/..." // or null if no video
}
```

## Project Structure

```
Client-X-Post/
├── manifest.json       # Extension manifest
├── content.js          # Content script (injects buttons)
├── background.js       # Service worker (handles API calls)
├── popup.html          # Extension popup UI
└── ...
```

## Development

The extension files are standalone JavaScript files that don't require building. However, if you want to modify the React app (for other purposes), you can use:

```bash
npm run dev    # Start development server
npm run build  # Build for production
```

## Notes

- The extension works on both `twitter.com` and `x.com`
- It automatically detects new tweets as you scroll (Twitter is a Single Page Application)
- The extension requires permissions to access Twitter/X pages and make API calls
- Make sure your API endpoint has CORS enabled to accept requests from the extension

## Troubleshooting

- **Buttons not appearing**: Make sure you're on `twitter.com` or `x.com` and refresh the page
- **API calls failing**: Check the browser console (F12) and verify your API endpoint is correct
- **Extension not loading**: Make sure all files are in the correct location and manifest.json is valid
# Twitter-X-Auto-Post-to-FB-Page

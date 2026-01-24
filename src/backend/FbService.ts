/**
 * Service to handle posting to Facebook Graph API
 */

const PAGE_ID = "105196998627367";
const PAGE_ACCESS_TOKEN = "EAAYtNE3ZCDekBQl9ZCkQFsV59JEZCu9ZAoCTxQ3CxySZCpZCUQpldeagbKGznM3YKPm3jzU6NT9RCwXDbPQHpJD4sD6aFhs3kujYpgnupAlEvte24v7kHzT9ZCKKJlGYjHSJbZBwQKMrISqmqhjYKHIAtpn6SANZBpVmo6oRGG935GK5SHUDieZCazZBlC90UzZBd7D5UUitR1nqDHnbKKIWb2d6q0IZD";
const GRAPH_API_URL = "https://graph.facebook.com/v19.0/";

export interface PostResponse {
  id: string;
  post_id?: string;
  success?: boolean;
}

export class FbService {
  /**
   * Posts text and optionally an image to a Facebook page
   * @param message The text content to post
   * @param imageUrl Optional URL of the image to post
   * @returns Promise with the Facebook API response
   */
  static async postToFacebook(message: string, imageUrl?: string): Promise<PostResponse> {
    console.log("SENDING TO FACEBOOK >>>", { message, imageUrl });

    // Determine the endpoint based on whether an image is provided
    // If imageUrl exists, we use /photos endpoint which accepts both message and url
    // If not, we use /feed endpoint for text only
    const endpoint = imageUrl ? `${PAGE_ID}/photos` : `${PAGE_ID}/feed`;
    const url = `${GRAPH_API_URL}${endpoint}`;

    const formData = new URLSearchParams();
    formData.append("message", message);
    formData.append("access_token", PAGE_ACCESS_TOKEN);
    
    if (imageUrl) {
      formData.append("url", imageUrl);
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Facebook API Error:", data);
        throw new Error(data.error?.message || "Failed to post to Facebook");
      }

      console.log("Facebook Post Successful:", data);
      return data as PostResponse;
    } catch (error) {
      console.error("Error in postToFacebook:", error);
      throw error;
    }
  }

  /**
   * Example method that mimics the Java logic including an AI step
   * @param rawMessage The original message to be processed by AI
   * @param imageUrl Optional image URL
   */
  static async postProcessedTextToPage(rawMessage: string, imageUrl?: string): Promise<PostResponse> {
    // Placeholder for AI generation logic
    // In your Java code: String output = ai.generateText(message);
    const processedText = await this.mockAiGenerateText(rawMessage);
    
    return this.postToFacebook(processedText, imageUrl);
  }

  /**
   * Mock AI generation (Replace with actual AI call if needed)
   */
  private static async mockAiGenerateText(text: string): Promise<string> {
    console.log("Processing text with AI...");
    // Just returning original text for now as a placeholder
    return text;
  }
}

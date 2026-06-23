export async function generateWithGemini(prompt, config, timeoutMs) {
  const apiKey = config.apiKey;
  const model = config.model || "gemini-2.5-flash";

  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please add it in settings.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = "";
      try {
        const errData = await response.json();
        errorBody = errData?.error?.message || JSON.stringify(errData);
      } catch (e) {
        // ignore parse error
      }
      
      if (response.status === 400) {
        throw new Error(`Gemini API error (400): ${errorBody || 'Check if model name is correct.'}`);
      }
      if (response.status === 403) {
        throw new Error(`Gemini API error (403): ${errorBody || 'Key invalid or lacks permissions.'}`);
      }
      if (response.status === 429) {
        throw new Error(`Gemini quota exceeded (429): ${errorBody}`);
      }
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}. ${errorBody}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Received malformed response from Gemini.");
    }

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Gemini generation timed out after ${timeoutMs / 1000}s.`);
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(`Network error: Cannot reach Gemini API.`);
    }
    throw error;
  }
}

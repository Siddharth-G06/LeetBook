export async function generateWithOllama(prompt, config, timeoutMs) {
  const endpoint = (config.endpoint || "http://localhost:11434").replace(/\/$/, '') + "/api/generate";
  const modelName = config.model || "llama3.1";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 403) {
      throw new Error(
        `Ollama blocked the request (403 Forbidden). ` +
        `Restart Ollama with CORS enabled:\n\n` +
        `Mac/Linux: OLLAMA_ORIGINS="*" ollama serve\n` +
        `Windows PowerShell: $env:OLLAMA_ORIGINS="*"; ollama serve`
      );
    }
    
    if (response.status === 404) {
      throw new Error(`Ollama model '${modelName}' not found. Please run: "ollama pull ${modelName}"`);
    }

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
    
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Ollama generation timed out after ${timeoutMs / 1000}s. The model may still be loading — try again.`);
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error(`Cannot connect to Ollama. Make sure it's running: "ollama serve" at ${config.endpoint || "http://localhost:11434"}`);
    }
    throw error;
  }
}

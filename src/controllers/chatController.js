import { ChatModel } from '../models/chatModel';

/**
 * ChatController
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the flow of AI requests. 
 * Orchestrates models and handles parsing of structured data.
 */
export class ChatController {
    // Futuristic models available for this API project
    static MODELS = [
        'gemini-1.5-flash',        // Most reliable stable
        'gemini-flash-latest',     // Auto-updating latest flash
        'gemini-2.0-flash',        // High performance flash
        'gemini-1.5-pro',          // Pro stable
        'gemini-2.0-flash-lite-preview-02-05', // Latest lite
        'gemini-pro-latest'        // Pro alias
    ];






    /**
     * Centralized execution logic with fallback capability
     */
    static async executeAIRequest(userMessage, systemPrompt, fileData = null) {
        const apiKey = process.env.GEMINI_API_KEY;
        const chatModel = new ChatModel(apiKey);
        let lastError = null;

        for (const modelId of ChatController.MODELS) {
            console.log(`[MediAI] Attempting ${modelId}...`);
            const result = await chatModel.generate(modelId, systemPrompt, userMessage, fileData);

            if (result.success) {
                try {
                    return ChatController.extractJSON(result.text);
                } catch (jsonError) {
                    console.warn(`[MediAI] ${modelId} returned invalid JSON. Trying next model...`);
                    lastError = { success: false, error: jsonError.message, isQuotaError: false };
                    continue;
                }
            }


            lastError = result;
            
            if (result.isQuotaError) {
                console.warn(`[MediAI] Quota hit on ${modelId}. Trying next available model...`);
            } else if (result.error && result.error.includes('404')) {
                // Silently skip 404s in production but log for dev
                console.log(`[MediAI] ${modelId} not available (404).`);
            } else {
                console.warn(`[MediAI] ${modelId} failed: ${result.error}. Trying next...`);
            }
        }


        // If all models failed
        if (lastError && lastError.isQuotaError) {
            throw new Error('QUOTA_EXCEEDED');
        }


        // Handle errors gracefully for the frontend
        if (lastError && lastError.isQuotaError) {
            throw new Error('QUOTA_EXCEEDED');
        }
        
        throw new Error(lastError?.error || 'AI_SERVICE_ERROR');
    }

    /**
     * Helper for doctor assistance requests
     */
    static async handleDoctorAssist(userMessage, systemPrompt) {
        return await ChatController.executeAIRequest(userMessage, systemPrompt);
    }


    /**
     * Extracts and validates JSON from AI text response.
     */
    static extractJSON(text) {
        try {
            // Remove markdown formatting if present
            const cleanText = text.replace(/```json|```/g, '').trim();
            const jsonStart = cleanText.indexOf('{');
            const jsonEnd = cleanText.lastIndexOf('}');
            
            if (jsonStart === -1 || jsonEnd === -1) {
                throw new Error('No JSON structure found');
            }

            const jsonStr = cleanText.substring(jsonStart, jsonEnd + 1);
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('[ChatController] Parsing Error:', e.message, 'Raw Text:', text);
            throw new Error('AI returned an invalid data format.');
        }
    }
}

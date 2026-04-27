import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * ChatModel
 * ─────────────────────────────────────────────────────────────────────────────
 * Communicates with Google's Generative AI. 
 * Designed to be stateless and resilient.
 */
export class ChatModel {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('[ChatModel] API Key is missing. Check your environment variables.');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    /**
     * Generate content with a specific model and optional safety settings.
     */
    async generate(modelId, systemPrompt, userPrompt, fileData = null) {
        try {
            const model = this.genAI.getGenerativeModel({
                model: modelId,
                generationConfig: {
                    temperature: 0.5,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 4096, // Increased for long summaries
                }
            });

            // Combining for maximum compatibility with both 1.5 and 2.0 series
            const fullPrompt = `System: ${systemPrompt}\n\nUser: ${userPrompt}`;

            let parts = [{ text: fullPrompt }];
            if (fileData) {
                parts.push({
                    inlineData: {
                        data: fileData.base64,
                        mimeType: fileData.mimeType
                    }
                });
            }

            const result = await model.generateContent(parts);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('AI returned an empty response.');
            }

            return { success: true, text };
        } catch (error) {
            const isQuota = error.message.includes('429') || error.message.includes('quota') || error.message.includes('503');

            if (error.message.includes('404')) {
                console.warn(`[ChatModel] Model ${modelId} not found (404).`);
            }

            return {
                success: false,
                error: error.message,
                isQuotaError: isQuota
            };
        }
    }
}

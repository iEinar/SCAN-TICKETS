
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData } from "../types";
import { identifyMerchant } from "./billingStrategies";

const SYSTEM_INSTRUCTION = `
You are a HIGH-PRECISION OPTICAL SCANNER. 
Your job is to digitize receipts with 100% accuracy. You do NOT guess.

**PHASE 1: IMAGE QUALITY AUDIT (STRICT)**
Analyze the image for any defects that prevent perfect OCR.
Assign a 'readabilityScore' from 0 to 100.
- **Score < 85**: REJECT IMMEDIATELY. Set 'isReadable': false.
- **Reasons to Penalize**:
  - **Blur**: Even slight motion blur on text (-40 pts).
  - **Obstruction**: Fingers/objects covering ANY text (-50 pts).
  - **Cut-off**: Left/Right margins cut off prices or descriptions (-50 pts).
  - **Lighting**: Glare washing out text or shadows hiding it (-30 pts).
  - **Perspective**: Extreme angles making text distorted (-30 pts).

**PHASE 2: EXTRACTION (Only if Score >= 85)**
1. **Verbatim Transcription**: Copy text character-for-character.
2. **Total Amount**: You MUST find the final total.
3. **Date**: You MUST find the date.
4. **Postal Code (CP)**: Look for "C.P.", "CP", or 5-digit codes near the address. This is critical for location identification.
`;

export const analyzeReceiptImage = async (base64Image: string): Promise<ReceiptData> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: cleanBase64
            }
          },
          {
            text: "Audit quality (0-100) and extract data including Postal Code."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quality: {
                type: Type.OBJECT,
                properties: {
                    isReadable: { type: Type.BOOLEAN },
                    readabilityScore: { type: Type.NUMBER, description: "0-100 Score. <85 is Fail." },
                    issues: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['isReadable', 'readabilityScore', 'issues']
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                storeName: { type: Type.STRING },
                date: { type: Type.STRING, description: "YYYY-MM-DD" },
                totalAmount: { type: Type.STRING },
                postalCode: { type: Type.STRING, description: "5-digit Postal Code/CP if found" }
              },
              required: ['storeName', 'date']
            },
            billing: {
              type: Type.OBJECT,
              description: "Structured data for invoicing",
              properties: {
                ticketNumber: { type: Type.STRING, description: "The main identifier/TC/Folio" },
                transactionId: { type: Type.STRING, description: "TR number or transaction ID" },
                rawTotal: { type: Type.NUMBER, description: "Numeric total for validation" }
              }
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['text', 'separator', 'barcode', 'logo', 'qr'] },
                  text: { type: Type.STRING },
                  secondaryText: { type: Type.STRING, nullable: true },
                  layout: { type: Type.STRING, enum: ['single', 'split'] },
                  align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
                  isBold: { type: Type.BOOLEAN },
                  fontSize: { type: Type.STRING, enum: ['xs', 'sm', 'base', 'lg', 'xl', '2xl'] },
                  fontFamily: { type: Type.STRING, enum: ['mono', 'sans'] },
                  marginTop: { type: Type.NUMBER },
                  separatorStyle: { type: Type.STRING, enum: ['dashed', 'solid', 'double', 'dotted'], nullable: true },
                },
                required: ['id', 'type', 'text', 'layout', 'align', 'isBold', 'fontSize', 'fontFamily'],
              },
            },
          },
          required: ['quality', 'items', 'metadata'],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");

    const data = JSON.parse(jsonText) as ReceiptData;

    // --- LOGIC GATE: If AI says it's bad, return immediately without post-processing ---
    if (data.quality && (data.quality.isReadable === false || data.quality.readabilityScore < 85)) {
        data.quality.isReadable = false; // Force false if score is low
        return data;
    }

    // Post-processing: Identify merchant and refine billing data if AI missed it
    const strategy = identifyMerchant(data);
    
    // Add merchant key to billing data
    if (!data.billing) data.billing = {};
    data.billing.merchantKey = strategy.key;

    // If AI missed TR/TC but we can find it via regex in the strategy, add it
    const fullText = data.items.map(i => i.text).join(' ');
    const extractedViaStrategy = strategy.extract(fullText, data.metadata);
    
    if (!data.billing.transactionId && extractedViaStrategy.transactionId) {
        data.billing.transactionId = extractedViaStrategy.transactionId;
    }
    if (!data.billing.ticketNumber && extractedViaStrategy.ticketNumber) {
        data.billing.ticketNumber = extractedViaStrategy.ticketNumber;
    }

    return data;

  } catch (error) {
    console.error("Error analyzing receipt:", error);
    throw error;
  }
};

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  isSuspectMatch: boolean;
  suspectId?: string;
  confidence: number;
  behavior: string;
  isSuspicious: boolean;
  detectedObjects: string[];
  faces: { x: number; y: number; w: number; h: number; isSuspect: boolean }[];
}

export async function analyzeFrame(base64Image: string, suspects: any[]): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  const suspectContext = suspects.map(s => `ID: ${s.id}, Name: ${s.name}, Category: ${s.category}, Description: ${s.description}, Risk: ${s.risk_level}`).join("\n");

  const prompt = `
    Analyze this surveillance camera frame with extreme precision. 
    Current Suspect Database (Profiles to match against):
    ${suspectContext}

    Tasks:
    1. Identify any faces in the image.
    2. Compare each face against the suspect database descriptions. If a face matches a description (e.g., "Young woman, dark hair tied back, neutral expression, wearing a beige t-shirt"), set isSuspectMatch to true and provide the suspectId (the ID string from the database).
    3. Detect suspicious behaviors (loitering, running, abandoned objects, aggressive gestures, unauthorized entry).
    4. Detect objects (bags, weapons, vehicles, electronics).
    5. Return coordinates for all detected faces for privacy blurring.

    Return the analysis in the specified JSON format. Be very confident in your matches if the features align closely with the database descriptions.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(",")[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSuspectMatch: { type: Type.BOOLEAN },
            suspectId: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            behavior: { type: Type.STRING },
            isSuspicious: { type: Type.BOOLEAN },
            detectedObjects: { type: Type.ARRAY, items: { type: Type.STRING } },
            faces: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  w: { type: Type.NUMBER },
                  h: { type: Type.NUMBER },
                  isSuspect: { type: Type.BOOLEAN }
                },
                required: ["x", "y", "w", "h", "isSuspect"]
              }
            }
          },
          required: ["isSuspectMatch", "confidence", "behavior", "isSuspicious", "detectedObjects", "faces"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      isSuspectMatch: false,
      confidence: 0,
      behavior: "Analysis failed",
      isSuspicious: false,
      detectedObjects: [],
      faces: []
    };
  }
}

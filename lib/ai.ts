import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const townhallModel = google('gemini-3-flash-preview');

export const ANALYSIS_PROMPT = (comment: string) => `
  You are an expert QA Engineer. Analyze this screenshot based on the 
  user's comment: "${comment}". Provide a concise, jargon-free summary...
`;

export const generateAnalysis = async (
  comment: string,
  image: { data: Uint8Array; mediaType: string },
) => {
  const { text } = await generateText({
    model: townhallModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: ANALYSIS_PROMPT(comment) },
          // Inline the screenshot bytes so the model doesn't have to fetch the
          // image back out of Supabase Storage over the network.
          { type: "image", image: image.data, mediaType: image.mediaType },
        ],
      },
    ],
  });
  return { text };
};

export const parseSentiment = (analysis: string): "POSITIVE" | "NEUTRAL" | "FRUSTRATED" => {
  if (analysis.includes("FRUSTRATED")) return "FRUSTRATED";
  if (analysis.includes("POSITIVE")) return "POSITIVE";
  return "NEUTRAL";
};
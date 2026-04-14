import { google } from '@ai-sdk/google';

export const townhallModel = google('gemini-1.5-flash');

export const ANALYSIS_PROMPT = `
  You are an expert QA Engineer. 
  1. Analyze the attached screenshot of a UI test.
  2. Compare it with the user's comment.
  3. Provide a clear, technical 1-sentence summary for a developer.
  4. Output the sentiment as one of: [POSITIVE, NEGATIVE, NEUTRAL, FRUSTRATED].
`;
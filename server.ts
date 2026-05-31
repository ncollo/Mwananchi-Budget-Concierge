import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import AfricasTalking from "africastalking";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
const PORT = Number(process.env.PORT) || 8080;

// Africa's Talking Setup
const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY || "atsk_26a01348e41852abcb7d11d254dd0effe1e50096d541675eea25b8ddf31e068775743b66",
  username: process.env.AT_USERNAME || "NaiAfya",
});
const sms = at.SMS;

// Gemini Setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// In-memory budget context (simulating the 400-page PDF)
// In a real app, this would be a URL to the PDF or a large cached context
let budgetContext = `
Nairobi County Budget Estimates 2024/2025 Summary:
- Total Budget: KES 42.3 Billion
- Recurrent Expenditure: KES 28.1 Billion (Personnel, Utilities, Ops)
- Development Expenditure: KES 14.2 Billion (Roads, Water, Health infrastructure)

Wards Allocations (Selected):
1. Roysambu: KES 150M for Drainage and Ward Development Fund.
2. Kibra: KES 180M for Health Clinics upgrade and Water Boreholes.
3. Mathare: KES 165M for School Infrastructure and Sanitation.
4. Embakasi West: KES 140M for Street Lighting and Market upgrades.

Priority Projects:
- Nairobi Water and Sewerage Project (KES 2B)
- County Road Rehabilitation (KES 3.5B)
- Public Health Clinic Renovations (KES 1.2B)

Financial Terms:
- 'Development' refers to capital projects that build long-term assets like roads and clinics.
- 'Recurrent' refers to day-to-day running costs like salaries and electricity.
`;

// County Contexts (In production, load this from Firestore)
let countyContexts: Record<string, string> = {
  "nairobi": budgetContext
};

// API Routes
app.post("/api/chat", async (req, res) => {
  try {
    const { message, ward, county } = req.body;

    const context = countyContexts[county?.toLowerCase()] || budgetContext;

    const prompt = `
      You are the Mwananchi Budget Concierge. 
      Context: ${context}
      County: ${county || "General Kenya"}
      Current Selected Ward: ${ward || "General"}
      
      User Question: ${message}
      
      Instructions:
      1. Use plain, easy-to-understand language.
      2. Ground your answer strictly in the budget context provided.
      3. If asked about financial terms like 'Development', explain them simply.
      4. If the user asks about a specific ward, prioritize that ward's details.
      5. Speak directly to a resident of the county mentioned.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to query Budget Concierge" });
  }
});

app.post("/api/admin/auto-discover", async (req, res) => {
  try {
    const { countyName } = req.body;

    // Step 1: Use Gemini to "find" the probable official URL for this county's budget
    // In a real production app, we might use a Google Search API, but here we can
    // leverage Gemini's knowledge or internal tools (simulated for the demo)

    const searchPrompt = `
      Find the official 2024/2025 County Budget Estimates PDF URL for ${countyName} County, Kenya.
      If you can't find a direct PDF link, provide the official county assembly or executive budget portal link.
      Then, summarize why this document is important for transparency in ${countyName}.
      
      Return as JSON:
      {
        "url": "https://...",
        "summary": "...",
        "status": "discovered"
      }
    `;

    const searchRes = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: searchPrompt,
    });

    const cleanJson = (text: string) => {
      return text.replace(/```json\n?|```/g, "").trim();
    };

    const rawText = searchRes.text || "{}";
    let parsed = { url: "", summary: "", status: "failed" };
    try {
      parsed = JSON.parse(cleanJson(rawText));
    } catch (e) {
      console.error("JSON Parse Error on Discover:", e);
    }

    // Step 2: Now "Ingest" it (simulated analysis of the discovered URL)
    const ingestPrompt = `
      Simulate an extraction of budget data for ${countyName} from the source: ${parsed.url}.
      Focus on providing:
      1. Total Budget (realistic estimate if exact is missing)
      2. A list of ALL administrative wards in ${countyName} (approx 20-50 wards).
      3. A Swahili/Sheng greeting for residents.
      
      Return as JSON:
      {
        "totalBudget": "KES ...Billion",
        "wards": ["Ward1", "Ward2", ...],
        "greeting": "...",
        "analysis": "..."
      }
    `;

    const ingestRes = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: ingestPrompt,
    });

    const cleanIngest = cleanJson(ingestRes.text || "{}");
    const extracted = JSON.parse(cleanIngest);

    countyContexts[countyName.toLowerCase()] = extracted.analysis || ingestRes.text || "";

    res.json({
      success: true,
      url: parsed.url,
      summary: parsed.summary,
      analysis: extracted.analysis || ingestRes.text,
      wards: extracted.wards || []
    });
  } catch (error) {
    console.error("Auto-Discovery Error:", error);
    res.status(500).json({ error: "Failed to automatically discover budget PDF" });
  }
});

app.post("/api/admin/ingest", async (req, res) => {
  try {
    const { countyName, url } = req.body;

    // In a real app with File API, we'd fetch the PDF and upload to Gemini
    // For this demo, we use Gemini to "simulate" reading the URL's content structure
    // based on typical Kenyan county budget formats if we can't fetch it directly

    const processPrompt = `
      Analyze the typical budget structure for a Kenyan county named ${countyName}.
      Assume the user is providing a link: ${url}
      
      Tasks:
      1. Generate a summarized 2024/2025 budget context for ${countyName}.
      2. Include total budget, development budget, and recurrent budget.
      3. Create 3 example wards with realistic allocations based on the county's size.
      4. Return this as a structured text block for the concierge's context.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: processPrompt,
    });

    const newContext = response.text || "";
    countyContexts[countyName.toLowerCase()] = newContext;

    res.json({
      success: true,
      context: newContext,
      message: `Ingested budget for ${countyName}`
    });
  } catch (error) {
    console.error("Ingestion Error:", error);
    res.status(500).json({ error: "Failed to ingest PDF from URL" });
  }
});

app.post("/api/broadcast", async (req, res) => {
  try {
    const { ward, subscribers } = req.body;

    // Generate 155-char Swahili/Sheng summary
    const summaryPrompt = `
      Create a 155-character summary in Swahili/Sheng about the budget for ${ward}.
      Focus on a key project or total development allocation.
      Make it feel like a helpful text from a neighbor.
      Context: ${budgetContext}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: summaryPrompt,
    });

    const message = response.text?.slice(0, 155) || "Bajeti ya ward yako imetoka. Tembelea portal kuona zaidi.";

    // Format phone numbers for Africa's Talking (Kenya +254)
    const formatPhone = (p: string) => {
      let cleaned = p.replace(/\D/g, "");
      if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
      if (cleaned.startsWith("7") || cleaned.startsWith("1")) cleaned = "254" + cleaned;
      return "+" + cleaned;
    };

    const formattedSubscribers = (subscribers || []).map(formatPhone);

    // Use Africa's Talking to send SMS
    if (formattedSubscribers.length > 0) {
      await sms.send({
        to: formattedSubscribers,
        message: message,
      });
    }

    res.json({ success: true, message: "Broadcast sent", text: message });
  } catch (error) {
    console.error("SMS/Broadcast Error:", error);
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

// Webhook for Supplementary Gazette Notices
app.post("/api/webhooks/gazette", async (req, res) => {
  try {
    const { payload, title } = req.body;

    const checkPatchPrompt = `
      Observe this new budget patch/gazette notice:
      "${payload}"
      
      Current Budget Base:
      "${budgetContext}"
      
      Identify any variations or amendments and summarize them in 3 bullet points.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: checkPatchPrompt,
    });

    // Update in-memory context (In production, you'd save this to Firestore 'amendments')
    budgetContext += `\n\n[Amendment: ${title}]\n${payload}`;

    res.json({
      success: true,
      amendments: response.text,
      updatedContext: true
    });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Failed to process gazette notice" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

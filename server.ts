import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoint: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Optional: Smart book metadata suggestion endpoint using Gemini API server-side
  app.post("/api/enrich-book", async (req, res) => {
    const { title, author } = req.body;
    if (!title) {
       res.status(400).json({ error: "Title is required" });
       return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Gracefully fall back if Gemini is not set up
       res.json({ 
        suggestedGenre: "Fiction",
        suggestedDescription: "A fascinating story.",
        suggestedTags: ["interesting", "reading"],
        suggestedYear: new Date().getFullYear().toString(),
        isMock: true
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a library metadata expert. Suggest values for a book titled "${title}" by "${author || 'unknown'}". Respond with a JSON object containing keys "genre" (string, choose standard genre like Fiction, Mystery, Sci-Fi, Biography, Fantasy, History, Self-Help, Textbook, Drama), "description" (string, summary up to 150 words), "tags" (array of strings, up to 5 simple, relevant lowercase words like adventure, magic, classic, educational), and "publicationYear" (string representing year). Output ONLY the raw JSON block without formatting wrappers or backticks.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });

      let text = response.text ? response.text.trim() : "";
      // Clean up markdown block headers if present
      if (text.startsWith("```json")) {
        text = text.substring(7);
      }
      if (text.endsWith("```")) {
        text = text.substring(0, text.length - 3);
      }
      text = text.trim();

      const data = JSON.parse(text);
      res.json({
        suggestedGenre: data.genre || "Fiction",
        suggestedDescription: data.description || "",
        suggestedTags: data.tags || [],
        suggestedYear: data.publicationYear?.toString() || ""
      });
    } catch (err) {
      console.error("Gemini suggestion error:", err);
      res.json({
        suggestedGenre: "Fiction",
        suggestedDescription: `A story titled ${title} by ${author || 'unknown'}.`,
        suggestedTags: ["book", "library"],
        suggestedYear: "2020",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Vite middleware Setup for Dev, Static serving for Production
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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

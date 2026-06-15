import { NextResponse } from "next/server";

type Tone = "professional" | "simple" | "detailed";

type EodRequest = {
  morning?: string;
  afternoon?: string;
  evening?: string;
  blockers?: string;
  meetings?: string;
  tomorrow?: string;
  tone?: Tone;
};

type EodResponse = {
  professional: string;
  slack: string;
  email: string;
  bullets: string;
  tomorrowPlan: string;
};

type AiGenerationResult = {
  result: EodResponse | null;
  model?: string;
  warning?: string;
};

const toneGuidance: Record<Tone, string> = {
  professional:
    "Use polished workplace language, concise phrasing, and a confident team-update style.",
  simple:
    "Use plain, direct language that is easy to paste into Slack or Teams.",
  detailed:
    "Use fuller context, clearer sequencing, and a little more explanation while staying concise."
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EodRequest;
    const normalized = normalizeInput(body);

    if (!normalized.morning && !normalized.afternoon && !normalized.evening) {
      return NextResponse.json(
        { error: "Add at least one morning, afternoon, or evening update." },
        { status: 400 }
      );
    }

    const aiResult = await generateWithGemini(normalized);

    return NextResponse.json({
      result: aiResult.result ?? generateFallback(normalized),
      source: aiResult.result ? "gemini" : "local",
      model: aiResult.model,
      warning: aiResult.warning
    });
  } catch (error) {
    console.error("EOD generation failed", error);
    return NextResponse.json(
      { error: "Could not generate the EOD report. Please try again." },
      { status: 500 }
    );
  }
}

function normalizeInput(body: EodRequest): Required<EodRequest> {
  const tone: Tone =
    body.tone === "simple" || body.tone === "detailed" ? body.tone : "professional";

  return {
    morning: clean(body.morning),
    afternoon: clean(body.afternoon),
    evening: clean(body.evening),
    blockers: clean(body.blockers),
    meetings: clean(body.meetings),
    tomorrow: clean(body.tomorrow),
    tone
  };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function generateWithGemini(input: Required<EodRequest>): Promise<AiGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const models = getConfiguredModels();

  if (!apiKey) {
    return { result: null, warning: "missing-key" };
  }

  const prompt = buildPrompt(input);
  const warnings: string[] = [];

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              professional: { type: "STRING" },
              slack: { type: "STRING" },
              email: { type: "STRING" },
              bullets: { type: "STRING" },
              tomorrowPlan: { type: "STRING" }
            },
            required: ["professional", "slack", "email", "bullets", "tomorrowPlan"]
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const warning = summarizeGeminiError(errorText);
      console.error(`Gemini request failed for ${model}`, errorText);
      warnings.push(`${model}: ${warning}`);
      continue;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      warnings.push(`${model}: empty response`);
      continue;
    }

    try {
      const parsed = validateResponse(JSON.parse(extractJson(text)));

      if (parsed) {
        return { result: parsed, model };
      }

      warnings.push(`${model}: incomplete JSON response`);
    } catch (error) {
      console.error(`Gemini JSON parse failed for ${model}`, {
        error,
        preview: text.slice(0, 300)
      });
      warnings.push(`${model}: invalid JSON response`);
    }
  }

  return {
    result: null,
    warning: `All configured models failed. ${warnings.join(" | ")}`
  };
}

function getConfiguredModels() {
  const configured = process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it,gemma-4-31b-it";

  return configured
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function summarizeGeminiError(errorText: string) {
  try {
    const parsed = JSON.parse(errorText);
    return parsed?.error?.message || "Gemini request failed.";
  } catch {
    return "Gemini request failed.";
  }
}

function buildPrompt(input: Required<EodRequest>) {
  return `You are a JSON API for an end-of-day report generator.

Create an end-of-day report from the notes below.

Return only one valid JSON object. Do not include markdown, code fences, headings, explanations, bullet labels outside JSON, or an "Input" section.

The JSON object must have exactly these string keys:
{
  "professional": "string",
  "slack": "string",
  "email": "string",
  "bullets": "string",
  "tomorrowPlan": "string"
}

Tone: ${input.tone}
Tone guidance: ${toneGuidance[input.tone]}

Morning topics:
${input.morning || "None provided"}

Afternoon topics:
${input.afternoon || "None provided"}

Evening topics:
${input.evening || "None provided"}

Blockers:
${input.blockers || "None"}

Meetings:
${input.meetings || "None"}

Tomorrow's plan:
${input.tomorrow || "Infer a short practical plan from today's work"}

Formatting rules:
- professional: paste-ready message starting with "Hi Team,"
- slack: shorter version suitable for Slack or Teams
- email: more detailed email version with subject line
- bullets: bullet-point work summary grouped by time of day
- tomorrowPlan: bullet list only
- Do not invent specific tools, names, tickets, metrics, or blockers not implied by the notes.`;
}

function validateResponse(value: Partial<EodResponse>): EodResponse | null {
  const keys: Array<keyof EodResponse> = [
    "professional",
    "slack",
    "email",
    "bullets",
    "tomorrowPlan"
  ];

  if (!value || keys.some((key) => typeof value[key] !== "string")) {
    return null;
  }

  return {
    professional: value.professional!,
    slack: value.slack!,
    email: value.email!,
    bullets: value.bullets!,
    tomorrowPlan: value.tomorrowPlan!
  };
}

function generateFallback(input: Required<EodRequest>): EodResponse {
  const sections = [
    ["Morning", input.morning],
    ["Afternoon", input.afternoon],
    ["Evening", input.evening]
  ].filter(([, value]) => value);

  const blockers = input.blockers || "No blockers reported.";
  const meetings = input.meetings ? `\n\nMeetings:\n${asBullets(input.meetings)}` : "";
  const tomorrow =
    input.tomorrow ||
    sections
      .map(([label, value]) => `Continue follow-ups from ${label.toLowerCase()}: ${value}`)
      .join("\n");

  const professional = `Hi Team,

Here is my EOD update for today:

${sections.map(([label, value]) => `${label}:\n${asBullets(value)}`).join("\n\n")}${meetings}

Blockers:
${asBullets(blockers)}

Plan for Tomorrow:
${asBullets(tomorrow)}

Thanks,
Nilesh`;

  const slack = `EOD update:
${sections.map(([label, value]) => `*${label}:* ${sentence(value)}`).join("\n")}
*Blockers:* ${sentence(blockers)}
*Tomorrow:* ${sentence(tomorrow)}`;

  const email = `Subject: EOD Update

Hi Team,

Please find my detailed EOD update below.

${sections.map(([label, value]) => `${label}:\n${asBullets(value)}`).join("\n\n")}${meetings}

Blockers:
${asBullets(blockers)}

Plan for Tomorrow:
${asBullets(tomorrow)}

Thanks,
Nilesh`;

  const bullets = `${sections
    .map(([label, value]) => `${label}:\n${asBullets(value)}`)
    .join("\n\n")}

Blockers:
${asBullets(blockers)}`;

  return {
    professional,
    slack,
    email,
    bullets,
    tomorrowPlan: asBullets(tomorrow)
  };
}

function asBullets(value: string) {
  return splitNotes(value)
    .map((item) => `- ${item}`)
    .join("\n");
}

function sentence(value: string) {
  return splitNotes(value).join("; ");
}

function splitNotes(value: string) {
  return value
    .split(/\n|;|\.\s+/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`));
}

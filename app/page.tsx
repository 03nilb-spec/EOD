"use client";

import { Clipboard, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

type Tone = "professional" | "simple" | "detailed";
type ResultKey = "professional" | "slack" | "email" | "bullets" | "tomorrowPlan";

type EodResult = Record<ResultKey, string>;

const tabs: Array<{ key: ResultKey; label: string }> = [
  { key: "professional", label: "Professional" },
  { key: "slack", label: "Slack" },
  { key: "email", label: "Email" },
  { key: "bullets", label: "Bullets" },
  { key: "tomorrowPlan", label: "Tomorrow" }
];

const toneOptions: Tone[] = ["professional", "simple", "detailed"];

const initialResult: EodResult | null = null;

export default function Home() {
  const [morning, setMorning] = useState("");
  const [afternoon, setAfternoon] = useState("");
  const [evening, setEvening] = useState("");
  const [blockers, setBlockers] = useState("");
  const [meetings, setMeetings] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [activeTab, setActiveTab] = useState<ResultKey>("professional");
  const [result, setResult] = useState<EodResult | null>(initialResult);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const activeOutput = useMemo(() => {
    if (!result) {
      return "";
    }

    return result[activeTab];
  }, [activeTab, result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setCopied(false);
    setLoading(true);

    try {
      const response = await fetch("/api/generate-eod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          morning,
          afternoon,
          evening,
          blockers,
          meetings,
          tomorrow,
          tone
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate report.");
      }

      setResult(data.result);
      setActiveTab("professional");
      if (data.source === "gemini") {
        setMessage(data.model ? `Generated with Gemini: ${data.model}.` : "Generated with Gemini.");
      } else if (data.warning && data.warning !== "missing-key") {
        setMessage(`Gemini failed: ${data.warning} Generated locally.`);
      } else {
        setMessage("Generated locally. Add GEMINI_API_KEY to use Gemini.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate report.");
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    if (!activeOutput) {
      return;
    }

    const clipboardPermission = await getClipboardPermission();

    if (clipboardPermission === "granted" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(activeOutput);
        showCopied();
        return;
      } catch {
        // Fall back to the legacy path below.
      }
    }

    if (copyWithTextarea(activeOutput)) {
      showCopied();
      return;
    }

    setMessage("Copy is blocked by browser permissions. Select the output text to copy it.");
  }

  async function getClipboardPermission() {
    try {
      if (!navigator.permissions?.query) {
        return "unknown";
      }

      const permission = await navigator.permissions.query({
        name: "clipboard-write" as PermissionName
      });

      return permission.state;
    } catch {
      return "unknown";
    }
  }

  function showCopied() {
    setCopied(true);
    setMessage("Copied result to clipboard.");
    window.setTimeout(() => setCopied(false), 1600);
  }

  function copyWithTextarea(value: string) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const didCopy = document.execCommand("copy");
      document.body.removeChild(textarea);
      return didCopy;
    } catch {
      return false;
    }
  }

  function loadExample() {
    setMorning(
      "Worked on authentication flow and reviewed session persistence issue.\nTested Google login in the development environment."
    );
    setAfternoon(
      "Debugged resume upload flow and checked PDF parsing errors.\nUpdated error handling for unsupported resume formats."
    );
    setEvening(
      "Reviewed dashboard usage limits and AI analysis count logic.\nPlanned next enhancements for premium AI analysis flow."
    );
    setBlockers("PDF parsing fails for some unsupported formats.");
    setMeetings("Quick sync on premium AI analysis flow and usage limit behavior.");
    setTomorrow(
      "Fix session persistence after browser refresh.\nImprove user-friendly error messages for failed PDF parsing."
    );
  }

  return (
    <main className="page-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">AI EOD workspace</p>
          <h1>AI EOD Report Generator</h1>
          <p className="header-copy">
            Turn morning, afternoon, and evening notes into polished updates for
            Slack, Teams, email, and tomorrow planning.
          </p>
        </div>
        <div className="status-pill">
          <Sparkles size={18} aria-hidden="true" />
          Gemini-ready MVP
        </div>
      </header>

      <div className="layout-grid">
        <section className="panel" aria-labelledby="input-title">
          <div className="panel-header">
            <h2 className="panel-title" id="input-title">
              Daily Inputs
            </h2>
            <button className="secondary-button" type="button" onClick={loadExample}>
              Load example
            </button>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="morning">Morning topics covered</label>
              <textarea
                id="morning"
                value={morning}
                onChange={(event) => setMorning(event.target.value)}
                placeholder="Worked on authentication flow..."
              />
            </div>

            <div className="field">
              <label htmlFor="afternoon">Afternoon topics covered</label>
              <textarea
                id="afternoon"
                value={afternoon}
                onChange={(event) => setAfternoon(event.target.value)}
                placeholder="Debugged resume upload flow..."
              />
            </div>

            <div className="field">
              <label htmlFor="evening">Evening topics covered</label>
              <textarea
                id="evening"
                value={evening}
                onChange={(event) => setEvening(event.target.value)}
                placeholder="Reviewed dashboard usage limits..."
              />
            </div>

            <div className="optional-grid">
              <div className="field">
                <label htmlFor="blockers">Blockers</label>
                <textarea
                  id="blockers"
                  value={blockers}
                  onChange={(event) => setBlockers(event.target.value)}
                  placeholder="PDF parsing fails for some unsupported formats."
                />
              </div>

              <div className="field">
                <label htmlFor="meetings">Meetings</label>
                <textarea
                  id="meetings"
                  value={meetings}
                  onChange={(event) => setMeetings(event.target.value)}
                  placeholder="Daily standup, client sync..."
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="tomorrow">Tomorrow&apos;s plan</label>
              <textarea
                id="tomorrow"
                value={tomorrow}
                onChange={(event) => setTomorrow(event.target.value)}
                placeholder="Fix session persistence after browser refresh..."
              />
            </div>

            <div className="tone-row">
              <span className="control-label">Tone selector</span>
              <div className="segmented" role="group" aria-label="Tone selector">
                {toneOptions.map((option) => (
                  <button
                    aria-pressed={tone === option}
                    className="tone-option"
                    key={option}
                    onClick={() => setTone(option)}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="actions">
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? (
                  <Loader2 size={18} aria-hidden="true" />
                ) : (
                  <Sparkles size={18} aria-hidden="true" />
                )}
                {loading ? "Generating" : "Generate"}
              </button>
              <p className={`message ${message.includes("Unable") ? "error" : ""}`}>
                {message}
              </p>
            </div>
          </form>
        </section>

        <section className="panel result-panel" aria-labelledby="output-title">
          <div className="panel-header">
            <h2 className="panel-title" id="output-title">
              Generated Output
            </h2>
            <div className="result-tools">
              <button
                className="secondary-button"
                disabled={!activeOutput}
                onClick={copyOutput}
                type="button"
              >
                {copied ? (
                  <ClipboardCheck size={18} aria-hidden="true" />
                ) : (
                  <Clipboard size={18} aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy result"}
              </button>
            </div>
          </div>

          <div className="result-body">
            <div className="format-tabs" role="tablist" aria-label="Output formats">
              {tabs.map((tab) => (
                <button
                  aria-selected={activeTab === tab.key}
                  className="tab-button"
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeOutput ? (
              <pre className="output-box">{activeOutput}</pre>
            ) : (
              <div className="empty-output">
                Add your day notes and generate the EOD message.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

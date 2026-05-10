import type { ParsedIssue, ReleaseIssueItem } from "../types";

// ─── AI is temporarily disabled (no Anthropic credits). ──────────────────────
// Uncomment the block below and the constructor body when credits are available.
//
// import Anthropic from "@anthropic-ai/sdk";
// import { env } from "../config/env";
// import { logger } from "../utils/logger";
//
// const PARSE_ISSUE_TOOL: Anthropic.Tool = {
//   name: "structured_issue",
//   description: "Return structured data about whether a Discord message is a valid issue report",
//   input_schema: {
//     type: "object",
//     properties: {
//       isIssue: { type: "boolean" },
//       confidence: { type: "number" },
//       title: { type: "string" },
//       summary: { type: "string" },
//       severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
//       category: { type: "string" },
//       stepsToReproduce: { type: "array", items: { type: "string" } },
//     },
//     required: ["isIssue", "confidence", "title", "summary", "severity", "category", "stepsToReproduce"],
//   },
// };

const CONFIDENCE_THRESHOLD = 0.65;

export class AiService {
  // private readonly client: Anthropic;

  constructor() {
    // this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async parseIssue(
    content: string,
    attachmentCount: number,
    _authorName: string
  ): Promise<ParsedIssue> {
    // ── Fallback: treat every 🐞 reaction as a valid issue ──────────────────
    const text = content.trim();
    const firstLine = text.split("\n")[0] ?? "";
    const title = firstLine.length > 80
      ? firstLine.slice(0, 77) + "..."
      : firstLine || (attachmentCount > 0 ? "Screenshot attached" : "Untitled issue");

    return {
      isIssue: true,
      confidence: 1,
      title,
      summary: text || "(no description provided)",
      severity: "MEDIUM",
      category: "General",
      stepsToReproduce: [],
    };

    // ── Real AI path (uncomment when Anthropic credits are available) ────────
    // const systemPrompt = `You are an issue triage assistant for a software engineering team.
    // Analyze Discord messages and determine if they describe a bug, feature request, or UX feedback.
    // Return isIssue=false for casual conversation, greetings, or off-topic messages.
    // Be generous: if a screenshot is attached (attachmentCount > 0), it likely accompanies a real report.
    // Always call the structured_issue tool with your analysis.`;
    //
    // const userPrompt = `Reporter: ${_authorName}
    // Attachments: ${attachmentCount} screenshot(s)
    // Message: ${content || "(no text — screenshot only)"}`;
    //
    // const response = await this.client.messages.create({
    //   model: env.ANTHROPIC_MODEL,
    //   max_tokens: 1024,
    //   system: systemPrompt,
    //   tools: [PARSE_ISSUE_TOOL],
    //   tool_choice: { type: "any" },
    //   messages: [{ role: "user", content: userPrompt }],
    // });
    //
    // const toolUse = response.content.find(
    //   (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    // );
    // if (!toolUse) throw new Error("Anthropic returned no tool call");
    //
    // const parsed = toolUse.input as ParsedIssue;
    // logger.debug({ parsed }, "AI parsed issue");
    // return parsed;
  }

  isAboveConfidenceThreshold(parsed: ParsedIssue): boolean {
    return parsed.isIssue && parsed.confidence >= CONFIDENCE_THRESHOLD;
  }

  async generateReleaseNotes(
    version: string,
    issues: ReleaseIssueItem[]
  ): Promise<string> {
    // ── Fallback: plain formatted list ───────────────────────────────────────
    const lines = issues.map((i) => `• **${i.issueId}** — ${i.title} *(${i.category})*`);
    return `**v${version} Release Notes**\n\n${lines.join("\n")}`;

    // ── Real AI path (uncomment when Anthropic credits are available) ────────
    // const issueList = issues
    //   .map((i) => `- [${i.issueId}] ${i.title} (${i.category})`)
    //   .join("\n");
    //
    // const response = await this.client.messages.create({
    //   model: env.ANTHROPIC_MODEL,
    //   max_tokens: 1024,
    //   system: "You generate clean, professional release notes for a software team's Discord channel. Use concise bullet points. Group by category when there are 3+ issues. Keep it short.",
    //   messages: [
    //     {
    //       role: "user",
    //       content: `Generate release notes for version ${version}.\n\nResolved issues:\n${issueList}`,
    //     },
    //   ],
    // });
    //
    // const textBlock = response.content.find(
    //   (b): b is Anthropic.TextBlock => b.type === "text"
    // );
    // return textBlock?.text ?? `v${version}\n${issueList}`;
  }
}

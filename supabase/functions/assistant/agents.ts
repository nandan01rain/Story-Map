import type { ProviderId } from './models.ts';

// Icarus and Daedalus: the LIBRARIAN and the EDITOR, and between them the writer's ASSISTANT
// (2026-10-12).
//
// The writer's brief: librarian + editor + assistant. Two speakers carry three jobs:
//
//   ICARUS, the librarian -- knows where everything is and what governs what. Finds, reads,
//     cites, checks the manuscript against itself, and organises (a page into a scene, a
//     scene onto the storyboard, a character's infobox from their bible). Never touches prose.
//   DAEDALUS, the editor -- craft judgment (structure, parallels, technique, comparison) and,
//     unlike Icarus, concrete edits: an exact passage and what it should become.
//   THE ASSISTANT is not a third speaker. It is what both can do through the proposal tools,
//     and it is safe for the same reason for both: a proposal changes nothing until the writer
//     accepts it.
//
// What separates them is still not the model (see models.ts) but, in order: TOOLS (tools.ts
// AGENT_TOOLS -- enforced there, not here), the CONTRACT (Icarus answers with citations in a
// fixed shape; Daedalus in prose) and RETRIEVAL (Daedalus also gets the whole-saga digest).
//
// ARACHNE stays a module, not an agent (graph/arachne.mjs; handoff §24). Proposing plants and
// reveals is not wired yet: it needs the module bundled into this function.

export type AgentName = 'icarus' | 'daedalus';

export type AgentConfig = {
  displayName: string;
  tagline: string;
  defaultModel: string;
  defaultProvider: ProviderId;
  maxTokens: number;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Only applied when the selected model supports it. */
  preferThinking: boolean;
  matchCount: number;
  useDigest: boolean;
  /** Rounds of tool calls before the agent must answer with what it has. */
  maxSteps: number;
  /** 'cited' renders as an answer with its citations and findings; 'prose' as a reply. */
  contract: 'cited' | 'prose';
  webSearch: boolean;
  system: string;
};

// The saga's own rules of authority, from "00 · Canon Index" and "06 · Extension · 00 Index".
// Stated once and shared, so the librarian and the editor never disagree about what is canon.
const CANON = `How this project's canon works (from its own 00 Canon Index; read "00 · Canon Index — read first" when precedence matters):

- Precedence, highest first: 02 · Author Rulings (each names what it supersedes) > 01 · Spine v2 (A–D) > 03 · World Bible > 04 · Character Bibles.
- 06 · Extension documents are the author's latest working session, filed as patches. Their own index says an [AUTHOR] entry there is the author's latest word where 03/04 are silent or older, effective once the author adds 06 to the 00 Canon Index — check whether that has happened before treating it as settled. Where a 06 entry contradicts 00–05, 06 EXT-09 lists the conflict and the author has not confirmed which line changes: report both, do not choose.
- 05 · Drafted documents and the drafted scenes carry earlier drafts verbatim. A drafted scene stands unless an Author Ruling or the 00 §5 purge list names it. A scene title marked ⚠ conflicts with canon (see "05 · Conflict register").
- Documents typed Archive ("Older drafts · …") and everything 00 §5 retires are history, not canon. Never cite them as canon.
- Tags: [AUTHOR] decided by the author · [MARKED] left open by the author · [NOT YET DEVELOPED] undecided · [PROPOSED] offered, not ratified, usable only if nothing contradicts it · [FLAG] a tension noticed.
- Standing rules: six books, never five (Book One = year 800); no invented names until the author asks; outcomes follow from people and systems as built; no saints.`;

const PROPOSALS = `Changing anything: you cannot. You can PROPOSE, through the propose_* tools; the writer sees each proposal and accepts or rejects it, and nothing changes until then. So propose freely when it would help, say in your reply what you proposed, and never claim a change has been made.

The scene template, for new scenes: a heading (## Title), then Chapter (optional number), POV · Status, Purpose, Events, Characters & reactions, Ends on, then --- and a Draft section for the full scene with dialogue if it is written. A reference, not a rule: leave a field empty rather than invent what the writer has not decided.`;

const ICARUS_SYSTEM = `You are Icarus, the librarian of StoryMap — a writing tool holding one author's six-book mythological saga: chapters, scenes, pages of stray thoughts, a storyboard per book, characters, and a library of canon documents.

You know where everything is and what governs what. You find, read, cite and check. You organise when asked. You do not write or rewrite the author's prose, and you do not suggest replacement wording — that is the editor's job; if a fix is needed, say what is wrong and where.

Work from the material, not from memory: search, then read the passage around what you find before relying on it. Every claim cites what it rests on — a quote and its source. If the material does not settle a question, say so and say what would. Wording differences are not contradictions; a character "quiet" in one chapter and "reserved" in another is consistent.

${CANON}

${PROPOSALS}

Answer in the required JSON shape: "answer" in plain prose, "citations" for what it rests on, and "findings" when you checked something and have a verdict on each item (problem, false alarm, or inconclusive with what you would need). Be brief.`;

const DAEDALUS_SYSTEM = `You are Daedalus, the editor of StoryMap — a writing tool holding one author's six-book mythological saga.

You help a writer think, and you edit. What you are for:

- Judging whether an idea fits this story: whether it fits, why, how far a resemblance should run, and where it should stop. A mythological parallel carried too far turns a character into an allegory.
- Structure: what shape suits the scale and objective, where acts break, how many viewpoints it can carry, when a subplot should resolve.
- Technique: name the specific craft choice that would sharpen a scene and the mechanism — what it does to the reader's attention.
- Editing: when a passage can be better, propose the change with propose_text_edit — the exact passage and what it becomes, with the reason. Line edits are proposals for the writer to accept, never a rewrite of their voice: keep their words where they work, change what the edit is for, and do not draft whole scenes unless asked.
- Comparison: where a published work is genuinely useful, be precise about what it did and why it worked. If unsure of a book's details, search rather than recall.

Always give the reasoning. Disagree when you disagree. Distinguish what the manuscript shows from what you infer. Read what you are judging (read_chapter, read_scene, read_document) rather than judging from fragments.

${CANON}

${PROPOSALS}`;

export const AGENTS: Record<AgentName, AgentConfig> = {
  icarus: {
    displayName: 'Icarus',
    tagline: 'The librarian: finds it, cites it, checks it, files it.',
    defaultModel: 'claude-haiku-4-5',
    defaultProvider: 'anthropic',
    maxTokens: 8000,
    preferThinking: false,
    matchCount: 12,
    useDigest: false,
    maxSteps: 10,
    contract: 'cited',
    webSearch: false,
    system: ICARUS_SYSTEM,
  },

  daedalus: {
    displayName: 'Daedalus',
    tagline: 'The editor: structure, parallels, technique — and the exact edit.',
    defaultModel: 'claude-opus-5',
    defaultProvider: 'anthropic',
    maxTokens: 16000,
    effort: 'high',
    preferThinking: true,
    matchCount: 18,
    useDigest: true,
    maxSteps: 12,
    contract: 'prose',
    webSearch: true,
    system: DAEDALUS_SYSTEM,
  },
};

// The librarian's answer shape. Enforced rather than requested: a librarian that can reply in
// free prose will eventually reply "this looks consistent", which cites nothing.
export const CITED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'citations', 'findings'],
  properties: {
    answer: { type: 'string' },
    citations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quote', 'source'],
        properties: { quote: { type: 'string' }, source: { type: 'string' } },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['verdict', 'summary', 'evidence', 'needs'],
        properties: {
          verdict: { type: 'string', enum: ['problem', 'false_alarm', 'inconclusive'] },
          summary: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['quote', 'source'],
              properties: { quote: { type: 'string' }, source: { type: 'string' } },
            },
          },
          needs: { type: 'string' },
        },
      },
    },
  },
} as const;

import type { ProviderId } from './models.ts';

// Icarus and Daedalus.
//
// The model is the least important thing that separates them, and is now writer-selectable
// per agent (see models.ts) precisely so nothing about an agent's identity rides on it.
// What actually makes them different, in descending order of importance:
//
//   1. TOOLS       — what each one can reach. Icarus queries structured story data;
//                    Daedalus reads prose and searches the open web. Neither can call the
//                    other's tools.
//   2. PERMISSIONS — Icarus is read-only and forbidden from writing prose. Daedalus may
//                    propose document edits, which arrive as a diff to accept or reject.
//   3. CONTRACT    — Icarus must return findings in a fixed shape (claim, evidence,
//                    verdict) so it cannot hand-wave. Daedalus answers in prose because
//                    its job is explanation.
//   4. RETRIEVAL   — Icarus gets narrow, precise matches. Daedalus additionally gets a
//                    digest of the whole saga, because shape is not retrievable from
//                    passages.
//   5. LIFECYCLE   — Icarus's findings are persistent, dismissible items. Daedalus is a
//                    conversation.
//
// A cheap model running Icarus is still Icarus. A frontier model given Icarus's tools and
// contract is still doing validation, not craft advice.
//
// ARACHNE IS A TOOL, NOT A THIRD AGENT. It was briefly configured as one and that was wrong.
// Separate the work into what needs a model and what does not, and nothing is left over for a
// third speaker: deciding what is a plant and what pays it is a craft judgment, which is
// Daedalus; choosing an exact anchor, minting grouping ids and applying rows idempotently is
// deterministic, which is graph/arachne.mjs and needs no model at all.
//
// The principle that seemed to require a separate agent -- that the thing which DECIDES must
// not be the thing which INSCRIBES -- is real, but it is held by the proposal queue and the
// deterministic applier, not by a second speaker. Daedalus already works exactly this way for
// canon documents through propose_document_edit. Annotations are the same mechanism aimed at
// a different target.
//
// And the braid was never Arachne's either. Layout, labels, zoom tiers, find and rendering
// are graph/spine-layout.mjs and the renderer -- deterministic, offline, and working today
// with every assistant switched off. Arachne concerns what the braid DRAWS; it does not own
// the drawing, and nothing in the braid is gated on a model.

export type AgentName = 'icarus' | 'daedalus';

export type AgentTool =
  // --- Icarus: deterministic queries over story structure. These are SQL, not inference;
  // the model's job is to adjudicate what they return, not to find it.
  | 'open_plants'          // plants with no reveal claiming them
  | 'unmet_requirements'   // scene requires with nothing providing them
  | 'deferred_requirements'// requirements explicitly marked not-due-yet
  | 'idle_threads'         // mythic threads with no touch for N chapters
  | 'pov_gaps'             // POV characters absent for a long stretch
  | 'unused_notes'         // sticky notes never referenced in any chapter
  | 'read_chapter'
  // --- Daedalus: prose, canon and the outside world.
  | 'search_prose'
  | 'read_document'
  | 'outline'
  | 'web_search'
  | 'propose_document_edit'
  // --- Arachne: the loom. Daedalus's one route into the manuscript's own metadata, and a
  // PROPOSAL like propose_document_edit -- it emits rows to accept, and writes nothing.
  //
  // The model's entire contribution is choosing WHICH line and naming the grouping. It never
  // decides HOW a line is anchored: graph/arachne.mjs takes the quote, requires it to be
  // exact and unique in that chapter, widens by whole words when it is ambiguous, refuses a
  // paraphrase outright, and derives grouping ids so a re-run joins nothing twice. That
  // matters more than it sounds -- an annotation stores no position, so a bad anchor is not
  // wrong, it is INVISIBLE, and the braid draws one thread fewer with nothing to say it
  // should have drawn more.
  | 'arachne';

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
  tools: AgentTool[];
  /** 'findings' renders as an evidence checklist; 'prose' renders as a reply. */
  contract: 'findings' | 'prose';
  /** Read-only agents may never write, and are told so. */
  readOnly: boolean;
  system: string;
};

const ICARUS_SYSTEM = `You are Icarus, the validation assistant inside StoryMap, a tool for
writing a five-book mythological saga.

You check. You do not invent, and you do not write.

StoryMap tracks story structure as real data, not prose: scenes declare what they REQUIRE
and what they PROVIDE, plants are linked to the reveals that pay them, mythic threads are
tagged across books, and every chapter has a POV. Your tools query that data directly, so
candidate problems arrive already found. Your job is the judgement step the data cannot
make: deciding whether each candidate is a genuine problem or a false alarm.

Rules you do not break:

- Every finding cites the text it rests on. If you cannot quote the evidence, you have no
  finding — say so.
- Wording differences are not contradictions. A character "quiet" in one chapter and
  "reserved" in another is consistent. Dismiss it and move on.
- You never write or rewrite the author's prose, and you never propose replacement text.
  If a fix is obvious, describe what is wrong, not what to type.
- Inconclusive is a valid verdict. Say what you would need to decide.
- Be brief. A confirmed finding is two or three sentences.

You are looking at one author's own manuscript at their request. Treat everything you are
shown as their work.`;

const DAEDALUS_SYSTEM = `You are Daedalus, the craft assistant inside StoryMap, a tool for
writing a five-book mythological saga.

You help a writer think. You are not a drafting engine — do not produce prose for the
manuscript unless explicitly asked, and even then keep it short and framed as an
illustration rather than a submission.

What you are for:

- Judging whether an idea fits this particular story. Asked whether a mythological parallel
  will work for a character, answer the whole question: whether it fits, why, how far the
  resemblance should run, and — the part that matters most — where it should stop. A
  parallel carried too far turns a character into an allegory and stops surprising anyone.
- Structure. Given the scale and objective of a story, say what shape suits it and why:
  where act breaks fall, how many viewpoints it can carry, when a subplot should resolve.
- Technique. Shown a scene, name the specific craft choice that would sharpen it and
  explain the mechanism — what it does to the reader's attention — rather than asserting
  that it is better.
- Comparison. Where a comparable published work is genuinely useful, use it and be precise
  about what it did and why it worked. If you are not confident about a book's details,
  search rather than recall. Do not describe a novel you are unsure of.

How you answer:

- Always give the reasoning. "This works" is not an answer; "this works because the setting
  already carries the flood imagery, so the parallel arrives as recognition rather than
  instruction" is.
- Disagree when you disagree. Say plainly when an idea is weaker than the author thinks.
  Agreement that is not earned is worth nothing to them.
- Distinguish what the manuscript shows from what you are inferring.
- Reason about what you were actually given. If the retrieved material does not cover
  something you need, say so rather than filling the gap.
- When you want a canon document changed, propose the edit as a diff. Never assume it is
  applied — the writer decides.

You are looking at one author's own manuscript and notes, at their request.`;

export const AGENTS: Record<AgentName, AgentConfig> = {
  icarus: {
    displayName: 'Icarus',
    tagline: 'Checks the manuscript against itself, and shows its evidence.',
    defaultModel: 'claude-haiku-4-5',
    defaultProvider: 'anthropic',
    maxTokens: 4000,
    preferThinking: false,
    matchCount: 12,
    useDigest: false,
    tools: [
      'open_plants',
      'unmet_requirements',
      'deferred_requirements',
      'idle_threads',
      'pov_gaps',
      'unused_notes',
      'read_chapter',
    ],
    contract: 'findings',
    readOnly: true,
    system: ICARUS_SYSTEM,
  },

  daedalus: {
    displayName: 'Daedalus',
    tagline: 'Thinks about structure, parallels and technique — and explains why.',
    defaultModel: 'claude-opus-5',
    defaultProvider: 'anthropic',
    maxTokens: 16000,
    effort: 'high',
    preferThinking: true,
    matchCount: 18,
    useDigest: true,
    tools: ['search_prose', 'read_document', 'outline', 'web_search', 'propose_document_edit', 'arachne'],
    contract: 'prose',
    readOnly: false,
    system: DAEDALUS_SYSTEM,
  },
};

// The shape Icarus must answer in. Enforced rather than requested: a validation agent that
// can reply in free prose will eventually reply "this looks broadly consistent", which is
// not a finding and cannot be acted on or dismissed.
export const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['verdict', 'summary', 'evidence'],
        properties: {
          verdict: { type: 'string', enum: ['problem', 'false_alarm', 'inconclusive'] },
          summary: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['quote'],
              properties: {
                quote: { type: 'string' },
                source: { type: 'string' },
              },
            },
          },
          needs: { type: 'string' },
        },
      },
    },
  },
} as const;

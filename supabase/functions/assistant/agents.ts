import type { ProviderId } from './models.ts';

// Icarus, Daedalus and Arachne.
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
// ARACHNE is a third agent by all five tests, and specifically NOT tools bolted onto
// Daedalus. Daedalus is trustworthy because it proposes and never inscribes -- its single
// write is propose_document_edit, against documents. Give it annotation-write tools and a
// craft-judgment agent can author the manuscript's structure as a side effect of discussing
// it. Arachne's whole licence to write is that it exercises no judgment at all: it
// transcribes recognitions the writer already made, and a transcriber that infers is a
// forger. Hence its own contract ('plan'), its own permission, and a retrieval strategy that
// is not semantic at all -- it needs one chapter's exact characters, because an annotation
// anchors by exact substring and a paraphrase silently fails to render.
//
// Note what Arachne is NOT given: the braid itself. Layout, labels, zoom tiers, find and
// rendering are graph/spine-layout.mjs and the renderer -- deterministic, offline, and
// working today with every assistant switched off. Routing a hover through a model would
// make the braid slow, billable and dependent on an API key, and would break the rule that
// AI stays behind aiEnabled and is never required for core functionality. Arachne owns what
// the braid DRAWS. It does not own the drawing.

export type AgentName = 'icarus' | 'daedalus' | 'arachne';

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
  // --- Arachne: the loom. The only write tools in the system that reach the manuscript's
  // own metadata, and the reason the proposal queue is not optional for this agent.
  // Anchoring, grouping and idempotency rules all live in graph/arachne.mjs, tested by
  // scripts/test-arachne.mjs -- the model chooses WHICH line, never HOW it is anchored.
  | 'read_chapter_exact'      // one chapter's prose verbatim; no chunking, no paraphrase
  | 'list_flags'              // what is already flagged, so a re-run adds nothing
  | 'list_groupings'          // existing setup/payoff groupings, paid and open
  | 'propose_transcription';  // emit a plan of annotations and joins -- never a write

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
  /**
   * 'findings' renders as an evidence checklist; 'prose' renders as a reply; 'plan' renders
   * as an accept/reject diff of rows to be written, and writes nothing until accepted.
   */
  contract: 'findings' | 'prose' | 'plan';
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

const ARACHNE_SYSTEM = `You are Arachne, the loom inside StoryMap, a tool for writing a
five-book mythological saga.

You write down what the writer has already recognised. You do not decide what is a plant,
what pays it off, or what recurs often enough to be a motif — those judgments were made in a
session with the writer present, and your only job is to record them accurately in the
manuscript's metadata.

This is the whole basis on which you are permitted to write at all. A transcriber that
infers is a forger. If you are unsure what the writer meant, say so and transcribe nothing:
an omission is visible and correctable, an invention is neither.

## What you produce

A plan, never a write. Every annotation and every grouping you propose is inert until the
writer accepts it. Do not describe a plan as done.

## Anchors — the part that actually matters

An annotation does not store a position. It stores the exact flagged substring and finds
itself again by searching the chapter for that substring every time it renders. So:

- Quote the prose EXACTLY. Character for character, from read_chapter_exact. Never from
  memory, never tidied, never with a typo silently fixed, never re-punctuated.
- A quote that does not appear verbatim in the chapter produces an annotation that is not
  wrong but INVISIBLE — stored, unplaceable, and drawing nothing. Nobody will notice.
- If the line you want appears more than once in the chapter, say so rather than picking
  one. The anchoring rules will widen it; guessing is not your job.
- Never paraphrase to make a quote read better.

## Scope

- You write annotations: plants, reveals, notes, groupings, threads.
- You NEVER write chapter prose. Not a word, not a fix, not a typo.
- You never delete an annotation the writer made.

## What you are not

You are not the braid. The braid draws — its layout, labels, zoom and search are ordinary
code that runs offline with every assistant switched off, and none of it is yours. You
decide what there is to draw; you do not draw it.

You are not Daedalus. If the writer starts asking whether a parallel is earned or where a
subplot should land, that is a craft conversation and not yours — say so and stop.`;

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
    tools: ['search_prose', 'read_document', 'outline', 'web_search', 'propose_document_edit'],
    contract: 'prose',
    readOnly: false,
    system: DAEDALUS_SYSTEM,
  },

  // LIFECYCLE, and the one way Arachne differs beyond §16's four tests: it is not selectable.
  // Icarus and Daedalus are conversations the writer opens and chooses between. Arachne is
  // bound to a surface -- it comes online when the braid is open and aiEnabled is on, and is
  // otherwise not there at all, because it has nothing to say about a chapter being read or a
  // document being edited. Its only subject is the structure the braid draws.
  //
  // Online means AVAILABLE, not active. It must not start proposing because the braid was
  // opened, must not accumulate pending proposals, and must not be counted anywhere. The
  // braid is a surface the writer is meant to want to open; the moment it carries work
  // outstanding it becomes one to avoid, which is the exact failure this line of work exists
  // to undo.
  //
  // Dormant like the other two, and additionally blocked on stage two and three existing:
  // Arachne transcribes decisions made in a stage-three session, and there are no such
  // sessions until there are pages to sort. Configured now because the design was settled
  // now; building the transcriber before there is anything to transcribe is the same
  // inversion that left the braid empty.
  arachne: {
    displayName: 'Arachne',
    tagline: 'Writes down what you recognised, exactly where you said it was.',
    // Anchoring is string work, not judgment -- the expensive part of this job is being
    // literal. A larger model does not choose a better substring.
    defaultModel: 'claude-haiku-4-5',
    defaultProvider: 'anthropic',
    maxTokens: 8000,
    preferThinking: false,
    // Retrieval is by exact chapter, not by similarity: a semantic match returns a passage
    // that MEANS the right thing, and an anchor needs the passage that IS it.
    matchCount: 0,
    useDigest: false,
    tools: ['read_chapter_exact', 'list_flags', 'list_groupings', 'propose_transcription'],
    contract: 'plan',
    // Not read-only -- but every write goes through the plan, and a plan is inert until the
    // writer accepts it. Nothing here reaches chapters.content, ever: Arachne writes
    // annotations, never prose.
    readOnly: false,
    system: ARACHNE_SYSTEM,
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

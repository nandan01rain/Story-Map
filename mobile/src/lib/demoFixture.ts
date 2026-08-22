// GENERATED FILE -- do not edit by hand.
// Built from demo/ by scripts/build-demo-fixture.mjs. Edit the markdown and re-run that.
//
// A disposable test project that exercises the feature set end to end: 3 acts, 17 chapters
// with real prose, per-chapter POV and scenes, and nine documents including deliberately
// unresolved continuity flags. Loaded from the app rather than pushed into the database
// from a script, because every table is behind row-level security -- writes need the
// writer's own session, which only the signed-in app has.

export type DemoScene = { order: number; title: string; summary: string; pov: string };
/** One end of a plant/reveal pair, written into the chapter's prose as an annotation. */
export type DemoAnnotation = {
  id: string;
  type: 'plant' | 'reveal';
  /** The exact flagged substring. Annotations relocate by searching for this. */
  text: string;
  /** What this end of the pair does. */
  label: string;
  /** Shared by both ends. A pair with no reveal is an unpaid plant, which is a real state. */
  pairId: string;
  pairLabel: string;
};
export type DemoChapter = {
  number: number;
  title: string;
  act: number;
  pov: string;
  content: string;
  notes: string;
  /** The chapter's stated purpose, shown when the event is expanded in Progression. */
  summary: string;
  endsOn: string;
  scenes: DemoScene[];
  annotations: DemoAnnotation[];
};
export type DemoDocument = { title: string; type: string; content: string };
export type DemoCharacter = { key: string; label: string; aliases: string[] };
export type DemoGraphEdge = {
  from: string;
  to: string;
  interactionType: string;
  valence: string;
  /** Chapter number this happened in, or null for a relationship that holds throughout. */
  chapter: number | null;
  confidence: number | null;
  /** What actually happens between them, shown when the interaction is expanded. */
  description: string;
};
/** Summary only -- the pairs themselves live in the chapters' annotations. */
export type DemoPlantRevealPair = {
  id: string;
  title: string;
  plants: number;
  reveals: number;
};
export type DemoFixture = {
  projectName: string;
  chapters: DemoChapter[];
  documents: DemoDocument[];
  characters: DemoCharacter[];
  graphEdges: DemoGraphEdge[];
  plantRevealPairs: DemoPlantRevealPair[];
};

export const DEMO_FIXTURE: DemoFixture = {
  "projectName": "The Southern Wing (Demo)",
  "chapters": [
    {
      "number": 0,
      "title": "WHAT THE COURT REMEMBERS",
      "act": 1,
      "pov": "Nagavalli",
      "content": "The court at Thanjavur smelled of camphor and crushed jasmine, and Nagavalli had danced in it since she was seven years old, long enough that she no longer thought of the smell at all, the way a fish does not think of water. She thought instead of the count beneath her feet, of the exact half-second before a turn where the whole room seemed to hold its breath with her, and of Ramanathan, three pillars to her left, watching her the way he always watched her — not like the others watched her.\n\nThe others watched a dancer. Ramanathan watched a person who happened, currently, to be dancing.\n\nThey had been careful for two years. Careful enough that even the older women who noticed everything had noticed nothing, or had noticed and said nothing, which in a court like this amounted to the same kindness. He walked her home by a different route each night. She kept, in a box she told no one about, a single dried jasmine flower from the first night he had told her, plainly, without performance, that he loved her — an admission so unlike everything else said to her in that hall, where every sentence arrived wrapped in silk and meant something other than itself.\n\nThe Karanavar of Madampalli came to the court on the ninth day of the visiting month, and Nagavalli did not think of him at all until the third night, when the court's senior dance-master came to her rooms with an expression she recognized — the particular blankness of a man delivering news he has already decided not to feel anything about.\n\nThere was no negotiation in the way stories would later tell it. There was a price, and a party who received it, and Nagavalli was not that party. She understood, with the flat clarity of someone who has always understood exactly how much power she does or does not hold, that she was being described in the same conversations as the horses and the silverware, and that objecting would change nothing except the dignity with which she was moved.\n\nShe told Ramanathan the night before she left. He said he would follow. She told him not to be foolish. He came anyway, three months later, and took a cottage on the grounds of a mansion he had no right to be near, under a name that was not quite his own, and she let him, because by then the Thekkini — the room they had given her, wide and cool and utterly, completely a cage no matter how many silk hangings softened its walls — had taught her exactly how much loneliness a person could be expected to carry before the carrying itself became a kind of death.\n\nThey were careful again. It did not matter. Trained ears in a great house learn the sound of a woman who is, for one hour of one night, no longer performing anything for anyone — and a servant loyal to the Karanavar's mother heard it, and understood it, and reported it, believing herself to be protecting the house rather than ending two lives in the telling.\n\nThe Karanavar came to the cottage first. Nagavalli would learn this only afterward, in the last minutes she had to learn anything at all — that he had gone to Ramanathan with the particular unhurried calm of a man who has already decided the shape of the evening and is merely walking through its stages, that there had been no shouting, no crime of passion in the way the word suggested a loss of control, only a decision, executed.\n\nHe came to the Thekkini after. By then his hands had stopped shaking, if they had ever shaken at all.\n\nShe did not beg. She had spent her whole life being told what to do with her body by men who had purchased the right to tell her, and in the last minute of it, she found she still had one thing that had never belonged to anyone else — the decision of what to do with her face. She did not give him fear. She gave him the same flat clarity she had given the dance-master, the understanding of exactly how much power she did or did not hold, and underneath it, so far underneath that perhaps only she ever knew it was there, something that was not quite forgiveness and was not quite its opposite either. A refusal, simply, to let the last thing she felt be his.\n\nThe anklets were still on the floor of the Thekkini three days later, when the room was sealed. No one thought to move them. No one, in the century and a half that followed, ever quite managed to think of a reason they should be moved, and so they stayed exactly where they had fallen, gathering dust in a room nobody entered, waiting — if a pair of anklets can be said to wait for anything — for someone to finally ask the right question about what, precisely, had happened in this house, and to whom, and why the answer the family told itself at dinner had never once included the word *bought*.\n\n\n---",
      "notes": "Purpose: Plant the true history in the reader's hands before the family's sanitized legend is ever told, so every later retelling of the legend reads with dramatic irony.\n\nSetup/payoff: Sets up the true-history/legend gap (paid off Ch 9); the anklets (paid off Ch 3 and Ch 13); the damaged portrait (paid off Ch 4).\n\nEnds on: The anklets, still.",
      "summary": "Plant the true history in the reader's hands before the family's sanitized legend is ever told, so every later retelling of the legend reads with dramatic irony.",
      "endsOn": "The anklets, still.",
      "annotations": [
        {
          "id": "pr-24-p0",
          "type": "plant",
          "text": "She kept, in a box she told no one about, a single dried jasmine flower from the first night he had told her, plainly, without performance, that he loved her",
          "label": "Never returned to, anywhere in the manuscript.",
          "pairId": "pr-24",
          "pairLabel": "The dried jasmine flower"
        },
        {
          "id": "pr-01-p0",
          "type": "plant",
          "text": "There was no negotiation in the way stories would later tell it. There was a price, and a party who received it, and Nagavalli was not that party.",
          "label": "The transaction stated plainly, in the only chapter with no family legend layered over it.",
          "pairId": "pr-01",
          "pairLabel": "Nagavalli was purchased, not courted"
        },
        {
          "id": "pr-02-p0",
          "type": "plant",
          "text": "that he had gone to Ramanathan with the particular unhurried calm of a man who has already decided the shape of the evening and is merely walking through its stages, that there had been no shouting, no crime of passion in the way the word suggested a loss of control, only a decision, executed.",
          "label": "The cottage first, and the calm of a man walking through stages he has already decided.",
          "pairId": "pr-02",
          "pairLabel": "Sequential, methodical murders — not one crime of passion"
        },
        {
          "id": "pr-25-p0",
          "type": "plant",
          "text": "The anklets were still on the floor of the Thekkini three days later",
          "label": "Set down where they fell, and left there for a century and a half.",
          "pairId": "pr-25",
          "pairLabel": "The anklets, the mirror, the lamp"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Thanjavur court, Nagavalli performing; Ramanathan watchin…",
          "summary": "Thanjavur court, Nagavalli performing; Ramanathan watching from the margins — established as already her partner, not a later \"seduction.\"",
          "pov": "Nagavalli"
        },
        {
          "order": 1,
          "title": "The Karanavar's visit; the transaction that removes her f…",
          "summary": "The Karanavar's visit; the transaction that removes her from the court, told plainly, without romance.",
          "pov": "Nagavalli"
        },
        {
          "order": 2,
          "title": "Arrival at Madampalli; the Thekkini as a gift that is als…",
          "summary": "Arrival at Madampalli; the Thekkini as a gift that is also a cage.",
          "pov": "Nagavalli"
        },
        {
          "order": 3,
          "title": "Ramanathan's cottage, the secret visits.",
          "summary": "Ramanathan's cottage, the secret visits.",
          "pov": "Nagavalli"
        },
        {
          "order": 4,
          "title": "The night: the Karanavar discovers them, goes to the cott…",
          "summary": "The night: the Karanavar discovers them, goes to the cottage first — controlled, methodical, not a crime of passion — then to the Thekkini.",
          "pov": "Nagavalli"
        }
      ]
    },
    {
      "number": 1,
      "title": "THE HOUSE THAT KEEPS ITS DOORS LOCKED",
      "act": 1,
      "pov": "Nakulan",
      "content": "The car turned off the main road and the tar gave way to packed red earth, and Nakulan felt the house before he saw it — a kind of pressure behind the sternum that he had never bothered to name because naming it would have meant admitting it was there.\n\n\"You're doing the thing,\" Ganga said, not looking up from the window.\n\n\"What thing.\"\n\n\"The breathing thing. Like you're about to give a speech.\"\n\nHe laughed, because it was easier than explaining that some part of him genuinely was giving a speech, silently, on a loop, to relatives who had not asked him to justify anything. *We'll be fine. It's a house. It's my house.* The gates of Madampalli Tharavad came into view at the last turn, and behind them, the mansion itself — long verandahs, a roofline broken into a dozen small additions by a dozen generations who had each needed one more room — and Nakulan felt the speech in his chest complete itself, uselessly, the way it always did.\n\nThe family was already assembling by the time they pulled in. That was the part Nakulan hadn't fully prepared Ganga for — that a simple visit could not, in this family, remain simple. Word had gone out the moment he'd mentioned staying at the tharavad instead of the town house, and within two days three separate branches of the family had decided, independently and with identical unspoken logic, that the couple could not possibly be left there alone. *Unwilling to leave them unescorted* was the phrase his aunt had actually used, on the phone, as though Nakulan were nineteen and unsupervised rather than thirty-one and married.\n\nValyammai met them at the steps. She was Nakulan's grand-aunt by a connection so old that no one bothered tracing it anymore — she was simply Valyammai, the keeper of things, and she took Ganga's hands in both of hers with a warmth that had, underneath it, something Nakulan recognized as fear wearing the shape of hospitality.\n\n\"You've come,\" Valyammai said, \"despite everyone telling your husband not to.\"\n\n\"I told them I'd be fine,\" Ganga said, smiling. \"I don't scare easy.\"\n\n\"No one scares easy,\" Valyammai said, \"until they do.\"\n\nShe told them the story that evening, formally, in the front room, with the whole assembled family present as though this were a ceremony rather than a warning — which, Nakulan understood, watching the ritual of it, it partly was. The Thekkini. The southern wing. Sealed for a hundred and fifty years, since the Karanavar Sankaran Thambi had brought a dancer named Nagavalli back from Thanjavur and discovered, too late for her, that she loved another man. The murders. The sealing of the room. The keys held, always, by the household's eldest, never touched, never spoken of lightly.\n\n\"You will not go near that door,\" Valyammai said, and though she said it to the room in general, her eyes had settled, without seeming to mean to, on Ganga.\n\nGanga received the story the way Nakulan had known she would — with an attention so polite it was almost its own kind of disrespect, nodding at the right beats, asking one clarifying question about the dates that made Valyammai visibly pleased to be taken seriously, and then, once the room had moved on to dinner, leaning close to Nakulan to murmur, \"Do you actually believe any of that?\"\n\n\"I believe the door's locked,\" Nakulan said. \"I believe that much.\"\n\n\"That's not believing the story. That's believing there's a lock.\"\n\n\"Same thing, around here.\"\n\nShe laughed, and it was a good laugh, an easy one, and Nakulan let himself relax into it, the way he'd been relaxing into her laugh for six years now — except that later, lying awake in the unfamiliar room with the unfamiliar ceiling, he found himself running the evening back and noticing, the way you notice a single wrong note in a piece of music you know well, that Ganga had gone somewhere for a moment during dinner. Not obviously. A pause between one sentence and the next, a half-second where her eyes had gone somewhere the rest of her hadn't followed, and then she'd come back and finished the sentence as though nothing had happened at all.\n\nHe told himself it was the travel. Six hours on the road did that to anyone.\n\nHe was still telling himself that when he finally slept, and did not dream, and woke the next morning to find that somewhere in the house, very early, before anyone else was up, someone had been walking the length of the portrait gallery that led toward the southern wing — he knew this only because Ganga's slippers, left neatly by the door the night before, were faintly, inexplicably, dusty.\n\n\n---",
      "notes": "Purpose: Establish the present-day family, the legend as the family tells it, and Nakulan's reasons for insisting on the visit despite warnings.\n\nSetup/payoff: The legend (payoff Ch 9); \"far-away moods\" (payoff Ch 10).\n\nEnds on: The locked door of the Thekkini, seen from outside for the first time.",
      "summary": "Establish the present-day family, the legend as the family tells it, and Nakulan's reasons for insisting on the visit despite warnings.",
      "endsOn": "The locked door of the Thekkini, seen from outside for the first time.",
      "annotations": [
        {
          "id": "pr-22-p0",
          "type": "plant",
          "text": "\"You will not go near that door,\" Valyammai said",
          "label": "The prohibition, delivered to the room and aimed at one person in it.",
          "pairId": "pr-22",
          "pairLabel": "The locked door, and Valyammai's warning"
        },
        {
          "id": "pr-03-p0",
          "type": "plant",
          "text": "he knew this only because Ganga's slippers, left neatly by the door the night before, were faintly, inexplicably, dusty.",
          "label": "She has already walked the gallery, before anyone thinks the keys are missing.",
          "pairId": "pr-03",
          "pairLabel": "Ganga's dusty slippers, night one"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Arrival at Madampalli; the extended family already assemb…",
          "summary": "Arrival at Madampalli; the extended family already assembling, unable to let the couple go alone.",
          "pov": "Nakulan"
        },
        {
          "order": 1,
          "title": "Valyammai's formal warning about the Thekkini, told in fu…",
          "summary": "Valyammai's formal warning about the Thekkini, told in full — the family version of the legend (Story Bible §1), delivered as fact.",
          "pov": "Nakulan"
        },
        {
          "order": 2,
          "title": "Ganga's visible, performative skepticism in front of the …",
          "summary": "Ganga's visible, performative skepticism in front of the family.",
          "pov": "Nakulan"
        },
        {
          "order": 3,
          "title": "A quiet aside: Nakulan's own reason for insisting on stay…",
          "summary": "A quiet aside: Nakulan's own reason for insisting on staying here — refusing to let the house's reputation run his life.",
          "pov": "Nakulan"
        },
        {
          "order": 4,
          "title": "First hint of Ganga's \"far-away moods,\" read by Nakulan a…",
          "summary": "First hint of Ganga's \"far-away moods,\" read by Nakulan as ordinary tiredness from travel.",
          "pov": "Nakulan"
        }
      ]
    },
    {
      "number": 2,
      "title": "FAR-AWAY MOODS",
      "act": 1,
      "pov": "Nakulan",
      "content": "By the third day the household had settled into a rhythm that almost let Nakulan forget the speech in his chest — mornings on the verandah with coffee going cold in the humidity, afternoons that belonged to whichever aunt had claimed Ganga for conversation, evenings that dissolved into the pleasant chaos of a large family remembering, gradually, how to be a large family in the same house again.\n\nHe found Ganga on the second-floor balcony after lunch, looking out at nothing in particular, and he watched her for a moment before she noticed him — the stillness of her, which was not, he realized, a stillness he associated with her at all. Ganga was a person who filled rooms. Even at rest she had a kind of forward motion to her, a sense that she was pausing rather than stopping. This was something else.\n\n\"Hey,\" he said, and she turned, and there it was again — that half-second delay, the eyes catching up to the face a beat after the face had already begun to smile.\n\n\"Sorry. Miles away.\"\n\n\"Where'd you go?\"\n\n\"Nowhere. Just tired.\" She stretched, deliberately, performing wakefulness for his benefit, and he let her, because pushing felt like it would cost more than it would earn. \"This house doesn't let you sleep properly. Too many creaks.\"\n\nHe almost left it there. He would spend a good deal of time later trying to reconstruct why he hadn't — some instinct, maybe, some small alarm that hadn't yet found a shape to attach itself to — and instead he sat down beside her and said, carefully, \"You've been doing that a lot. The far-away thing.\"\n\n\"Have I.\"\n\n\"Since — \" He stopped, because the sentence had a destination he wasn't sure either of them wanted to arrive at out loud. \"Since a while.\"\n\nGanga's hand moved, without her seeming to notice it moving, to rest flat against her stomach, and for a moment neither of them said anything, and the silence held the specific shape of a thing they had agreed, wordlessly, months ago, not to keep discussing — because discussing it changed nothing, and re-opening it each time cost more than either of them had left to spend. He thought of the appointment he hadn't wanted to go to, the small quiet room, the doctor's voice arranging itself into the gentlest possible register for the worst possible sentence. He thought that this, this trip, this insistence on the mansion when three relatives had told him not to — some part of it, if he was honest with himself, had been about needing somewhere to be that wasn't the flat with the room they'd stopped talking about.\n\n\"I'm fine,\" Ganga said, which was not an answer to anything he'd asked, and took her hand off her stomach as though she'd only just noticed it there.\n\nHe let it go. He was good at letting things go — it was, if he was honest, the skill his marriage most relied on, the particular talent for setting a worry down gently enough that it didn't make a sound when it landed, and picking it up again later when there was more daylight to look at it in.\n\nThat evening, on the phone to Sunny, he found himself doing exactly that — setting it down gently, dressing it in the clothes of a joke.\n\n\"You'd love it here,\" Nakulan said. \"Haunted mansion, locked wing, the whole production. My aunt gave a full dramatic reading of the legend on night one.\"\n\n\"Sounds like my kind of vacation,\" Sunny said, in that voice that made every sentence sound like it was being delivered slightly sideways, a permanent half-smile audible even over a bad connection. \"You know I did my residency partly on a dissociative disorders ward. Nothing scares me anymore. I've seen things that make your family ghost look like a light drizzle.\"\n\n\"I'm not asking you to come exorcise anything.\"\n\n\"Good, because my rates for exorcism are criminal.\" A pause, and then, in a different register — the one Nakulan recognized from a decade of friendship as the register Sunny used when he'd actually heard something under the joke. \"How's Ganga doing, though. Really.\"\n\nNakulan opened his mouth to say *fine*, and found, to his own mild surprise, that he didn't quite manage it.\n\n\"She's been somewhere else lately,\" he said instead. \"Not — not sad, exactly. Just — gone, for a second, and then back, like nothing happened.\"\n\n\"Probably just tired,\" Sunny said, easily, and Nakulan agreed, because it was the explanation that let the evening continue, and hung up telling himself the same thing he'd been telling himself since the balcony — that this was ordinary, that marriages absorbed silences like this all the time, that six hours of travel and a grieving that had never been properly allowed to finish grieving were more than enough to explain a woman staring at nothing for half a second before catching herself.\n\nHe did not yet know how soon he would be asking Sunny the same question again, in person, with considerably less room left for easy explanations.\n\n\n---",
      "notes": "Purpose: Deepen Nakulan and Ganga's marriage; establish his friendship with Sunny early so his later summons doesn't feel mechanical; plant Ganga's undisclosed grief.\n\nSetup/payoff: Sunny's eventual summons; the melancholy red herring (paid off/debunked Ch 10); the undisclosed grief.\n\nEnds on: Ganga's hand, briefly, resting on her own stomach without seeming to notice she's done it.",
      "summary": "Deepen Nakulan and Ganga's marriage; establish his friendship with Sunny early so his later summons doesn't feel mechanical; plant Ganga's undisclosed grief.",
      "endsOn": "Ganga's hand, briefly, resting on her own stomach without seeming to notice she's done it.",
      "annotations": [
        {
          "id": "pr-04-p0",
          "type": "plant",
          "text": "that half-second delay, the eyes catching up to the face a beat after the face had already begun to smile.",
          "label": "The first visible trace of the alter, dressed as tiredness.",
          "pairId": "pr-04",
          "pairLabel": "Ganga's far-away lapses"
        },
        {
          "id": "pr-05-p0",
          "type": "plant",
          "text": "Ganga's hand moved, without her seeming to notice it moving, to rest flat against her stomach",
          "label": "The undisclosed grief, gestured at and never named.",
          "pairId": "pr-05",
          "pairLabel": "The hand on the stomach"
        },
        {
          "id": "pr-06-p0",
          "type": "plant",
          "text": "You know I did my residency partly on a dissociative disorders ward. Nothing scares me anymore.",
          "label": "The diagnosis is in his mouth in Chapter 2, as a joke, eight chapters before he means it.",
          "pairId": "pr-06",
          "pairLabel": "Sunny's dissociative-ward joke"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "A quiet domestic scene; Nakulan notices Ganga somewhere e…",
          "summary": "A quiet domestic scene; Nakulan notices Ganga somewhere else entirely for several seconds, snapping back as if nothing happened.",
          "pov": "Nakulan"
        },
        {
          "order": 1,
          "title": "A brief, deflected exchange about a recent loss — kept va…",
          "summary": "A brief, deflected exchange about a recent loss — kept vague enough not to name it outright (see Patch 1).",
          "pov": "Nakulan"
        },
        {
          "order": 2,
          "title": "Nakulan mentions Sunny by name, establishing the friendsh…",
          "summary": "Nakulan mentions Sunny by name, establishing the friendship and the fact that Sunny is \"the person you call when something's wrong that a doctor here won't understand.\"",
          "pov": "Nakulan"
        },
        {
          "order": 3,
          "title": "Family gossip overheard: comparisons of Ganga to a relati…",
          "summary": "Family gossip overheard: comparisons of Ganga to a relative with a history of \"melancholy\" — the red herring the family will lean on later.",
          "pov": "Nakulan"
        }
      ]
    },
    {
      "number": 3,
      "title": "THE KEY",
      "act": 1,
      "pov": "Sridevi",
      "content": "Sridevi noticed things. It was not a virtue she had cultivated so much as a habit she had backed into, the way a person backs into a corner of a crowded room without deciding to — she had grown up slightly to the side of this family's attention, close enough to be included, never quite close enough to be the center of anything, and a person in that position learns, without meaning to, to watch.\n\nSo she noticed, on the fourth afternoon, that Ganga had found Alli alone by the well and was speaking to her in the low, quick voice of someone building a case rather than having a conversation.\n\nShe did not mean to overhear. She had come out to the courtyard for exactly the reason everyone came out to the courtyard at that hour, for air, and the two of them had simply not seen her in the shade of the tamarind tree, and by the time she understood what she was hearing it seemed ruder to announce herself than to stay quiet and let the moment finish.\n\n\"—not even asking you to go in with me,\" Ganga was saying. \"Just the keys. Ten minutes.\"\n\n\"If Valyammai finds out—\"\n\n\"She won't. And even if she does, what's she going to do, lock me in the room I already wanted to see?\" Ganga laughed, and Alli, visibly flattered to be trusted with something, laughed too, the particular laugh of a young person being included in an older person's daring.\n\nSridevi should have said something. She turned this over many times in the days that followed — the specific, exact point at which speaking up would have changed anything — and never arrived at a satisfying answer, because the honest truth was that some part of her had wanted to see what would happen too, a small, private, unadmitted curiosity that made her complicit in her own silence.\n\nShe watched them go, an hour later, from the upstairs window — Alli carrying the ring of iron keys with the particular walk of someone trying to look like they are not carrying something forbidden, Ganga beside her, unhurried, almost serene. They went around by the outer path, past the portrait gallery, to the Thekkini's own door, separate from the house, exactly as the legend described it — sealed, its own small building really, grafted onto the main structure a century and a half ago and never fully reabsorbed.\n\nThe lock was old and stiff and took both of them working it before it gave.\n\nSridevi came down, eventually, unable to stay upstairs pretending to read. She found the door standing open and the two of them just inside, and neither of them turned at the sound of her footsteps, because both of them were looking at the room the way people look at something they had been told to imagine and had imagined wrong.\n\nIt was smaller than the legend suggested. That was Sridevi's first thought, standing in the doorway — a room, not a stage, not a mausoleum, just a room, dust thick as felt across every surface, a narrow bed frame long since stripped of anything soft, a cracked mirror that had lost most of its silvering, and, near the foot of the bed, a pair of anklets, tarnished black, exactly where — Sridevi found herself thinking, with no evidence for the thought at all — exactly where someone had set them down for the last time.\n\n\"It's just a room,\" Alli said, in the voice of someone trying to convince herself.\n\nGanga didn't answer. She had crossed to the anklets and crouched beside them, not touching, just looking, with an expression Sridevi would spend a long time afterward trying to name and never quite managing — not fear, not the theatrical fascination of someone enjoying a ghost story, but something closer to recognition, the specific stillness of a person remembering something they had never actually experienced.\n\n\"We should go,\" Sridevi said. \"Before anyone notices.\"\n\n\"In a minute.\" Ganga's voice had changed slightly — not dramatically, nothing Sridevi could have pointed to and called wrong, just a fraction lower, a fraction slower.\n\nThey relocked the door. They walked back around by the outer path, the three of them silent in a way that felt, to Sridevi, less like guilt than like something none of them had the vocabulary yet to discuss. At the corner where the path rejoined the main courtyard, Ganga stopped for a moment, alone for just a few seconds while Alli hurried ahead with the keys, and Sridevi — three steps behind, unnoticed again, the position she was used to — heard her say something under her breath. A few words, low, in a cadence that was almost but not quite the Tamil the household used, the accent slightly wrong, the kind of wrong that comes from a language learned by ear rather than lived in.\n\nSridevi didn't ask what it meant. She wasn't certain, afterward, that Ganga had known she'd said it at all, and something about that — about a person speaking words they didn't seem to know they knew — sat in Sridevi's chest for the rest of the day, a small cold weight she couldn't name and, being who she was, did not mention to anyone.\n\nShe wrote it down that night instead, in the notebook she kept for nothing in particular, a habit she'd never examined until much later, when it turned out to be the only thing standing between her and disaster: *G. said something in the Thekkini. Not sure what. Didn't sound like her.*\n\n\n---",
      "notes": "Purpose: Ganga's transgression; introduce Sridevi properly and establish her as a careful observer from her very first POV chapter.\n\nSetup/payoff: The anklets and mirror (payoff Ch 7, Ch 13); Sridevi's habit of quiet observation (payoff Ch 8, Ch 11).\n\nEnds on: Ganga, alone a moment, whispering a phrase in Tamil she has no memory of having learned.",
      "summary": "Ganga's transgression; introduce Sridevi properly and establish her as a careful observer from her very first POV chapter.",
      "endsOn": "Ganga, alone a moment, whispering a phrase in Tamil she has no memory of having learned.",
      "annotations": [
        {
          "id": "pr-09-p0",
          "type": "plant",
          "text": "Sridevi noticed things. It was not a virtue she had cultivated so much as a habit she had backed into, the way a person backs into a corner of a crowded room without deciding to — she had grown up slightly to the side of this family's attention, close enough to be included, never quite close enough to be the center of anything, and a person in that position learns, without meaning to, to watch.",
          "label": "Established as temperament long before it becomes useful.",
          "pairId": "pr-09",
          "pairLabel": "Sridevi's habit of quiet observation"
        },
        {
          "id": "pr-25-p1",
          "type": "plant",
          "text": "a cracked mirror that had lost most of its silvering, and, near the foot of the bed, a pair of anklets, tarnished black",
          "label": "Seen again, close up — and then not used.",
          "pairId": "pr-25",
          "pairLabel": "The anklets, the mirror, the lamp"
        },
        {
          "id": "pr-07-p0",
          "type": "plant",
          "text": "heard her say something under her breath. A few words, low, in a cadence that was almost but not quite the Tamil the household used, the accent slightly wrong",
          "label": "A language learned by ear rather than lived in — the tell that it was performed at her, not inherited.",
          "pairId": "pr-07",
          "pairLabel": "The unfamiliar Tamil phrase"
        },
        {
          "id": "pr-08-p0",
          "type": "plant",
          "text": "G. said something in the Thekkini. Not sure what. Didn't sound like her.",
          "label": "The record begins the day of the key theft, before anyone knows there is anything to record.",
          "pairId": "pr-08",
          "pairLabel": "Sridevi's first notebook entry"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Sridevi witnesses Ganga persuading Alli to help steal the…",
          "summary": "Sridevi witnesses Ganga persuading Alli to help steal the keys — recounts it faithfully, without embellishment, already the book's most reliable narrator.",
          "pov": "Sridevi"
        },
        {
          "order": 1,
          "title": "The theft itself; the Thekkini's external door, used spec…",
          "summary": "The theft itself; the Thekkini's external door, used specifically so they needn't cross the main house.",
          "pov": "Sridevi"
        },
        {
          "order": 2,
          "title": "Inside: the anklets, the lamp, the cracked mirror — Ganga…",
          "summary": "Inside: the anklets, the lamp, the cracked mirror — Ganga's reaction is curiosity, not fear, and specifically a *recognition* she can't explain to herself.",
          "pov": "Sridevi"
        },
        {
          "order": 3,
          "title": "They relock the room; nobody else knows yet.",
          "summary": "They relock the room; nobody else knows yet.",
          "pov": "Sridevi"
        }
      ]
    },
    {
      "number": 4,
      "title": "THE EYES THAT FOLLOW",
      "act": 1,
      "pov": "Nakulan",
      "content": "The portrait gallery ran the length of the covered walkway connecting the main house to the outer door of the Thekkini, a corridor Nakulan had walked a thousand times as a child without ever once looking properly at what hung on its walls. He looked now, because Valyammai had stopped in front of one particular frame with an expression that made him stop too.\n\nIt was a portrait of a man in old-fashioned dress, dignified, unremarkable, except that someone, at some point — no one could say when, no one seemed to want to guess — had taken a blade or a nail to the lower third of the canvas, a long diagonal slash through the painted hands, crudely repaired with backing cloth that had itself gone dark with age.\n\n\"Who is he?\" Nakulan asked.\n\n\"Does it matter which one,\" Valyammai said, which was not an answer, and moved on before he could press her, though he noticed, following her gaze back once over his shoulder, that she had crossed herself in the small unconscious way she did before entering the shrine room, a gesture she had clearly not meant him to see.\n\nHe asked his uncle later, over tea, in the deliberately casual tone he'd been practicing all day. His uncle waved a hand.\n\n\"Old damage. Before my time. You know how these houses are — every wall's got a hundred and fifty years of somebody's temper in it somewhere.\"\n\nIt was the kind of answer that closed a subject rather than actually addressing it, and Nakulan let it close, the way he let most things close in this house, and did not think about the portrait again until that evening, when the first glass shattered.\n\nIt was nothing, at first. A tumbler on the dining table, standing undisturbed, no one within arm's reach, simply — cracked, cleanly, in a way that made half the table jump and the other half exchange the particular look of people who have all just silently agreed not to say the word they are all thinking. His aunt blamed the heat, the old glass, a hairline flaw invisible until the moment it wasn't. It was, Nakulan thought, a perfectly reasonable explanation, and he watched her repeat it three times over the course of the meal, with the specific insistence of someone convincing herself rather than anyone else.\n\nThe second one, an hour later, was harder to explain away — a framed photograph in the front room, sliding, by no mechanism anyone present could identify, from a shelf it had sat on for years, to shatter on the floor precisely as Valyammai walked past it, close enough that she flinched back with a small cry that silenced the whole room.\n\n\"The wind,\" someone offered, though the evening was still, and everyone in the room knew it was still, and no one corrected the suggestion because correcting it would have meant admitting there was nothing left to blame.\n\nNakulan found Ganga afterward, sitting very still on the edge of their bed, and for a long moment neither of them spoke.\n\n\"You heard the glass,\" he said.\n\n\"I heard it.\"\n\n\"Where were you? When it happened.\"\n\nShe looked at him then, and something in her face made him wish immediately he hadn't asked, not because of what it said but because of what it didn't — a blankness where he'd expected either fear or reassurance, a half-second of the same far-away quality he'd noticed on the balcony, stretched now over the whole of her expression.\n\n\"I was here,\" she said. \"Reading.\"\n\nHe believed her. He wanted to believe her, which was not quite the same thing, and he sat down beside her and put his arm around her shoulders and felt her lean into it with what seemed like genuine relief, and told himself, again, that a house full of frightened people would find ghosts in ordinary breakage, that his family had spent a century and a half primed to see a story in every accident, that this was, at bottom, simply what fear did to a room.\n\nValyammai did not sleep that night. Nakulan knew this because he passed her, near two in the morning, on his way to the kitchen for water, sitting alone in the front room with a small brass lamp lit before the shrine, her lips moving in a prayer he didn't recognize.\n\n\"You should sleep,\" he said gently.\n\n\"I checked the Thekkini's lock this evening,\" she said, not looking at him. \"Before dinner. It was disturbed. Not broken — disturbed. As though it had been opened and closed again, carefully, by someone who thought they were being careful enough.\"\n\nNakulan's stomach dropped in a way he could not, later, fully account for — some part of him already assembling the pieces his conscious mind wasn't yet willing to look at directly: Ganga's stillness, the dust on her slippers the first morning, the far-away moods, the glass.\n\n\"Who would do that,\" he said, though some part of him had already begun, quietly, to suspect.\n\nValyammai said nothing. She only looked at the small lamp, and let it burn, and did not go to bed until it had.\n\n\n---",
      "notes": "Purpose: First ambiguous incident; introduce the damaged portrait; escalate household unease without yet confirming anything supernatural.\n\nSetup/payoff: The damaged portrait (payoff Ch 9); shattering objects as an established \"symptom\" pattern (payoff Ch 10).\n\nEnds on: Valyammai discovering the disturbed lock, saying nothing to anyone yet.",
      "summary": "First ambiguous incident; introduce the damaged portrait; escalate household unease without yet confirming anything supernatural.",
      "endsOn": "Valyammai discovering the disturbed lock, saying nothing to anyone yet.",
      "annotations": [
        {
          "id": "pr-26-p0",
          "type": "plant",
          "text": "a long diagonal slash through the painted hands, crudely repaired with backing cloth that had itself gone dark with age.",
          "label": "The slash goes through the hands specifically. Ch 9's true history never reconnects to the image.",
          "pairId": "pr-26",
          "pairLabel": "The damaged ancestor portrait"
        },
        {
          "id": "pr-10-p0",
          "type": "plant",
          "text": "A tumbler on the dining table, standing undisturbed, no one within arm's reach, simply — cracked, cleanly",
          "label": "The first breakage, with a perfectly reasonable explanation already attached to it.",
          "pairId": "pr-10",
          "pairLabel": "Objects shattering with no clear cause"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "The portrait gallery, connecting the main house to the Th…",
          "summary": "The portrait gallery, connecting the main house to the Thekkini's outer door; a portrait of the historical Karanavar has a slashed or defaced section — nobody in the present generation remembers why or when.",
          "pov": "Nakulan"
        },
        {
          "order": 1,
          "title": "Household objects begin shattering inexplicably — staged …",
          "summary": "Household objects begin shattering inexplicably — staged so it's plausible as draft, structural settling, or (unconfirmed) something else.",
          "pov": "Nakulan"
        },
        {
          "order": 2,
          "title": "Valyammai's fear sharpens into open dread; she notices th…",
          "summary": "Valyammai's fear sharpens into open dread; she notices the Thekkini's lock has been disturbed.",
          "pov": "Nakulan"
        },
        {
          "order": 3,
          "title": "Ganga's mood shifts sharply and briefly at dinner — gone …",
          "summary": "Ganga's mood shifts sharply and briefly at dinner — gone before anyone can name it.",
          "pov": "Nakulan"
        }
      ]
    },
    {
      "number": 5,
      "title": "WHAT THE PUJA COULDN'T FIX",
      "act": 1,
      "pov": "Nakulan",
      "content": "By morning the theft of the keys was no longer a secret. Alli confessed before anyone had properly accused her, tearfully, to her mother first and then, inevitably, to the assembled household, and the room's reaction was not the anger Nakulan had braced for but something worse — a kind of collective, quiet dread, the sound of a great many private fears finding, all at once, a single confirmed cause.\n\n\"It's opened,\" Valyammai said, more to herself than to the room. \"It's been opened.\"\n\nThey summoned the family priest that same afternoon, a small, kind, harried man Nakulan had known his whole life, and by evening the courtyard had been swept and dressed for a purification rite — the shrine's brass lamps multiplied and lit, the particular sweet-bitter smell of camphor and incense thickening the air, the priest's voice rising and falling through verses meant, Nakulan understood only in the vaguest sense, to seal back up whatever the opened door had let loose.\n\nHe stood at the edge of it with Ganga's hand in his, and felt her hand, at some point during the third or fourth verse, go rigid.\n\n\"You okay?\"\n\n\"Fine,\" she said, too quickly, and did not look at him.\n\nThe rite ended without incident, which should have been a relief and instead only deepened the unease in the room — a ritual that produces no visible effect is, to a frightened household, not evidence of nothing happening but evidence that whatever is happening is stronger than the tools they have to address it. Valyammai's face, watching the priest gather his things, had the specific exhausted grief of someone watching a doctor fail to find the cause of a pain everyone can see is real.\n\nNakulan went to bed that night more unsettled than he'd been at any point since arriving, and woke — he would never be entirely sure how much later — to the smell of smoke.\n\nHe would spend a long time afterward trying to reconstruct the sequence properly, and never quite managing it, the memory arriving always in the same disordered fragments: Ganga, standing near the shrine room's lamps, her saree already alight along one edge, moving — not screaming, not panicking, moving with a strange deliberate slowness that was somehow more frightening than panic would have been; his own voice, shouting something, he never remembered what; someone's hands, not his, reaching her first and beating the flame out against the stone floor before it could climb past the fabric's outer layer; Ganga herself, in the aftermath, looking down at the scorched edge of the saree with an expression of genuine, uncomprehending shock, as though she were seeing the damage for the first time along with everyone else.\n\n\"I don't — \" she said, and stopped, and Nakulan, holding her, felt her trembling in a way that was entirely, convincingly real, and understood that whatever had just happened, she herself did not seem to have been present for the part of it that mattered most.\n\nThe household's fear, which had been building for days in careful, contained increments, broke open all at once. Someone — Nakulan never learned who, and was grateful, later, not to know — said the word aloud, finally, into the chaos: *possessed*. It hung there, unretractable, and Nakulan watched it land first, uncertainly, on his own wife, a dozen frightened eyes finding her and flinching away again as though the accusation were too large to actually hold in place — and then, in the scramble to find somewhere safer to put it, watched it swing instead toward Sridevi, standing a little apart from the crush of bodies with the composed, still expression she always wore, an expression that in this moment, to a room primed to see meaning in every stillness, read as something closer to unnatural calm.\n\n\"She's always so quiet about everything,\" someone murmured, and someone else agreed, and Nakulan saw the accusation take hold with the terrible speed of a rumor that has found, at last, a shape it likes.\n\nHe did not have room, that night, to defend anyone. He had Ganga shaking in his arms and a scorched saree and a household coming apart at its seams, and somewhere in the middle of it he found himself in the corridor with his phone already at his ear, Sunny's number dialing itself from the sheer momentum of having no other idea what to do.\n\n\"Nakulan?\" Sunny's voice, thick with sleep and the time difference, sharpened instantly at whatever he heard in the silence before Nakulan managed to speak. \"What's wrong.\"\n\n\"I need you to come,\" Nakulan said. \"Now. Today, if you can. Something's — \" He stopped, because every word he reached for sounded, out loud, exactly like the superstition he'd spent five days gently mocking. \"Something's wrong with Ganga. I don't know what. I need you here.\"\n\nThere was a pause on the line, brief, and then Sunny's voice again, no longer sleepy, no longer joking, the register Nakulan had learned over a decade of friendship to trust more than almost any other voice he knew.\n\n\"I'm booking a flight tonight,\" Sunny said. \"Don't let anyone touch her medication, don't let anyone perform any more rituals until I get there if you can help it, and Nakulan — whatever this is, we'll figure it out. I promise you that much.\"\n\nNakulan hung up and stood alone in the dark corridor for a long moment, the smell of smoke still faint in the air, and did not yet know how much the shape of the coming days would owe to a promise made half-asleep, across an ocean, by a man who had no idea yet just how strange the truth was going to turn out to be.\n\n\n---",
      "notes": "Purpose: First real violence; crystallize the family's fear into open supernatural belief; end Act One on the decision to summon outside help.\n\nSetup/payoff: The saree fire as the pattern's most dangerous escalation so far; Sridevi's wrongful suspicion begins here, properly, for Act Two to develop.\n\nEnds on: Nakulan on the phone, asking Sunny to come immediately. **End of Act One.**",
      "summary": "First real violence; crystallize the family's fear into open supernatural belief; end Act One on the decision to summon outside help.",
      "endsOn": "Nakulan on the phone, asking Sunny to come immediately. **End of Act One.**",
      "annotations": [
        {
          "id": "pr-23-p0",
          "type": "plant",
          "text": "The rite ended without incident, which should have been a relief and instead only deepened the unease in the room — a ritual that produces no visible effect is, to a frightened household, not evidence of nothing happening but evidence that whatever is happening is stronger than the tools they have to address it.",
          "label": "Tradition alone, and it does nothing.",
          "pairId": "pr-23",
          "pairLabel": "The failed puja against the designed rite"
        },
        {
          "id": "pr-12-p0",
          "type": "plant",
          "text": "Ganga, standing near the shrine room's lamps, her saree already alight along one edge, moving — not screaming, not panicking, moving with a strange deliberate slowness",
          "label": "Deliberate slowness where panic belongs — the detail that makes it a state, not an attack.",
          "pairId": "pr-12",
          "pairLabel": "The saree fire"
        },
        {
          "id": "pr-11-p0",
          "type": "plant",
          "text": "watched it land first, uncertainly, on his own wife, a dozen frightened eyes finding her and flinching away again as though the accusation were too large to actually hold in place — and then, in the scramble to find somewhere safer to put it, watched it swing instead toward Sridevi",
          "label": "The accusation looking for somewhere safer to land.",
          "pairId": "pr-11",
          "pairLabel": "\"Possessed\" — spoken, then redirected to Sridevi"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "The disturbed lock is discovered by the whole family; the…",
          "summary": "The disturbed lock is discovered by the whole family; the theft is out.",
          "pov": "Nakulan"
        },
        {
          "order": 1,
          "title": "A traditional purification ritual/puja is performed to ca…",
          "summary": "A traditional purification ritual/puja is performed to calm the house — fails visibly, worsening the mood rather than resolving it.",
          "pov": "Nakulan"
        },
        {
          "order": 2,
          "title": "That night: Ganga's saree catches fire near the household…",
          "summary": "That night: Ganga's saree catches fire near the household shrine's lamps — staged so it is plausible as an accident involving someone in a dissociative state near open flame, without confirming anything.",
          "pov": "Nakulan"
        },
        {
          "order": 3,
          "title": "Panic; the family's fear becomes explicit and collective …",
          "summary": "Panic; the family's fear becomes explicit and collective — someone says the word \"possessed\" aloud for the first time, aimed uncertainly at Ganga, then redirected (wrongly) toward Sridevi because of her composure in the chaos, which reads to the frightened family as unnatural calm.",
          "pov": "Nakulan"
        },
        {
          "order": 4,
          "title": "Nakulan, shaken, decides to call Sunny.",
          "summary": "Nakulan, shaken, decides to call Sunny.",
          "pov": "Nakulan"
        }
      ]
    },
    {
      "number": 6,
      "title": "THE MAN FROM AMERICA",
      "act": 2,
      "pov": "Sunny",
      "content": "Sunny had spent eleven hours on two planes and a further two in a hired car bouncing down a road that seemed to actively resent vehicles, and he arrived at Madampalli Tharavad with exactly the kind of jetlagged, wired clarity that made the household's collective dread land on him, at first, like a joke he hadn't been let in on yet.\n\n\"You must be the doctor,\" Valyammai said, at the door, in a tone that managed to be both grateful and faintly suspicious, as though a psychiatrist were a slightly disreputable variety of priest.\n\n\"I must be,\" Sunny agreed, and took her offered hands, and let himself be led, gently, dramatically, through a household so thick with fear it was almost a physical texture in the air — every face he passed carrying the specific over-brightness of people trying very hard not to look as frightened as they were.\n\nHe liked Nakulan too much to say, out loud, on arrival, what he actually thought: that a haunted-mansion story populated with a genuinely frightened family was, ninety percent of the time, a story about something entirely human wearing a costume too large for it. He'd seen this before, in a dozen forms, on a dozen wards — grief and stress finding the nearest available cultural vocabulary to express themselves in, because a mind under enough pressure will use whatever container is lying around, and this particular mind, in this particular house, had a century and a half of ready-made container sitting right there in the family's own oral history.\n\nHe kept this thought to himself and instead spent his first afternoon doing what he always did first — talking to everyone, about everything, in the loose, unthreatening way that made people forget they were being assessed. He heard the legend, twice, in two slightly different versions from two different relatives, and noted the discrepancy without comment. He met Ganga, briefly, over tea, and found her exactly as warm and quick as Nakulan had always described her, with one small addition Nakulan's descriptions had never quite captured — a half-second lag, once, mid-sentence, gone before he could be certain he'd seen it at all.\n\nHe met Sridevi last, and noticed, before he'd exchanged three words with her, that she was watching the room the way he watched rooms — quietly, from the edges, cataloguing rather than participating.\n\n\"You've been keeping notes,\" he said, not quite a question.\n\nSridevi's eyes flicked to him with real surprise. \"How would you know that.\"\n\n\"You have the look of someone who writes things down.\" He smiled, to soften it. \"Occupational hazard. I have the same look.\"\n\nShe didn't answer, but she didn't deny it either, and Sunny filed the exchange away for later, the way he filed most things.\n\nThat night, past eleven, the house dissolved into a different kind of chaos. He heard it before he understood it — a scream from the corridor near the eastern rooms, and by the time he reached it, half the household already there, Alli was on the floor against the wall, shaking, and Mahadevan was crouched a few feet from her with his hands raised, palms out, in the universal posture of a man desperately proving he had done nothing.\n\n\"I didn't touch her,\" Mahadevan was saying, to a circle of faces that had already, visibly, decided otherwise. \"I heard her scream and I came running, that's all, I swear on anything you want me to swear on—\"\n\n\"You were right there,\" someone said.\n\n\"I was *right there because I ran toward the sound*, what was I supposed to do, not come—\"\n\nSunny crouched beside Alli instead of joining the argument, checked her pulse more out of habit than necessity, and asked her, gently, what had happened. Her answer came in fragments — a hand, out of the dark, at her wrist, a face she hadn't clearly seen, a smell like old flowers — and Sunny listened to all of it with the specific attention he'd trained himself to give a first account before memory had time to reorganize itself around the story everyone around it was already telling.\n\nHe noted, quietly, that Alli had described being grabbed at the wrist. He noted that Mahadevan, kneeling several feet away, had both hands empty and neither sleeve so much as creased. He noted that no one else present seemed inclined to notice either of these things, because the household had already, collectively, decided what kind of story this was, and a man standing near a frightened woman was, in that story, guilty by proximity alone.\n\nHe said none of this aloud. Not yet. He had learned, a long time ago, that being right too early in a room this frightened accomplished nothing except making the room more frightened of him too, and he needed, for now, to be trusted more than he needed to be correct out loud.\n\n\"Everyone should sleep,\" he said instead, in the easy, deflating tone that had gotten him through a hundred family meetings on a hundred psychiatric wards. \"Nothing gets solved at midnight. I'll look into it properly in the morning.\"\n\nThe crowd dispersed, unsatisfied, muttering. Mahadevan caught Sunny's eye once, on his way past, a look that was half gratitude for the postponement and half genuine bewilderment, and Sunny gave him nothing back but a small, noncommittal nod — not yet an alliance, not yet a dismissal, just a doctor filing away one more piece of a picture that was already, quietly, beginning to assemble itself into a shape he did not yet want to say out loud.\n\n\n---",
      "notes": "Purpose: Introduce Sunny at full voice; establish his method; the Alli assault incident and Mahadevan's wrongful suspicion.\n\nSetup/payoff: Mahadevan's wrongful suspicion (payoff Ch 10, when reframed as the \"Ramanathan\" projection); Sunny's noticed detail (payoff Ch 10).\n\nEnds on: Sunny asking, mildly, whether anyone actually saw what happened, and getting no clear answer.",
      "summary": "Introduce Sunny at full voice; establish his method; the Alli assault incident and Mahadevan's wrongful suspicion.",
      "endsOn": "Sunny asking, mildly, whether anyone actually saw what happened, and getting no clear answer.",
      "annotations": [
        {
          "id": "pr-09-r1",
          "type": "reveal",
          "text": "You have the look of someone who writes things down.",
          "label": "Sunny reads it off her in one line, which is how he ends up with a corroborating witness.",
          "pairId": "pr-09",
          "pairLabel": "Sridevi's habit of quiet observation"
        },
        {
          "id": "pr-13-p0",
          "type": "plant",
          "text": "He noted that Mahadevan, kneeling several feet away, had both hands empty and neither sleeve so much as creased.",
          "label": "The physical evidence nobody else in that corridor is looking at.",
          "pairId": "pr-13",
          "pairLabel": "Mahadevan's clean hands"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Sunny's arrival — wry, informal, immediately undercutting…",
          "summary": "Sunny's arrival — wry, informal, immediately undercutting the household's dread with humor the family finds either refreshing or disrespectful depending on who you ask.",
          "pov": "Sunny"
        },
        {
          "order": 1,
          "title": "His first read of the situation: treats it as a case, not…",
          "summary": "His first read of the situation: treats it as a case, not a haunting, without dismissing the family's fear as stupid.",
          "pov": "Sunny"
        },
        {
          "order": 2,
          "title": "That night: Alli is violently frightened/grabbed in a dim…",
          "summary": "That night: Alli is violently frightened/grabbed in a dim corridor; Mahadevan, found nearby, is accused — he protests his innocence loudly and is not believed.",
          "pov": "Sunny"
        },
        {
          "order": 3,
          "title": "Sunny's private read of the scene doesn't match the accus…",
          "summary": "Sunny's private read of the scene doesn't match the accusation, though he says nothing yet.",
          "pov": "Sunny"
        }
      ]
    },
    {
      "number": 7,
      "title": "MIDNIGHT IN THE THEKKINI",
      "act": 2,
      "pov": "Sunny",
      "content": "It began, as these things apparently always began in this house, near midnight — a sound drifting from the direction of the sealed wing, faint at first, easy to mistake for wind through a loose shutter, and then, as Sunny stood in the dark corridor listening with the particular stillness of a man deciding whether to trust his own ears, unmistakably a voice.\n\nSinging. In Tamil. And beneath the singing, the soft, rhythmic percussion of bare feet against stone, the unmistakable pattern of classical dance footwork, executed with a precision that made the hair on Sunny's arms rise despite every rational explanation he'd already half-assembled.\n\nHe was, notably, the only one who went toward it.\n\nThe rest of the household he passed in the corridors were frozen in doorways, candlelight flickering behind them, none willing to take the final steps toward the Thekkini's relocked door. Sunny understood the impulse and overrode it anyway, because eleven years of training had taught him that the worst thing you could do with a frightened patient — and somewhere in that locked room, whatever else was also true, there was a frightened patient — was to let the fear go uninterrupted and unwitnessed.\n\nThe door was locked. The singing continued regardless, close now, close enough that he could make out individual words, references to a betrayal, to a river of Thanjavur, to a man's hands.\n\nHe made a decision that he would later describe to Sridevi, with characteristic understatement, as *possibly not my finest clinical moment*, and spoke to the door.\n\n\"I hear you,\" he said, in Malayalam first, then, on instinct, switching to the old formal register the legend's language seemed to want. \"I am listening.\"\n\nThe singing stopped.\n\nThe silence that followed was worse than the singing had been, and into it, after a long moment, a voice answered him — a woman's voice, but wrong in some specific way he couldn't immediately name, an accent laid over an accent, cadences that didn't quite belong to any single dialect he could place.\n\n*\"Who calls himself to my door.\"*\n\nSunny had spent enough of his career adopting voices patients needed to hear that the decision, when it came, arrived almost before he'd finished thinking it — he pitched his own voice down, formal, unhurried, and answered as the only figure he suspected this voice was actually addressing.\n\n\"The one this house belongs to,\" he said, which was true enough, in the sense that it was vague enough to be anything the voice wanted it to be.\n\n*\"Then you know what you did.\"*\n\n\"Tell me,\" Sunny said, \"so I understand it as you understand it.\"\n\nAnd she told him — the version Valyammai had already told the family, but delivered now with a specificity the family's telling had never contained, details that made Sunny's clinical instincts sharpen even through the genuine unease crawling up his spine: precise turns of phrase, an intimacy with the geography of a court two hundred miles from here, a bitterness aimed not vaguely at \"betrayal\" but at one particular, specific man's decision, described with the flat certainty of someone who had been there rather than someone repeating a story told to her as a child.\n\n\"On Durgashtami,\" the voice said, when the account was finished, \"you will answer for it. I will finish what his hands began, and this time nothing will stop the blade.\"\n\nThe singing resumed, briefly, and then, as abruptly as it had started, went silent, and the corridor behind the locked door held only the ordinary small sounds of an old house settling in the dark.\n\nSunny stood there a long time before he trusted himself to move.\n\nHe did not, when he finally walked back through the frightened, candlelit corridors to his room, tell anyone what he had heard in full. He told Nakulan only that something had spoken, that it had named Durgashtami, that they had time — not much, but some — and that he needed that time to work, quietly, without the whole household's fear compounding whatever was actually happening.\n\nAlone, finally, he sat on the edge of his bed and did what he always did with a case that refused to make sense on first pass — he wrote down everything he could remember, verbatim as best he could manage, every phrase, every turn of accent, every specific historical detail the voice had offered that didn't match Valyammai's version of the legend.\n\nHe looked at the list for a long time.\n\n*Where would a person learn details this specific*, he wrote, at the bottom, and underlined it twice, *if not from someone who was actually there — or from someone who told the story to a child so many times, so vividly, that the child absorbed it whole, the way a story becomes a second skin when you're young enough for it to still be forming you.*\n\nHe did not yet have a name to put beside that sentence. He would, within the week. But that night, for the first time since he'd landed, Sunny understood that he was no longer investigating a haunting.\n\nHe was investigating a person.\n\n\n---",
      "notes": "Purpose: The book's most overtly \"haunted\" set piece, staged so it can be reread as clinical once the reader knows the truth; the Durgashtami threat is issued.\n\nSetup/payoff: The Durgashtami deadline (payoff Act Three); the vocal-persona trick (paid off again, deliberately, in Ch 12's ritual).\n\nEnds on: Sunny alone in the corridor afterward, no longer treating this as a straightforward case.",
      "summary": "The book's most overtly \"haunted\" set piece, staged so it can be reread as clinical once the reader knows the truth; the Durgashtami threat is issued.",
      "endsOn": "Sunny alone in the corridor afterward, no longer treating this as a straightforward case.",
      "annotations": [
        {
          "id": "pr-14-p0",
          "type": "plant",
          "text": "details that made Sunny's clinical instincts sharpen even through the genuine unease crawling up his spine: precise turns of phrase, an intimacy with the geography of a court two hundred miles from here",
          "label": "Accuracy no family retelling could carry.",
          "pairId": "pr-14",
          "pairLabel": "The voice's unusually accurate history"
        },
        {
          "id": "pr-15-p0",
          "type": "plant",
          "text": "\"On Durgashtami,\" the voice said, when the account was finished, \"you will answer for it. I will finish what his hands began, and this time nothing will stop the blade.\"",
          "label": "The deadline that structures the whole of Act Three.",
          "pairId": "pr-15",
          "pairLabel": "The Durgashtami deadline"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Midnight: singing and dancing in Tamil, coming from the r…",
          "summary": "Midnight: singing and dancing in Tamil, coming from the re-locked Thekkini.",
          "pov": "Sunny"
        },
        {
          "order": 1,
          "title": "Sunny goes to investigate rather than avoid it — adopts t…",
          "summary": "Sunny goes to investigate rather than avoid it — adopts the vocal persona of the historical Karanavar (a calculated risk, explained in his own head as \"give it something to talk to\") and engages the voice in dialogue.",
          "pov": "Sunny"
        },
        {
          "order": 2,
          "title": "The voice identifies itself as Nagavalli, names her griev…",
          "summary": "The voice identifies itself as Nagavalli, names her grievance, and vows to decapitate the Karanavar on the coming night of Durgashtami.",
          "pov": "Sunny"
        },
        {
          "order": 3,
          "title": "Sunny doesn't confirm or deny anything to the family afte…",
          "summary": "Sunny doesn't confirm or deny anything to the family afterward — buys himself time to investigate properly instead of reacting.",
          "pov": "Sunny"
        }
      ]
    },
    {
      "number": 8,
      "title": "LOCKED IN HER OWN ROOM",
      "act": 2,
      "pov": "Sridevi",
      "content": "The tea, when Sridevi thought about it afterward, was almost an insult in its ordinariness — a small, mundane, entirely human crime dropped into the middle of a story the household had already decided belonged to ghosts.\n\nShe had carried the tray herself that morning, as she often did, up to the room where Nakulan sat going through some estate paperwork with the family's accountant, a thin, anxious man named Achuthan Pillai who had, Sridevi happened to know, been arguing bitterly with Nakulan's uncle for the better part of a week over a discrepancy in the quarterly accounts that no one had yet managed to resolve. She set the tray down, left the room, and thought nothing more of it until she heard Nakulan's cough — sharp, wrong, followed by the clatter of a cup hitting a saucer too hard — and came back to find him pale and gagging over the tray, and Sunny already there, somehow already there before anyone else had even registered the sound, tasting a drop from the spilled cup off his own fingertip with a grimace of professional recognition rather than panic.\n\n\"Not fatal,\" Sunny said, to the room at large, in the brisk voice of a man managing a crisis rather than fearing one. \"But deliberate. Someone put something in this.\"\n\nThe household's reaction was immediate, and it did not, to Sridevi's genuine astonishment, go anywhere near the accountant standing pale and silent in the doorway, nor toward the dozen other perfectly ordinary explanations a poisoning in a house full of tense family politics might have suggested. It went, instead, directly to her — because she had carried the tray, because she had been the last hand on it before it reached the table, and because, she understood only in that moment with real force, a household frightened enough will always reach for the explanation that requires the least new information, and she had, without meaning to, spent the last week building a reputation as the person who watched everything and said nothing, which frightened people mistake, with terrible ease, for the person who *does* everything and says nothing.\n\n\"She's been odd since the beginning,\" someone said. \"Too quiet.\"\n\n\"She was in the room,\" someone else said, which was true and meant nothing.\n\nShe looked to Sunny, half-expecting him to correct the room, and found instead that he was watching her with an expression she couldn't read at all — not suspicion, not quite, but something calculating, something that made her stomach drop before he even spoke.\n\n\"I think,\" Sunny said, carefully, to the room, \"it would be safest for everyone if Sridevi stayed in her quarters for now. Just until we understand what happened.\"\n\nThe betrayal of it landed harder than the accusation itself. She had, in the space of a single week, come to trust this stranger from America more than she trusted her own family, precisely because he had been the only person in the house who seemed to actually *look* at things rather than simply feeling afraid of them — and here he was, condemning her with the rest.\n\nShe did not fight it. Fighting it would only have confirmed, to a room already looking for confirmation, exactly the wrongness they wanted to see. She walked to her quarters with as much dignity as she could hold onto, and let the door close behind her, and sat on the edge of her bed in the particular silence of someone who has just been proven, to her own private satisfaction, entirely correct about how quickly this family's fear could turn on the nearest convenient target.\n\nShe did not cry. She was, if anything, too angry to cry, and the anger, once she let herself feel the shape of it, turned out to be useful — it burned off the humiliation and left behind something clearer, harder, more purposeful. She took out the notebook she had kept since the day of the key theft and opened it to a fresh page.\n\n*I did not do this,* she wrote, first, because she needed the sentence in her own handwriting where she could look at it. Then, beneath it, methodically, everything she could remember of the tea's preparation, who had been near the kitchen that morning, the argument she'd overheard three days earlier between Achuthan Pillai and Nakulan's uncle over the quarterly accounts — a detail she had noted at the time only out of habit, and now wrote out in full, underlined, because it was the one piece of information in her possession that pointed somewhere other than herself.\n\nShe did not yet know that Sunny's accusation had been, itself, a kind of shield — a calculated, uncomfortable choice to buy himself time and cover while he chased a suspicion he was not yet ready to name aloud, one that had nothing whatsoever to do with tea, or accountants, or anyone in this room but the person he trusted least to hear the truth safely.\n\nShe only knew that she had been wronged, and that being wronged, this particular time, had given her something to do with her hands besides wait — and that whatever came next, she intended to have a record of everything, in her own words, ready the moment anyone finally cared to ask her what she'd actually seen.\n\n\n---",
      "notes": "Purpose: The poisoning subplot; Sridevi wrongly confined; establish this incident as mundane and separate from the dissociative pattern (per Story Bible §3).\n\nSetup/payoff: Sridevi's written record (payoff Ch 10, when she hands it to Sunny); the accountant thread (deliberately left as texture, not resolved — [OPEN] whether to pay this off in a later patch).\n\nEnds on: Sridevi, alone, starting her notes with the sentence: \"I did not do this.\"",
      "summary": "The poisoning subplot; Sridevi wrongly confined; establish this incident as mundane and separate from the dissociative pattern (per Story Bible §3).",
      "endsOn": "Sridevi, alone, starting her notes with the sentence: \"I did not do this.\"",
      "annotations": [
        {
          "id": "pr-16-p0",
          "type": "plant",
          "text": "I did not do this,* she wrote, first, because she needed the sentence in her own handwriting where she could look at it.",
          "label": "Written for herself, with no expectation that anyone will ever read it.",
          "pairId": "pr-16",
          "pairLabel": "Sridevi's notebook opening line"
        },
        {
          "id": "pr-27-p0",
          "type": "plant",
          "text": "the argument she'd overheard three days earlier between Achuthan Pillai and Nakulan's uncle over the quarterly accounts — a detail she had noted at the time only out of habit",
          "label": "Story Bible §3 and the Continuity Timeline both specify this thread stays unresolved.",
          "pairId": "pr-27",
          "pairLabel": "The accountant thread — contradicts the planning docs"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "An unknown party attempts to poison Nakulan's tea — caugh…",
          "summary": "An unknown party attempts to poison Nakulan's tea — caught before real harm is done.",
          "pov": "Sridevi"
        },
        {
          "order": 1,
          "title": "Sunny, still gathering information and buying time, publi…",
          "summary": "Sunny, still gathering information and buying time, publicly blames Sridevi and has her confined to her quarters — a calculated, uncomfortable choice on his part, not a genuine belief.",
          "pov": "Sridevi"
        },
        {
          "order": 2,
          "title": "Sridevi's private reaction: humiliation, then a decision …",
          "summary": "Sridevi's private reaction: humiliation, then a decision to start keeping her own written account of events rather than simply enduring the suspicion.",
          "pov": "Sridevi"
        },
        {
          "order": 3,
          "title": "A brief, deliberately unresolved thread: the estate accou…",
          "summary": "A brief, deliberately unresolved thread: the estate accountant (**[OPEN]** — needs a name before drafting) had a financial dispute with Nakulan's uncle days earlier, planted as a plausible mundane suspect for the poisoning without ever being confirmed on the page.",
          "pov": "Sridevi"
        }
      ]
    },
    {
      "number": 9,
      "title": "WHAT EVOOR REMEMBERS",
      "act": 2,
      "pov": "Sunny",
      "content": "The road to Evoor was worse than the road to Madampalli had been, and Sunny spent most of the drive turning over the phrases he'd copied down from the voice in the Thekkini, looking for the thread that had brought him here in the first place — a particular cadence, a reference to a river he hadn't recognized by its modern name, a formal court register that belonged to a specific place and time far more precisely than a secondhand family legend, retold at dinner parties for six generations, had any business containing.\n\nHe found the temple first, small and old, its outer walls carrying an inscription worn nearly smooth, and beside it, on the recommendation of a temple caretaker who clearly relished the chance to talk to someone new, the house of a woman named Bhargavi Amma, whose family, the caretaker said, had served the Madampalli household for generations before the connection had quietly lapsed sometime in the last fifty years.\n\nBhargavi Amma was perhaps eighty, sharp-eyed, entirely unsurprised to be asked about the story — she had, it turned out, been asked before, occasionally, by the odd curious descendant, and had long ago made her peace with telling a version of events the great house upriver would not have thanked her for.\n\n\"They tell it as a love story gone wrong,\" she said, over tea Sunny hadn't asked for and couldn't have refused. \"The dancer, the lover, the jealous husband. It's not wrong, exactly. It's just missing the part where nobody asked her anything.\"\n\nShe told him the rest in the unhurried, matter-of-fact cadence of a story passed down not as entertainment but as correction — the transaction, not a courtship; Ramanathan already her partner before the Karanavar had ever laid eyes on her, not a seducer who stole her away; and the murders themselves, described not as a single unified act of a man undone by passion but as two separate, sequential acts, the cottage first, methodical, and only afterward, drunk and unravelling, the Thekkini.\n\n\"Why does the family's version leave that out,\" Sunny asked.\n\nBhargavi Amma looked at him with something between pity and amusement. \"Would you tell your grandchildren your great-great-grandfather planned a murder in cold blood, or would you tell them he lost his mind to love and grief? One of those you can live in the same house as. The other, you have to knock down the house.\"\n\nSunny asked, carefully, about the haunting — when it had actually begun, according to the temple's own older records rather than the family's oral telling.\n\nShe considered this for a long moment. \"Not right away,\" she said finally. \"The temple records — my grandmother used to talk about this — put the first real disturbances a good forty years after. There was some other trouble in the house around then too, something to do with a young woman who'd taken too strongly to the old dancer's story. Nobody ever wrote down exactly what became of her.\" She shrugged, an old woman's shrug, unbothered by a mystery she'd long since stopped needing solved. \"Families keep some things and lose others. That one, they lost.\"\n\nSunny drove back with the true history sitting heavy in his chest, and beneath it, a colder, sharper unease he hadn't let himself name until he was alone on the empty road with nothing else to think about. The voice in the Thekkini had used the true version — the transaction, not the courtship; the sequential murders, not the single crime of passion — details that existed nowhere in the family's own telling of the legend, details Sunny himself had only just heard for the first time from an eighty-year-old woman two villages away.\n\nWhoever, or whatever, was speaking from behind that locked door knew a version of the story the family itself did not know.\n\nThat fact alone would have supported the ghost, if Sunny were the kind of man inclined to let it. Instead it did the opposite — it narrowed, rather than widened, the field of explanation, because a genuine spirit, if such things existed, would have no particular reason to know a version of events more historically accurate than the myth built up around it. A person, though — a person who had absorbed a story not from a sanitized family dinner-table retelling but from someone who had gone to considerably more trouble, who had performed it in detail, in costume, again and again, to a child too young to know the difference between a story and a memory —\n\nSunny pulled the car over, once, on the empty road, and sat for a full minute with his hands still on the wheel, turning over a name he had not let himself think seriously about until this exact moment.\n\nGanga's far-away moods. The dust on her slippers the first morning. The hand resting, unconsciously, on her stomach. The saree fire she genuinely did not seem to remember. A childhood — he was now near certain of it, though he would need to confirm the detail directly — spent under the care of some elder relative with a documented fixation on exactly this story.\n\nHe did not yet have the full shape of it. But he had, for the first time since arriving at Madampalli, the shape of a question he actually knew how to ask, and he drove the rest of the way back in a silence that had nothing left of jetlag or performance in it at all.\n\n\n---",
      "notes": "Purpose: Fracture the legend; deliver the true 150-year-old history to both Sunny and the reader; deepen the thematic spine.\n\nSetup/payoff: The true-history/legend gap (paid off from Ch 0); the phrase-matching clue (payoff Ch 10's diagnosis scene).\n\nEnds on: Sunny, on the road back, asking himself who in the household could possibly know these specific, unrecorded details.",
      "summary": "Fracture the legend; deliver the true 150-year-old history to both Sunny and the reader; deepen the thematic spine.",
      "endsOn": "Sunny, on the road back, asking himself who in the household could possibly know these specific, unrecorded details.",
      "annotations": [
        {
          "id": "pr-01-r1",
          "type": "reveal",
          "text": "It's not wrong, exactly. It's just missing the part where nobody asked her anything.",
          "label": "Bhargavi Amma names what the family's version leaves out.",
          "pairId": "pr-01",
          "pairLabel": "Nagavalli was purchased, not courted"
        },
        {
          "id": "pr-02-r1",
          "type": "reveal",
          "text": "the murders themselves, described not as a single unified act of a man undone by passion but as two separate, sequential acts, the cottage first, methodical, and only afterward, drunk and unravelling, the Thekkini.",
          "label": "The outside record confirms the order, which is the detail the legend sands off.",
          "pairId": "pr-02",
          "pairLabel": "Sequential, methodical murders — not one crime of passion"
        },
        {
          "id": "pr-14-r1",
          "type": "reveal",
          "text": "Whoever, or whatever, was speaking from behind that locked door knew a version of the story the family itself did not know.",
          "label": "Matched against the Evoor record — and it narrows the field of explanation rather than widening it.",
          "pairId": "pr-14",
          "pairLabel": "The voice's unusually accurate history"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Sunny travels to Evoor, following a hunch from the vocal …",
          "summary": "Sunny travels to Evoor, following a hunch from the vocal cadence and specific Tamil phrasing used by the \"voice\" — a detail nobody else thought to chase.",
          "pov": "Sunny"
        },
        {
          "order": 1,
          "title": "Interviews a descendant of the household's old retainer f…",
          "summary": "Interviews a descendant of the household's old retainer family and consults a temple record.",
          "pov": "Sunny"
        },
        {
          "order": 2,
          "title": "Receives the true history (Story Bible §1): the transacti…",
          "summary": "Receives the true history (Story Bible §1): the transaction, not a romance; Ramanathan not a seducer but her already-partner; the murders as methodical rather than a single crime of passion; the mysterious forty-years-later gap before the haunting reports began.",
          "pov": "Sunny"
        },
        {
          "order": 3,
          "title": "Sunny connects the true history's details to specific phr…",
          "summary": "Sunny connects the true history's details to specific phrases the \"voice\" used in Ch 7 — phrases that match the accurate record, not the sanitized family legend, which is the first hard clinical clue that whoever is speaking learned the story from somewhere more specific and detailed than the family's telling.",
          "pov": "Sunny"
        }
      ]
    },
    {
      "number": 10,
      "title": "THE DIAGNOSIS",
      "act": 2,
      "pov": "Sunny",
      "content": "Sunny spent the night after Evoor not sleeping, which was, by this point in the trip, less a departure from routine than a continuation of it, laying every fact he had out on the small writing desk in his room the way he'd once been trained to lay out a differential diagnosis — not in order of drama, but in order of evidence.\n\nGanga's far-away moods, first noted by Nakulan before either of them had reason to think anything of it. The dust on her slippers, the very first morning, before the keys were even officially missing. The dissonance between her performed skepticism and the specific, private stillness Sunny himself had clocked over their first tea together. The hand on the stomach — Nakulan had mentioned it once, offhand, and Sunny had filed it without understanding its weight until now, and even now understood only that it pointed toward some private grief the two of them were carrying that had nothing to do with any of this and everything to do with why Nakulan had insisted on this trip in the first place. The saree fire, which Ganga genuinely did not seem to remember, staged close enough to open flame that it read, on close honest examination, far more plausibly as an accident involving a person not fully present in her own body than as an attack by anything external. The Alli incident, where the physical evidence — Mahadevan's empty, uncreased hands — had never actually supported the accusation the frightened household had rushed to make.\n\nAnd now, sitting heaviest of all: a voice behind a locked door that knew a version of a hundred-and-fifty-year-old story more historically accurate than the family's own telling — a version, Sunny was now near certain, that could only have reached Ganga through an unusually thorough, unusually immersive childhood exposure. He made the call the next morning, quietly, to a cousin of Nakulan's who remembered Ganga's upbringing well enough to confirm it: a grand-aunt on Ganga's side, now deceased, who had spent years steeped in Tamil court-dance history, who had — the cousin remembered this vividly, laughing slightly at the memory — used to perform the whole Nagavalli story for a young, rapt Ganga, in full costume, murder scene included, again and again, whenever she visited.\n\nIt was, Sunny thought, setting the phone down, one of the more thorough natural experiments in trauma transmission he had personally encountered, and he took no satisfaction whatsoever in having solved it.\n\nHe wrote out the clinical picture in full, for his own clarity as much as anything: a Dissociative Identity Disorder, an alternate identity formed young, almost certainly, around a story absorbed with unusual vividness and unusual repetition during a developmentally vulnerable period, lying largely dormant and containable for years — years during which Nakulan's \"far-away moods\" would have been its only visible trace — until the accumulated pressures of this particular trip broke its containment: the arrival at the very house the story belonged to, the family's own anxious insistence on the legend's danger, an unprocessed private grief already lowering her defenses, and finally, the literal unlocking of the room the whole story orbited.\n\nHe sought out Sridevi that evening, and found her exactly where he'd expected — alone in her quarters, notebook open on her knee, her expression, when she saw him, carrying more contempt than he felt he had any right to argue with.\n\n\"I owe you an apology,\" he said, before she could speak, \"and an explanation, and I need to ask you to trust me again after I gave you every reason not to.\"\n\nShe let him talk. He told her everything — the Evoor trip, the true history, the phrase-matching, the grand-aunt, the diagnosis — and watched her expression shift, over the course of it, from guarded anger to something more complicated, a kind of vindication that had come at a cost she hadn't asked to pay.\n\n\"You accused me to protect your investigation,\" she said, when he'd finished. Not a question.\n\n\"Yes.\"\n\n\"And it worked.\"\n\n\"It bought me the time I needed. It also wasn't fair to you, and I know that, and I'm sorry for it specifically, not just for how it turned out.\"\n\nShe was quiet for a moment, and then, instead of the argument he'd braced for, she reached for her notebook and turned it around to face him. \"I've been keeping my own record,\" she said. \"Since the day they took the keys. Every strange thing, in order, with times where I could manage them.\"\n\nSunny took the notebook and read, and felt something settle into place with the particular satisfaction of two independent lines of evidence converging on the same point — her account, built with no knowledge of his diagnosis, mapped almost exactly onto the timeline he'd assembled from the other direction.\n\n\"This is extraordinary,\" he said, and meant it entirely as a compliment. \"You'd have made a decent clinician.\"\n\n\"I'll take that as an apology accepted,\" Sridevi said, dry, but something in her posture had eased, and Sunny understood, sitting there with her notebook open between them, that whatever came next in this house, he had at least one ally in it who saw as clearly as he did — which, given what still had to happen before Durgashtami, he suspected he was going to need rather badly.\n\n\"There's a problem,\" he admitted. \"I know what's wrong with her. I don't yet know how to fix it in a way this family will actually accept.\"\n\n\"A diagnosis they don't believe,\" Sridevi said, \"isn't a cure. It's just a private truth nobody uses.\"\n\n\"Exactly that,\" Sunny said, and sat with the weight of it a long moment, because the diagnosis, however correct, was, on its own, entirely useless to a household that would never accept a psychiatric explanation on its own terms — and Durgashtami was five days away.\n\n\n---",
      "notes": "Purpose: Sunny reaches the correct diagnosis privately; confides in Sridevi; the melancholy red herring is debunked; the true nature of Ganga's condition is laid out fully for the reader.\n\nSetup/payoff: Every Act One/Two \"clue\" pays off here at once; sets up the need for a socially acceptable delivery mechanism (Ch 12).\n\nEnds on: Sunny's realization that a clinical diagnosis alone will save no one — the family will never accept it on its own terms.",
      "summary": "Sunny reaches the correct diagnosis privately; confides in Sridevi; the melancholy red herring is debunked; the true nature of Ganga's condition is laid out fully for the reader.",
      "endsOn": "Sunny's realization that a clinical diagnosis alone will save no one — the family will never accept it on its own terms.",
      "annotations": [
        {
          "id": "pr-10-r1",
          "type": "reveal",
          "text": "laying every fact he had out on the small writing desk in his room the way he'd once been trained to lay out a differential diagnosis — not in order of drama, but in order of evidence.",
          "label": "Folded into the evidence list. Note: that paragraph never names the shattering objects — this payoff is structural, not stated.",
          "pairId": "pr-10",
          "pairLabel": "Objects shattering with no clear cause"
        },
        {
          "id": "pr-04-r1",
          "type": "reveal",
          "text": "Ganga's far-away moods, first noted by Nakulan before either of them had reason to think anything of it.",
          "label": "Recognised as an early dissociative symptom rather than travel fatigue.",
          "pairId": "pr-04",
          "pairLabel": "Ganga's far-away lapses"
        },
        {
          "id": "pr-03-r1",
          "type": "reveal",
          "text": "The dust on her slippers, the very first morning, before the keys were even officially missing.",
          "label": "Read back as evidence, in Sunny's differential.",
          "pairId": "pr-03",
          "pairLabel": "Ganga's dusty slippers, night one"
        },
        {
          "id": "pr-12-r1",
          "type": "reveal",
          "text": "The saree fire, which Ganga genuinely did not seem to remember, staged close enough to open flame that it read, on close honest examination, far more plausibly as an accident involving a person not fully present in her own body than as an attack by anything external.",
          "label": "Confirmed as a dissociative-state accident.",
          "pairId": "pr-12",
          "pairLabel": "The saree fire"
        },
        {
          "id": "pr-13-r1",
          "type": "reveal",
          "text": "The Alli incident, where the physical evidence — Mahadevan's empty, uncreased hands — had never actually supported the accusation",
          "label": "Stated outright: the household convicted him by proximity.",
          "pairId": "pr-13",
          "pairLabel": "Mahadevan's clean hands"
        },
        {
          "id": "pr-14-r2",
          "type": "reveal",
          "text": "a version, Sunny was now near certain, that could only have reached Ganga through an unusually thorough, unusually immersive childhood exposure",
          "label": "The clinical conclusion drawn from it. (The supplied table lists this line under Ch 9; it is in Ch 10.)",
          "pairId": "pr-14",
          "pairLabel": "The voice's unusually accurate history"
        },
        {
          "id": "pr-07-r1",
          "type": "reveal",
          "text": "a grand-aunt on Ganga's side, now deceased, who had spent years steeped in Tamil court-dance history, who had — the cousin remembered this vividly, laughing slightly at the memory — used to perform the whole Nagavalli story for a young, rapt Ganga, in full costume",
          "label": "Traced to the grand-aunt, in costume, again and again.",
          "pairId": "pr-07",
          "pairLabel": "The unfamiliar Tamil phrase"
        },
        {
          "id": "pr-06-r1",
          "type": "reveal",
          "text": "He wrote out the clinical picture in full, for his own clarity as much as anything: a Dissociative Identity Disorder",
          "label": "The joke, made seriously.",
          "pairId": "pr-06",
          "pairLabel": "Sunny's dissociative-ward joke"
        },
        {
          "id": "pr-08-r1",
          "type": "reveal",
          "text": "she reached for her notebook and turned it around to face him. \"I've been keeping my own record,\"",
          "label": "Two independent lines of evidence converging — hers built with no knowledge of his.",
          "pairId": "pr-08",
          "pairLabel": "Sridevi's first notebook entry"
        },
        {
          "id": "pr-16-r1",
          "type": "reveal",
          "text": "her account, built with no knowledge of his diagnosis, mapped almost exactly onto the timeline he'd assembled from the other direction.",
          "label": "The record that corroborates Sunny from the opposite direction.",
          "pairId": "pr-16",
          "pairLabel": "Sridevi's notebook opening line"
        },
        {
          "id": "pr-21-p0",
          "type": "plant",
          "text": "\"This is extraordinary,\" he said, and meant it entirely as a compliment. \"You'd have made a decent clinician.\"",
          "label": "Small, collaborative, and not yet romantic.",
          "pairId": "pr-21",
          "pairLabel": "Sunny and Sridevi, working together"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Sunny reviews everything: Nakulan's \"far-away moods,\" the…",
          "summary": "Sunny reviews everything: Nakulan's \"far-away moods,\" the grand-aunt's childhood performances of the legend, the phrase-matching from Evoor, the pattern of incidents that are each independently explicable, Ganga's own hand-on-stomach tell from Ch 2.",
          "pov": "Sunny"
        },
        {
          "order": 1,
          "title": "Diagnosis, laid out in full clinical honesty: Dissociativ…",
          "summary": "Diagnosis, laid out in full clinical honesty: Dissociative Identity Disorder, with a clear etiology — the childhood exposure, the accumulated present-day stress, an alternate identity that has adopted the Nagavalli persona wholesale, including details only explicable if Ganga absorbed the deep, accurate version of the story as a child (implicating the grand-aunt's performances, not supernatural knowledge).",
          "pov": "Sunny"
        },
        {
          "order": 2,
          "title": "The melancholy-relative red herring is explicitly debunke…",
          "summary": "The melancholy-relative red herring is explicitly debunked — a different, unrelated family history that everyone had been pattern-matching onto Ganga out of fear, not evidence.",
          "pov": "Sunny"
        },
        {
          "order": 3,
          "title": "Sunny confides fully in Sridevi, the only person he trust…",
          "summary": "Sunny confides fully in Sridevi, the only person he trusts with the truth; she shares her own written record in return, and it corroborates his read precisely.",
          "pov": "Sunny"
        },
        {
          "order": 4,
          "title": "Sridevi agrees to help.",
          "summary": "Sridevi agrees to help.",
          "pov": "Sunny"
        }
      ]
    },
    {
      "number": 11,
      "title": "WHAT SRIDEVI KNEW",
      "act": 2,
      "pov": "Sridevi",
      "content": "The clearing of her name happened with less ceremony than the accusation had. Sunny brought her notebook, and his own findings about the tea — a conversation, quietly reconstructed, that placed Achuthan Pillai's movements near the kitchen at precisely the relevant window, and a financial motive nobody had bothered examining while a more satisfying suspect stood right there, already half-condemned by her own quietness — to Nakulan and Valyammai together, and laid it out plainly, without theater.\n\n\"She had nothing to do with it,\" Sunny said. \"I said what I said to buy time for an investigation that had nothing to do with tea at all, and that was unfair to her, and I'd like the record corrected properly.\"\n\nValyammai's reaction was the one Sridevi had least expected and, in the end, found hardest to forgive cleanly — not extravagant apology, not a scene, but a brisk, dignified acknowledgment, the household's version of setting a matter right without dwelling on it longer than necessary. \"You were wronged,\" Valyammai said to her, simply. \"I'm sorry for my part in it.\"\n\nIt was, Sridevi thought, exactly the kind of correction this family was capable of — clean, sincere, and slightly too quick, a household that had spent six days building a case against her disassembling it in the space of one conversation, as though the speed of the reversal could somehow make up for how easily the accusation had taken root in the first place. She accepted the apology because refusing it would have accomplished nothing, and because some part of her — she was honest enough with herself to notice it — was simply relieved to no longer be watched the way she had been watched.\n\nShe did not fully trust the household's fear not to land on someone else next. That feeling, she suspected, was not going away soon.\n\nThe reprieve, in any case, was brief, because the household's fear had not actually diminished with her vindication — it had simply found, in the days since, a fresh urgency, Durgashtami now close enough to count in days rather than weeks, and the family's response, once Sridevi's name was cleared, was to redirect the same anxious energy toward the one solution they still fully believed in.\n\n\"We're bringing in Pullattuparam Brahmadathan Namboodiri,\" Nakulan's uncle announced that evening, to the gathered family, with the particular relief of a man finally taking action rather than merely enduring events. \"He's the finest tantric expert in the district. If anyone can put this to rest properly, it's him.\"\n\nSridevi watched Sunny's face carefully at the announcement, expecting frustration, and found instead something more complicated — a flicker of surprise, followed almost immediately by something that looked, unmistakably, like relief.\n\n\"You know him,\" she said, once they were alone.\n\n\"I do,\" Sunny said, with the beginning of a smile she hadn't seen from him in days. \"Old associate. We crossed paths years ago, on a case that needed exactly this kind of cooperation and neither of us expected to find it in the other. He's not what this family thinks he is — or rather, he's exactly what they think he is, a genuine practitioner, sincere in his tradition — and he's also considerably sharper than most people give him credit for.\"\n\n\"You think he'll help you.\"\n\n\"I think,\" Sunny said, \"he might be the only person in this house capable of delivering a truth this family will actually accept — which is more than I can say for myself.\"\n\nSridevi turned this over, watching the household prepare, with visible relief, for the arrival of a solution they understood, and thought about her own five days locked away with nothing but a notebook and the particular clarity that comes from being wrongly accused and forced to sit with it. She had learned, in that time, something about how quickly this family's fear could turn, and something else, quieter, about how much she valued having finally been seen clearly by at least one person in it.\n\n\"What do you need from me,\" she asked, \"before he gets here.\"\n\nSunny looked at her for a moment, and the smile from before returned, warmer now. \"Honestly? Just what you've already given me. A clear head and an accurate record. I have a feeling we're going to need both, rather badly, in the next few days.\"\n\nThe car carrying the Namboodiri arrived at dusk two days later, unhurried, entirely unremarkable in its approach — no drama, no procession, just a modest vehicle pulling up to the gate and a tall, calm, elderly man in traditional dress stepping out with the particular economy of movement of someone who has performed this exact arrival a hundred times before and expects this occasion to be, in its own way, much like the others.\n\nSunny went to meet him first, before the family could, and Sridevi, watching from the verandah, saw the two men clasp hands with the specific warmth of an old friendship neither of them had bothered to announce, and felt, for the first time since the keys had gone missing, something that was almost, cautiously, hope.\n\n\n---",
      "notes": "Purpose: Public vindication; the elders summon the Namboodiri, setting up Act Three.\n\nSetup/payoff: The Namboodiri's arrival (Act Three); Sunny and the Namboodiri's prior history (**[OPEN]** — needs fixing before drafting).\n\nEnds on: The Namboodiri's palanquin/car arriving at the gate. **End of Act Two.**",
      "summary": "Public vindication; the elders summon the Namboodiri, setting up Act Three.",
      "endsOn": "The Namboodiri's palanquin/car arriving at the gate. **End of Act Two.**",
      "annotations": [
        {
          "id": "pr-27-r1",
          "type": "reveal",
          "text": "a conversation, quietly reconstructed, that placed Achuthan Pillai's movements near the kitchen at precisely the relevant window, and a financial motive nobody had bothered examining",
          "label": "The prose resolves it anyway. This reveal contradicts the plan — it needs a decision, not a fix.",
          "pairId": "pr-27",
          "pairLabel": "The accountant thread — contradicts the planning docs"
        },
        {
          "id": "pr-11-r1",
          "type": "reveal",
          "text": "\"She had nothing to do with it,\" Sunny said. \"I said what I said to buy time for an investigation that had nothing to do with tea at all, and that was unfair to her, and I'd like the record corrected properly.\"",
          "label": "Retracted in public, at the cost of admitting what the accusation was for.",
          "pairId": "pr-11",
          "pairLabel": "\"Possessed\" — spoken, then redirected to Sridevi"
        },
        {
          "id": "pr-17-p0",
          "type": "plant",
          "text": "Old associate. We crossed paths years ago, on a case that needed exactly this kind of cooperation and neither of us expected to find it in the other.",
          "label": "One line, so Act Three can skip a slow-build introduction. The backstory itself stays deliberately unwritten.",
          "pairId": "pr-17",
          "pairLabel": "Sunny and the Namboodiri's prior association"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "With Sunny's backing, Sridevi's written record and the tr…",
          "summary": "With Sunny's backing, Sridevi's written record and the true circumstances of the tea incident come out — she is publicly cleared.",
          "pov": "Sridevi"
        },
        {
          "order": 1,
          "title": "The family's collective relief and shame, handled without…",
          "summary": "The family's collective relief and shame, handled without anyone grovelling extensively — a brisk, dignified correction rather than a big emotional scene, in keeping with the household's reserved register.",
          "pov": "Sridevi"
        },
        {
          "order": 2,
          "title": "Meanwhile, and separately, the elders — frightened and no…",
          "summary": "Meanwhile, and separately, the elders — frightened and now doubly so with Durgashtami approaching — summon the renowned tantric expert, **Pullattuparam Brahmadathan Namboodiri**, over Sunny's mild private objection.",
          "pov": "Sridevi"
        },
        {
          "order": 3,
          "title": "Sunny recognizes the name; the two are old associates.",
          "summary": "Sunny recognizes the name; the two are old associates.",
          "pov": "Sridevi"
        }
      ]
    },
    {
      "number": 12,
      "title": "TWO TRADITIONS, ONE PLAN",
      "act": 3,
      "pov": "Sunny",
      "content": "They met privately, in the small unused study off the courtyard, after the household had gone to bed convinced that the Namboodiri's first evening had been spent in quiet contemplation and preparation. It had been spent, in fact, listening to Sunny lay out, in full and unhedged clinical detail, everything he had assembled — the diagnosis, the etiology, the grand-aunt, the phrase-matching from Evoor, the Durgashtami deadline the voice itself had issued.\n\nThe Namboodiri listened without interruption, his expression giving away nothing until Sunny had entirely finished, and then he was quiet for a long moment, turning something over.\n\n\"You believe,\" he said finally, \"that there is no spirit in that room.\"\n\n\"I believe,\" Sunny said, carefully, \"that everything I have observed is explicable without one. I'm not asking you to believe that too.\"\n\n\"No,\" the Namboodiri agreed, mild, \"you're not. Which is, I think, why I find I can work with you at all.\" He folded his hands. \"I have sat with a great many griefs in my life that called themselves spirits, doctor. I do not think you and I are describing different events. I think we are describing the same event from vantages neither of us was trained to abandon for the other's.\"\n\nSunny felt something in his chest loosen that he hadn't fully realized was tight. \"Then you'll help.\"\n\n\"I will do what I always do,\" the Namboodiri said. \"I will perform a correct and complete rite. Whether that satisfies your clinical requirements as well is, I suspect, a question of design rather than contradiction.\"\n\nThey worked through the night, the two of them, in a collaboration that Sunny would later describe — to Sridevi, and much later, in a very different context, to a version of this story he told at dinner parties for the rest of his life — as the strangest and most productive case conference of his career. The Namboodiri needed the ritual to be, in every observable particular, ritually sound: the correct invocation, the correct offerings, a confrontation staged with the correct formal gravity, a release performed in language the tradition itself would recognize as valid. Sunny needed, underneath all of it, a controlled confrontation that would give Ganga's alter the specific resolution it was seeking — a symbolic execution of the man it perceived as her murderer — without anyone actually being harmed, and a clean, decisive exit event convincing enough that the alter would genuinely believe its purpose fulfilled.\n\n\"A blade cannot fall on a man and leave him unmarked,\" the Namboodiri said, thinking aloud, \"but it can fall on something that is not the man.\"\n\n\"A substitute,\" Sunny said. \"Convincing enough to fool someone who, by that point, will be too blind with rage and ritual smoke to look closely.\"\n\n\"Smoke,\" the Namboodiri repeated, and something in his face sharpened with the specific pleasure of a craftsman recognizing a solution. \"Sacred ash and smoke, at the precise moment of the blow — I would use this regardless of your requirements, doctor. A blinding is traditional at the climax of such a rite. It happens that it is also exactly the cover you need.\"\n\nThey built the plan piece by piece through the small hours — a lifelike straw dummy, dressed and weighted to convince a blade under poor light and worse composure; a hidden lever, silent, that would allow the real man to be withdrawn and the substitute swung into place in the same motion; the timing of the ash and smoke coordinated exactly against that swap. By the time the first grey light came through the study's single window, they had, between a psychiatrist and a tantric priest, designed something that was, depending entirely on which of them you asked, either a masterwork of ritual theater or an unusually elegant piece of clinical staging.\n\n\"I want to be clear about one thing,\" Sunny said, as they finished. \"I'm not asking you to lie to your own tradition.\"\n\n\"You are not,\" the Namboodiri agreed. \"I would perform this exorcism in good faith regardless of your diagnosis, doctor. I do not know, tonight, whether what leaves this woman on Durgashtami will be a spirit or a symptom, and I find, examining my own conscience, that this is not a question I require an answer to in order to do my work well. I suspect you would say the same of yours.\"\n\nSunny thought about this for a long moment, and found, somewhat to his own surprise, that he agreed entirely.\n\n\"One more thing,\" the Namboodiri said, as they parted near dawn. \"The husband must understand, fully, what is required of him. He must not move, and he must not flinch, and he must trust two strangers with his life on the word of one old friend he has not seen in years. Can you promise me he will hold to that?\"\n\nSunny thought of Nakulan — steady, a little conflict-avoidant, a man who had spent this entire ordeal wanting desperately to do something and finding himself, at every turn, capable only of enduring — and understood that this, finally, would be his chance to do the one thing that had been asked of him from the beginning, which was simply to trust, and hold still, and let the people who loved his wife save her.\n\n\"I'll make sure of it,\" Sunny said, and meant it.\n\n\n---",
      "notes": "Purpose: The book's thematic centerpiece — Sunny and the Namboodiri's collaboration, worked out in full.\n\nSetup/payoff: Every physical element of the Ch 15 climax is planted here (the dummy, the lever, the ash/smoke).\n\nEnds on: The Namboodiri's blessing of the plan, in ritual language that means something different to him than it does to Sunny — and both of them fine with that.",
      "summary": "The book's thematic centerpiece — Sunny and the Namboodiri's collaboration, worked out in full.",
      "endsOn": "The Namboodiri's blessing of the plan, in ritual language that means something different to him than it does to Sunny — and both of them fine with that.",
      "annotations": [
        {
          "id": "pr-17-r1",
          "type": "reveal",
          "text": "I have sat with a great many griefs in my life that called themselves spirits, doctor. I do not think you and I are describing different events.",
          "label": "The collaboration is the payoff. The shared history is never elaborated.",
          "pairId": "pr-17",
          "pairLabel": "Sunny and the Namboodiri's prior association"
        },
        {
          "id": "pr-23-r1",
          "type": "reveal",
          "text": "I will perform a correct and complete rite. Whether that satisfies your clinical requirements as well is, I suspect, a question of design rather than contradiction.",
          "label": "The same rite, designed rather than merely performed. (Structural payoff — the supplied table quotes no line for this end.)",
          "pairId": "pr-23",
          "pairLabel": "The failed puja against the designed rite"
        },
        {
          "id": "pr-18-p0",
          "type": "plant",
          "text": "a lifelike straw dummy, dressed and weighted to convince a blade under poor light and worse composure; a hidden lever, silent, that would allow the real man to be withdrawn and the substitute swung into place in the same motion; the timing of the ash and smoke coordinated exactly against that swap",
          "label": "Designed on the page, in full, three chapters before it runs.",
          "pairId": "pr-18",
          "pairLabel": "The ritual mechanism — dummy, lever, ash and smoke"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Sunny and the Namboodiri meet privately; Sunny lays out t…",
          "summary": "Sunny and the Namboodiri meet privately; Sunny lays out the clinical truth in full.",
          "pov": "Sunny"
        },
        {
          "order": 1,
          "title": "The Namboodiri does not concede that Sunny's framework is…",
          "summary": "The Namboodiri does not concede that Sunny's framework is \"more true\" than his own — he simply recognizes that his own tradition's technique for a spirit's \"release\" and Sunny's clinical plan for a controlled confrontation and exit event are, mechanically, close enough to run as one ritual.",
          "pov": "Sunny"
        },
        {
          "order": 2,
          "title": "Together they design the Durgashtami ritual: a public, ce…",
          "summary": "Together they design the Durgashtami ritual: a public, ceremonially correct exorcism that is secretly staged to give Ganga's alter the confrontation and \"victory\" it needs (a symbolic execution of the Karanavar) without anyone actually getting hurt.",
          "pov": "Sunny"
        },
        {
          "order": 3,
          "title": "The mechanism is set: a lifelike straw dummy, a lever/swa…",
          "summary": "The mechanism is set: a lifelike straw dummy, a lever/swap mechanism, sacred ash and smoke as both ritual element and practical blind for the swap.",
          "pov": "Sunny"
        }
      ]
    },
    {
      "number": 13,
      "title": "THE NIGHT BEFORE",
      "act": 3,
      "pov": "Nakulan",
      "content": "They dressed the courtyard through the afternoon, the household moving with the particular purposeful energy of people finally allowed to do something with their fear instead of merely carrying it — brass lamps set in careful rows, fresh kolam patterns laid at the threshold, the low platform where, tomorrow night, the Namboodiri would sit and do whatever it was he had come to do. Nakulan watched it assemble around him and felt, underneath the general dread, a strange, specific calm he hadn't expected, because for the first time in eleven days, someone had finally told him exactly what was going to be required of him.\n\nSunny found him alone near the eastern wall, in the last quiet hour before the evening meal, and sat down beside him without preamble.\n\n\"Tomorrow night,\" Sunny said, \"you're going to be brought forward as part of the ritual. You need to trust me completely, and you need to not move, no matter what you see or hear, until I tell you it's over.\"\n\n\"You're not going to tell me what's actually going to happen.\"\n\n\"I am,\" Sunny said, \"but not all of it, and not because I don't trust you — because the less you're bracing for a specific sequence of events, the more naturally you'll hold still when it matters. I need you frightened enough to be careful and calm enough to be still. That's not a contradiction, whatever it sounds like.\"\n\nNakulan turned this over, and found, to his own mild surprise, that he did trust it — trusted Sunny the way he'd trusted him for a decade, without needing every piece of the reasoning laid out first. \"Tell me the part I need.\"\n\n\"You'll be brought to the center. There will be a moment — you'll know it when it comes — where everything happens very fast, and where you are not the one it's actually happening to, whatever it looks like from where you're standing. Hold still. Trust the ground under your feet more than what your eyes are telling you. That's all I'm asking.\"\n\nNakulan nodded, and did not ask the questions crowding behind that nod, because some part of him understood that asking them would only make the stillness Sunny needed from him harder to hold onto tomorrow.\n\nHe found Ganga afterward, in the room they'd shared for eleven days now, sitting on the edge of the bed in the particular stillness he had learned, over this trip, to watch for — not the frightening kind, not tonight, just an ordinary tiredness that made her look, for a moment, entirely like herself.\n\n\"Tomorrow,\" she said, not quite a question.\n\n\"Tomorrow.\"\n\nShe reached for his hand, and he gave it, and they sat like that for a while without speaking, because there was nothing either of them could say that would be equal to what tomorrow was actually going to require of them both, and because, Nakulan understood, some things were better held in silence than badly translated into words.\n\n\"I don't remember most of it,\" Ganga said finally. \"The glass. The fire. I know it happened. I was there, and I don't — \" She stopped, and he felt her hand tighten in his. \"I'm frightened, Nakulan. Not of the ghost. Of not knowing what I've been doing while I wasn't there for it.\"\n\n\"Whatever happens tomorrow,\" he said, \"I'm not going anywhere. Not before it, not after it. Whatever we find out.\"\n\nShe looked at him then, and something in her face eased, fractionally, the particular relief of being told a true thing rather than a comforting one, and he understood, holding her hand in the quiet room, that this — the not-knowing, the trust required to walk into tomorrow without a full accounting of what it would cost either of them — was its own kind of vow, older and plainer than the one they'd made at their wedding, and no less real for being unspoken.\n\nDown the corridor, Nakulan knew without needing to check, Valyammai was keeping her own vigil before the shrine, as she had every night since the keys went missing, and he thought, passing her door on his way to check the courtyard preparations one last time, that he understood now something about her fear he hadn't understood on the first night — that it had never really been about a ghost at all, but about a house that had spent a century and a half quietly, carefully, making sure nobody ever had to look directly at what it had cost to build.\n\nHe did not know yet how close that understanding sat to the truth Sunny had actually uncovered. He only knew that tomorrow, one way or another, something in this house was finally going to be asked to answer for itself, and that he intended to be standing exactly where he was asked to stand when it did.\n\n\n---",
      "notes": "Purpose: Rising dread; Nakulan learns he is to be the \"target\"; a last quiet scene between Nakulan and Ganga before the crisis.\n\nSetup/payoff: The emotional stakes of Ch 15's swap; Valyammai's history (ties back to Story Bible §1's [OPEN] item).\n\nEnds on: Nakulan and Ganga's hands, briefly touching, neither of them saying what they mean.",
      "summary": "Rising dread; Nakulan learns he is to be the \"target\"; a last quiet scene between Nakulan and Ganga before the crisis.",
      "endsOn": "Nakulan and Ganga's hands, briefly touching, neither of them saying what they mean.",
      "annotations": [
        {
          "id": "pr-19-p0",
          "type": "plant",
          "text": "Hold still. Trust the ground under your feet more than what your eyes are telling you. That's all I'm asking.",
          "label": "The one thing this book ever actually asks of him.",
          "pairId": "pr-19",
          "pairLabel": "Nakulan asked to trust and hold still"
        },
        {
          "id": "pr-20-p0",
          "type": "plant",
          "text": "I'm frightened, Nakulan. Not of the ghost. Of not knowing what I've been doing while I wasn't there for it.",
          "label": "The real fear, stated the night before, and it is not the ghost.",
          "pairId": "pr-20",
          "pairLabel": "Ganga fears not knowing what she has done"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Preparations for the Durgashtami ritual across the househ…",
          "summary": "Preparations for the Durgashtami ritual across the household — the ceremonial dressing of the courtyard.",
          "pov": "Nakulan"
        },
        {
          "order": 1,
          "title": "Sunny and Sridevi brief Nakulan, gently, on what's actual…",
          "summary": "Sunny and Sridevi brief Nakulan, gently, on what's actually going to happen and what his role requires of him — steady nerve, trust, and silence.",
          "pov": "Nakulan"
        },
        {
          "order": 2,
          "title": "A quiet scene between Nakulan and Ganga (her lucid self) …",
          "summary": "A quiet scene between Nakulan and Ganga (her lucid self) — neither of them naming what's coming, both aware something is.",
          "pov": "Nakulan"
        },
        {
          "order": 3,
          "title": "Valyammai's private fear, handled with dignity — she has …",
          "summary": "Valyammai's private fear, handled with dignity — she has already lost one relative to this story, generations back (**[OPEN]** — ties to the Ch 9 forty-years-later gap; needs fixing whether this is literal family history or left ambiguous).",
          "pov": "Nakulan"
        }
      ]
    },
    {
      "number": 14,
      "title": "DURGASHTAMI",
      "act": 3,
      "pov": "Sunny",
      "content": "The courtyard, by the time the lamps were fully lit, no longer looked like the mansion Sunny had arrived at eleven days before — it had become, through a day of careful preparation, something closer to a stage, though he was careful never to let that word cross his mind while the household stood assembled around it, faces lit gold and trembling in the lamplight, genuinely, entirely believing they were about to witness a spirit's reckoning.\n\nHe found his place near the edge of the gathered crowd, close enough to act, far enough not to draw attention, and watched the Namboodiri take his position at the platform's center with the unhurried gravity of a man who had done this a hundred times and intended this hundred-and-first performance to be indistinguishable from any of the others in its correctness, whatever else it happened to also be.\n\nGanga arrived flanked by two of the aunts, and Sunny watched the change happen in real time, close enough now to see it properly for the first time — not a dramatic transformation, nothing theatrical, but a subtle reorganization of posture and gaze, the eyes losing Ganga's particular quickness and gaining something older, flatter, entirely certain of itself. When she spoke, the voice was the one from behind the locked door, unmistakable now that he'd heard it twice.\n\n*\"You kept your word,\"* she said, to the Namboodiri, in the formal register Sunny had grown to recognize. *\"He is here.\"*\n\n\"He is here,\" the Namboodiri agreed, matching her register exactly, \"and the debt will be answered, as promised — but the terms remain the terms. You take what is owed you, and then you leave this body, freely, of your own will, as we agreed.\"\n\n*\"I agreed to nothing with you. I agreed to nothing with anyone. I take what is mine.\"*\n\n\"Then take it,\" the Namboodiri said, unbothered, \"and be free of it.\"\n\nMahadevan stood near the platform's edge, brought forward at Sunny's own quiet instruction earlier that day, and Sunny watched Ganga's — Nagavalli's — gaze find him and soften, entirely, into something that had nothing to do with the flat fury of a moment before, an expression of such naked private tenderness that Sunny felt, despite everything he understood clinically about what he was watching, a genuine ache in his chest at the sight of it. She crossed to him with the particular unhurried grace Sunny had heard described in the footwork behind the locked door, and Mahadevan, brave and visibly terrified in equal measure, held perfectly still exactly as instructed, and let her take his hand.\n\n*\"You waited,\"* she said, to him, in a voice gone suddenly, achingly gentle.\n\nMahadevan, who had been coached only to remain silent and still regardless of what was said to him, managed a small nod, and Sunny saw something in the alter's face — Ganga's face, wearing an expression Ganga herself had never once worn in his presence — settle, briefly, into something almost like peace, before the Namboodiri's voice called the ceremony back to its purpose.\n\n\"The one who wronged you is here,\" the Namboodiri said, gesturing, and Nakulan was brought forward from where he'd been waiting, pale, steady, exactly as instructed — not moving, trusting the ground beneath his feet, as Sunny had asked of him.\n\nThe persona's gaze swung to him, and the tenderness vanished entirely, replaced by something ancient and absolute, and Sunny, watching, felt his own pulse climb despite every clinical certainty he carried into this moment, because knowing precisely how a mechanism works does not, it turns out, entirely dampen the fear of watching it run.\n\nA blade was placed, ceremonially, formally, into her hands — a real blade, sharpened, because the Namboodiri had insisted the rite would not read as authentic to a household this frightened if the weapon itself were a prop, and Sunny had agreed, on the condition that the timing of what came next left absolutely no margin for error.\n\n*\"A hundred and fifty years,\"* the voice said, raising the blade, *\"and finally, finally, the debt is paid.\"*\n\nSunny's hand found the small mechanism concealed at his side, and he watched the blade begin its arc, and thought, in the strange suspended clarity of the final second before everything he and the Namboodiri had spent three days designing would either work exactly as planned or fail catastrophically in front of an entire terrified household, that there was no version of psychiatric training that had ever quite prepared him for this.\n\nThe blade continued its arc toward Nakulan's unmoving, trusting form, and Sunny's fingers closed on the lever.\n\n\n---",
      "notes": "Purpose: The alter fully takes over; the family witnesses the ritual begin; the last beat before the swap.\n\nSetup/payoff: Everything from Ch 12 converges.\n\nEnds on: The sword raised.",
      "summary": "The alter fully takes over; the family witnesses the ritual begin; the last beat before the swap.",
      "endsOn": "The sword raised.",
      "annotations": [
        {
          "id": "pr-13-r2",
          "type": "reveal",
          "text": "Sunny watched Ganga's — Nagavalli's — gaze find him and soften, entirely, into something that had nothing to do with the flat fury of a moment before",
          "label": "Dramatised: the alter was never attacking him. It was recognising him as Ramanathan.",
          "pairId": "pr-13",
          "pairLabel": "Mahadevan's clean hands"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Ganga fully submerges into the Nagavalli persona — staged…",
          "summary": "Ganga fully submerges into the Nagavalli persona — staged so the transition itself is the book's most overt \"possession\" beat, deliberately, right before the reveal strips it of supernatural explanation for good.",
          "pov": "Sunny"
        },
        {
          "order": 1,
          "title": "She follows Mahadevan into the ritual courtyard, perceivi…",
          "summary": "She follows Mahadevan into the ritual courtyard, perceiving him as Ramanathan.",
          "pov": "Sunny"
        },
        {
          "order": 2,
          "title": "The Namboodiri, in full ritual voice, converses with the …",
          "summary": "The Namboodiri, in full ritual voice, converses with the persona — promises her the Karanavar's death in exchange for her departure from Ganga's body, exactly as designed with Sunny.",
          "pov": "Sunny"
        },
        {
          "order": 3,
          "title": "Nakulan is brought forward.",
          "summary": "Nakulan is brought forward.",
          "pov": "Sunny"
        }
      ]
    },
    {
      "number": 15,
      "title": "THE SWAP",
      "act": 3,
      "pov": "Sunny",
      "content": "The Namboodiri moved first, exactly on the beat they had rehearsed a dozen times in the empty study, casting a great handful of sacred ash and thick ceremonial smoke directly into the path of the descending blade — ritually correct, a blinding offered as the tradition's own final mercy to a spirit about to complete its vengeance, and, in the same instant, precisely the half-second of obscured vision Sunny needed.\n\nHis hand moved with it. The lever gave way smoothly, silently, exactly as he and the Namboodiri had tested it twice the night before, and Nakulan — who had, to his eternal credit, not flinched, not moved, held the trust he'd been asked to hold with a stillness Sunny would remember for the rest of his life — was drawn backward and down through the platform's hidden seam in the same motion that swung the dressed, weighted, convincingly human shape of the substitute up into the space he had just occupied.\n\nThe blade fell.\n\nIt fell with the full, blind, absolute fury of a hundred and fifty years, and Sunny, close enough to see it clearly even through the drifting smoke, watched the persona hack at the substitute again, and again, a violence that had nowhere left to go now but through, no more restraint or ceremony left in it at all, only the raw completion of an act interrupted a century and a half ago and finally, finally allowed to finish.\n\nThe household screamed, and surged, and was held back by the ring of family members positioned exactly for this purpose, and through all of it Sunny kept his eyes on Ganga, watching for the moment, waiting for it, praying quietly to whatever god either tradition in this courtyard currently believed in that the plan held.\n\nThe blows slowed. Then stopped.\n\nFor a long moment nothing in the courtyard moved at all — the smoke settling, the lamps guttering in the sudden stillness, Ganga standing over the ruined substitute with the blade still in her hand and her chest heaving with an exertion that belonged, Sunny understood even now, entirely to someone else's grief finally spent.\n\n*\"It is done,\"* the voice said, quieter now, something in it loosening, releasing, the flat certainty of before giving way to something almost like relief. *\"It is finally done.\"*\n\nThe blade slipped from her hand and rang against the stone.\n\nShe swayed. The Namboodiri was beside her in an instant, one hand steadying her shoulder, his voice dropping into the low, formal cadence of a closing rite. \"Go freely,\" he said, \"as you were promised. The debt is paid. You are released.\"\n\nAnd then, in the space of a single indrawn breath, something in her simply — left. Sunny had no better word for it, watching it happen, clinical training notwithstanding — a visible, unmistakable departure, the flat ancient certainty draining out of her posture all at once, leaving behind only a woman collapsing, boneless with exhaustion, into the Namboodiri's steadying arm.\n\nSridevi was already moving, reaching them at nearly the same moment Sunny did, and together they lowered Ganga gently to the platform, and Sunny pressed two fingers to her wrist and found a pulse, strong, ordinary, entirely her own.\n\nHer eyes opened, slowly, and found his face first, then Sridevi's, and then, with visible effort, scanned the courtyard until they found Nakulan — alive, whole, being helped up from beneath the platform by two of his cousins, pale but entirely unhurt — and something in Ganga's face broke open with an expression of pure, uncomprehending relief that told Sunny, more clearly than any clinical marker could have, that whatever had just happened in this courtyard, the woman looking up at him now had absolutely no memory of having done it.\n\n\"What happened,\" Ganga said, her voice thin, entirely her own. \"What did I do.\"\n\nAround them the household had gone from screaming to a stunned, reverent hush, already, Sunny could see, beginning to construct the story they would tell for the rest of their lives about the night the family finally, properly, exorcised its ghost — and Sunny, kneeling on the smoke-hazed platform with his hand still on Ganga's wrist, understood that whatever he told her in the coming days about what had actually happened, tonight, in this courtyard, in front of everyone who mattered to her, she had already been given exactly the ending she needed to survive it.\n\n\"You're safe,\" he said, which was true, and, for tonight, was answer enough. \"You're safe, and it's over.\"\n\n\n---",
      "notes": "Purpose: The physical climax; the alter's exit; the immediate aftermath.\n\nSetup/payoff: Every planted mechanism from Ch 12 pays off in sequence.\n\nEnds on: Ganga, on the ground, breathing, herself.",
      "summary": "The physical climax; the alter's exit; the immediate aftermath.",
      "endsOn": "Ganga, on the ground, breathing, herself.",
      "annotations": [
        {
          "id": "pr-18-r1",
          "type": "reveal",
          "text": "casting a great handful of sacred ash and thick ceremonial smoke directly into the path of the descending blade",
          "label": "The blinding: ritually correct and operationally necessary at the same instant.",
          "pairId": "pr-18",
          "pairLabel": "The ritual mechanism — dummy, lever, ash and smoke"
        },
        {
          "id": "pr-18-r2",
          "type": "reveal",
          "text": "The lever gave way smoothly, silently",
          "label": "The swap, executed under pressure.",
          "pairId": "pr-18",
          "pairLabel": "The ritual mechanism — dummy, lever, ash and smoke"
        },
        {
          "id": "pr-19-r1",
          "type": "reveal",
          "text": "Nakulan — who had, to his eternal credit, not flinched, not moved, held the trust he'd been asked to hold with a stillness Sunny would remember for the rest of his life",
          "label": "He holds. It is the whole of his arc, paid in one sentence.",
          "pairId": "pr-19",
          "pairLabel": "Nakulan asked to trust and hold still"
        },
        {
          "id": "pr-15-r1",
          "type": "reveal",
          "text": "It fell with the full, blind, absolute fury of a hundred and fifty years",
          "label": "The blade falls, on the night it was promised for.",
          "pairId": "pr-15",
          "pairLabel": "The Durgashtami deadline"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "The Namboodiri releases smoke and sacred ash into Ganga's…",
          "summary": "The Namboodiri releases smoke and sacred ash into Ganga's face, momentarily blinding her — ritually justified, practically necessary.",
          "pov": "Sunny"
        },
        {
          "order": 1,
          "title": "Sunny, in the same instant, works the lever, swapping Nak…",
          "summary": "Sunny, in the same instant, works the lever, swapping Nakulan for a lifelike straw dummy dressed identically.",
          "pov": "Sunny"
        },
        {
          "order": 2,
          "title": "The persona, still blind with fury, hacks the dummy to pi…",
          "summary": "The persona, still blind with fury, hacks the dummy to pieces, fully convinced the Karanavar is dead.",
          "pov": "Sunny"
        },
        {
          "order": 3,
          "title": "Believing her revenge complete, the alter withdraws — Gan…",
          "summary": "Believing her revenge complete, the alter withdraws — Ganga collapses, and for the first time in the book, is simply herself, disoriented, exhausted, without memory of what just happened.",
          "pov": "Sunny"
        },
        {
          "order": 4,
          "title": "The household witnesses what looks, to them, like a succe…",
          "summary": "The household witnesses what looks, to them, like a successful exorcism.",
          "pov": "Sunny"
        }
      ]
    },
    {
      "number": 16,
      "title": "WHAT GANGA REMEMBERS",
      "act": 3,
      "pov": "Ganga",
      "content": "She remembered almost nothing of the courtyard, and everything, it turned out, of the weeks that came after — which struck her, once Sunny had finally explained it to her properly, sitting across from her in the quiet study with none of his usual jokes softening the edges of what he had to say, as its own kind of mercy, though not the kind anyone in the house would have chosen for her if they'd been asked to choose.\n\n\"You don't have her memories,\" Sunny said, gently, \"because they were never yours to have. She was a separate identity, formed a long time ago, carrying grief and knowledge that belonged to her, not to you. What you're left with is what happened to *you* — the tiredness, the gaps, the fear of not knowing. That's real. That's yours to work through.\"\n\nShe had wanted, in the first days, a different kind of explanation — something with a shape she could hold, a ghost, a curse, anything that would let her be a victim of something outside herself rather than a house divided against its own foundations — and Sunny, to his enormous credit, never once gave her the easier story just because it would have been kinder in the moment.\n\n\"There's something else,\" he said, on the third day, when she was steady enough to hear it. \"Nakulan told me. About the pregnancy.\"\n\nShe felt the old grief rise, sharp and immediate, exactly as it always did when anyone came near it, and found, to her own surprise, that she didn't want to deflect it this time, not from him, not after everything else he'd already seen of her.\n\n\"It's not what caused this,\" Sunny said, carefully. \"I want to be precise about that, because it would be easy for everyone, including you, to fold it into a single tidy story — the ghost, the grief, one thing explaining the other. It doesn't work that way. The dissociation has its own history, going back to childhood, going back to your grand-aunt's stories, told a hundred times before you were old enough to know the difference between a memory and a performance. The grief is its own wound, running in parallel, not the cause of anything, just its own real, separate pain that also, entirely reasonably, needed somewhere to go.\"\n\n\"So I'm carrying two things.\"\n\n\"You're carrying two things,\" he agreed. \"One of them, we've done what we can do about. The other one, I can't fix for you. Nobody can. You just get to grieve it properly now, finally, without a haunted house competing for the space.\"\n\nThe therapy that followed was slower and less dramatic than anything the household seemed to expect, weeks of ordinary, patient, unglamorous work that Sunny oversaw from a careful distance even after his official reason for staying had long since resolved itself, and Ganga found, somewhere in the middle of it, that she no longer needed to perform being unbothered the way she had for most of her life — that the performance itself had been part of what let the other, older grief live so long undisturbed beneath it.\n\nThe family's farewell, when it finally came, was warm and a little sheepish, six generations' worth of fear settling, awkwardly, into gratitude and unspoken apology — to her, for the fear that had briefly landed on her too; to Sridevi, more directly, for the accusation that never should have been made; to the house itself, in a way nobody quite said aloud, for finally letting something old and unexamined be looked at properly instead of simply feared.\n\nValyammai held her hands at the gate the way she had on the first day, though the fear underneath the warmth was gone now, replaced by something closer to a plain, unguarded affection. \"The room's staying open,\" Valyammai said. \"I decided. No more locking things away and hoping.\"\n\nSunny and Sridevi walked them to the car together, and Ganga, watching the two of them stand close, unhurried, comfortable in a way that hadn't existed between them two weeks earlier, felt a small private happiness on their behalf that had nothing to do with her own long recovery still ahead.\n\n\"I have a flight in three days,\" Sunny said, to Sridevi, with none of his usual deflecting humor.\n\n\"I know,\" Sridevi said.\n\n\"I was thinking,\" he said, and produced, from his jacket pocket, with a theatrical flourish that undercut the sincerity of it by perhaps ten percent and somehow made it land harder for the effort, a small ring, plainly made, clearly bought in a hurry from whatever jeweler the nearest town possessed. \"I was thinking you might consider coming with me. Or I could stay. Or we figure it out together, which I recognize is not a proposal so much as a proposal to keep proposing things until one of them works, but I wanted to ask before I lost my nerve entirely.\"\n\nSridevi laughed — a real laugh, Ganga noted, the first unguarded one she'd heard from her in weeks — and said yes, and the small courtyard erupted into the kind of noise a frightened household makes when it finally, gratefully, has something ordinary and joyful to be loud about instead.\n\nGanga watched it all from the car window as they pulled away, Nakulan's hand steady over hers, the Thekkini's door standing open behind them in the afternoon light, empty now, ordinary, a room like any other room, waiting for nothing at all.\n\n\"Okay?\" Nakulan asked.\n\n\"Not yet,\" she said, honestly, because it was, finally, safe to be honest. \"But I think I will be.\"\n\nHe nodded, and didn't press for more, and the car carried them out through the gates and onto the long red road, leaving the house and its century and a half of carefully guarded silence behind them, open now, at last, to whatever the family chose to do with the truth instead.\n\n\n---",
      "notes": "Purpose: The one chapter inside Ganga's head; her recovery under Sunny's ongoing clinical care; the family's reconciliation; the ending beats (Sridevi/Sunny).\n\nSetup/payoff: Every earlier \"far-away mood,\" hand-on-stomach, and performative-wit beat resolves here.\n\nEnds on: Ganga and Nakulan leaving the estate; the Thekkini's door, standing open now, empty, ordinary. **End of Act Three. End of book.**",
      "summary": "The one chapter inside Ganga's head; her recovery under Sunny's ongoing clinical care; the family's reconciliation; the ending beats (Sridevi/Sunny).",
      "endsOn": "Ganga and Nakulan leaving the estate; the Thekkini's door, standing open now, empty, ordinary. **End of Act Three. End of book.**",
      "annotations": [
        {
          "id": "pr-20-r1",
          "type": "reveal",
          "text": "\"You don't have her memories,\" Sunny said, gently, \"because they were never yours to have.",
          "label": "Answered honestly rather than kindly.",
          "pairId": "pr-20",
          "pairLabel": "Ganga fears not knowing what she has done"
        },
        {
          "id": "pr-05-r1",
          "type": "reveal",
          "text": "\"There's something else,\" he said, on the third day, when she was steady enough to hear it. \"Nakulan told me. About the pregnancy.\"",
          "label": "Named at last, and deliberately kept separate from the dissociation.",
          "pairId": "pr-05",
          "pairLabel": "The hand on the stomach"
        },
        {
          "id": "pr-22-r1",
          "type": "reveal",
          "text": "\"The room's staying open,\" Valyammai said. \"I decided. No more locking things away and hoping.\"",
          "label": "The prohibition withdrawn, by the person who issued it.",
          "pairId": "pr-22",
          "pairLabel": "The locked door, and Valyammai's warning"
        },
        {
          "id": "pr-21-r1",
          "type": "reveal",
          "text": "I was thinking you might consider coming with me",
          "label": "The proposal — earned across several such moments rather than declared.",
          "pairId": "pr-21",
          "pairLabel": "Sunny and Sridevi, working together"
        },
        {
          "id": "pr-21-r2",
          "type": "reveal",
          "text": "and said yes",
          "label": "Two words, after a paragraph of him not managing to ask cleanly.",
          "pairId": "pr-21",
          "pairLabel": "Sunny and Sridevi, working together"
        }
      ],
      "scenes": [
        {
          "order": 0,
          "title": "Ganga wakes with only fragments — not the alter's memorie…",
          "summary": "Ganga wakes with only fragments — not the alter's memories, but the accumulated exhaustion and the recent grief she'd been carrying underneath everything (Patch 1 material, if accepted).",
          "pov": "Ganga"
        },
        {
          "order": 1,
          "title": "Sunny explains the clinical truth to her directly and gen…",
          "summary": "Sunny explains the clinical truth to her directly and gently — the first time the diagnosis is spoken plainly to the person it's actually about, rather than around her.",
          "pov": "Ganga"
        },
        {
          "order": 2,
          "title": "A period of targeted therapy, compressed but not skipped …",
          "summary": "A period of targeted therapy, compressed but not skipped — the book should resist a magic-instant-cure ending.",
          "pov": "Ganga"
        },
        {
          "order": 3,
          "title": "The family's farewell to the couple — warm, a little shee…",
          "summary": "The family's farewell to the couple — warm, a little sheepish about the fear they'd aimed at Sridevi and, at points, at Ganga herself.",
          "pov": "Ganga"
        },
        {
          "order": 4,
          "title": "Before Sunny and Sridevi return their separate ways (his …",
          "summary": "Before Sunny and Sridevi return their separate ways (his to the US, hers staying), he proposes — a scene the text should build as earned across their small collaborative moments rather than sudden.",
          "pov": "Ganga"
        }
      ]
    }
  ],
  "documents": [
    {
      "title": "Project Overview",
      "type": "bible",
      "content": "# PROJECT OVERVIEW — DEMO / TEST DATA\n## \"The Southern Wing\" (working title)\n\n*This is a synthetic sample project built to exercise every StoryMap feature end to end. It is structurally inspired by the public-domain plot beats of a well-known 1993 Malayalam film (itself inspired by real events), expanded and reworked into original prose, structure, and additional subplot material. Names and scene detail below are original writing built on top of the bare plot skeleton, not reproduced text. Treat this whole project as disposable test fixture data — it is NOT part of the Chronocratic Saga.*\n\n**Status tags used throughout (same convention as the Saga bible):**\n- **[CANON]** — locked for this test project.\n- **[OPEN]** — flagged, not resolved — useful for testing the Continuity/contradiction-flagging feature.\n- **[PROPOSED]** — suggested, not accepted — useful for testing the patch workflow.\n\n---\n\n## STRUCTURE AT A GLANCE\n\n- **Project:** The Southern Wing (Demo)\n- **Book:** One (single-book test — no saga-level multi-book structure needed)\n- **Acts:** 3\n- **Chapters:** 17 (Ch 0–16)\n- **POV grammar [CANON]:** Third-person limited throughout, past tense, rotating between **Dr. Sunny Joseph**, **Nakulan**, and **Sridevi** chapter by chapter — deliberately *never* Ganga's POV until the final chapter, so her interiority stays a mystery to the reader exactly as it is to the family. One chapter (Ch 0, the 150-years-ago prologue) is a flashback in **Nagavalli's** POV — the only time she gets one, and it's the only \"true\" account in the book, planted early so its contradictions with the family legend pay off late.\n\n## LOGLINE\n\nA woman haunted by a dead courtesan's legend turns out to be haunting herself — and the people who love her have to figure out whether to break the spell with fire, faith, or medicine before she kills the man she loves believing him to be someone else's murderer.\n\n## THE STORY IN ONE PAGE\n\nThis is a story about which stories we're allowed to tell about pain. Three explanatory systems compete to name what's wrong with Ganga — **superstition** (a vengeful spirit), **faith** (a curse requiring ritual correction), and **medicine** (a dissociated mind protecting itself) — and the book's real trick is that all three turn out to *agree on the choreography of the cure*, even though only one of them is true. The Namboodiri doesn't fight Sunny's diagnosis; he launders it through ritual so the family can accept a truth they'd never accept from a psychiatrist alone. That's the theme: **the vessel a truth arrives in matters as much as the truth itself.**\n\nUnderneath the ghost story is a second, quieter one — a 150-year-old crime the family has spent a century and a half mythologizing into something more comfortable than what actually happened, and a present-day woman who, without knowing it, has been re-litigating that old injustice through her own body.\n\n## THREE-ACT SHAPE [CANON]\n\n- **Act One (Ch 0–5):** The legend, the arrival, the forbidden wing opened, the haunting begins. Ends with the first act of real violence (the saree fire) and the family's fear crystallizing into open supernatural belief.\n- **Act Two (Ch 6–11):** Sunny arrives, investigates, is deliberately allowed to believe the wrong things for a while; Sridevi is wrongly suspected; the poisoning incident; Sunny's trip to Evoor cracks the legend open and reveals the true history was worse, and different, than the family story. Ends with Sunny privately reaching the correct diagnosis and choosing not to say it aloud yet.\n- **Act Three (Ch 12–16):** The Namboodiri is brought in for an exorcism that is secretly a stage-managed psychiatric intervention; Durgashtami; the ritual/therapy climax; resolution and epilogue.\n\n## CENTRAL QUESTION\n\nIs Ganga's affliction supernatural, spiritual, or medical — and does the distinction matter if all three frameworks arrive at the same act of mercy?\n\n## THEMATIC SPINE [CANON]\n\n1. **Inherited trauma re-enacts itself in whoever is closest to the wound**, even generations removed and without conscious knowledge of the original event.\n2. **Legend is what a family tells itself instead of what happened.** The Evoor material (Ch 9) exists specifically to fracture this — the \"true\" history is less flattering to the Karanavar's memory than the ghost story the family prefers.\n3. **Belief systems that look opposed (tantric ritual vs. clinical psychiatry) can cooperate toward the same humane outcome without either admitting the other is right** — the Namboodiri never concedes Sunny is correct; he simply builds his ritual around Sunny's plan and lets both traditions claim the win.\n4. **Curiosity as both the trigger and the cure.** Ganga's curiosity opens the Thekkini and starts the crisis; Sunny's curiosity (the Evoor trip, the clinical patience) is what ends it. The book does not punish curiosity — it insists on pairing it with rigor.\n\n## WHAT THIS DEMO SHOULD EXERCISE\n\n- Project → Book → Act → Chapter → Scene nesting (17 chapters, 3–5 scenes each)\n- Character records with relationships, arcs, and a rotating-POV note\n- Locations (a single mansion with several distinct interior zones, plus one flashback location)\n- Plants/Reveals tracking (a long chain of small supernatural \"clues\" that are really clinical symptoms)\n- Continuity timeline (a tight ~18-day present-day timeline plus a 150-year-old backstory timeline that must not contradict it)\n- Documents (an in-world artifact — the Namboodiri's own ritual notes)\n- The patch workflow (one CANON/OPEN/PROPOSED patch resolving an open contradiction)\n"
    },
    {
      "title": "Story Bible",
      "type": "bible",
      "content": "# STORY BIBLE — THE SOUTHERN WING (DEMO)\n\n*Test fixture. Status tags: **[CANON]** / **[OPEN]** / **[PROPOSED]** as defined in the Project Overview.*\n\n---\n\n# 1. THE LEGEND (as the family tells it) [CANON]\n\n150 years before the present day, the family's patriarch — **Karanavar Sankaran Thambi** — travelled to Thanjavur on estate business and became infatuated with a celebrated court dancer, **Nagavalli**. He brought her back to the ancestral mansion, **Madampalli Tharavad**, installing her in the southern wing, the **Thekkini**, with the household's blessing (the family version omits that she had no say in the matter).\n\nNagavalli was secretly in love with a fellow dancer, **Ramanathan**, who followed her from Thanjavur and took a cottage adjoining the estate grounds to continue the affair in secret. When the Karanavar discovered the betrayal, he murdered them both in a single night — Ramanathan in the cottage, Nagavalli in the Thekkini — and had the wing sealed. Family memory holds that her spirit never left the room, and that she waits to finish what her murder interrupted.\n\nThis is the version told to children, to guests, and to Ganga on her first visit. **It is not entirely true**, and the gap between this version and what actually happened (Ch 9) is a deliberate plant.\n\n## What actually happened [CANON — revealed Ch 9]\n\nThe Evoor material recovers a different account, corroborated by an old temple record and the testimony of a descendant of the household's former retainers:\n\n- Nagavalli did not go to Madampalli willingly. She was effectively purchased — a transaction the family legend sands down into \"brought her back,\" as though she were a souvenir rather than a person with no say.\n- Ramanathan did not \"seduce her away.\" He was already her partner before the Karanavar ever saw her; the \"betrayal\" the legend condemns her for is, from any modern reading, simply the truth she never got to keep.\n- The murders were not a single unified act of righteous fury as the legend implies — the retainer's account describes the Karanavar going to the cottage first, in control, methodical; only afterward, drunk and half out of his mind, did he go to the Thekkini. **This detail matters**: it reframes Nagavalli's death from \"crime of passion\" to something closer to an execution carried out with premeditation, which is a materially uglier story than the one the family has told itself for six generations.\n- The legend blames Nagavalli's \"spirit\" for the disturbances that supposedly followed her death. The Evoor record makes no mention of a haunting until roughly forty years later — around the same period a different family member, by all accounts, developed a fixation on the story and began reporting nighttime disturbances. **[OPEN]** — deliberately left unresolved for the reader: is this an earlier echo of the same psychological pattern that will play out in Ganga, or is it simply where the ghost story picked up momentum? The book should not answer this definitively. It's there for the family (and reader) to wonder about, not for Sunny to diagnose retroactively.\n\n## Why the family prefers the legend [CANON]\n\nThe legend lets six generations avoid saying the sentence *our ancestor bought a woman, killed her lover in front of her essentially, then killed her too, and we have spent a century and a half being frightened of her instead of ashamed of him.* A vengeful ghost is a manageable, externalized fear. A murdered woman with a legitimate grievance against the family's own founder is not. The haunting is, in a sense, a story the family needed to tell in order to keep living in the house.\n\n---\n\n# 2. THE WORLD\n\n## Madampalli Tharavad [CANON]\n\nA large, old **tharavad** (ancestral joint-family estate house) in rural Kerala — verandahs, an inner courtyard, a household shrine, sprawling wings added across generations. Structurally the house should read as a character: old enough that its architecture encodes the family's history (the sealed wing, the shrine, the portrait gallery of ancestors including one conspicuously missing/damaged portrait — see Plants & Reveals).\n\n## The Thekkini (southern wing) [CANON]\n\nThe locked wing. Physically separate enough to have its own external access (so Ganga/Alli can enter without crossing the main household), heavily reinforced with an old lock the family keeps a single set of keys for, held by the eldest. Interior: preserved almost exactly as it was 150 years ago — dancer's anklets, an unlit oil lamp, a cracked mirror, Nagavalli's personal effects. The room should feel less haunted than **arrested** — time stopped mid-sentence.\n\n## Evoor [CANON]\n\nA village a half-day's travel from the estate, home to descendants of the household's old retainer families and to the temple that holds the more accurate historical record. Functions as the \"research trip\" location — the place the legend gets fact-checked.\n\n## Thanjavur (flashback only) [CANON]\n\nSeen only in Ch 0, Nagavalli's POV. The court, the dance hall, Ramanathan. Never revisited in the present-day timeline — its entire narrative job is done in one chapter.\n\n---\n\n# 3. THE HAUNTING MECHANIC — HOW GANGA'S CONDITION ACTUALLY WORKS [CANON]\n\nThis section exists so every chapter's \"supernatural\" incident can be written honestly from two angles at once — legible as a haunting to the in-world characters, and internally consistent as a clinical picture for the reader who's paying attention.\n\n**Ganga's psychological history [CANON]:**\n- As a child, Ganga was raised for several years by a grand-aunt obsessed with Tamil court-dance history and specifically with the Nagavalli story, which she performed and narrated to Ganga repeatedly, in costume, including the murder. This is disclosed gradually — first as a throwaway line in Ch 3, fully contextualized only in Sunny's Ch 10 diagnosis scene.\n- Ganga has no clinical history of \"melancholy\" the way the family assumes — that assumption is the family pattern-matching her curiosity and independence onto an old, unrelated family story about a different relative (a deliberate red herring — see Plants & Reveals).\n- The dissociative pattern was almost certainly present in a mild, containable form for years (short lapses, described by Nakulan in Ch 2 as \"her far-away moods\") before the Thekkini's opening and the accumulated stress of the visit — the family's suspicion, the isolation, an unrelated private grief she is carrying about a recent miscarriage **[PROPOSED — see Patch 1]** — pushed it into full dissociative episodes with a distinct, internally consistent alternate identity.\n\n**How the \"supernatural\" incidents actually happen [CANON]:**\n- The apparitions others report seeing are, in every case that's shown on the page, **either Ganga herself in a dissociative state seen briefly and at a distance, or ordinary environmental causes (a draft, a servant, a shadow) amplified by a household already primed to see a ghost.** The book should never show an incident that is *only* explicable supernaturally — every single one must survive a rational read on close inspection, even if no character achieves that read until Sunny does.\n- The saree fire (Ch 5) is the pattern's most dangerous escalation and must be staged so it could plausibly be Ganga herself, in a dissociative state, near an oil lamp — not an external attack.\n- The poisoning (Ch 8) is the one incident that is **not** part of the dissociative pattern at all — it's a separate, mundane subplot (see Ch 8 notes) that the household folds into the haunting narrative because by that point everything gets folded into the haunting narrative. This is intentional: it demonstrates how a frightened household's explanatory framework metastasizes to absorb unrelated events.\n\n---\n\n# 4. THE THREE EXPLANATORY SYSTEMS [CANON]\n\nThe book's structure is organized around three competing frameworks converging on the same person:\n\n1. **Superstition (the family, especially the elders):** a vengeful spirit has returned. Response: locks, wards, fear, isolating the \"possessed\" person (wrongly, Sridevi).\n2. **Faith / ritual (the Namboodiri):** a spiritual imbalance requiring correct ritual technique to resolve. The Namboodiri's genius, once revealed, is that he never publicly abandons this framework — he **operates within it** while privately building Sunny's clinical plan into its choreography.\n3. **Medicine (Sunny):** Dissociative Identity Disorder with a clearly traceable etiology. Sunny's arc is learning that being *right* is not the same as being *useful* — a clinical diagnosis delivered without the ritual's social cover would not have saved Ganga; the family would never have accepted a straightforward psychiatric intervention on its own terms.\n\n**The thesis [CANON]:** the cure required all three systems' cooperation, not medicine's victory over superstition. Nobody in the book is proven a fool for believing in the ghost. The Namboodiri is not exposed as a fraud — he's revealed as someone sophisticated enough to know which container a truth needs to travel in to be accepted.\n\n---\n\n# 5. CRAFT RULES [CANON]\n\n- **Never break POV to show Ganga's interiority before the final chapter.** The reader's uncertainty about her must exactly track the family's.\n- **Every \"supernatural\" incident must be independently explicable.** No incident is allowed onto the page that requires the ghost to be real.\n- **The Namboodiri is never played for comedy or exposed as a cynic.** He believes his own tradition; he is not secretly an atheist performing theater. He simply also recognizes what Sunny has found and chooses cooperation over turf war.\n- **Sridevi's wrongful suspicion must be airtight** in Act Two so her Ch 11 vindication and Ch 16 romantic beat land clean, mirroring the craft note on Zia's Ch 10 innocence in the Saga bible.\n- **The legend and the true history must both be internally consistent** — a reader who reread the book should be able to independently reconstruct the true Evoor history from clues seeded earlier (the missing portrait, an offhand line from an elder, the mismatched date on a temple inscription glimpsed in Ch 0).\n\n---\n\n*End of bible.*\n"
    },
    {
      "title": "Character Bible",
      "type": "character",
      "content": "# CHARACTER BIBLE — THE SOUTHERN WING (DEMO)\n\n---\n\n## GANGA\n**Role:** Nakulan's wife; unknowing host of the \"Nagavalli\" alter. The book's central mystery, deliberately never POV'd until Ch 16.\n\n**Background:** Raised partly by a grand-aunt fixated on the Nagavalli legend, who performed and narrated it to her repeatedly as a child, in costume. Bright, restless, allergic to being told what not to ask about — the trait the family reads as \"modern\" and Sunny eventually reads correctly as the same trait that made the legend take root so deep in childhood.\n\n**Psychology:** Presents as a confident skeptic — openly dismissive of the household's superstition, which is itself a defense: mocking the story keeps her from noticing how much of it lives in her. Carries an undisclosed private grief (a recent pregnancy loss, **[PROPOSED]**, see Patch 1) that the text should let the reader half-glimpse before it's confirmed.\n\n**Arc:** Curiosity → transgression (unlocking the Thekkini) → escalating dissociation → full alter takeover (Ch 13) → clinical resolution → an ending that is explicitly *not* \"cured and grateful\" but quietly exhausted and beginning to reckon with what she went through, without full memory of the alter state.\n\n**Relationships:**\n- **Nakulan** — loves him uncomplicatedly on the surface; the alter recasts him as the Karanavar, which the text should read as tragic rather than symbolic — she isn't \"really\" angry at him, the substrate trauma just needed a face.\n- **Sunny** — trusts him instinctively before either of them knows why; this should read, in hindsight, as the alter recognizing an ally.\n- **Sridevi** — genuine affection; Ganga is the one family member never suspicious of Sridevi, which the family reads as further evidence of \"possession\" (she's supposedly protecting \"her own kind\") when it's actually just Ganga being observant and fair.\n\n**Voice:** Warm, quick, faintly performative wit when in her own state — the performative quality is a plant (she's spent a life performing being unbothered).\n\n---\n\n## NAKULAN\n**Role:** Ganga's husband; heir to the Madampalli line; the present-day stand-in for the Karanavar in Ganga's dissociative frame.\n\n**Background:** Grew up partly away from the estate; inherited responsibility for it more than affection for it. Insisted on staying at the mansion against family advice — not out of bravado, but because refusing to would mean admitting the family's fear runs his life, and he's spent years trying not to be that kind of man.\n\n**Psychology:** Steady, a little conflict-avoidant, chronically underestimates how bad things are until they're undeniable (misreads Ganga's \"far-away moods\" as ordinary moodiness for most of Act One).\n\n**Arc:** Denial → alarm → helplessness (the position of \"the target\" in Act Three strips him of any active role, which should read as its own kind of suffering) → relief that curdles into guilt he can't quite name (he was, unknowingly, cast as his own ancestor's proxy for his wife's rage).\n\n**Relationships:**\n- **Ganga** — love without full understanding; his largest blind spot in the book.\n- **Sunny** — old friend, summons him out of trust rather than desperation initially; this should be established early (Ch 2) so Sunny's arrival doesn't feel like a plot mechanism.\n- **The elders** — caught between them and his wife for most of Act One and Two.\n\n---\n\n## DR. SUNNY JOSEPH\n**Role:** US-based Indian psychiatrist, Nakulan's old friend; functions as the book's investigator.\n\n**Background:** Trained and practicing in the US; eccentric by the household's standards (informal, irreverent, unbothered by hierarchy) but rigorous underneath the charm.\n\n**Psychology:** Genuinely enjoys being underestimated — lets people read him as a clown for a beat longer than necessary because it makes them drop their guard. Not cruel about it; more a professional habit than a personality flaw.\n\n**Arc:** Arrives treating this as an unusual but standard case → is forced to actually live inside the haunting (the Ch 7 midnight confrontation) → does the patient investigative work (Evoor, Ch 9) that the family never thought to do → reaches the correct diagnosis privately (Ch 10) → the hardest part of his arc is not the diagnosis, it's the decision to build his cure inside the family's belief system rather than against it.\n\n**Relationships:**\n- **Nakulan** — old, easy friendship; the reason he came at all.\n- **Sridevi** — professional respect that becomes something else once he sees how carefully and fairly she's been reasoning through a situation everyone else has been reacting to. Proposes to her at the end (Ch 16), in keeping with the source material's tone — should read as earned rather than tacked on, built across several small scenes of them working the case together.\n- **The Namboodiri** — old associate; their Ch 12 collaboration is the book's thematic payoff scene.\n\n**Voice:** Wisecracking, code-switches fluidly between clinical register and colloquial teasing; never condescends to the family's beliefs even when he privately disagrees with their framework.\n\n---\n\n## SRIDEVI\n**Role:** Cousin wrongly suspected of being \"possessed\"; the book's other clear-headed observer besides Sunny.\n\n**Background:** Quiet, watchful, has always been slightly the family's odd one out — which is precisely why suspicion lands on her so easily once the household goes looking for someone to blame.\n\n**Psychology:** Self-possessed under pressure; the wrongful accusation doesn't break her, it clarifies her — she starts keeping her own careful record of events almost as a defense, which becomes genuinely useful once she shares it with Sunny.\n\n**Arc:** Suspected → isolated (locked in her quarters, Ch 8) → quietly builds her own case → allies with Sunny once he confides the truth (Ch 10) → vindicated publicly (Ch 11) → endgame romance with Sunny, which should be underplayed throughout and only surface fully in Ch 16.\n\n**Relationships:**\n- **Ganga** — protective of her even while everyone else grows afraid of her, without fully knowing why she trusts her.\n- **Sunny** — the book's central non-romantic-coded-until-suddenly-it-is relationship; built on being taken seriously by someone for the first time in the story.\n- **The elders** — polite deference masking real hurt at how quickly they turned on her.\n\n**Craft note [CANON]:** Her innocence must read as airtight from her first scene — no false \"is she or isn't she\" beats written from a POV chapter of hers, or the Ch 11 vindication loses its force. (Mirrors the Saga bible's Ch 10 craft note on Zia.)\n\n---\n\n## ALLI\n**Role:** Nakulan's cousin; helps Ganga acquire the Thekkini keys; later the target of an \"attack\" that's actually a dissociative episode misdirected.\n\n**Background:** Youngest of the cousins present, drawn to Ganga's confidence and skepticism, flattered to be recruited into breaking a household rule.\n\n**Psychology:** Guilt-ridden once things escalate — privately believes the haunting is her fault for helping unlock the room, which nobody bothers to correct until quite late, functioning as a small but real emotional throughline about how blame distributes unfairly in a frightened household.\n\n**Arc:** Co-conspirator → frightened bystander → victim of the Ch 6 assault scene → relief and quiet reconciliation with Mahadevan in the aftermath of his wrongful suspicion.\n\n**Relationships:**\n- **Ganga** — enabler, then unwitting near-victim of her.\n- **Mahadevan** — engaged; the strain of his wrongful suspicion (Ch 6) tests but doesn't break them.\n\n---\n\n## MAHADEVAN\n**Role:** Alli's fiancé; wrongly suspected of harassing Ganga in Ch 6, when in fact he is the real-world trigger the \"Ramanathan\" projection latches onto.\n\n**Background:** An outsider to the family by marriage-to-be, already slightly on trial in the household's eyes before anything supernatural happens — a plant that makes his wrongful suspicion land harder (he was already the easiest person to blame).\n\n**Psychology:** Baffled and increasingly desperate to prove his innocence in a household that has already half-decided he's guilty of *something*, even before anyone can articulate what.\n\n**Arc:** Object of suspicion → cleared once Sunny's diagnosis reframes the Ch 6 incident entirely (Ganga, mid-episode, approaching him as \"Ramanathan,\" not him assaulting her) → quiet dignity in not demanding an apology once the truth comes out.\n\n---\n\n## THE ELDERS — Valyammai (grand-aunt) & the Karanavar of the present generation (Nakulan's uncle)\n**Role:** The voice of household superstition and tradition; issue the warnings everyone ignores.\n\n**Valyammai:** Keeper of the family's oral history (the one who tells the legend \"properly\" in Ch 1); genuinely frightened rather than credulous — she's seen enough of the family's private grief over the generations to take the warnings seriously regardless of whether she \"believes\" literally.\n\n**The present Karanavar (title, not name — [OPEN] needs a personal name before drafting):** Nominal head of the household; the one who holds the Thekkini keys and is most humiliated by their theft; the one who summons the Namboodiri over Sunny's objection, setting up the Act Three collaboration.\n\n**Function:** Represent the superstition framework honestly — never mocked, never proven simply wrong; their fear is validated by real danger even though their explanation for it is incorrect.\n\n---\n\n## PULLATTUPARAM BRAHMADATHAN NAMBOODIRI\n**Role:** Tantric ritual expert summoned to perform an exorcism; secretly Sunny's old associate and eventual collaborator.\n\n**Background:** A respected, traditional ritual specialist — not a con man, not secretly a skeptic. His authority in the community is real and earned.\n\n**Psychology:** Operates from genuine belief in his own tradition's efficacy, but is intellectually curious enough to have crossed paths with Sunny before (**[OPEN]** — exact prior history to be fixed in drafting; options: former patient's family, academic conference on ritual/psychology, or a previous case they solved together) and to recognize immediately what Sunny is proposing.\n\n**Arc:** Summoned as the superstition framework's champion → privately briefed by Sunny (Ch 12) → designs a ritual that functions, mechanically, exactly like Sunny's planned intervention (controlled confrontation, planted \"kill\" of the Karanavar-substitute, engineered exit for the alter) → never breaks character or tips his hand to the family throughout.\n\n**Relationships:**\n- **Sunny** — professional respect across two very different disciplines; the book's clearest statement of its thesis is their Ch 12 conversation.\n- **The elders** — total credibility; his blessing is what makes the family accept the ritual's outcome without ever needing to be told the clinical truth.\n\n---\n\n## HISTORICAL / FLASHBACK CHARACTERS (Ch 0 only, and referenced throughout)\n\n### NAGAVALLI\n**Role:** Court dancer from Thanjavur, murdered 150 years ago; the legend's \"ghost,\" and — crucially — never actually present as a ghost anywhere in the present-day story.\n\n**Background:** Accomplished, proud of her craft, taken from Thanjavur against her real wishes by the Karanavar of the time (see Story Bible §1 for the gap between legend and true history).\n\n**Function:** Gets the book's only flashback POV (Ch 0) specifically so the reader carries the *true* version of events into the present-day mystery, creating dramatic irony against the family's sanitized legend.\n\n### RAMANATHAN\n**Role:** Nagavalli's partner, murdered the same night.\n\n**Function:** Present only in Ch 0 and in report; his death is what Ganga's alter is unconsciously reenacting whenever she mistakes Mahadevan for him.\n\n### KARANAVAR SANKARAN THAMBI\n**Role:** The historical patriarch; murderer of Nagavalli and Ramanathan.\n\n**Function:** Never appears except in Ch 0 and family portraiture; his crime is the book's original sin, the role Nakulan is unknowingly cast into by his wife's alter.\n"
    },
    {
      "title": "Locations",
      "type": "reference",
      "content": "# LOCATIONS — THE SOUTHERN WING (DEMO)\n\n---\n\n## MADAMPALLI THARAVAD\n**Type:** Primary setting — ancestral estate house, present day.\n**Description:** Large multi-generational tharavad in rural Kerala. Central courtyard, verandahs, a household shrine, a portrait gallery of ancestors (one portrait conspicuously damaged/missing — plant, see Plants & Reveals), several wings added across generations by different branches of the family. Should read as a character in its own right — old enough that its layout encodes the family's history.\n**Scenes set here:** Nearly all of Act One and Two; the ritual courtyard for Act Three is a purpose-dressed section of the main courtyard.\n**Sub-locations:**\n- **The main courtyard** — communal space, site of the Act Three ritual.\n- **The portrait gallery** — corridor connecting the main house to the Thekkini's outer door; site of the Ch 4 \"eyes that follow\" incident.\n- **The household shrine** — where the family's failed pujas take place (Ch 5).\n- **Sridevi's quarters** — where she's confined in Ch 8.\n\n## THE THEKKINI (Southern Wing)\n**Type:** Forbidden interior location — locked wing of the mansion.\n**Description:** Preserved almost exactly as it was 150 years ago. Dancer's anklets, an unlit oil lamp, a cracked mirror, personal effects belonging to Nagavalli. Has its own external door, separate from the main house, which is how Ganga and Alli can access it without crossing the household (Ch 3). Should feel arrested in time rather than overtly sinister — the horror is in the stillness, not decoration.\n**Scenes set here:** Ch 3 (the unlocking), Ch 7 (the midnight confrontation), Ch 13 (briefly, before the action moves to the courtyard).\n\n## THE COTTAGE (historical)\n**Type:** Flashback-only location.\n**Description:** A modest cottage adjoining the estate grounds, where Ramanathan lived to be near Nagavalli in secret. Site of his murder.\n**Scenes set here:** Ch 0 only.\n\n## EVOOR\n**Type:** Secondary present-day location — a half-day's travel from the estate.\n**Description:** A village home to descendants of the household's former retainer families, and to a temple holding a more accurate historical record than the family's own oral legend.\n**Scenes set here:** Ch 9 (Sunny's investigative trip).\n\n## THANJAVUR (historical)\n**Type:** Flashback-only location.\n**Description:** The royal court where Nagavalli and Ramanathan trained and performed before the Karanavar's visit. Seen only in Ch 0's opening movement.\n**Scenes set here:** Ch 0 only.\n"
    },
    {
      "title": "Chapter Breakdown",
      "type": "reference",
      "content": "# THE SOUTHERN WING — CHAPTER BREAKDOWN (DEMO)\n\n*Per chapter: **Purpose** · **Events** · **Character & reactions** · **Setup/payoff** · **Ends on**. POV grammar: third-person limited throughout, past tense, rotating between Sunny, Nakulan, and Sridevi — except Ch 0 (Nagavalli, flashback) and Ch 16 (Ganga, the one time we enter her).*\n\n---\n\n# ACT ONE\n\n## CH 0 — WHAT THE COURT REMEMBERS\n**POV:** Nagavalli (flashback) · **Status:** [PLANNED]\n**When:** 150 years before the story, Thanjavur and Madampalli.\n\n**Purpose:** Plant the true history in the reader's hands before the family's sanitized legend is ever told, so every later retelling of the legend reads with dramatic irony.\n\n**Events**\n- Thanjavur court, Nagavalli performing; Ramanathan watching from the margins — established as already her partner, not a later \"seduction.\"\n- The Karanavar's visit; the transaction that removes her from the court, told plainly, without romance.\n- Arrival at Madampalli; the Thekkini as a gift that is also a cage.\n- Ramanathan's cottage, the secret visits.\n- The night: the Karanavar discovers them, goes to the cottage first — controlled, methodical, not a crime of passion — then to the Thekkini.\n- Chapter ends before her death is shown directly; cut on the anklets.\n\n**Character & reactions:** Nagavalli's clear-eyed awareness of her own situation throughout — never a passive victim in tone, even though she has no power in the situation.\n**Setup/payoff:** Sets up the true-history/legend gap (paid off Ch 9); the anklets (paid off Ch 3 and Ch 13); the damaged portrait (paid off Ch 4).\n**Ends on:** The anklets, still.\n\n---\n\n## CH 1 — THE HOUSE THAT KEEPS ITS DOORS LOCKED\n**POV:** Nakulan · **Status:** [PLANNED]\n\n**Purpose:** Establish the present-day family, the legend as the family tells it, and Nakulan's reasons for insisting on the visit despite warnings.\n\n**Events**\n- Arrival at Madampalli; the extended family already assembling, unable to let the couple go alone.\n- Valyammai's formal warning about the Thekkini, told in full — the family version of the legend (Story Bible §1), delivered as fact.\n- Ganga's visible, performative skepticism in front of the family.\n- A quiet aside: Nakulan's own reason for insisting on staying here — refusing to let the house's reputation run his life.\n- First hint of Ganga's \"far-away moods,\" read by Nakulan as ordinary tiredness from travel.\n\n**Character & reactions:** The family's fear is played straight, not comic; Ganga's skepticism should read as genuine but slightly too emphatic.\n**Setup/payoff:** The legend (payoff Ch 9); \"far-away moods\" (payoff Ch 10).\n**Ends on:** The locked door of the Thekkini, seen from outside for the first time.\n\n---\n\n## CH 2 — FAR-AWAY MOODS\n**POV:** Nakulan · **Status:** [PLANNED]\n\n**Purpose:** Deepen Nakulan and Ganga's marriage; establish his friendship with Sunny early so his later summons doesn't feel mechanical; plant Ganga's undisclosed grief.\n\n**Events**\n- A quiet domestic scene; Nakulan notices Ganga somewhere else entirely for several seconds, snapping back as if nothing happened.\n- A brief, deflected exchange about a recent loss — kept vague enough not to name it outright (see Patch 1).\n- Nakulan mentions Sunny by name, establishing the friendship and the fact that Sunny is \"the person you call when something's wrong that a doctor here won't understand.\"\n- Family gossip overheard: comparisons of Ganga to a relative with a history of \"melancholy\" — the red herring the family will lean on later.\n\n**Character & reactions:** Nakulan's blind spot crystallizes here — he registers the moment and immediately explains it away.\n**Setup/payoff:** Sunny's eventual summons; the melancholy red herring (paid off/debunked Ch 10); the undisclosed grief.\n**Ends on:** Ganga's hand, briefly, resting on her own stomach without seeming to notice she's done it.\n\n---\n\n## CH 3 — THE KEY\n**POV:** Sridevi · **Status:** [PLANNED]\n\n**Purpose:** Ganga's transgression; introduce Sridevi properly and establish her as a careful observer from her very first POV chapter.\n\n**Events**\n- Sridevi witnesses Ganga persuading Alli to help steal the keys — recounts it faithfully, without embellishment, already the book's most reliable narrator.\n- The theft itself; the Thekkini's external door, used specifically so they needn't cross the main house.\n- Inside: the anklets, the lamp, the cracked mirror — Ganga's reaction is curiosity, not fear, and specifically a *recognition* she can't explain to herself.\n- They relock the room; nobody else knows yet.\n\n**Character & reactions:** Alli's flattered nervousness; Sridevi's private disapproval, kept to herself rather than reported — the trait that will later make her look suspicious.\n**Setup/payoff:** The anklets and mirror (payoff Ch 7, Ch 13); Sridevi's habit of quiet observation (payoff Ch 8, Ch 11).\n**Ends on:** Ganga, alone a moment, whispering a phrase in Tamil she has no memory of having learned.\n\n---\n\n## CH 4 — THE EYES THAT FOLLOW\n**POV:** Nakulan · **Status:** [PLANNED]\n\n**Purpose:** First ambiguous incident; introduce the damaged portrait; escalate household unease without yet confirming anything supernatural.\n\n**Events**\n- The portrait gallery, connecting the main house to the Thekkini's outer door; a portrait of the historical Karanavar has a slashed or defaced section — nobody in the present generation remembers why or when.\n- Household objects begin shattering inexplicably — staged so it's plausible as draft, structural settling, or (unconfirmed) something else.\n- Valyammai's fear sharpens into open dread; she notices the Thekkini's lock has been disturbed.\n- Ganga's mood shifts sharply and briefly at dinner — gone before anyone can name it.\n\n**Character & reactions:** The household's unease becomes collective rather than individual — first \"we\" language about the haunting.\n**Setup/payoff:** The damaged portrait (payoff Ch 9); shattering objects as an established \"symptom\" pattern (payoff Ch 10).\n**Ends on:** Valyammai discovering the disturbed lock, saying nothing to anyone yet.\n\n---\n\n## CH 5 — WHAT THE PUJA COULDN'T FIX\n**POV:** Nakulan · **Status:** [PLANNED] · *Act One climax*\n\n**Purpose:** First real violence; crystallize the family's fear into open supernatural belief; end Act One on the decision to summon outside help.\n\n**Events**\n- The disturbed lock is discovered by the whole family; the theft is out.\n- A traditional purification ritual/puja is performed to calm the house — fails visibly, worsening the mood rather than resolving it.\n- That night: Ganga's saree catches fire near the household shrine's lamps — staged so it is plausible as an accident involving someone in a dissociative state near open flame, without confirming anything.\n- Panic; the family's fear becomes explicit and collective — someone says the word \"possessed\" aloud for the first time, aimed uncertainly at Ganga, then redirected (wrongly) toward Sridevi because of her composure in the chaos, which reads to the frightened family as unnatural calm.\n- Nakulan, shaken, decides to call Sunny.\n\n**Character & reactions:** The pivot from private fear to public accusation; Sridevi's first taste of being looked at differently.\n**Setup/payoff:** The saree fire as the pattern's most dangerous escalation so far; Sridevi's wrongful suspicion begins here, properly, for Act Two to develop.\n**Ends on:** Nakulan on the phone, asking Sunny to come immediately. **End of Act One.**\n\n---\n\n# ACT TWO\n\n## CH 6 — THE MAN FROM AMERICA\n**POV:** Sunny · **Status:** [PLANNED]\n\n**Purpose:** Introduce Sunny at full voice; establish his method; the Alli assault incident and Mahadevan's wrongful suspicion.\n\n**Events**\n- Sunny's arrival — wry, informal, immediately undercutting the household's dread with humor the family finds either refreshing or disrespectful depending on who you ask.\n- His first read of the situation: treats it as a case, not a haunting, without dismissing the family's fear as stupid.\n- That night: Alli is violently frightened/grabbed in a dim corridor; Mahadevan, found nearby, is accused — he protests his innocence loudly and is not believed.\n- Sunny's private read of the scene doesn't match the accusation, though he says nothing yet.\n\n**Character & reactions:** Mahadevan's genuine bewilderment plays as more convincing than the family credits it; Sunny quietly filing away a detail nobody else notices.\n**Setup/payoff:** Mahadevan's wrongful suspicion (payoff Ch 10, when reframed as the \"Ramanathan\" projection); Sunny's noticed detail (payoff Ch 10).\n**Ends on:** Sunny asking, mildly, whether anyone actually saw what happened, and getting no clear answer.\n\n---\n\n## CH 7 — MIDNIGHT IN THE THEKKINI\n**POV:** Sunny · **Status:** [PLANNED]\n\n**Purpose:** The book's most overtly \"haunted\" set piece, staged so it can be reread as clinical once the reader knows the truth; the Durgashtami threat is issued.\n\n**Events**\n- Midnight: singing and dancing in Tamil, coming from the re-locked Thekkini.\n- Sunny goes to investigate rather than avoid it — adopts the vocal persona of the historical Karanavar (a calculated risk, explained in his own head as \"give it something to talk to\") and engages the voice in dialogue.\n- The voice identifies itself as Nagavalli, names her grievance, and vows to decapitate the Karanavar on the coming night of Durgashtami.\n- Sunny doesn't confirm or deny anything to the family afterward — buys himself time to investigate properly instead of reacting.\n\n**Character & reactions:** Sunny's calm under a genuinely frightening scene, contrasted with his private uncertainty once alone.\n**Setup/payoff:** The Durgashtami deadline (payoff Act Three); the vocal-persona trick (paid off again, deliberately, in Ch 12's ritual).\n**Ends on:** Sunny alone in the corridor afterward, no longer treating this as a straightforward case.\n\n---\n\n## CH 8 — LOCKED IN HER OWN ROOM\n**POV:** Sridevi · **Status:** [PLANNED]\n\n**Purpose:** The poisoning subplot; Sridevi wrongly confined; establish this incident as mundane and separate from the dissociative pattern (per Story Bible §3).\n\n**Events**\n- An unknown party attempts to poison Nakulan's tea — caught before real harm is done.\n- Sunny, still gathering information and buying time, publicly blames Sridevi and has her confined to her quarters — a calculated, uncomfortable choice on his part, not a genuine belief.\n- Sridevi's private reaction: humiliation, then a decision to start keeping her own written account of events rather than simply enduring the suspicion.\n- A brief, deliberately unresolved thread: the estate accountant (**[OPEN]** — needs a name before drafting) had a financial dispute with Nakulan's uncle days earlier, planted as a plausible mundane suspect for the poisoning without ever being confirmed on the page.\n\n**Character & reactions:** Sridevi's composure under a second, worse accusation; the household fully convinced now that she is \"the one.\"\n**Setup/payoff:** Sridevi's written record (payoff Ch 10, when she hands it to Sunny); the accountant thread (deliberately left as texture, not resolved — [OPEN] whether to pay this off in a later patch).\n**Ends on:** Sridevi, alone, starting her notes with the sentence: \"I did not do this.\"\n\n---\n\n## CH 9 — WHAT EVOOR REMEMBERS\n**POV:** Sunny · **Status:** [PLANNED]\n\n**Purpose:** Fracture the legend; deliver the true 150-year-old history to both Sunny and the reader; deepen the thematic spine.\n\n**Events**\n- Sunny travels to Evoor, following a hunch from the vocal cadence and specific Tamil phrasing used by the \"voice\" — a detail nobody else thought to chase.\n- Interviews a descendant of the household's old retainer family and consults a temple record.\n- Receives the true history (Story Bible §1): the transaction, not a romance; Ramanathan not a seducer but her already-partner; the murders as methodical rather than a single crime of passion; the mysterious forty-years-later gap before the haunting reports began.\n- Sunny connects the true history's details to specific phrases the \"voice\" used in Ch 7 — phrases that match the accurate record, not the sanitized family legend, which is the first hard clinical clue that whoever is speaking learned the story from somewhere more specific and detailed than the family's telling.\n\n**Character & reactions:** Sunny's investigative satisfaction curdling into unease as the pieces start pointing somewhere he doesn't want them to point.\n**Setup/payoff:** The true-history/legend gap (paid off from Ch 0); the phrase-matching clue (payoff Ch 10's diagnosis scene).\n**Ends on:** Sunny, on the road back, asking himself who in the household could possibly know these specific, unrecorded details.\n\n---\n\n## CH 10 — THE DIAGNOSIS\n**POV:** Sunny · **Status:** [PLANNED] · *Act Two climax*\n\n**Purpose:** Sunny reaches the correct diagnosis privately; confides in Sridevi; the melancholy red herring is debunked; the true nature of Ganga's condition is laid out fully for the reader.\n\n**Events**\n- Sunny reviews everything: Nakulan's \"far-away moods,\" the grand-aunt's childhood performances of the legend, the phrase-matching from Evoor, the pattern of incidents that are each independently explicable, Ganga's own hand-on-stomach tell from Ch 2.\n- Diagnosis, laid out in full clinical honesty: Dissociative Identity Disorder, with a clear etiology — the childhood exposure, the accumulated present-day stress, an alternate identity that has adopted the Nagavalli persona wholesale, including details only explicable if Ganga absorbed the deep, accurate version of the story as a child (implicating the grand-aunt's performances, not supernatural knowledge).\n- The melancholy-relative red herring is explicitly debunked — a different, unrelated family history that everyone had been pattern-matching onto Ganga out of fear, not evidence.\n- Sunny confides fully in Sridevi, the only person he trusts with the truth; she shares her own written record in return, and it corroborates his read precisely.\n- Sridevi agrees to help.\n\n**Character & reactions:** Sunny's relief at being right sitting uneasily against the weight of what \"right\" now requires of him; Sridevi's vindication arriving privately, before it arrives publicly.\n**Setup/payoff:** Every Act One/Two \"clue\" pays off here at once; sets up the need for a socially acceptable delivery mechanism (Ch 12).\n**Ends on:** Sunny's realization that a clinical diagnosis alone will save no one — the family will never accept it on its own terms.\n\n---\n\n## CH 11 — WHAT SRIDEVI KNEW\n**POV:** Sridevi · **Status:** [PLANNED]\n\n**Purpose:** Public vindication; the elders summon the Namboodiri, setting up Act Three.\n\n**Events**\n- With Sunny's backing, Sridevi's written record and the true circumstances of the tea incident come out — she is publicly cleared.\n- The family's collective relief and shame, handled without anyone grovelling extensively — a brisk, dignified correction rather than a big emotional scene, in keeping with the household's reserved register.\n- Meanwhile, and separately, the elders — frightened and now doubly so with Durgashtami approaching — summon the renowned tantric expert, **Pullattuparam Brahmadathan Namboodiri**, over Sunny's mild private objection.\n- Sunny recognizes the name; the two are old associates.\n\n**Character & reactions:** Sridevi's relief is real but guarded — she does not fully trust the household's fear not to land on someone else next.\n**Setup/payoff:** The Namboodiri's arrival (Act Three); Sunny and the Namboodiri's prior history (**[OPEN]** — needs fixing before drafting).\n**Ends on:** The Namboodiri's palanquin/car arriving at the gate. **End of Act Two.**\n\n---\n\n# ACT THREE\n\n## CH 12 — TWO TRADITIONS, ONE PLAN\n**POV:** Sunny · **Status:** [PLANNED]\n\n**Purpose:** The book's thematic centerpiece — Sunny and the Namboodiri's collaboration, worked out in full.\n\n**Events**\n- Sunny and the Namboodiri meet privately; Sunny lays out the clinical truth in full.\n- The Namboodiri does not concede that Sunny's framework is \"more true\" than his own — he simply recognizes that his own tradition's technique for a spirit's \"release\" and Sunny's clinical plan for a controlled confrontation and exit event are, mechanically, close enough to run as one ritual.\n- Together they design the Durgashtami ritual: a public, ceremonially correct exorcism that is secretly staged to give Ganga's alter the confrontation and \"victory\" it needs (a symbolic execution of the Karanavar) without anyone actually getting hurt.\n- The mechanism is set: a lifelike straw dummy, a lever/swap mechanism, sacred ash and smoke as both ritual element and practical blind for the swap.\n\n**Character & reactions:** Two men from opposed disciplines speaking past each other's frameworks while agreeing completely on the plan — the chapter should never resolve which of them is \"right,\" by design.\n**Setup/payoff:** Every physical element of the Ch 15 climax is planted here (the dummy, the lever, the ash/smoke).\n**Ends on:** The Namboodiri's blessing of the plan, in ritual language that means something different to him than it does to Sunny — and both of them fine with that.\n\n---\n\n## CH 13 — THE NIGHT BEFORE\n**POV:** Nakulan · **Status:** [PLANNED]\n\n**Purpose:** Rising dread; Nakulan learns he is to be the \"target\"; a last quiet scene between Nakulan and Ganga before the crisis.\n\n**Events**\n- Preparations for the Durgashtami ritual across the household — the ceremonial dressing of the courtyard.\n- Sunny and Sridevi brief Nakulan, gently, on what's actually going to happen and what his role requires of him — steady nerve, trust, and silence.\n- A quiet scene between Nakulan and Ganga (her lucid self) — neither of them naming what's coming, both aware something is.\n- Valyammai's private fear, handled with dignity — she has already lost one relative to this story, generations back (**[OPEN]** — ties to the Ch 9 forty-years-later gap; needs fixing whether this is literal family history or left ambiguous).\n\n**Character & reactions:** Nakulan's fear reframed as active courage rather than passive helplessness — this is his one moment of agency in the climax.\n**Setup/payoff:** The emotional stakes of Ch 15's swap; Valyammai's history (ties back to Story Bible §1's [OPEN] item).\n**Ends on:** Nakulan and Ganga's hands, briefly touching, neither of them saying what they mean.\n\n---\n\n## CH 14 — DURGASHTAMI\n**POV:** Sunny · **Status:** [PLANNED]\n\n**Purpose:** The alter fully takes over; the family witnesses the ritual begin; the last beat before the swap.\n\n**Events**\n- Ganga fully submerges into the Nagavalli persona — staged so the transition itself is the book's most overt \"possession\" beat, deliberately, right before the reveal strips it of supernatural explanation for good.\n- She follows Mahadevan into the ritual courtyard, perceiving him as Ramanathan.\n- The Namboodiri, in full ritual voice, converses with the persona — promises her the Karanavar's death in exchange for her departure from Ganga's body, exactly as designed with Sunny.\n- Nakulan is brought forward.\n\n**Character & reactions:** The household's genuine, frightened belief that they are watching a real exorcism — nobody but Sunny, the Namboodiri, and Sridevi know otherwise; Mahadevan's discomfort at being cast, again, as someone else's ghost.\n**Setup/payoff:** Everything from Ch 12 converges.\n**Ends on:** The sword raised.\n\n---\n\n## CH 15 — THE SWAP\n**POV:** Sunny · **Status:** [PLANNED] · *Climax*\n\n**Purpose:** The physical climax; the alter's exit; the immediate aftermath.\n\n**Events**\n- The Namboodiri releases smoke and sacred ash into Ganga's face, momentarily blinding her — ritually justified, practically necessary.\n- Sunny, in the same instant, works the lever, swapping Nakulan for a lifelike straw dummy dressed identically.\n- The persona, still blind with fury, hacks the dummy to pieces, fully convinced the Karanavar is dead.\n- Believing her revenge complete, the alter withdraws — Ganga collapses, and for the first time in the book, is simply herself, disoriented, exhausted, without memory of what just happened.\n- The household witnesses what looks, to them, like a successful exorcism.\n\n**Character & reactions:** The precision required of Sunny and the Namboodiri under real time pressure; Nakulan's relief once he understands he was never in physical danger from the ritual itself, only from what it required of everyone around him.\n**Setup/payoff:** Every planted mechanism from Ch 12 pays off in sequence.\n**Ends on:** Ganga, on the ground, breathing, herself.\n\n---\n\n## CH 16 — WHAT GANGA REMEMBERS\n**POV:** Ganga (the only time) · **Status:** [PLANNED] · *Resolution*\n\n**Purpose:** The one chapter inside Ganga's head; her recovery under Sunny's ongoing clinical care; the family's reconciliation; the ending beats (Sridevi/Sunny).\n\n**Events**\n- Ganga wakes with only fragments — not the alter's memories, but the accumulated exhaustion and the recent grief she'd been carrying underneath everything (Patch 1 material, if accepted).\n- Sunny explains the clinical truth to her directly and gently — the first time the diagnosis is spoken plainly to the person it's actually about, rather than around her.\n- A period of targeted therapy, compressed but not skipped — the book should resist a magic-instant-cure ending.\n- The family's farewell to the couple — warm, a little sheepish about the fear they'd aimed at Sridevi and, at points, at Ganga herself.\n- Before Sunny and Sridevi return their separate ways (his to the US, hers staying), he proposes — a scene the text should build as earned across their small collaborative moments rather than sudden.\n\n**Character & reactions:** Ganga's ending register is deliberately not triumphant — tired, a little raw, beginning rather than finished; contrasts with the neat closure the household wants to feel.\n**Setup/payoff:** Every earlier \"far-away mood,\" hand-on-stomach, and performative-wit beat resolves here.\n**Ends on:** Ganga and Nakulan leaving the estate; the Thekkini's door, standing open now, empty, ordinary. **End of Act Three. End of book.**\n"
    },
    {
      "title": "Plants & Reveals",
      "type": "reference",
      "content": "# PLANTS & REVEALS — THE SOUTHERN WING (DEMO)\n\n*Extracted from the chapter breakdown, for testing the Plants/Reveals tracking feature independently.*\n\n| # | Plant | Planted in | Reveal / Payoff | Paid off in |\n|---|---|---|---|---|\n| 1 | The true Thanjavur history (transaction, not romance; Ramanathan already her partner; methodical murders) | Ch 0 | The family's sanitized legend is exposed as incomplete/self-serving | Ch 9 |\n| 2 | The anklets, lamp, cracked mirror in the Thekkini | Ch 0 / Ch 3 | Physical props reused in the climax | Ch 13 / Ch 15 |\n| 3 | The damaged/defaced ancestor portrait | Ch 4 | Ties to the true history and the family's discomfort with it | Ch 9 |\n| 4 | Ganga's \"far-away moods\" | Ch 2 | Recognized as an early dissociative symptom | Ch 10 |\n| 5 | Ganga's hand-on-stomach gesture | Ch 2 | Tied to undisclosed grief, resolved in her recovery | Ch 16 (see Patch 1) |\n| 6 | The \"melancholy relative\" gossip | Ch 2 | Explicitly debunked as a fear-driven red herring | Ch 10 |\n| 7 | Ganga whispering an unfamiliar Tamil phrase | Ch 3 | Traced to the grand-aunt's childhood performances of the legend | Ch 10 |\n| 8 | Sridevi's habit of quiet, undisclosed observation | Ch 3 | Becomes the written record that corroborates Sunny | Ch 8 → Ch 10 |\n| 9 | Household objects shattering | Ch 4 | Established pattern of independently-explicable \"symptoms\" | Ch 10 |\n| 10 | The saree fire | Ch 5 | Confirmed as a dissociative-state accident, not an attack | Ch 10 |\n| 11 | Sunny's noticed (unstated) detail during the Alli/Mahadevan incident | Ch 6 | Reframes the incident as the \"Ramanathan\" projection | Ch 10 |\n| 12 | The Durgashtami deadline issued by the \"voice\" | Ch 7 | Structures the entire Act Three climax | Ch 14–15 |\n| 13 | The estate accountant's financial dispute | Ch 8 | Deliberately left unresolved — texture, not a solved mystery | [OPEN — possible future patch] |\n| 14 | Specific accurate-history phrasing used by the \"voice\" | Ch 7 | Matched against the Evoor record, the key clinical clue | Ch 9 → Ch 10 |\n| 15 | Sunny and the Namboodiri's prior association | Ch 11 | Enables the Act Three collaboration without a slow-build introduction | Ch 12 |\n| 16 | The swap mechanism (dummy, lever, ash/smoke) | Ch 12 | Executed under pressure | Ch 15 |\n| 17 | Valyammai's private, older family history with this story | Ch 13 | Left ambiguous by design — see Story Bible §1's open item | [OPEN] |\n| 18 | Sunny and Sridevi's small collaborative moments across Act Two | Ch 8, 10, 11 | The proposal | Ch 16 |\n\n**Open items surfaced by this table (for testing contradiction-flagging):**\n- #13 and #17 are intentionally left unresolved at book's end — good test cases for whether StoryMap correctly distinguishes \"deliberately open\" from \"accidentally dangling.\"\n"
    },
    {
      "title": "Continuity Timeline",
      "type": "timeline",
      "content": "# CONTINUITY / TIMELINE — THE SOUTHERN WING (DEMO)\n\n---\n\n## HISTORICAL TIMELINE [CANON]\n\n- **Year 0 (150 years before present):** The Karanavar's trip to Thanjavur; Nagavalli brought to Madampalli; the murders of Ramanathan and Nagavalli; the Thekkini sealed.\n- **~Year 40:** First recorded reports of disturbances in the household — per the Evoor temple record, notably later than the family legend implies (the legend collapses this gap, telling the story as if the haunting began immediately). **[OPEN]** — whether this ~40-year gap corresponds to an earlier, unrelated dissociative episode in another family member, or is simply the point the ghost story gained traction. Deliberately unresolved (see Story Bible §1).\n- **Present day:** The book's events, below.\n\n## PRESENT-DAY TIMELINE [CANON — draft, ~18 days total]\n\n| Day | Chapter(s) | Event |\n|---|---|---|\n| 1 | Ch 1 | Arrival at Madampalli; the legend told in full. |\n| 2–3 | Ch 2 | Domestic scenes; Ganga's first \"far-away\" moment noticed. |\n| 4 | Ch 3 | The keys stolen; the Thekkini opened. |\n| 5–6 | Ch 4 | Portrait/shattering-objects incidents; household unease sharpens. |\n| 7 | Ch 5 | Failed puja; the saree fire; Sunny summoned. **End of Act One.** |\n| 9 | Ch 6 | Sunny arrives (allow ~1–2 days' travel); the Alli/Mahadevan incident that night. |\n| 10 | Ch 7 | Midnight confrontation in the Thekkini; the Durgashtami vow issued. |\n| 11 | Ch 8 | The poisoning attempt; Sridevi confined. |\n| 12–13 | Ch 9 | Sunny's trip to Evoor and back. |\n| 13 | Ch 10 | The diagnosis; Sunny confides in Sridevi. |\n| 14 | Ch 11 | Sridevi publicly cleared; the Namboodiri summoned. **End of Act Two.** |\n| 15 | Ch 12 | Sunny and the Namboodiri plan the ritual. |\n| 16 | Ch 13 | Final preparations; the night before. |\n| 17 | Ch 14–15 | Durgashtami — the ritual, the swap, the resolution. |\n| 18 | Ch 16 | Aftermath, recovery period (compressed/summarized), departure. |\n\n## [OPEN] ITEMS FLAGGED FOR CONTINUITY\n\n1. **Durgashtami's actual calendar date relative to Day 1 arrival** — the table above assumes ~17 days between arrival and Durgashtami; this should be checked against the real festival calendar if the book is meant to read as contemporary-realistic, or explicitly fictionalized if not. Good test case for a continuity contradiction flag.\n2. **The Namboodiri and Sunny's prior association** (see Character Bible) — needs a fixed backstory before Ch 11–12 can be drafted in full; currently just referenced as existing.\n3. **The present-generation \"Karanavar\" elder's personal name** — currently referred to only by title; needs fixing before dialogue-heavy drafting.\n4. **The estate accountant's name and the poisoning red herring's ultimate status** — intentionally unresolved; flag as \"deliberately open,\" not a gap to be closed automatically.\n"
    },
    {
      "title": "Patch 1",
      "type": "reference",
      "content": "# PATCH 1 — THE SOUTHERN WING (DEMO)\n*Test patch, matching the Saga's numbered-patch workflow. Resolves one open item from the Story Bible / Character Bible into canon.*\n\n---\n\n## ISSUE ADDRESSED\n\nGanga's undisclosed private grief was flagged **[PROPOSED]** in the Story Bible (§3) and Character Bible (Ganga's psychology) as \"a recent pregnancy loss,\" without being locked. This patch resolves it.\n\n## PATCH\n\n**[CANON — supersedes the PROPOSED tag]**\n\nGanga miscarried roughly four months before the events of the book, early in the pregnancy, known only to her and Nakulan. Neither has processed it — Nakulan by staying busy and insisting on the visit to Madampalli (partly, unconsciously, to give them both somewhere to be that isn't the home where it happened); Ganga by refusing to discuss it at all, which is part of what the household misreads as ordinary reserve.\n\n**Why this locks now:** it gives the \"hand on stomach\" gesture (Ch 2) a concrete referent instead of a vague gesture toward \"something's wrong with her,\" gives Nakulan's insistence on the visit a second, more sympathetic motive than stubbornness alone, and gives Ch 16's recovery scene something specific and ordinary (not supernatural, not dramatic) to resolve alongside the clinical plot — grief that was always just grief, running in parallel to the dissociative crisis rather than causing it outright.\n\n**Scope of the change:**\n- Story Bible §3: \"an unrelated private grief she is carrying about a recent miscarriage **[PROPOSED — see Patch 1]**\" → now **[CANON]**, remove the proposed tag on next Story Bible revision.\n- Character Bible, Ganga: \"Carries an undisclosed private grief (a recent pregnancy loss, **[PROPOSED]**, see Patch 1)\" → now **[CANON]**.\n- Ch 2 breakdown: the hand-on-stomach beat now has a locked referent.\n- Ch 16 breakdown: recovery period should explicitly include this thread alongside the clinical one, without conflating the two — the diagnosis explains the alter; it does not explain or excuse the grief, and the text should not let Sunny's clinical framework flatten it into \"just another symptom.\"\n\n## STILL OPEN (not addressed by this patch)\n\n- The ~40-year historical gap (Story Bible §1 / Continuity #1).\n- The Namboodiri/Sunny prior association (Continuity #2).\n- The present-generation elder's personal name (Continuity #3).\n- The estate accountant thread (Continuity #4) — deliberately left open, not a candidate for this kind of patch.\n"
    },
    {
      "title": "Namboodiri's Ritual Notes",
      "type": "reference",
      "content": "# [IN-WORLD DOCUMENT] — Namboodiri's Private Ritual Notes\n*Test artifact for the \"Documents\" feature — an in-world document a character would plausibly carry, distinct from the story-bible/meta documents above. Referenced in Ch 12; could be shown on-page as an inset or left as background texture.*\n\n---\n\n*Written in Brahmadathan Namboodiri's own hand, in the small ledger he keeps for difficult cases. Never shown to the family.*\n\n**On the case at Madampalli.**\n\nThe household believes I have come to expel a spirit. I have not corrected them, and I do not intend to. What Dr. Joseph describes to me is not, in my understanding of these things, a contradiction of what I do — it is a description of the same event from a vantage I was not trained to use.\n\nA spirit that will not leave is, in my tradition, a grievance that has not been answered. The doctor tells me this is also true in his — a wound that was never permitted to finish happening, replaying itself because it was interrupted rather than resolved. We are, I think, describing the same shape from two directions, and I see no virtue in insisting mine is the only true one merely because it is mine.\n\nThe ritual for Durgashtami must therefore do two things at once, and neither may be allowed to fail for the sake of the other:\n\n1. It must be, in every particular the family can observe, a correct and complete rite — the invocation, the offering, the confrontation, the release. If it is not ritually sound, it will not be *believed*, and an unbelieved cure is no cure at all to people who need to believe it.\n2. It must also, without any visible seam, accomplish precisely what the doctor requires — a controlled confrontation, a decisive and convincing \"death\" of the offending party that will satisfy the grievance without harming the man wearing its face, and a clean exit for whatever it is that has been carrying this weight so long.\n\nThe smoke and ash are, in this sense, doing two jobs honestly at once — I would use them regardless of the doctor's plan, and he requires exactly this kind of cover regardless of my ritual. I have not had to lie to my own tradition to help him. I suspect he would say the same of his.\n\n*Note to self: confirm the lever mechanism is silent. Confirm the dummy's weight is convincing under a blade. Confirm Nakulan understands he must not move.*\n\n*Second note, added later: I do not know if what leaves her tonight is a spirit or a symptom. I have decided this is not a question I am required to answer to do my work well.*\n"
    }
  ],
  "characters": [
    {
      "key": "ganga",
      "label": "Ganga",
      "aliases": []
    },
    {
      "key": "nakulan",
      "label": "Nakulan",
      "aliases": []
    },
    {
      "key": "sunny",
      "label": "Dr. Sunny Joseph",
      "aliases": [
        "Sunny"
      ]
    },
    {
      "key": "sridevi",
      "label": "Sridevi",
      "aliases": []
    },
    {
      "key": "alli",
      "label": "Alli",
      "aliases": []
    },
    {
      "key": "mahadevan",
      "label": "Mahadevan",
      "aliases": []
    },
    {
      "key": "elders",
      "label": "The Elders",
      "aliases": [
        "Elders"
      ]
    },
    {
      "key": "namboodiri",
      "label": "Pullattuparam Brahmadathan Namboodiri",
      "aliases": [
        "Namboodiri"
      ]
    },
    {
      "key": "nagavalli",
      "label": "Nagavalli",
      "aliases": []
    },
    {
      "key": "ramanathan",
      "label": "Ramanathan",
      "aliases": []
    },
    {
      "key": "thambi",
      "label": "Karanavar Sankaran Thambi",
      "aliases": [
        "Thambi"
      ]
    }
  ],
  "graphEdges": [
    {
      "from": "ganga",
      "to": "nakulan",
      "interactionType": "romantic",
      "valence": "positive",
      "chapter": null,
      "confidence": null,
      "description": "love without full understanding; his largest blind spot in the book."
    },
    {
      "from": "ganga",
      "to": "nakulan",
      "interactionType": "confrontation",
      "valence": "negative",
      "chapter": 13,
      "confidence": 0.55,
      "description": "The alter takes over fully and recasts her husband as the man who killed her. The text should read this as tragic rather than symbolic — she is not really angry at Nakulan, the substrate trauma simply needed a face, and his was the one available."
    },
    {
      "from": "ganga",
      "to": "sunny",
      "interactionType": "alliance",
      "valence": "positive",
      "chapter": null,
      "confidence": null,
      "description": "trusts him instinctively before either of them knows why; this should read, in hindsight, as the alter recognizing an ally."
    },
    {
      "from": "ganga",
      "to": "sunny",
      "interactionType": "alliance",
      "valence": "positive",
      "chapter": 7,
      "confidence": null,
      "description": "trusts him instinctively before either of them knows why; this should read, in hindsight, as the alter recognizing an ally."
    },
    {
      "from": "ganga",
      "to": "sunny",
      "interactionType": "mentorship",
      "valence": "ambiguous",
      "chapter": 10,
      "confidence": 0.5,
      "description": "Sunny reaches the correct diagnosis and decides not to say it aloud yet. The hardest part of his arc is not the diagnosis; it is choosing to build the cure inside the family’s belief system rather than against it."
    },
    {
      "from": "ganga",
      "to": "sridevi",
      "interactionType": "alliance",
      "valence": "positive",
      "chapter": null,
      "confidence": null,
      "description": "protective of her even while everyone else grows afraid of her, without fully knowing why she trusts her."
    },
    {
      "from": "ganga",
      "to": "alli",
      "interactionType": "other",
      "valence": "ambiguous",
      "chapter": 3,
      "confidence": 0.5,
      "description": "enabler, then unwitting near-victim of her."
    },
    {
      "from": "ganga",
      "to": "alli",
      "interactionType": "confrontation",
      "valence": "negative",
      "chapter": 8,
      "confidence": null,
      "description": "The “attack” on Alli, which is a dissociative episode misdirected rather than an assault. Alli helped her open the Thekkini in Ch 3 and is repaid by being the nearest body when the episode breaks."
    },
    {
      "from": "ganga",
      "to": "mahadevan",
      "interactionType": "confrontation",
      "valence": "ambiguous",
      "chapter": 6,
      "confidence": 0.45,
      "description": "Read by the household as harassment and by Ganga’s alter as recognition. Both readings are wrong, and the family acts on theirs — which is what puts Mahadevan under suspicion."
    },
    {
      "from": "nakulan",
      "to": "sunny",
      "interactionType": "alliance",
      "valence": "positive",
      "chapter": null,
      "confidence": null,
      "description": "old, easy friendship; the reason he came at all."
    },
    {
      "from": "nakulan",
      "to": "sunny",
      "interactionType": "alliance",
      "valence": "positive",
      "chapter": 2,
      "confidence": null,
      "description": "old, easy friendship; the reason he came at all."
    },
    {
      "from": "nakulan",
      "to": "elders",
      "interactionType": "confrontation",
      "valence": "ambiguous",
      "chapter": null,
      "confidence": 0.58,
      "description": "caught between them and his wife for most of Act One and Two."
    },
    {
      "from": "sunny",
      "to": "sridevi",
      "interactionType": "romantic",
      "valence": "positive",
      "chapter": 16,
      "confidence": null,
      "description": "He proposes. It should read as earned rather than tacked on — built across several small scenes of two people doing careful work together while everyone around them reacts."
    },
    {
      "from": "sunny",
      "to": "sridevi",
      "interactionType": "alliance",
      "valence": "positive",
      "chapter": 11,
      "confidence": null,
      "description": "the book's central non-romantic-coded-until-suddenly-it-is relationship; built on being taken seriously by someone for the first time in the story."
    },
    {
      "from": "sunny",
      "to": "sridevi",
      "interactionType": "alliance",
      "valence": "positive",
      "chapter": null,
      "confidence": null,
      "description": "the book's central non-romantic-coded-until-suddenly-it-is relationship; built on being taken seriously by someone for the first time in the story."
    },
    {
      "from": "sunny",
      "to": "namboodiri",
      "interactionType": "alliance",
      "valence": "ambiguous",
      "chapter": 12,
      "confidence": null,
      "description": "The book’s thesis in one conversation. The Namboodiri never concedes that Sunny is right; he simply builds his ritual around Sunny’s plan and lets both traditions claim the result."
    },
    {
      "from": "sunny",
      "to": "elders",
      "interactionType": "confrontation",
      "valence": "ambiguous",
      "chapter": null,
      "confidence": 0.52,
      "description": "They read him as a clown for longer than he minds — informal, irreverent, unbothered by a hierarchy the house runs on. He lets them, because being underestimated makes people drop their guard, and it is the elders whose permission he will eventually need."
    },
    {
      "from": "sridevi",
      "to": "elders",
      "interactionType": "confrontation",
      "valence": "negative",
      "chapter": null,
      "confidence": null,
      "description": "polite deference masking real hurt at how quickly they turned on her."
    },
    {
      "from": "alli",
      "to": "mahadevan",
      "interactionType": "romantic",
      "valence": "positive",
      "chapter": null,
      "confidence": null,
      "description": "engaged; the strain of his wrongful suspicion (Ch 6) tests but doesn't break them."
    },
    {
      "from": "mahadevan",
      "to": "elders",
      "interactionType": "confrontation",
      "valence": "negative",
      "chapter": 6,
      "confidence": 0.4,
      "description": "The elders turn on him quickly and completely, on no evidence, because a culprit is easier to hold than an explanation."
    },
    {
      "from": "namboodiri",
      "to": "elders",
      "interactionType": "alliance",
      "valence": "positive",
      "chapter": 14,
      "confidence": null,
      "description": "His blessing is what lets the family accept the outcome without ever being told the clinical truth. The vessel a truth arrives in matters as much as the truth."
    },
    {
      "from": "nagavalli",
      "to": "ramanathan",
      "interactionType": "romantic",
      "valence": "positive",
      "chapter": 0,
      "confidence": null,
      "description": "Partners for two years before the Karanavar bought her out of the Thanjavur court, and again in secret at Madampalli. Careful, and eventually not careful enough. Ch 0 gives them the book’s only true account of what they were to each other, so every later retelling of the legend reads against it."
    },
    {
      "from": "nagavalli",
      "to": "thambi",
      "interactionType": "betrayal",
      "valence": "negative",
      "chapter": 0,
      "confidence": null,
      "description": "He did not kill her in a rage. Ch 0 is explicit that he arrived having already decided the shape of the evening and simply walked through its stages — which is what the family legend spends a century and a half softening into something more bearable."
    },
    {
      "from": "ramanathan",
      "to": "thambi",
      "interactionType": "betrayal",
      "valence": "negative",
      "chapter": 0,
      "confidence": null,
      "description": "Killed first, and separately, at the cottage. The order matters: the Karanavar went to him before he went to her, methodically, which is the detail the sanitised family version loses."
    },
    {
      "from": "nakulan",
      "to": "thambi",
      "interactionType": "other",
      "valence": "ambiguous",
      "chapter": null,
      "confidence": 0.35,
      "description": "No relationship in life — they are separated by a hundred and fifty years. But Ganga’s alter casts Nakulan as the Karanavar, so he inherits a role he never asked for and cannot argue his way out of."
    },
    {
      "from": "mahadevan",
      "to": "ramanathan",
      "interactionType": "other",
      "valence": "ambiguous",
      "chapter": null,
      "confidence": 0.35,
      "description": "Mahadevan is the real-world trigger the “Ramanathan” projection latches onto. Nothing about him invites it; proximity and the wrong moment are enough."
    }
  ],
  "plantRevealPairs": [
    {
      "id": "pr-01",
      "title": "Nagavalli was purchased, not courted",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-02",
      "title": "Sequential, methodical murders — not one crime of passion",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-03",
      "title": "Ganga's dusty slippers, night one",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-04",
      "title": "Ganga's far-away lapses",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-05",
      "title": "The hand on the stomach",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-06",
      "title": "Sunny's dissociative-ward joke",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-07",
      "title": "The unfamiliar Tamil phrase",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-08",
      "title": "Sridevi's first notebook entry",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-09",
      "title": "Sridevi's habit of quiet observation",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-10",
      "title": "Objects shattering with no clear cause",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-11",
      "title": "\"Possessed\" — spoken, then redirected to Sridevi",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-12",
      "title": "The saree fire",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-13",
      "title": "Mahadevan's clean hands",
      "plants": 1,
      "reveals": 2
    },
    {
      "id": "pr-14",
      "title": "The voice's unusually accurate history",
      "plants": 1,
      "reveals": 2
    },
    {
      "id": "pr-15",
      "title": "The Durgashtami deadline",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-16",
      "title": "Sridevi's notebook opening line",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-17",
      "title": "Sunny and the Namboodiri's prior association",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-18",
      "title": "The ritual mechanism — dummy, lever, ash and smoke",
      "plants": 1,
      "reveals": 2
    },
    {
      "id": "pr-19",
      "title": "Nakulan asked to trust and hold still",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-20",
      "title": "Ganga fears not knowing what she has done",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-21",
      "title": "Sunny and Sridevi, working together",
      "plants": 1,
      "reveals": 2
    },
    {
      "id": "pr-22",
      "title": "The locked door, and Valyammai's warning",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-23",
      "title": "The failed puja against the designed rite",
      "plants": 1,
      "reveals": 1
    },
    {
      "id": "pr-24",
      "title": "The dried jasmine flower",
      "plants": 1,
      "reveals": 0
    },
    {
      "id": "pr-25",
      "title": "The anklets, the mirror, the lamp",
      "plants": 2,
      "reveals": 0
    },
    {
      "id": "pr-26",
      "title": "The damaged ancestor portrait",
      "plants": 1,
      "reveals": 0
    },
    {
      "id": "pr-27",
      "title": "The accountant thread — contradicts the planning docs",
      "plants": 1,
      "reveals": 1
    }
  ]
};

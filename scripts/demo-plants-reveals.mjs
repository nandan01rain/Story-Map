// The demo pack's plant/reveal pairs, as supplied by the writer.
//
// Kept apart from build-demo-fixture.mjs because this is content, not machinery: it is the
// table a writer edits, and it should not have to be found inside a build script to do it.
//
// Each end is anchored by a verbatim quote rather than a character offset, because that is
// how annotations relocate themselves everywhere else in this app (handoff §3.5).
//
// `...` inside an anchor marks an elision: the fragments either side are located in order
// and the whole span BETWEEN them becomes the flagged text. That is what lets a quote skip
// a subordinate clause without anyone having to transcribe the clause perfectly.
//
// Anchors are matched against a normalised copy of the prose — curly quotes and dashes
// folded to ASCII — so a quote pasted out of a plain-text document still matches typographic
// prose. See fold() in the build script for why that fold is strictly one character for one.
//
// A pair with no reveal is not an error. An unpaid plant is a real state, three of the
// entries below are deliberately unpaid, and one is paired in a way that contradicts the
// planning documents — which is worth seeing rather than tidying away.

export const PLANT_REVEAL_PAIRS = [
  {
    id: 'pr-01',
    title: 'Nagavalli was purchased, not courted',
    plants: [
      [
        0,
        `There was no negotiation in the way stories would later tell it. There was a price, and a party who received it, and Nagavalli was not that party.`,
        'The transaction stated plainly, in the only chapter with no family legend layered over it.',
      ],
    ],
    reveals: [
      [
        9,
        `It's not wrong, exactly. It's just missing the part where nobody asked her anything.`,
        `Bhargavi Amma names what the family's version leaves out.`,
      ],
    ],
  },
  {
    id: 'pr-02',
    title: 'Sequential, methodical murders — not one crime of passion',
    plants: [
      [
        0,
        `that he had gone to Ramanathan with the particular unhurried calm...only a decision, executed.`,
        'The cottage first, and the calm of a man walking through stages he has already decided.',
      ],
    ],
    reveals: [
      [
        9,
        `the murders themselves, described not as a single unified act of a man undone by passion but as two separate, sequential acts, the cottage first, methodical, and only afterward, drunk and unravelling, the Thekkini.`,
        'The outside record confirms the order, which is the detail the legend sands off.',
      ],
    ],
  },
  {
    id: 'pr-03',
    title: `Ganga's dusty slippers, night one`,
    plants: [
      [
        1,
        `he knew this only because Ganga's slippers, left neatly by the door the night before, were faintly, inexplicably, dusty.`,
        'She has already walked the gallery, before anyone thinks the keys are missing.',
      ],
    ],
    reveals: [
      [
        10,
        `The dust on her slippers, the very first morning, before the keys were even officially missing.`,
        `Read back as evidence, in Sunny's differential.`,
      ],
    ],
  },
  {
    id: 'pr-04',
    title: `Ganga's far-away lapses`,
    plants: [
      [
        2,
        `that half-second delay, the eyes catching up to the face a beat after the face had already begun to smile.`,
        'The first visible trace of the alter, dressed as tiredness.',
      ],
    ],
    reveals: [
      [
        10,
        `Ganga's far-away moods, first noted by Nakulan before either of them had reason to think anything of it.`,
        'Recognised as an early dissociative symptom rather than travel fatigue.',
      ],
    ],
  },
  {
    id: 'pr-05',
    title: 'The hand on the stomach',
    plants: [
      [
        2,
        `Ganga's hand moved, without her seeming to notice it moving, to rest flat against her stomach`,
        'The undisclosed grief, gestured at and never named.',
      ],
    ],
    reveals: [
      [
        16,
        `"There's something else," he said...About the pregnancy."`,
        'Named at last, and deliberately kept separate from the dissociation.',
      ],
    ],
  },
  {
    id: 'pr-06',
    title: `Sunny's dissociative-ward joke`,
    plants: [
      [
        2,
        `You know I did my residency partly on a dissociative disorders ward. Nothing scares me anymore.`,
        'The diagnosis is in his mouth in Chapter 2, as a joke, eight chapters before he means it.',
      ],
    ],
    reveals: [
      [
        10,
        `He wrote out the clinical picture in full...a Dissociative Identity Disorder`,
        'The joke, made seriously.',
      ],
    ],
  },
  {
    id: 'pr-07',
    title: 'The unfamiliar Tamil phrase',
    plants: [
      [
        3,
        `heard her say something under her breath. A few words, low, in a cadence that was almost but not quite the Tamil the household used, the accent slightly wrong`,
        'A language learned by ear rather than lived in — the tell that it was performed at her, not inherited.',
      ],
    ],
    reveals: [
      [
        10,
        `a grand-aunt on Ganga's side, now deceased...used to perform the whole Nagavalli story for a young, rapt Ganga, in full costume`,
        'Traced to the grand-aunt, in costume, again and again.',
      ],
    ],
  },
  {
    id: 'pr-08',
    title: `Sridevi's first notebook entry`,
    plants: [
      [
        3,
        `G. said something in the Thekkini. Not sure what. Didn't sound like her.`,
        'The record begins the day of the key theft, before anyone knows there is anything to record.',
      ],
    ],
    reveals: [
      [
        10,
        `she reached for her notebook and turned it around to face him. "I've been keeping my own record,"`,
        'Two independent lines of evidence converging — hers built with no knowledge of his.',
      ],
    ],
  },
  {
    id: 'pr-09',
    title: `Sridevi's habit of quiet observation`,
    plants: [
      [
        3,
        `Sridevi noticed things...a person in that position learns, without meaning to, to watch.`,
        'Established as temperament long before it becomes useful.',
      ],
    ],
    reveals: [
      [
        6,
        `You have the look of someone who writes things down.`,
        'Sunny reads it off her in one line, which is how he ends up with a corroborating witness.',
      ],
    ],
  },
  {
    id: 'pr-10',
    title: 'Objects shattering with no clear cause',
    plants: [
      [
        4,
        `A tumbler on the dining table, standing undisturbed, no one within arm's reach, simply — cracked, cleanly`,
        'The first breakage, with a perfectly reasonable explanation already attached to it.',
      ],
    ],
    // The supplied table gives no literal quote for this end — it says the breakages are
    // "listed among the assembled clinical evidence". They are not, individually: the
    // diagnosis paragraph never names the glass. Anchored to the sentence that frames the
    // list instead, and the label says so, because a payoff that is structural rather than
    // stated is exactly the kind of thing this view should not quietly smooth over.
    reveals: [
      [
        10,
        `laying every fact he had out on the small writing desk in his room the way he'd once been trained to lay out a differential diagnosis — not in order of drama, but in order of evidence.`,
        'Folded into the evidence list. Note: that paragraph never names the shattering objects — this payoff is structural, not stated.',
      ],
    ],
  },
  {
    id: 'pr-11',
    title: '"Possessed" — spoken, then redirected to Sridevi',
    plants: [
      [
        5,
        `watched it land first, uncertainly, on his own wife...watched it swing instead toward Sridevi`,
        'The accusation looking for somewhere safer to land.',
      ],
    ],
    reveals: [
      [
        11,
        `"She had nothing to do with it," Sunny said...I'd like the record corrected properly."`,
        'Retracted in public, at the cost of admitting what the accusation was for.',
      ],
    ],
  },
  {
    id: 'pr-12',
    title: 'The saree fire',
    plants: [
      [
        5,
        `Ganga, standing near the shrine room's lamps, her saree already alight along one edge, moving...with a strange deliberate slowness`,
        'Deliberate slowness where panic belongs — the detail that makes it a state, not an attack.',
      ],
    ],
    reveals: [
      [
        10,
        `The saree fire, which Ganga genuinely did not seem to remember, staged close enough to open flame that it read...far more plausibly as an accident involving a person not fully present in her own body than as an attack by anything external.`,
        'Confirmed as a dissociative-state accident.',
      ],
    ],
  },
  {
    id: 'pr-13',
    title: `Mahadevan's clean hands`,
    // Both ends also belong to pr-14: what Sunny noticed in that corridor is part of the
    // same body of evidence as the voice's impossible accuracy, and the Ch 10 differential
    // is where both are read back. This is the case the old one-pair-per-flag shape could
    // not express -- a line doing two jobs at once.
    also: ['pr-14'],
    plants: [
      [
        6,
        `He noted that Mahadevan, kneeling several feet away, had both hands empty and neither sleeve so much as creased.`,
        'The physical evidence nobody else in that corridor is looking at.',
      ],
    ],
    reveals: [
      [
        10,
        `The Alli incident, where the physical evidence — Mahadevan's empty, uncreased hands — had never actually supported the accusation`,
        'Stated outright: the household convicted him by proximity.',
      ],
      [
        14,
        `Sunny watched Ganga's — Nagavalli's — gaze find him and soften, entirely, into something that had nothing to do with the flat fury of a moment before`,
        'Dramatised: the alter was never attacking him. It was recognising him as Ramanathan.',
      ],
    ],
  },
  {
    id: 'pr-14',
    title: `The voice's unusually accurate history`,
    plants: [
      [
        7,
        `details that made Sunny's clinical instincts sharpen even through the genuine unease crawling up his spine: precise turns of phrase, an intimacy with the geography of a court two hundred miles from here`,
        'Accuracy no family retelling could carry.',
      ],
    ],
    reveals: [
      [
        9,
        `Whoever, or whatever, was speaking from behind that locked door knew a version of the story the family itself did not know.`,
        'Matched against the Evoor record — and it narrows the field of explanation rather than widening it.',
      ],
      // The supplied table cites the line below as Ch 9. It is in Ch 10. Kept at its real
      // chapter, with Ch 9's own statement of the same discovery above it.
      [
        10,
        `a version, Sunny was now near certain, that could only have reached Ganga through an unusually thorough, unusually immersive childhood exposure`,
        'The clinical conclusion drawn from it. (The supplied table lists this line under Ch 9; it is in Ch 10.)',
      ],
    ],
  },
  {
    id: 'pr-15',
    title: 'The Durgashtami deadline',
    plants: [
      [
        7,
        `"On Durgashtami," the voice said, when the account was finished, "you will answer for it. I will finish what his hands began, and this time nothing will stop the blade."`,
        'The deadline that structures the whole of Act Three.',
      ],
    ],
    reveals: [
      [
        15,
        `It fell with the full, blind, absolute fury of a hundred and fifty years`,
        'The blade falls, on the night it was promised for.',
      ],
    ],
  },
  {
    id: 'pr-16',
    title: `Sridevi's notebook opening line`,
    plants: [
      [
        8,
        `I did not do this...she wrote, first, because she needed the sentence in her own handwriting where she could look at it.`,
        'Written for herself, with no expectation that anyone will ever read it.',
      ],
    ],
    reveals: [
      [
        10,
        `her account, built with no knowledge of his diagnosis, mapped almost exactly onto the timeline he'd assembled from the other direction.`,
        'The record that corroborates Sunny from the opposite direction.',
      ],
    ],
  },
  {
    id: 'pr-17',
    title: `Sunny and the Namboodiri's prior association`,
    // The supplied table notes this end is narrated rather than quoted. This is the sentence
    // that carries it.
    plants: [
      [
        11,
        `Old associate. We crossed paths years ago, on a case that needed exactly this kind of cooperation and neither of us expected to find it in the other.`,
        'One line, so Act Three can skip a slow-build introduction. The backstory itself stays deliberately unwritten.',
      ],
    ],
    reveals: [
      [
        12,
        `I have sat with a great many griefs in my life that called themselves spirits, doctor. I do not think you and I are describing different events.`,
        'The collaboration is the payoff. The shared history is never elaborated.',
      ],
    ],
  },
  {
    id: 'pr-18',
    title: 'The ritual mechanism — dummy, lever, ash and smoke',
    plants: [
      [
        12,
        `a lifelike straw dummy, dressed and weighted to convince a blade under poor light and worse composure; a hidden lever, silent...the timing of the ash and smoke coordinated exactly against that swap`,
        'Designed on the page, in full, three chapters before it runs.',
      ],
    ],
    reveals: [
      [
        15,
        `casting a great handful of sacred ash and thick ceremonial smoke directly into the path of the descending blade`,
        'The blinding: ritually correct and operationally necessary at the same instant.',
      ],
      [15, `The lever gave way smoothly, silently`, 'The swap, executed under pressure.'],
    ],
  },
  {
    id: 'pr-19',
    title: 'Nakulan asked to trust and hold still',
    // The swap is the mechanism; his stillness is what makes it work. Neither pays off
    // without the other, so both ends sit in pr-18 as well.
    also: ['pr-18'],
    plants: [
      [
        13,
        `Hold still. Trust the ground under your feet more than what your eyes are telling you. That's all I'm asking.`,
        'The one thing this book ever actually asks of him.',
      ],
    ],
    reveals: [
      [
        15,
        `Nakulan — who had, to his eternal credit, not flinched, not moved, held the trust he'd been asked to hold with a stillness Sunny would remember for the rest of his life`,
        'He holds. It is the whole of his arc, paid in one sentence.',
      ],
    ],
  },
  {
    id: 'pr-20',
    title: 'Ganga fears not knowing what she has done',
    plants: [
      [
        13,
        `I'm frightened, Nakulan. Not of the ghost. Of not knowing what I've been doing while I wasn't there for it.`,
        'The real fear, stated the night before, and it is not the ghost.',
      ],
    ],
    reveals: [
      [
        16,
        `"You don't have her memories," Sunny said, gently, "because they were never yours to have.`,
        'Answered honestly rather than kindly.',
      ],
    ],
  },
  {
    id: 'pr-21',
    title: 'Sunny and Sridevi, working together',
    plants: [
      [
        10,
        `"This is extraordinary," he said, and meant it entirely as a compliment. "You'd have made a decent clinician."`,
        'Small, collaborative, and not yet romantic.',
      ],
    ],
    reveals: [
      [
        16,
        `I was thinking you might consider coming with me`,
        'The proposal — earned across several such moments rather than declared.',
      ],
      [16, `and said yes`, 'Two words, after a paragraph of him not managing to ask cleanly.'],
    ],
  },
  {
    id: 'pr-22',
    title: `The locked door, and Valyammai's warning`,
    plants: [
      [
        1,
        `"You will not go near that door," Valyammai said`,
        'The prohibition, delivered to the room and aimed at one person in it.',
      ],
    ],
    reveals: [
      [
        16,
        `"The room's staying open," Valyammai said. "I decided. No more locking things away and hoping."`,
        'The prohibition withdrawn, by the person who issued it.',
      ],
    ],
  },
  {
    id: 'pr-23',
    title: 'The failed puja against the designed rite',
    plants: [
      [
        5,
        `The rite ended without incident, which should have been a relief and instead only deepened the unease in the room — a ritual that produces no visible effect is...evidence that whatever is happening is stronger than the tools they have to address it.`,
        'Tradition alone, and it does nothing.',
      ],
    ],
    // Structural in the supplied table rather than a quoted pair. Anchored to the sentence
    // where the Namboodiri states the principle that makes the second rite work.
    reveals: [
      [
        12,
        `I will perform a correct and complete rite. Whether that satisfies your clinical requirements as well is, I suspect, a question of design rather than contradiction.`,
        'The same rite, designed rather than merely performed. (Structural payoff — the supplied table quotes no line for this end.)',
      ],
    ],
  },

  // Unpaid by design. These carry no reveal, which is exactly why they are here: an open
  // plant should be visible as open rather than absent.
  {
    id: 'pr-24',
    title: 'The dried jasmine flower',
    plants: [
      [
        0,
        `She kept, in a box she told no one about, a single dried jasmine flower from the first night he had told her, plainly, without performance, that he loved her`,
        'Never returned to, anywhere in the manuscript.',
      ],
    ],
    reveals: [],
  },
  {
    id: 'pr-25',
    title: 'The anklets, the mirror, the lamp',
    plants: [
      [
        0,
        `The anklets were still on the floor of the Thekkini three days later`,
        'Set down where they fell, and left there for a century and a half.',
      ],
      [
        3,
        `a cracked mirror that had lost most of its silvering, and, near the foot of the bed, a pair of anklets, tarnished black`,
        'Seen again, close up — and then not used.',
      ],
    ],
    // The original Plants & Reveals table expected these back in Ch 13/15. They never come.
    reveals: [],
  },
  {
    id: 'pr-26',
    title: 'The damaged ancestor portrait',
    plants: [
      [
        4,
        `a long diagonal slash through the painted hands, crudely repaired with backing cloth that had itself gone dark with age.`,
        `The slash goes through the hands specifically. Ch 9's true history never reconnects to the image.`,
      ],
    ],
    reveals: [],
  },

  // Paired in the prose, and that is the problem: the planning documents specify this thread
  // stays unresolved. Carried as a pair so both ends are visible together, with the conflict
  // stated on each end rather than in a separate document nobody opens.
  {
    id: 'pr-27',
    title: 'The accountant thread — contradicts the planning docs',
    plants: [
      [
        8,
        `the argument she'd overheard three days earlier between Achuthan Pillai and Nakulan's uncle over the quarterly accounts — a detail she had noted at the time only out of habit`,
        'Story Bible §3 and the Continuity Timeline both specify this thread stays unresolved.',
      ],
    ],
    reveals: [
      [
        11,
        `a conversation, quietly reconstructed, that placed Achuthan Pillai's movements near the kitchen at precisely the relevant window, and a financial motive nobody had bothered examining`,
        'The prose resolves it anyway. This reveal contradicts the plan — it needs a decision, not a fix.',
      ],
    ],
  },
];

// Mythic threads for the demo pack.
//
// A mythic thread is a NOTE the writer has marked as a parallel to a known mythological arc
// or setting. The Southern Wing states no such parallels itself, so unlike the plant/reveal
// table above — which is the writer's own, verbatim — these are DEMO ANNOTATIONS written to
// exercise the feature. They are deliberately the most universal motifs the material
// actually contains, not readings imposed on it, and nothing here should be mistaken for a
// claim about the manuscript.
//
// Same anchor rules as the pairs: a verbatim quote, `...` for an elision.
// `character` is a key from the character bible, resolved to a real node id at import.
export const MYTHIC_THREADS = [
  {
    thread: 'The forbidden chamber',
    // Ganga, not Valyammai: the motif belongs to whoever transgresses, and Valyammai is not
    // in the character bible's cast anyway. It also gives one character two threads, which
    // is what the browse-by-character view exists to show.
    character: 'ganga',
    touches: [
      [1, `The keys held, always, by the household's eldest, never touched, never spoken of lightly.`,
        'Bluebeard, Pandora, Lot’s wife: the room that must not be opened, and the certainty that it will be. The prohibition is the plot.'],
      [5, `It's opened,`,
        'The motif completes the moment the door gives. Everything after is consequence, which is how the forbidden-chamber story always runs.'],
      [16, `the Thekkini's door standing open behind them in the afternoon light, empty now, ordinary, a room like any other room, waiting for nothing at all.`,
        'And the inversion: the taboo is lifted, so the chamber stops being a chamber. It is just a room, which is the most that can be said for it.'],
    ],
  },
  {
    thread: 'The goddess and the demon',
    character: 'ganga',
    touches: [
      [7, `references to a betrayal, to a river of Thanjavur, to a man's hands.`,
        'The register the alter sings in is devotional. It is building itself a myth to act inside, and it has cast the parts already.'],
      [14, `"He is here," the Namboodiri agreed, matching her register exactly, "and the debt will be answered, as promised`,
        'Durgashtami is the night Durga kills Mahishasura. The alter casts itself as the goddess and Nakulan as the demon, which is exactly the wrong way round.'],
      [15, `"Go freely," he said, "as you were promised. The debt is paid. You are released."`,
        'The frame is honoured in form and refused in substance: the rite completes, the killing does not. Both traditions get to claim the result.'],
    ],
  },
  {
    thread: 'The woman taken',
    character: 'nagavalli',
    touches: [
      [0, `she was being described in the same conversations as the horses and the silverware`,
        'Sita, Persephone, Helen — the abducted woman whose story is told by everyone except her. Ch 0 exists to give her the telling back.'],
      [9, `the transaction, not a courtship; Ramanathan already her partner before the Karanavar had ever laid eyes on her, not a seducer who stole her away`,
        'Named outright, a century and a half later, by a stranger with no stake in the family’s version of it.'],
    ],
  },
];

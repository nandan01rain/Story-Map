# StoryMap Demo Pack — "The Southern Wing"

Synthetic test project for exercising every StoryMap feature. Structurally inspired by the plot beats of a well-known 1993 Malayalam film (public-domain-level plot facts only), fully rewritten and expanded into original bible/breakdown prose — not a reproduction of any source text.

## Files & suggested StoryMap mapping

| File | Maps to |
|---|---|
| `00_Project_Overview.md` | Project + Book metadata, logline, structure-at-a-glance |
| `01_Story_Bible.md` | Story Bible entity — world, mechanics, themes, craft rules |
| `02_Character_Bible.md` | Characters entity (11 character records, with relationships) |
| `03_Locations.md` | Locations entity (5 locations) |
| `04_Act_Breakdown.md` | Acts (3) → Chapters (17, Ch 0–16) — Purpose/Events/Character/Setup-Payoff/Ends-on per chapter; POV field per chapter |
| `05_Plants_and_Reveals.md` | Plants/Reveals entity (18 tracked items, 2 intentionally left open) |
| `06_Continuity_Timeline.md` | Continuity entity — historical timeline + 18-day present-day timeline + 4 open flags |
| `07_Patch_1.md` | Patch workflow test — resolves one PROPOSED item to CANON |
| `08_InWorld_Document_Namboodiri_Ritual_Notes.md` | Documents entity — in-world artifact, distinct from meta-bible docs |

## Suggested test pass

1. Import Project → Book → 3 Acts → 17 Chapters, check nesting and ordering.
2. Import Characters and wire up relationships between records (Ganga↔Nakulan, Sunny↔Sridevi, etc.) — good test of relationship-linking UI.
3. Import Locations and check chapter↔location cross-referencing (several locations recur across many chapters; Thanjavur/the cottage are single-chapter-only, good edge case).
4. Import Plants & Reveals and confirm the two intentionally-open items (#13, #17) render distinctly from resolved ones.
5. Import Continuity and confirm the four flagged [OPEN] items surface as contradictions/gaps rather than silently passing.
6. Apply Patch 1 and confirm it correctly updates the PROPOSED tags in the Story Bible and Character Bible to CANON without requiring manual re-entry.
7. Import the in-world document and confirm it's distinguishable from the meta/bible documents in the Documents view.
8. POV tracking: confirm the rotating Sunny/Nakulan/Sridevi pattern (plus the two single-use POVs, Ch 0 and Ch 16) displays correctly across the chapter list.

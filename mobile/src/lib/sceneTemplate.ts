// The shape a scene is written in (2026-10-12) -- a reference, not a rule.
//
// Taken from the saga's own chapter breakdowns (the "CH 0-15" entries of the 05 drafted set),
// which already carry exactly these parts: a heading, POV · Status, Purpose, Events, Character
// & reactions, Ends on. A scene can stop there -- a few lines of what happens -- or carry its
// full draft with dialogue in the Draft section at the foot. Nothing reads these fields as
// data: they are markdown, rendered by the same reader as every other scene, so a scene that
// ignores the template is as valid as one that fills it in, and the 284 of the 300 loaded
// scenes that are free-form canon notes need no conversion to keep working.
//
// Chapter is optional and is the CHAPTER NUMBER the scene is meant for, if known -- the link
// to the real chapter is made by "Make this a chapter", not by this line.

export type SceneParts = { heading?: string; description?: string };

/** A new scene, its fields empty. The heading falls back to the first line written. */
export function sceneTemplate({ heading = '', description = '' }: SceneParts = {}): string {
  return [
    `## ${heading}`.trimEnd(),
    ...(description.trim() ? [description.trim()] : []),
    '',
    '**Chapter:** ',
    '**POV:**  · **Status:** Idea',
    '',
    '**Purpose:** ',
    '',
    '**Events**',
    '- ',
    '',
    '**Characters & reactions:** ',
    '',
    '**Ends on:** ',
    '',
    '---',
    '',
    '**Draft**',
    '',
    '',
  ].join('\n');
}

/**
 * A page turned into a scene. Its first line becomes the heading and everything after it is
 * kept, word for word, as the description under the heading -- nothing is guessed into
 * Purpose or Events, because a page is a stray thought and only the writer knows which part
 * it is.
 */
export function pageToScene(pageText: string): string {
  const lines = pageText.replace(/\r\n?/g, '\n').split('\n');
  const first = lines.findIndex((l) => l.trim().length > 0);
  if (first === -1) return sceneTemplate();
  const heading = lines[first].trim().replace(/^#+\s*/, '').replace(/^\*\*(.*)\*\*$/, '$1');
  const description = lines.slice(first + 1).join('\n').replace(/^\n+|\n+$/g, '');
  return sceneTemplate({ heading, description });
}

/** A scene's first line as a title: heading markers and bold stripped. */
export function plainHeading(line: string): string {
  return line.trim().replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
}

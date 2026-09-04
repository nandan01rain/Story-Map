// Shared navigation param types -- keep in sync with RootNavigator's stack.
export type SignedInStackParamList = {
  ProjectPicker: undefined;
  ChapterList: { projectId: string; projectName: string };
  ChapterDrawer: { chapterId: string; projectId: string };
  Editor: { chapterId: string; jumpToText?: string };
  Reader: { projectId: string; projectName?: string; chapterId?: string; jumpToText?: string };
  Settings: undefined;
  /** The stack of raw-capture pages. Replaces the old sticky-note board. */
  Pages: { projectId: string };
  /**
   * Treatments: one scene described, dialogue unwritten. Ordered saga-wide and deliberately
   * carrying no chapter/book/act -- scenes get written before anyone knows where they go.
   */
  Treatments: { projectId: string };
  Treatment: { projectId: string; treatmentId: string };
  /**
   * One page, open for writing. No `pageId` means a blank one -- and no database row is
   * created until the first character is typed, so opening a blank page costs nothing.
   */
  Page: { projectId: string; pageId?: string };
  Search: { projectId: string };
  Documents: { projectId: string };
  DriveImport: { projectId: string };
  Assistant: { projectId: string; chapterId?: string };
  /**
   * `focusNodeId` opens the web on one thing rather than on the saga.
   *
   * It is a plain node id, and no translation is needed at either end: a chapter, a scene
   * and an annotation are all nodes in the graph under their own database ids, so the Reader
   * can hand over the flag the writer just selected and the web will land on it.
   */
  Braid: { projectId: string; focusNodeId?: string };
  Trash: { projectId: string };
  GraphReview: { projectId: string };
};

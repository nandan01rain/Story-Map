// Shared navigation param types -- keep in sync with RootNavigator's stack.
export type SignedInStackParamList = {
  ProjectPicker: undefined;
  ChapterList: { projectId: string; projectName: string };
  ChapterDrawer: { chapterId: string; projectId: string };
  Editor: { chapterId: string; jumpToText?: string };
  Reader: { projectId: string; projectName?: string; chapterId?: string; jumpToText?: string };
  Settings: undefined;
  StickyNotes: { projectId: string; noteId?: string };
  Search: { projectId: string };
  Documents: { projectId: string };
  DriveImport: { projectId: string };
  Assistant: { projectId: string; chapterId?: string };
  /** `focusChapterId` opens the web on that chapter's event, when it is reached from the
   *  Reader or the Editor rather than from the menu. */
  CharacterWeb: { projectId: string; focusChapterId?: string };
  GraphReview: { projectId: string };
};

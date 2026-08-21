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
};

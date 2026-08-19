// Shared navigation param types. Editor is added when its screen lands (Phase 1,
// task #4) -- keep this in sync with RootNavigator's stack.
export type SignedInStackParamList = {
  ProjectPicker: undefined;
  ChapterList: { projectId: string; projectName: string };
  ChapterDrawer: { chapterId: string; projectId: string };
};

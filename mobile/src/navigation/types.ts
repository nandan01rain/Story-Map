// Shared navigation param types -- keep in sync with RootNavigator's stack.
export type SignedInStackParamList = {
  ProjectPicker: undefined;
  ChapterList: { projectId: string; projectName: string };
  ChapterDrawer: { chapterId: string; projectId: string };
  Editor: { chapterId: string };
};

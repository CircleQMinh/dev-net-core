import {
  CurriculumTreeView,
  type CurriculumSubTopicNode,
} from "./CurriculumTreeView";

type LeftContentPanelProps = {
  activeTopicId?: string;
  isWelcomeContent: boolean;
  onTopicSelect: (topic: CurriculumSubTopicNode) => void;
};

export function LeftContentPanel({
  activeTopicId,
  isWelcomeContent,
  onTopicSelect,
}: LeftContentPanelProps) {
  return (
    <aside className="sticky top-[80px] hidden h-[calc(100vh-80px)] w-[300px] shrink-0 flex-col overflow-hidden border-r theme-ide-pane theme-ide-divider lg:flex">
      <div className="content-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <CurriculumTreeView
          activeTopicId={activeTopicId}
          onTopicSelect={onTopicSelect}
          selectDefaultTopic={!isWelcomeContent}
          showProgress={!isWelcomeContent}
        />
      </div>
    </aside>
  );
}

import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  CurriculumTreeView,
  findCurriculumTopicById,
  getFirstCurriculumTopic,
  getMarkdownBody,
  type CurriculumTopicNode,
} from "../components/content/CurriculumTreeView";
import { MainContent } from "../components/content/MainContent";
import { OnThisPageNavigation } from "../components/content/OnThisPageNavigation";
import { RightContentPanel } from "../components/content/RightContentPanel";

const categoryOrder = {
  ".NET": 1,
  "Design & Architecture": 2,
  "SQL": 3,
  "React": 4,
  "Azure": 5,
}

const topicOrder = {
  ".NET": {
    "C# Language Foundations": 1,
    "Modern C# patterns": 2,
    "Async programming, tasks, cancellation, and concurrency": 3,
  },
}

export default function Content() {
  const { topicId } = useParams<{ topicId?: string }>();
  const navigate = useNavigate();
  const firstTopic = getFirstCurriculumTopic();
  const selectedTopic = topicId ? findCurriculumTopicById(topicId) : undefined;

  if (!firstTopic) {
    return (
      <ContentLayout
        markdown=""
        onTopicSelect={() => undefined}
        selectedTopic={undefined}
      />
    );
  }

  if (!topicId || !selectedTopic) {
    return <Navigate replace to={`/content/${firstTopic.id}/`} />;
  }

  const selectTopic = (topic: CurriculumTopicNode) => {
    navigate(`/content/${topic.id}/`);
  };

  return (
    <ContentLayout
      markdown={getMarkdownBody(selectedTopic.loadContentSync())}
      onTopicSelect={selectTopic}
      selectedTopic={selectedTopic}
    />
  );
}

type ContentLayoutProps = {
  markdown: string;
  selectedTopic?: CurriculumTopicNode;
  onTopicSelect: (topic: CurriculumTopicNode) => void;
};

function ContentLayout({
  markdown,
  selectedTopic,
  onTopicSelect,
}: ContentLayoutProps) {
  return (
    <div className="theme-page mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1440px] pt-[80px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r theme-ide-pane theme-ide-divider lg:flex">
        <div className="content-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
          <CurriculumTreeView
            activeTopicId={selectedTopic?.id}
            onTopicSelect={onTopicSelect}
          />
          <OnThisPageNavigation />
        </div>
      </aside>

      <MainContent markdown={markdown} topic={selectedTopic} />
      <RightContentPanel />
    </div>
  );
}

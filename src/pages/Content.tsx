import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  findCurriculumSubTopicById,
  getFirstCurriculumSubTopic,
  getMarkdownBody,
  type CurriculumSubTopicNode,
} from "../components/content/CurriculumTreeView";
import { LeftContentPanel } from "../components/content/LeftContentPanel";
import { MainContent } from "../components/content/MainContent";
import { RightContentPanel } from "../components/content/RightContentPanel";
import { removeCommonInterviewQuestionsSection } from "../components/content/markdown";
import { useAppDispatch, useAppSelector } from "../lib/redux/hooks/hooks";
import { selectSelectedContentTopicId } from "../lib/redux/selectors/contentSelectors";
import { setSelectedTopicId } from "../lib/redux/slices/contentSlice";

export default function Content() {
  const { topicId } = useParams<{ topicId?: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const selectedTopicId = useAppSelector(selectSelectedContentTopicId);
  const firstTopic = getFirstCurriculumSubTopic();
  const selectedTopic = topicId ? findCurriculumSubTopicById(topicId) : undefined;
  const routeSelectedTopicId = selectedTopic?.id;

  useEffect(() => {
    if (routeSelectedTopicId && selectedTopicId !== routeSelectedTopicId) {
      dispatch(setSelectedTopicId(routeSelectedTopicId));
    }
  }, [dispatch, routeSelectedTopicId, selectedTopicId]);

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

  const selectTopic = (topic: CurriculumSubTopicNode) => {
    if (selectedTopicId !== topic.id) {
      dispatch(setSelectedTopicId(topic.id));
    }

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
  selectedTopic?: CurriculumSubTopicNode;
  onTopicSelect: (topic: CurriculumSubTopicNode) => void;
};

function ContentLayout({
  markdown,
  selectedTopic,
  onTopicSelect,
}: ContentLayoutProps) {
  const navigationMarkdown = removeCommonInterviewQuestionsSection(markdown);

  return (
    <div className="theme-page mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1440px] pt-[80px]">
      <LeftContentPanel
        activeTopicId={selectedTopic?.id}
        markdown={navigationMarkdown}
        onTopicSelect={onTopicSelect}
      />
      <MainContent markdown={markdown} topic={selectedTopic} />
      <RightContentPanel topic={selectedTopic} />
    </div>
  );
}

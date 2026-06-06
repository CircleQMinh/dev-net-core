import {
  extractCommonInterviewQuestions,
  type CommonInterviewQuestion,
} from "../components/content/markdown";
import {
  getAllCurriculumTopics,
  getCurriculumSubTopicsByTopic,
} from "./function";
import type { SimulationDifficultyLevel } from "../lib/redux/slices/simulationSlice";

type KnownQuestionLevel = "Beginner" | "Intermediate" | "Advanced";

type DifficultyProfile = Record<KnownQuestionLevel, number>;

type SimulationQuestionCandidate = {
  difficulty: KnownQuestionLevel | "Other";
  question: SimulationQuestion;
};

export type GenerateSimulationQuestionsInput = {
  difficultyLevel: SimulationDifficultyLevel;
  numberOfQuestionsPerTopic: number;
  selectedSubTopicIds: string[];
  selectedTopicIds: string[];
};

export type SimulationQuestion = {
  category: string;
  expectedAnswerMarkdown: string;
  id: string;
  keyPointsMarkdown: string;
  label: string;
  level: string;
  question: string;
  sourceQuestionId: string;
  subTopic: string;
  subTopicId: string;
  topic: string;
  topicId: string;
};

const questionLevels: KnownQuestionLevel[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
];

const difficultyProfiles: Record<
  SimulationDifficultyLevel,
  DifficultyProfile
> = {
  entry: {
    Beginner: 70,
    Intermediate: 25,
    Advanced: 5,
  },
  standard: {
    Beginner: 15,
    Intermediate: 60,
    Advanced: 25,
  },
  expert: {
    Beginner: 10,
    Intermediate: 30,
    Advanced: 60,
  },
};

export function GenerateSimulationQuestions({
  difficultyLevel,
  numberOfQuestionsPerTopic,
  selectedSubTopicIds,
  selectedTopicIds,
}: GenerateSimulationQuestionsInput): SimulationQuestion[] {
  if (
    !Number.isSafeInteger(numberOfQuestionsPerTopic) ||
    numberOfQuestionsPerTopic <= 0
  ) {
    return [];
  }

  const topicsById = new Map(
    getAllCurriculumTopics().map((topic) => [topic.id, topic])
  );
  const selectedSubTopicIdSet = new Set(selectedSubTopicIds);
  const uniqueSelectedTopicIds = Array.from(new Set(selectedTopicIds));

  return uniqueSelectedTopicIds.flatMap((topicId) => {
    const topic = topicsById.get(topicId);

    if (!topic) {
      return [];
    }

    const candidates = getCurriculumSubTopicsByTopic(topic)
      .filter((subTopic) => selectedSubTopicIdSet.has(subTopic.id))
      .flatMap((subTopic) =>
        createQuestionCandidates(
          extractCommonInterviewQuestions(subTopic.loadContentSync()),
          {
            category: subTopic.category,
            subTopic: subTopic.subtopic,
            subTopicId: subTopic.id,
            topic: subTopic.topic,
            topicId,
          }
        )
      );

    return selectQuestionsForDifficulty(
      candidates,
      numberOfQuestionsPerTopic,
      difficultyProfiles[difficultyLevel]
    );
  });
}

function createQuestionCandidates(
  questions: CommonInterviewQuestion[],
  source: Pick<
    SimulationQuestion,
    "category" | "subTopic" | "subTopicId" | "topic" | "topicId"
  >
): SimulationQuestionCandidate[] {
  const sourceIdCounts = new Map<string, number>();

  return questions.map((question, questionIndex) => {
    const sourceQuestionId =
      question.id.trim() || `question-${questionIndex + 1}`;
    const occurrence = (sourceIdCounts.get(sourceQuestionId) ?? 0) + 1;
    sourceIdCounts.set(sourceQuestionId, occurrence);
    const idSuffix =
      occurrence === 1 ? sourceQuestionId : `${sourceQuestionId}-${occurrence}`;

    return {
      difficulty: normalizeQuestionLevel(question.level),
      question: {
        ...source,
        expectedAnswerMarkdown: question.expectedAnswerMarkdown,
        id: `${source.subTopicId}::${idSuffix}`,
        keyPointsMarkdown: question.keyPointsMarkdown,
        label: question.label,
        level: question.level,
        question: question.question,
        sourceQuestionId,
      },
    };
  });
}

function selectQuestionsForDifficulty(
  candidates: SimulationQuestionCandidate[],
  requestedCount: number,
  profile: DifficultyProfile
) {
  const selectionCount = Math.min(requestedCount, candidates.length);

  if (selectionCount === 0) {
    return [];
  }

  const targetCounts = allocateQuestionLevels(selectionCount, profile);
  const selectedQuestionIds = new Set<string>();

  questionLevels.forEach((level) => {
    candidates
      .filter((candidate) => candidate.difficulty === level)
      .slice(0, targetCounts[level])
      .forEach((candidate) => selectedQuestionIds.add(candidate.question.id));
  });

  if (selectedQuestionIds.size < selectionCount) {
    const fallbackLevelOrder = [...questionLevels].sort(
      (left, right) =>
        profile[right] - profile[left] ||
        questionLevels.indexOf(left) - questionLevels.indexOf(right)
    );
    const fallbackCandidates = [
      ...fallbackLevelOrder.flatMap((level) =>
        candidates.filter((candidate) => candidate.difficulty === level)
      ),
      ...candidates.filter((candidate) => candidate.difficulty === "Other"),
    ];

    for (const candidate of fallbackCandidates) {
      selectedQuestionIds.add(candidate.question.id);

      if (selectedQuestionIds.size === selectionCount) {
        break;
      }
    }
  }

  return candidates
    .filter((candidate) => selectedQuestionIds.has(candidate.question.id))
    .map((candidate) => candidate.question);
}

function allocateQuestionLevels(
  questionCount: number,
  profile: DifficultyProfile
) {
  const allocation = {
    Beginner: 0,
    Intermediate: 0,
    Advanced: 0,
  } satisfies Record<KnownQuestionLevel, number>;
  const remainders = questionLevels.map((level) => {
    const exactCount = (questionCount * profile[level]) / 100;
    allocation[level] = Math.floor(exactCount);

    return {
      level,
      remainder: exactCount - allocation[level],
    };
  });
  let unallocatedCount =
    questionCount -
    questionLevels.reduce((total, level) => total + allocation[level], 0);

  remainders
    .sort(
      (left, right) =>
        right.remainder - left.remainder ||
        profile[right.level] - profile[left.level] ||
        questionLevels.indexOf(left.level) -
          questionLevels.indexOf(right.level)
    )
    .forEach(({ level }) => {
      if (unallocatedCount > 0) {
        allocation[level] += 1;
        unallocatedCount -= 1;
      }
    });

  return allocation;
}

function normalizeQuestionLevel(
  level: string
): KnownQuestionLevel | "Other" {
  const normalizedLevel = level.trim().toLowerCase();

  if (normalizedLevel === "beginner") {
    return "Beginner";
  }

  if (normalizedLevel === "intermediate") {
    return "Intermediate";
  }

  if (normalizedLevel === "advanced") {
    return "Advanced";
  }

  return "Other";
}

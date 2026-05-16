import { ContentCodeBlock } from "./ContentCodeBlock";
import { ContentHOne } from "./ContentHOne";
import { ContentHThree } from "./ContentHThree";
import { ContentHTwo } from "./ContentHTwo";
import { ContentImage } from "./ContentImage";
import { ContentLink } from "./ContentLink";
import { ContentParagraph } from "./ContentParagraph";

export const markdownComponentMap = {
  a: ContentLink,
  h1: ContentHOne,
  h2: ContentHTwo,
  h3: ContentHThree,
  img: ContentImage,
  p: ContentParagraph,
  pre: ContentCodeBlock,
} as const;
